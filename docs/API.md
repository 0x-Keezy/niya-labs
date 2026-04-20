# Niya Labs HTTP API Reference

## Overview

Niya Labs exposes its server-side surface as Next.js API routes under `src/pages/api/**`. The base URL is the Next.js server itself — every endpoint below is relative to `/api`. All request and response bodies are JSON unless noted (a few routes take binary via `application/octet-stream` or `multipart/form-data`, and SSE endpoints stream `text/event-stream`). CORS for the browser extension and side panel is handled by `src/features/liveShow/cors.ts::handleCors`.

Four auth modes are in use:

- `public` — no auth at all. Typically GET-only reads (config, market prices).
- `rate-limited-public` — no auth but gated by `enforceRateLimit` (`src/features/auth/rateLimit.ts`). Used by Nyla Tools LLM endpoints.
- `admin-password` — client sends `{ password }` in the body. Validated with `timingSafeEqualStr` against `ADMIN_PASSWORD`. Legacy.
- `admin-session` — client sends `x-admin-auth` or `x-admin-secret` header containing `ADMIN_SECRET`. Phase-1 target for every admin route.

Standard error shape is `{ error: string }` (some admin routes wrap with `{ success: false, error }`). Rate-limited endpoints respond `429` with a `Retry-After` header. `503` indicates the backing service (DB, Moralis, ElevenLabs, ElizaOS) is not configured or reachable.

## Authentication modes by endpoint group

| Group | Default auth | Exceptions |
|---|---|---|
| `nyla-tools/*` | rate-limited-public | — |
| `admin/*`, `admin-trading`, `admin-auth` | admin-password / admin-session | `admin-auth` is public (it is the password-check itself) |
| `broadcast/*` | public GET, admin-session POST/DELETE | `host`, `index`, `sync` are fully public |
| `liveshow/*` | public | `debug` is dev-only (404 in production) |
| `streaming/*` | admin-password | — |
| `x/drafts*` | admin-session | — |
| `config/*`, `avatar/*`, `binance-agent/*`, `bnb/*`, `market`, `pumpfun/*` | public | — |
| `tts`, `public-chat` | rate-limited-public | — |
| `elizaos-proxy`, `jupiter-proxy`, `memory`, `mediaHandler`, `dataHandler`, `amicaHandler` | public | — |

---

## Endpoint reference

### Niya Tools — `src/pages/api/nyla-tools/*`

#### `POST /api/nyla-tools/microstructure`
**Auth**: public.
**Purpose**: Compute holders / LP-lock / snipers / rug-risk for a BSC token; 10-minute DB cache.
**Request**: `{ ca: "0x<40-hex>", source?: string, fresh?: boolean }`.
**Response (200)**: `{ data: MicrostructureResult, cached: boolean }`.
**Errors**: 400 bad `ca`, 503 missing `MORALIS_API_KEY`, 500 compute failed.
**Notes**: `fresh: true` bypasses cache; source file `src/features/nylaTools/microstructure.ts`.

#### `POST /api/nyla-tools/ask`
**Auth**: rate-limited-public (20 req/min/IP).
**Purpose**: Free-text Q&A about a token's analysis report.
**Request**: `{ question: string, ca?: "0x<40-hex>", context?: object, model?: string }`.
**Response (200)**: `{ answer: string, cached: boolean, provider: "dgrid"|"xai", model: string }`.
**Errors**: 400 invalid body, 429 rate limit, 502 upstream LLM failed, 503 no LLM configured.
**Notes**: `model` must be in the DGrid allow-list (see `src/features/llm/dgrid.ts::DGRID_MODELS`). Unknown values are silently replaced with the env default.

#### `POST /api/nyla-tools/narrate`
**Auth**: rate-limited-public.
**Purpose**: Generate a 2–3 sentence natural-language summary from a microstructure result.
**Request**: `{ ca: string, symbol?: string, data: NarrateData }` (subset of `MicrostructureResult`).
**Response (200)**: `{ narration: string, cached: boolean, provider, model }`.
**Errors**: 400, 429, 502, 503.

#### `POST /api/nyla-tools/wallet-age`
**Auth**: public.
**Purpose**: Classify a BSC wallet into `scout`/`analyst`/`pro` based on its first on-chain tx.
**Request**: `{ address: "0x<40-hex>" }`.
**Response (200)**: `{ data: WalletAgeResult, cached: boolean }` (7-day cache).
**Errors**: 400 bad address, 503 missing Moralis key, 500 upstream.

---

### Admin — `src/pages/api/admin/*`, `admin-trading.ts`, `admin-auth.ts`

