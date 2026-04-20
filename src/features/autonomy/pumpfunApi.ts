import { config } from '@/utils/config';
import { contextManager } from './contextManager';
import { transactionValidator, ValidationResult } from './transactionValidator';
import bs58 from 'bs58';

interface TradeLogEntry {
  id: string;
  timestamp: number;
  type: 'buy' | 'sell';
  mint: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  signature?: string;
  error?: string;
  solAmount?: number;
  tokenAmount?: number;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      if (response.ok || response.status === 400 || response.status === 404) {
        return response;
      }
      
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`[PumpFun] Retry ${attempt + 1}/${maxRetries} in ${Math.round(delay)}ms:`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  throw lastError || new Error('Request failed after retries');
}

export interface PumpFunTokenInfo {
  mint: string;
  name: string;
  symbol: string;
  description?: string;
  imageUri?: string;
  createdTimestamp?: number;
  bondingCurveKey?: string;
  marketCapSol?: number;
  marketCapUsd?: number;
  priceUsd?: number;
  priceNative?: number;
  volumeSol?: number;
  volume24h?: number;
  priceChange24h?: number;
  fdv?: number;
  dexId?: string;
  pairAddress?: string;
  complete?: boolean;
  isStreaming?: boolean;
  streamUrl?: string;
  source?: string;
}

export interface PumpFunLiveStream {
  tokenMint: string;
  tokenName: string;
  tokenSymbol: string;
  streamerAddress: string;
  viewerCount: number;
  thumbnailUrl?: string;
  marketCapUsd?: number;
  isLive: boolean;
}

export interface PumpFunTrade {
  signature: string;
  mint: string;
  type: 'buy' | 'sell';
  solAmount: number;
  tokenAmount: number;
  pricePerToken: number;
  timestamp: number;
  trader: string;
}

export interface PumpFunQuote {
  mint: string;
  type: 'buy' | 'sell';
  inAmount: number;
  outAmount: number;
  priceImpact: number;
  fee: number;
}

export interface PumpFunSwapParams {
  wallet: string;
  action: 'buy' | 'sell';
  mint: string;
  amount: number;
  denominatedInSol?: boolean;
  slippage?: number;
  priorityFee?: number;
}

type MessageCallback = (data: any) => void;
type EventType = 'newToken' | 'tokenTrade' | 'accountTrade';

export interface PumpFunConfig {
  infoOnlyMode: boolean;
  enableAutoTrading: boolean;
  maxTradeAmountSol: number;
  allowedTokenSymbols: string[];
}

class PumpFunApi {
  private ws: WebSocket | null = null;
  private subscribers: Map<EventType, Set<MessageCallback>> = new Map();
  private subscribedTokens: Set<string> = new Set();
  private subscribedAccounts: Set<string> = new Set();
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private tradeLog: TradeLogEntry[] = [];
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private circuitOpen: boolean = false;
  private config: PumpFunConfig = {
    infoOnlyMode: true,
    enableAutoTrading: false,
    maxTradeAmountSol: 0.1,
    allowedTokenSymbols: [],
  };
  
  // Throttling for expensive endpoints
  private lastTopTokensCall: number = 0;
  private topTokensCache: PumpFunTokenInfo[] = [];
  private readonly TOP_TOKENS_THROTTLE_MS = 60000; // 1 minute cache
  
  private readonly PUMPPORTAL_API = 'https://pumpportal.fun/api';
  private readonly PUMPPORTAL_WS = 'wss://pumpportal.fun/api/data';
  private readonly PUMP_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
  private readonly CIRCUIT_BREAKER_THRESHOLD = 10;
  private readonly CIRCUIT_BREAKER_RESET_MS = 30000;
  private readonly MAX_TRADE_LOG_SIZE = 100;

  constructor() {
    this.subscribers.set('newToken', new Set());
    this.subscribers.set('tokenTrade', new Set());
    this.subscribers.set('accountTrade', new Set());
  }

  setConfig(config: Partial<PumpFunConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[PumpFun] Config updated:', this.config);
  }

  getConfig(): PumpFunConfig {
    return { ...this.config };
  }

