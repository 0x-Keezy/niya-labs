import { config } from '@/utils/config';
import { contextManager } from './contextManager';
import { visionProcessor } from './visionProcessor';
import { Viewer } from '@/features/vrmViewer/viewer';
import { binanceAgentSkills } from '@/features/market/binanceAgentSkills';

export interface FunctionCall {
  name: string;
  arguments: Record<string, any>;
}

export interface FunctionResult {
  success: boolean;
  result?: any;
  error?: string;
}

export const availableFunctions = {
  adjust_emotion: {
    description: 'Adjust the avatar emotion and expression',
    parameters: {
      emotion: {
        type: 'string',
        enum: ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised', 'shy', 'jealous', 'bored', 'serious', 'suspicious', 'victory', 'sleep', 'love'],
        description: 'The emotion to express',
      },
      intensity: {
        type: 'number',
        description: 'Intensity from 0 to 1',
      },
    },
  },
  play_animation: {
    description: 'Play a specific animation',
    parameters: {
      animation: {
        type: 'string',
        description: 'Animation name to play',
      },
    },
  },
  look_around: {
    description: 'Make the avatar look in a direction',
    parameters: {
      direction: {
        type: 'string',
        enum: ['left', 'right', 'up', 'down', 'center'],
        description: 'Direction to look',
      },
    },
  },
  learn_fact: {
    description: 'Store an important fact in memory',
    parameters: {
      fact: {
        type: 'string',
        description: 'The fact to remember',
      },
      importance: {
        type: 'number',
        description: 'How important is this fact (0-1)',
      },
    },
  },
  capture_vision: {
    description: 'Capture and analyze the current screen',
    parameters: {},
  },
  check_market: {
    description: 'Get current market data for Solana',
    parameters: {},
  },
  post_tweet: {
    description: 'Post a tweet (if Twitter is configured)',
    parameters: {
      content: {
        type: 'string',
        description: 'Tweet content (max 280 chars)',
      },
      style: {
        type: 'string',
        enum: ['informative', 'witty', 'viral', 'casual'],
        description: 'Tweet style',
      },
    },
  },
  get_market_rankings: {
    description: 'Get top gainers, losers and volume leaders from Binance right now. Use this when users ask about trending tokens, what is pumping, or what to watch.',
    parameters: {},
  },
  get_token_details: {
    description: 'Get detailed info about any token listed on Binance: price, 24h change, volume, high/low.',
    parameters: {
      symbol: {
        type: 'string',
        description: 'Token symbol e.g. BTC, ETH, BNB, DOGE, PEPE',
      },
    },
  },
  check_token_risk: {
    description: 'Check smart contract risk for a BNB Chain contract address. Detects mint functions, pause functions, unverified contracts.',
    parameters: {
      contract_address: {
        type: 'string',
        description: 'BNB Chain contract address starting with 0x',
      },
    },
  },
  check_wallet: {
    description: 'Get insights about a crypto wallet address on BNB Chain: balance, token holdings.',
    parameters: {
      address: {
        type: 'string',
        description: 'BNB Chain wallet address starting with 0x',
      },
    },
  },
  get_meme_tokens: {
    description: 'Get trending meme tokens on Binance right now with their 24h price changes. Use when users ask about meme coins or what memes are moving.',
    parameters: {},
  },
};

class FunctionCallingEnhancedClass {
  private viewer: Viewer | null = null;
  private enabled: boolean = true;

  public initialize(viewer: Viewer): void {
    this.viewer = viewer;
    console.log('FunctionCallingEnhanced initialized');
  }

  public setViewer(viewer: Viewer): void {
    this.viewer = viewer;
  }

  public async executeFunction(call: FunctionCall): Promise<FunctionResult> {
    if (!this.enabled) {
      return { success: false, error: 'Function calling is disabled' };
    }

    console.log(`Executing function: ${call.name}`, call.arguments);

    try {
      switch (call.name) {
        case 'adjust_emotion':
          return await this.adjustEmotion(call.arguments);
        case 'play_animation':
          return await this.playAnimation(call.arguments);
        case 'look_around':
          return await this.lookAround(call.arguments);
        case 'learn_fact':
          return await this.learnFact(call.arguments);
        case 'capture_vision':
          return await this.captureVision();
        case 'check_market':
          return await this.checkMarket();
        case 'post_tweet':
          return await this.postTweet(call.arguments);
        case 'get_market_rankings':
          return await this.getMarketRankings();
        case 'get_token_details':
          return await this.getTokenDetails(call.arguments);
        case 'check_token_risk':
          return await this.checkTokenRisk(call.arguments);
        case 'check_wallet':
          return await this.checkWallet(call.arguments);
        case 'get_meme_tokens':
          return await this.getMemeTokens();
        default:
          return { success: false, error: `Unknown function: ${call.name}` };
      }
    } catch (e: any) {
      console.error(`Function ${call.name} failed:`, e);
      return { success: false, error: e.toString() };
    }
  }

