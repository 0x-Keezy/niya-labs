/**
 * CORS allowlist for Niya Labs API routes.
 *
 * Allowed origins are controlled by the `NIYA_CORS_ALLOWED_ORIGINS` env var.
 * Format: a comma-separated list of exact origins (scheme + host + optional
 * port), e.g.
 *
 *     NIYA_CORS_ALLOWED_ORIGINS=https://niyaagent.com,https://www.niyaagent.com,http://localhost:5000
 *
 * When the env var is unset, a safe default allowlist is used:
 *   - http://localhost:5000
 *   - http://127.0.0.1:5000
 *   - https://niyaagent.com
 *   - https://www.niyaagent.com
 *
 * Security notes:
 *   - Exact-match only. Wildcards and arbitrary subdomains (e.g. `*.replit.dev`)
 *     are NOT supported — those previously-allowed patterns matched attacker-
 *     controlled subdomains and have been removed.
 *   - In production (`NODE_ENV === 'production'`) any non-HTTPS origin is
 *     rejected regardless of whether it appears in the allowlist.
 *   - For localhost dev, only port 5000 is accepted (both `localhost` and
 *     `127.0.0.1`). Other ports are rejected.
 */

import type { NextApiRequest, NextApiResponse } from "next";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "https://niyaagent.com",
  "https://www.niyaagent.com",
];

function getAllowedOrigins(): string[] {
  const fromEnv = process.env.NIYA_CORS_ALLOWED_ORIGINS;
  if (!fromEnv || fromEnv.trim().length === 0) {
    return DEFAULT_ALLOWED_ORIGINS;
  }
  return fromEnv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isOriginAllowed(origin: string | undefined, host?: string): boolean {
  const allowed = getAllowedOrigins();
  const isProd = process.env.NODE_ENV === "production";

  if (!origin) {
    // No Origin header (same-origin or non-browser client). Fall back to host
    // matching against the allowlist so server-rendered calls still work.
    if (!host) return false;
    return allowed.some((a) => {
      try {
        const u = new URL(a);
        return u.host === host;
      } catch {
        return false;
      }
    });
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  // Reject any non-https origin in production.
  if (isProd && url.protocol !== "https:") {
    return false;
  }

  // Exact-match only against the allowlist. This enforces strict port matching
  // for localhost / 127.0.0.1 (only :5000 by default) and rejects any
  // attacker-controlled subdomain.
  return allowed.includes(origin);
}

export function setCorsHeaders(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin;
  const host = req.headers.host;

  if (isOriginAllowed(origin, host)) {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    } else if (host) {
      res.setHeader("Access-Control-Allow-Origin", `https://${host}`);
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-CSRF-Token",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}

export function handleCors(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return true;
  }

  return false;
}
