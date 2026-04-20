import type { NextApiRequest, NextApiResponse } from "next";
import { handleCors } from "@/features/liveShow/cors";
import { enforceRateLimit } from "@/features/auth/rateLimit";
import { resolveLLMConfig } from "@/features/llm/dgrid";

/**
 * Server-side proxy for the Niya Companion (VTuber) chat stream.
 *
 * Purpose:
 *   The browser-side adapter (`src/features/chat/dgridChat.ts`) used to call
 *   DGrid directly using a `NEXT_PUBLIC_DGRID_APIKEY` that Next.js inlined
 *   into the browser bundle. That key could be scraped from DevTools by any
 *   visitor, burning our credits. This endpoint moves the API call server-side
 *   so the key stays in `process.env.DGRID_API_KEY` and never reaches the wire.
 *
 * Contract:
 *   POST `{ messages: [{role, content}], stream?: boolean }`
 *   Responds with an OpenAI-compatible SSE stream — `data: {json}\n\n` chunks
 *   and a terminal `data: [DONE]\n\n`. The client-side parser in `dgridChat.ts`
 *   already understands this format, so nothing changes for the VRM/UI layer.
 *
 * Streaming approach:
 *   We pipe the raw upstream bytes straight through to the NextApiResponse
 *   (`res.write(chunk)`). No buffering, no re-encoding — the upstream already
 *   emits OpenAI-compatible SSE and our client already parses that shape.
 *   This preserves streaming latency and keeps the proxy stateless.
 */

interface IncomingMessage {
  role?: unknown;
  content?: unknown;
}

interface RequestBody {
  messages?: unknown;
  stream?: unknown;
}

// Hard caps on request size. These exist to make the endpoint cheap to DoS
// against and to keep a runaway client from filling a GPU inference window.
const MAX_MESSAGES = 50;
const MAX_CONTENT_CHARS = 4000;
const MAX_TOTAL_CHARS = 20000;

const ALLOWED_ROLES = new Set(["system", "user", "assistant"]);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (handleCors(req, res)) return;

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // 20 msgs / minute / IP. Each hit burns DGrid quota so we keep this tight.
  const rl = await enforceRateLimit(req, res, {
    endpoint: "companion/chat",
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) return;

  // --- input validation ---
  const body = (req.body ?? {}) as RequestBody;
  if (!Array.isArray(body.messages)) {
    return res.status(400).json({ error: "messages must be an array" });
  }

  const rawMessages = body.messages as IncomingMessage[];
  if (rawMessages.length === 0) {
    return res.status(400).json({ error: "messages must not be empty" });
  }
  if (rawMessages.length > MAX_MESSAGES) {
    return res
      .status(400)
      .json({ error: `messages exceeds limit of ${MAX_MESSAGES}` });
  }

  const sanitised: { role: string; content: string }[] = [];
  let totalChars = 0;
  for (const m of rawMessages) {
    if (
      !m ||
      typeof m.role !== "string" ||
      typeof m.content !== "string" ||
      !ALLOWED_ROLES.has(m.role)
    ) {
      return res.status(400).json({ error: "invalid message shape" });
    }
    if (m.content.length > MAX_CONTENT_CHARS) {
      return res
        .status(400)
        .json({ error: `message exceeds ${MAX_CONTENT_CHARS} chars` });
    }
    totalChars += m.content.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return res
        .status(400)
        .json({ error: `total message size exceeds ${MAX_TOTAL_CHARS} chars` });
    }
    sanitised.push({ role: m.role, content: m.content });
  }

  // --- resolve provider (DGrid preferred, xAI fallback) ---
  const cfg = resolveLLMConfig();
  if (!cfg) {
    console.error(
      "[API] companion/chat no LLM configured (set DGRID_API_KEY or XAI_API_KEY)",
    );
    return res.status(503).json({ error: "Companion backend not configured" });
  }

  // --- call upstream ---
  let upstream: Response;
  try {
    upstream = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
        // Attribution headers — harmless on DGrid, helpful on OpenRouter-style
        // gateways that forward them upstream.
        "HTTP-Referer": "https://niyaagent.com",
        "X-Title": "Niya AI Companion",
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: sanitised,
        stream: true,
      }),
    });
  } catch (err: any) {
    console.error(
      `[API] companion/chat upstream fetch failed (${cfg.provider}): ${err?.message}`,
    );
    return res.status(502).json({ error: "Upstream request failed" });
  }

  if (!upstream.ok || !upstream.body) {
    let msg = `Upstream returned ${upstream.status}`;
    try {
      const errJson = await upstream.json();
      if (errJson?.error?.message) msg = errJson.error.message;
    } catch {
      /* ignore — keep generic status message */
    }
    console.error(
      `[API] companion/chat upstream error (${cfg.provider}): ${msg}`,
    );
    return res.status(502).json({ error: msg });
  }

  // --- proxy the SSE stream byte-for-byte ---
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  // Nginx/CDNs buffer SSE by default; this header disables that.
  res.setHeader("X-Accel-Buffering", "no");
  // Flush headers immediately so the browser sees the stream open.
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder("utf-8");

  // If the client disconnects, cancel the upstream read so we stop burning
  // credits on bytes nobody will ever see.
  const abort = () => {
    reader.cancel().catch(() => {});
  };
  req.on("close", abort);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        res.write(decoder.decode(value, { stream: true }));
      }
    }
  } catch (err: any) {
    console.error(
      `[API] companion/chat stream error (${cfg.provider}): ${err?.message}`,
    );
  } finally {
    req.off("close", abort);
    try {
      reader.releaseLock();
    } catch {
      /* already released */
    }
    res.end();
  }
}
