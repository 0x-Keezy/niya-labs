const BROADCAST_ENDPOINT = '/api/broadcast/audio';

export interface BroadcastAudioState {
  isSpeaking: boolean;
  currentAudio: {
    id: number;
    text: string;
    audioData: string | null;
    emotion: string | null;
    duration: number | null;
    currentTime: number;
  } | null;
  emotion: string;
  lipSyncData: any;
  serverTime: number;
}

class AudioBroadcastClient {
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;
  private lastAudioId: number | null = null;
  private listeners: Set<(state: BroadcastAudioState) => void> = new Set();
  private audioElement: HTMLAudioElement | null = null;

  public startPolling(intervalMs = 500) {
    if (this.isPolling) return;
    this.isPolling = true;
    
    this.pollInterval = setInterval(() => {
      this.fetchState();
    }, intervalMs);

    this.fetchState();
  }

  public stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.isPolling = false;
  }

  public addListener(callback: (state: BroadcastAudioState) => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private async fetchState() {
    try {
      const response = await fetch(BROADCAST_ENDPOINT);
      if (!response.ok) return;
      
      const state: BroadcastAudioState = await response.json();
      
      if (state.currentAudio && state.currentAudio.id !== this.lastAudioId) {
        this.lastAudioId = state.currentAudio.id;
        await this.playAudio(state);
      }
      
      this.notifyListeners(state);
    } catch (error) {
      console.error('[AudioBroadcast] Error fetching state:', error);
    }
  }

  private async playAudio(state: BroadcastAudioState) {
    if (!state.currentAudio?.audioData) return;

    try {
      if (this.audioElement) {
        this.audioElement.pause();
      }

      this.audioElement = new Audio(`data:audio/mpeg;base64,${state.currentAudio.audioData}`);
      
      const offsetMs = state.currentAudio.currentTime;
      if (offsetMs > 0 && state.currentAudio.duration) {
        this.audioElement.currentTime = offsetMs / 1000;
      }

      await this.audioElement.play();
      console.log('[AudioBroadcast] Playing synchronized audio');
    } catch (error) {
      console.error('[AudioBroadcast] Error playing audio:', error);
    }
  }

  private notifyListeners(state: BroadcastAudioState) {
    this.listeners.forEach(listener => listener(state));
  }

  public async startBroadcast(audioData: string, text: string, emotion?: string, duration?: number): Promise<number | null> {
    try {
      const response = await fetch(BROADCAST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          audioData,
          text,
          emotion,
          duration,
        }),
      });

      if (!response.ok) {
        console.error('[AudioBroadcast] Failed to start broadcast');
        return null;
      }

      const result = await response.json();
      console.log('[AudioBroadcast] Started broadcast:', result.audioId);
      return result.audioId;
    } catch (error) {
      console.error('[AudioBroadcast] Error starting broadcast:', error);
      return null;
    }
  }

  public async stopBroadcast(): Promise<boolean> {
    try {
      const response = await fetch(BROADCAST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });

      return response.ok;
    } catch (error) {
      console.error('[AudioBroadcast] Error stopping broadcast:', error);
      return false;
    }
  }

  public async updateEmotion(emotion: string): Promise<boolean> {
    try {
      const response = await fetch(BROADCAST_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'emotion', emotion }),
      });

      return response.ok;
    } catch (error) {
      console.error('[AudioBroadcast] Error updating emotion:', error);
      return false;
    }
  }
}

export const audioBroadcastClient = new AudioBroadcastClient();
