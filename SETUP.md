# Niya Labs — Setup Guide

End-to-end setup for **Niya Companion** (`/companion` — VTuber) and **Niya Tools** (`/tools` — BNB Chain memecoin analyzer). Also covers the Chrome extension in `extension/`.

> Target reader: a judge or contributor who just cloned the repo and wants to boot the app on their machine in < 10 minutes.

---

## Prerequisites

- **Node.js 18+** (`.nvmrc` pins a specific patch version).
- **PostgreSQL 14+** — local or hosted (Supabase, Neon, Railway all work).
- A terminal. Windows, macOS and Linux are all supported.

---

## 1. Clone & install

```bash
git clone https://github.com/0x-Keezy/niya-labs.git
cd niya-labs
npm install
```

---

## 2. Environment variables

Copy `.env.example` to `.env.local` and fill in the keys you need. You can boot the app with **only the "Minimum boot" set** below; everything else degrades gracefully.

```bash
cp .env.example .env.local
```

### Minimum boot (required)

| Variable | Purpose | Where to get it |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | Supabase / Neon / Railway free tier, or local `postgres://localhost/niya` |
| `ADMIN_PASSWORD` | Protects `/admin/*` routes. **Use ≥16 random chars**. | Generate with `openssl rand -base64 24` |
| `SESSION_SECRET` | Opaque cookie signing secret. **Never share, never commit**. | Generate with `openssl rand -base64 32` |

### Niya Tools (analyzer)

The analyzer makes three upstream calls per scan. Pick the DGrid path (preferred) **or** the legacy xAI path.

