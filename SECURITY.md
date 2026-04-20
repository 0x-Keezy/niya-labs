# Security Policy

Niya Labs is a read-only on-chain analyzer plus an AI VTuber companion. We never sign transactions on behalf of users, never hold private keys in the browser, and never ask for wallet approval.

## Autonomous trading kill switch

Niya ships with an ElizaOS agent bridge (`src/features/autonomy/elizaOSBridge.ts`) that can, in theory, emit `execute_swap` socket events when market triggers fire. Because those events translate to real on-chain transactions, we treat them as privileged and guard them behind an environment-controlled kill switch.

`AUTONOMY_TRADING_KILL_SWITCH=on` is the **default** value shipped in `.env.example` and enforced in `src/env.d.ts`. While it is on, every agent-initiated swap is blocked server-side, regardless of whether the ElizaOS socket is connected or what the agent decides. Only an explicit `AUTONOMY_TRADING_KILL_SWITCH=off` in the deployment environment re-enables auto-trading.

Defense in depth: the guard is applied at two call sites inside the bridge — `executeAction` `case 'execute_swap'` (around line 882) and `requestSwap()` (around line 1036) — so bypassing one still hits the other. The Solana slippage is additionally capped server-side at `MAX_SOL_SLIPPAGE_BPS = 500` (5%), mirroring the 10 BNB cap on the BNB side.

> If you turn the kill switch off, you accept that the agent can sign and broadcast Solana transactions without admin approval. We recommend keeping it on outside of isolated test environments.

## Tweet content injection defense

The admin trading endpoints in `src/pages/api/admin-trading.ts` relay commands to ElizaOS as plain-text templates, e.g. `[ADMIN_COMMAND] TWEET: ${content}` or `[ADMIN_COMMAND] BUY ${amountSol} SOL of token ${tokenAddress}`. Any user-supplied field that gets interpolated into one of those templates is therefore a potential command-injection surface — a compromised admin cookie or a UI bug could let a tweet body smuggle a fake trade directive.

All such fields (`content`, `style`, `tokenAddress`, `command`) are now run through a shared validator that rejects the literal `[ADMIN_COMMAND]` / `[ADMIN_TRADE]` / `[ADMIN_TWEET]` / `[ADMIN_BUY]` / `[ADMIN_SELL]` (case-insensitive, anywhere in the body) with HTTP 400 and `{ error: "Rejected content: injection pattern detected" }`. Content is also trimmed and capped at 4000 characters. Numeric fields (`amountSol`, `amountPercent`) are type-checked to be finite numbers in a sane range before they hit the template.

Future work (Phase 2): migrate the ElizaOS protocol from text templates to structured JSON messages so that the injection class is eliminated by construction rather than by blocklist.

## Reporting a vulnerability

**Do not open a public issue** for security reports.

1. Open a private **GitHub Security Advisory**: https://github.com/0x-Keezy/niya-labs/security/advisories/new
2. Or reach out via DM on X: https://x.com/NiyaAgent

What to include:
- A description of the vulnerability
- The file + line (or URL) where it lives
- Proof-of-concept or reproduction steps (if safe to share)
- Impact: what can an attacker do?

We will acknowledge within 48 hours and agree on a disclosure timeline.

## What constitutes a vulnerability

| Severity | Examples |
|---|---|
| **Critical** | Hardcoded production secret in code; remote code execution; auth bypass on `/api/admin/*` |
| **High** | Unauthenticated access to admin endpoints; SSRF; CORS misconfiguration that exposes user data |
| **Medium** | Information disclosure via error messages; rate-limit bypass on monetary endpoints (TTS, LLM) |
| **Low** | Dependency with known vuln but no exploitation path; XSS in an output with no auth context |

## What is NOT in scope

- Attacks requiring a compromised user wallet, browser, or local machine
- Social engineering of the Niya Labs team
- Denial-of-service attacks on the public demo (`niyaagent.com`)
- Issues in the Chrome extension's third-party dependencies (Three.js, pixi-live2d-display, lightweight-charts) — report upstream
- Third-party API abuse (Moralis, GoPlus, GMGN, xAI) — report to the providers

## Handling of secrets

### For contributors

- **Never commit `.env*` files.** They are blocked by `.gitignore` and masked by `.gitattributes`.
- Use `process.env.VAR_NAME` server-side only. Prefer `XAI_API_KEY` (server) over `NEXT_PUBLIC_XAI_API_KEY` (client bundle).
- If you accidentally commit a secret: **assume it is compromised**, rotate it immediately, then scrub history.

### For maintainers

- Rotate API keys immediately if a leak is confirmed.
- Enable **GitHub Push Protection** under Settings → Security & analysis.
- Enable **Secret scanning** + **Dependabot alerts**.
- Keep `main` protected — require PRs + status checks before merging.

## API key rotation dashboards

| Provider | Rotate at |
|---|---|
| xAI / Grok | https://console.x.ai/api-keys |
| OpenAI | https://platform.openai.com/account/api-keys |
| ElevenLabs | https://elevenlabs.io/app/settings/api-keys |
| Twitter / X | https://developer.twitter.com/en/portal/dashboard |
| Moralis | https://admin.moralis.io/account/credentials |
| GoPlus | https://gopluslabs.io/user-center |
| GMGN | https://gmgn.ai (account settings) |
| Helius | https://dashboard.helius.dev |
| Supabase | https://supabase.com/dashboard (project → settings → API) |

After rotating, update `.env.local` (dev) and your hosting platform's env vars (production). Restart the app.

## Disclosure philosophy

We believe in coordinated disclosure: report privately, we fix, we publish an advisory together with credit. We will not sue, threaten, or otherwise interfere with researchers who follow this policy in good faith.

---

Last updated: 2026-04-20
