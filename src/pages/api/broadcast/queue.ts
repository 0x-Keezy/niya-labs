import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/features/liveShow/db';
import { broadcastMedia, insertBroadcastMediaSchema } from '@/features/liveShow/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminAuth } from '@/lib/adminAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();
  
  if (!db) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    if (req.method === 'GET') {
      const queue = await db
        .select()
        .from(broadcastMedia)
        .where(eq(broadcastMedia.status, 'queued'))
        .orderBy(broadcastMedia.createdAt)
        .limit(20);

      return res.status(200).json(queue);
    }

    if (req.method === 'POST') {
      if (!verifyAdminAuth(req)) {
        return res.status(401).json({ error: 'Unauthorized - Admin authentication required' });
      }
      
      const parsed = insertBroadcastMediaSchema.safeParse(req.body);
      
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
      }

      const [media] = await db
        .insert(broadcastMedia)
        .values(parsed.data)
        .returning();

      return res.status(201).json(media);
    }

    if (req.method === 'DELETE') {
      if (!verifyAdminAuth(req)) {
        return res.status(401).json({ error: 'Unauthorized - Admin authentication required' });
      }
      
      const { id } = req.query;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Media ID required' });
      }

      await db
        .delete(broadcastMedia)
        .where(eq(broadcastMedia.id, parseInt(id)));

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Broadcast queue API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
