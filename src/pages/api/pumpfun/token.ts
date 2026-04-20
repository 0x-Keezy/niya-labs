import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mint } = req.query;
  
  if (!mint || typeof mint !== 'string') {
    return res.status(400).json({ error: 'Missing mint address' });
  }

  // Try DexScreener first (most reliable, no Cloudflare blocking)
  try {
    console.log(`[Token Proxy] Trying DexScreener for ${mint.slice(0, 8)}...`);
    
    const dexResponse = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (dexResponse.ok) {
      const dexData = await dexResponse.json();
      
      if (dexData.pairs && dexData.pairs.length > 0) {
        const pair = dexData.pairs[0];
        const baseToken = pair.baseToken;
        
        // Safe parsing of price values (null means missing, 0 is valid)
        const priceUsd = pair.priceUsd !== undefined && pair.priceUsd !== null 
          ? parseFloat(pair.priceUsd) 
          : null;
        const priceNative = pair.priceNative !== undefined && pair.priceNative !== null 
          ? parseFloat(pair.priceNative) 
          : null;
        
        // Calculate SOL values only if we have valid non-zero prices for division
        let marketCapSol: number | null = null;
        let volumeSol: number | null = null;
        
        if (priceUsd !== null && priceNative !== null && priceNative > 0) {
          const solPrice = priceUsd / priceNative;
          if (pair.marketCap !== undefined && pair.marketCap !== null && solPrice > 0) {
            marketCapSol = pair.marketCap / solPrice;
          }
          if (pair.volume?.h24 !== undefined && pair.volume?.h24 !== null && solPrice > 0) {
            volumeSol = pair.volume.h24 / solPrice;
          }
        }
        
        console.log(`[Token Proxy] DexScreener success: ${baseToken.symbol}, MCap: $${pair.marketCap}`);
        
        return res.status(200).json({
          mint: baseToken.address || mint,
          name: baseToken.name || 'Unknown',
          symbol: baseToken.symbol || '???',
          description: null,
          imageUri: pair.info?.imageUrl,
          marketCapSol: marketCapSol ?? 0,
          marketCapUsd: pair.marketCap ?? 0,
          priceUsd: priceUsd ?? 0,
          priceNative: priceNative ?? 0,
          volume24h: pair.volume?.h24 ?? 0,
          volumeSol: volumeSol ?? 0,
          priceChange24h: pair.priceChange?.h24 ?? 0,
          fdv: pair.fdv ?? 0,
          dexId: pair.dexId,
          pairAddress: pair.pairAddress,
          complete: pair.dexId !== 'pumpfun',
          source: 'dexscreener',
        });
      }
    }
  } catch (e) {
    console.warn(`[Token Proxy] DexScreener failed:`, e);
  }

  // Fallback to pump.fun APIs
  const pumpEndpoints = [
    `https://frontend-api.pump.fun/coins/${mint}`,
  ];

  for (const url of pumpEndpoints) {
    try {
      console.log(`[Token Proxy] Trying: ${new URL(url).hostname}`);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`[Token Proxy] Success for ${mint.slice(0, 8)}:`, data.symbol);
        
        return res.status(200).json({
          mint: data.mint || mint,
          name: data.name || 'Unknown',
          symbol: data.symbol || '???',
          description: data.description,
          imageUri: data.image_uri,
          marketCapSol: data.market_cap,
          marketCapUsd: data.usd_market_cap,
          priceUsd: data.usd_market_cap && data.market_cap 
            ? data.usd_market_cap / data.market_cap 
            : undefined,
          volumeSol: data.volume_24h,
          complete: data.complete,
          bondingCurveKey: data.bonding_curve,
          source: 'pumpfun',
        });
      } else {
        console.warn(`[Token Proxy] ${new URL(url).hostname} returned ${response.status}`);
      }
    } catch (e) {
      console.warn(`[Token Proxy] ${url} failed:`, e);
    }
  }

  return res.status(404).json({ 
    error: 'Token not found or API unavailable',
    mint,
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
