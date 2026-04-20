import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/features/liveShow/db';
import { broadcastMedia, broadcastState, broadcastReactions } from '@/features/liveShow/schema';
import { eq, desc, and, gte } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();
  
  if (!db) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    if (req.method === 'GET') {
      const [state] = await db.select().from(broadcastState).limit(1);
      
      if (!state || !state.currentMediaId) {
        return res.status(200).json({
          isPlaying: false,
          currentTime: 0,
          mediaUrl: null,
          mediaId: null,
        });
      }

      const [currentMedia] = await db
        .select()
        .from(broadcastMedia)
        .where(eq(broadcastMedia.id, state.currentMediaId));

      const currentTime = state.isPaused
        ? state.pausedAt || 0
        : state.startedAt
          ? Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000)
          : 0;

      const recentReactions = await db
        .select()
        .from(broadcastReactions)
        .where(
          and(
            eq(broadcastReactions.mediaId, state.currentMediaId),
            gte(broadcastReactions.timestamp, currentTime - 5)
          )
        )
        .orderBy(desc(broadcastReactions.createdAt))
        .limit(20);

      return res.status(200).json({
        isPlaying: !state.isPaused,
        currentTime,
        mediaUrl: currentMedia?.mediaUrl,
        mediaId: state.currentMediaId,
        mediaType: currentMedia?.mediaType,
        title: currentMedia?.title,
        viewerCount: state.viewerCount,
        recentReactions: recentReactions.map(r => ({
          reaction: r.reaction,
          timestamp: r.timestamp,
        })),
        lastUpdated: state.lastUpdated,
        startedAt: state.startedAt?.toISOString(),
        pausedAt: state.pausedAt,
        serverTime: Date.now(),
      });
    }

    if (req.method === 'POST') {
      const { mediaId, visitorId, reaction } = req.body;
      
      if (!mediaId || !visitorId || !reaction) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const [state] = await db.select().from(broadcastState).limit(1);
      const currentTime = state?.startedAt && !state.isPaused
        ? Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000)
        : state?.pausedAt || 0;

      const [reactionEntry] = await db
        .insert(broadcastReactions)
        .values({
          mediaId,
          visitorId,
          reaction,
          timestamp: currentTime,
        })
        .returning();

      return res.status(201).json(reactionEntry);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Broadcast sync API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
