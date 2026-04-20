import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '@/features/liveShow/db';
import { broadcastAudio, avatarState } from '@/features/liveShow/schema';
import { eq, desc, and } from 'drizzle-orm';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const db = getDb();
  
  if (!db) {
    return res.status(503).json({ error: 'Database not available' });
  }

  try {
    if (req.method === 'GET') {
      const [state] = await db.select().from(avatarState).limit(1);
      
      if (!state || !state.currentAudioId) {
        return res.status(200).json({
          isSpeaking: false,
          currentAudio: null,
          emotion: 'neutral',
        });
      }

      const [currentAudio] = await db
        .select()
        .from(broadcastAudio)
        .where(eq(broadcastAudio.id, state.currentAudioId));

      const playedAt = currentAudio?.playedAt 
        ? new Date(currentAudio.playedAt).getTime()
        : null;
      const currentTime = playedAt 
        ? Date.now() - playedAt 
        : 0;

      return res.status(200).json({
        isSpeaking: state.isSpeaking,
        currentAudio: currentAudio ? {
          id: currentAudio.id,
          text: currentAudio.text,
          audioData: currentAudio.audioData,
          emotion: currentAudio.emotion,
          duration: currentAudio.duration,
          currentTime,
        } : null,
        emotion: state.currentEmotion,
        lipSyncData: state.lipSyncData ? JSON.parse(state.lipSyncData) : null,
        serverTime: Date.now(),
      });
    }

    if (req.method === 'POST') {
      const { action, audioData, text, emotion, duration } = req.body;

      if (action === 'start') {
        const [audio] = await db
          .insert(broadcastAudio)
          .values({
            audioData,
            text: text || '',
            emotion,
            duration,
            status: 'playing',
            playedAt: new Date(),
          })
          .returning();

        const [existingState] = await db.select().from(avatarState).limit(1);
        
        if (existingState) {
          await db
            .update(avatarState)
            .set({
              isSpeaking: true,
              currentEmotion: emotion || 'neutral',
              currentAudioId: audio.id,
              lastUpdated: new Date(),
            })
            .where(eq(avatarState.id, existingState.id));
        } else {
          await db.insert(avatarState).values({
            isSpeaking: true,
            currentEmotion: emotion || 'neutral',
            currentAudioId: audio.id,
          });
        }

        return res.status(201).json({
          audioId: audio.id,
          startedAt: audio.playedAt,
        });
      }

      if (action === 'stop') {
        const [existingState] = await db.select().from(avatarState).limit(1);
        
        if (existingState) {
          if (existingState.currentAudioId) {
            await db
              .update(broadcastAudio)
              .set({ status: 'completed' })
              .where(eq(broadcastAudio.id, existingState.currentAudioId));
          }

          await db
            .update(avatarState)
            .set({
              isSpeaking: false,
              currentAudioId: null,
              lastUpdated: new Date(),
            })
            .where(eq(avatarState.id, existingState.id));
        }

        return res.status(200).json({ success: true });
      }

      if (action === 'emotion') {
        const [existingState] = await db.select().from(avatarState).limit(1);
        
        if (existingState) {
          await db
            .update(avatarState)
            .set({
              currentEmotion: emotion || 'neutral',
              lastUpdated: new Date(),
            })
            .where(eq(avatarState.id, existingState.id));
        }

        return res.status(200).json({ success: true, emotion });
      }

      return res.status(400).json({ error: 'Invalid action. Use: start, stop, or emotion' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Broadcast audio API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
