import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { getDb } from '@/features/liveShow/db';
import { broadcastAudio, avatarState } from '@/features/liveShow/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { safeError } from '@/lib/apiError';

interface CachedAudio {
  audioBase64: string;
  createdAt: number;
  hitCount: number;
}

const ttsCache = new Map<string, CachedAudio>();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function generateCacheKey(text: string, voiceId: string): string {
  const normalized = text.trim().toLowerCase();
  return crypto.createHash('md5').update(`${voiceId}:${normalized}`).digest('hex');
}

function cleanupCache(): void {
  const now = Date.now();
  
  for (const [key, value] of ttsCache.entries()) {
    if (now - value.createdAt > CACHE_TTL_MS) {
      ttsCache.delete(key);
      console.log(`[TTS Cache] Expired entry removed: ${key.substring(0, 8)}...`);
    }
  }
  
  if (ttsCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(ttsCache.entries())
      .sort((a, b) => a[1].hitCount - b[1].hitCount);
    
    const toRemove = entries.slice(0, ttsCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => {
      ttsCache.delete(key);
      console.log(`[TTS Cache] LRU evicted: ${key.substring(0, 8)}...`);
    });
  }
}

function estimateAudioDurationMs(base64Audio: string): number {
  const bytes = Buffer.from(base64Audio, 'base64').length;
  const bitrate = 32000;
  const durationSec = (bytes * 8) / bitrate;
  return Math.ceil(durationSec * 1000) + 500;
}

async function generateTTS(text: string, voiceId: string): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY not configured');
  }

  const body = {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.35,
      similarity_boost: 0.80,
      style: 0.65,
      use_speaker_boost: true
    }
  };

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?optimize_streaming_latency=4&output_format=mp3_22050_32`,
    {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
        'xi-api-key': apiKey,
      },
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs API Error (${response.status}): ${errText.substring(0, 100)}`);
  }

  const audioBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(audioBuffer).toString('base64');
  
  return base64;
}

