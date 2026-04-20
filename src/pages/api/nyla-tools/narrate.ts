import type { NextApiRequest, NextApiResponse } from "next";
import { handleCors } from "@/features/liveShow/cors";
import { enforceRateLimit } from "@/features/auth/rateLimit";
import { chatCompletion, resolveLLMConfig } from "@/features/llm/dgrid";

/* ------------------------------------------------------------------ */
/*  In-memory cache (no DB table needed)                               */
/* ------------------------------------------------------------------ */
interface CacheEntry {
  narration: string;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface NarrateData {
  rugRiskScore?: unknown;
  riskHeadline?: unknown;
  top10EffectiveShare?: unknown;
  topHolderShare?: unknown;
  lpLocked?: unknown;
  lpLockedShare?: unknown;
  lockProvider?: unknown;
  sniperCount?: unknown;
  sniperSharePct?: unknown;
  tokenAgeDays?: unknown;
  totalHolders?: unknown;
}

interface RequestBody {
  ca?: unknown;
  symbol?: unknown;
  data?: NarrateData;
}

interface SuccessResponse {
  narration: string;
  cached: boolean;
  /** Provider that actually generated the narration (for UI attribution). */
  provider: "dgrid" | "xai";
  /** Resolved model ID (e.g. "openai/gpt-4o-mini"). */
  model: string;
}

interface ErrorResponse {
  error: string;
}

/* ------------------------------------------------------------------ */
/*  System prompt                                                      */
/* ------------------------------------------------------------------ */
const SYSTEM_PROMPT = `You are Niya, a memecoin analysis companion for BNB Chain.
Given the structured on-chain data below, write 2-3 sentences in plain English.
Be neutral and factual. Use specific numbers from the data.
Never use "buy", "sell", "support", "resistance", "fibonacci", "entry", "target", or "stop".
Never give financial advice. Use "floor" instead of "support" and "ceiling" instead of "resistance".
Keep it under 120 words.`;

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

  // 30 narrations / minute / IP. Each hit burns Grok quota.
  const rl = await enforceRateLimit(req, res, {
    endpoint: "nyla-tools/narrate",
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) return;

  // --- input validation ---
  const body = (req.body ?? {}) as RequestBody;
  if (typeof body.ca !== "string" || !ADDRESS_REGEX.test(body.ca)) {
    return res.status(400).json({ error: "Invalid contract address" });
  }
  if (typeof body.symbol !== "string" || body.symbol.trim() === "") {
    return res.status(400).json({ error: "Missing symbol" });
  }
  if (!body.data || typeof body.data !== "object") {
    return res.status(400).json({ error: "Missing data object" });
  }

  const ca = body.ca.toLowerCase();
  const symbol = body.symbol.trim();
  const data = body.data;

  // --- resolve provider (DGrid when configured, legacy xAI otherwise) ---
  // Narrate endpoint intentionally does NOT accept a model override from the
  // browser — the narration is a background summary users don't interact with,
  // so it always uses the server's default model for cache efficiency.
  const cfg = resolveLLMConfig();
  if (!cfg) {
    console.error(
      "[API] nyla-tools/narrate no LLM configured (set DGRID_API_KEY or XAI_API_KEY)",
    );
    return res.status(503).json({ error: "Narration backend not configured" });
  }

  // --- cache lookup ---
  // Cache key includes the model so swapping providers regenerates once.
  const cacheKey = `${cfg.model}:${ca}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return res.status(200).json({
      narration: cached.narration,
      cached: true,
      provider: cfg.provider,
      model: cfg.model,
    });
  }

  // Evict stale entry if present
  if (cached) {
    cache.delete(cacheKey);
  }

  // --- call LLM (DGrid or xAI) ---
  const userPrompt = JSON.stringify({ symbol, ...data });

  const { content: narration } = await chatCompletion(cfg, {
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    maxTokens: 200,
    temperature: 0.4,
  });

  if (!narration) {
    return res.status(502).json({ error: "Narration generation failed" });
  }

  // --- cache write ---
  cache.set(cacheKey, { narration, expiresAt: Date.now() + CACHE_TTL_MS });

  return res.status(200).json({
    narration,
    cached: false,
    provider: cfg.provider,
    model: cfg.model,
  });
}
