// DexScreener public API client. Used for pair metadata (price, liquidity,
// volume, price change). OHLC candles come from GeckoTerminal (see geckoterminal.ts)
// because DexScreener does not publicly expose OHLCV bars.
//
// Docs: https://docs.dexscreener.com/api/reference

import type { PairSummary } from './types';

const DEXSCREENER_BASE = 'https://api.dexscreener.com';

interface DxRawPair {
  chainId?: string;
  dexId?: string;
  pairAddress?: string;
  url?: string;
  baseToken?: { address?: string; symbol?: string; name?: string };
  quoteToken?: { address?: string; symbol?: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  fdv?: number;
  marketCap?: number;
}

interface DxTokenResponse {
  pairs?: DxRawPair[] | null;
}

// Tiny in-memory cache. Extension lifetime only; blown away on service worker
// restart (fine — we just want to dedupe rapid reloads).
interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}
const cache = new Map<string, CacheEntry<PairSummary[]>>();
const TTL_MS = 60_000;

/** Thrown when DexScreener returns no pairs at all for a given CA. */
export class TokenNotListedError extends Error {
  constructor(ca: string) {
    super(`Token not listed on DexScreener: ${ca}`);
    this.name = 'TokenNotListedError';
  }
}

function normalize(raw: DxRawPair): PairSummary | null {
  if (!raw.pairAddress || !raw.chainId || !raw.baseToken?.address) return null;
  const priceUsd = Number(raw.priceUsd ?? 0);
  const fdv = typeof raw.fdv === 'number' && Number.isFinite(raw.fdv) ? raw.fdv : 0;
  const marketCap =
    typeof raw.marketCap === 'number' && Number.isFinite(raw.marketCap)
      ? raw.marketCap
      : fdv;
  return {
    pairAddress: raw.pairAddress,
    chainId: raw.chainId,
    dexId: raw.dexId ?? 'unknown',
    priceUsd: Number.isFinite(priceUsd) ? priceUsd : 0,
    liquidityUsd: raw.liquidity?.usd ?? 0,
    volume24h: raw.volume?.h24 ?? 0,
    priceChange24h: raw.priceChange?.h24 ?? 0,
    fdv,
    marketCap,
    baseToken: {
      symbol: raw.baseToken.symbol ?? '???',
      name: raw.baseToken.name ?? '',
      address: raw.baseToken.address,
    },
    quoteToken: {
      symbol: raw.quoteToken?.symbol ?? '???',
      address: raw.quoteToken?.address ?? '',
    },
    url: raw.url ?? '',
  };
}

/**
 * Fetch all pairs for a token contract address.
 * DexScreener returns pairs across all chains — we filter downstream.
 */
export async function fetchTokenPairs(
  ca: string,
  signal?: AbortSignal,
): Promise<PairSummary[]> {
  const key = ca.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.data;
  }

  const url = `${DEXSCREENER_BASE}/latest/dex/tokens/${key}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`DexScreener ${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as DxTokenResponse;
  const rawPairs = body.pairs ?? [];
  if (rawPairs.length === 0) {
    throw new TokenNotListedError(key);
  }
  const pairs = rawPairs
    .map(normalize)
    .filter((p): p is PairSummary => p !== null);

  cache.set(key, { data: pairs, fetchedAt: Date.now() });
  return pairs;
}

/**
 * Resolve an address that could be EITHER a pair address OR a token address.
 *
 * DexScreener URLs (`dexscreener.com/bsc/{addr}`) accept both — when the user
 * clicks a pair from the home page, `addr` is a pair address; when they paste
 * a token, it's a token address. The two endpoints are distinct:
 *
 *   • `/latest/dex/pairs/bsc/{addr}` returns the pair when `addr` is a pair
 *   • `/latest/dex/tokens/{addr}`    returns all pairs of a token
 *
 * Strategy: try the pairs endpoint first (most URLs are pair-shaped), and if
 * it returns nothing fall back to the tokens endpoint. The cache key is
 * shared with `fetchTokenPairs`, so a hit there short-circuits.
 */
export async function fetchPairOrToken(
  addr: string,
  signal?: AbortSignal,
): Promise<PairSummary[]> {
  const key = addr.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) {
    return cached.data;
  }

  // 1) Try as pair on BSC.
  const pairUrl = `${DEXSCREENER_BASE}/latest/dex/pairs/bsc/${key}`;
  try {
    const res = await fetch(pairUrl, { signal });
    if (res.ok) {
      const body = (await res.json()) as DxTokenResponse;
      const rawPairs = body.pairs ?? [];
      if (rawPairs.length > 0) {
        const pairs = rawPairs
          .map(normalize)
          .filter((p): p is PairSummary => p !== null);
        if (pairs.length > 0) {
          cache.set(key, { data: pairs, fetchedAt: Date.now() });
          return pairs;
        }
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    // fall through to tokens endpoint on any other failure
  }

  // 2) Fallback: treat as token CA.
  return fetchTokenPairs(addr, signal);
}

/**
 * From a list of pairs, pick the most liquid BSC pair.
 * Returns null if the token has no BSC pair.
 */
export function pickBestBscPair(pairs: PairSummary[]): PairSummary | null {
  const bsc = pairs.filter((p) => p.chainId === 'bsc');
  if (bsc.length === 0) return null;
  return bsc.reduce((best, cur) =>
    cur.liquidityUsd > best.liquidityUsd ? cur : best,
  );
}
