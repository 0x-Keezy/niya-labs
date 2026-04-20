<p align="center">
  <img src="public/niya-logo.png" alt="Niya Labs" width="140"/>
</p>

<h1 align="center">Niya Labs</h1>

<p align="center">
  <strong>One AI VTuber. One token analyzer. Both on BNB Chain.</strong>
</p>

<p align="center">
  Two products under one roof:<br/>
  <a href="#niya-companion"><strong>Niya</strong></a> — an AI VTuber companion with voice, personality and Web3 integration.<br/>
  <a href="#niya-tools"><strong>Niya Tools</strong></a> — a BNB Chain microstructure analyzer, free, no-install.
</p>

<p align="center">
  <a href="https://niyaagent.com">niyaagent.com</a> ·
  <a href="https://x.com/NiyaAgent">@NiyaAgent</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#for-hackathon-judges">For hackathon judges</a>
</p>

<p align="center">
  <a href="https://github.com/0x-Keezy/niya-labs/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"/></a>
  <a href="https://x.com/NiyaAgent"><img src="https://img.shields.io/badge/%40NiyaAgent-black?style=flat&logo=x" alt="X/Twitter"/></a>
  <img src="https://img.shields.io/badge/Four.meme-AI%20Sprint-FF617F" alt="Four.meme AI Sprint"/>
  <img src="https://img.shields.io/badge/Chain-BNB-F3BA2F" alt="BNB Chain"/>
  <a href="https://dgrid.ai"><img src="https://img.shields.io/badge/Powered%20by-DGrid%20AI%20Gateway-B5FF4A" alt="Powered by DGrid"/></a>
</p>

---

## What is Niya Labs?

Niya Labs ships **two experiences** that share a brand, a palette and a soul, but solve very different problems:

| | Niya Companion | Niya Tools |
|---|---|---|
| **What it is** | An AI VTuber — voice, avatar, personality. | A memecoin microstructure analyzer. |
| **Who it's for** | Streamers, communities, anyone who wants an on-chain friend. | BNB Chain traders who want to survive Four.meme and PancakeSwap without getting rugged. |
| **Interface** | Full-screen 3D/Live2D avatar with chat and TTS. | Side panel (extension) **or** web app — same analyzer, two surfaces. |
| **Web route** | `/companion` | `/tools` |
| **Built on** | Next.js · Three.js · ElevenLabs · DGrid · BNB Chain | Next.js · Moralis · GoPlus · GMGN · DGrid |

Think of it as **one project, two surfaces.** The VTuber is the fun face; the Analyzer is the serious due-diligence tool. Both speak the same brand voice (Niya, the candy-loving AI companion on BNB Chain), both respect the same palette, both are built for BNB Chain first.

---

## Quick start

**Prerequisites:** Node.js 18+, PostgreSQL, and API keys (see [SETUP.md](SETUP.md)).

```bash
git clone https://github.com/0x-Keezy/niya-labs.git
cd niya-labs
npm install

# Copy .env.example → .env.local and fill in keys
cp .env.example .env.local

# Start the Next.js server (landing + companion + tools on port 5000).
# `server.js` is a thin custom wrapper around `next dev` — see SETUP.md
# step 4 if you need to change the port or enable HTTPS.
node server.js
```

