// Global Audio Stream Manager for RTMP Streaming
// Manages audio routing from TTS to MediaRecorder for streaming

class AudioStreamManager {
  private audioContext: AudioContext | null = null;
  private streamDestination: MediaStreamAudioDestinationNode | null = null;
  private isEnabled: boolean = false;

  // Initialize the streaming audio context and return the audio stream
  public enable(): MediaStream {
    // If already enabled, return existing stream
    if (this.isEnabled && this.streamDestination) {
      console.log('[AudioStreamManager] Already enabled, returning existing stream');
      return this.streamDestination.stream;
    }
    
    // Close any existing context first to prevent leaks
    this.cleanup();
    
    // Create fresh context and destination
    this.audioContext = new AudioContext();
    this.streamDestination = this.audioContext.createMediaStreamDestination();
    this.isEnabled = true;
    
    console.log('[AudioStreamManager] Streaming audio enabled');
    return this.streamDestination.stream;
  }

  // Cleanup all resources - returns Promise to ensure AudioContext is fully closed
  private async cleanup(): Promise<void> {
    if (this.streamDestination) {
      try {
        // Stop all tracks on the stream
        this.streamDestination.stream.getTracks().forEach(track => {
          track.stop();
        });
      } catch (e) {
        // Ignore cleanup errors
      }
      this.streamDestination = null;
    }
    
    if (this.audioContext) {
      try {
        // Close the audio context and WAIT for it to complete
        await this.audioContext.close();
      } catch (e) {
        // Ignore cleanup errors
      }
      this.audioContext = null;
    }
  }

  // Disable streaming and cleanup all resources
  // Returns a Promise to ensure AudioContext is fully torn down before new enable()
  public async disable(): Promise<void> {
    if (!this.isEnabled) {
      return;
    }
    
    // Mark as disabled first to prevent race conditions
    this.isEnabled = false;
    
    // Wait for cleanup to complete
    await this.cleanup();
    console.log('[AudioStreamManager] Streaming audio disabled');
  }

  // Get the audio stream for MediaRecorder
  public getAudioStream(): MediaStream | null {
    return this.streamDestination?.stream || null;
  }

  // Check if streaming is enabled
  public isStreamingEnabled(): boolean {
    return this.isEnabled && this.audioContext !== null && this.streamDestination !== null;
  }

  // Get the audio context (for creating sources in the same context)
  public getAudioContext(): AudioContext | null {
    if (!this.isEnabled) return null;
    return this.audioContext;
  }

  // Get the stream destination node (for connecting audio sources)
  public getStreamDestination(): MediaStreamAudioDestinationNode | null {
    if (!this.isEnabled) return null;
    return this.streamDestination;
  }
}

// Global singleton instance
export const audioStreamManager = new AudioStreamManager();

// Expose globally for access from LipSync and other contexts
if (typeof window !== 'undefined') {
  (window as any).__audioStreamManager = audioStreamManager;
}
