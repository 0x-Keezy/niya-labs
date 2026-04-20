import { contextManager } from './contextManager';

export interface TokenPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  slippageBps: number;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const isClient = typeof window !== 'undefined';
const PROXY_URL = '/api/jupiter-proxy';

class JupiterApiClass {
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 30000;
  private priceUpdateInterval: NodeJS.Timeout | null = null;

  public initialize(): void {
    console.log('JupiterAPI initialized');
  }

  public async getPrice(mintAddress: string = SOL_MINT): Promise<number | null> {
    const cached = this.priceCache.get(mintAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.price;
    }

    if (!isClient) {
      console.warn('JupiterAPI: Cannot fetch prices on server side');
      return null;
    }

    try {
      const response = await fetch(`${PROXY_URL}?ids=${mintAddress}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Jupiter API error: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      const priceData = result.data?.[mintAddress];

      if (!priceData?.price) {
        console.warn(`No price data for ${mintAddress}`);
        return null;
      }

      const price = parseFloat(priceData.price);
      this.priceCache.set(mintAddress, { price, timestamp: Date.now() });

      return price;
    } catch (e) {
      console.error('Failed to fetch price from Jupiter:', e);
      return null;
    }
  }

  public async getSolanaPrice(): Promise<number | null> {
    return this.getPrice(SOL_MINT);
  }

  public async getTokenPrices(mintAddresses: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    if (!isClient) {
      console.warn('JupiterAPI: Cannot fetch prices on server side');
      return prices;
    }

    try {
      const ids = mintAddresses.join(',');
      const response = await fetch(`${PROXY_URL}?ids=${ids}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Jupiter API error: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      for (const mint of mintAddresses) {
        const priceData = result.data?.[mint];
        if (priceData?.price) {
          const price = parseFloat(priceData.price);
          prices.set(mint, price);
          this.priceCache.set(mint, { price, timestamp: Date.now() });
        }
      }
    } catch (e) {
      console.error('Failed to fetch token prices:', e);
    }

    return prices;
  }

  public async getSwapQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<SwapQuote | null> {
    if (!isClient) {
      console.warn('JupiterAPI: Cannot get swap quote on server side');
      return null;
    }

    try {
      const response = await fetch(
        `${PROXY_URL}?action=quote&inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Jupiter quote API error: ${response.status}`);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      const data = result.data;
      // Use Number() for defensive conversion (handles both string and number types)
      const priceImpact = Number(data.priceImpactPct);
      return {
        inputMint: data.inputMint,
        outputMint: data.outputMint,
        inAmount: data.inAmount,
        outAmount: data.outAmount,
        priceImpactPct: isNaN(priceImpact) ? 0 : priceImpact,
        slippageBps,
      };
    } catch (e) {
      console.error('Failed to get swap quote:', e);
      return null;
    }
  }

  public async getSwapRoute(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<any | null> {
    try {
      const quote = await this.getSwapQuote(inputMint, outputMint, amount, slippageBps);
      if (!quote) return null;

      return quote;
    } catch (e) {
      console.error('Failed to get swap route:', e);
      return null;
    }
  }

  public startPriceMonitoring(
    tokens: string[] = [SOL_MINT],
    intervalMs: number = 60000,
    onPriceUpdate?: (prices: Map<string, number>) => void
  ): void {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
    }

    let lastPrices = new Map<string, number>();

    const checkPrices = async () => {
      const currentPrices = await this.getTokenPrices(tokens);

      for (const [mint, price] of currentPrices) {
        const lastPrice = lastPrices.get(mint);
        
        if (lastPrice) {
          const changePercent = ((price - lastPrice) / lastPrice) * 100;

          if (Math.abs(changePercent) >= 5) {
            const direction = changePercent > 0 ? 'up' : 'down';
            console.log(`Price alert: ${mint} ${direction} ${Math.abs(changePercent).toFixed(2)}%`);

            if (mint === SOL_MINT) {
              contextManager.updateMarketContext({
                solanaPrice: price,
                priceChange24h: changePercent,
              });
            }
          }
        }
      }

      lastPrices = currentPrices;

      if (onPriceUpdate) {
        onPriceUpdate(currentPrices);
      }
    };

    checkPrices();
    this.priceUpdateInterval = setInterval(checkPrices, intervalMs);

    console.log(`Price monitoring started for ${tokens.length} token(s)`);
  }

  public stopPriceMonitoring(): void {
    if (this.priceUpdateInterval) {
      clearInterval(this.priceUpdateInterval);
      this.priceUpdateInterval = null;
    }
    console.log('Price monitoring stopped');
  }

  public async updateMarketContext(): Promise<void> {
    const solPrice = await this.getSolanaPrice();
    
    if (solPrice) {
      const cached = this.priceCache.get(SOL_MINT);
      let change24h = 0;

      contextManager.updateMarketContext({
        solanaPrice: solPrice,
        priceChange24h: change24h,
      });
    }
  }

  public formatPrice(price: number): string {
    if (price >= 1000) {
      return `$${(price / 1000).toFixed(2)}K`;
    } else if (price >= 1) {
      return `$${price.toFixed(2)}`;
    } else if (price >= 0.001) {
      return `$${price.toFixed(4)}`;
    } else {
      return `$${price.toExponential(2)}`;
    }
  }

  public formatPriceChange(change: number): string {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }

  public get SOL_MINT(): string {
    return SOL_MINT;
  }

  public get USDC_MINT(): string {
    return USDC_MINT;
  }
}

export const jupiterApi = new JupiterApiClass();
