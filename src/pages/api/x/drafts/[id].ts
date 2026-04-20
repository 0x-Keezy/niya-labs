import type { NextApiRequest, NextApiResponse } from 'next';
import { storage } from '../../../../../server/storage';
import { timingSafeEqualStr } from '@/features/auth/timingSafeEqual';
import { verifyAdminSession } from '@/features/auth/adminSession';

interface DraftResponse {
  success: boolean;
  data?: any;
  error?: string;
}

const ADMIN_AUTH_HEADER = 'x-admin-auth';

function isAdminAuthorized(req: NextApiRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('[X Draft API] ADMIN_SECRET not configured');
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

  const { id } = req.query;
  const draftId = parseInt(id as string, 10);

  if (isNaN(draftId)) {
    return res.status(400).json({ success: false, error: 'Invalid draft ID' });
  }

  try {
    switch (req.method) {
      case 'GET': {
        const draft = await storage.getDraft(draftId);
        if (!draft) {
          return res.status(404).json({ success: false, error: 'Draft not found' });
        }
        return res.status(200).json({ success: true, data: { draft } });
      }

      case 'DELETE': {
        const draft = await storage.getDraft(draftId);
        if (!draft) {
          return res.status(404).json({ success: false, error: 'Draft not found' });
        }
        await storage.deleteDraft(draftId);
        return res.status(200).json({ success: true, data: { message: 'Draft deleted' } });
      }

      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('[X Draft API] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}
