import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../../server/storage';
import { insertXDraftSchema } from '../../../../shared/schema';
import { timingSafeEqualStr } from '@/features/auth/timingSafeEqual';
import { verifyAdminSession } from '@/features/auth/adminSession';

interface DraftResponse {
  success: boolean;
  data?: any;
  error?: string;
}

const ADMIN_AUTH_HEADER = 'x-admin-auth';
const MAX_DRAFTS_PER_DAY = 50;
const MAX_TWEET_LENGTH = 280;
const DAY_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_IDENTIFIER = 'x_draft_create';
const RATE_LIMIT_ENDPOINT = 'daily';

function isAdminAuthorized(req: NextApiRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('[X Drafts API] ADMIN_SECRET not configured');
    return false;
  }
  const authHeader = req.headers[ADMIN_AUTH_HEADER];
  // Constant-time compare — prevents timing-based recovery of ADMIN_SECRET.
  return timingSafeEqualStr(
    typeof authHeader === 'string' ? authHeader : null,
    adminSecret,
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DraftResponse>
) {
  // Phase 1.2 — cookie-first, legacy x-admin-auth header as fallback.
  const sessionValid = await verifyAdminSession(req);
  if (!sessionValid && !isAdminAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized - Admin access required' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const { status, limit } = req.query;
        const limitNum = limit ? Math.min(parseInt(limit as string, 10), 100) : 50;
        const drafts = await storage.getDrafts(
          status as string | undefined,
          limitNum
        );
        return res.status(200).json({ success: true, data: { drafts } });
      }

      case 'POST': {
        const { text, replyToTweetId } = req.body;

        if (!text || typeof text !== 'string') {
          return res.status(400).json({ success: false, error: 'Text is required' });
        }

        if (text.length > MAX_TWEET_LENGTH) {
          return res.status(400).json({ 
            success: false, 
            error: `Text exceeds ${MAX_TWEET_LENGTH} characters (${text.length})` 
          });
        }

        const rateLimit = await storage.checkRateLimit(
          RATE_LIMIT_IDENTIFIER,
          RATE_LIMIT_ENDPOINT,
          DAY_MS,
          MAX_DRAFTS_PER_DAY
        );

        if (!rateLimit.allowed) {
          return res.status(429).json({ 
            success: false, 
            error: `Daily draft limit reached (${MAX_DRAFTS_PER_DAY}). Resets at ${rateLimit.resetAt.toLocaleTimeString()}` 
          });
        }

        const validatedData = insertXDraftSchema.parse({
          text: text.trim(),
          replyToTweetId: replyToTweetId || null,
          status: 'draft'
        });

        const draft = await storage.createDraft(validatedData);
        await storage.recordRateLimit(RATE_LIMIT_IDENTIFIER, RATE_LIMIT_ENDPOINT, DAY_MS);
        
        return res.status(201).json({ success: true, data: { draft } });
      }

      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[X Drafts API] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}
