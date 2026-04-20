# Niya Labs — Analyzer Architecture

## High-level overview

Niya Labs ships two products on a shared backend: **Companion** (a VRM VTuber
with ElevenLabs TTS) and **Tools** (a microstructure analyzer for BNB Chain
tokens). Both are served by the same Next.js app and share auth, rate limiting,
and DGrid LLM plumbing. The Chrome extension and the `/tools` web surface are
thin clients over the same HTTP API. This document focuses on the Tools
analyzer: how a pasted contract address becomes a 0–100 rug-risk score and
eight rendered cards. For extension-specific internals (content scripts, MV3
messaging), see `extension/CLAUDE.md`.

## The 8-second pipeline

```
                                ┌──────────────────────────────────────────┐
  USER pastes CA on             │  Client (web /tools page  OR  extension │
  /tools or the extension ──────▶  side panel). Debounced input →          │
  side panel input              │  useMicrostructure() hook issues POST   │
                                └─────────────────┬────────────────────────┘
                                                  │
                                                  ▼
                         POST /api/nyla-tools/microstructure
                         (src/pages/api/nyla-tools/microstructure.ts)
                         ┌────────────────────────────────────────────┐
                         │  validate 0x-regex, read MORALIS_API_KEY  │
                         │  + MORALIS_API_KEY_2, DB cache lookup      │
                         │  (10-min TTL, version-gated)               │
                         └──────────────────┬─────────────────────────┘
                                            │ cache miss
                                            ▼
                        computeMicrostructure(ca, keys, source)
                        (src/features/nylaTools/microstructure.ts)
                        ┌────────────────────────────────────────────┐
                        │  Promise.all fan-out (parallel):           │
                        │                                            │
                        │   ├─ Moralis: fetchTokenHolders (top 100) │
                        │   ├─ Moralis: fetchTokenMetadata          │
                        │   ├─ GoPlus:  fetchTokenSecurity          │
                        │   └─ GMGN:    fetchTopHolders (tags)      │
                        │                                            │
                        │  summarizeHolders() — apply               │
                        │  knownContracts registry, compute          │
                        │  top10EffectiveShare                       │
                        │                                            │
                        │  inferLpFromGoPlus() → inferLp() fallback │
                        │  computeSnipers() (only if age ≤ 30 d)    │
                        │  detectClusters() — 2-hop funder graph    │
                        │                                            │
                        │  computeRugRiskScore() → 0..100            │
                        │  buildHeadline()      → string             │
                        └──────────────────┬─────────────────────────┘
                                           │
                                           ▼
                        DB cache write (nylaMicrostructureCache)
                                           │
                                           ▼
                        JSON response { data, cached }
                                           │
                                           ▼
                        Web: src/components/niyaTools/sidepanel/App.tsx
                        Extension: extension/src/sidepanel/…
                        renders 8 cards:
                          TopBar · Headline · Verdict · Findings ·
                          Chart · NiyaSees · Ledger · Alerts · AskNiya
```

End-to-end cold call: **~5–8 seconds** (Moralis and GoPlus are the long
poles; GMGN is best-effort and shells out to `gmgn-cli` for Ed25519 signing).

## Data sources

### Moralis — primary holders + transfers

File: `src/features/nylaTools/moralis.ts`. Base: `deep-index.moralis.io/v2.2`.

- **Signals contributed:** `totalHolders`, top-100 holder distribution (address
  + share), token metadata (name / symbol / `created_at` used for token age),
  first 30 token transfers (sniper seed set), per-wallet token balance (sniper
  share), wallet funding history (cluster detection), first-tx timestamp
  (wallet-age tiering).
- **Rate limits:** 40k compute units / day on the free tier. Each call costs
  1–5 CU. We rotate between `MORALIS_API_KEY` and `MORALIS_API_KEY_2` inside
  `call()` (moralis.ts:26): a `401` from key #1 transparently retries on
  key #2. Sniper fan-out is capped at 30 wallets to bound CU burn.
