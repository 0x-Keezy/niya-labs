import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const walletAddress = process.env.BNB_WALLET_ADDRESS || process.env.BNB_WALLET_ADDRESS_TEST || null;
  const configured = !!process.env.BNB_WALLET_ADDRESS;

  return res.status(200).json({
    walletAddress,
    configured,
    chain: 'bnb',
    chainId: process.env.BNB_CHAIN_ID || '56',
  });
}
