type CacheEntry = {
  audio: ArrayBuffer;
  timestamp: number;
  size: number;
};

class TTSCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number = 50 * 1024 * 1024; // 50MB max cache
  private maxAge: number = 30 * 60 * 1000; // 30 minutes TTL
  private currentSize: number = 0;
  private maxEntries: number = 100;

  private generateKey(text: string, voiceId: string): string {
    const normalized = text.trim().toLowerCase();
    return `${voiceId}:${normalized}`;
  }

  get(text: string, voiceId: string): ArrayBuffer | null {
    const key = this.generateKey(text, voiceId);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      this.currentSize -= entry.size;
      return null;
    }

    entry.timestamp = Date.now();
    return entry.audio;
  }

  set(text: string, voiceId: string, audio: ArrayBuffer): void {
    const key = this.generateKey(text, voiceId);
    const size = audio.byteLength;

    if (size > this.maxSize / 2) {
      return;
    }

    while (this.currentSize + size > this.maxSize || this.cache.size >= this.maxEntries) {
      const oldestKey = this.findOldestEntry();
      if (!oldestKey) break;
      
      const entry = this.cache.get(oldestKey);
      if (entry) {
        this.currentSize -= entry.size;
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      audio,
      timestamp: Date.now(),
      size,
    });
    this.currentSize += size;
  }

  private findOldestEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  getStats(): { entries: number; size: number; maxSize: number } {
    return {
      entries: this.cache.size,
      size: this.currentSize,
      maxSize: this.maxSize,
    };
  }
}

class TTSRateLimiter {
  private lastRequest: number = 0;
  private minInterval: number = 500; // minimum 500ms between requests
  private inFlight: boolean = false;
  private queue: Array<{
    resolve: (value: boolean) => void;
    timestamp: number;
  }> = [];
  private maxQueueSize: number = 5;

  async acquire(): Promise<boolean> {
    if (this.queue.length >= this.maxQueueSize) {
      console.log('[TTS Rate Limiter] Queue full, dropping request');
      return false;
    }

    if (this.inFlight) {
      return new Promise((resolve) => {
        this.queue.push({ resolve, timestamp: Date.now() });
      });
    }

    const now = Date.now();
    const elapsed = now - this.lastRequest;
    
    if (elapsed < this.minInterval) {
      await new Promise(r => setTimeout(r, this.minInterval - elapsed));
    }

    this.inFlight = true;
    this.lastRequest = Date.now();
    return true;
  }

  release(): void {
    this.inFlight = false;
    
    const next = this.queue.shift();
    if (next) {
      setTimeout(() => {
        this.inFlight = true;
        this.lastRequest = Date.now();
        next.resolve(true);
      }, this.minInterval);
    }
  }

  setMinInterval(ms: number): void {
    this.minInterval = Math.max(100, ms);
  }
}

export const ttsCache = new TTSCache();
export const ttsRateLimiter = new TTSRateLimiter();
