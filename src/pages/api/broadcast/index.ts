import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/features/liveShow/db';
import { broadcastMedia, broadcastState } from '@/features/liveShow/schema';
import { eq } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();
  
  if (!db) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    if (req.method === 'GET') {
      const [state] = await db.select().from(broadcastState).limit(1);
      
      let currentMedia = null;
      if (state?.currentMediaId) {
        const [media] = await db
          .select()
          .from(broadcastMedia)
          .where(eq(broadcastMedia.id, state.currentMediaId));
        currentMedia = media;
      }

      const queue = await db
        .select()
        .from(broadcastMedia)
        .where(eq(broadcastMedia.status, 'queued'))
        .orderBy(broadcastMedia.createdAt)
        .limit(10);

      const currentTime = state?.startedAt && !state.isPaused
        ? Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000)
        : state?.pausedAt || 0;

      return res.status(200).json({
        state: state || { isPaused: true, viewerCount: 0 },
        currentMedia,
        currentTime,
        queue,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Broadcast API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
