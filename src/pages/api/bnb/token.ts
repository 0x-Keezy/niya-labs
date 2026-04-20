import type { NextApiRequest, NextApiResponse } from 'next';

interface TokenData {
  ca: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  phase: string;
  bondingProgress: number;
  liquidity: number;
  source: string;
  fetchedAt: number;
}

interface CacheEntry {
  data: TokenData;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

function getCachedData(ca: string): TokenData | null {
  const entry = cache.get(ca.toLowerCase());
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL_MS) {
    return null;
  }
  
  return entry.data;
}

function setCachedData(ca: string, data: TokenData): void {
  cache.set(ca.toLowerCase(), {
    data,
    timestamp: Date.now(),
  });
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFromGeckoTerminal(ca: string, attempt: number = 1): Promise<TokenData> {
  try {
    const response = await fetch(`https://api.geckoterminal.com/api/v2/networks/bsc/tokens/${ca}`, {
      headers: { 
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`GeckoTerminal returned ${response.status}`);
    }

    const data = await response.json();
    const attrs = data.data?.attributes;
    
    if (!attrs) {
      throw new Error('No token data from GeckoTerminal');
    }

    const launchpad = attrs.launchpad_details;
    const isGraduated = launchpad?.completed === true;
    
    const tokenData: TokenData = {
      ca,
      name: attrs.name || 'Unknown',
      symbol: attrs.symbol || 'UNKNOWN',
      price: parseFloat(attrs.price_usd) || 0,
      marketCap: parseFloat(attrs.fdv_usd) || 0,
      volume24h: parseFloat(attrs.volume_usd?.h24) || 0,
      change24h: parseFloat(attrs.price_change_percentage?.h24) || 0,
      phase: isGraduated ? 'graduated' : 'bonding',
      bondingProgress: launchpad?.graduation_percentage || (isGraduated ? 100 : 0),
      liquidity: parseFloat(attrs.total_reserve_in_usd) || 0,
      source: 'geckoterminal',
      fetchedAt: Date.now(),
    };

    return tokenData;
  } catch (error) {
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[BNB Token Proxy] GeckoTerminal attempt ${attempt} failed, retrying in ${delay}ms...`);
      await sleep(delay);
      return fetchFromGeckoTerminal(ca, attempt + 1);
    }
    throw error;
  }
}

async function fetchChange24hFromDexScreener(ca: string): Promise<number> {
  try {
    const response = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, {
      headers: { 
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      return 0;
    }

    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      return 0;
    }

    const bscPairs = data.pairs.filter((p: any) => p.chainId === 'bsc');
    const mainPair = bscPairs.find((p: any) => 
      p.dexId === 'pancakeswap' && p.quoteToken?.symbol === 'WBNB'
    ) || bscPairs.find((p: any) => 
      p.dexId === 'pancakeswap'
    ) || bscPairs[0] || data.pairs[0];
    
    return parseFloat(mainPair.priceChange?.h24) || 0;
  } catch {
    return 0;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { ca } = req.query;
  
  if (!ca || typeof ca !== 'string') {
    return res.status(400).json({ error: 'Missing contract address' });
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const cachedData = getCachedData(ca);
  if (cachedData) {
    console.log(`[BNB Token Proxy] Cache hit for ${ca.slice(0, 10)}...`);
    return res.status(200).json(cachedData);
  }

  try {
    console.log(`[BNB Token Proxy] Fetching data for ${ca.slice(0, 10)}...`);
    
    const [geckoResult, change24h] = await Promise.allSettled([
      fetchFromGeckoTerminal(ca),
      fetchChange24hFromDexScreener(ca),
    ]);
    
    if (geckoResult.status === 'fulfilled') {
      const geckoData = geckoResult.value;
      const changeFromDex = change24h.status === 'fulfilled' ? change24h.value : 0;
      
      const tokenData: TokenData = {
        ...geckoData,
        change24h: geckoData.change24h || changeFromDex,
      };
      
      setCachedData(ca, tokenData);
      
      console.log(`[BNB Token Proxy] GeckoTerminal: ${tokenData.symbol} MCap: $${tokenData.marketCap.toLocaleString()} Change24h: ${tokenData.change24h}%`);
      return res.status(200).json(tokenData);
    }
    
    console.error(`[BNB Token Proxy] GeckoTerminal failed after ${MAX_RETRIES} retries`);
    return res.status(200).json({
      ca,
      name: 'Unknown',
      symbol: 'UNKNOWN',
      price: 0,
      marketCap: 0,
      volume24h: 0,
      change24h: 0,
      phase: 'bonding',
      configured: false,
      source: 'error',
      fetchedAt: Date.now(),
    });
  } catch (error) {
    console.error('[BNB Token Proxy] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch token data' });
  }
}
