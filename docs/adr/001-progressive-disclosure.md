# ADR 001: Progressive Disclosure by Wallet Age

## Status

Accepted — shipped in Niya Tools v1.

## Context

Most on-chain analyzers for memecoin traders lead with charts: support and resistance lines, fibonacci retracements, candle patterns, volume bars. On liquid majors that is fine. On newly-launched BSC tokens aimed at retail, it is a trap. A user whose wallet is a few weeks old rarely has the microstructure literacy to tell a real breakout from a rug-in-progress, and putting a chart in front of them biases the decision towards "I see a number, I must trade." We needed a way to surface the *right* signal for the *right* user, without building two separate products.

Wallet age is a cheap, on-chain, tamper-resistant proxy for trading experience. It is not perfect — a seasoned trader can always create a fresh wallet — but it correlates well enough with "probably seen a rug before" to be a useful gate.

## Decision

Gate features behind three tiers computed from the wallet's first on-chain BSC transaction:

- **Scout (<90 days).** Only the microstructure panel: holder concentration, LP lock status, sniper share, a plain-language rug-risk headline. No charts, no indicators.
- **Analyst (90–365 days).** Adds price charts with timeframe switching and a minimum-liquidity / minimum-age gate before TA features unlock.
- **Pro (>365 days).** Full overlays, custom alerts, strategy templates, read-only API.

Wallet age is resolved by `src/pages/api/nyla-tools/wallet-age.ts`, which calls Moralis for the wallet's first BSC transaction timestamp and caches the result in Postgres for seven days. Tier classification lives in `src/features/nylaTools/schema.ts::tierFromAgeDays`. The extension's Zustand store (`extension/src/sidepanel/store.ts`) holds the current tier and tier-gates rendering at the component level.

## Consequences

**Better.** The default experience for new wallets is "read, understand the distribution, then decide" rather than "look at a squiggly line and trade." Experienced users still reach the full toolkit; they just have to be on a wallet old enough to have earned it.

**Worse.** A seasoned trader on a fresh wallet sees the Scout UI and has to switch wallets or wait. We considered an explicit opt-out but rejected it on the grounds that opt-outs quickly become the default — defeating the intent of the tier system.

**Uncertain.** We do not yet have data on how often users hit the Scout-to-Analyst wall and abandon vs. how often they adopt the microstructure framing. Follow-up work: per-tier dashboard customization, and telemetry to measure tier-transition behavior so we can tune the thresholds.
