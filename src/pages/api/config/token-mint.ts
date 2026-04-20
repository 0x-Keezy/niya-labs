import type { NextApiRequest, NextApiResponse } from 'next';

// Default fallback token (can be empty when waiting for user to configure)
const DEFAULT_TOKEN_MINT = '';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get token mint from environment variable, fallback to default
  const tokenMint = process.env.NIYA_TOKEN_MINT || DEFAULT_TOKEN_MINT;
  
  // Return the configured token mint
  return res.status(200).json({
    mint: tokenMint,
    configured: !!process.env.NIYA_TOKEN_MINT,
  });
}
