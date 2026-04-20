import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqualStr } from '@/features/auth/timingSafeEqual';
import { enforceRateLimit } from '@/features/auth/rateLimit';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Slow down brute-force attempts: 10 attempts / minute / IP.
  const rl = await enforceRateLimit(req, res, {
    endpoint: 'admin-auth',
    limit: 10,
    windowMs: 60_000,
  });
  if (!rl.allowed) return;

  try {
    // Require ADMIN_PASSWORD to be configured
    if (!ADMIN_PASSWORD) {
      console.error('ADMIN_PASSWORD environment variable not configured');
      return res.status(500).json({ error: 'Admin authentication not configured' });
    }

    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password required' });
    }

    // Constant-time comparison to block timing-based recovery of the secret.
    const isValid = timingSafeEqualStr(password, ADMIN_PASSWORD);

    return res.status(200).json({
      success: isValid,
      error: isValid ? null : 'Invalid password'
    });
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
}
