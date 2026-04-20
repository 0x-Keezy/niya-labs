import { timingSafeEqual as cryptoTimingSafeEqual } from "crypto";

/**
 * Constant-time string comparison. Use this instead of `===` when comparing
 * passwords, API keys, or any secret against user-supplied input so that
 * attackers cannot recover the secret via timing side channels.
 *
 * Returns false (never throws) if either side is missing or if the values
 * have different lengths — `crypto.timingSafeEqual` requires equal-length
 * buffers, so we do the length check first (which is safe to leak since an
 * attacker controls their own input length anyway).
 */
export function timingSafeEqualStr(
  a: string | undefined | null,
  b: string | undefined | null,
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length === 0 || b.length === 0) return false;
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  try {
    return cryptoTimingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
