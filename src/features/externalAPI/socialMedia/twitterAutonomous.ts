import { twitterClientInstance } from './twitterClient';
import { askLLM } from '@/utils/askLlm';
import { Chat } from '@/features/chat/chat';

export interface TweetRule {
  id: string;
  name: string;
  trigger: 'market_change' | 'time_interval' | 'manual' | 'engagement' | 'news';
  condition?: {
    threshold?: number;
    interval_minutes?: number;
    keywords?: string[];
  };
  enabled: boolean;
}

export interface TweetLimits {
  max_tweets_per_hour: number;
  max_tweets_per_day: number;
  min_interval_seconds: number;
  require_approval_for_sensitive: boolean;
}

const DEFAULT_LIMITS: TweetLimits = {
  max_tweets_per_hour: 3,
  max_tweets_per_day: 20,
  min_interval_seconds: 300,
  require_approval_for_sensitive: true,
};

const DEFAULT_RULES: TweetRule[] = [
  {
    id: 'market_pump',
    name: 'Market Pump Alert',
    trigger: 'market_change',
    condition: { threshold: 10 },
    enabled: true,
  },
  {
    id: 'market_dump',
    name: 'Market Dump Alert',
    trigger: 'market_change',
    condition: { threshold: -10 },
    enabled: true,
  },
  {
    id: 'scheduled_engagement',
    name: 'Scheduled Engagement',
    trigger: 'time_interval',
    condition: { interval_minutes: 120 },
    enabled: false,
  },
  {
    id: 'trending_topics',
    name: 'Trending Topics Response',
    trigger: 'engagement',
    condition: { keywords: ['solana', 'crypto', 'web3'] },
    enabled: true,
  },
];

class TwitterAutonomous {
  private limits: TweetLimits;
  private rules: TweetRule[];
  private tweetHistory: { timestamp: number; content: string }[] = [];
  private lastTweetTime: number = 0;

  constructor() {
    this.limits = { ...DEFAULT_LIMITS };
    this.rules = [...DEFAULT_RULES];
  }

  public getLimits(): TweetLimits {
    return this.limits;
  }

  public setLimits(newLimits: Partial<TweetLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
  }

  public getRules(): TweetRule[] {
    return this.rules;
  }

  public addRule(rule: TweetRule): void {
    this.rules.push(rule);
  }

