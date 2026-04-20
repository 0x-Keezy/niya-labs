# Changelog

All notable changes to Niya Labs are tracked here. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/).

## [0.1.0] — 2026-04 — Four.meme AI Sprint baseline

Initial public release. Built for the Four.meme AI Sprint × DGrid bounty.

### Added

**Niya — the VTuber companion**
- Full-screen 3D avatar (VRM via Three.js) + Live2D renderer with 14 emotion blend-shapes
- Chat with swappable LLM backend (DGrid, xAI, OpenRouter, OpenAI, DeepSeek, Ollama, LLaMA.cpp, KoboldCpp)
- Voice via ElevenLabs (Yuki) + alternates (OpenAI TTS, Coqui, Piper, Kokoro, AllTalk)
- Speech-to-text via browser SR, Whisper API, or local Whisper.cpp
- Live streaming to RTMP endpoints (Twitch / YouTube) with subtitle + market overlays
- Autonomous tweet drafts gated via `/admin` approval flow
- Four.meme token launcher wired to the VTuber persona

**Niya Tools — the BNB-Chain token analyzer**
- Rug-risk scoring (0–89 scale, capped to never imply certainty)
- Microstructure ledger: top-10 holders, top-1 custody detection, LP lock share, honeypot / tax / ownership checks, sniper wallet detection, GMGN behavioural tags
- Chrome MV3 side-panel extension with auto-detection on DexScreener, PancakeSwap, Four.meme and GMGN
- Web app at `/tools` with the same analyzer
- Analyst Mode: floors, ceilings, trendlines, Fibonacci entry zones overlaid on live charts (tier-gated by liquidity ≥ $50k and pair age ≥ 48h)
- Ask Niya — free-text explainer backed by DGrid's model picker

**Shared infra**
- DGrid AI Gateway as the primary LLM router (`src/features/llm/dgrid.ts`) with a server-side allow-list of 6 models
- Autonomous-trading kill switch (`AUTONOMY_TRADING_KILL_SWITCH=on` by default)
- Admin auth with timing-safe compare + HMAC-signed session cookies + DB-backed rate limits
- CORS allowlist (exact-match, no wildcards)

### Known limitations

- `src/pages/index.tsx` is a 3,200+ line god-file — extracting into composable landing components is a v0.2 task
- Extension and web app share sidepanel UI via copy-paste (`extension/src/sidepanel/` ↔ `src/components/niyaTools/sidepanel/`) — extraction into a shared `packages/niya-core/` workspace is a v0.2 task
- API error envelope is inconsistent across routes — standardising via a shared helper is a v0.2 task
- Still on Next.js Pages Router; App Router migration deferred

### Roadmap (v0.2)

- Shared core package extraction
- Landing file breakdown into reusable sections
- App Router migration
- Tauri desktop wrapper for the VTuber
- Chrome Web Store listing for the extension (currently sideload-only)
