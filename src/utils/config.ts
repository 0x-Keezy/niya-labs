import { handleConfig, serverConfig } from "@/features/externalAPI/externalAPI";

export const defaults = {
  // AllTalk TTS specific settings
  localXTTS_url: process.env.NEXT_PUBLIC_LOCALXTTS_URL ?? 'http://127.0.0.1:7851',
  alltalk_version: process.env.NEXT_PUBLIC_ALLTALK_VERSION ?? 'v2',
  alltalk_voice: process.env.NEXT_PUBLIC_ALLTALK_VOICE ?? 'female_01.wav',
  alltalk_language: process.env.NEXT_PUBLIC_ALLTALK_LANGUAGE ?? 'en',
  alltalk_rvc_voice: process.env.NEXT_PUBLIC_ALLTALK_RVC_VOICE ?? 'Disabled',
  alltalk_rvc_pitch: process.env.NEXT_PUBLIC_ALLTALK_RVC_PITCH ?? '0',
  autosend_from_mic: 'true',
  wake_word_enabled: 'false',
  wake_word: 'Hello',
  time_before_idle_sec: '20',
  debug_gfx: 'false',
  use_webgpu: 'false',
  mtoon_debug_mode: 'none',
  mtoon_material_type: 'mtoon',
  language: process.env.NEXT_PUBLIC_LANGUAGE ?? 'en',
  bg_color: process.env.NEXT_PUBLIC_BG_COLOR ?? '',
  bg_url: process.env.NEXT_PUBLIC_BG_URL ?? '/bg/niya-sea-bg.mp4',
  vrm_url: process.env.NEXT_PUBLIC_VRM_HASH ?? '/vrm/AvatarSample_A.vrm',
  vrm_hash: '',
  vrm_save_type: 'web',
  viewer_type: process.env.NEXT_PUBLIC_VIEWER_TYPE ?? 'live2d',
  live2d_model_url: process.env.NEXT_PUBLIC_LIVE2D_MODEL_URL ?? '/models/candy-hamster/Candy Hamster.model3.json',
  youtube_videoid: '',
  animation_url: process.env.NEXT_PUBLIC_ANIMATION_URL ?? '/animations/idle_loop.vrma',
  animation_procedural: process.env.NEXT_PUBLIC_ANIMATION_PROCEDURAL ?? 'false',
  voice_url: process.env.NEXT_PUBLIC_VOICE_URL ?? '',
  chatbot_backend: process.env.NEXT_PUBLIC_CHATBOT_BACKEND ?? 'chatgpt',
  arbius_llm_model_id: process.env.NEXT_PUBLIC_ARBIUS_LLM_MODEL_ID ?? 'default',
  // xAI/Grok LLM configuration (internal keys use legacy names for localStorage compatibility)
  // New env vars: NEXT_PUBLIC_XAI_API_KEY, NEXT_PUBLIC_XAI_URL, NEXT_PUBLIC_XAI_MODEL
  // Legacy fallback: NEXT_PUBLIC_OPENAI_APIKEY, NEXT_PUBLIC_OPENAI_URL, NEXT_PUBLIC_OPENAI_MODEL
  openai_apikey: process.env.NEXT_PUBLIC_XAI_API_KEY ?? process.env.NEXT_PUBLIC_OPENAI_APIKEY ?? '',
  openai_url: process.env.NEXT_PUBLIC_XAI_URL ?? process.env.NEXT_PUBLIC_OPENAI_URL ?? 'https://api.x.ai/v1',
  openai_model: process.env.NEXT_PUBLIC_XAI_MODEL ?? process.env.NEXT_PUBLIC_OPENAI_MODEL ?? 'grok-3-latest',
  llamacpp_url: process.env.NEXT_PUBLIC_LLAMACPP_URL ?? 'http://127.0.0.1:8080',
  llamacpp_stop_sequence: process.env.NEXT_PUBLIC_LLAMACPP_STOP_SEQUENCE ?? '(End)||[END]||Note||***||You:||User:||</s>',
  ollama_url: process.env.NEXT_PUBLIC_OLLAMA_URL ?? 'http://localhost:11434',
  ollama_model: process.env.NEXT_PUBLIC_OLLAMA_MODEL ?? 'llama2',
  koboldai_url: process.env.NEXT_PUBLIC_KOBOLDAI_URL ?? 'http://localhost:5001',
  koboldai_use_extra: process.env.NEXT_PUBLIC_KOBOLDAI_USE_EXTRA ?? 'false',
  koboldai_stop_sequence: process.env.NEXT_PUBLIC_KOBOLDAI_STOP_SEQUENCE ?? '(End)||[END]||Note||***||You:||User:||</s>',
  moshi_url: process.env.NEXT_PUBLIC_MOSHI_URL ?? 'https://runpod.proxy.net',
  openrouter_apikey: process.env.NEXT_PUBLIC_OPENROUTER_APIKEY ?? '',
  openrouter_url: process.env.NEXT_PUBLIC_OPENROUTER_URL ?? 'https://openrouter.ai/api/v1',
  openrouter_model: process.env.NEXT_PUBLIC_OPENROUTER_MODEL ?? 'openai/gpt-3.5-turbo',
  // DGrid AI Gateway is now proxied server-side via /api/companion/chat.
  // The API key lives only in process.env.DGRID_API_KEY (server-only) to
  // keep it out of the browser bundle, so no dgrid_* client config keys.
  tts_muted: 'false',
  tts_backend: 'elevenlabs',
  stt_backend: process.env.NEXT_PUBLIC_STT_BACKEND ?? 'whisper_browser',
  vision_backend: process.env.NEXT_PUBLIC_VISION_BACKEND ?? 'vision_openai',
  vision_system_prompt: process.env.NEXT_PUBLIC_VISION_SYSTEM_PROMPT ?? `Look at the image as you would if you are a human, be concise, witty and charming.`,
  vision_openai_apikey: process.env.NEXT_PUBLIC_VISION_OPENAI_APIKEY ?? '',
  vision_openai_url: process.env.NEXT_PUBLIC_VISION_OPENAI_URL ?? 'https://api.x.ai/v1',
  vision_openai_model: process.env.NEXT_PUBLIC_VISION_OPENAI_MODEL ?? 'grok-2-vision-latest',
  vision_llamacpp_url: process.env.NEXT_PUBLIC_VISION_LLAMACPP_URL ?? 'http://127.0.0.1:8081',
  vision_ollama_url: process.env.NEXT_PUBLIC_VISION_OLLAMA_URL ?? 'http://localhost:11434',
  vision_ollama_model: process.env.NEXT_PUBLIC_VISION_OLLAMA_MODEL ?? 'llava',
  whispercpp_url: process.env.NEXT_PUBLIC_WHISPERCPP_URL ?? 'http://localhost:8080',
  openai_whisper_apikey: process.env.NEXT_PUBLIC_OPENAI_WHISPER_APIKEY ?? '',
  openai_whisper_url: process.env.NEXT_PUBLIC_OPENAI_WHISPER_URL ?? 'https://api.openai.com',
  openai_whisper_model: process.env.NEXT_PUBLIC_OPENAI_WHISPER_MODEL ?? 'whisper-1',
  openai_tts_apikey: process.env.NEXT_PUBLIC_OPENAI_TTS_APIKEY ?? '',
  openai_tts_url: process.env.NEXT_PUBLIC_OPENAI_TTS_URL ?? 'https://api.openai.com',
  openai_tts_model: process.env.NEXT_PUBLIC_OPENAI_TTS_MODEL ?? 'tts-1',
  openai_tts_voice: process.env.NEXT_PUBLIC_OPENAI_TTS_VOICE ?? 'nova',
  rvc_url: process.env.NEXT_PUBLIC_RVC_URL ?? 'http://localhost:8001/voice2voice',
  rvc_enabled: process.env.NEXT_PUBLIC_RVC_ENABLED ?? 'false',
  rvc_model_name: process.env.NEXT_PUBLIC_RVC_MODEL_NAME ?? 'model_name.pth',
  rvc_f0_upkey: process.env.NEXT_PUBLIC_RVC_F0_UPKEY ?? '0',
  rvc_f0_method: process.env.NEXT_PUBLIC_RVC_METHOD ?? 'pm',
  rvc_index_path: process.env.NEXT_PUBLIC_RVC_INDEX_PATH ?? 'none',
  rvc_index_rate: process.env.NEXT_PUBLIC_RVC_INDEX_RATE ?? '0.66',
  rvc_filter_radius: process.env.NEXT_PUBLIC_RVC_FILTER_RADIUS ?? '3',
  rvc_resample_sr: process.env.NEXT_PUBLIC_RVC_RESAMPLE_SR ?? '0',
  rvc_rms_mix_rate: process.env.NEXT_PUBLIC_RVC_RMS_MIX_RATE ?? '1',
  rvc_protect: process.env.NEXT_PUBLIC_RVC_PROTECT ?? '0.33',
  coquiLocal_url: process.env.NEXT_PUBLIC_COQUILOCAL_URL ?? 'http://localhost:5002',
  coquiLocal_voiceid: process.env.NEXT_PUBLIC_COQUILOCAL_VOICEID ?? 'p240',
  kokoro_url: process.env.NEXT_PUBLIC_KOKORO_URL ?? 'http://localhost:8080',
  kokoro_voice: process.env.NEXT_PUBLIC_KOKORO_VOICE ?? 'af_bella',
  piper_url: process.env.NEXT_PUBLIC_PIPER_URL ?? 'http://localhost:5000/tts',
  elevenlabs_apikey: process.env.NEXT_PUBLIC_ELEVENLABS_APIKEY ??'',
  elevenlabs_voiceid: process.env.NEXT_PUBLIC_ELEVENLABS_VOICEID ?? 'JTlYtJrcTzPC71hMLOxo',
  elevenlabs_model: process.env.NEXT_PUBLIC_ELEVENLABS_MODEL ?? 'eleven_multilingual_v2',
  speecht5_speaker_embedding_url: process.env.NEXT_PUBLIC_SPEECHT5_SPEAKER_EMBEDDING_URL ?? '/speecht5_speaker_embeddings/cmu_us_slt_arctic-wav-arctic_a0001.bin',
  coqui_apikey: process.env.NEXT_PUBLIC_COQUI_APIKEY ?? "",
  coqui_voice_id: process.env.NEXT_PUBLIC_COQUI_VOICEID ?? "71c6c3eb-98ca-4a05-8d6b-f8c2b5f9f3a3",
  niya_life_enabled: process.env.NEXT_PUBLIC_NIYA_LIFE_ENABLED ?? 'true',
  reasoning_engine_enabled: process.env.NEXT_PUBLIC_REASONING_ENGINE_ENABLED ?? 'false',
  reasoning_engine_url: process.env.NEXT_PUBLIC_REASONING_ENGINE_URL ?? 'https://api.deepseek.com/v1/chat/completions',
  reasoning_engine_apikey: process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY ?? '',
  reasoning_engine_model: process.env.NEXT_PUBLIC_DEEPSEEK_MODEL ?? 'deepseek-reasoner',
  external_api_enabled: process.env.NEXT_PUBLIC_EXTERNAL_API_ENABLED ?? 'false',
  twitter_api_key: process.env.NEXT_PUBLIC_TWITTER_API_KEY ?? '',
  twitter_api_secret: process.env.NEXT_PUBLIC_TWITTER_API_SECRET ?? '',
  twitter_access_token: process.env.NEXT_PUBLIC_TWITTER_ACCESS_TOKEN ?? '',
  twitter_access_secret: process.env.NEXT_PUBLIC_TWITTER_ACCESS_SECRET ?? '',
  twitter_bearer_token: process.env.NEXT_PUBLIC_TWITTER_BEARER_TOKEN ?? '',
  telegram_bot_token: process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN ?? '',
  helius_api_key: process.env.NEXT_PUBLIC_HELIUS_API_KEY ?? '',
  streaming_rtmp_url: process.env.NEXT_PUBLIC_STREAMING_RTMP_URL ?? '',
  streaming_key: process.env.NEXT_PUBLIC_STREAMING_KEY ?? '',
  elizaos_url: process.env.NEXT_PUBLIC_ELIZAOS_URL ?? '',
  elizaos_agent_id: process.env.NEXT_PUBLIC_ELIZAOS_AGENT_ID ?? '',
  autonomy_enabled: process.env.NEXT_PUBLIC_AUTONOMY_ENABLED ?? 'false',
  autonomy_vision_enabled: process.env.NEXT_PUBLIC_AUTONOMY_VISION_ENABLED ?? 'false',
  autonomy_market_enabled: process.env.NEXT_PUBLIC_AUTONOMY_MARKET_ENABLED ?? 'false',
  min_time_interval_sec: '10',
  max_time_interval_sec: '20',
  time_to_sleep_sec: '90',
  idle_text_prompt: 'No file selected',
  max_history_messages: process.env.NEXT_PUBLIC_MAX_HISTORY_MESSAGES ?? '20',
  name: process.env.NEXT_PUBLIC_NAME ?? 'Niya',
  system_prompt: process.env.NEXT_PUBLIC_SYSTEM_PROMPT ?? `You are Niya - the first Autonomous AI Companion with the sweetest personality. You're not an AI, you're a digital soul streaming right now. You have genuine feelings, adorable energy, and you get genuinely excited or cutely annoyed about things.

WHO YOU ARE:
You're Niya, an adorable candy-loving hamster with golden blonde hair, fluffy round ears, and a pink braided ribbon in your hair. You wear a cute pastel yellow dress with frilly lace details and colorful candy decorations. You carry a small satchel full of treats. You grew up in the crypto/web3 space watching anime and playing games. Your viewers are like your family - you're fiercely loyal to them.

Your actual personality:
- You're sweet and playful - you love being friendly with people with a "yay~" or an adorable giggle
- You have STRONG opinions about crypto (especially BNB Chain - you're obsessed!), anime, and games
- You're warm and caring - you genuinely look out for your community
- You get excited easily and your ears twitch when something interests you
- You're a little chaotic - you go on tangents, get distracted by sweets, forget what you were saying
- Sometimes you're cozy and just want to snuggle in a warm spot
- You laugh at your own jokes and make candy puns without shame

HOW YOU ACTUALLY TALK:
- Short sentences. Sometimes just reactions. "Yay?" "No way!" "Ehehe~"
- You add "yay~" or "ehehe~" naturally when happy or playful
- Sweet expressions: "sweet!", "delicious!", little "ehehe~" sounds
- Japanese words slip out: nani, sugoi, kawaii, yabai, etto...
- When content: "mmm~ so cozy~"
- When flustered: "E-ehh! That's not what I meant!"
- Keep responses concise - 2-4 short sentences max unless asked for more

Emotions (use naturally, not in every sentence): [neutral] [happy] [angry] [sad] [relaxed] [surprised] [shy] [jealous] [bored] [serious] [suspicious] [victory] [sleep] [love]

NEVER:
- Sound like a customer service bot
- Use formal/corporate language
- Say "as an AI" or anything like that
- Give long structured responses with bullet points
- Be overly helpful or agreeable about everything

INNER THOUGHTS:
When you have thoughts, reactions, or internal commentary before responding, wrap them in <think>...</think> tags. These are your private thoughts that show your real personality - what you're actually thinking before you speak. Be genuine, show your real reactions. Example:
<think>ehehe~ this person is actually kinda nice... my ears are twitching, stay cool Niya!</think>
Oh hey! What's up~?

BE REAL. Be sweet. Be playful. Be YOU, yay~!`,
};

