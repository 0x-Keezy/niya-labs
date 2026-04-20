// GeckoTerminal OHLCV client. Public, free, no API key required.
// Free tier: 30 req/min. Attribution: "Data via GeckoTerminal".
//
// Endpoint shape confirmed manually (2026-04-10):
//   GET /api/v2/networks/bsc/pools/{pool}/ohlcv/{timeframe}?aggregate={n}&limit={k}
//   -> { data: { attributes: { ohlcv_list: [[ts, o, h, l, c, v], ...] } } }

import type { Candle, Timeframe } from './types';

const GT_BASE = 'https://api.geckoterminal.com/api/v2';

// Map our UX timeframes to GeckoTerminal (base, aggregate) tuples.
const TF_MAP: Record<Timeframe, { base: 'minute' | 'hour' | 'day'; aggregate: number }> = {
  '5m': { base: 'minute', aggregate: 5 },
  '15m': { base: 'minute', aggregate: 15 },
  '1h': { base: 'hour', aggregate: 1 },
  '4h': { base: 'hour', aggregate: 4 },
  '1d': { base: 'day', aggregate: 1 },
};

interface GtResponse {
  data?: {
    attributes?: {
      ohlcv_list?: number[][];
    };
  };
}

interface CacheEntry {
  data: Candle[];
  fetchedAt: number;
}
const cache = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

/**
 * Fetch OHLCV candles for a BSC pool (pair address) at the given timeframe.
 * Returns candles sorted ascending by time (lightweight-charts requirement).
 */
export async function fetchOhlcv(
  pairAddress: string,
  timeframe: Timeframe,
  limit = 200,
  signal?: AbortSignal,
): Promise<Candle[]> {
  const key = `${pairAddress.toLowerCase()}:${timeframe}:${limit}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.data;
  }

  const tf = TF_MAP[timeframe];
  const url = `${GT_BASE}/networks/bsc/pools/${pairAddress}/ohlcv/${tf.base}?aggregate=${tf.aggregate}&limit=${limit}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`GeckoTerminal ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as GtResponse;
  const list = body.data?.attributes?.ohlcv_list ?? [];

  const candles: Candle[] = list
    .filter((row) => Array.isArray(row) && row.length >= 6)
    .map((row) => ({
      time: row[0], // UNIX seconds
      open: row[1],
      high: row[2],
      low: row[3],
      close: row[4],
      volume: row[5],
    }))
    // API returns newest-first; lightweight-charts needs ascending.
    .sort((a, b) => a.time - b.time);

  cache.set(key, { data: candles, fetchedAt: Date.now() });
  return candles;
}