| Variable | Purpose | Where to get it |
|---|---|---|
| `DGRID_API_KEY` | **Preferred** — unified OpenAI-compatible gateway routing to 200+ LLMs. Used by `/api/nyla-tools/ask`, `/narrate`. | [dgrid.ai](https://dgrid.ai) |
| `DGRID_MODEL` | Default model ID, e.g. `openai/gpt-4o-mini`. See [dgrid.ai/models](https://dgrid.ai/models). | — |
| `XAI_API_KEY` | **Legacy fallback** — used if `DGRID_API_KEY` is unset. | [console.x.ai](https://console.x.ai) |
| `MORALIS_API_KEY` | Holder + metadata + transfer data. Get two keys to rotate. | [admin.moralis.io](https://admin.moralis.io) |
| `MORALIS_API_KEY_2` | Second Moralis key — auto-rotates on rate-limit. | Same as above |
| `BSCSCAN_API_KEY` | Wallet-age lookups (tier gating). | [bscscan.com/apis](https://bscscan.com/apis) |

**GMGN credentials** — stored outside the repo at `~/.config/gmgn/.env` (Unix) or `%USERPROFILE%\.config\gmgn\.env` (Windows). The `gmgn-cli` npm package handles Ed25519 signing internally.

```bash
mkdir -p ~/.config/gmgn
cat > ~/.config/gmgn/.env <<EOF
GMGN_API_KEY=your_gmgn_api_key
GMGN_PRIVATE_KEY=your_ed25519_private_key
EOF
chmod 600 ~/.config/gmgn/.env    # Unix only — Windows ACLs differ
```

### Niya Companion (VTuber)

| Variable | Purpose | Where to get it |
|---|---|---|
| `NEXT_PUBLIC_ELEVENLABS_APIKEY` | Yuki voice (paid plan required for library voices). | [elevenlabs.io](https://elevenlabs.io) |
| `NEXT_PUBLIC_ELEVENLABS_VOICEID` | Voice ID. Default Yuki: `qNkzaJoHLLdpvgh5tISm`. | — |
| `NEXT_PUBLIC_DEEPSEEK_API_KEY` | Optional reasoning engine backend. | [platform.deepseek.com](https://platform.deepseek.com) |

### Social & blockchain (optional)

| Variable | Purpose |
|---|---|
| `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` | Autonomous tweet drafts (admin-approved via `/admin/elizaos`). |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | Optional Telegram bot hooks. |
| `NEXT_PUBLIC_HELIUS_API_KEY` | Solana RPC (Jupiter swaps). |
| `BNB_PRIVATE_KEY` | **Admin-only** trading wallet private key. Never commit. |

### Streaming (optional)

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_STREAMING_RTMP_URL` | RTMP endpoint (PumpFun / Twitch / YouTube). |
| `NEXT_PUBLIC_STREAMING_KEY` | Stream key matching the RTMP endpoint. |

---

## 3. Database setup

Niya uses **Drizzle ORM** with Postgres. Schemas live in `src/features/liveShow/schema.ts` and `src/features/nylaTools/schema.ts`.

First-time setup:

```bash
# Apply schema directly (for local dev)
npm run db:push

# Or generate a migration and apply it (recommended for shared envs)
npm run db:generate
npm run db:migrate
```

The first call to any `/api/*` endpoint will also auto-create the `rate_limits` and `visit_logs` tables if they don't exist (defensive migration on boot).

---

## 4. Run the app

```bash
# Single process — landing + /companion + /tools + all APIs on port 5000
node server.js
```

Open http://localhost:5000 — you'll land on the Niya Labs hub. From there:

- **Meet Niya** → `/companion` → VTuber with chat + voice.
- **Analyze a token** → `/tools` → paste `0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82` (CAKE) to test.

---

## 5. Chrome extension (optional)

```bash
cd extension
npm install
npm run build          # outputs extension/dist/
# Then: chrome://extensions → Enable Developer Mode → Load unpacked → select extension/dist
```

Visit https://dexscreener.com/bsc — the side panel auto-detects the contract address and runs the same analysis as the web app. Both surfaces share the same backend at `/api/nyla-tools/*`.

Hot-reload during dev: `npm run dev` inside `extension/` watches sources and rebuilds on save.

---

## 6. Admin panel

Navigate to `/admin/elizaos`. Enter `ADMIN_PASSWORD` to unlock:

- ElizaOS connection + market monitor (BTC/ETH/SOL).
- Twitter draft queue (approve/reject outgoing posts).
- BNB trading controls (buy/sell/quote/guardrails).
- Four.meme token launch helper.

> Phase-1 hardening (post-hackathon): the admin password will move to an httpOnly session cookie. For now it's cached in `sessionStorage` — do not run the admin panel on a shared machine.

---

## 7. Troubleshooting

**"Ask backend not configured" on `/tools`**
- Set `DGRID_API_KEY` (preferred) or `XAI_API_KEY` and restart the server.

**Moralis 401 / 429 errors**
- Rotate your Moralis keys — the backend auto-tries `MORALIS_API_KEY` then `MORALIS_API_KEY_2`.
- Free tier is 40k calls/day, shared across both keys.

**Rate-limit table doesn't exist**
- Run `npm run db:push` once to apply the Drizzle schema.

**`chrome://extensions` shows "Service worker registration failed"**
- Rebuild: `cd extension && npm run build`. The `dist/` folder must be fresh after every `npm install`.

**GMGN calls fail silently**
- Verify `~/.config/gmgn/.env` exists, has correct values, and has 600 permissions (Unix).
- Test directly: `npx gmgn-cli token security --chain bsc --address 0x...`.

**ElevenLabs returns 402**
- The Yuki voice requires a paid plan. Upgrade at elevenlabs.io or set `NEXT_PUBLIC_ELEVENLABS_APIKEY=` (empty) to disable TTS.

---

## 8. Project structure (high level)

```
src/
├── pages/
│   ├── index.tsx              # Landing (zine aesthetic)
│   ├── tools.tsx              # Niya Tools — web analyzer
│   ├── companion/             # Niya — VTuber viewer
│   ├── admin/                 # Admin panel (password-gated)
│   └── api/
│       ├── nyla-tools/        # Analyzer API (shared with extension)
│       ├── broadcast/         # SSE + audio fan-out
│       ├── liveshow/          # Chat queue + public messages
│       ├── admin/             # Trading, launch, session
│       └── x/                 # Twitter draft workflow
├── features/
│   ├── llm/dgrid.ts           # DGrid AI Gateway wrapper (single LLM entry)
│   ├── chat/                  # VTuber chat providers (Grok, OpenRouter, DGrid, local)
│   ├── nylaTools/             # Microstructure orchestrator + data fetchers
│   ├── auth/                  # timingSafeEqualStr, rate-limit enforcement
│   ├── broadcast/             # Server-side TTS + dual SSE/polling fanout
│   ├── liveShow/              # Drizzle schema, CORS, SSE helpers
│   └── vrmViewer/             # Three.js + VRM + Live2D
├── components/                # Shared React components
└── utils/config.ts            # Browser-side config (reads NEXT_PUBLIC_*)

extension/
├── manifest.json              # Chrome MV3
├── src/
│   ├── background.ts          # Service worker
│   ├── content-script.ts      # CA auto-detection on DexScreener / Four.meme / GMGN
│   └── sidepanel/             # React UI (shares lib/ with web)
└── dist/                      # Build output — load-unpacked target

docs/                          # Architecture narrative + ADRs (after Phase 3)
```

---

## 9. More reading

- [README.md](README.md) — project overview.
- [PITCH.md](PITCH.md) — 8-slide hackathon pitch.
- [SECURITY.md](SECURITY.md) — vulnerability disclosure policy.
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to submit changes.
- [extension/README.md](extension/README.md) — extension-specific setup.

## License

MIT — see [LICENSE](LICENSE).
