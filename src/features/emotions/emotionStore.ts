import { EmotionState, Mood, EmotionTriggerSource } from './types';

type EmotionListener = (state: EmotionState) => void;

class EmotionStore {
  private state: EmotionState = {
    mood: 'calm',
    intensity: 0.5,
    reason: 'default',
    source: 'system',
    timestamp: Date.now(),
  };
  
  private listeners: Set<EmotionListener> = new Set();
  private decayTimer: NodeJS.Timeout | null = null;
  private decayIntervalMs = 5000;
  private decayRate = 0.1;

  getState(): EmotionState {
    return { ...this.state };
  }

  getMood(): Mood {
    return this.state.mood;
  }

  getIntensity(): number {
    return this.state.intensity;
  }

  setEmotion(
    mood: Mood,
    intensity: number,
    reason: string,
    source: EmotionTriggerSource = 'system'
  ): void {
    const clampedIntensity = Math.max(0, Math.min(1, intensity));
    
    this.state = {
      mood,
      intensity: clampedIntensity,
      reason,
      source,
      timestamp: Date.now(),
    };

    this.notifyListeners();
    this.startDecay();
  }

  subscribe(listener: EmotionListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(currentState);
      } catch (e) {
        console.warn('[EmotionStore] Listener error:', e);
      }
    });
  }

  private startDecay(): void {
    if (this.decayTimer) {
      clearInterval(this.decayTimer);
    }

    this.decayTimer = setInterval(() => {
      if (this.state.intensity <= 0.3 && this.state.mood !== 'calm') {
        this.state = {
          ...this.state,
          mood: 'calm',
          intensity: 0.5,
          reason: 'relaxed',
          timestamp: Date.now(),
        };
        this.notifyListeners();
        
        if (this.decayTimer) {
          clearInterval(this.decayTimer);
          this.decayTimer = null;
        }
      } else if (this.state.intensity > 0.3) {
        this.state = {
          ...this.state,
          intensity: Math.max(0.3, this.state.intensity - this.decayRate),
        };
        this.notifyListeners();
      }
    }, this.decayIntervalMs);
  }

  reset(): void {
    if (this.decayTimer) {
      clearInterval(this.decayTimer);
      this.decayTimer = null;
    }
    
    this.state = {
      mood: 'calm',
      intensity: 0.5,
      reason: 'reset',
      source: 'system',
      timestamp: Date.now(),
    };
    
    this.notifyListeners();
  }
}

export const emotionStore = new EmotionStore();
