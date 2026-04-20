const BINANCE_BASE = 'https://api.binance.com';
const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const IS_SERVER = typeof window === 'undefined';


export interface BinanceTokenDetails {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  quoteVolume24h: number;
  high24h: number;
  low24h: number;
  lastUpdate: number;
}

export interface BinanceMarketRanking {
  symbol: string;
  priceChangePercent: number;
  volume: number;
  quoteVolume: number;
  price: number;
  type: 'gainer' | 'loser' | 'volume';
}

export interface MarketRankingsResult {
  topGainers: BinanceMarketRanking[];
  topLosers: BinanceMarketRanking[];
  topVolume: BinanceMarketRanking[];
  timestamp: number;
}

export interface AddressInsights {
  address: string;
  totalValueUsd?: number;
  tokenCount?: number;
  note: string;
  timestamp: number;
}

export interface ContractRiskResult {
  address: string;
  riskLevel: 'low' | 'medium' | 'high' | 'unknown';
  flags: string[];
  score: number;
  timestamp: number;
}

export interface MemeTokenTracking {
  symbol: string;
  name: string;
  priceChangePercent: number;
  volume24h: number;
  marketCap?: number;
  isNew?: boolean;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

class BinanceAgentSkillsClass {
  private cache: Map<string, CacheEntry<any>> = new Map();

  private isCacheFresh(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.fetchedAt < CACHE_TTL;
  }

  private getCached<T>(key: string): T | null {
    if (this.isCacheFresh(key)) {
      return this.cache.get(key)!.data as T;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, fetchedAt: Date.now() });
  }

