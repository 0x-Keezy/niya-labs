/**
 * Beat Detector using Web Audio API
 * Analyzes audio frequency data to detect beats and calculate BPM
 * Supports: direct audio elements, manual BPM mode (for YouTube/external sources)
 */
export class BeatDetector {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private mediaStream: MediaStream | null = null;
  private audioSource: MediaElementAudioSourceNode | null = null;
  
  private bassThreshold = 200;
  private midThreshold = 150;
  private highThreshold = 120;
  
  private beatHistory: number[] = [];
  private lastBeatTime = 0;
  private bpm = 120;
  
  // Manual/simulated beat mode (for YouTube where we can't capture audio)
  private manualMode = false;
  private manualBpm = 120;
  private simulatedBeatTime = 0;
  
  private onBeatCallbacks: ((intensity: number, frequencies: FrequencyData) => void)[] = [];
  private isRunning = false;
  private animationFrameId: number | null = null;

  constructor() {}

  /**
   * Initialize the audio context and analyser
   */
  public async init(): Promise<void> {
    if (this.audioContext) return;
    
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  /**
   * Connect to an audio element (local audio/video files)
   * Note: This only works with same-origin media, not YouTube iframes
   */
  public async connectToMediaElement(mediaElement: HTMLMediaElement): Promise<boolean> {
    if (!this.audioContext || !this.analyser) {
      await this.init();
    }

    try {
      // Check if already connected to avoid "already connected" error
      if (this.audioSource) {
        this.audioSource.disconnect();
        this.audioSource = null;
      }
      
      this.audioSource = this.audioContext!.createMediaElementSource(mediaElement);
      this.audioSource.connect(this.analyser!);
      this.analyser!.connect(this.audioContext!.destination);
      this.manualMode = false;
      console.log("BeatDetector connected to media element");
      return true;
    } catch (e) {
      console.error("Failed to connect to media element:", e);
      return false;
    }
  }

  /**
   * Enable manual BPM mode for sources we can't capture (YouTube, external)
   * This simulates beats based on the set BPM without actual audio analysis
   */
  public enableManualMode(bpm: number = 120): void {
    this.manualMode = true;
    this.manualBpm = bpm;
    this.bpm = bpm;
    this.simulatedBeatTime = 0;
    console.log(`BeatDetector: Manual mode enabled at ${bpm} BPM`);
  }

  /**
   * Set the manual BPM value
   */
  public setManualBpm(bpm: number): void {
    this.manualBpm = Math.max(60, Math.min(200, bpm)); // Clamp 60-200 BPM
    if (this.manualMode) {
      this.bpm = this.manualBpm;
    }
  }

  /**
   * Check if running in manual mode
   */
  public isManualMode(): boolean {
    return this.manualMode;
  }

  /**
   * Connect to system audio (microphone) - optional fallback
   * Only used when user explicitly grants permission
   */
  public async connectToSystemAudio(): Promise<void> {
    if (!this.audioContext || !this.analyser) {
      await this.init();
    }

    this.releaseStream();

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });
      
