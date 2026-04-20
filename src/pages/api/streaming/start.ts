import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn, ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import { timingSafeEqualStr } from '@/features/auth/timingSafeEqual';
import { verifyAdminSession } from '@/features/auth/adminSession';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

interface StreamingState {
  isStreaming: boolean;
  process: ChildProcess | null;
  rtmpUrl: string;
  streamKey: string;
  startedAt: number | null;
  error: string | null;
  authToken: string | null;
}

declare global {
  var streamingState: StreamingState | undefined;
}

function generateStreamToken(): string {
  return 'st_' + randomBytes(32).toString('hex');
}

if (!global.streamingState) {
  global.streamingState = {
    isStreaming: false,
    process: null,
    rtmpUrl: '',
    streamKey: '',
    startedAt: null,
    error: null,
    authToken: null,
  };
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, rtmpUrl, streamKey, adminPassword } = req.body;

  // Require admin authentication for all streaming control actions.
  // `status` action is read-only and bypasses auth (same as before).
  // Phase 1.2 — cookie-first, legacy body-password as fallback for scripts.
  if (action !== 'status') {
    const sessionValid = await verifyAdminSession(req);
    if (!sessionValid) {
      if (!ADMIN_PASSWORD) {
        return res.status(500).json({ error: 'Admin authentication not configured' });
      }
      // Constant-time compare on the legacy password path.
      if (!timingSafeEqualStr(adminPassword, ADMIN_PASSWORD)) {
        return res.status(401).json({ error: 'Unauthorized - admin credentials required' });
      }
    }
  }

  try {
    if (action === 'start') {
      if (!rtmpUrl || !streamKey) {
        return res.status(400).json({ 
          error: 'RTMP URL and Stream Key are required' 
        });
      }

      if (global.streamingState?.isStreaming) {
        return res.status(400).json({ 
          error: 'Already streaming. Stop current stream first.' 
        });
      }

      const fullRtmpUrl = `${rtmpUrl}/${streamKey}`;
      
      console.log('[Streaming] Starting FFmpeg for RTMP:', rtmpUrl);
      
      const authToken = generateStreamToken();
      
      global.streamingState = {
        isStreaming: true,
        process: null,
        rtmpUrl,
        streamKey,
        startedAt: Date.now(),
        error: null,
        authToken,
      };

      res.status(200).json({
        success: true,
        message: 'Streaming initialized. Send video chunks to /api/streaming/push',
        wsEndpoint: '/api/streaming/push',
        authToken,
      });

    } else if (action === 'stop') {
      // Kill the FFmpeg process if running
      if (global.streamingState?.process) {
        global.streamingState.process.kill('SIGTERM');
      }
      
      // Also kill the global ffmpegProcess reference
      const ffmpegProc = (global as any).ffmpegProcess;
      if (ffmpegProc && !ffmpegProc.killed) {
        try {
          ffmpegProc.kill('SIGTERM');
        } catch (e) {
          console.log('[Streaming] FFmpeg already terminated');
        }
      }
      
      // Reset all state
      (global as any).ffmpegProcess = null;
      (global as any).ffmpegError = null;
      (global as any).ffmpegStarted = false;
      
      global.streamingState = {
        isStreaming: false,
        process: null,
        rtmpUrl: '',
        streamKey: '',
        startedAt: null,
        error: null,
        authToken: null,
      };

      console.log('[Streaming] Stream stopped and FFmpeg cleaned up');

      res.status(200).json({
        success: true,
        message: 'Streaming stopped',
      });

    } else if (action === 'status') {
      // Include FFmpeg status information
      const ffmpegAlive = !!(global as any).ffmpegProcess && !(global as any).ffmpegProcess.killed;
      const ffmpegError = (global as any).ffmpegError;
      const ffmpegLogs = (global as any).ffmpegLogs || [];
      
      res.status(200).json({
        isStreaming: global.streamingState?.isStreaming || false,
        startedAt: global.streamingState?.startedAt,
        error: global.streamingState?.error || ffmpegError,
        uptime: global.streamingState?.startedAt 
          ? Math.floor((Date.now() - global.streamingState.startedAt) / 1000)
          : 0,
        ffmpegAlive,
        ffmpegStarted: (global as any).ffmpegStarted || false,
        ffmpegLogs: ffmpegLogs.slice(-20),  // Last 20 log lines for client
      });

    } else {
      res.status(400).json({ 
        error: 'Invalid action. Use "start", "stop", or "status"' 
      });
    }

  } catch (error) {
    console.error('[Streaming] Error:', error);
    res.status(500).json({
      error: 'Streaming operation failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
