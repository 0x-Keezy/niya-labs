import type { NextApiRequest, NextApiResponse } from 'next';

const JUPITER_API_URL = 'https://api.jup.ag';
const JUPITER_PRICE_API = 'https://api.jup.ag/price/v3';

// Solana base58 mint addresses are 32-44 chars with no 0/O/I/l.
const SOLANA_MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SOLANA_MINT_LIST_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}(,[1-9A-HJ-NP-Za-km-z]{32,44})*$/;
const SLIPPAGE_RE = /^\d{1,5}$/;
const AMOUNT_RE = /^\d{1,20}$/;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const apiKey = process.env.JUPITER_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ 
      success: false, 
      error: 'JUPITER_API_KEY not configured' 
    });
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  };

  try {
    if (req.method === 'GET') {
      const { action, ids, inputMint, outputMint, amount, slippageBps } = req.query;

      if (action === 'price' || (!action && ids)) {
        const tokenIds = typeof ids === 'string' ? ids : (ids as string[])?.join(',') || '';

        if (!tokenIds) {
          return res.status(400).json({ success: false, error: 'Missing ids parameter' });
        }

        // Prevent parameter injection into the upstream URL — only accept a
        // comma-separated list of valid Solana mint addresses.
        if (!SOLANA_MINT_LIST_RE.test(tokenIds)) {
          return res.status(400).json({ success: false, error: 'Invalid ids format' });
        }

        const response = await fetch(
          `${JUPITER_PRICE_API}?ids=${encodeURIComponent(tokenIds)}`,
          { headers },
        );
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Jupiter Proxy] Price API error:', response.status, errorText);
          return res.status(response.status).json({ 
            success: false, 
            error: `Jupiter API error: ${response.status}`,
            details: errorText
          });
        }

        const rawData = await response.json();
        
        // v3 format: { "mint": { usdPrice, priceChange24h, ... } }
        // Transform to v2-compatible format for backwards compatibility
        const transformedData: Record<string, { price: string; priceChange24h?: number }> = {};
        const requestedIds = tokenIds.split(',');
        const missingIds: string[] = [];
        
        for (const [mint, info] of Object.entries(rawData)) {
          const priceInfo = info as { usdPrice?: number; priceChange24h?: number };
          if (priceInfo.usdPrice !== undefined) {
            transformedData[mint] = {
              price: String(priceInfo.usdPrice),
              priceChange24h: priceInfo.priceChange24h,
            };
          }
        }
        
        // Track missing tokens for transparency
        for (const id of requestedIds) {
          if (!transformedData[id]) {
            missingIds.push(id);
          }
        }
        
        return res.status(200).json({ 
          success: true, 
          data: transformedData,
          missingIds: missingIds.length > 0 ? missingIds : undefined,
        });
      }

      if (action === 'quote') {
        if (!inputMint || !outputMint || !amount) {
          return res.status(400).json({
            success: false,
            error: 'Missing required parameters: inputMint, outputMint, amount'
          });
        }

        // Validate all user-controlled query fragments before composing the
        // upstream URL to block parameter injection.
        const inMint = String(inputMint);
        const outMint = String(outputMint);
        const amt = String(amount);
        const slippage = String(slippageBps ?? '50');
        if (
          !SOLANA_MINT_RE.test(inMint) ||
          !SOLANA_MINT_RE.test(outMint) ||
          !AMOUNT_RE.test(amt) ||
          !SLIPPAGE_RE.test(slippage)
        ) {
          return res.status(400).json({
            success: false,
            error: 'Invalid quote parameters',
          });
        }

        const quoteUrl = `${JUPITER_API_URL}/quote?inputMint=${inMint}&outputMint=${outMint}&amount=${amt}&slippageBps=${slippage}`;

        const response = await fetch(quoteUrl, { headers });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Jupiter Proxy] Quote API error:', response.status, errorText);
          return res.status(response.status).json({ 
            success: false, 
            error: `Jupiter quote API error: ${response.status}` 
          });
        }

        const data = await response.json();
        return res.status(200).json({ success: true, data });
      }

      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    if (req.method === 'POST') {
      const { action, ...params } = req.body;

      if (action === 'swap') {
        return res.status(501).json({ 
          success: false, 
          error: 'Swap execution not implemented in proxy (requires wallet signing)' 
        });
      }

      return res.status(400).json({ success: false, error: 'Invalid POST action' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[Jupiter Proxy] Error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
}
