declare namespace NodeJS {
  interface ProcessEnv {
    // DGrid AI Gateway (Preferred — unified access to 200+ LLMs)
    // Server-only — never exposed to the browser. When set, /api/nyla-tools/*
    // and /api/companion/chat route through DGrid; the xAI vars below are
    // used only as a fallback.
    DGRID_API_KEY?: string;
    DGRID_MODEL?: string;

    // xAI/Grok Configuration (Legacy fallback)
    // Server-only (recommended — not exposed to the client bundle).
    // Used by /api/nyla-tools/ask and /api/nyla-tools/narrate when DGrid is
    // not configured.
    XAI_API_KEY?: string;
    XAI_URL?: string;
    XAI_MODEL?: string;
    // Client-visible (inlined into the browser bundle). Kept for the legacy
    // chat adapters that call xAI directly from the browser. Migrate to the
    // server-only variables above when possible.
    NEXT_PUBLIC_XAI_API_KEY?: string;
    NEXT_PUBLIC_XAI_URL?: string;
    NEXT_PUBLIC_XAI_MODEL?: string;
    
    // Legacy OpenAI fallback (deprecated - use xAI vars)
    NEXT_PUBLIC_OPENAI_APIKEY?: string;
    NEXT_PUBLIC_OPENAI_URL?: string;
    NEXT_PUBLIC_OPENAI_MODEL?: string;

    // OpenRouter Configuration
    NEXT_PUBLIC_OPENROUTER_APIKEY?: string;
    NEXT_PUBLIC_OPENROUTER_URL?: string;
    NEXT_PUBLIC_OPENROUTER_MODEL?: string;

    // LLM Backends
    NEXT_PUBLIC_CHATBOT_BACKEND?: string;
    NEXT_PUBLIC_LLAMACPP_URL?: string;
    NEXT_PUBLIC_LLAMACPP_STOP_SEQUENCE?: string;
    NEXT_PUBLIC_OLLAMA_URL?: string;
    NEXT_PUBLIC_OLLAMA_MODEL?: string;
    NEXT_PUBLIC_KOBOLDAI_URL?: string;
    NEXT_PUBLIC_KOBOLDAI_USE_EXTRA?: string;
    NEXT_PUBLIC_KOBOLDAI_STOP_SEQUENCE?: string;

    // ElevenLabs TTS
    NEXT_PUBLIC_ELEVENLABS_APIKEY?: string;
    NEXT_PUBLIC_ELEVENLABS_VOICEID?: string;
    NEXT_PUBLIC_ELEVENLABS_MODEL?: string;

    // Whisper STT
    NEXT_PUBLIC_OPENAI_WHISPER_APIKEY?: string;
    NEXT_PUBLIC_OPENAI_WHISPER_URL?: string;
    NEXT_PUBLIC_OPENAI_WHISPER_MODEL?: string;

    // Vision
    NEXT_PUBLIC_VISION_BACKEND?: string;
    NEXT_PUBLIC_VISION_OPENAI_APIKEY?: string;
    NEXT_PUBLIC_VISION_OPENAI_URL?: string;
    NEXT_PUBLIC_VISION_OPENAI_MODEL?: string;

    // ElizaOS
    NEXT_PUBLIC_ELIZAOS_URL?: string;

    // Helius RPC
    NEXT_PUBLIC_HELIUS_API_KEY?: string;

    // Admin
    ADMIN_PASSWORD?: string;
    // Secret used to HMAC-sign admin session tokens. Must be set (>= 32
    // bytes of entropy) in any environment where the admin panel is reachable.
    SESSION_SECRET?: string;

    // CORS
    // Comma-separated allowlist of exact origins (scheme + host + optional
    // port). Leave unset to use the default allowlist defined in
    // src/features/liveShow/cors.ts.
    NIYA_CORS_ALLOWED_ORIGINS?: string;

    // Autonomy kill switch. Default "on" blocks agent-initiated trades even
    // when the ElizaOS socket is connected. Set to "off" ONLY after reviewing
    // SECURITY.md — see src/features/autonomy/elizaOSBridge.ts for the
    // call-site guards in executeAction() and requestSwap().
    AUTONOMY_TRADING_KILL_SWITCH?: string;

    // Base URL used by src/pages/_document.tsx for canonical <link> and
    // OG/Twitter image URLs. Falls back to https://niyaagent.com when unset.
    NEXT_PUBLIC_BASE_URL?: string;

    // Google Analytics consent gate. Defaults OFF — set to the literal string
    // "true" only once a cookie consent banner is live in production.
    NEXT_PUBLIC_GA_ENABLED?: string;
  }
}
