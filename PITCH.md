# Niya Labs — Pitch Deck Outline

*Four.meme AI Sprint submission. ~2-3 min pitch with video.*

> **How to use**: copy each slide into Keynote / Google Slides / Figma. Each block is sized for a single slide — no slide should be longer than 4 seconds when read aloud.

---

## Slide 1 — Title

**NIYA LABS**

*One AI VTuber. One token analyzer. Both on BNB Chain.*

Four.meme AI Sprint · April 2026

**Visual**: the Niya logo gradient (purple → pink → gold) on cream background. One avatar illustration of Niya, one screenshot of the analyzer. Subtle.

**Voice-over**: *"Niya Labs builds two things: a VTuber who streams and trades, and a tool that tells you if the next token you see will rug. Same brand. Same soul. One is fun. The other saves money."*

---

## Slide 2 — The problem

**BNB Chain memecoins ship 10,000+ tokens a week.**

80% rug. 90% of traders don't check holder concentration, LP lock, or sniper wallets before buying. Existing analyzers are Ethereum-first, UI-dense, and assume PhD-level vocabulary ("support resistance Fibonacci").

**Memecoin traders need two things**: *speed* (10 seconds or they scroll) and *sentences they can read* (they don't read charts).

**Visual**: three screenshots of bad rugs with price charts falling off a cliff. Red dominant.

---

## Slide 3 — The insight (Niya Tools)

Show the verdict *before* the chart.

Every existing tool buries the security signals under a chart. We flip it: holder concentration, LP lock, sniper wallets, honeypot flags come first, as cards, with a single **rug-risk score 0-100** and a readable headline.

A chart appears only when the token is Analyst-grade (liq ≥ $50k, age ≥ 48h) and the trader's wallet is old enough to deserve it. *Progressive disclosure*.

**Visual**: split comparison — Dexscreener view (chart huge, text tiny) vs Niya Tools view (verdict card front and center, chart relegated).

---

## Slide 4 — Demo (60 seconds of video)

Live recording:

1. Land on `niyaagent.com/`, click "Analyze".
2. Paste a fresh Four.meme token.
3. Watch the cards fill in for ~8 seconds.
4. Point to: rug score 72, "LP not locked", "3 whales control 45%".
5. Ask Niya: *"Why is this risky?"* → short paragraph.
6. Show the Chrome extension on the same site — auto-detects the CA, same verdict in the side panel.

**This is the whole product. 60 seconds.**

---

## Slide 5 — The insight (Niya Companion)

Most AI tokens have a logo. Niya has a *character*.

Candy hamster with golden hair, fluffy ears, pastel yellow dress, obsessed with BNB Chain, says "nya" unironically. Lives in a Three.js viewport. Brain: DGrid AI Gateway (GPT-4o mini default, 200+ models available). Voice: ElevenLabs Yuki. Body: VRM with 14 emotional blend shapes + lip sync.

She streams (RTMP to PumpFun/Twitch), trades via Jupiter, posts tweets (drafts, admin-approved), reacts to chat in real time.

**Visual**: 3-second loop of Niya on a livestream — eyes tracking mouse, reacting with a smile when someone donates, subtitle overlay with her TTS.

---

## Slide 6 — Why two products

**One brand, two surfaces.**

The VTuber is the face → community, distribution, memes. The analyzer is the substance → utility, retention, trust. They cross-pollinate:

- Niya Tools users discover the VTuber through the brand.
- VTuber viewers become analyzer users when they join a trade.
- Both live at `niyaagent.com` · same palette · same voice · same character.

**Visual**: Venn diagram. Left circle: "VTubers" (Neuro-sama, AI companions). Right circle: "Memecoin tooling" (DexScreener, GMGN). Center: "Niya Labs — the only thing in both."

---

## Slide 7 — Technical depth

Behind the rug-risk score:

- **Three data sources**: Moralis (holders), GoPlus (security), GMGN (wallet intelligence) — merged in one `Promise.all` with graceful fallbacks.
- **Unified LLM access via DGrid AI Gateway**: every narration and "Ask Niya" call routes through [DGrid](https://dgrid.ai) — one OpenAI-compatible API key, 200+ models. The Ask Niya panel ships a live model-picker (GPT-4o mini · Grok 3 mini · Claude 3.5 Haiku · Gemini 2.0 Flash · Qwen 2.5 72B · DeepSeek). Server-side allow-list in `src/features/llm/dgrid.ts` prevents spoofed model IDs. Legacy xAI kept as automatic fallback.
- **Sybil detection** (2-hop funder graph): track where each top-10 holder got funded from, spot coordinated clusters.
- **Known-contract registry**: 25+ hand-curated BSC addresses (burn, LP lockers, exchange custody) removed from "effective" concentration.
- **Atomic DB-backed rate limiting** (`SELECT FOR UPDATE`) to protect monetary endpoints (TTS, LLM) under concurrency.
- **Ed25519 request signing** for GMGN via `gmgn-cli` subprocess; `gmgn-cli` handles the 1 call/5s upstream rate limit internally.

All of this lives in one `next dev` server. No microservices theater. No LLM prompt-spaghetti. Read the repo.

**Visual**: architecture diagram from the README.

---

## Slide 8 — Hackathon alignment

*Judged 70% expert review, 30% community vote.*

| Criterion | Weight | Niya Labs |
|---|---|---|
| **Innovation** | 30% | Progressive disclosure, microstructure-first. No direct competitor has this. Two products under one brand. |
| **Technical implementation** | 30% | Modern Chrome APIs (`sidePanel`), Next.js 14 App/Pages hybrid, Ed25519 + subprocess sandboxing, DB-backed atomic rate limits, no-reinvent-the-wheel. |
| **Practical value** | 20% | Addresses a well-defined trader problem. Works on Four.meme, PancakeSwap, DexScreener, GMGN. |
| **Presentation** | 20% | Consistent brand (purple/pink/cream). Character with voice. Readable narration. |

**Built in 12 days. Apr 10 → Apr 22. Two products, one team.**

---

## Slide 9 — What we'd build next

**M1-M3** (Chrome Web Store release, Firefox port, mobile companion, ETH L2 expansion) → 1,000 installs.

**M3-M6** (Team/Enterprise tier paid, memecoin pattern classifier ML, wallet tracking, BNB protocol partnerships) → 10,000 installs, 15 paying teams.

**M6-M12** (public API, trading bot co-pilot, SocialFi integration, potential $NIYA token) → 50,000 installs, break-even.

*Individual tiers stay free forever during the experimental phase.*

---

## Slide 10 — Ask / close

**Try it now.** `niyaagent.com`

**Follow.** [@NiyaAgent](https://x.com/NiyaAgent)

**Contribute.** [github.com/0x-Keezy/niya-labs](https://github.com/0x-Keezy/niya-labs)

**Thank you.**

*One sentence closing line*: *"We didn't build a token. We built the thing that stops you from buying the wrong one."*

---

## Appendix — facts you might be asked

- **Why BNB Chain?** Four.meme is one of the highest-volume memecoin venues, trader audience aligns with the hackathon. The architecture ports to Base / Solana / any EVM by swapping the chain parameter in Moralis calls.
- **Why DGrid?** Every `/api/nyla-tools/*` call goes through DGrid AI Gateway — one OpenAI-compatible key grants access to 200+ models (OpenAI, Anthropic, xAI, Google, Qwen, DeepSeek). Our default is `openai/gpt-4o-mini` (~$0.002/analysis, low latency), but judges can swap to Grok 3 mini, Claude 3.5 Haiku, Gemini 2.0 Flash or Qwen 72B live via the Ask Niya dropdown. Satisfies the Four.meme × DGrid bounty and eliminates per-provider integration code.
- **Isn't this just a wrapper?** No. Wrapper = one API, one UI. Niya Tools merges three incompatible APIs (Moralis Web3Api, GoPlus token_security, GMGN Ed25519-signed OpenAPI) with sybil clustering on top.
- **What about shills / rugs using your tool to look clean?** Dev wallet detection (token age + creator holding), bundler trader percentage, anti-whale flag detection — if someone manipulates the top-10 it shows up in the GMGN wallet-tag summary.
- **Is the extension installable?** Sideload-ready today (`extension/dist/`). Chrome Web Store submission post-hackathon.