Open **[http://localhost:5000](http://localhost:5000)** → you'll land on the Niya Labs hub with two cards.

- Click **Meet Niya** → `/companion` → the VTuber.
- Click **Analyze a token** → `/tools` → paste a BNB Chain CA (try `0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82` for CAKE).

### Chrome extension (optional)

The analyzer is also shipped as a Chrome extension that auto-detects contract addresses on DexScreener, PancakeSwap, Four.meme and GMGN:

```bash
cd extension
npm install
npm run build        # outputs extension/dist/
# chrome://extensions → Enable Developer Mode → Load unpacked → select extension/dist
```

Either surface (web or extension) hits the same backend API (`/api/nyla-tools/*`).

---

<a id="niya-companion"></a>
## Niya Companion — the VTuber

> *"I'm Niya. Candy hamster. Golden hair, fluffy ears, pastel yellow dress. I stream, trade, and live on BNB. Nya~."*

Niya is a **VTuber** — not a chatbot. She has a voice (ElevenLabs Yuki), a brain (DGrid AI Gateway, 200+ LLM options), a body (VRM / Live2D) and a life on BNB Chain. She can livestream to Twitch / YouTube, read chat, react, launch tokens via Four.meme, swap on PancakeSwap when needed, and post autonomous tweets (draft-gated via `/admin`).

**Features that work today:**

- 🧠 **Chat** — Grok, OpenRouter, DeepSeek, Ollama, LLaMA.cpp, KoboldCpp.
- 🎤 **Voice** — ElevenLabs, OpenAI TTS, Coqui/Piper/Kokoro/AllTalk local.
- 👂 **Ears** — Browser SR, Whisper API, Whisper.cpp local, VAD.
- 🎭 **Body** — VRM 3D (Three.js) and Live2D with 14-expression blend-shape emotion map.
- 📺 **Live streaming** — RTMP to PumpFun / Twitch / YouTube, 1280×720 H.264, subtitle overlay, BTC/ETH/SOL market overlay.
- 🪙 **Web3** — Four.meme token launch on BNB, ElizaOS autonomy bridge, Jupiter swaps (optional Solana), Helius RPC.
- ✖️ **Social** — Twitter drafts with admin approval, Telegram bot hooks.

Stack: `Next.js 14 · React 18 · Tailwind · Three.js · @pixiv/three-vrm · pixi-live2d-display · Drizzle ORM + Postgres · Socket.io` (Tauri desktop wrapper planned for v0.2).

---

<a id="niya-tools"></a>
## Niya Tools — the memecoin analyzer

Paste a BNB Chain token address, wait ~8 seconds, and Niya tells you whether the token is a rug — as sentences you can read, not ink-dots on a chart.

**What it checks:**

| Signal | Source | Meaning |
|---|---|---|
| Top-10 holder concentration | Moralis | >40% = sybil risk |
| Top-1 holder share | Moralis | >20% = single whale can dump |
| LP locked share + provider | GoPlus + on-chain inference | Unlocked LP → classic rug setup |
| Sniper wallets (first 30 buys) | Moralis transfers | Bundle/mev signatures on new tokens |
| Token age | Moralis metadata | <7d = skeptical, <90d = "young" |
| Honeypot / taxes / ownership | GoPlus | Unsellable, high tax, takeback |
| Sybil clusters (2-hop funder graph) | Moralis `wallet_transactions` | Coordinated wallet groups |
| Behavioural tags per holder | GMGN | `whale`, `cex`, `smart_money`, `renowned`, `sniper`, `bundler` |

Each signal contributes to a **0-89 rug-risk score** (capped below 100 to never imply certainty) with an explainable headline: *"Launched via bonding curve — distribution is the main risk factor"* rather than a mysterious number.

**Ask Niya** — a free-text box at the bottom sends the token's full context to a DGrid-routed LLM and gets a neutral, non-financial-advice answer. *"Why is the score 63?"* → actual explanation with numbers from the report. A dropdown lets you swap between GPT-4o mini, Grok 3 mini, Claude 3.5 Haiku, Gemini 2.0 Flash, Qwen 2.5 72B and DeepSeek Chat without leaving the page — all proxied through a single API key.

**Rules** — "Ping me if rug risk goes above 70" — natural-language alerts with browser notifications. Powered by a small NL parser (see `extension/src/lib/actionRules.ts`).

**Two surfaces, one backend:**

- `src/pages/tools.tsx` — web analyzer at `niyaagent.com/tools`.
- `extension/dist/` — Chrome MV3 extension with auto-detection on DexScreener / PancakeSwap / Four.meme / GMGN.
- Both talk to `src/pages/api/nyla-tools/*` (microstructure, ask, narrate, wallet-age).

---

## Architecture snapshot

```
┌────────────────────────────────────────────────────────────┐
│                   niyaagent.com                             │
├────────────────────┬──────────────────┬────────────────────┤
│   /                │   /companion     │   /tools           │
│   Niya Labs hub    │   VTuber app     │   Web analyzer     │
│   (landing)        │   (VRM + chat)   │   (port of side    │
│                    │                   │    panel)          │
└────────────────────┴──────────────────┴────────────────────┘
                           │
                           ▼
             ┌─────────────────────────────┐
             │   /api/nyla-tools/*         │ ← Shared by web + extension
             │   · microstructure          │
             │   · ask     ──┐             │
             │   · narrate ──┤             │
             │   · wallet-age│             │
             ├───────────────┼─────────────┤
             │   /api/tts · /api/broadcast │ ← VTuber-only endpoints
             │   /api/admin-trading · …    │
             └───────────────┼─────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ DGrid Gateway  │ ← src/features/llm/dgrid.ts
                    │ (200+ LLMs)    │   resolves provider +
                    └────────────────┘   validates model picker
                             │
             ┌───────────────┼───────────────┬──────────┐
             ▼               ▼               ▼          ▼
        OpenAI         Anthropic         xAI Grok    Qwen/…
        GPT-4o         Claude 3.5                    (all via
                                                      one API)

             ┌─────────────┼─────────────┐
             ▼             ▼             ▼
          Moralis       GoPlus        GMGN
          (holders      (honeypot     (behavioural
           metadata     taxes LP)      tags via
           transfers)                   gmgn-cli)
```

Backend lives in `src/pages/api/nyla-tools/` and `src/features/nylaTools/`. See [SETUP.md](SETUP.md) for env vars, database setup and `~/.config/gmgn/.env` for GMGN credentials.

---

## For hackathon judges

This repo is the **Four.meme AI Sprint** submission for *Niya Labs*.

**How to evaluate in 5 minutes:**

1. Clone, `npm install`, `cp .env.example .env.local`, fill in `DGRID_API_KEY` (preferred — handles all LLM calls via one key) or `XAI_API_KEY` (legacy fallback), plus `MORALIS_API_KEY`, `ELEVENLABS_API_KEY`, `DATABASE_URL`. For GMGN: `~/.config/gmgn/.env` with `GMGN_API_KEY` + `GMGN_PRIVATE_KEY` (see [SETUP.md](SETUP.md)).
2. `node server.js` → open `http://localhost:5000`.
3. Click **Analyze a token** → paste `0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82` (CAKE) → see rug score 8-ish, explanation, holder ledger with whale/cex tags.
4. Click back → **Meet Niya** → talk to the VTuber, hear the TTS, see emotions on the avatar.
5. (Optional) Load the Chrome extension from `extension/dist/`, navigate to DexScreener BSC — the same analyzer opens in a side panel with automatic CA detection.

**What's novel:**

- **Progressive disclosure tier system** — the analyzer gates technical-analysis overlays behind wallet age (<90d = Scout, 90-365d = Analyst, 365d+ = Pro). Based on the hypothesis that new wallets shouldn't see charts until they understand microstructure. Wallet age is fetched via BscScan `txlist` and cached 7 days.
- **Three-source cross-reference** — Moralis (balances), GoPlus (security), GMGN (wallet intelligence) merged into one verdict. Not a single-API wrapper.
- **AI as narrator, not advisor** — the LLM (routed through DGrid AI Gateway, swappable between GPT-4o mini, Claude 3.5 Haiku, Grok 3 mini, Gemini, Qwen, DeepSeek) explains the numbers as readable sentences but is prompted against price prediction, buy/sell advice, "support/resistance" jargon. Read-only by design.
- **Unified LLM access via DGrid** — every `/api/nyla-tools/*` call routes through [DGrid AI Gateway](https://dgrid.ai) via a single OpenAI-compatible endpoint. One key, 200+ models, and a live model-picker in the Ask Niya panel so judges can switch providers on the fly. Legacy xAI is kept as an automatic fallback if `DGRID_API_KEY` is unset. See `src/features/llm/dgrid.ts` for the full resolver + allow-list.
- **Same core, two surfaces** — extension for traders who want auto-detection on familiar sites, web app for everyone else (no install, no trust barrier).

**Technical notes:**

- Built on Next.js 14 (Pages Router), React 18, TypeScript, Tailwind, Drizzle ORM + Postgres.
- GMGN is accessed via the official `gmgn-cli` npm package, which handles Ed25519 request signing and the 1 call / 5s rate limit internally.
- DB-backed atomic rate limiting (`SELECT … FOR UPDATE` + transaction) on every monetary endpoint (TTS, LLM, admin auth).
- Security headers on `next.config.js`, timing-safe admin password compare, CORS allowlist (not wildcard), command-injection-safe subprocess calls.

See also [`PITCH.md`](PITCH.md) for the 8-slide pitch deck outline.

---

## Contributing

Contributions are welcome. Priority areas: Live2D expressions, VRM designers, WebGPU rendering, mobile responsive, documentation. Open a PR or issue.

---

## License

MIT — see [LICENSE](LICENSE).

<p align="center">
  <strong>Not financial advice.</strong> Niya Tools is a read-only analyzer. We never sign transactions, hold private keys, or move funds on your behalf.
</p>

<p align="center">
  Made with 🔥 by the Niya team
</p>
