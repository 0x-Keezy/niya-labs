type BroadcastCallback = (data: any) => void;

interface BroadcastState {
  clientId: string;
  currentSubtitle: string;
  currentSpeaking: boolean;
  connected: boolean;
  clientCount: number;
}

interface PendingAudio {
  id: number;
  audioData: string;
  text: string;
  emotion: string;
  duration: number;
  status: string;
  createdAt: number;
}

class BroadcastManager {
  private eventSource: EventSource | null = null;
  private listeners = new Set<BroadcastCallback>();
  private state: BroadcastState;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastPollTime: number = 0;
  private processedAudioIds = new Set<number>();
  private sseFailCount: number = 0;
  private usePolling: boolean = false;
  private pollingAlwaysActive: boolean = true; // Always poll in parallel with SSE for production reliability

  constructor() {
    this.state = {
      clientId: this.generateClientId(),
      currentSubtitle: '',
      currentSpeaking: false,
      connected: false,
      clientCount: 0,
    };
  }

  private generateClientId(): string {
    if (typeof window !== 'undefined') {
      let id = sessionStorage.getItem('broadcast-client-id');
      if (!id) {
        id = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('broadcast-client-id', id);
      }
      return id;
    }
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getState(): BroadcastState {
    return { ...this.state };
  }

  getClientId(): string {
    return this.state.clientId;
  }

  subscribe(callback: BroadcastCallback): () => void {
    this.listeners.add(callback);

    if (typeof window !== 'undefined' && !this.eventSource && !this.pollInterval) {
      this.connect();
    }

    return () => {
      this.listeners.delete(callback);
      
      if (this.listeners.size === 0) {
        console.log('[Broadcast] No listeners remaining, stopping connections');
        this.disconnect();
        this.stopPolling();
      }
    };
  }

  private connect(): void {
    // In production (Replit serverless), SSE connections may stay "connected" 
    // but never emit events. Always start polling immediately for reliability.
    if (this.pollingAlwaysActive && !this.pollInterval) {
      console.log('[Broadcast] Starting parallel polling for production reliability...');
      this.startPolling();
    }

    if (this.usePolling) {
      // Pure polling mode - no SSE, but ensure polling is running
      if (!this.pollInterval) {
        console.log('[Broadcast] Restarting polling after reconnect...');
        this.startPolling();
      }
      return;
    }

    if (this.eventSource) return;

    console.log('[Broadcast] Connecting to server-based broadcast stream...');
    
    this.eventSource = new EventSource(
      `/api/broadcast/speak?action=stream&clientId=${encodeURIComponent(this.state.clientId)}`
    );

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // SSE received data - process it (polling will dedupe via processedAudioIds)
        this.handleMessage(data);
        this.sseFailCount = 0;
      } catch {
        console.warn('[Broadcast] Failed to parse message');
      }
    };

