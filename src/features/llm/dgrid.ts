/**
 * DGrid AI Gateway — unified OpenAI-compatible access to 200+ LLMs.
 *
 * DGrid is a Web3-native AI Gateway (https://dgrid.ai) that routes requests
 * through a decentralised inference network and exposes every supported
 * provider behind a single OpenAI-compatible endpoint. Niya Labs uses it to
 * narrate rug-risk reports, answer free-text questions in the analyzer and
 * power the VTuber's conversation — all through one API key.
 *
 * Docs: https://docs.dgrid.ai/AI-Gateway-Integrations
 * Models: https://dgrid.ai/models
 *
 * Why we ship this wrapper:
 *   1. Keeps the DGrid base URL, env-var precedence and allow-list in ONE file
 *      (rather than scattered across `/api/nyla-tools/*` endpoints).
 *   2. Preserves the legacy xAI env-vars as a hard fallback so deployments
 *      without a DGRID_API_KEY continue to work unchanged.
 *   3. Gives the UI a single source of truth for the model picker.
 */

export const DGRID_BASE_URL = "https://api.dgrid.ai/v1";

/**
 * Curated allow-list shown in the "Ask Niya" model picker. Each entry MUST use
 * the DGrid `provider/model` naming convention — passing a free-form string
 * from the browser would let users spoof arbitrary models.
 *
 * Add new entries here as DGrid ships them. The order is the order the UI
 * renders them.
 */
export interface DGridModelOption {
  /** Value sent to the API (`provider/model`). */
  id: string;
  /** Short label shown in the dropdown. */
  label: string;
  /** One-line description for tooltips / a11y. */
  blurb: string;
  /** Provider badge shown next to the label. */
  provider: "xAI" | "OpenAI" | "Anthropic" | "Google" | "Qwen" | "DeepSeek";
}

export const DGRID_MODELS: DGridModelOption[] = [
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o mini",
    blurb: "Fast, cheap, reliable — Niya's default.",
    provider: "OpenAI",
  },
  {
    id: "xai/grok-3-mini",
    label: "Grok 3 mini",
    blurb: "xAI's lightweight model — same voice as Niya's legacy default.",
    provider: "xAI",
  },
  {
    id: "anthropic/claude-3-5-haiku-latest",
    label: "Claude 3.5 Haiku",
    blurb: "Anthropic's fast tier — strong structured reasoning.",
    provider: "Anthropic",
  },
  {
    id: "google/gemini-2.0-flash",
    label: "Gemini 2.0 Flash",
    blurb: "Google's low-latency model — great for narrations.",
    provider: "Google",
  },
  {
    id: "qwen/qwen-2.5-72b-instruct",
    label: "Qwen 2.5 72B",
    blurb: "Open-weight 72B — for users who prefer non-Western inference.",
    provider: "Qwen",
  },
  {
    id: "deepseek/deepseek-chat",
    label: "DeepSeek Chat",
    blurb: "DeepSeek's reasoning-tuned chat model.",
    provider: "DeepSeek",
  },
];

const DGRID_MODEL_IDS = new Set(DGRID_MODELS.map((m) => m.id));

/**
 * Returns true when the supplied string is an allow-listed DGrid model ID.
 * Used by API handlers to guard against arbitrary values submitted by the
 * browser.
 */
export function isAllowedDGridModel(id: unknown): id is string {
  return typeof id === "string" && DGRID_MODEL_IDS.has(id);
}

/**
 * Resolved LLM config — what the API handler should actually use when making
 * an outbound chat-completion call.
 */
export interface ResolvedLLMConfig {
  /** "dgrid" when DGrid creds are present, otherwise "xai". */
  provider: "dgrid" | "xai";
  /** Bearer token for the `Authorization` header. */
  apiKey: string;
  /** OpenAI-compatible base URL (no trailing slash). */
  baseUrl: string;
  /** Model identifier to place in the request body. */
  model: string;
}

/**
 * Figures out which LLM provider to call.
 *
 * Precedence:
 *   1. If `DGRID_API_KEY` is set, use DGrid — pick the requested model if it
 *      is in the allow-list, otherwise fall back to the env default.
 *   2. Otherwise fall back to the legacy xAI env vars.
 *
 * The function returns `null` if neither provider is configured, so the caller
 * can emit a 503 instead of crashing.
 */
export function resolveLLMConfig(opts?: {
  /** Optional override from the request body. */
  requestedModel?: string;
}): ResolvedLLMConfig | null {
  const dgridKey = process.env.DGRID_API_KEY;
  if (dgridKey) {
    const defaultModel =
      process.env.DGRID_MODEL?.trim() || "openai/gpt-4o-mini";
    const model = isAllowedDGridModel(opts?.requestedModel)
      ? (opts!.requestedModel as string)
      : defaultModel;
    return {
      provider: "dgrid",
      apiKey: dgridKey,
      baseUrl: DGRID_BASE_URL,
      model,
    };
  }

  // --- legacy xAI fallback (pre-DGrid deployments) ---
  const xaiKey =
    process.env.XAI_API_KEY ?? process.env.NEXT_PUBLIC_XAI_API_KEY;
  if (!xaiKey) return null;

  return {
    provider: "xai",
    apiKey: xaiKey,
    baseUrl:
      process.env.XAI_URL ??
      process.env.NEXT_PUBLIC_XAI_URL ??
      "https://api.x.ai/v1",
    model:
      process.env.XAI_MODEL ??
      process.env.NEXT_PUBLIC_XAI_MODEL ??
      "grok-3-mini-latest",
  };
}

/**
 * Minimal chat-completion shape understood by every OpenAI-compatible
 * provider (xAI, DGrid, OpenAI, OpenRouter, …).
 */
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionParams {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatCompletionResult {
  /** The assistant text, already trimmed. Empty string = upstream failure. */
  content: string;
  /** Provider label for logging / UI attribution. */
  provider: ResolvedLLMConfig["provider"];
  /** Model ID used — surface this in the UI so users know what answered. */
  model: string;
}

/**
 * POST a chat-completion request to the resolved provider. The function never
 * throws: callers inspect `.content === ""` to decide whether to return 502.
 */
export async function chatCompletion(
  cfg: ResolvedLLMConfig,
  params: ChatCompletionParams,
): Promise<ChatCompletionResult> {
  const body = {
    model: cfg.model,
    messages: params.messages,
    max_tokens: params.maxTokens ?? 300,
    temperature: params.temperature ?? 0.5,
  };

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown");
      console.error(
        `[LLM] ${cfg.provider}:${cfg.model} returned ${res.status}: ${errText.slice(0, 300)}`,
      );
      return { content: "", provider: cfg.provider, model: cfg.model };
    }

    const json = await res.json();
    const content: string =
      json?.choices?.[0]?.message?.content?.trim() ?? "";
    return { content, provider: cfg.provider, model: cfg.model };
  } catch (err: any) {
    console.error(
      `[LLM] ${cfg.provider}:${cfg.model} fetch error: ${err?.message}`,
    );
    return { content: "", provider: cfg.provider, model: cfg.model };
  }
}
