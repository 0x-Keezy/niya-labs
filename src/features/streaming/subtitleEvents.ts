// Subtitle event system for streaming Niya's messages

type SubtitleCallback = (message: string) => void;

class SubtitleEvents {
  private callbacks: Set<SubtitleCallback> = new Set();
  private currentMessage: string = '';
  private clearTimer: NodeJS.Timeout | null = null;

  subscribe(callback: SubtitleCallback): () => void {
    this.callbacks.add(callback);
    
    // Send current message if exists
    if (this.currentMessage) {
      callback(this.currentMessage);
    }
    
    return () => {
      this.callbacks.delete(callback);
    };
  }

  emit(message: string): void {
    // Clean message - remove emotion tags like [happy], [neutral], etc.
    const cleanMessage = message.replace(/\[[a-zA-Z]+\]/g, '').trim();
    
    if (!cleanMessage) return;
    
    this.currentMessage = cleanMessage;
    
    // Notify all subscribers
    this.callbacks.forEach(cb => {
      try {
        cb(cleanMessage);
      } catch (e) {
        // Ignore callback errors
      }
    });

    // Auto-clear after 15 seconds (gives time to read)
    if (this.clearTimer) {
      clearTimeout(this.clearTimer);
    }
    this.clearTimer = setTimeout(() => {
      this.clear();
    }, 15000);
  }

  clear(): void {
    this.currentMessage = '';
    this.callbacks.forEach(cb => {
      try {
        cb('');
      } catch (e) {
        // Ignore
      }
    });
  }

  getCurrentMessage(): string {
    return this.currentMessage;
  }
}

export const subtitleEvents = new SubtitleEvents();

// Expose globally for easy access
if (typeof window !== 'undefined') {
  (window as any).__subtitleEvents = subtitleEvents;
}
