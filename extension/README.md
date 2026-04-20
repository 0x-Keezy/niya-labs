# Nyla Tools

The intelligent companion for memecoin traders on BNB Chain — a section of [Nyla Labs](https://niyaagent.com).

Nyla Tools is a Chrome extension (Manifest V3) that opens a side panel beside DexScreener, PancakeSwap and Four.meme, and provides progressive, tier-gated analysis of the token the user is currently looking at.

- **Scout Mode** (default, wallets <90 days): on-chain microstructure — holder concentration, LP lock, sniper detection, dev wallet history, plain-language rug risk.
- **Analyst Mode** (wallets 90–365 days): classical technical analysis on tokens that pass a minimum liquidity + age gate.
- **Pro Mode** (wallets >365 days): custom alerts, strategy templates, read-only API.

All individual tiers are free during the experimental phase.

## Dev setup

```bash
cd extension
npm install
npm run dev      # Vite dev server + HMR for side panel and popup
npm run build    # Production build → extension/dist/
```

## Sideload in Chrome

1. Run `npm run build` in this directory.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right).
4. Click **Load unpacked** and select `extension/dist/`.
5. Pin **Nyla Tools** in the toolbar.
6. Navigate to a token on DexScreener, PancakeSwap, or Four.meme and click the Nyla icon. The side panel opens and reads the contract address from the URL.

## What's in scope for the Four.meme AI Sprint hackathon (Apr 22 deadline)

See `Nyla_Labs_PRD_v1.1.docx` at the repo root for the full product spec and 12-day build plan.

## Out of scope

- No buy/sell signals or trade execution
- No custody, no signing, no wallet authority
- No Telegram / Twitter auto-posting
- Solana and other non-BNB chains
