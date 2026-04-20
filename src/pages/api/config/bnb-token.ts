import type { NextApiRequest, NextApiResponse } from 'next';

const DEFAULT_TOKEN_CA = '';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tokenCA = process.env.BNB_TOKEN_CA || DEFAULT_TOKEN_CA;
  const testTokenCA = process.env.BNB_TOKEN_CA_TEST || '0xd6423f99863e13b0a3fa00b5e1e5597792f74f8c';
  const chainId = process.env.BNB_CHAIN_ID || '56';
  const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
  
  return res.status(200).json({
    ca: tokenCA,
    testCa: testTokenCA,
    chainId: parseInt(chainId, 10),
    rpcUrl,
    configured: !!process.env.BNB_TOKEN_CA,
  });
}
