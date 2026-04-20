export interface ChatMessage {
  id?: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
  emotion?: string;
  visitorId?: string;
  visitorName?: string;
  isPublic?: boolean;
}

export interface ChatSession {
  id?: number;
  sessionId: string;
  visitorId?: string;
  title?: string;
  startedAt?: Date;
  lastMessageAt?: Date;
}

const getVisitorId = (): string => {
  if (typeof window === 'undefined') return 'server';
  let visitorId = localStorage.getItem('niya_visitor_id');
  if (!visitorId) {
    visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('niya_visitor_id', visitorId);
  }
  return visitorId;
};

const apiCall = async (action: string, method: string = 'GET', body?: any, params?: Record<string, string>) => {
  const url = new URL(`/api/memory`, window.location.origin);
  url.searchParams.set('action', action);
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const options: RequestInit = { method };
  if (body && method === 'POST') {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
};

export const memoryStore = {
  async saveMessage(message: Omit<ChatMessage, 'id'>): Promise<number> {
    const visitorId = getVisitorId();
    const { timestamp, ...rest } = message;
    const saved = await apiCall('saveMessage', 'POST', {
      ...rest,
      visitorId: message.visitorId || visitorId,
    });
    return saved.id;
  },

  async getMessages(sessionId?: string, limit = 50): Promise<ChatMessage[]> {
    const visitorId = getVisitorId();
    const messages = await apiCall('getMessages', 'GET', null, { visitorId, limit: String(limit) });
    return messages.map((m: any) => ({
      ...m,
      timestamp: new Date(m.createdAt).getTime(),
    })).reverse();
  },

  async getAllMessages(limit = 100): Promise<ChatMessage[]> {
    const messages = await apiCall('getMessages', 'GET', null, { limit: String(limit) });
    return messages.map((m: any) => ({
      ...m,
      timestamp: new Date(m.createdAt).getTime(),
    })).reverse();
  },

  async clearSession(sessionId: string): Promise<void> {
    console.log('clearSession not implemented for PostgreSQL yet');
  },

  async clearAllMessages(): Promise<void> {
    console.log('clearAllMessages not implemented for PostgreSQL yet');
  },

  async createSession(title?: string): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const visitorId = getVisitorId();
    await apiCall('createSession', 'POST', {
      sessionId,
      visitorId,
      title: title || `Chat ${new Date().toLocaleDateString()}`,
    });
    return sessionId;
  },

  async getSessions(limit = 20): Promise<ChatSession[]> {
    return [];
  },

  async updateSessionLastMessage(sessionId: string): Promise<void> {
  },

  async getOrCreateCurrentSession(): Promise<string> {
    return this.createSession();
  },

  async getRecentContext(sessionId: string, messageCount = 10): Promise<ChatMessage[]> {
    return this.getMessages(sessionId, messageCount);
  },

  async saveFact(factType: string, content: string, importance = 5): Promise<void> {
    const visitorId = getVisitorId();
    await apiCall('saveFact', 'POST', { visitorId, factType, content, importance });
  },

  async getFacts(limit = 20): Promise<any[]> {
    const visitorId = getVisitorId();
    return apiCall('getFacts', 'GET', null, { visitorId, limit: String(limit) });
  },

  async saveEmotionalState(emotion: string, intensity: number, trigger?: string): Promise<void> {
    const visitorId = getVisitorId();
    await apiCall('saveEmotionalState', 'POST', { visitorId, emotion, intensity, trigger });
  },

  async getEmotionalHistory(limit = 10): Promise<any[]> {
    const visitorId = getVisitorId();
    return apiCall('getEmotionalHistory', 'GET', null, { visitorId, limit: String(limit) });
  },

  async registerViewer(name: string): Promise<void> {
    const visitorId = getVisitorId();
    await apiCall('upsertViewer', 'POST', { visitorId, name });
  },

  async getActiveViewers(): Promise<any[]> {
    return apiCall('getActiveViewers', 'GET', null, { sinceMinutes: '5' });
  }
};

export default memoryStore;
