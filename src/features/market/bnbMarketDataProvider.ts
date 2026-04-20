export interface BNBTokenData {
  address: string;
  name: string;
  symbol: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  phase: 'bonding' | 'graduated';
  bondingProgress?: number;
  reserves?: {
    token: number;
    bnb: number;
  };
  lastUpdated: number;
}

export interface FourMemeTokenInfo {
  address: string;
  name: string;
  symbol: string;
  bondingCurveProgress: number;
  graduated: boolean;
  creator: string;
  createdAt: number;
}

const PANCAKESWAP_V2_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getBNBTokenPrice(tokenAddress: string, rpcUrl: string): Promise<number | null> {
  try {
    const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const response = await fetchWithTimeout(dexScreenerUrl);
    
    if (!response.ok) {
      console.error('DexScreener API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      const bscPair = data.pairs.find((p: any) => p.chainId === 'bsc');
      if (bscPair) {
        return parseFloat(bscPair.priceUsd);
      }
      return parseFloat(data.pairs[0].priceUsd);
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching BNB token price:', error);
    return null;
  }
}

export async function checkTokenGraduated(tokenAddress: string, rpcUrl: string): Promise<boolean> {
  try {
    const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const response = await fetchWithTimeout(dexScreenerUrl);
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    
    if (data.pairs && data.pairs.length > 0) {
      const pancakeSwapPair = data.pairs.find((p: any) => 
        p.chainId === 'bsc' && 
        (p.dexId === 'pancakeswap' || p.dexId === 'pancakeswap_v2' || p.dexId === 'pancakeswap_v3')
      );
      return !!pancakeSwapPair;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking token graduation:', error);
    return false;
  }
}

export async function fetchBNBTokenData(tokenAddress: string, rpcUrl: string): Promise<BNBTokenData | null> {
  try {
    const dexScreenerUrl = `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`;
    const response = await fetchWithTimeout(dexScreenerUrl);
    
    if (!response.ok) {
      console.error('DexScreener API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.pairs || data.pairs.length === 0) {
      return {
        address: tokenAddress,
        name: 'Unknown',
        symbol: 'UNKNOWN',
        price: 0,
        marketCap: 0,
        volume24h: 0,
        change24h: 0,
        phase: 'bonding',
        bondingProgress: 0,
        lastUpdated: Date.now(),
      };
    }
    
    const bscPair = data.pairs.find((p: any) => p.chainId === 'bsc') || data.pairs[0];
    const isPancakeSwap = bscPair.dexId?.includes('pancakeswap');
    
    return {
      address: tokenAddress,
      name: bscPair.baseToken?.name || 'Unknown',
      symbol: bscPair.baseToken?.symbol || 'UNKNOWN',
      price: parseFloat(bscPair.priceUsd) || 0,
      marketCap: parseFloat(bscPair.fdv) || 0,
      volume24h: parseFloat(bscPair.volume?.h24) || 0,
      change24h: parseFloat(bscPair.priceChange?.h24) || 0,
      phase: isPancakeSwap ? 'graduated' : 'bonding',
      bondingProgress: isPancakeSwap ? 100 : (parseFloat(bscPair.fdv) / 69000) * 100,
      reserves: bscPair.liquidity ? {
        token: parseFloat(bscPair.liquidity.base) || 0,
        bnb: parseFloat(bscPair.liquidity.quote) || 0,
      } : undefined,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error('Error fetching BNB token data:', error);
    return null;
  }
}

export class BNBMarketDataProvider {
  private rpcUrl: string;
  private tokenAddress: string;
  private cachedData: BNBTokenData | null = null;
  private cacheExpiry: number = 0;
  private cacheDuration: number = 30000;
  
  constructor(tokenAddress: string, rpcUrl: string = 'https://bsc-dataseed.binance.org') {
    this.tokenAddress = tokenAddress;
    this.rpcUrl = rpcUrl;
  }
  
  async getTokenData(forceRefresh = false): Promise<BNBTokenData | null> {
    const now = Date.now();
    
    if (!forceRefresh && this.cachedData && now < this.cacheExpiry) {
      return this.cachedData;
    }
    
    const data = await fetchBNBTokenData(this.tokenAddress, this.rpcUrl);
    
    if (data) {
      this.cachedData = data;
      this.cacheExpiry = now + this.cacheDuration;
    }
    
    return data;
  }
  
  async getPrice(): Promise<number | null> {
    const data = await this.getTokenData();
    return data?.price ?? null;
  }
  
  async isGraduated(): Promise<boolean> {
    const data = await this.getTokenData();
    return data?.phase === 'graduated';
  }
  
  async getMarketCap(): Promise<number | null> {
    const data = await this.getTokenData();
    return data?.marketCap ?? null;
  }
  
  async get24hChange(): Promise<number | null> {
    const data = await this.getTokenData();
    return data?.change24h ?? null;
  }
  
  setTokenAddress(address: string) {
    this.tokenAddress = address;
    this.cachedData = null;
    this.cacheExpiry = 0;
  }
  
  setCacheDuration(ms: number) {
    this.cacheDuration = ms;
  }
}

export function formatBNBAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function getBscScanUrl(address: string, type: 'token' | 'address' = 'token'): string {
  return `https://bscscan.com/${type}/${address}`;
}