- **Failure mode:** each parallel call has its own `.catch()` in
  `computeMicrostructure` (microstructure.ts:614). Holders failure yields an
  empty summary, metadata failure nulls the age, transfers failure skips
  snipers. The pipeline never aborts on a single source outage.
- **Score columns:** holder concentration (top10EffectiveShare, topHolderShare,
  totalHolders), token age, sniper share, cluster share.

### GoPlus — security + LP truth

File: `src/features/nylaTools/goplus.ts`. Base: `api.gopluslabs.io/v1`, BSC
chain ID `56`. Keyless, public, free.

- **Signals contributed:** `isHoneypot`, buy/sell tax, `isOpenSource`,
  `canTakeOwnership`, `canModifyTax` (slippage modifiable), deployer address,
  actual LP-pair token holder list (`lp_holders`), and a second opinion on
  `holder_count` (which we prefer when it exceeds Moralis' 100-row cap).
- **Rate limits:** generous public quota, undocumented but in practice ≫ our
  usage. No key to rotate.
- **Failure mode:** any HTTP error, non-`code=1` payload, or exception returns
  `null` gracefully (goplus.ts:82–127). The orchestrator treats `null` as
  "no security data" and the scorer simply skips those factors.
- **Score columns:** honeypot (+40), sell tax (+15 when > 10%), ownership
  recoverable (+10), buy tax (+10 when > 10%), tax modifiable (+10), closed
  source (+5). LP inference via `inferLpFromGoPlus` is the highest-priority
  LP signal — see microstructure.ts:660.

### GMGN — behavioural tags

File: `src/features/nylaTools/gmgn.ts`. Best-effort enrichment only.

- **Signals contributed:** per-address behavioural tags (`whale`, `cex`,
  `smart_money`, `renowned`, `suspicious`) attached to Moralis top-10 rows
  for the UI.
- **Implementation:** shells out to the `gmgn-cli` subprocess
  (`node_modules/gmgn-cli/dist/index.js`) via `execFile`. The CLI handles
  Ed25519 request signing, the IPv4-only quirk, and the 1-call/5s internal
  rate limit. Credentials live in `~/.config/gmgn/.env`. Direct HTTP is
  blocked by Cloudflare — see `memory/project_gmgn_cloudflare.md`.
- **Failure mode:** empty array fallback (microstructure.ts:625). Scoring
  never depends on GMGN; only the UI tag chips degrade.
- **Score columns:** none directly. Informational only.

## Scoring function

`computeRugRiskScore(input)` lives in
`src/features/nylaTools/microstructure.ts:68`. It is a single pass, no ML,
every branch is a plain `if`. The contract is:

```
input  → { top10EffectiveShare, topHolderShare, totalHolders, lp,
           snipers, devWallet, security, tokenAgeDays, clusters }
output → integer 0..100, clamped via Math.max(0, Math.min(100, score))
```

Accompanying string output comes from `buildHeadline()` (line 159), which
picks the single highest-weighted reason and produces the one-liner shown on
the Verdict card. The public result also carries `tags[]`-equivalent data
through `topHolders[].gmgnTags` and `topHolders[].category`.

Weight table (non-bonding-curve tokens):

| Factor                          | Penalty range |
|---------------------------------|---------------|
| Holder concentration (top-10)   | +10 / +20 / +35 at 40% / 60% / 80% effective share (heaviest single lever) |
| Honeypot (GoPlus)               | +40 (instant red flag) |
| LP not locked or < 5% locked    | +25 (binary-ish boost/penalty) |
| Cluster / sybil detected        | +10 / +15 / +25 at > 0 / > 15% / > 30% combined share |
| Token age < 1 day               | +20 floor (plus a minimum-score clamp of 55) |
| Sniper share > 30% (young only) | +20 |
| Sell tax > 10%                  | +15 |
| Dev wallet > 10%                | +15 |
| Low holder count < 50           | +15 |
| Top single holder > 10%         | +10 |

The `top10EffectiveShare` is key: it is the top-10 sum **after** excluding
non-circulating categories (burn / staking / exchange / bridge / locker /
launchpad) via the `knownContracts` registry
(`src/features/nylaTools/knownContracts.ts`). This is why blue-chips like
CAKE and BUSD are not falsely flagged.

**Token-age multiplier** is implemented as an additive bucket (not a
multiplier) plus a minimum-score floor: a non-bonding-curve token younger
than 2 days is clamped to `score >= 55` regardless of other signals
(line 152). Bonding-curve tokens (Four.meme) use a gentler curve with a 30
clamp (line 149) — young-by-design is expected there.

Normalisation is the final `Math.max(0, Math.min(100, score))`. The sum of
all maximum weights exceeds 100, which is intentional: a token hitting
multiple severe factors saturates at 100 rather than being linearly rescaled,
matching how judges and traders intuitively read the score.

## Progressive disclosure tiers

Gating lives at `src/pages/api/nyla-tools/wallet-age.ts`, with the threshold
function in `src/features/nylaTools/schema.ts:18` (`tierFromAgeDays`):

| Age on BSC | Tier      | What the UI shows |
|------------|-----------|-------------------|
| < 90 days  | `scout`   | Headline, Verdict, Findings, Chart (no overlays), Ledger, Alerts, AskNiya |
| 90–365 d   | `analyst` | Scout features + `NiyaSeesCard` narration + Analyst chart overlays (when pair liquidity ≥ $50k and pair age ≥ 48h) |
| > 365 d    | `pro`     | Everything above + future premium widgets |

The gating exists to protect new wallets from themselves: the Analyst overlays
show things like liquidity-cliff detection and micro-structure narration that
only make sense once a user has internalised what the basic cards mean.
Showing a brand-new wallet a chart with "Niya sees a liquidity cliff forming"
would be noise. The tier is resolved client-side in `App.tsx` (line 205) and
also enforced server-side on premium endpoints.

## Ask Niya flow

`POST /api/nyla-tools/ask` (`src/pages/api/nyla-tools/ask.ts`) is the free-text
Q&A endpoint. Rate-limited to 20 q/min/IP. The handler composes a single user
prompt by JSON-stringifying `{ question, ca, tokenData: context }` where
`context` is the `MicrostructureResult` returned earlier. The request goes
through `resolveLLMConfig` → `chatCompletion` (`src/features/llm/dgrid.ts`),
with DGrid as the primary provider and xAI as a legacy fallback. Answers
cache for 10 minutes keyed on `model + ca + question.toLowerCase()`. The
system prompt (ask.ts:48) **forbids** the vocabulary `buy / sell / support /
resistance / fibonacci / entry / target / stop` — the product position is
"analysis companion", not signal service. The model is instructed to substitute
"floor" / "ceiling" for support/resistance and refuse financial advice.

## Shared by web + extension

The same `POST /api/nyla-tools/microstructure` serves both the web `/tools`
page and the Chrome extension side panel. `src/components/niyaTools/sidepanel/App.tsx`
is re-used by the extension bundle, which only differs in how the CA is
detected (content-script DOM scraping on DexScreener / Four.meme vs URL
query param on the web page). CORS handling
(`src/features/liveShow/cors.ts`) explicitly whitelists the extension origin.
For deeper extension internals — MV3 messaging, host-site detectors, content
script injection — see `extension/CLAUDE.md`.

## Future work / Phase 2 backlog

The post-hackathon audit (`audit_plan.md`) tracks the known cleanup:
in-memory `Map` caches in `ask.ts` and `narrate.ts` will migrate to Redis so
horizontal scaling does not fragment cache hits; the rate-limit call sites
will switch from `enforceRateLimit` to the atomic
`checkAndConsumeRateLimit` (eliminates a TOCTOU gap on burst traffic); and
the extension's `dexscreener.ts` will be merged with the web's copy into a
single shared client under `src/features/nylaTools/` so the two surfaces stop
drifting. GMGN will migrate from the `gmgn-cli` subprocess to a FlareSolverr
proxy once the hackathon freeze lifts.
