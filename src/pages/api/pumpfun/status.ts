import type { NextApiRequest, NextApiResponse } from 'next';
import { pumpfunApi } from '@/features/autonomy/pumpfunApi';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const isConnected = pumpfunApi.getConnectionStatus();
    const tradeStats = pumpfunApi.getTradeStats();
    
    res.status(200).json({
      isConnected,
      tradeStats,
      endpoints: {
        rest: 'https://pumpportal.fun/api',
        websocket: 'wss://pumpportal.fun/api/data',
      },
      devNote: 'PumpFun WebSocket state is in-memory. Works in dev mode with persistent server.',
    });
  } catch (error) {
    console.error('[PumpFun API] Status error:', error);
    res.status(500).json({ error: 'Failed to get PumpFun status' });
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
};
