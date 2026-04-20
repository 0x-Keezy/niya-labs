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
    const risk = await binanceAgentSkills.checkContractRisk(address);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(risk);
  } catch (e: any) {
    console.error('[API] binance-agent/risk error:', e);
    return res.status(500).json({ error: e.message || 'Failed to check contract risk' });
  }
}