  isInfoOnlyMode(): boolean {
    return this.config.infoOnlyMode || !this.config.enableAutoTrading;
  }

  private logTrade(entry: Omit<TradeLogEntry, 'id' | 'timestamp'>): TradeLogEntry {
    const logEntry: TradeLogEntry = {
      id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      ...entry,
    };
    
    this.tradeLog.unshift(logEntry);
    
    if (this.tradeLog.length > this.MAX_TRADE_LOG_SIZE) {
      this.tradeLog = this.tradeLog.slice(0, this.MAX_TRADE_LOG_SIZE);
    }
    
    console.log(`[PumpFun Trade Log] ${logEntry.status.toUpperCase()}: ${logEntry.type} ${logEntry.amount} SOL of ${logEntry.mint.slice(0, 8)}...`);
    
    return logEntry;
  }

  private updateTradeLog(id: string, updates: Partial<TradeLogEntry>): void {
    const entry = this.tradeLog.find(e => e.id === id);
    if (entry) {
      Object.assign(entry, updates);
    }
  }

  getTradeLog(): TradeLogEntry[] {
    return [...this.tradeLog];
  }

  getTradeStats(): { total: number; successful: number; failed: number; pending: number } {
    return {
      total: this.tradeLog.length,
      successful: this.tradeLog.filter(t => t.status === 'success').length,
      failed: this.tradeLog.filter(t => t.status === 'failed').length,
      pending: this.tradeLog.filter(t => t.status === 'pending').length,
    };
  }

