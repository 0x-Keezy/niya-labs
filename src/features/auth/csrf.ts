/**
 * CSRF token helper for Niya Labs admin endpoints.
 *
 * Usage:
 *   - On successful login, call `issueCsrfToken(res)` and return the token
 *     in the JSON response. The client stores it in memory (not localStorage)
 *     and sends it back on state-changing requests via the `X-CSRF-Token`
 *     header.
 *   - Guard any state-changing `/api/**` handler with:
 *
 *         if (!verifyCsrfToken(req)) {
 *           return res.status(403).json({ error: "csrf" });
 *         }
 *
 * NOTE: The admin session endpoint (`src/pages/api/admin/session.ts`) is
 * owned by another agent. That endpoint should call `issueCsrfToken(res)` on
 * successful login and return the token in JSON so the client can store it
 * in memory and send it via the `X-CSRF-Token` header on subsequent
 * state-changing admin requests.
 *
 * The cookie is deliberately NOT httpOnly — client JS must be able to read
 * it to echo the value in the header (double-submit cookie pattern). The
 * `SameSite=Strict` attribute is what stops cross-site attackers from
 * triggering the request with a valid cookie in the first place; the
 * header comparison is defence-in-depth.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { randomBytes } from "crypto";
import { timingSafeEqualStr } from "./timingSafeEqual";

const CSRF_COOKIE_NAME = "niya_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_MAX_AGE_SECONDS = 7200; // 2 hours

export function issueCsrfToken(res: NextApiResponse): string {
  const token = randomBytes(32).toString("hex");
  const cookie = [
    `${CSRF_COOKIE_NAME}=${token}`,
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${CSRF_MAX_AGE_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") {
    cookie.push("Secure");
  }
  res.setHeader("Set-Cookie", cookie.join("; "));
  return token;
}

function readCookie(
  req: NextApiRequest,
  name: string,
): string | undefined {
  const raw = req.headers.cookie;
  if (!raw) return undefined;
  const parts = raw.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      return rest.join("=");
    }
  }
  return undefined;
}

export function verifyCsrfToken(req: NextApiRequest): boolean {
  const cookieToken = readCookie(req, CSRF_COOKIE_NAME);
  const headerRaw = req.headers[CSRF_HEADER_NAME];
  const headerToken = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;

  if (!cookieToken || !headerToken) return false;
  return timingSafeEqualStr(cookieToken, headerToken);
}
