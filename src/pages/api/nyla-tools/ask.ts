import type { NextApiRequest, NextApiResponse } from "next";
import { handleCors } from "@/features/liveShow/cors";
import { enforceRateLimit } from "@/features/auth/rateLimit";
import {
  chatCompletion,
  isAllowedDGridModel,
  resolveLLMConfig,
} from "@/features/llm/dgrid";

/* ------------------------------------------------------------------ */
/*  In-memory cache                                                    */
/* ------------------------------------------------------------------ */
interface CacheEntry {
  answer: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface RequestBody {
  question?: unknown;
  ca?: unknown;
  context?: unknown;
  /** Optional DGrid model override (validated against the allow-list). */
  model?: unknown;
}

interface SuccessResponse {
  answer: string;
  cached: boolean;
  /** Provider that actually answered, surfaced so the UI can label it. */
  provider: "dgrid" | "xai";
  /** Resolved model ID — may differ from the one the client requested. */
  model: string;
}

interface ErrorResponse {
  error: string;
}

/* ------------------------------------------------------------------ */
/*  System prompt                                                      */
/* ------------------------------------------------------------------ */
const SYSTEM_PROMPT = `You are Niya, a memecoin analysis companion for BNB Chain.
The user is asking a question about a specific token they are evaluating.
Answer concisely in 2-4 sentences using the context data provided.
Be neutral and factual. Use specific numbers from the context when available.
Never use "buy", "sell", "support", "resistance", "fibonacci", "entry", "target", or "stop".
Never give financial advice. Say "I can't advise on that" if asked for buy/sell recommendations.
Use "floor" instead of "support" and "ceiling" instead of "resistance".
Keep it under 150 words.`;

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SuccessResponse | ErrorResponse>,
) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 20 questions / minute / IP. Each hit burns Grok quota.
  const rl = await enforceRateLimit(req, res, {
    endpoint: "nyla-tools/ask",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) return;

  // --- input validation ---
  const body = (req.body ?? {}) as RequestBody;
  if (typeof body.question !== "string" || body.question.trim() === "") {
    return res.status(400).json({ error: "Missing question" });
  }

  const question = body.question.trim();
  const ca =
    typeof body.ca === "string" && ADDRESS_REGEX.test(body.ca)
      ? body.ca.toLowerCase()
      : null;
  const context =
    body.context && typeof body.context === "object" ? body.context : null;
  // Validated inside resolveLLMConfig — unknown / spoofed model IDs are
  // silently ignored and replaced with the env default.
  const requestedModel = isAllowedDGridModel(body.model)
    ? (body.model as string)
    : undefined;

  // --- resolve provider (DGrid when configured, legacy xAI otherwise) ---
  const cfg = resolveLLMConfig({ requestedModel });
  if (!cfg) {
    console.error(
      "[API] nyla-tools/ask no LLM configured (set DGRID_API_KEY or XAI_API_KEY)",
    );
    return res.status(503).json({ error: "Ask backend not configured" });
  }

  // --- cache lookup ---
  // Include model in the cache key so swapping models shows a fresh answer.
  const cacheKey = `${cfg.model}:${ca ?? "none"}:${question.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.status(200).json({
      answer: cached.answer,
      cached: true,
      provider: cfg.provider,
      model: cfg.model,
    });
  }
  if (cached) cache.delete(cacheKey);

  // --- call LLM (DGrid or xAI) ---
  const userPrompt = JSON.stringify({
    question,
    ...(ca ? { ca } : {}),
    ...(context ? { tokenData: context } : {}),
  });

  const { content: answer } = await chatCompletion(cfg, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 300,
    temperature: 0.5,
  });

  if (!answer) {
    return res.status(502).json({ error: "Answer generation failed" });
  }

  // --- cache write ---
  cache.set(cacheKey, { answer, expiresAt: Date.now() + CACHE_TTL_MS });

  return res.status(200).json({
    answer,
    cached: false,
    provider: cfg.provider,
    model: cfg.model,
  });
}