#### `POST /api/admin-auth`
**Auth**: public (10 req/min/IP).
**Purpose**: Validate an admin password against `ADMIN_PASSWORD`. Primary gate for legacy admin UI.
**Request**: `{ password: string }`.
**Response (200)**: `{ success: boolean, error: string|null }`.

#### `POST /api/admin-trading`
**Auth**: admin-password (body field).
**Purpose**: Unified admin control for wallet, trading, ElizaOS commands, tweet posting.
**Request**: `{ password, action, data? }` where `action` is one of `get_wallet_info`, `get_token_balances`, `buy_token`, `sell_token`, `get_swap_quote`, `post_tweet`, `set_trading_enabled`, `get_trading_status`, `send_elizaos_command`.
**Response**: `{ success: boolean, data?, error? }`.
**Notes**: Dispatches to ElizaOS (`ELIZAOS_URL`), Jupiter, and Helius depending on action.

#### `POST /api/admin/bnb-trade`
**Auth**: admin-session (`x-admin-auth` header).
**Purpose**: BNB Chain trading via `bnbTradingService`.
**Request**: `{ action: "buy"|"sell"|"quote"|"status"|"guardrails", tokenAddress?, amount?, tokenAmount?, slippageBps?, guardrails? }`.
**Response**: `{ success, data?, error? }`.
**Rate limits**: buy/sell 1/min, quote 10/min, status/guardrails 30/min.

#### `POST /api/admin/four-meme-launch`
**Auth**: admin-session (`x-admin-secret` header), 1 launch / 10 min / IP.
**Purpose**: Verify wallet, register EIP-8004 agent, upload image, and launch a Four.meme token.
**Request**: `{ action: "config"|"verify"|"prepare"|"register"|"authenticate"|"upload"|"create"|... }` plus action-specific fields.
**Response**: `{ success, config|data, error? }`.
**Notes**: Source file `src/pages/api/admin/four-meme-launch.ts`; uses idempotency via the shared `rate_limits` table (`four-meme-launch:idempotency`, 24h window).

---

### Broadcast — `src/pages/api/broadcast/*`

#### `GET /api/broadcast`
**Auth**: public. Returns current broadcast state, current media, computed `currentTime`, and the next 10 queued clips.

#### `GET /api/broadcast/sync`
**Auth**: public. Used by the player for playback sync — returns `{ isPlaying, currentTime, mediaUrl, mediaId, recentReactions }`.

#### `GET /api/broadcast/queue`, `POST /api/broadcast/queue`, `DELETE /api/broadcast/queue?id=…`
**Auth**: public GET, admin-session on writes (`verifyAdminAuth`, `src/lib/adminAuth.ts`).
**Purpose**: Read queued media (top 20) and manage the queue.
**POST body**: validated by `insertBroadcastMediaSchema` (`src/features/liveShow/schema.ts`).

#### `POST /api/broadcast/control`
**Auth**: admin-session.
**Purpose**: Play / pause / skip / seek current broadcast media.
**Request**: `{ action: "play"|"pause"|"next"|..., mediaId? }`.

#### `GET|POST /api/broadcast/audio`
**Auth**: public GET for current-speaking state, POST used by the avatar pipeline to record spoken audio; request payload is large (10MB body limit).

#### `POST /api/broadcast/speak`
**Auth**: public (internal). Synthesises text via ElevenLabs with LRU+DB caching and pushes to the avatar state. Large file; see source for parameters (`text`, `voiceId`, `emotion`, etc.).

#### `GET|POST /api/broadcast/host`
**Auth**: public. Hybrid endpoint — GET `?action=stream` opens a Server-Sent Events channel for subtitles and chat; GET without `action` returns host status; POST is used by the host client to heartbeat and broadcast subtitles.

---

### Liveshow chat queue — `src/pages/api/liveshow/*`

#### `GET /api/liveshow/messages`
**Auth**: public. Returns last `limit` (default 50, max 100) public chat messages.
#### `POST /api/liveshow/messages`
**Auth**: public. Saves a `{ userMessage, assistantResponse }` pair.

#### `GET|POST /api/liveshow/queue`
**Auth**: public. GET returns pending queue items. POST enqueues a new chat item; free tier capped at 1 message per visitor until a wallet is linked.

#### `GET /api/liveshow/next`
**Auth**: public. Atomically claims the next pending queue item (pending → processing). Consumer endpoint for the live-show host client.

#### `GET /api/liveshow/batch?limit=N`
**Auth**: public. Claims up to N pending items in a single transaction — used by the host client to prefetch a short queue.

#### `GET /api/liveshow/stats`
**Auth**: public. `{ queueLength, activeViewers }` (viewers active in the last 5 minutes).

#### `GET /api/liveshow/health`
**Auth**: public. Database connectivity diagnostics + list of tables. Useful for hackathon judges verifying deployment wiring.