  async getTokenDetails(symbol: string): Promise<BinanceTokenDetails | null> {
    const upperSymbol = symbol.toUpperCase();
    const pair = upperSymbol.endsWith('USDT') ? upperSymbol : `${upperSymbol}USDT`;
    const cacheKey = `token_${pair}`;

    const cached = this.getCached<BinanceTokenDetails>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${BINANCE_BASE}/api/v3/ticker/24hr?symbol=${pair}`
      );

      if (!response.ok) {
        console.warn(`[BinanceAgent] Token ${pair} not found:`, response.status);
        return null;
      }

      const data = await response.json();

      const result: BinanceTokenDetails = {
        symbol: data.symbol,
        price: parseFloat(data.lastPrice),
        priceChange24h: parseFloat(data.priceChange),
        priceChangePercent24h: parseFloat(data.priceChangePercent),
        volume24h: parseFloat(data.volume),
        quoteVolume24h: parseFloat(data.quoteVolume),
        high24h: parseFloat(data.highPrice),
        low24h: parseFloat(data.lowPrice),
        lastUpdate: Date.now(),
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (e) {
      console.error('[BinanceAgent] getTokenDetails error:', e);
      return null;
    }
  }

  async getMarketRankings(limit: number = 10): Promise<MarketRankingsResult> {
    const cacheKey = `rankings_${limit}`;
    const cached = this.getCached<MarketRankingsResult>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetch(
        `${BINANCE_BASE}/api/v3/ticker/24hr`
      );

      if (!response.ok) {
        if (response.status === 451 || response.status === 403) {
          console.warn('[BinanceAgent] Binance blocked (server-side IP restriction), using CoinGecko fallback');
          return this.getMarketRankingsFromCoinGecko(limit);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const tickers: any[] = await response.json();

      const usdtPairs = tickers.filter(
        (t) =>
          t.symbol.endsWith('USDT') &&
          !t.symbol.includes('DOWN') &&
          !t.symbol.includes('UP') &&
          !t.symbol.includes('BULL') &&
          !t.symbol.includes('BEAR') &&
          parseFloat(t.quoteVolume) > 1_000_000
      );

      const toRanking = (t: any, type: BinanceMarketRanking['type']): BinanceMarketRanking => ({
        symbol: t.symbol.replace('USDT', ''),
        priceChangePercent: parseFloat(t.priceChangePercent),
        volume: parseFloat(t.volume),
        quoteVolume: parseFloat(t.quoteVolume),
        price: parseFloat(t.lastPrice),
        type,
      });

      const topGainers = [...usdtPairs]
        .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
        .slice(0, limit)
        .map((t) => toRanking(t, 'gainer'));

      const topLosers = [...usdtPairs]
        .sort((a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent))
        .slice(0, limit)
        .map((t) => toRanking(t, 'loser'));

      const topVolume = [...usdtPairs]
        .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
        .slice(0, limit)
        .map((t) => toRanking(t, 'volume'));

      const result: MarketRankingsResult = {
        topGainers,
        topLosers,
        topVolume,
        timestamp: Date.now(),
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (e) {
      console.error('[BinanceAgent] getMarketRankings error:', e);
      return { topGainers: [], topLosers: [], topVolume: [], timestamp: Date.now() };
    }
  }

  private async getMarketRankingsFromCoinGecko(limit: number): Promise<MarketRankingsResult> {
    try {
      const resp = await fetch(
        `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&price_change_percentage=24h`
      );
      if (!resp.ok) throw new Error(`CoinGecko HTTP ${resp.status}`);

      const coins: any[] = await resp.json();

      const toRanking = (c: any, type: BinanceMarketRanking['type']): BinanceMarketRanking => ({
        symbol: c.symbol.toUpperCase(),
        priceChangePercent: c.price_change_percentage_24h || 0,
        volume: c.total_volume || 0,
        quoteVolume: c.total_volume || 0,
        price: c.current_price || 0,
        type,
      });

      const topGainers = [...coins]
        .sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0))
        .slice(0, limit)
        .map(c => toRanking(c, 'gainer'));

      const topLosers = [...coins]
        .sort((a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0))
        .slice(0, limit)
        .map(c => toRanking(c, 'loser'));

      const topVolume = [...coins]
        .sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0))
        .slice(0, limit)
        .map(c => toRanking(c, 'volume'));

      const result: MarketRankingsResult = { topGainers, topLosers, topVolume, timestamp: Date.now() };
      this.setCache(`rankings_${limit}`, result);
      return result;
    } catch (e) {
      console.error('[BinanceAgent] CoinGecko fallback error:', e);
      return { topGainers: [], topLosers: [], topVolume: [], timestamp: Date.now() };
    }
  }

  async getMemeTokenTracking(limit: number = 10): Promise<MemeTokenTracking[]> {
    const cacheKey = `meme_${limit}`;
    const cached = this.getCached<MemeTokenTracking[]>(cacheKey);
    if (cached) return cached;

    const KNOWN_MEME_BASES = [
      'DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'MEME', 'NEIRO',
      'TURBO', 'BOME', 'POPCAT', 'MOG', 'BRETT', 'SLERF', 'GIGA', 'PNUT',
      'GOAT', 'CHILLGUY', 'ACT', 'LUCE', 'PEPY', 'MOODENG',
    ];

    try {
      const response = await fetch(`${BINANCE_BASE}/api/v3/ticker/24hr`);
      if (!response.ok) {
        if (response.status === 451 || response.status === 403) {
          console.warn('[BinanceAgent] Binance blocked for meme tokens, returning empty list');
          return [];
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const tickers: any[] = await response.json();

      const memeTokens = tickers
        .filter((t) => {
          const base = t.symbol.replace('USDT', '').replace('BTC', '').replace('BNB', '');
          return (
            t.symbol.endsWith('USDT') &&
            KNOWN_MEME_BASES.some((m) => base.startsWith(m))
          );
        })
        .map((t): MemeTokenTracking => ({
          symbol: t.symbol.replace('USDT', ''),
          name: t.symbol.replace('USDT', ''),
          priceChangePercent: parseFloat(t.priceChangePercent),
          volume24h: parseFloat(t.quoteVolume),
          timestamp: Date.now(),
        }))
        .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
        .slice(0, limit);

      this.setCache(cacheKey, memeTokens);
      return memeTokens;
    } catch (e) {
      console.error('[BinanceAgent] getMemeTokenTracking error:', e);
      return [];
    }
  }

  async checkContractRisk(contractAddress: string): Promise<ContractRiskResult> {
    const cacheKey = `risk_${contractAddress}`;
    const cached = this.getCached<ContractRiskResult>(cacheKey);
    if (cached) return cached;

    const flags: string[] = [];
    let score = 0;

    const isValidBSC = /^0x[a-fA-F0-9]{40}$/.test(contractAddress);

    if (!isValidBSC) {
      flags.push('Invalid address format');
      score = 100;
    } else {
      const KNOWN_SAFE = [
        '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
        '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        '0x5c952063c7235c6d39c0f9bc6b7dc2e3f41a50b6',
        '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
      ];

      const lower = contractAddress.toLowerCase();
      const isKnownSafe = KNOWN_SAFE.includes(lower);

      if (isKnownSafe) {
        flags.push('Known verified contract');
        score = 5;
      } else {
        try {
          const resp = await fetch(
            `https://api.bscscan.com/api?module=contract&action=getabi&address=${contractAddress}&apikey=YourApiKeyToken`
          );
          const data = await resp.json();