    this.eventSource.onerror = () => {
      this.sseFailCount++;
      console.warn(`[Broadcast] SSE error (count: ${this.sseFailCount})`);
      this.disconnect();
      
      if (this.sseFailCount >= 3) {
        console.log('[Broadcast] SSE failed multiple times, using pure polling mode');
        this.usePolling = true;
        // Polling already active via pollingAlwaysActive
        return;
      }
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
      }
      
      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, 3000);
    };

    this.eventSource.onopen = () => {
      this.state.connected = true;
      this.sseFailCount = 0;
      console.log('[Broadcast] SSE connected (polling also active for reliability)');
    };
  }

  private startPolling(): void {
    if (this.pollInterval) return;
    
    console.log('[Broadcast] Starting HTTP polling mode...');
    this.state.connected = true;
    this.lastPollTime = Date.now() - 30000;
    
    this.poll();
    
    this.pollInterval = setInterval(() => {
      this.poll();
    }, 1000);
  }

  private async poll(): Promise<void> {
    try {
      const response = await fetch(`/api/broadcast/speak?action=poll&since=${this.lastPollTime}`);
      
      if (!response.ok) {
        console.warn('[Broadcast] Poll failed:', response.status);
        return;
      }
      
      const data = await response.json();
      
      const wasSpeaking = this.state.currentSpeaking;
      this.state.currentSpeaking = data.isSpeaking;
      this.state.currentSubtitle = data.currentSubtitle || '';
      
      // Always emit subtitle state from server - this ensures all clients show same subtitle
      // even if they already processed the audio
      if (data.isSpeaking && data.currentSubtitle) {
        this.notifyListeners({
          type: 'subtitle',
          text: data.currentSubtitle,
          speaking: true,
        });
      } else if (wasSpeaking && !data.isSpeaking) {
        // Speaking just ended - clear subtitle
        this.notifyListeners({
          type: 'sync-end',
          speaking: false,
        });
      }
      
      if (data.pendingAudio && data.pendingAudio.length > 0) {
        for (const audio of data.pendingAudio) {
          // Use audio.id for deduplication - this is the same database ID that SSE uses as broadcastId
          const pollAudioId = audio.id;
          if (this.processedAudioIds.has(pollAudioId)) {
            console.log('[Broadcast] Poll sync already processed, skipping duplicate id:', pollAudioId);
            continue;
          }
          
          // Add to processed set BEFORE notifying listeners to prevent race conditions
          this.processedAudioIds.add(pollAudioId);
          console.log('[Broadcast] Poll added to processedAudioIds:', pollAudioId, 'set size:', this.processedAudioIds.size);
          
          console.log('[Broadcast] Processing audio from poll:', pollAudioId);
          
          this.notifyListeners({
            type: 'sync',
            id: audio.id,
            audioBase64: audio.audioData,
            emotion: audio.emotion,
            subtitleText: audio.text,
            speaking: true,
            timestamp: audio.createdAt,
          });
          
          // NOTE: Do NOT use client-side setTimeout to emit sync-end.
          // This causes desync between clients because each client's timer runs independently.
          // Instead, we rely on the server's isSpeaking=false transition (handled above in poll())
          // which ensures all clients clear subtitles at the same time.
        }
      }
      
      if (this.processedAudioIds.size > 100) {
        const idsArray = Array.from(this.processedAudioIds);
        this.processedAudioIds = new Set(idsArray.slice(-50));
      }
      
      this.lastPollTime = data.serverTime || Date.now();
    } catch (e) {
      console.warn('[Broadcast] Poll error:', e);
    }
  }

  private disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.state.connected = false;
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  private handleMessage(data: any): void {
    switch (data.type) {
      case 'init':
        this.state.currentSubtitle = data.currentSubtitle || '';
        this.state.currentSpeaking = data.currentSpeaking || false;
        this.state.clientCount = data.clientCount || 0;
        
        this.notifyListeners({
          type: 'init',
          subtitle: data.currentSubtitle,
          speaking: data.currentSpeaking,
          recentBroadcasts: data.recentBroadcasts || [],
          clientCount: data.clientCount,
        });
        
        if (data.recentBroadcasts && data.recentBroadcasts.length > 0) {
          console.log('[Broadcast] Received recent broadcasts for late-joiner catch-up');
        }
        break;

      case 'subtitle':
        this.state.currentSubtitle = data.text;
        this.state.currentSpeaking = data.speaking;
        this.notifyListeners({
          type: 'subtitle',
          text: data.text,
          speaking: data.speaking,
        });
        break;

      case 'sync':
        // Track broadcast ID to prevent duplicate processing when polling is also active
        // Use broadcastId from SSE - this is the database audio.id
        const sseAudioId = data.broadcastId;
        if (sseAudioId && this.processedAudioIds.has(sseAudioId)) {
          console.log('[Broadcast] SSE sync already processed, skipping duplicate id:', sseAudioId);
          break;
        }
        
        // Add to processed set BEFORE notifying listeners to prevent race conditions
        if (sseAudioId) {
          this.processedAudioIds.add(sseAudioId);
          console.log('[Broadcast] SSE added to processedAudioIds:', sseAudioId, 'set size:', this.processedAudioIds.size);
        }
        
        console.log('[Broadcast] Processing SYNC from SSE, id:', sseAudioId);
        this.state.currentSubtitle = data.subtitleText || '';
        this.state.currentSpeaking = data.speaking;
        this.notifyListeners({
          type: 'sync',
          broadcastId: data.broadcastId,
          audioBase64: data.audioBase64,
          emotion: data.emotion,
          subtitleText: data.subtitleText,
          chatMessage: data.chatMessage,
          speaking: data.speaking,
          timestamp: data.timestamp,
        });
        break;
        
      case 'sync-end':
        this.state.currentSpeaking = false;
        this.notifyListeners({
          type: 'sync-end',
          speaking: false,
        });
        break;
    }
  }

  private notifyListeners(data: any): void {
    this.listeners.forEach(cb => {
      try {
        cb(data);
      } catch (e) {
        console.error('[Broadcast] Listener error:', e);
      }
    });
  }

  async serverSpeak(params: {
    text: string;
    voiceId?: string;
    emotion?: string;
    subtitleText?: string;
    chatMessage?: {
      id: number;
      role: string;
      content: string;
      visitorName?: string;
    };
  }): Promise<{ success: boolean; fromCache?: boolean; error?: string }> {
    try {
      console.log('[Broadcast] Requesting server-side TTS and broadcast...');
      
      const response = await fetch('/api/broadcast/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'speak',
          text: params.text,
          voiceId: params.voiceId,
          emotion: params.emotion,
          subtitleText: params.subtitleText || params.text,
          chatMessage: params.chatMessage,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('[Broadcast] Server speak failed:', data.error);
        return { success: false, error: data.error };
      }

      console.log('[Broadcast] Server speak success, from cache:', data.fromCache, 'broadcast id:', data.broadcastId);
      return { success: true, fromCache: data.fromCache };
    } catch (e: any) {
      console.error('[Broadcast] Server speak error:', e);
      return { success: false, error: e.message };
    }
  }

  async serverSpeakEnd(): Promise<void> {
    try {
      await fetch('/api/broadcast/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'speak-end' }),
      });
    } catch (e) {
      console.error('[Broadcast] Server speak-end error:', e);
    }
  }

  isHost(): boolean {
    return true;
  }

  async broadcastSubtitle(text: string, speaking: boolean): Promise<void> {
    try {
      await fetch('/api/broadcast/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'subtitle-only',
          text,
          speaking,
        }),
      });
    } catch (e) {
      console.error('[Broadcast] Failed to broadcast subtitle:', e);
    }
  }

  async broadcastChatMessage(message: {
    id: string;
    role: string;
    content: string;
    visitorName?: string;
  }): Promise<void> {
  }

  async broadcastAudio(audioBuffer: ArrayBuffer, emotion?: string): Promise<void> {
  }
  
  async broadcastSync(params: {
    audioBuffer?: ArrayBuffer;
    emotion?: string;
    subtitleText: string;
    chatMessage?: {
      id: number;
      role: string;
      content: string;
      visitorName?: string;
    };
  }): Promise<void> {
  }
  
  async broadcastSyncEnd(): Promise<void> {
    await this.serverSpeakEnd();
  }
}

export const broadcastManager = new BroadcastManager();
