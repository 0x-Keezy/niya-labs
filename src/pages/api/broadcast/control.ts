import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/features/liveShow/db';
import { broadcastMedia, broadcastState } from '@/features/liveShow/schema';
import { eq } from 'drizzle-orm';
import { verifyAdminAuth } from '@/lib/adminAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();
  
  if (!db) {
    return res.status(503).json({ error: 'Database not available' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!verifyAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized - Admin authentication required' });
  }

  try {
    const { action, mediaId } = req.body;

    let [state] = await db.select().from(broadcastState).limit(1);
    
    if (!state) {
      const [newState] = await db
        .insert(broadcastState)
        .values({ isPaused: true, viewerCount: 0 })
        .returning();
      state = newState;
    }

    switch (action) {
      case 'play': {
        const targetId = mediaId || state.currentMediaId;
        
        if (!targetId) {
          const [nextMedia] = await db
            .select()
            .from(broadcastMedia)
            .where(eq(broadcastMedia.status, 'queued'))
            .orderBy(broadcastMedia.createdAt)
            .limit(1);
          
          if (!nextMedia) {
            return res.status(400).json({ error: 'No media in queue' });
          }
          
          await db
            .update(broadcastMedia)
            .set({ status: 'playing', playedAt: new Date() })
            .where(eq(broadcastMedia.id, nextMedia.id));
          
          await db
            .update(broadcastState)
            .set({ 
              currentMediaId: nextMedia.id, 
              startedAt: new Date(), 
              isPaused: false,
              pausedAt: null,
              lastUpdated: new Date()
            })
            .where(eq(broadcastState.id, state.id));
        } else {
          const pausedTime = state.pausedAt || 0;
          const newStartTime = new Date(Date.now() - pausedTime * 1000);
          
          await db
            .update(broadcastMedia)
            .set({ status: 'playing', playedAt: state.startedAt ? undefined : new Date() })
            .where(eq(broadcastMedia.id, targetId));
          
          await db
            .update(broadcastState)
            .set({ 
              currentMediaId: targetId,
              startedAt: newStartTime,
              isPaused: false,
              pausedAt: null,
              lastUpdated: new Date()
            })
            .where(eq(broadcastState.id, state.id));
        }
        break;
      }
      
      case 'pause': {
        if (state.currentMediaId && state.startedAt) {
          const currentTime = Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000);
          
          await db
            .update(broadcastState)
            .set({ 
              isPaused: true, 
              pausedAt: currentTime,
              lastUpdated: new Date()
            })
            .where(eq(broadcastState.id, state.id));
        }
        break;
      }
      
      case 'stop': {
        if (state.currentMediaId) {
          await db
            .update(broadcastMedia)
            .set({ status: 'played' })
            .where(eq(broadcastMedia.id, state.currentMediaId));
        }
        
        await db
          .update(broadcastState)
          .set({ 
            currentMediaId: null, 
            startedAt: null, 
            isPaused: true,
            pausedAt: null,
            lastUpdated: new Date()
          })
          .where(eq(broadcastState.id, state.id));
        break;
      }
      
      case 'next': {
        if (state.currentMediaId) {
          await db
            .update(broadcastMedia)
            .set({ status: 'played' })
            .where(eq(broadcastMedia.id, state.currentMediaId));
        }
        
        const [nextMedia] = await db
          .select()
          .from(broadcastMedia)
          .where(eq(broadcastMedia.status, 'queued'))
          .orderBy(broadcastMedia.createdAt)
          .limit(1);
        
        if (nextMedia) {
          await db
            .update(broadcastMedia)
            .set({ status: 'playing', playedAt: new Date() })
            .where(eq(broadcastMedia.id, nextMedia.id));
          
          await db
            .update(broadcastState)
            .set({ 
              currentMediaId: nextMedia.id, 
              startedAt: new Date(), 
              isPaused: false,
              pausedAt: null,
              lastUpdated: new Date()
            })
            .where(eq(broadcastState.id, state.id));
        } else {
          await db
            .update(broadcastState)
            .set({ 
              currentMediaId: null, 
              startedAt: null, 
              isPaused: true,
              pausedAt: null,
              lastUpdated: new Date()
            })
            .where(eq(broadcastState.id, state.id));
        }
        break;
      }
      
      case 'seek': {
        const { time } = req.body;
        if (typeof time === 'number' && state.currentMediaId) {
          await db
            .update(broadcastState)
            .set({ 
              startedAt: new Date(Date.now() - time * 1000),
              pausedAt: state.isPaused ? time : null,
              lastUpdated: new Date()
            })
            .where(eq(broadcastState.id, state.id));
        }
        break;
      }
      
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    const [updatedState] = await db.select().from(broadcastState).limit(1);
    return res.status(200).json({ success: true, state: updatedState });
  } catch (error) {
    console.error('Broadcast control API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
