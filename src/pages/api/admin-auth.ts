/**
 * LEGACY admin auth endpoint.
 *
 * @deprecated Prefer `/api/admin/session` — it issues an HttpOnly
 *   signed session cookie that cannot be exfiltrated via XSS and is
 *   DB-persisted for clean server-side revocation. This endpoint is
 *   kept so `src/components/settings.tsx` keeps working; migrate
 *   the settings page to the session flow in v0.2 and delete this
 *   file.
 *
 * Security posture while it exists:
 *  - Rate limit: 5 attempts / minute / IP (matches /api/admin/session)
 *  - Returns 401 on invalid (proper auth semantics vs the previous
 *    `200 { success: false }`, which leaked password-validity via
 *    response body at the 200 level)
 *  - Adds a `Deprecation` response header so new callers know to
 *    stop using it
 *  - Constant-time compare
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqualStr } from '@/features/auth/timingSafeEqual';
import { enforceRateLimit } from '@/features/auth/rateLimit';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Link', '</api/admin/session>; rel="successor-version"');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Tightened from 10 → 5 attempts / minute / IP to match the modern
  // /api/admin/session rate-limit. Combined with the constant-time
  // compare below, this keeps the brute-force window impractical.
  const rl = await enforceRateLimit(req, res, {
    endpoint: 'admin-auth',
    limit: 5,
    windowMs: 60_000,
  });
  if (!rl.allowed) return;

  try {
    if (!ADMIN_PASSWORD) {
      console.error('ADMIN_PASSWORD environment variable not configured');
      return res.status(500).json({ error: 'Admin authentication not configured' });
    }

    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password required' });
    }

    const isValid = timingSafeEqualStr(password, ADMIN_PASSWORD);

    if (!isValid) {
      // Proper 401 instead of 200 { success: false }. Still does NOT
      // leak whether the password format was correct vs simply wrong —
      // both paths end up here with the same shape.
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
      });
    }

    // Preserved shape for backward compat with the existing settings.tsx
    // caller that reads `data.success`. Once the caller migrates to
    // /api/admin/session, delete this file entirely.
    return res.status(200).json({ success: true, error: null });
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