  private checkCircuitBreaker(): boolean {
    if (!this.circuitOpen) return false;
    
    // Allow trial request after cooldown period
    if (Date.now() - this.lastFailureTime > this.CIRCUIT_BREAKER_RESET_MS) {
      console.log('[PumpFun] Circuit breaker half-open - allowing trial request');
      // Reset to half-open state - next success will close, next failure will re-open
      this.circuitOpen = false;
      this.failureCount = this.CIRCUIT_BREAKER_THRESHOLD - 1; // One more failure will re-open
      return false;
    }
    
    console.warn('[PumpFun] Circuit breaker OPEN - requests blocked');
    return true;
  }

  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.CIRCUIT_BREAKER_THRESHOLD) {
      this.circuitOpen = true;
      console.error(`[PumpFun] Circuit breaker OPENED after ${this.failureCount} failures`);
    }
  }

  private recordSuccess(): void {
    // On success, fully close the circuit and reset failure count
    if (this.circuitOpen || this.failureCount > 0) {
      console.log('[PumpFun] Circuit breaker closed - request succeeded');
    }
    this.circuitOpen = false;
    this.failureCount = 0;
  }

  async connectWebSocket(): Promise<void> {
    if (this.ws && this.isConnected) return;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.PUMPPORTAL_WS);
        
        this.ws.onopen = () => {
          console.log('[PumpFun] WebSocket connected');
          this.isConnected = true;
          
          this.resubscribeAll();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (e) {
            console.error('[PumpFun] Failed to parse message:', e);
          }
        };

        this.ws.onclose = () => {
          console.log('[PumpFun] WebSocket disconnected');
          this.isConnected = false;
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('[PumpFun] WebSocket error:', error);
          reject(error);
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  private handleMessage(data: any): void {
    if (data.txType === 'create' || data.type === 'newToken') {
      this.notifySubscribers('newToken', this.parseNewToken(data));
    } else if (data.txType === 'buy' || data.txType === 'sell') {
      this.notifySubscribers('tokenTrade', this.parseTrade(data));
    } else if (data.accountKey) {
      this.notifySubscribers('accountTrade', data);
    }
  }

  private parseNewToken(data: any): PumpFunTokenInfo {
    return {
      mint: data.mint || data.tokenMint,
      name: data.name || 'Unknown',
      symbol: data.symbol || 'UNKN',
      description: data.description,
      imageUri: data.uri || data.imageUri,
      createdTimestamp: data.timestamp ? Date.parse(data.timestamp) : Date.now(),
      bondingCurveKey: data.bondingCurveKey,
      marketCapSol: data.marketCapSol,
      complete: data.complete || false,
    };
  }

  private parseTrade(data: any): PumpFunTrade {
    return {
      signature: data.signature || '',
      mint: data.mint || data.tokenMint,
      type: data.txType === 'buy' ? 'buy' : 'sell',
      solAmount: data.solAmount || 0,
      tokenAmount: data.tokenAmount || 0,
      pricePerToken: data.tokenAmount ? data.solAmount / data.tokenAmount : 0,
      timestamp: data.timestamp ? Date.parse(data.timestamp) : Date.now(),
      trader: data.traderPublicKey || '',
    };
  }

  private notifySubscribers(event: EventType, data: any): void {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }

  private resubscribeAll(): void {
    if (!this.ws || !this.isConnected) return;

    if (this.subscribers.get('newToken')?.size) {
      this.ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
    }

    if (this.subscribedTokens.size > 0) {
      this.ws.send(JSON.stringify({
        method: 'subscribeTokenTrade',
        keys: Array.from(this.subscribedTokens),
      }));
    }

    if (this.subscribedAccounts.size > 0) {
      this.ws.send(JSON.stringify({
        method: 'subscribeAccountTrade',
        keys: Array.from(this.subscribedAccounts),
      }));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWebSocket().catch(console.error);
    }, 5000);
  }

  on(event: EventType, callback: MessageCallback): () => void {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      callbacks.add(callback);
      
      if (event === 'newToken' && this.ws && this.isConnected) {
        this.ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
      }
    }
    
    return () => {
      callbacks?.delete(callback);
    };
  }

  subscribeToToken(mint: string): void {
    this.subscribedTokens.add(mint);
    
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        method: 'subscribeTokenTrade',
        keys: [mint],
      }));
    }
  }

  unsubscribeFromToken(mint: string): void {
    this.subscribedTokens.delete(mint);
    
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        method: 'unsubscribeTokenTrade',
        keys: [mint],
      }));
    }
  }

  subscribeToAccount(pubkey: string): void {
    this.subscribedAccounts.add(pubkey);
    
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({
        method: 'subscribeAccountTrade',
        keys: [pubkey],
      }));
    }
  }

  async getQuote(mint: string, type: 'buy' | 'sell', amount: number): Promise<PumpFunQuote | null> {
    if (this.checkCircuitBreaker()) {
      return null;
    }

    try {
      const response = await fetchWithRetry(`${this.PUMPPORTAL_API}/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mint,
          type: type.toUpperCase(),
          amount: Math.floor(amount * 1e9),
        }),
      });

      if (!response.ok) {
        console.error('[PumpFun] Quote failed:', response.status);
        this.recordFailure();
        return null;
      }

      this.recordSuccess();
      const data = await response.json();
      return {
        mint,
        type,
        inAmount: amount,
        outAmount: data.outAmount / 1e6,
        priceImpact: data.priceImpact || 0,
        fee: data.fee || 0,
      };
    } catch (e) {
      console.error('[PumpFun] Quote error:', e);
      this.recordFailure();
      return null;
    }
  }

  async createSwapTransaction(params: PumpFunSwapParams): Promise<{ transaction: Uint8Array; validation: ValidationResult; logId: string } | null> {
    if (this.isInfoOnlyMode()) {
      console.warn('[PumpFun] INFO-ONLY MODE: Trade blocked. Trading is disabled.');
      return null;
    }

    if (this.checkCircuitBreaker()) {
      return null;
    }

    if (params.amount > this.config.maxTradeAmountSol) {
      console.warn(`[PumpFun] Trade blocked: Amount ${params.amount} SOL exceeds max ${this.config.maxTradeAmountSol} SOL`);
      return null;
    }

    const logEntry = this.logTrade({
      type: params.action,
      mint: params.mint,
      amount: params.amount,
      status: 'pending',
    });

    try {
      const response = await fetchWithRetry(`${this.PUMPPORTAL_API}/trade-local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: params.wallet,
          action: params.action,
          mint: params.mint,
          denominatedInSol: params.denominatedInSol ?? true,
          amount: params.amount,
          slippage: params.slippage ?? 1,
          priorityFee: params.priorityFee ?? 0.0001,
          pool: 'pump',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[PumpFun] Swap transaction failed:', error);
        this.recordFailure();
        this.updateTradeLog(logEntry.id, { status: 'failed', error });
        return null;
      }

      const buffer = await response.arrayBuffer();
      const txBytes = new Uint8Array(buffer);
      
      const serializedTx = bs58.encode(txBytes);
      console.log(`[PumpFun] Transaction prepared: ${params.action.toUpperCase()} ${params.mint.slice(0, 8)}...`);
      console.log('[PumpFun] Note: Solana transactions bypass BNB Chain validator');
      
      const validation = { 
        valid: true, 
        warnings: [] as string[], 
        details: 'Solana transaction (bypasses BNB Chain validator)', 
        blockedPrograms: [] as string[],
        contractsUsed: [] as string[],
        blockedContracts: [] as string[]
      };
      
      this.recordSuccess();
      return { transaction: txBytes, validation, logId: logEntry.id };
    } catch (e) {
      console.error('[PumpFun] Swap transaction error:', e);
      this.recordFailure();
      this.updateTradeLog(logEntry.id, { status: 'failed', error: String(e) });
      return null;
    }
  }

  markTradeSuccess(logId: string, signature: string): void {
    this.updateTradeLog(logId, { status: 'success', signature });
  }

  markTradeFailed(logId: string, error: string): void {
    this.updateTradeLog(logId, { status: 'failed', error });
  }

  async getTokenInfo(mint: string): Promise<PumpFunTokenInfo | null> {
    if (this.checkCircuitBreaker()) {
      return null;
    }

    try {
      const response = await fetchWithRetry(`${this.PUMPPORTAL_API}/token/${mint}`);
      
      if (!response.ok) {
        // 404 means token not found - don't count as circuit breaker failure
        if (response.status === 404) {
          console.warn(`[PumpFun] Token ${mint.slice(0, 8)}... not found (404)`);
          return null;
        }
        console.warn(`[PumpFun] Token info failed with status: ${response.status}`);
        this.recordFailure();
        return null;
      }

      this.recordSuccess();
      const data = await response.json();
      return {
        mint: data.mint || mint,
        name: data.name || 'Unknown',
        symbol: data.symbol || '???',
        description: data.description,
        imageUri: data.image_uri,
        marketCapSol: data.market_cap,
        priceUsd: data.usd_market_cap ? data.usd_market_cap / (data.market_cap || 1) : undefined,
        volumeSol: data.volume_24h,
        complete: data.complete,
        bondingCurveKey: data.bonding_curve,
      };
    } catch (e) {
      console.error('[PumpFun] Token info error:', e);
      this.recordFailure();
      return null;
    }
  }

  async searchTokens(query: string, limit = 10): Promise<PumpFunTokenInfo[]> {
    try {
      const response = await fetch(
        `${this.PUMPPORTAL_API}/search?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return (data.tokens || data || []).map((t: any) => ({
        mint: t.mint,
        name: t.name,
        symbol: t.symbol,
        marketCapSol: t.market_cap,
        priceUsd: t.usd_price,
        complete: t.complete,
      }));
    } catch (e) {
      console.error('[PumpFun] Search error:', e);
      return [];
    }
  }

  async requestSwapViaEliza(
    mint: string,
    action: 'buy' | 'sell',
    amount: number,
    slippage = 1
  ): Promise<boolean> {
    if (this.isInfoOnlyMode()) {
      console.warn('[PumpFun] INFO-ONLY MODE: Swap request blocked. Use for market info only.');
      contextManager.addMemory(
        'action',
        `[INFO-ONLY] Would have ${action} ${amount} SOL of token ${mint.slice(0, 8)}... but trading is disabled`,
        0.6,
        { mint, action, amount, blocked: true }
      );
      return false;
    }

    try {
      const { elizaOSBridge } = await import('./elizaOSBridge');
      
      if (!elizaOSBridge.getState().isConnected) {
        console.warn('[PumpFun] ElizaOS not connected for swap');
        return false;
      }

      elizaOSBridge.requestAction('pumpfun_swap', {
        mint,
        action,
        amount,
        slippage,
        pool: 'pump',
      });

      contextManager.addMemory(
        'action',
        `Requested ${action} ${amount} SOL of PumpFun token ${mint}`,
        0.8,
        { mint, action, amount }
      );

      return true;
    } catch (e) {
      console.error('[PumpFun] Eliza swap request error:', e);
      return false;
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getLiveStreamUrl(tokenMint: string): string {
    return `https://pump.fun/coin/${tokenMint}`;
  }

  getLiveStreamEmbedUrl(tokenMint: string): string {
    return `https://pump.fun/coin/${tokenMint}`;
  }

  async getLiveStreams(): Promise<PumpFunLiveStream[]> {
    try {
      const response = await fetch('https://frontend-api.pump.fun/coins/featured', {
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        console.warn('[PumpFun] Failed to fetch live streams');
        return [];
      }

      const data = await response.json();
      
      return (data || []).slice(0, 20).map((item: any) => ({
        tokenMint: item.mint,
        tokenName: item.name || 'Unknown',
        tokenSymbol: item.symbol || 'UNKN',
        streamerAddress: item.creator || '',
        viewerCount: item.reply_count || 0,
        thumbnailUrl: item.image_uri,
        marketCapUsd: item.usd_market_cap,
        isLive: true,
      }));
    } catch (e) {
      console.error('[PumpFun] Live streams error:', e);
      return [];
    }
  }

  async getTopTokens(sortBy: 'market_cap' | 'created_timestamp' | 'volume' = 'market_cap', limit = 20): Promise<PumpFunTokenInfo[]> {
    // Return cached data if still fresh to avoid excessive API calls
    const now = Date.now();
    if (this.topTokensCache.length > 0 && (now - this.lastTopTokensCall) < this.TOP_TOKENS_THROTTLE_MS) {
      return this.topTokensCache;
    }

    // Check circuit breaker before making request
    if (this.checkCircuitBreaker()) {
      return this.topTokensCache;
    }

    try {
      // Try DexScreener API as primary source (more reliable)
      const tokens = await this.fetchFromDexScreener(limit);
      if (tokens.length > 0) {
        this.recordSuccess();
        this.lastTopTokensCall = now;
        this.topTokensCache = tokens;
        return this.topTokensCache;
      }
      
      // If DexScreener fails, ensure WebSocket is connected to receive new tokens
      if (!this.isConnected) {
        this.connectWebSocket().catch(() => {});
      }
      
      return this.topTokensCache;
    } catch (e: any) {
      console.warn('[PumpFun] Top tokens unavailable, using cache');
      this.recordFailure();
      return this.topTokensCache;
    }
  }

  private async fetchFromDexScreener(limit: number): Promise<PumpFunTokenInfo[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      // DexScreener API for Solana tokens sorted by volume
      const response = await fetch('https://api.dexscreener.com/latest/dex/tokens/solana', {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) return [];
      
      const data = await response.json();
      const pairs = data.pairs || [];
      
      // Filter for pump.fun tokens and map to our format
      return pairs
        .filter((p: any) => p.dexId === 'raydium' || p.url?.includes('pump.fun'))
        .slice(0, limit)
        .map((p: any) => ({
          mint: p.baseToken?.address || '',
          name: p.baseToken?.name || 'Unknown',
          symbol: p.baseToken?.symbol || 'UNKN',
          description: '',
          imageUri: '',
          marketCapSol: p.fdv ? p.fdv / (p.priceNative || 1) : undefined,
          priceUsd: parseFloat(p.priceUsd) || undefined,
          complete: true,
          isStreaming: false,
        }));
    } catch (e) {
      return [];
    }
  }

  // Subscribe to new tokens via WebSocket for real-time updates
  async subscribeToNewTokens(): Promise<void> {
    if (!this.isConnected) {
      await this.connectWebSocket();
    }
    
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
      console.log('[PumpFun] Subscribed to new tokens via WebSocket');
    }
  }
}

export const pumpfunApi = new PumpFunApi();
