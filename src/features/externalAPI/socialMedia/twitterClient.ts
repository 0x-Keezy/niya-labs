import { TwitterApi, TwitterApiReadWrite, TwitterApiReadOnly, TweetV2PostTweetResult } from 'twitter-api-v2';

class TwitterClient {
  private twitterClient: TwitterApiReadWrite | null = null;
  private twitterBearer: TwitterApiReadOnly | null = null;
  private initialized: boolean = false;
  private initAttempted: boolean = false;
  private initError: string | null = null;

  private lazyInitialize(): void {
    if (this.initAttempted) return;
    this.initAttempted = true;

    if (typeof window === 'undefined') {
      return;
    }

    try {
      const appKey = process.env.TWITTER_API_KEY;
      const appSecret = process.env.TWITTER_API_SECRET;
      const accessToken = process.env.TWITTER_ACCESS_TOKEN;
      const accessSecret = process.env.TWITTER_ACCESS_SECRET;
      const bearerToken = process.env.TWITTER_BEARER_TOKEN;

      if (!appKey || !appSecret || !accessToken || !accessSecret) {
        this.initError = 'Twitter API credentials not configured. Set TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET environment variables.';
        return;
      }

      const client = new TwitterApi({
        appKey,
        appSecret,
        accessToken,
        accessSecret,
      });

      this.twitterClient = client.readWrite;

      if (bearerToken) {
        const bearer = new TwitterApi(bearerToken);
        this.twitterBearer = bearer.readOnly;
      }

      this.initialized = true;
      console.log('TwitterClient initialized successfully');
    } catch (error) {
      this.initError = `Failed to initialize Twitter client: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error('TwitterClient initialization error:', error);
    }
  }

  public isConfigured(): boolean {
    this.lazyInitialize();
    return this.initialized && this.twitterClient !== null;
  }

  public getInitError(): string | null {
    this.lazyInitialize();
    return this.initError;
  }

  public getReadWriteClient(): TwitterApiReadWrite | null {
    this.lazyInitialize();
    return this.twitterClient;
  }

  public getReadOnlyClient(): TwitterApiReadOnly | null {
    this.lazyInitialize();
    return this.twitterBearer;
  }

  public async postTweet(content: string): Promise<TweetV2PostTweetResult | undefined> {
    this.lazyInitialize();
    
    if (!this.twitterClient) {
      if (!this.initError) {
        console.warn('TwitterClient: Cannot post tweet - client not initialized');
      }
      return undefined;
    }

    try {
      const response = await this.twitterClient.v2.tweet(content);
      return response;
    } catch (error) {
      console.error('Error posting tweet:', error);
      return undefined;
    }
  }
}

export const twitterClientInstance = new TwitterClient();

export function getTwitterClient(): TwitterClient {
  return twitterClientInstance;
}
