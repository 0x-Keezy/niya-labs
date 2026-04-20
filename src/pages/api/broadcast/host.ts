import type { NextApiRequest, NextApiResponse } from 'next';

interface BroadcastState {
  hostId: string | null;
  hostConnectedAt: number;
  currentSubtitle: string;
  currentSpeaking: boolean;
  chatMessages: Array<{
    id: string;
    role: string;
    content: string;
    visitorName?: string;
    timestamp: number;
  }>;
}

const state: BroadcastState = {
  hostId: null,
  hostConnectedAt: 0,
  currentSubtitle: '',
  currentSpeaking: false,
  chatMessages: [],
};

interface ClientConnection {
  sendEvent: (data: any) => void;
  clientId: string | null;
}

const clients = new Set<ClientConnection>();

function broadcast(data: any): void {
  clients.forEach(client => {
    try {
      client.sendEvent(data);
    } catch {
      clients.delete(client);
    }
  });
}

function checkHostTimeout(): void {
  if (state.hostId && Date.now() - state.hostConnectedAt > 60000) {
    console.log('[Broadcast] Host timed out, clearing hostId');
    state.hostId = null;
    state.hostConnectedAt = 0;
    broadcast({ type: 'host-change', hostId: null, timestamp: Date.now() });
  }
}

// Check for host timeout every 30 seconds
setInterval(checkHostTimeout, 30000);

export function getBroadcastState(): BroadcastState {
  return state;
}

export function setBroadcastSubtitle(text: string, speaking: boolean): void {
  state.currentSubtitle = text;
  state.currentSpeaking = speaking;
  broadcast({
    type: 'subtitle',
    text,
    speaking,
    timestamp: Date.now(),
  });
}

export function addBroadcastChatMessage(message: {
  id: string;
  role: string;
  content: string;
  visitorName?: string;
}): void {
  const msg = { ...message, timestamp: Date.now() };
  state.chatMessages.push(msg);
  if (state.chatMessages.length > 100) {
    state.chatMessages = state.chatMessages.slice(-100);
  }
  broadcast({
    type: 'chat',
    message: msg,
    timestamp: Date.now(),
  });
}

export function isHostConnected(): boolean {
  if (!state.hostId) return false;
  const timeout = 60000;
  return Date.now() - state.hostConnectedAt < timeout;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const action = req.query.action as string;

    if (action === 'stream') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const sendEvent = (data: any) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      const clientId = (req.query.clientId as string) || null;
      const connection: ClientConnection = {
        sendEvent,
        clientId,
      };

      sendEvent({
        type: 'init',
        hostId: state.hostId,
        currentSubtitle: state.currentSubtitle,
        currentSpeaking: state.currentSpeaking,
        recentMessages: state.chatMessages.slice(-20),
        timestamp: Date.now(),
      });

      clients.add(connection);

      const keepAlive = setInterval(() => {
        res.write(': keepalive\n\n');
      }, 30000);

      req.on('close', () => {
        clearInterval(keepAlive);
        clients.delete(connection);
        
        // If the disconnecting client was the host, clear host and notify others
        if (clientId && state.hostId === clientId) {
          console.log('[Broadcast] Host disconnected from SSE, clearing hostId');
          state.hostId = null;
          state.hostConnectedAt = 0;
          broadcast({ type: 'host-change', hostId: null, timestamp: Date.now() });
        }
      });

      return;
    }

    return res.status(200).json({
      hostId: state.hostId,
      isHostConnected: isHostConnected(),
      clientCount: clients.size,
    });
  }

  if (req.method === 'POST') {
    const { action, clientId, text, speaking, message } = req.body;

    if (action === 'claim') {
      if (!isHostConnected() || state.hostId === clientId) {
        state.hostId = clientId;
        state.hostConnectedAt = Date.now();
        broadcast({ type: 'host-change', hostId: clientId, timestamp: Date.now() });
        return res.status(200).json({ success: true, isHost: true, hostId: clientId });
      }
      return res.status(200).json({ success: true, isHost: false, hostId: state.hostId });
    }

    if (action === 'heartbeat') {
      if (state.hostId === clientId) {
        state.hostConnectedAt = Date.now();
        return res.status(200).json({ success: true, isHost: true });
      }
      return res.status(200).json({ success: true, isHost: state.hostId === clientId });
    }

    if (action === 'release') {
      if (state.hostId === clientId) {
        state.hostId = null;
        state.hostConnectedAt = 0;
        broadcast({ type: 'host-change', hostId: null, timestamp: Date.now() });
        return res.status(200).json({ success: true });
      }
      return res.status(200).json({ success: false, error: 'Not the host' });
    }

    if (action === 'subtitle') {
      if (state.hostId === clientId) {
        setBroadcastSubtitle(text || '', speaking ?? false);
        return res.status(200).json({ success: true });
      }
      return res.status(403).json({ error: 'Not the host' });
    }

    if (action === 'chat') {
      if (state.hostId === clientId && message) {
        addBroadcastChatMessage(message);
        return res.status(200).json({ success: true });
      }
      return res.status(403).json({ error: 'Not the host or missing message' });
    }

    if (action === 'audio') {
      const { audioBase64, emotion } = req.body;
      if (state.hostId === clientId && audioBase64) {
        broadcast({
          type: 'audio',
          audioBase64,
          emotion,
          timestamp: Date.now(),
        });
        return res.status(200).json({ success: true });
      }
      return res.status(403).json({ error: 'Not the host or missing audio' });
    }

    // SYNCHRONIZED broadcast - sends chat message, subtitle, and audio all at once
    // This ensures all viewers receive everything simultaneously for a true "live show" experience
    if (action === 'sync') {
      const { audioBase64, emotion, subtitleText, chatMessage } = req.body;
      if (state.hostId !== clientId) {
        return res.status(403).json({ error: 'Not the host' });
      }
      
      // Update subtitle state
      if (subtitleText !== undefined) {
        state.currentSubtitle = subtitleText;
        state.currentSpeaking = true;
      }
      
      // Add chat message to state
      if (chatMessage) {
        const msg = { ...chatMessage, timestamp: Date.now() };
        state.chatMessages.push(msg);
        if (state.chatMessages.length > 100) {
          state.chatMessages = state.chatMessages.slice(-100);
        }
      }
      
      // Broadcast EVERYTHING in a single atomic event
      broadcast({
        type: 'sync',
        audioBase64: audioBase64 || null,
        emotion: emotion || null,
        subtitleText: subtitleText || '',
        chatMessage: chatMessage || null,
        speaking: true,
        timestamp: Date.now(),
      });
      
      return res.status(200).json({ success: true });
    }
    
    // Clear speaking state (called when audio finishes)
    if (action === 'sync-end') {
      if (state.hostId !== clientId) {
        return res.status(403).json({ error: 'Not the host' });
      }
      
      state.currentSpeaking = false;
      broadcast({
        type: 'sync-end',
        speaking: false,
        timestamp: Date.now(),
      });
      
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