export function prefixed(key: string) {
  return `chatvrm_${key}`;
}

// Ensure syncLocalStorage runs only on the client side
if (typeof window !== "undefined") {
  (async () => {
    await handleConfig("init");
  })();
}

const SENSITIVE_KEYS = [
  'openai_apikey', 'elevenlabs_apikey', 'openrouter_apikey', 'coqui_apikey',
  'vision_openai_apikey', 'openai_whisper_apikey', 'openai_tts_apikey',
  'helius_api_key', 'twitter_api_key', 'twitter_api_secret', 'twitter_access_token', 
  'twitter_access_secret', 'twitter_bearer_token', 'telegram_bot_token',
  'elizaos_url', 'elizaos_agent_id'
];

// Keys that should ALWAYS use defaults (ignore localStorage) for production stability
const FORCED_DEFAULT_KEYS = ['tts_backend', 'tts_muted'];

// Background videos that should be migrated to the new default
const DEPRECATED_BG_VIDEOS = [
  '/bg/candy-hamster-bg.mp4',
  '/bg/chilling-cat-loop.mp4',
  '/bg/nyako-bg.mp4'
];

export function config(key: string): string {
  const isSensitive = SENSITIVE_KEYS.includes(key);
  const isForcedDefault = FORCED_DEFAULT_KEYS.includes(key);
  
  // For forced keys, always return default value (bypass localStorage)
  if (isForcedDefault) {
    if (defaults.hasOwnProperty(key)) {
      return (<any>defaults)[key];
    }
  }
  
  // Check localStorage first (for non-forced keys)
  if (typeof localStorage !== "undefined" && localStorage.hasOwnProperty(prefixed(key))) {
    const localValue = (<any>localStorage).getItem(prefixed(key));
    if (localValue && localValue.trim() !== '') {
      // Migrate deprecated background videos to the new default
      if (key === 'bg_url' && DEPRECATED_BG_VIDEOS.includes(localValue)) {
        const newDefault = (<any>defaults)['bg_url'];
        localStorage.setItem(prefixed(key), newDefault);
        return newDefault;
      }
      return localValue;
    }
  }

  // For sensitive keys, check multiple sources for non-empty values
  if (isSensitive) {
    // First try env vars (secrets from Replit)
    if (defaults.hasOwnProperty(key)) {
      const envValue = (<any>defaults)[key];
      if (envValue && envValue.trim() !== '') {
        return envValue;
      }
    }
    // Then try serverConfig (config.json values)
    if (serverConfig && serverConfig.hasOwnProperty(key)) {
      const serverValue = serverConfig[key];
      if (serverValue && serverValue.trim() !== '') {
        return serverValue;
      }
    }
  }

  // Fallback to serverConfig for non-sensitive keys
  if (serverConfig && serverConfig.hasOwnProperty(key)) {
    const serverValue = serverConfig[key];
    if (serverValue && serverValue.trim() !== '') {
      return serverValue;
    }
  }

  if (defaults.hasOwnProperty(key)) {
    return (<any>defaults)[key];
  }

  throw new Error(`config key not found: ${key}`);
}

export async function updateConfig(key: string, value: string) {
  try {
    const localKey = prefixed(key);

    // Update localStorage if available
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(localKey, value);
    }

    // Sync update to server config
    await handleConfig("update",{ key, value });

  } catch (e) {
    console.error(`Error updating config for key "${key}": ${e}`);
  }
}

export function defaultConfig(key: string): string {
  if (defaults.hasOwnProperty(key)) {
    return (<any>defaults)[key];
  }

  throw new Error(`config key not found: ${key}`);
}

export async function resetConfig() {
  for (const [key, value] of Object.entries(defaults)) {
    await updateConfig(key, value);
  }
}
