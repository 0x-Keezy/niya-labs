import { config } from '@/utils/config';

export interface MemoryEntry {
  timestamp: number;
  type: 'conversation' | 'observation' | 'action' | 'market' | 'emotion';
  content: string;
  importance: number;
  metadata?: Record<string, any>;
}

export interface EmotionalState {
  current: string;
  intensity: number;
  history: Array<{ emotion: string; timestamp: number }>;
  triggers: string[];
}

export interface VisualContext {
  lastScreenshot?: string;
  lastAnalysis?: string;
  lastCaptureTime?: number;
  observations: string[];
}

export interface MarketContext {
  solanaPrice?: number;
  priceChange24h?: number;
  btcPrice?: number;
  btcChange24h?: number;
  ethPrice?: number;
  ethChange24h?: number;
  bnbPrice?: number;
  bnbChange24h?: number;
  lastUpdate?: number;
  watchlist: Array<{ symbol: string; price: number; change: number }>;
  alerts: string[];
  pumpfunTrending?: Array<{ symbol: string; name: string; marketCap: number }>;
  binanceTopGainers?: Array<{ symbol: string; priceChangePercent: number }>;
  binanceTopLosers?: Array<{ symbol: string; priceChangePercent: number }>;
  binanceMemeTokens?: Array<{ symbol: string; priceChangePercent: number }>;
  binanceRankingsLastUpdate?: number;
}

export interface AgentContext {
  memory: MemoryEntry[];
  emotionalState: EmotionalState;
  visualContext: VisualContext;
  marketContext: MarketContext;
  personality: {
    name: string;
    traits: string[];
    goals: string[];
  };
}

const MAX_MEMORY_ENTRIES = 100;
const MEMORY_DECAY_HOURS = 24;

class ContextManagerClass {
  private context: AgentContext;
  private initialized: boolean = false;

  constructor() {
    this.context = this.createDefaultContext();
  }

  private createDefaultContext(): AgentContext {
    return {
      memory: [],
      emotionalState: {
        current: 'neutral',
        intensity: 0.5,
        history: [],
        triggers: [],
      },
      visualContext: {
        observations: [],
      },
      marketContext: {
        watchlist: [],
        alerts: [],
      },
      personality: {
        name: config('name') || 'Niya',
        traits: ['witty', 'intelligent', 'crypto-savvy', 'viral'],
        goals: ['engage users', 'provide market insights', 'create viral content'],
      },
    };
  }

  public initialize(): void {
    if (this.initialized) return;
    
    this.loadFromStorage();
    
    if (typeof window !== 'undefined') {
      this.startMemoryDecay();
    }
    
    this.initialized = true;
    console.log('ContextManager initialized');
  }

