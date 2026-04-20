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
    const trades = pumpfunApi.getTradeLog();
    const stats = pumpfunApi.getTradeStats();
    
    res.status(200).json({
      trades,
      stats,
    });
  } catch (error) {
    console.error('[PumpFun API] Trades error:', error);
    res.status(500).json({ error: 'Failed to get trade log' });
  }
}
