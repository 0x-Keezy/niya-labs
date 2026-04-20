import type { NextApiRequest } from "next";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../../../server/db";
import { adminSessions } from "../../../shared/schema";

/**
 * Admin session helpers. The browser holds an opaque token in an HttpOnly
 * cookie; we store only its HMAC hash in Postgres. An attacker who dumps the
 * DB cannot forge a live session without also knowing `SESSION_SECRET`, and
 * an attacker who can read arbitrary cookies via XSS... well, HttpOnly means
 * they can't. That's the whole point of this swap.
 */

export const ADMIN_SESSION_COOKIE = "niya_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

/** Generate a fresh 32-byte random token, hex-encoded. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * HMAC-hash a raw token with SESSION_SECRET. The hash is what we persist and
 * what we compare against on every request. Using HMAC (not a plain digest)
 * means a DB dump alone is useless without the secret.
 */
export function hashSessionToken(token: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not configured");
  }
  return createHmac("sha256", secret).update(token).digest("hex");
}

/**
 * Constant-time comparison of two hex strings of equal length. We don't
 * strictly need this for the HMAC compare (the DB lookup already hides
 * timing), but it's cheap and keeps the defense-in-depth story clean.
 */
function constantTimeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** Parse a single cookie value out of the raw Cookie header. */
function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  const parts = header.split(";");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    if (k === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

/**
 * Verify the incoming admin session cookie. Returns true iff the cookie
 * carries a token whose HMAC hash exists in `admin_sessions` and has not
 * expired. Zero network calls outside the DB.
 */
export async function verifyAdminSession(req: NextApiRequest): Promise<boolean> {
  const token = readCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
  if (!token || token.length !== 64) return false;

  let expectedHash: string;
  try {
    expectedHash = hashSessionToken(token);
  } catch {
    // SESSION_SECRET missing — treat as auth failure rather than 500-ing
    // every downstream endpoint.
    return false;
  }

  try {
    const rows = await db
      .select()
      .from(adminSessions)
      .where(
        and(
          eq(adminSessions.tokenHash, expectedHash),
          gt(adminSessions.expiresAt, new Date()),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row) return false;
    // Extra belt-and-braces: ensure the stored hash matches in constant time.
    return constantTimeHexEqual(row.tokenHash, expectedHash);
  } catch (e) {
    console.warn(
      "[adminSession] DB lookup failed; denying session:",
      (e as Error)?.message ?? e,
    );
    return false;
  }
}

/** Persist a freshly minted session. Returns the DB row's expiresAt. */
export async function persistSession(tokenHash: string, ttlSeconds: number): Promise<Date> {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await db.insert(adminSessions).values({ tokenHash, expiresAt });
  return expiresAt;
}

/** Invalidate the session whose cookie is on the request, if any. */
export async function destroySessionFromRequest(req: NextApiRequest): Promise<void> {
  const token = readCookie(req.headers.cookie, ADMIN_SESSION_COOKIE);
  if (!token || token.length !== 64) return;
  let hash: string;
  try {
    hash = hashSessionToken(token);
  } catch {
    return;
  }
  try {
    await db.delete(adminSessions).where(eq(adminSessions.tokenHash, hash));
  } catch (e) {
    console.warn(
      "[adminSession] Failed to delete session row:",
      (e as Error)?.message ?? e,
    );
  }
}

/** Build the Set-Cookie header string for a new session. */
export function buildSessionCookie(token: string, maxAgeSeconds: number): string {
  const attrs = [
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
  ];
  return attrs.join("; ");
}

/** Build the Set-Cookie header string that clears the session cookie. */
export function buildClearSessionCookie(): string {
  const attrs = [
    `${ADMIN_SESSION_COOKIE}=`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=0",
  ];
  return attrs.join("; ");
}