  public shutdown(): void {
    if (this.decayIntervalId) {
      clearInterval(this.decayIntervalId);
      this.decayIntervalId = null;
    }
    this.initialized = false;
    console.log('ContextManager shut down');
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('niya_context');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.context = { ...this.context, ...parsed };
      }
    } catch (e) {
      console.error('Failed to load context from storage:', e);
    }
  }

  private saveToStorage(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem('niya_context', JSON.stringify(this.context));
    } catch (e) {
      console.error('Failed to save context to storage:', e);
    }
  }

  private decayIntervalId: NodeJS.Timeout | null = null;

  private startMemoryDecay(): void {
    if (this.decayIntervalId) {
      clearInterval(this.decayIntervalId);
    }
    
    this.decayIntervalId = setInterval(() => {
      const now = Date.now();
      const decayThreshold = now - MEMORY_DECAY_HOURS * 60 * 60 * 1000;
      
      this.context.memory = this.context.memory.filter(entry => {
        if (entry.timestamp > decayThreshold) return true;
        if (entry.importance >= 0.8) return true;
        return false;
      });

      if (this.context.memory.length > MAX_MEMORY_ENTRIES) {
        this.context.memory = this.context.memory
          .sort((a, b) => b.importance - a.importance)
          .slice(0, MAX_MEMORY_ENTRIES);
      }

      this.saveToStorage();
    }, 60 * 60 * 1000);
  }

  public addMemory(type: MemoryEntry['type'], content: string, importance: number = 0.5, metadata?: Record<string, any>): void {
    const entry: MemoryEntry = {
      timestamp: Date.now(),
      type,
      content,
      importance: Math.min(1, Math.max(0, importance)),
      metadata,
    };

    this.context.memory.push(entry);
    
    if (this.context.memory.length > MAX_MEMORY_ENTRIES) {
      this.context.memory = this.context.memory
        .sort((a, b) => b.importance - a.importance)
        .slice(0, MAX_MEMORY_ENTRIES);
    }

    this.saveToStorage();
  }

  public getRecentMemories(count: number = 10, type?: MemoryEntry['type']): MemoryEntry[] {
    let memories = [...this.context.memory];
    
    if (type) {
      memories = memories.filter(m => m.type === type);
    }

    return memories
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }

  public getImportantMemories(threshold: number = 0.7): MemoryEntry[] {
    return this.context.memory.filter(m => m.importance >= threshold);
  }

  public setEmotion(emotion: string, intensity: number = 0.5, trigger?: string): void {
    this.context.emotionalState.current = emotion;
    this.context.emotionalState.intensity = Math.min(1, Math.max(0, intensity));
    this.context.emotionalState.history.push({
      emotion,
      timestamp: Date.now(),
    });

    if (trigger) {
      this.context.emotionalState.triggers.push(trigger);
    }

    if (this.context.emotionalState.history.length > 50) {
      this.context.emotionalState.history = this.context.emotionalState.history.slice(-50);
    }

    this.saveToStorage();
  }

  public getEmotion(): EmotionalState {
    return { ...this.context.emotionalState };
  }

  public updateVisualContext(screenshot: string, analysis: string): void {
    this.context.visualContext = {
      lastScreenshot: screenshot,
      lastAnalysis: analysis,
      lastCaptureTime: Date.now(),
      observations: [
        analysis,
        ...this.context.visualContext.observations.slice(0, 9),
      ],
    };

    this.addMemory('observation', analysis, 0.6);
    this.saveToStorage();
  }

  public getVisualContext(): VisualContext {
    return { ...this.context.visualContext };
  }

  public updateMarketContext(data: Partial<MarketContext>): void {
    this.context.marketContext = {
      ...this.context.marketContext,
      ...data,
      lastUpdate: Date.now(),
    };

    if (data.solanaPrice && data.priceChange24h) {
      if (Math.abs(data.priceChange24h) >= 10) {
        const direction = data.priceChange24h > 0 ? 'pumping' : 'dumping';
        const alert = `SOL is ${direction} ${Math.abs(data.priceChange24h).toFixed(1)}%!`;
        this.context.marketContext.alerts.push(alert);
        this.addMemory('market', alert, 0.9, { priceChange: data.priceChange24h });
      }
    }

    this.saveToStorage();
  }

  public getMarketContext(): MarketContext {
    return { ...this.context.marketContext };
  }

  public getMarketAlerts(): string[] {
    const alerts = [...this.context.marketContext.alerts];
    this.context.marketContext.alerts = [];
    this.saveToStorage();
    return alerts;
  }

  public buildContextPrompt(): string {
    const recentMemories = this.getRecentMemories(5);
    const emotion = this.getEmotion();
    const visual = this.getVisualContext();
    const market = this.getMarketContext();

    let prompt = `Current emotional state: ${emotion.current} (intensity: ${emotion.intensity.toFixed(1)})\n`;

    const marketParts: string[] = [];
    if (market.btcPrice) {
      const change = market.btcChange24h ? `${market.btcChange24h >= 0 ? '+' : ''}${market.btcChange24h.toFixed(1)}%` : '';
      marketParts.push(`BTC $${market.btcPrice.toLocaleString()} ${change}`);
    }
    if (market.ethPrice) {
      const change = market.ethChange24h ? `${market.ethChange24h >= 0 ? '+' : ''}${market.ethChange24h.toFixed(1)}%` : '';
      marketParts.push(`ETH $${market.ethPrice.toLocaleString()} ${change}`);
    }
    if (market.solanaPrice) {
      const change = market.priceChange24h ? `${market.priceChange24h >= 0 ? '+' : ''}${market.priceChange24h.toFixed(1)}%` : '';
      marketParts.push(`SOL $${market.solanaPrice.toFixed(2)} ${change}`);
    }
    if (marketParts.length > 0) {
      prompt += `\nMarket: ${marketParts.join(' | ')}\n`;
    }
    if (market.bnbPrice) {
      const change = market.bnbChange24h ? `${market.bnbChange24h >= 0 ? '+' : ''}${market.bnbChange24h.toFixed(1)}%` : '';
      marketParts.push(`BNB $${market.bnbPrice.toFixed(2)} ${change}`);
    }
    if (market.pumpfunTrending && market.pumpfunTrending.length > 0) {
      prompt += `\nPumpFun trending: ${market.pumpfunTrending.slice(0, 3).map(t => `$${t.symbol}`).join(', ')}\n`;
    }

    if (market.binanceTopGainers && market.binanceTopGainers.length > 0) {
      const gainers = market.binanceTopGainers.slice(0, 5)
        .map(t => `${t.symbol} +${t.priceChangePercent.toFixed(1)}%`)
        .join(', ');
      prompt += `\nBinance top gainers today: ${gainers}\n`;
    }

    if (market.binanceMemeTokens && market.binanceMemeTokens.length > 0) {
      const memes = market.binanceMemeTokens.slice(0, 3)
        .map(t => `${t.symbol} ${t.priceChangePercent >= 0 ? '+' : ''}${t.priceChangePercent.toFixed(1)}%`)
        .join(', ');
      prompt += `\nMeme tokens on Binance: ${memes}\n`;
    }

    if (visual.lastAnalysis) {
      prompt += `\nVisual observation: ${visual.lastAnalysis}\n`;
    }

    if (recentMemories.length > 0) {
      prompt += `\nRecent context:\n`;
      recentMemories.forEach(m => {
        prompt += `- [${m.type}] ${m.content}\n`;
      });
    }

    return prompt;
  }

  public getFullContext(): AgentContext {
    return JSON.parse(JSON.stringify(this.context));
  }

  public reset(): void {
    this.context = this.createDefaultContext();
    this.saveToStorage();
  }
}

export const contextManager = new ContextManagerClass();