  private async adjustEmotion(args: Record<string, any>): Promise<FunctionResult> {
    const { emotion, intensity = 0.7 } = args;

    if (!this.viewer || !this.viewer.model) {
      console.warn('Viewer or model not available for emotion adjustment');
      contextManager.setEmotion(emotion, intensity, 'function_call');
      return { success: true, result: { emotion, intensity, viewerSkipped: true } };
    }

    try {
      this.viewer.model.playEmotion(emotion.charAt(0).toUpperCase() + emotion.slice(1));
      contextManager.setEmotion(emotion, intensity, 'function_call');
      return { success: true, result: { emotion, intensity } };
    } catch (e: any) {
      console.error('Failed to adjust emotion:', e);
      return { success: false, error: e.toString() };
    }
  }

  private async playAnimation(args: Record<string, any>): Promise<FunctionResult> {
    const { animation } = args;

    if (!this.viewer || !this.viewer.model) {
      return { success: false, error: 'Viewer not initialized' };
    }

    try {
      const { loadVRMAnimation } = await import('@/lib/VRMAnimation/loadVRMAnimation');
      const animPath = animation.endsWith('.vrma') ? animation : `${animation}.vrma`;
      const anim = await loadVRMAnimation(`/animations/${animPath}`);
      
      if (anim && this.viewer.model) {
        this.viewer.model.playAnimation(anim, animPath);
        return { success: true, result: { animation: animPath } };
      }

      return { success: false, error: 'Failed to load animation' };
    } catch (e: any) {
      console.error('Failed to play animation:', e);
      return { success: false, error: e.toString() };
    }
  }

  private async lookAround(args: Record<string, any>): Promise<FunctionResult> {
    const { direction } = args;
    
    contextManager.addMemory('action', `Looking ${direction}`, 0.3);

    return { success: true, result: { direction } };
  }

  private async learnFact(args: Record<string, any>): Promise<FunctionResult> {
    const { fact, importance = 0.6 } = args;

    contextManager.addMemory('observation', fact, importance);

    return { success: true, result: { fact, stored: true } };
  }

  private async captureVision(): Promise<FunctionResult> {
    const analysis = await visionProcessor.captureAndAnalyze();

    if (!analysis) {
      return { success: false, error: 'Vision capture failed' };
    }

    return { success: true, result: analysis };
  }

  private async checkMarket(): Promise<FunctionResult> {
    const market = contextManager.getMarketContext();
    return { success: true, result: market };
  }

  private async getMarketRankings(): Promise<FunctionResult> {
    try {
      const rankings = await binanceAgentSkills.getMarketRankings(10);
      const summary = binanceAgentSkills.getFormattedRankings(rankings);
      contextManager.updateMarketContext({
        binanceTopGainers: rankings.topGainers.slice(0, 5).map(t => ({
          symbol: t.symbol,
          priceChangePercent: t.priceChangePercent,
        })),
        binanceTopLosers: rankings.topLosers.slice(0, 5).map(t => ({
          symbol: t.symbol,
          priceChangePercent: t.priceChangePercent,
        })),
      });
      return { success: true, result: { summary, rankings } };
    } catch (e: any) {
      return { success: false, error: e.toString() };
    }
  }

  private async getTokenDetails(args: Record<string, any>): Promise<FunctionResult> {
    const { symbol } = args;
    if (!symbol) return { success: false, error: 'symbol is required' };
    try {
      const details = await binanceAgentSkills.getTokenDetails(symbol);
      if (!details) return { success: false, error: `${symbol} not found on Binance` };
      return {
        success: true,
        result: {
          summary: `${details.symbol}: $${details.price.toLocaleString()} (${details.priceChangePercent24h >= 0 ? '+' : ''}${details.priceChangePercent24h.toFixed(2)}% 24h), Vol: $${(details.quoteVolume24h / 1e6).toFixed(1)}M`,
          details,
        },
      };
    } catch (e: any) {
      return { success: false, error: e.toString() };
    }
  }