      const source = this.audioContext!.createMediaStreamSource(this.mediaStream);
      source.connect(this.analyser!);
      this.manualMode = false;
      console.log("BeatDetector connected to system audio (microphone)");
    } catch (e) {
      console.error("Failed to connect to system audio:", e);
      // Fall back to manual mode instead of failing
      console.log("Falling back to manual BPM mode");
      this.enableManualMode(120);
    }
  }

  /**
   * Release the media stream and stop microphone capture
   */
  public releaseStream(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => {
        track.stop();
        console.log("Audio track stopped:", track.label);
      });
      this.mediaStream = null;
    }
  }

  /**
   * Start beat detection loop
   */
  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.beatHistory = [];
    this.lastBeatTime = 0;
    this.detectLoop();
    console.log("BeatDetector started");
  }

  /**
   * Stop beat detection loop
   */
  public stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    console.log("BeatDetector stopped");
  }

  /**
   * Register a callback for beat events
   * Returns an unsubscribe function
   */
  public onBeat(callback: (intensity: number, frequencies: FrequencyData) => void): () => void {
    this.onBeatCallbacks.push(callback);
    return () => {
      this.removeCallback(callback);
    };
  }

  /**
   * Remove a specific callback
   */
  public removeCallback(callback: (intensity: number, frequencies: FrequencyData) => void): void {
    const index = this.onBeatCallbacks.indexOf(callback);
    if (index > -1) {
      this.onBeatCallbacks.splice(index, 1);
    }
  }

  /**
   * Remove all beat callbacks
   */
  public clearCallbacks(): void {
    this.onBeatCallbacks = [];
  }

  /**
   * Get current BPM estimate
   */
  public getBPM(): number {
    return Math.round(this.bpm);
  }

  /**
   * Get current frequency data
   */
  public getFrequencyData(): FrequencyData {
    if (!this.analyser || !this.dataArray) {
      return { bass: 0, mid: 0, high: 0, overall: 0 };
    }

    this.analyser.getByteFrequencyData(this.dataArray);
    
    const bassSum = this.dataArray.slice(0, 10).reduce((a, b) => a + b, 0);
    const midSum = this.dataArray.slice(10, 100).reduce((a, b) => a + b, 0);
    const highSum = this.dataArray.slice(100, 200).reduce((a, b) => a + b, 0);
    
    return {
      bass: bassSum / 10,
      mid: midSum / 90,
      high: highSum / 100,
      overall: (bassSum / 10 + midSum / 90 + highSum / 100) / 3
    };
  }

  /**
   * Check if current audio seems like music (vs speech/video)
   * In manual mode, always returns true since user is watching music content
   */
  public isLikelyMusic(): boolean {
    // In manual mode, assume it's music content
    if (this.manualMode) {
      return true;
    }
    
    const freq = this.getFrequencyData();
    
    // Music typically has stronger bass and more consistent mid frequencies
    // Speech tends to have less bass and more variable patterns
    const bassToMidRatio = freq.bass / (freq.mid + 1);
    const overallEnergy = freq.overall;
    
    // Heuristic: Music has bass/mid ratio > 0.5 and decent overall energy
    return bassToMidRatio > 0.5 && overallEnergy > 30;
  }

  private detectLoop(): void {
    if (!this.isRunning) return;

    const now = performance.now();
    
    // Handle manual mode with simulated beats
    if (this.manualMode) {
      const beatInterval = 60000 / this.manualBpm; // ms per beat
      const timeSinceLastBeat = now - this.simulatedBeatTime;
      
      if (timeSinceLastBeat >= beatInterval) {
        this.simulatedBeatTime = now;
        
        // Simulate varying intensity for natural feel
        const intensity = 0.5 + Math.random() * 0.5;
        const simulatedFreq: FrequencyData = {
          bass: 150 + Math.random() * 100,
          mid: 100 + Math.random() * 50,
          high: 80 + Math.random() * 40,
          overall: 110 + Math.random() * 50
        };
        
        // Trigger callbacks
        for (const callback of this.onBeatCallbacks) {
          callback(intensity, simulatedFreq);
        }
      }
      
      this.animationFrameId = requestAnimationFrame(() => this.detectLoop());
      return;
    }

    // Real audio analysis mode
    const frequencies = this.getFrequencyData();
    const timeSinceLastBeat = now - this.lastBeatTime;
    
    // Beat detection based on bass and mid frequencies
    const isBeat = (
      (frequencies.bass > this.bassThreshold || frequencies.mid > this.midThreshold) &&
      timeSinceLastBeat > 200 // Minimum 200ms between beats (max 300 BPM)
    );

    if (isBeat) {
      this.lastBeatTime = now;
      this.updateBPM(timeSinceLastBeat);
      
      // Calculate intensity (0-1)
      const intensity = Math.min(1, (frequencies.bass + frequencies.mid) / 400);
      
      // Trigger callbacks
      for (const callback of this.onBeatCallbacks) {
        callback(intensity, frequencies);
      }
    }

    this.animationFrameId = requestAnimationFrame(() => this.detectLoop());
  }

  private updateBPM(beatInterval: number): void {
    if (beatInterval < 100 || beatInterval > 2000) return; // Ignore unrealistic intervals
    
    const currentBPM = 60000 / beatInterval;
    this.beatHistory.push(currentBPM);
    
    if (this.beatHistory.length > 8) {
      this.beatHistory.shift();
    }
    
    // Average BPM from recent beats
    this.bpm = this.beatHistory.reduce((a, b) => a + b, 0) / this.beatHistory.length;
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
    this.dataArray = null;
  }
}

export interface FrequencyData {
  bass: number;
  mid: number;
  high: number;
  overall: number;
}

// Singleton instance for global access
let beatDetectorInstance: BeatDetector | null = null;

export function getBeatDetector(): BeatDetector {
  if (!beatDetectorInstance) {
    beatDetectorInstance = new BeatDetector();
  }
  return beatDetectorInstance;
}
