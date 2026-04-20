import { contextManager } from './contextManager';
import { jupiterApi } from './jupiterApi';
import { pumpfunApi } from './pumpfunApi';
import { binanceAgentSkills } from '@/features/market/binanceAgentSkills';

interface CoinGeckoPrice {
  usd: number;
  usd_24h_change?: number;
}

interface MarketData {
  bnb?: { price: number; change24h: number };
  bitcoin?: { price: number; change24h: number };
  ethereum?: { price: number; change24h: number };
  lastUpdate: number;
  source?: 'binance' | 'coingecko' | 'cached';
}

type PriceUpdateCallback = (data: MarketData) => void;

class MarketDataApi {
  private cache: MarketData = { lastUpdate: 0 };
  private readonly CACHE_TTL_MS = 60000;
  private updateInterval: NodeJS.Timeout | null = null;
  private readonly COINGECKO_API = 'https://api.coingecko.com/api/v3';
  
  // Binance WebSocket
  private binanceWs: WebSocket | null = null;
  private binanceConnected: boolean = false;
  private binanceReconnectTimer: NodeJS.Timeout | null = null;
  private readonly BINANCE_WS_URL = 'wss://stream.binance.com:9443/stream';
  private readonly BINANCE_STREAMS = ['btcusdt@miniTicker', 'ethusdt@miniTicker', 'bnbusdt@miniTicker'];
  
  // Subscribers for real-time updates
  private priceCallbacks: Set<PriceUpdateCallback> = new Set();

  // Subscribe to real-time price updates
  subscribe(callback: PriceUpdateCallback): () => void {
    this.priceCallbacks.add(callback);
    
    // Immediately send current prices if available
    if (this.cache.lastUpdate > 0) {
      callback({ ...this.cache });
    }
    
    return () => {
      this.priceCallbacks.delete(callback);
    };
  }

  private notifySubscribers(): void {
    this.priceCallbacks.forEach(cb => {
      try {
        cb({ ...this.cache });
      } catch (e) {
        // Ignore callback errors
      }
    });
  }

  // Connect to Binance WebSocket for real-time prices
  connectBinanceWS(): void {
    if (this.binanceWs && (this.binanceWs.readyState === WebSocket.CONNECTING || this.binanceWs.readyState === WebSocket.OPEN)) {
      return;
    }

    const streamUrl = `${this.BINANCE_WS_URL}?streams=${this.BINANCE_STREAMS.join('/')}`;
    
    try {
      this.binanceWs = new WebSocket(streamUrl);
      
      this.binanceWs.onopen = () => {
        this.binanceConnected = true;
        console.log('[MarketData] Binance WebSocket connected');
      };

      this.binanceWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleBinanceMessage(data);
        } catch (e) {
          // Ignore parse errors
        }
      };

      this.binanceWs.onclose = () => {
        this.binanceConnected = false;
        console.log('[MarketData] Binance WebSocket closed, scheduling reconnect');
        this.scheduleBinanceReconnect();
      };

