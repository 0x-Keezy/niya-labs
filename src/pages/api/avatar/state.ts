import type { NextApiRequest, NextApiResponse } from 'next';

interface AvatarState {
  emotion?: string;
  speaking?: boolean;
  text?: string;
  lipSyncValue?: number;
  expression?: string;
  motion?: string;
  timestamp: number;
}

const clients = new Set<(data: AvatarState) => void>();
let latestState: AvatarState = { timestamp: 0 };

export function broadcastAvatarState(state: AvatarState): void {
  latestState = { ...state, timestamp: Date.now() };
  clients.forEach(callback => {
    try {
      callback(latestState);
    } catch {
      clients.delete(callback);
    }
  });
}

export { latestState };

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sendEvent = (data: AvatarState) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    if (latestState.timestamp > 0) {
      sendEvent(latestState);
    }

    clients.add(sendEvent);

    const keepAlive = setInterval(() => {
      res.write(': keepalive\n\n');
    }, 30000);

    req.on('close', () => {
      clearInterval(keepAlive);
      clients.delete(sendEvent);
    });

    return;
  }

  if (req.method === 'POST') {
    const state = req.body as AvatarState;
    broadcastAvatarState(state);
    return res.status(200).json({ success: true, clients: clients.size });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
