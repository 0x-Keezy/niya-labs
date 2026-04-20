# Nyla Tools Extension — Architecture

This document complements `extension/README.md` (which covers setup and sideloading) by explaining the internals: how the three Chrome MV3 contexts cooperate, how a contract address flows from the browser tab to the side panel, and the build pipeline quirks you should know before editing code.

## What this is

Nyla Tools is a Chrome Manifest V3 extension that attaches a side panel to token pages on `dexscreener.com`, `pancakeswap.finance`, and `four.meme`. When a BSC token is detected on the active tab, the panel renders microstructure, security, and (for higher tiers) chart-based analysis. The extension lives as an isolated package at `extension/` inside the Niya monorepo with its own `package.json` and `node_modules` — the parent Next.js app at `../src/` only exposes backend endpoints under `../src/pages/api/nyla-tools/*`.

## The three runtime contexts

MV3 splits code into three isolated JS contexts that communicate exclusively via `chrome.runtime.sendMessage`. Shared message types live in `extension/src/lib/types.ts` (see `BgMessage`, `DetectedAddress`).

- **Service worker — `extension/src/background.ts`.** The broker. Holds an in-memory `Map<tabId, DetectedAddress>` cache, receives `ca-detected` messages from content scripts, configures `chrome.sidePanel.setPanelBehavior`, and answers `get-current-ca` requests from the panel. Chrome can evict this worker at any moment; treat all state here as ephemeral.
- **Content script — `extension/src/content-script.ts`.** Injected into supported hosts. Detects contract addresses with per-site regex logic (DexScreener path segments, PancakeSwap query strings, Four.meme path). To survive SPA client-side navigation it patches `history.pushState`/`replaceState`, listens for `popstate`, and keeps a 2-second `setInterval` safety net.
- **Side panel — `extension/src/sidepanel/`.** React 18 app rendered in Chrome's native side panel. On mount it asks the service worker for the current CA, then subscribes to push updates. All UI, fetching, and charting happens here.

## Data flow

```
[content-script.ts]  --ca-detected-->  [background.ts]  --push-->  [sidepanel/App.tsx]
                                                                        |
                                                                        v
                                             fetch /api/nyla-tools/microstructure
                                                                        |
                                                                        v
                                               Zustand store: setCurrentCa(ca)
```

Once the panel has a CA it calls DexScreener (pair metadata), GeckoTerminal (OHLCV candles — DexScreener has no public bars endpoint), and the Niya backend's `/api/nyla-tools/microstructure` endpoint (Moralis + GoPlus aggregation). Results render into `sidepanel/chart/Chart.tsx` using `lightweight-charts`.

## State management

The Zustand store at `extension/src/sidepanel/store.ts` is intentionally narrow — it holds only `currentCa` and `tier`. Every ephemeral fetch state (pair, candles, loading, error, timeframe) lives in `useState` inside `App.tsx`. Please keep new cross-cutting selections (not request state) in Zustand.

## Build pipeline

- Builder: Vite plus `@crxjs/vite-plugin`. The plugin treats `manifest.json` as the source of truth and rewrites asset paths into `dist/`. Do not reference hashed filenames from code — go through manifest-resolved paths.
- `vite.config.ts` imports the manifest with `with { type: 'json' }` (Node 22 deprecated the older `assert` form).
- The service worker is emitted as `dist/service-worker-loader.js` — a one-line `import` of the hashed background chunk. This is the `@crxjs` pattern; don't try to bundle the worker directly.
- HMR quirk: `@crxjs` HMRs the side panel and content script, but **MV3 service workers cannot HMR** — after editing `background.ts` you must reload the extension from `chrome://extensions`.
- `npm run build` runs `tsc --noEmit && vite build`. There is no test runner; `tsc` is the only correctness gate beyond manual sideload testing.

## Gotchas

- **CSP.** MV3 forbids inline scripts and remote code; only bundled assets are allowed in the side panel context.
- **Cross-origin fetch.** Any new external API must be added to `manifest.json::host_permissions` or `fetch` is blocked.
- **Session cookies do not flow.** Cookies set by the Niya web app do not automatically accompany side-panel requests to `/api/nyla-tools/*`; if an endpoint needs auth, pass it explicitly.
- **Fetch races.** Effects in `App.tsx` tie an `AbortController` to the `useEffect` cleanup. Follow this pattern for any new async effect keyed off `currentCa` — fast CA switches otherwise clobber later responses with earlier ones.

## How to develop

See `extension/README.md` for first-time setup and sideloading steps. During active development use `npm run dev`, which runs the Vite watcher on port 5174 and rebuilds into `dist/` on save. The side panel and content script pick up changes via HMR; after editing `background.ts` reload the extension card in `chrome://extensions`. Service worker and side panel each have their own DevTools — inspect the worker from the extensions page, and the panel by right-clicking inside it.
