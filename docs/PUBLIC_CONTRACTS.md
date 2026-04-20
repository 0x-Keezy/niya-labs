# Public on-chain contracts used by Niya Labs

A handful of BSC contract addresses are hardcoded in the trading + analyzer
code. They are **not secrets** (every address on-chain is public by
definition), but they tie this codebase to Niya Labs' specific deployment.
If you fork the repo and run your own instance, you will want to replace
some of them.

---

## Contracts hardcoded in this repo

| Address | Role | Files |
|---|---|---|
| `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c` | **WBNB** (Wrapped BNB, official token) | `src/features/autonomy/transactionValidator.ts` · `src/features/market/bnbMarketDataProvider.ts` · `src/features/trading/bnbTradingService.ts` |
| `0x5c952063c7fc8610FFDB798152D69F0B9550762b` | Four.meme **TokenManager2** contract (official) | `src/features/trading/fourMemeTokenLauncher.ts` · `src/pages/api/admin/four-meme-launch.ts` |
| `0x09B44A87cd01e0F2d4A4B6b8d7E4C2E6b4A9c7c8` | Niya Labs **AgentIdentifier** (EIP-8004 registry entry) | `src/features/trading/fourMemeTokenLauncher.ts` |
| `0x8004A1b9F0...` | EIP-8004 Registry (protocol) | `src/features/trading/fourMemeTokenLauncher.ts` |

Plus the curated "known contracts" registry in `src/features/nylaTools/knownContracts.ts`
(Binance hot/cold wallets, CEX custody, PancakeSwap staking contracts, LP lockers,
burn addresses). Those are only used for **classifying** holders in the rug-risk
report — not for signing or routing transactions — so they are safe to keep as-is
even if you fork.

---

## What to change when you fork

1. **WBNB**: keep as-is. It is the canonical wrapped BNB; every BSC app uses the same address.
2. **Four.meme TokenManager2**: keep as-is unless Four.meme migrates to a new version.
3. **AgentIdentifier**: replace with your own agent's EIP-8004 registration. Ours identifies "Niya Labs" specifically — if you launch under a different brand, register your own.
4. **EIP-8004 Registry**: keep as-is. It is the protocol-level contract.
5. **`knownContracts.ts`**: extend freely with your own curated additions. The existing entries are sourced from public explorers and community attribution.

---

## Why these aren't environment variables

We considered promoting these addresses to `.env` variables, but the cost-benefit
for a v0.1 open-source release does not pencil out:

- The addresses are already public knowledge
- They barely change (Four.meme has migrated once in 18 months)
- Env-var-izing them adds friction to contributors (one more thing to set up to run locally)

If at some point these addresses change frequently or we need multi-network support,
we will revisit. Tracked under the v0.2 roadmap in `CHANGELOG.md`.

---

## Reporting a bad address

If you believe one of the hardcoded addresses is wrong, out of date, or points
to a contract that has been deprecated or exploited, please open an issue with
the label `contracts` — we treat this as high priority because a wrong address
in the classifier silently degrades the rug-risk verdict.
