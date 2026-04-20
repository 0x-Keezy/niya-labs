import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../../../../server/storage';
import { TwitterApi } from 'twitter-api-v2';
import { timingSafeEqualStr } from '@/features/auth/timingSafeEqual';
import { verifyAdminSession } from '@/features/auth/adminSession';

interface ApproveResponse {
  success: boolean;
  data?: any;
  error?: string;
}

const ADMIN_AUTH_HEADER = 'x-admin-auth';
const MIN_POST_INTERVAL_MS = 60000;
const RATE_LIMIT_IDENTIFIER = 'x_tweet_post';
const RATE_LIMIT_ENDPOINT = 'approve';

function isAdminAuthorized(req: NextApiRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('[X Approve API] ADMIN_SECRET not configured');
    return false;
  }
  const authHeader = req.headers[ADMIN_AUTH_HEADER];
  // Constant-time compare — prevents timing-based recovery of ADMIN_SECRET.
  return timingSafeEqualStr(
    typeof authHeader === 'string' ? authHeader : null,
    adminSecret,
  );
}

function getTwitterClient(): TwitterApi | null {
  const appKey = process.env.TWITTER_API_KEY;
  const appSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    return null;
  }

  return new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApproveResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Phase 1.2 — cookie-first, legacy x-admin-auth header as fallback.
  const sessionValid = await verifyAdminSession(req);
  if (!sessionValid && !isAdminAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized - Admin access required' });
  }

  const { id } = req.query;
  const draftId = parseInt(id as string, 10);

  if (isNaN(draftId)) {
    return res.status(400).json({ success: false, error: 'Invalid draft ID' });
  }

  try {
    const draft = await storage.getDraft(draftId);
    if (!draft) {
      return res.status(404).json({ success: false, error: 'Draft not found' });
    }

    if (draft.status !== 'draft') {
      return res.status(400).json({ 
        success: false, 
        error: `Cannot approve draft with status: ${draft.status}` 
      });
    }

    const rateLimit = await storage.checkRateLimit(
      RATE_LIMIT_IDENTIFIER, 
      RATE_LIMIT_ENDPOINT, 
      MIN_POST_INTERVAL_MS, 
      1
    );

    if (!rateLimit.allowed) {
      const waitTime = Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000);
      return res.status(429).json({ 
        success: false, 
        error: `Rate limit: Please wait ${Math.max(1, waitTime)} seconds before posting again` 
      });
    }

    const twitterClient = getTwitterClient();
    if (!twitterClient) {
      await storage.updateDraftStatus(draftId, 'failed', undefined, 'Twitter credentials not configured');
      return res.status(500).json({ 
        success: false, 
        error: 'Twitter API credentials not configured' 
      });
    }

    const tweetOptions: { text: string; reply?: { in_reply_to_tweet_id: string } } = {
      text: draft.text
    };

    if (draft.replyToTweetId) {
      tweetOptions.reply = { in_reply_to_tweet_id: draft.replyToTweetId };
    }

    const response = await twitterClient.v2.tweet(tweetOptions.text, 
      draft.replyToTweetId ? { reply: { in_reply_to_tweet_id: draft.replyToTweetId } } : undefined
    );

    await storage.recordRateLimit(RATE_LIMIT_IDENTIFIER, RATE_LIMIT_ENDPOINT, MIN_POST_INTERVAL_MS);

    const updatedDraft = await storage.updateDraftStatus(
      draftId, 
      'posted', 
      response.data.id
    );

    console.log(`[X Approve API] Tweet posted successfully: ${response.data.id}`);

    return res.status(200).json({ 
      success: true, 
      data: { 
        draft: updatedDraft,
        tweetId: response.data.id,
        tweetUrl: `https://x.com/i/web/status/${response.data.id}`
      } 
    });

  } catch (error) {
    console.error('[X Approve API] Error:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await storage.updateDraftStatus(draftId, 'failed', undefined, errorMessage);

    return res.status(500).json({ 
      success: false, 
      error: `Failed to post tweet: ${errorMessage}` 
    });
  }
}