async function getOrCreateAvatarState(db: any) {
  const existing = await db.select().from(avatarState).limit(1);
  if (existing.length > 0) {
    return existing[0];
  }
  const [newState] = await db.insert(avatarState).values({
    isSpeaking: false,
    currentEmotion: 'neutral',
  }).returning();
  return newState;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let db;
  try {
    db = getDb();
  } catch (e: any) {
    console.warn('[Broadcast] DB connection error (graceful fallback):', e.message);
    // Return empty response for polling - don't break the client
    if (req.method === 'GET' && req.query.action === 'poll') {
      return res.status(200).json({
        isSpeaking: false,
        currentEmotion: 'neutral',
        currentSubtitle: '',
        pendingAudio: [],
        serverTime: Date.now(),
        dbUnavailable: true,
      });
    }
    return res.status(503).json({ error: 'Database connection failed' });
  }

  if (!db) {
    // Return empty response for polling - don't break the client
    if (req.method === 'GET' && req.query.action === 'poll') {
      return res.status(200).json({
        isSpeaking: false,
        currentEmotion: 'neutral',
        currentSubtitle: '',
        pendingAudio: [],
        serverTime: Date.now(),
        dbUnavailable: true,
      });
    }
    return res.status(503).json({ error: 'Database not available' });
  }

  if (req.method === 'GET') {
    const action = req.query.action as string;
    const since = req.query.since ? parseInt(req.query.since as string) : 0;

    if (action === 'poll') {
      try {
        const state = await getOrCreateAvatarState(db);
        
        const recentAudio = await db
          .select()
          .from(broadcastAudio)
          .where(sql`${broadcastAudio.createdAt} > NOW() - INTERVAL '30 seconds'`)
          .orderBy(desc(broadcastAudio.createdAt))
          .limit(5);

        const pendingAudio = recentAudio.filter((a: any) => 
          a.status === 'playing' || 
          (a.status === 'pending' && new Date(a.createdAt).getTime() > since)
        );

        // Get current subtitle using currentAudioId from state (persists even after status changes)
        let currentSubtitle = '';
        if (state.isSpeaking) {
          if (state.currentAudioId) {
            const currentAudio = recentAudio.find((a: any) => a.id === state.currentAudioId);
            if (currentAudio) {
              currentSubtitle = currentAudio.text || '';
            } else {
              // Fallback: query the specific audio if not in recent list
              const [audioRecord] = await db
                .select()
                .from(broadcastAudio)
                .where(eq(broadcastAudio.id, state.currentAudioId))
                .limit(1);
              if (audioRecord) {
                currentSubtitle = audioRecord.text || '';
              }
            }
          } else if (recentAudio.length > 0) {
            // Fallback for subtitle-only broadcasts or edge cases: use most recent audio text
            currentSubtitle = recentAudio[0].text || '';
          }
        }

        return res.status(200).json({
          isSpeaking: state.isSpeaking,
          currentEmotion: state.currentEmotion,
          currentSubtitle: currentSubtitle,
          pendingAudio: pendingAudio.map((a: any) => ({
            id: a.id,
            audioData: a.audioData,
            text: a.text,
            emotion: a.emotion,
            duration: a.duration,
            status: a.status,
            createdAt: new Date(a.createdAt).getTime(),
          })),
          serverTime: Date.now(),
        });
      } catch (e: any) {
        console.warn('[Broadcast] Poll error (graceful fallback):', e.message);
        // Return empty response instead of 500 - don't break the client
        return res.status(200).json({
          isSpeaking: false,
          currentEmotion: 'neutral',
          currentSubtitle: '',
          pendingAudio: [],
          serverTime: Date.now(),
          dbError: true,
        });
      }
    }

    if (action === 'stream') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const state = await getOrCreateAvatarState(db);
        const recentAudio = await db
          .select()
          .from(broadcastAudio)
          .where(sql`${broadcastAudio.createdAt} > NOW() - INTERVAL '60 seconds'`)
          .orderBy(desc(broadcastAudio.createdAt))
          .limit(10);

        sendEvent({
          type: 'init',
          currentSubtitle: state.isSpeaking ? '' : '',
          currentSpeaking: state.isSpeaking,
          recentBroadcasts: recentAudio.map((a: any) => ({
            id: a.id,
            audioBase64: a.audioData,
            subtitleText: a.text,
            emotion: a.emotion,
            timestamp: new Date(a.createdAt).getTime(),
          })),
          timestamp: Date.now(),
        });

        const keepAlive = setInterval(() => {
          res.write(': keepalive\n\n');
        }, 15000);

        let lastCheck = Date.now();
        const pollInterval = setInterval(async () => {
          try {
            const newAudio = await db
              .select()
              .from(broadcastAudio)
              .where(sql`${broadcastAudio.createdAt} > ${new Date(lastCheck)}`)
              .orderBy(desc(broadcastAudio.createdAt))
              .limit(5);

            for (const audio of newAudio.reverse()) {
              sendEvent({
                type: 'sync',
                broadcastId: audio.id,
                audioBase64: audio.audioData,
                subtitleText: audio.text,
                emotion: audio.emotion,
                speaking: true,
                timestamp: new Date(audio.createdAt).getTime(),
              });
            }

            lastCheck = Date.now();
          } catch (e) {
            console.error('[SSE Poll] Error:', e);
          }
        }, 1000);

        req.on('close', () => {
          clearInterval(keepAlive);
          clearInterval(pollInterval);
        });

        return;
      } catch (e: any) {
        console.error('[Broadcast] SSE init error:', e.message);
        return safeError(res, e, { context: 'broadcast/speak:sse-init', publicMessage: 'Broadcast init failed' });
      }
    }

    if (action === 'stats') {
      try {
        const state = await getOrCreateAvatarState(db);
        const recentCount = await db
          .select({ count: sql`count(*)` })
          .from(broadcastAudio)
          .where(sql`${broadcastAudio.createdAt} > NOW() - INTERVAL '1 hour'`);

        return res.status(200).json({
          cacheSize: ttsCache.size,
          isSpeaking: state.isSpeaking,
          recentBroadcasts: parseInt(String(recentCount[0]?.count || '0')),
        });
      } catch (e: any) {
        return safeError(res, e, { context: 'broadcast/speak:listen', publicMessage: 'Broadcast listen failed' });
      }
    }

    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST') {
    const { action, text, voiceId, emotion, chatMessage, subtitleText } = req.body;

    if (action === 'speak') {
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text is required' });
      }

      const voice = voiceId || 'pFZP5JQG7iQjIQuC4Bku';
      const cacheKey = generateCacheKey(text, voice);
      
      cleanupCache();
      
      let audioBase64: string;
      let fromCache = false;

      const cached = ttsCache.get(cacheKey);
      if (cached) {
        audioBase64 = cached.audioBase64;
        cached.hitCount++;
        fromCache = true;
        console.log(`[TTS Cache] HIT for key ${cacheKey.substring(0, 8)}... (hits: ${cached.hitCount})`);
      } else {
        console.log(`[TTS Cache] MISS for key ${cacheKey.substring(0, 8)}... generating TTS`);
        
        try {
          audioBase64 = await generateTTS(text, voice);
          
          ttsCache.set(cacheKey, {
            audioBase64,
            createdAt: Date.now(),
            hitCount: 1,
          });
          
          console.log(`[TTS Cache] Stored new entry, cache size: ${ttsCache.size}`);
        } catch (err: any) {
          console.error('[TTS] Generation failed:', err.message);
          return safeError(res, err, { context: 'broadcast/speak:db', publicMessage: 'Broadcast DB error' });
        }
      }

      const audioDurationMs = estimateAudioDurationMs(audioBase64);

      try {
        const [newBroadcast] = await db.insert(broadcastAudio).values({
          audioData: audioBase64,
          text: subtitleText || text,
          emotion: emotion || 'neutral',
          duration: audioDurationMs,
          status: 'playing',
        }).returning();

        const state = await getOrCreateAvatarState(db);
        await db.update(avatarState)
          .set({
            isSpeaking: true,
            currentEmotion: emotion || 'neutral',
            currentAudioId: newBroadcast.id,
            lastUpdated: new Date(),
          })
          .where(eq(avatarState.id, state.id));

        console.log(`[Broadcast] Audio saved to DB, id: ${newBroadcast.id}, duration: ${audioDurationMs}ms`);

        const broadcastIdToComplete = newBroadcast.id;
        setTimeout(async () => {
          try {
            const currentDb = getDb();
            if (currentDb) {
              const currentState = await getOrCreateAvatarState(currentDb);
              
              // Only clear state if this broadcast is still the active one
              // Prevents stale timers from clearing newer broadcasts
              if (currentState.currentAudioId === broadcastIdToComplete) {
                await currentDb.update(avatarState)
                  .set({
                    isSpeaking: false,
                    currentAudioId: null,
                    lastUpdated: new Date(),
                  })
                  .where(eq(avatarState.id, currentState.id));
                console.log('[Broadcast] Audio marked as completed, state cleared');
              } else {
                console.log('[Broadcast] Skipping state clear - newer broadcast is active');
              }
              
              // Always mark the broadcast audio as completed
              await currentDb.update(broadcastAudio)
                .set({ status: 'completed', playedAt: new Date() })
                .where(eq(broadcastAudio.id, broadcastIdToComplete));
            }
          } catch (e) {
            console.error('[Broadcast] Failed to update status:', e);
          }
        }, audioDurationMs);

        return res.status(200).json({ 
          success: true, 
          fromCache,
          broadcastId: newBroadcast.id,
          audioDurationMs,
        });
      } catch (e: any) {
        console.error('[Broadcast] DB save error:', e.message);
        return safeError(res, e, { context: 'broadcast/speak', publicMessage: 'Broadcast operation failed' });
      }
    }

    if (action === 'speak-end') {
      try {
        const state = await getOrCreateAvatarState(db);
        await db.update(avatarState)
          .set({
            isSpeaking: false,
            lastUpdated: new Date(),
          })
          .where(eq(avatarState.id, state.id));
        return res.status(200).json({ success: true });
      } catch (e: any) {
        return safeError(res, e, { context: 'broadcast/speak', publicMessage: 'Broadcast operation failed' });
      }
    }

    if (action === 'subtitle-only') {
      try {
        const state = await getOrCreateAvatarState(db);
        await db.update(avatarState)
          .set({
            isSpeaking: true,
            lastUpdated: new Date(),
          })
          .where(eq(avatarState.id, state.id));

        await db.insert(broadcastAudio).values({
          text: text || '',
          emotion: 'neutral',
          status: 'playing',
          duration: 3000,
        });

        return res.status(200).json({ success: true });
      } catch (e: any) {
        return safeError(res, e, { context: 'broadcast/speak', publicMessage: 'Broadcast operation failed' });
      }
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