#### `GET /api/liveshow/debug`
**Auth**: dev-only. Returns 404 when `NODE_ENV === "production"`. Dumps recent messages and queue state.

---

### Twitter drafts — `src/pages/api/x/*`

#### `GET|POST /api/x/drafts`
**Auth**: admin-session (`x-admin-auth`).
**Purpose**: List or create X (Twitter) draft posts. POST body: `{ text: string (<=280), replyToTweetId? }`. Daily cap of 50 drafts per admin identity (`x_draft_create` rate-limit key).

#### `GET|DELETE /api/x/drafts/[id]`
**Auth**: admin-session. Fetch or delete a single draft by numeric id.

---

### Streaming (RTMP) — `src/pages/api/streaming/*`

#### `POST /api/streaming/start`
**Auth**: admin-password (body `adminPassword` field).
**Purpose**: Start / stop / status an FFmpeg child process pushing to an RTMP endpoint. Returns a one-time `authToken` used by `/push` and `/frame` (server-side global state).
**Request**: `{ action: "start"|"stop"|"status", rtmpUrl?, streamKey?, adminPassword }`.

#### `POST /api/streaming/push`
**Auth**: stream auth token from `/start`.
**Purpose**: Stream a Matroska/WebM chunk to the live FFmpeg process (encoded to H.264 + AAC → RTMP). `bodyParser` disabled; chunks arrive as raw bytes.

#### `POST /api/streaming/frame`
**Auth**: stream auth token.
**Purpose**: Same pipeline but accepts individual JPEG frames (`image2pipe` at 24 fps) with a silent AAC track — used when the client renders frames in canvas instead of MediaRecorder.

---

### Binance / BNB / PumpFun / Four.meme helpers

#### `GET /api/binance-agent/address?address=0x…`
Public. Returns insights (`binanceAgentSkills.getAddressInsights`). 2-min stale-while-revalidate.

#### `GET /api/binance-agent/meme?limit=N`
Public. Trending meme tokens (max 20).

#### `GET /api/binance-agent/rankings?limit=N`
Public. Market rankings (max 20).

#### `GET /api/binance-agent/risk?address=0x…`
Public. Contract-risk check via `checkContractRisk`. 5-min cache.

#### `GET /api/binance-agent/token?symbol=…`
Public. Token details by symbol (404 when not listed).

#### `GET /api/bnb/token?ca=0x…`
Public. Price, FDV, market cap, bonding-curve phase for a BSC token. Short (5s) in-memory cache with retry.

#### `POST /api/pumpfun/connect`
Public (internal). `{ action: "connect"|"disconnect" }` to manage the server-side PumpPortal WebSocket.

#### `GET /api/pumpfun/status`
Public. WebSocket connection flag + aggregate trade stats + endpoint hints.

#### `GET /api/pumpfun/trades`
Public. Returns `{ trades, stats }` from the in-memory trade log.

#### `GET /api/pumpfun/token?mint=…`
Public. DexScreener-backed token lookup (Solana). Falls back across providers.

---

### Config / avatar / TTS / public chat

#### `GET /api/config/bnb-token`
Public. Returns `{ ca, testCa, chainId, rpcUrl, configured }`.

#### `GET /api/config/token-mint`
Public. Returns `{ mint, configured }` (Solana mint for the Niya token).

#### `GET /api/config/wallet`
Public. Returns the public BNB wallet address, chain, chainId.

#### `GET|POST /api/avatar/state`
Public. GET opens an SSE stream of avatar state. POST broadcasts `{ emotion?, speaking?, text?, lipSyncValue?, expression?, motion? }` to all connected clients.

#### `POST /api/tts`
Rate-limited-public (30 req/min/IP). Body `{ message, voiceId, model }`. Hard cap 1000 chars. Proxies ElevenLabs using `ELEVENLABS_API_KEY`. Returns raw audio.

#### `POST /api/public-chat`
Rate-limited-public (20 req/min/IP). Body `{ message, userId?, roomId? }`. Validated through `commandValidator` to block forced-trade / tweet / wallet-manipulation / prompt-injection patterns before forwarding to ElizaOS.

#### `GET /api/market`
Public. BTC/ETH/BNB spot prices + 24h change from CoinGecko; 30s in-memory cache.

---

### Misc / legacy

#### `ANY /api/elizaos-proxy`
Public. Thin proxy to ElizaOS with a hard-coded allow-list of forwardable paths (`/api/messages/submit`, `/api/messages`, `/api/agents`, `/api/chat`). Protects against SSRF.

#### `GET|POST /api/jupiter-proxy`
Public. Signed wrapper over `api.jup.ag` — quotes and price lookups for Solana mints. Requires `JUPITER_API_KEY` server-side.

