import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn, ChildProcess } from 'child_process';

declare global {
  var ffmpegFrameProcess: ChildProcess | null | undefined;
  var ffmpegFrameError: string | null | undefined;
  var ffmpegFrameStarted: boolean | undefined;
  var frameCount: number | undefined;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

function startFFmpegFrameProcess(rtmpUrl: string, streamKey: string): ChildProcess {
  const fullUrl = `${rtmpUrl}/${streamKey}`;
  
  console.log('[FFmpeg Frame] Starting with URL:', fullUrl);
  global.ffmpegFrameError = null;
  global.ffmpegFrameStarted = false;
  global.frameCount = 0;
  
  const ffmpeg = spawn('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel', 'info',
    // Video input from JPEG pipe
    '-f', 'image2pipe',
    '-framerate', '24',
    '-i', 'pipe:0',
    // Generate silent audio track (required for RTMP)
    '-f', 'lavfi',
    '-i', 'anullsrc=r=44100:cl=stereo',
    // Video encoding
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-profile:v', 'baseline',
    '-level', '3.1',
    '-b:v', '2500k',
    '-maxrate', '3000k',
    '-bufsize', '6000k',
    '-pix_fmt', 'yuv420p',
    '-s', '1280x720',
    '-r', '24',
    '-g', '48',
    '-keyint_min', '24',
    // Audio encoding (silent track)
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-shortest',
    // Output format
    '-f', 'flv',
    '-flvflags', 'no_duration_filesize',
    fullUrl,
  ]);

  ffmpeg.stdout.on('data', (data) => {
    console.log('[FFmpeg Frame stdout]', data.toString());
  });

  ffmpeg.stderr.on('data', (data) => {
    const msg = data.toString();
    console.log('[FFmpeg Frame]', msg);
    
    if (msg.includes('frame=') || msg.includes('fps=')) {
      global.ffmpegFrameStarted = true;
    }
    
    if (msg.toLowerCase().includes('error') || msg.includes('Invalid') || msg.includes('failed')) {
      global.ffmpegFrameError = msg.substring(0, 200);
      console.error('[FFmpeg Frame ERROR]', msg);
    }
  });

  ffmpeg.on('error', (error) => {
    console.error('[FFmpeg Frame] Process error:', error);
    global.ffmpegFrameError = error.message;
  });

  ffmpeg.on('close', (code) => {
    console.log('[FFmpeg Frame] Process closed with code:', code);
    if (code !== 0) {
      global.ffmpegFrameError = `FFmpeg exited with code ${code}`;
    }
    global.ffmpegFrameProcess = null;
    global.ffmpegFrameStarted = false;
  });

  ffmpeg.stdin.on('error', (err) => {
    console.error('[FFmpeg Frame stdin] Error:', err.message);
    global.ffmpegFrameError = `stdin error: ${err.message}`;
  });

  return ffmpeg;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authToken = req.headers['x-stream-token'] as string;
  if (!authToken || authToken !== global.streamingState?.authToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!global.streamingState?.isStreaming) {
    return res.status(400).json({ 
      error: 'Streaming not started. Call /api/streaming/start first.' 
    });
  }

  try {
    if (global.ffmpegFrameError && !global.ffmpegFrameProcess) {
      return res.status(500).json({ 
        error: 'FFmpeg process failed',
        details: global.ffmpegFrameError,
        ffmpegDead: true,
      });
    }

    if (!global.ffmpegFrameProcess) {
      global.ffmpegFrameProcess = startFFmpegFrameProcess(
        global.streamingState.rtmpUrl,
        global.streamingState.streamKey
      );
    }

    const chunks: Buffer[] = [];
    
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      req.on('end', () => resolve());
      req.on('error', (err) => reject(err));
    });

    const frameData = Buffer.concat(chunks);
    
    const ffmpeg = global.ffmpegFrameProcess;
    if (!ffmpeg || ffmpeg.killed || !ffmpeg.stdin || ffmpeg.stdin.destroyed) {
      const errorMsg = global.ffmpegFrameError || 'FFmpeg process not available';
      return res.status(500).json({ 
        error: 'FFmpeg process not available',
        details: errorMsg,
        ffmpegDead: true,
      });
    }
    
    if (!ffmpeg.stdin.writable) {
      const errorMsg = global.ffmpegFrameError || 'FFmpeg stdin not writable';
      global.ffmpegFrameError = errorMsg;
      global.ffmpegFrameProcess = null;
      return res.status(500).json({ 
        error: 'FFmpeg stdin closed',
        details: errorMsg,
        ffmpegDead: true,
      });
    }
    
    try {
      ffmpeg.stdin.write(frameData);
      global.frameCount = (global.frameCount || 0) + 1;
      
      if (global.frameCount % 60 === 1) {
        console.log(`[FFmpeg Frame] Received frame #${global.frameCount}, size: ${frameData.length} bytes`);
      }

      res.status(200).json({ 
        success: true, 
        frameNumber: global.frameCount,
        bytesReceived: frameData.length,
        ffmpegStarted: global.ffmpegFrameStarted || false,
      });
    } catch (writeError) {
      const errorMsg = writeError instanceof Error ? writeError.message : 'Write failed';
      global.ffmpegFrameError = errorMsg;
      global.ffmpegFrameProcess = null;
      return res.status(500).json({ 
        error: 'FFmpeg write failed',
        details: errorMsg,
        ffmpegDead: true,
      });
    }

  } catch (error) {
    console.error('[Streaming Frame] Push error:', error);
    res.status(500).json({
      error: 'Failed to push frame data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
