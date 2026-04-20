# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`extension/` is **Nyla Tools**, a Chrome MV3 extension built as part of Nyla Labs. It is an **isolated package** inside the larger Nyla monorepo (repo root `..`). The parent directory contains a Next.js 14 VTuber web app (`../src/`), which is dormant for the Four.meme AI Sprint hackathon — all extension work happens here, in `extension/`, with its own `node_modules`, `package.json`, and `tsconfig.json`. **Do not touch the parent `../src/` unless you are specifically building a backend endpoint under `../src/pages/api/nyla-tools/*`**.

## Commands

All commands run from `extension/`:

```bash
npm install          # Install isolated deps (does not touch parent node_modules)
npm run dev          # Vite dev server + @crxjs HMR on port 5174
npm run build        # tsc --noEmit && vite build → extension/dist/
npm run preview      # Vite preview
```

There is **no test runner** in this package. `tsc --noEmit` inside `npm run build` is the only correctness gate; rely on it and manual sideload testing.

### Sideload loop while developing

1. `npm run build`
2. `chrome://extensions` → reload the "Nyla Tools" card (or Load unpacked `extension/dist/` the first time)
3. Navigate to a token on `dexscreener.com/bsc/...`, `pancakeswap.finance/...`, or `four.meme/...`
4. Click the Nyla icon or open the side panel

Service worker and side panel have separate DevTools — inspect the service worker from the extensions page, and the side panel by right-clicking inside it.

## Architecture

### Three runtime contexts

Chrome extensions run code in three isolated JS contexts that communicate via `chrome.runtime.sendMessage`. Understanding which context a file runs in is essential:

- **`src/background.ts`** — MV3 service worker. Holds per-tab CA cache (`Map<tabId, DetectedAddress>`), brokers messages, configures `sidePanel.setPanelBehavior`. Can be killed by Chrome at any time; all state is ephemeral. Reads via `chrome.tabs` and `chrome.runtime` only — no DOM.
- **`src/content-script.ts`** — injected into DexScreener / PancakeSwap / Four.meme pages. Detects contract addresses by regex on `location.href` with per-site logic (DexScreener path vs Pancake query string vs Four.meme path). Patches `history.pushState`/`replaceState` + listens for `popstate` + 2s `setInterval` safety net to handle SPA client-side navigation. Sends `{type: 'ca-detected'}` messages to the background.
- **`src/sidepanel/`** — React 18 app rendered inside Chrome's native side panel. On mount, asks the background for the current CA via `get-current-ca`, then subscribes to push updates. This is where all UI, charting, and data fetching live.

All three contexts share types through `src/lib/types.ts`, specifically `BgMessage` (discriminated union of the three message shapes) and `DetectedAddress`.

### Data flow (current state, through Day 2.5)

1. User navigates to a BSC token page on a supported host.
2. Content script detects CA, sends to background.
3. Background caches it per-tab and notifies any open side panel.
4. Side panel (`App.tsx`) reacts to the CA change:
   - `lib/dexscreener.ts::fetchTokenPairs(ca)` — pair metadata (price, liquidity, volume, 24h change) from the DexScreener public API. Throws `TokenNotListedError` when the response has zero pairs.
   - `lib/dexscreener.ts::pickBestBscPair(pairs)` — filters `chainId === 'bsc'` and picks the pair with the highest liquidity.
   - `lib/geckoterminal.ts::fetchOhlcv(pairAddress, timeframe)` — OHLCV candles from GeckoTerminal (`/networks/bsc/pools/{pair}/ohlcv/{base}?aggregate={n}`). DexScreener does **not** expose public OHLCV bars, which is why GeckoTerminal is used for candles. The `TF_MAP` in that file converts our `5m/15m/1h/4h/1d` labels to GeckoTerminal's `(base, aggregate)` tuples.
5. `sidepanel/chart/Chart.tsx` renders the candles + a volume histogram overlay using `lightweight-charts`. A single shared `IChartApi` instance is created once in a ref; series data is pushed imperatively on `candles` change. The crosshair tooltip is updated via `subscribeCrosshairMove` directly mutating a DOM node (ref) — **do not** convert this to React state, it would re-render on every mouse move.

### Data sources & API surfaces

