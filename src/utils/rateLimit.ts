import type { NextApiRequest, NextApiResponse, NextApiHandler } from 'next';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore: Map<string, RateLimitEntry> = new Map();

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 60 }
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const key = identifier;

  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
  }

  entry.count++;
  
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const resetIn = Math.max(0, entry.resetTime - now);

  if (entry.count > config.maxRequests) {
    return { allowed: false, remaining: 0, resetIn };
  }

  return { allowed: true, remaining, resetIn };
}

export function getClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
  }
  return req.socket?.remoteAddress || 'unknown';
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export function withRateLimit(
  handler: NextApiHandler,
  config: RateLimitConfig = { windowMs: 60000, maxRequests: 60 }
): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const clientIP = getClientIP(req);
    const endpoint = req.url || 'unknown';
    const identifier = `${clientIP}:${endpoint}`;

    const result = checkRateLimit(identifier, config);

    res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetIn / 1000).toString());

    if (!result.allowed) {
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil(result.resetIn / 1000),
      });
    }

    return handler(req, res);
  };
}

export const RATE_LIMIT_CONFIGS = {
  chat: { windowMs: 60000, maxRequests: 30 },
  tts: { windowMs: 60000, maxRequests: 20 },
  api: { windowMs: 60000, maxRequests: 100 },
  strict: { windowMs: 60000, maxRequests: 10 },
};
