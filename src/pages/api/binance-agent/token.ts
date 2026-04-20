import type { NextApiRequest, NextApiResponse } from 'next';
import { binanceAgentSkills } from '@/features/market/binanceAgentSkills';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { symbol } = req.query;

  if (!symbol || typeof symbol !== 'string') {
    return res.status(400).json({ error: 'symbol query param required' });
  }

  try {
    const details = await binanceAgentSkills.getTokenDetails(symbol);
    if (!details) {
      return res.status(404).json({ error: `Token ${symbol} not found on Binance` });
    }
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json(details);
  } catch (e: any) {
    console.error('[API] binance-agent/token error:', e);
    return res.status(500).json({ error: e.message || 'Failed to fetch token details' });
  }
}