#### `GET|POST /api/memory?action=…`
Public. Visitor memory/facts CRUD backed by `server/storage` (`saveMessage`, `getMessages`, `saveFact`, `getFacts`, `saveEmotionalState`, …).

#### `GET|POST /api/dataHandler?type=…`
Public. Legacy external-API bridge for config/subconscious/logs/userInputMessages/chatLogs.

#### `POST /api/mediaHandler`
Public. Form-data entry point for voice transcription and image processing via `src/features/externalAPI/processors/*`. Gated by `external_api_enabled` config flag.

#### `ANY /api/amicaHandler`
Stub retained after amicaLife removal. Returns `{ status: "ok" }` only.

---

## Shared types

The types below are re-exported from both the server schema and the extension bundle; keep them in sync.

```ts
// src/components/niyaTools/lib/types.ts (mirror of src/features/nylaTools/schema.ts)
export type Tier = 'scout' | 'analyst' | 'pro';

export interface MicrostructureHolder {
  address: string;
  share: number;
  isContract: boolean;
  label: string | null;
  category: 'burn'|'staking'|'exchange'|'bridge'|'dex'|'locker'|'launchpad'|null;
  gmgnTags?: string[];
}

export interface MicrostructureLp {
  locked: boolean;
  lockedShare: number;
  lockProvider: 'unicrypt' | 'pinklock' | 'burned' | 'bonding-curve' | null;
}

export interface MicrostructureSnipers {
  count: number | null;
  sharePct: number | null;
  skipped: boolean;
}

export interface MicrostructureSecurity {
  isHoneypot: boolean | null;
  buyTax: number | null;
  sellTax: number | null;
  isOpenSource: boolean | null;
  canTakeOwnership: boolean | null;
  canModifyTax: boolean | null;
}

export interface MicrostructureClusters {
  detected: boolean;
  walletCount: number;
  combinedSharePct: number;
}

export interface MicrostructureResult {
  ca: string;
  totalHolders: number;
  top10Share: number;
  top10EffectiveShare: number;
  topHolderShare: number;
  topHolders: MicrostructureHolder[];
  lp: MicrostructureLp;
  snipers: MicrostructureSnipers;
  devWallet: { address: string | null; currentShare: number };
  tokenAgeDays: number | null;
  rugRiskScore: number;
  riskHeadline: string;
  computedAt: number;
  security: MicrostructureSecurity | null;
  clusters: MicrostructureClusters | null;
  _cacheVersion?: number;
}

export interface PairSummary {
  pairAddress: string;
  chainId: string;
  dexId: string;
  priceUsd: number;
  liquidityUsd: number;
  volume24h: number;
  priceChange24h: number;
  fdv: number;
  marketCap: number;
  baseToken: { symbol: string; name: string; address: string };
  quoteToken: { symbol: string; address: string };
  url: string;
}
```

```ts
// src/features/nylaTools/schema.ts
export interface WalletAgeResult {
  address: string;
  firstTxTimestamp: number | null;  // unix seconds
  ageDays: number;
  tier: 'scout' | 'analyst' | 'pro';
}
```

`Message` (chat queue / public chat) — see `insertChatMessageSchema` and `insertChatQueueSchema` in `src/features/liveShow/schema.ts`; the columns include `id`, `visitorName`, `role`, `content`, `isPublic`, `createdAt`, `status`.

Client-side call shapes that consume these routes live in `src/components/niyaTools/lib/backend.ts` (side panel) and `extension/src/lib/backend.ts` (browser extension). Both were cross-checked against the server responses above.

---

## Deprecated / Phase-1 migration note

The following endpoints still accept the legacy `ADMIN_PASSWORD` in the request body and will move to an httpOnly-cookie session before General Availability. This is tracked work, not an oversight:

- `POST /api/admin-auth` — will become the cookie-issuer (`Set-Cookie: niya_admin=…; HttpOnly; Secure; SameSite=Strict`).
- `POST /api/admin-trading` — will drop the `password` body field and read `niya_admin` from the session cookie.
- `POST /api/streaming/start` — same migration; the one-time `authToken` for `/push` and `/frame` stays as-is.

Already on the session model (`x-admin-auth` / `x-admin-secret` + `timingSafeEqualStr`):

- `POST /api/admin/bnb-trade`
- `POST /api/admin/four-meme-launch`
- `GET|POST /api/x/drafts`, `GET|DELETE /api/x/drafts/[id]`
- `POST /api/broadcast/control`, `POST|DELETE /api/broadcast/queue` (via `verifyAdminAuth`)

Endpoints that will not change: all `public` and `rate-limited-public` routes.
