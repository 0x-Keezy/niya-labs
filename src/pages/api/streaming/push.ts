import type { NextApiRequest, NextApiResponse } from 'next';
import { spawn, ChildProcess } from 'child_process';

declare global {
  var ffmpegProcess: ChildProcess | null | undefined;
  var ffmpegError: string | null | undefined;
  var ffmpegStarted: boolean | undefined;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

// Store ffmpeg stderr logs for client visibility
declare global {
  var ffmpegLogs: string[] | undefined;
}

function startFFmpegProcess(rtmpUrl: string, streamKey: string): ChildProcess {
  const fullUrl = `${rtmpUrl}/${streamKey}`;
  
  // Detect if using RTMPS (TLS/SSL encrypted)
  const isRtmps = rtmpUrl.toLowerCase().startsWith('rtmps://');
  
  console.log('[FFmpeg] Starting with URL:', fullUrl);
  console.log('[FFmpeg] Using RTMPS (TLS):', isRtmps);
  global.ffmpegError = null;
  global.ffmpegStarted = false;
  global.ffmpegLogs = [];
  
  // Build ffmpeg arguments
  const ffmpegArgs: string[] = [
    '-y',
    '-hide_banner',
    '-loglevel', 'info',  // More verbose for debugging
    // Input settings for live WebM stream
    '-fflags', '+genpts+igndts',
    '-use_wallclock_as_timestamps', '1',
    '-f', 'matroska',
    '-i', 'pipe:0',
    // Video encoding: H.264 for RTMP compatibility
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-profile:v', 'baseline',
    '-level', '3.1',
    '-b:v', '3000k',
    '-maxrate', '3500k',
    '-bufsize', '6000k',
    '-pix_fmt', 'yuv420p',
    '-s', '1280x720',
    '-r', '30',
    '-g', '60',
    '-keyint_min', '30',
    // Audio encoding: AAC for RTMP compatibility
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    // Output settings
    '-f', 'flv',
    '-flvflags', 'no_duration_filesize',
  ];
  
  // For RTMPS, ffmpeg should handle TLS automatically if compiled with OpenSSL/GnuTLS
  // The rtmps:// protocol prefix tells ffmpeg to use TLS encryption
  // No additional flags needed - ffmpeg will use the system certificate store
  
  // Add the output URL at the end
  ffmpegArgs.push(fullUrl);
  
  console.log('[FFmpeg] Command: ffmpeg', ffmpegArgs.join(' '));
  
  const ffmpeg = spawn('ffmpeg', ffmpegArgs);

  ffmpeg.stdout.on('data', (data) => {
    console.log('[FFmpeg stdout]', data.toString());
  });

  ffmpeg.stderr.on('data', (data) => {
    const msg = data.toString();
    console.log('[FFmpeg]', msg);
    
    // Store logs for client visibility (keep last 50 lines)
    if (!global.ffmpegLogs) global.ffmpegLogs = [];
    const lines = msg.split('\n').filter((l: string) => l.trim());
    global.ffmpegLogs.push(...lines);
    if (global.ffmpegLogs.length > 50) {
      global.ffmpegLogs = global.ffmpegLogs.slice(-50);
    }
    
    // Detect successful connection
    if (msg.includes('frame=') || msg.includes('fps=')) {
      global.ffmpegStarted = true;
    }
    
    // Detect TLS/connection errors specifically
    if (msg.toLowerCase().includes('handshake') || 
        msg.toLowerCase().includes('tls') || 
        msg.toLowerCase().includes('ssl') ||
        msg.toLowerCase().includes('connection refused') ||
        msg.toLowerCase().includes('protocol not found')) {
      global.ffmpegError = `TLS/Connection error: ${msg.substring(0, 300)}`;
      console.error('[FFmpeg TLS ERROR]', msg);
    }
    
    // Detect other errors
    if (msg.toLowerCase().includes('error') || msg.includes('Invalid') || msg.includes('failed')) {
      global.ffmpegError = msg.substring(0, 300);
      console.error('[FFmpeg ERROR]', msg);
    }
  });

  ffmpeg.on('error', (error) => {
    console.error('[FFmpeg] Process error:', error);
    global.ffmpegError = error.message;
    if (global.streamingState) {
      global.streamingState.error = `FFmpeg error: ${error.message}`;
      global.streamingState.isStreaming = false;
    }
  });

  ffmpeg.on('close', (code) => {
    console.log('[FFmpeg] Process closed with code:', code);
    if (code !== 0) {
      global.ffmpegError = `FFmpeg exited with code ${code}`;
    }
    if (global.streamingState) {
      global.streamingState.isStreaming = false;
      global.streamingState.process = null;
      if (code !== 0) {
        global.streamingState.error = global.ffmpegError || `FFmpeg exited unexpectedly (code ${code})`;
      }
    }
    global.ffmpegProcess = null;
    global.ffmpegStarted = false;
  });

  // Handle stdin errors to prevent unhandled rejections
  ffmpeg.stdin.on('error', (err) => {
    console.error('[FFmpeg stdin] Error:', err.message);
    global.ffmpegError = `stdin error: ${err.message}`;
    // Don't kill process here, let the close handler do cleanup
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
    // Check if FFmpeg has errored
    if (global.ffmpegError && !global.ffmpegProcess) {
      return res.status(500).json({ 
        error: 'FFmpeg process failed',
        details: global.ffmpegError,
        ffmpegDead: true,
      });
    }

    if (!global.ffmpegProcess) {
      global.ffmpegProcess = startFFmpegProcess(
        global.streamingState.rtmpUrl,
        global.streamingState.streamKey
      );
      global.streamingState.process = global.ffmpegProcess;
    }

    const chunks: Buffer[] = [];
    
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      req.on('end', () => {
        resolve();
      });
      
      req.on('error', (err) => {
        reject(err);
      });
    });

    const videoData = Buffer.concat(chunks);
    
    // Defensive check: FFmpeg process must exist and be alive
    const ffmpeg = global.ffmpegProcess;
    if (!ffmpeg || ffmpeg.killed || !ffmpeg.stdin || ffmpeg.stdin.destroyed) {
      const errorMsg = global.ffmpegError || 'FFmpeg process not available';
      console.error('[Streaming] FFmpeg not available:', errorMsg);
      return res.status(500).json({ 
        error: 'FFmpeg process not available',
        details: errorMsg,
        ffmpegDead: true,
      });
    }
    
    // Check if stdin is writable before attempting write
    if (!ffmpeg.stdin.writable) {
      const errorMsg = global.ffmpegError || 'FFmpeg stdin not writable';
      console.error('[Streaming] FFmpeg stdin not writable');
      global.ffmpegError = errorMsg;
      global.ffmpegProcess = null;
      if (global.streamingState) {
        global.streamingState.process = null;
      }
      return res.status(500).json({ 
        error: 'FFmpeg stdin closed',
        details: errorMsg,
        ffmpegDead: true,
      });
    }
    
    // Write with Promise wrapper to catch errors synchronously
    try {
      const writeSuccess = ffmpeg.stdin.write(videoData);
      
      // If write returns false, the buffer is full but we continue
      // This is normal backpressure, not an error
      if (!writeSuccess) {
        console.log('[Streaming] FFmpeg buffer full, continuing...');
      }
      
      // Check again if process died during write
      if (ffmpeg.killed || global.ffmpegError) {
        return res.status(500).json({ 
          error: 'FFmpeg process failed during write',
          details: global.ffmpegError || 'Process terminated',
          ffmpegDead: true,
        });
      }

      res.status(200).json({ 
        success: true, 
        bytesReceived: videoData.length,
        ffmpegStarted: global.ffmpegStarted || false,
      });
    } catch (writeError) {
      const errorMsg = writeError instanceof Error ? writeError.message : 'Write failed';
      console.error('[Streaming] Write exception:', errorMsg);
      global.ffmpegError = errorMsg;
      global.ffmpegProcess = null;
      if (global.streamingState) {
        global.streamingState.process = null;
      }
      return res.status(500).json({ 
        error: 'FFmpeg write failed',
        details: errorMsg,
        ffmpegDead: true,
      });
    }

  } catch (error) {
    console.error('[Streaming] Push error:', error);
    res.status(500).json({
      error: 'Failed to push video data',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