  public updateRule(ruleId: string, updates: Partial<TweetRule>): void {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.rules[index] = { ...this.rules[index], ...updates };
    }
  }

  public removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  private canTweet(): { allowed: boolean; reason?: string } {
    const now = Date.now();
    
    const timeSinceLastTweet = (now - this.lastTweetTime) / 1000;
    if (timeSinceLastTweet < this.limits.min_interval_seconds) {
      return {
        allowed: false,
        reason: `Must wait ${Math.ceil(this.limits.min_interval_seconds - timeSinceLastTweet)} more seconds`,
      };
    }

    const oneHourAgo = now - 3600000;
    const tweetsLastHour = this.tweetHistory.filter(t => t.timestamp > oneHourAgo).length;
    if (tweetsLastHour >= this.limits.max_tweets_per_hour) {
      return {
        allowed: false,
        reason: `Hourly limit reached (${this.limits.max_tweets_per_hour} tweets/hour)`,
      };
    }

    const oneDayAgo = now - 86400000;
    const tweetsLastDay = this.tweetHistory.filter(t => t.timestamp > oneDayAgo).length;
    if (tweetsLastDay >= this.limits.max_tweets_per_day) {
      return {
        allowed: false,
        reason: `Daily limit reached (${this.limits.max_tweets_per_day} tweets/day)`,
      };
    }

    return { allowed: true };
  }

  public async generateTweetContent(
    context: string,
    style: 'informative' | 'witty' | 'viral' | 'casual' = 'viral',
    chat?: Chat
  ): Promise<string> {
    const stylePrompts = {
      informative: 'Write an informative and clear tweet about this topic. Be concise and factual.',
      witty: 'Write a clever and witty tweet about this topic. Use wordplay if appropriate.',
      viral: 'Write a tweet designed to go viral. Use engaging hooks, be relatable, and encourage engagement. Make it shareable.',
      casual: 'Write a casual, conversational tweet about this topic. Be authentic and personable.',
    };

    const prompt = `${stylePrompts[style]}

Context: ${context}

Requirements:
- Maximum 280 characters
- Include relevant hashtags (1-2 max)
- No emojis
- Make it engaging and memorable
- Write ONLY the tweet text, nothing else`;

    const tweet = await askLLM(prompt, context, chat ?? null);
    
    if (tweet.length > 280) {
      return tweet.substring(0, 277) + '...';
    }
    
    return tweet;
  }

  public async postAutonomousTweet(
    context: string,
    style: 'informative' | 'witty' | 'viral' | 'casual' = 'viral',
    chat?: Chat
  ): Promise<{ success: boolean; message: string; tweet?: string }> {
    if (!twitterClientInstance.isConfigured()) {
      return {
        success: false,
        message: 'Twitter client not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET environment variables.',
      };
    }

    const canTweetResult = this.canTweet();
    if (!canTweetResult.allowed) {
      return {
        success: false,
        message: canTweetResult.reason || 'Cannot tweet at this time',
      };
    }

    try {
      const tweetContent = await this.generateTweetContent(context, style, chat);
      
      const result = await twitterClientInstance.postTweet(tweetContent);
      
      if (result) {
        const now = Date.now();
        this.tweetHistory.push({ timestamp: now, content: tweetContent });
        this.lastTweetTime = now;
        
        const oneDayAgo = now - 86400000;
        this.tweetHistory = this.tweetHistory.filter(t => t.timestamp > oneDayAgo);
        
        return {
          success: true,
          message: 'Tweet posted successfully',
          tweet: tweetContent,
        };
      } else {
        return {
          success: false,
          message: 'Failed to post tweet',
        };
      }
    } catch (error) {
      console.error('Error posting autonomous tweet:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  public async handleMarketTrigger(
    tokenSymbol: string,
    priceChange: number,
    chat?: Chat
  ): Promise<{ success: boolean; message: string; tweet?: string }> {
    const pumpRule = this.rules.find(r => r.id === 'market_pump' && r.enabled);
    const dumpRule = this.rules.find(r => r.id === 'market_dump' && r.enabled);

    let shouldTweet = false;
    let context = '';

    if (pumpRule && priceChange >= (pumpRule.condition?.threshold || 10)) {
      shouldTweet = true;
      context = `${tokenSymbol} just pumped ${priceChange.toFixed(1)}%! This is exciting market movement.`;
    } else if (dumpRule && priceChange <= (dumpRule.condition?.threshold || -10)) {
      shouldTweet = true;
      context = `${tokenSymbol} dropped ${Math.abs(priceChange).toFixed(1)}%. Market update.`;
    }

    if (shouldTweet) {
      return this.postAutonomousTweet(context, 'viral', chat);
    }

    return {
      success: false,
      message: 'No market trigger conditions met',
    };
  }

  public async handleManualRequest(
    topic: string,
    style: 'informative' | 'witty' | 'viral' | 'casual' = 'viral',
    chat?: Chat
  ): Promise<{ success: boolean; message: string; tweet?: string }> {
    return this.postAutonomousTweet(topic, style, chat);
  }

  public getStats(): {
    tweets_last_hour: number;
    tweets_last_day: number;
    seconds_until_next_allowed: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    const timeSinceLastTweet = (now - this.lastTweetTime) / 1000;
    const secondsUntilNext = Math.max(0, this.limits.min_interval_seconds - timeSinceLastTweet);

    return {
      tweets_last_hour: this.tweetHistory.filter(t => t.timestamp > oneHourAgo).length,
      tweets_last_day: this.tweetHistory.filter(t => t.timestamp > oneDayAgo).length,
      seconds_until_next_allowed: Math.ceil(secondsUntilNext),
    };
  }

  public async postTweet(content: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    const canTweetResult = this.canTweet();
    if (!canTweetResult.allowed) {
      return {
        success: false,
        error: canTweetResult.reason,
      };
    }

    try {
      const result = await twitterClientInstance.postTweet(content);
      
      if (result) {
        const now = Date.now();
        this.tweetHistory.push({ timestamp: now, content });
        this.lastTweetTime = now;
        
        return {
          success: true,
          tweetId: result.data?.id || 'unknown',
        };
      }
      
      return {
        success: false,
        error: 'Failed to post tweet',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async triggerAutonomousTweet(
    source: string,
    params: Record<string, any>
  ): Promise<{ success: boolean; message: string; tweet?: string }> {
    const { style = 'viral', topic, marketData } = params;

    let context = topic || '';
    
    if (marketData) {
      const { priceChange, symbol = 'SOL' } = marketData;
      if (priceChange > 0) {
        context = `${symbol} just pumped ${priceChange.toFixed(1)}%! ${topic || 'Market update.'}`;
      } else {
        context = `${symbol} dropped ${Math.abs(priceChange).toFixed(1)}%. ${topic || 'Market update.'}`;
      }
    }

    if (!context) {
      context = 'Share a thought about crypto and the Solana ecosystem';
    }

    return this.postAutonomousTweet(context, style);
  }
}

export const twitterAutonomous = new TwitterAutonomous();
export const autonomousTweeter = twitterAutonomous;