      this.binanceWs.onerror = (error) => {
        console.error('[MarketData] Binance WebSocket error:', error);
      };
    } catch (e) {
      console.error('[MarketData] Failed to connect Binance WS:', e);
      this.scheduleBinanceReconnect();
    }
  }

  private handleBinanceMessage(data: { stream: string; data: any }): void {
    const { stream, data: ticker } = data;
    
    const price = parseFloat(ticker.c);
    const openPrice = parseFloat(ticker.o);
    const change24h = openPrice > 0 ? ((price - openPrice) / openPrice) * 100 : 0;

    if (stream === 'btcusdt@miniTicker') {
      this.cache.bitcoin = { price, change24h };
    } else if (stream === 'ethusdt@miniTicker') {
      this.cache.ethereum = { price, change24h };
    } else if (stream === 'bnbusdt@miniTicker') {
      this.cache.bnb = { price, change24h };
    }

    this.cache.lastUpdate = Date.now();
    this.cache.source = 'binance';
    
    this.updateContextManager();
    this.notifySubscribers();
  }

  private scheduleBinanceReconnect(): void {
    if (this.binanceReconnectTimer) {
      clearTimeout(this.binanceReconnectTimer);
    }
    
    this.binanceReconnectTimer = setTimeout(() => {
      this.connectBinanceWS();
    }, 5000);
  }

  disconnectBinanceWS(): void {
    if (this.binanceReconnectTimer) {
      clearTimeout(this.binanceReconnectTimer);
      this.binanceReconnectTimer = null;
    }
    
    if (this.binanceWs) {
      this.binanceWs.close();
      this.binanceWs = null;
    }
    
    this.binanceConnected = false;
    console.log('[MarketData] Binance WebSocket disconnected');
  }

  isBinanceConnected(): boolean {
    return this.binanceConnected;
  }

  // Fallback: Fetch prices from CoinGecko/Jupiter (used when Binance WS is unavailable)
  async fetchAllPrices(): Promise<MarketData> {
    // Skip if Binance is connected and cache is fresh
    if (this.binanceConnected && Date.now() - this.cache.lastUpdate < 5000) {
      return this.cache;
    }

    // Skip if cache is fresh (normal TTL for REST fallback)
    if (Date.now() - this.cache.lastUpdate < this.CACHE_TTL_MS) {
      return this.cache;
    }

    try {
      const cgData = await this.fetchCoinGeckoPrices(['bitcoin', 'ethereum', 'binancecoin']);

      let bnbData = cgData.binancecoin ? { 
        price: cgData.binancecoin.usd, 
        change24h: cgData.binancecoin.usd_24h_change || 0 
      } : undefined;

      if (!bnbData && this.cache.bnb) {
        bnbData = this.cache.bnb;
        console.log('[MarketData] Using cached BNB price:', bnbData.price);
      }

      this.cache = {
        bnb: bnbData,
        bitcoin: cgData.bitcoin ? { 
          price: cgData.bitcoin.usd, 
          change24h: cgData.bitcoin.usd_24h_change || 0 
        } : this.cache.bitcoin,
        ethereum: cgData.ethereum ? { 
          price: cgData.ethereum.usd, 
          change24h: cgData.ethereum.usd_24h_change || 0 
        } : this.cache.ethereum,
        lastUpdate: Date.now(),
        source: 'coingecko',
      };

      this.updateContextManager();
      this.notifySubscribers();
      return this.cache;
    } catch (e) {
      console.error('[MarketData] Failed to fetch prices:', e);
      return this.cache;
    }
  }

  private async fetchCoinGeckoPrices(ids: string[]): Promise<Record<string, CoinGeckoPrice>> {
    try {
      const response = await fetch(
        `${this.COINGECKO_API}/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_24hr_change=true`
      );

      if (!response.ok) {
        console.warn('[MarketData] CoinGecko API error:', response.status);
        return {};
      }

      return await response.json();
    } catch (e) {
      console.error('CoinGecko price fetch failed:', e);
      return {};
    }
  }

  private updateContextManager(): void {
    const updates: Record<string, any> = {};

    if (this.cache.bnb) {
      updates.bnbPrice = this.cache.bnb.price;
      updates.priceChange24h = this.cache.bnb.change24h;
    }
    if (this.cache.bitcoin) {
      updates.btcPrice = this.cache.bitcoin.price;
      updates.btcChange24h = this.cache.bitcoin.change24h;
    }
    if (this.cache.ethereum) {
      updates.ethPrice = this.cache.ethereum.price;
      updates.ethChange24h = this.cache.ethereum.change24h;
    }

    contextManager.updateMarketContext(updates);
  }

  async fetchPumpFunTrending(): Promise<void> {
    try {
      const tokens = await pumpfunApi.getTopTokens('market_cap', 5);
      
      if (tokens.length > 0) {
        contextManager.updateMarketContext({
          pumpfunTrending: tokens.map(t => ({
            symbol: t.symbol,
            name: t.name,
            marketCap: t.marketCapSol || 0,
          })),
        });
      }
    } catch (e) {
      console.error('[MarketData] PumpFun trending error:', e);
    }
  }

  async fetchBinanceRankings(): Promise<void> {
    try {
      const [rankings, memeTokens] = await Promise.all([
        binanceAgentSkills.getMarketRankings(10),
        binanceAgentSkills.getMemeTokenTracking(8),
      ]);

      contextManager.updateMarketContext({
        binanceTopGainers: rankings.topGainers.slice(0, 5).map(t => ({
          symbol: t.symbol,
          priceChangePercent: t.priceChangePercent,
        })),
        binanceTopLosers: rankings.topLosers.slice(0, 5).map(t => ({
          symbol: t.symbol,
          priceChangePercent: t.priceChangePercent,
        })),
        binanceMemeTokens: memeTokens.slice(0, 5).map(t => ({
          symbol: t.symbol,
          priceChangePercent: t.priceChangePercent,
        })),
        binanceRankingsLastUpdate: Date.now(),
      });

      console.log('[MarketData] Binance rankings updated');
    } catch (e) {
      console.error('[MarketData] Binance rankings error:', e);
    }
  }

  startMonitoring(intervalMs: number = 60000): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Primary: Connect to Binance WebSocket for real-time updates
    this.connectBinanceWS();

    // Fallback: Fetch initial prices and trending data
    this.fetchAllPrices();
    this.fetchPumpFunTrending();
    this.fetchBinanceRankings();

    // Continue polling as fallback (less frequent since Binance WS is primary)
    this.updateInterval = setInterval(async () => {
      // Only use REST fallback if Binance is disconnected
      if (!this.binanceConnected) {
        await this.fetchAllPrices();
      }
      await this.fetchPumpFunTrending();
      await this.fetchBinanceRankings();
    }, intervalMs);

    console.log('[MarketData] Monitoring started (Binance WS + Agent Skills + REST fallback)');
  }

  stopMonitoring(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.disconnectBinanceWS();
    console.log('[MarketData] Monitoring stopped');
  }

  getFormattedSummary(): string {
    const parts: string[] = [];
    
    if (this.cache.bitcoin) {
      const change = this.cache.bitcoin.change24h >= 0 ? '+' : '';
      parts.push(`BTC: $${this.cache.bitcoin.price.toLocaleString()} (${change}${this.cache.bitcoin.change24h.toFixed(1)}%)`);
    }
    
    if (this.cache.ethereum) {
      const change = this.cache.ethereum.change24h >= 0 ? '+' : '';
      parts.push(`ETH: $${this.cache.ethereum.price.toLocaleString()} (${change}${this.cache.ethereum.change24h.toFixed(1)}%)`);
    }
    
    if (this.cache.bnb) {
      const change = this.cache.bnb.change24h >= 0 ? '+' : '';
      parts.push(`BNB: $${this.cache.bnb.price.toFixed(2)} (${change}${this.cache.bnb.change24h.toFixed(1)}%)`);
    }
    
    return parts.join(' | ');
  }

  getCachedData(): MarketData {
    return { ...this.cache };
  }
}

export const marketDataApi = new MarketDataApi();
