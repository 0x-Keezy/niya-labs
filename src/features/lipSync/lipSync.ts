import { LipSyncAnalyzeResult } from "./lipSyncAnalyzeResult";

const TIME_DOMAIN_DATA_LENGTH = 2048;

// Global audio stream manager reference
declare global {
  interface Window {
    __audioStreamManager?: {
      isStreamingEnabled: () => boolean;
      getStreamDestination: () => MediaStreamAudioDestinationNode | null;
      getAudioContext: () => AudioContext | null;
    };
  }
}

export class LipSync {
  public readonly audio: AudioContext;
  public readonly analyser: AnalyserNode;
  public readonly timeDomainData: Float32Array<ArrayBuffer>;
  private currentSource: AudioBufferSourceNode | null = null;
  private streamingSource: AudioBufferSourceNode | null = null;
  private isPlaying: boolean = false;
  private playId: number = 0; // Version counter to prevent stale playback

  public constructor(audio: AudioContext) {
    this.audio = audio;

    this.analyser = audio.createAnalyser();
    this.timeDomainData = new Float32Array(TIME_DOMAIN_DATA_LENGTH) as Float32Array<ArrayBuffer>;
  }

  public stopCurrent(): void {
    // Increment playId to invalidate any in-flight decoding
    this.playId++;
    
    if (this.currentSource && this.isPlaying) {
      try {
        this.currentSource.stop();
        this.currentSource.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.currentSource = null;
      this.isPlaying = false;
    }
    
    // Also stop streaming source if active
    if (this.streamingSource) {
      try {
        this.streamingSource.stop();
        this.streamingSource.disconnect();
      } catch (e) {
        // Already stopped
      }
      this.streamingSource = null;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public update(): LipSyncAnalyzeResult {
    this.analyser.getFloatTimeDomainData(this.timeDomainData);

    let volume = 0.0;
    for (let i = 0; i < TIME_DOMAIN_DATA_LENGTH; i++) {
      volume = Math.max(volume, Math.abs(this.timeDomainData[i]));
    }

    // cook
    volume = 1 / (1 + Math.exp(-45 * volume + 5));
    if (volume < 0.1) volume = 0;

    return {
      volume,
    };
  }

  public async playFromArrayBuffer(buffer: ArrayBuffer, onEnded?: () => void) {
    // Stop any currently playing audio first to prevent overlap
    this.stopCurrent();
    
    // CRITICAL: Resume AudioContext if suspended (browser policy requires user interaction)
    if (this.audio.state === 'suspended') {
      console.log('[LipSync] AudioContext suspended, attempting to resume...');
      try {
        await this.audio.resume();
        console.log('[LipSync] AudioContext resumed successfully, state:', this.audio.state);
      } catch (e) {
        console.error('[LipSync] Failed to resume AudioContext:', e);
      }
    }
    
    // Capture current playId before async decode
    const currentPlayId = this.playId;
    
    const audioBuffer = await this.audio.decodeAudioData(buffer);

    // Check if a newer request superseded this one during decode
    if (currentPlayId !== this.playId) {
      // A newer call has taken over, abort this playback
      if (onEnded) {
        onEnded();
      }
      return;
    }

    const bufferSource = this.audio.createBufferSource();
    bufferSource.buffer = audioBuffer;

    // Connect to local speaker output and analyser for lip sync
    bufferSource.connect(this.audio.destination);
    bufferSource.connect(this.analyser);
    
    // Also route to streaming destination if streaming is enabled
    if (typeof window !== 'undefined' && window.__audioStreamManager?.isStreamingEnabled()) {
      const streamDest = window.__audioStreamManager.getStreamDestination();
      const streamCtx = window.__audioStreamManager.getAudioContext();
      if (streamDest && streamCtx && streamCtx.state === 'running') {
        try {
          // Decode in streaming context and play there too
          const streamBuffer = await streamCtx.decodeAudioData(buffer.slice(0));
          this.streamingSource = streamCtx.createBufferSource();
          this.streamingSource.buffer = streamBuffer;
          this.streamingSource.connect(streamDest);
          this.streamingSource.start();
        } catch (e) {
          console.log('[LipSync] Could not route to stream:', e);
        }
      }
    }
    
    // Track current source for stopping
    this.currentSource = bufferSource;
    this.isPlaying = true;
    
    bufferSource.start();
    
    const handleEnded = () => {
      // Only update state if this is still the active playback
      if (currentPlayId === this.playId) {
        this.isPlaying = false;
        this.currentSource = null;
        // Cleanup streaming source when local playback ends
        if (this.streamingSource) {
          try {
            this.streamingSource.stop();
            this.streamingSource.disconnect();
          } catch {
            // Already stopped
          }
          this.streamingSource = null;
        }
      }
      if (onEnded) {
        onEnded();
      }
    };
    
    bufferSource.addEventListener("ended", handleEnded);
  }

  public async playFromURL(url: string, onEnded?: () => void) {
    const res = await fetch(url);
    const buffer = await res.arrayBuffer();
    this.playFromArrayBuffer(buffer, onEnded);
  }
}
