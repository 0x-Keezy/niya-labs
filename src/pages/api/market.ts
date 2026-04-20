import type { NextApiRequest, NextApiResponse } from 'next';

interface MarketResponse {
  BTC?: { price: number; change24h?: number };
  ETH?: { price: number; change24h?: number };
  BNB?: { price: number; change24h?: number };
  source?: string;
  lastUpdate?: number;
}

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

let cache: MarketResponse & { timestamp: number } = { timestamp: 0 };
const CACHE_TTL_MS = 30000;

async function fetchCoinGeckoPrices(): Promise<MarketResponse> {
  const ids = 'bitcoin,ethereum,binancecoin';
  const url = `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/json',
    },
  });
  
  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status}`);
  }
  
  const data = await res.json();
  
  return {
    BTC: data.bitcoin ? { price: data.bitcoin.usd, change24h: data.bitcoin.usd_24h_change } : undefined,
    ETH: data.ethereum ? { price: data.ethereum.usd, change24h: data.ethereum.usd_24h_change } : undefined,
    BNB: data.binancecoin ? { price: data.binancecoin.usd, change24h: data.binancecoin.usd_24h_change } : undefined,
    source: 'coingecko',
    lastUpdate: Date.now(),
  };
}

async function fetchBinancePrices(): Promise<MarketResponse> {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
  const results: MarketResponse = { source: 'binance', lastUpdate: Date.now() };
  
  const promises = symbols.map(async (symbol) => {
    const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
  });
  
  const data = await Promise.all(promises);
  
  if (data[0]) {
    results.BTC = { price: parseFloat(data[0].lastPrice), change24h: parseFloat(data[0].priceChangePercent) };
  }
  if (data[1]) {
    results.ETH = { price: parseFloat(data[1].lastPrice), change24h: parseFloat(data[1].priceChangePercent) };
  }
  if (data[2]) {
    results.BNB = { price: parseFloat(data[2].lastPrice), change24h: parseFloat(data[2].priceChangePercent) };
  }
  
  return results;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MarketResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (cache.timestamp && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return res.status(200).json(cache);
  }

  try {
    const data = await fetchBinancePrices();
    cache = { ...data, timestamp: Date.now() };
    return res.status(200).json(data);
  } catch (binanceError) {
    try {
      const data = await fetchCoinGeckoPrices();
      cache = { ...data, timestamp: Date.now() };
      return res.status(200).json(data);
    } catch (cgError) {
      if (cache.timestamp) {
        return res.status(200).json({ ...cache, source: 'cached' });
      }
      return res.status(500).json({ error: 'Failed to fetch market data' });
    }
  }
}
