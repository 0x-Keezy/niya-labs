import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqualStr } from "@/features/auth/timingSafeEqual";
import { enforceRateLimit } from "@/features/auth/rateLimit";
import {
  ADMIN_SESSION_TTL_SECONDS,
  buildClearSessionCookie,
  buildSessionCookie,
  destroySessionFromRequest,
  generateSessionToken,
  hashSessionToken,
  persistSession,
} from "@/features/auth/adminSession";

/**
 * /api/admin/session — login/logout for the admin dashboard.
 *
 * POST { password } → validates against ADMIN_PASSWORD, mints a 32-byte
 *   random token, stores its HMAC hash in `admin_sessions`, and sets an
 *   HttpOnly+Secure+SameSite=Strict cookie carrying the raw token. The
 *   token is NEVER returned in the JSON body.
 * DELETE         → invalidates the session server-side and clears the cookie.
 *
 * This replaces the prior scheme where the admin UI stuffed the raw
 * ADMIN_PASSWORD into sessionStorage and sent it on every request, which
 * meant one stored-XSS was total compromise.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === "POST") {
    return handleLogin(req, res);
  }
  if (req.method === "DELETE") {
    return handleLogout(req, res);
  }
  res.setHeader("Allow", "POST, DELETE");
  return res.status(405).json({ error: "Method not allowed" });
}

async function handleLogin(req: NextApiRequest, res: NextApiResponse) {
  // 5 attempts/min/IP — matches the rest of the admin surface and makes
  // online brute-force of ADMIN_PASSWORD economically uninteresting.
  const rl = await enforceRateLimit(req, res, {
    endpoint: "admin-session",
    limit: 5,
    windowMs: 60_000,
  });
  if (!rl.allowed) return;

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("[admin/session] ADMIN_PASSWORD is not configured");
    return res
      .status(500)
      .json({ success: false, error: "Admin authentication not configured" });
  }
  if (!process.env.SESSION_SECRET) {
    console.error("[admin/session] SESSION_SECRET is not configured");
    return res
      .status(500)
      .json({ success: false, error: "Session secret not configured" });
  }

  const body = req.body ?? {};
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return res
      .status(400)
      .json({ success: false, error: "Password required" });
  }

  const isValid = timingSafeEqualStr(password, adminPassword);
  if (!isValid) {
    return res
      .status(401)
      .json({ success: false, error: "Invalid password" });
  }

  try {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    await persistSession(tokenHash, ADMIN_SESSION_TTL_SECONDS);
    res.setHeader(
      "Set-Cookie",
      buildSessionCookie(token, ADMIN_SESSION_TTL_SECONDS),
    );
    // Deliberately do NOT echo the token in the JSON body. The whole point
    // of the cookie is that JavaScript never sees it.
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error("[admin/session] Failed to persist session:", e);
    return res
      .status(500)
      .json({ success: false, error: "Failed to create session" });
  }
}

async function handleLogout(req: NextApiRequest, res: NextApiResponse) {
  try {
    await destroySessionFromRequest(req);
  } catch (e) {
    console.warn("[admin/session] Logout cleanup failed:", e);
  }
  res.setHeader("Set-Cookie", buildClearSessionCookie());
  return res.status(200).json({ success: true });
}