          if (data.status === '0') {
            flags.push('Contract ABI not verified on BscScan');
            score += 40;
          } else {
            const abi = data.result || '';
            if (abi.includes('"mint"')) {
              flags.push('Has mint function');
              score += 20;
            }
            if (abi.includes('"pause"') || abi.includes('"freeze"')) {
              flags.push('Has pause/freeze function');
              score += 20;
            }
            if (abi.includes('"setOwner"') || abi.includes('"transferOwnership"')) {
              flags.push('Transferable ownership');
              score += 10;
            }
          }
        } catch {
          flags.push('Could not verify contract on BscScan');
          score += 20;
        }
      }
    }

    const riskLevel: ContractRiskResult['riskLevel'] =
      score === 0 ? 'low' :
      score < 20 ? 'low' :
      score < 50 ? 'medium' :
      score < 80 ? 'high' : 'high';

    const result: ContractRiskResult = {
      address: contractAddress,
      riskLevel,
      flags,
      score: Math.min(100, score),
      timestamp: Date.now(),
    };

    this.setCache(cacheKey, result);
    return result;
  }

  async getAddressInsights(address: string): Promise<AddressInsights> {
    const cacheKey = `address_${address}`;
    const cached = this.getCached<AddressInsights>(cacheKey);
    if (cached) return cached;

    const isValidBSC = /^0x[a-fA-F0-9]{40}$/.test(address);

    if (!isValidBSC) {
      return {
        address,
        note: 'Invalid BSC address format',
        timestamp: Date.now(),
      };
    }

    try {
      const resp = await fetch(
        `https://api.bscscan.com/api?module=account&action=balance&address=${address}&tag=latest&apikey=YourApiKeyToken`
      );
      const data = await resp.json();

      const bnbBalance = data.status === '1' ? parseFloat(data.result) / 1e18 : 0;

      const result: AddressInsights = {
        address,
        totalValueUsd: bnbBalance,
        note: `BNB Balance: ${bnbBalance.toFixed(4)} BNB`,
        timestamp: Date.now(),
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (e) {
      console.error('[BinanceAgent] getAddressInsights error:', e);
      return {
        address,
        note: 'Could not fetch address data',
        timestamp: Date.now(),
      };
    }
  }

  getFormattedRankings(rankings: MarketRankingsResult): string {
    const gainers = rankings.topGainers.slice(0, 5)
      .map((t) => `${t.symbol} +${t.priceChangePercent.toFixed(1)}%`)
      .join(', ');

    const losers = rankings.topLosers.slice(0, 3)
      .map((t) => `${t.symbol} ${t.priceChangePercent.toFixed(1)}%`)
      .join(', ');

    return `Top gainers: ${gainers || 'N/A'} | Top losers: ${losers || 'N/A'}`;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const binanceAgentSkills = new BinanceAgentSkillsClass();
