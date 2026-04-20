import type { NextApiRequest, NextApiResponse } from 'next';
import { binanceAgentSkills } from '@/features/market/binanceAgentSkills';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const limit = Math.min(parseInt(req.query.limit as string || '10'), 20);
    const memes = await binanceAgentSkills.getMemeTokenTracking(limit);
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(memes);
  } catch (e: any) {
    console.error('[API] binance-agent/meme error:', e);
    return res.status(500).json({ error: e.message || 'Failed to fetch meme tokens' });
  }
}
