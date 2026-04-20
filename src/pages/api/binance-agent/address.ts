import type { NextApiRequest, NextApiResponse } from 'next';
import { binanceAgentSkills } from '@/features/market/binanceAgentSkills';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { address } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'address query param required' });
  }

  try {
    const insights = await binanceAgentSkills.getAddressInsights(address);
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=240');
    return res.status(200).json(insights);
  } catch (e: any) {
    console.error('[API] binance-agent/address error:', e);
    return res.status(500).json({ error: e.message || 'Failed to fetch address insights' });
  }
}