- **DexScreener** (`api.dexscreener.com`) — free, no key. Used for pair metadata only.
- **GeckoTerminal** (`api.geckoterminal.com`) — free, 30 req/min. Used for OHLCV. Attribution required (footer text "Data via GeckoTerminal").
- **Moralis** — wired. Primary source for holder balances, token metadata, and transfers (Day 3+). Key in `../.env.local` as `MORALIS_API_KEY` / `MORALIS_API_KEY_2`. Called only from `../src/pages/api/nyla-tools/*` to avoid leaking keys into the extension bundle.
- **GoPlus** — wired. Primary source for security signals (honeypot, buy/sell tax, ownership, LP lock). No API key required.
- **GMGN** — wired via the official `gmgn-cli` npm package. The backend shells out with `execFile` to `node node_modules/gmgn-cli/dist/index.js` (see `../src/features/nylaTools/gmgn.ts`), which handles Ed25519 request signing and the 1 call / 5 s upstream rate limit. Credentials live in `~/.config/gmgn/.env` (`GMGN_API_KEY` + `GMGN_PRIVATE_KEY`) — never in this repo. Enriches holders with behavioural tags (whale, cex, smart_money, renowned).
- **BscScan** — used by wallet-age endpoint only (`../src/pages/api/nyla-tools/wallet-age.ts`). Key: `BSCSCAN_API_KEY`.

Any new external API must be added to `manifest.json::host_permissions` or `fetch` will be blocked by MV3.

### State management

`src/sidepanel/store.ts` is a tiny Zustand store holding `currentCa` and `tier`. Everything else (pair, candles, loading, error, timeframe) is plain `useState` inside `App.tsx` — this is intentional. Do not move ephemeral fetch state into Zustand; keep the store narrow to cross-cutting selections (the detected CA, and later the user's tier from wallet-age lookup).

### Build pipeline gotchas

- The builder is **Vite + `@crxjs/vite-plugin`**, which treats `manifest.json` as the source and rewrites asset paths into `dist/`. Do not reference hashed filenames from code — always reference manifest-resolved paths.
- `vite.config.ts` imports the manifest with `with { type: 'json' }` (not `assert`) because Node 22 deprecated the assert form. Do not revert.
- The service worker is emitted as `dist/service-worker-loader.js` (a one-line `import` of the hashed `background.ts` chunk) — this is the @crxjs pattern; do not try to bundle the worker directly.
- MV3 manifest fields are strict: `author` must be `{email: string}` or omitted entirely (it is currently omitted). Adding `"author": "string"` will fail TypeScript.

## Conventions specific to this codebase

- **Tailwind palette** lives in `tailwind.config.js` with a custom `nyla-*` namespace: `pink`, `cream`, `ink`, `panel`, `muted`, `ok`, `warn`, `danger`. Use these tokens rather than raw hex, and use the same hex values (`NYLA_THEME`) inside `Chart.tsx` for lightweight-charts styling.
- **Price formatting** for memecoins uses `lib/format.ts::compactPrice`, which emits DexScreener-style subscript-zero notation (`$0.0₅1234`). Any UI showing token prices must use this helper, not `toFixed`, to stay consistent between the PairHeader and the chart tooltip.
- **Abort race conditions** — fetch effects in `App.tsx` use `AbortController` tied to the `useEffect` cleanup. Always follow this pattern when adding new async fetches keyed off `currentCa` or `pair`, otherwise fast CA switches will clobber later responses with earlier ones.
- **Auto-refresh** uses `setInterval(30_000)` gated on `document.visibilityState !== 'hidden'` to respect GeckoTerminal's free tier. Preserve this gate if adding more polling.

## Out of scope (do not add)

The PRD is explicit and the build plan enforces this:

- No buy/sell signals, no transaction signing, no wallet custody — **read-only analysis only**.
- No Solana, no Ethereum mainnet, no non-BSC chains.
- No Chrome Web Store publishing before the hackathon submission (sideload only).
- No Twitter/Telegram auto-posting (there is legacy code for this in the parent `../src/features/externalAPI/` — leave it dormant).
- No indicators/drawing tools in Scout Mode. Technical analysis is gated to Analyst Mode (Day 6) behind liquidity ≥ $50k AND age ≥ 48h.

## Parent monorepo notes

- Parent is the repo root (`..`) — a Next.js 14 VTuber app with Drizzle + Postgres, ElevenLabs TTS, VRM/Live2D viewers, etc. **Do not modify it** unless the task is specifically "add a `src/pages/api/nyla-tools/*` backend endpoint".
- If you add a backend endpoint for the extension, reuse `../src/features/liveShow/db.ts::getDb()` for the Drizzle client; create new tables under a new `../src/features/nylaTools/schema.ts` rather than extending `liveShow/schema.ts`.
- The parent already has `ethers`, `viem`, `@tanstack/react-query`, `drizzle-orm`, `zod`, and xAI Grok-3-mini wiring in place — reuse them on the backend side rather than installing duplicates.
