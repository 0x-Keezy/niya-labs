import type { NextApiRequest, NextApiResponse } from 'next';
import { pumpfunApi } from '@/features/autonomy/pumpfunApi';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.body;

  try {
    if (action === 'connect') {
      await pumpfunApi.connectWebSocket();
      res.status(200).json({ 
        success: true, 
        message: 'Connected to PumpFun WebSocket',
        isConnected: pumpfunApi.getConnectionStatus(),
      });
    } else if (action === 'disconnect') {
      pumpfunApi.disconnect();
      res.status(200).json({ 
        success: true, 
        message: 'Disconnected from PumpFun WebSocket',
        isConnected: false,
      });
    } else {
      res.status(400).json({ error: 'Invalid action. Use "connect" or "disconnect"' });
    }
  } catch (error) {
    console.error('[PumpFun API] Connect error:', error);
    res.status(500).json({ 
      error: 'Failed to manage PumpFun connection',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