  private async checkTokenRisk(args: Record<string, any>): Promise<FunctionResult> {
    const { contract_address } = args;
    if (!contract_address) return { success: false, error: 'contract_address is required' };
    try {
      const risk = await binanceAgentSkills.checkContractRisk(contract_address);
      const summary = `Risk: ${risk.riskLevel.toUpperCase()} (score: ${risk.score}/100). ${risk.flags.length > 0 ? 'Flags: ' + risk.flags.join(', ') : 'No red flags found.'}`;
      return { success: true, result: { summary, risk } };
    } catch (e: any) {
      return { success: false, error: e.toString() };
    }
  }

  private async checkWallet(args: Record<string, any>): Promise<FunctionResult> {
    const { address } = args;
    if (!address) return { success: false, error: 'address is required' };
    try {
      const insights = await binanceAgentSkills.getAddressInsights(address);
      return { success: true, result: insights };
    } catch (e: any) {
      return { success: false, error: e.toString() };
    }
  }

  private async getMemeTokens(): Promise<FunctionResult> {
    try {
      const memes = await binanceAgentSkills.getMemeTokenTracking(10);
      if (memes.length === 0) return { success: false, error: 'No meme tokens found' };
      const summary = memes.slice(0, 5)
        .map(t => `${t.symbol} ${t.priceChangePercent >= 0 ? '+' : ''}${t.priceChangePercent.toFixed(1)}%`)
        .join(', ');
      contextManager.updateMarketContext({
        binanceMemeTokens: memes.slice(0, 5).map(t => ({
          symbol: t.symbol,
          priceChangePercent: t.priceChangePercent,
        })),
      });
      return { success: true, result: { summary, memes } };
    } catch (e: any) {
      return { success: false, error: e.toString() };
    }
  }

  private async postTweet(args: Record<string, any>): Promise<FunctionResult> {
    const { content, style = 'witty' } = args;

    if (content.length > 280) {
      return { success: false, error: 'Tweet exceeds 280 characters' };
    }

    try {
      const { autonomousTweeter } = await import('@/features/externalAPI/socialMedia/twitterAutonomous');
      const result = await autonomousTweeter.postTweet(content);
      
      if (result.success) {
        contextManager.addMemory('action', `Posted tweet: ${content}`, 0.7);
        return { success: true, result: { tweetId: result.tweetId } };
      }

      return { success: false, error: result.error };
    } catch (e: any) {
      return { success: false, error: e.toString() };
    }
  }

  public parseFunctionCalls(response: string): FunctionCall[] {
    const calls: FunctionCall[] = [];
    
    const patterns = [
      /\[FUNCTION:(\w+)\s*\((.*?)\)\]/g,
      /```function\s*\n?(\w+)\((.*?)\)\s*```/g,
      /\{\s*"function":\s*"(\w+)",\s*"arguments":\s*(\{.*?\})\s*\}/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        try {
          const name = match[1];
          let args: Record<string, any> = {};

          if (match[2]) {
            try {
              args = JSON.parse(match[2]);
            } catch {
              const pairs = match[2].split(',').map(s => s.trim());
              pairs.forEach(pair => {
                const [key, value] = pair.split('=').map(s => s.trim().replace(/['"]/g, ''));
                if (key && value) {
                  args[key] = isNaN(Number(value)) ? value : Number(value);
                }
              });
            }
          }

          if (availableFunctions.hasOwnProperty(name)) {
            calls.push({ name, arguments: args });
          }
        } catch (e) {
          console.warn('Failed to parse function call:', e);
        }
      }
    }

    return calls;
  }

  public async processResponse(response: string): Promise<{ text: string; results: FunctionResult[] }> {
    const calls = this.parseFunctionCalls(response);
    const results: FunctionResult[] = [];

    for (const call of calls) {
      const result = await this.executeFunction(call);
      results.push(result);
    }

    let cleanText = response;
    for (const pattern of [
      /\[FUNCTION:\w+\s*\(.*?\)\]/g,
      /```function\s*\n?\w+\(.*?\)\s*```/g,
      /\{\s*"function":\s*"\w+",\s*"arguments":\s*\{.*?\}\s*\}/g,
    ]) {
      cleanText = cleanText.replace(pattern, '');
    }

    return {
      text: cleanText.trim(),
      results,
    };
  }

  public getFunctionSchemaForLLM(): object {
    const tools = Object.entries(availableFunctions).map(([name, def]) => ({
      type: 'function',
      function: {
        name,
        description: def.description,
        parameters: {
          type: 'object',
          properties: def.parameters,
        },
      },
    }));

    return { tools };
  }

  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }
}

export const functionCallingEnhanced = new FunctionCallingEnhancedClass();
