import type { NextApiRequest, NextApiResponse } from "next";
import { storage } from "../../../server/storage";

/**
 * Extract a stable identifier for rate-limiting.
 * Prefers the original client IP from `x-forwarded-for` (first hop), falls
 * back to the socket peer. Behind proxies, trust only the value set by our
 * own infra — if you deploy behind a CDN, put the CDN in front.
 */
export function clientIdentifier(req: NextApiRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    const first = fwd.split(",")[0].trim();
    if (first) return first;
  } else if (Array.isArray(fwd) && fwd.length > 0) {
    return fwd[0].split(",")[0].trim();
  }
  return req.socket?.remoteAddress ?? "unknown";
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Enforce a DB-backed rate limit on a request. Writes a 429 response and
 * returns `{ allowed: false }` when the caller has exceeded the quota.
 *
 * Usage:
 *   const rl = await enforceRateLimit(req, res, { endpoint: "tts", limit: 30, windowMs: 60_000 });
 *   if (!rl.allowed) return; // response already sent
 *
 * If the rate-limit DB is unavailable, the request is allowed (fail-open)
 * so an outage doesn't take down the whole app — but a warning is logged.
 */
export async function enforceRateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  opts: {
    endpoint: string;
    limit: number;
    windowMs: number;
    /** Optional override for the identifier (default: client IP) */
    identifier?: string;
  },
): Promise<RateLimitResult> {
  const { endpoint, limit, windowMs } = opts;
  const identifier = opts.identifier ?? clientIdentifier(req);

  let check: RateLimitResult;
  try {
    // Atomic check-and-increment inside a single DB transaction. Eliminates
    // the race between checkRateLimit + recordRateLimit under concurrency.
    check = await storage.checkAndConsumeRateLimit(
      identifier,
      endpoint,
      windowMs,
      limit,
    );
  } catch (e: any) {
    console.warn(
      `[rateLimit] DB check failed for ${endpoint} (${identifier}); failing open:`,
      e?.message ?? e,
    );
    return { allowed: true, remaining: limit, resetAt: new Date(Date.now() + windowMs) };
  }

  if (!check.allowed) {
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", "0");
    res.setHeader("X-RateLimit-Reset", String(Math.floor(check.resetAt.getTime() / 1000)));
    const retryAfter = Math.max(1, Math.ceil((check.resetAt.getTime() - Date.now()) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    res.status(429).json({ error: "Too many requests. Please slow down." });
    return check;
  }

  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(check.remaining));
  res.setHeader("X-RateLimit-Reset", String(Math.floor(check.resetAt.getTime() / 1000)));
  return check;
}
