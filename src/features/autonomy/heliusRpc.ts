import { config } from '@/utils/config';
import { contextManager } from './contextManager';

export interface HeliusConfig {
  apiKey: string;
  cluster?: 'mainnet-beta' | 'devnet';
}

export interface TransactionInfo {
  signature: string;
  type: string;
  description: string;
  source: string;
  fee: number;
  timestamp: number;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    mint: string;
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    tokenStandard: string;
  }>;
}

export interface AssetInfo {
  id: string;
  interface: string;
  content: {
    metadata: {
      name: string;
      symbol: string;
      description?: string;
    };
    links?: {
      image?: string;
      external_url?: string;
    };
  };
  ownership: {
    owner: string;
    frozen: boolean;
  };
  royalty?: {
    royalty_model: string;
    percent: number;
  };
}

export interface WebhookConfig {
  webhookURL: string;
  transactionTypes: string[];
  accountAddresses: string[];
  webhookType: 'raw' | 'rawDevnet' | 'enhanced' | 'enhancedDevnet';
}

const HELIUS_RPC_URL = 'https://mainnet.helius-rpc.com';
const HELIUS_API_URL = 'https://api.helius.xyz/v0';

class HeliusRpcClass {
  private apiKey: string | null = null;
  private cluster: 'mainnet-beta' | 'devnet' = 'mainnet-beta';
  private webhooks: Map<string, WebhookConfig> = new Map();

  public initialize(apiKey?: string): void {
    this.apiKey = apiKey || config('helius_api_key') || null;
    
    if (!this.apiKey) {
      console.warn('HeliusRPC: No API key configured. Some features will be unavailable.');
    } else {
      console.log('HeliusRPC initialized');
    }
  }

  private checkApiKey(): boolean {
    if (!this.apiKey) {
      console.warn('HeliusRPC: API key not configured');
      return false;
    }
    return true;
  }

  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  public setCluster(cluster: 'mainnet-beta' | 'devnet'): void {
    this.cluster = cluster;
  }

  private getRpcUrl(): string {
    if (!this.apiKey) {
      throw new Error('Helius API key not configured');
    }
    return `${HELIUS_RPC_URL}/?api-key=${this.apiKey}`;
  }

  private getApiUrl(endpoint: string): string {
    if (!this.apiKey) {
      throw new Error('Helius API key not configured');
    }
    return `${HELIUS_API_URL}/${endpoint}?api-key=${this.apiKey}`;
  }

  public async rpcCall(method: string, params: any[]): Promise<any> {
    if (!this.checkApiKey()) {
      throw new Error('Helius API key not configured');
    }

    try {
      const response = await fetch(this.getRpcUrl(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method,
          params,
        }),
      });

      if (!response.ok) {
        throw new Error(`Helius RPC error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`RPC error: ${data.error.message}`);
      }

      return data.result;
    } catch (e: any) {
      console.error('Helius RPC call failed:', e);
      throw e;
    }
  }

  public async getBalance(address: string): Promise<number> {
    const result = await this.rpcCall('getBalance', [address]);
    return result.value / 1e9;
  }

  public async getTransactionHistory(
    address: string,
    options?: { limit?: number; before?: string }
  ): Promise<TransactionInfo[]> {
    if (!this.checkApiKey()) {
      return [];
    }

    try {
      const url = this.getApiUrl(`addresses/${address}/transactions`);
      const params = new URLSearchParams();
      
      if (options?.limit) {
        params.append('limit', options.limit.toString());
      }
      if (options?.before) {
        params.append('before', options.before);
      }

      const response = await fetch(`${url}&${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get transaction history: ${response.status}`);
      }

      return await response.json();
    } catch (e) {
      console.error('Failed to get transaction history:', e);
      return [];
    }
  }

  public async getParsedTransaction(signature: string): Promise<TransactionInfo | null> {
    if (!this.checkApiKey()) {
      return null;
    }

    try {
      const url = this.getApiUrl(`transactions`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactions: [signature],
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to parse transaction: ${response.status}`);
      }

      const data = await response.json();
      return data[0] || null;
    } catch (e) {
      console.error('Failed to parse transaction:', e);
      return null;
    }
  }

  public async getAssetsByOwner(
    ownerAddress: string,
    options?: { page?: number; limit?: number }
  ): Promise<AssetInfo[]> {
    try {
      const result = await this.rpcCall('getAssetsByOwner', [
        {
          ownerAddress,
          page: options?.page || 1,
          limit: options?.limit || 100,
          displayOptions: {
            showCollectionMetadata: true,
          },
        },
      ]);

      return result.items || [];
    } catch (e) {
      console.error('Failed to get assets by owner:', e);
      return [];
    }
  }

  public async getAsset(assetId: string): Promise<AssetInfo | null> {
    try {
      const result = await this.rpcCall('getAsset', [{ id: assetId }]);
      return result;
    } catch (e) {
      console.error('Failed to get asset:', e);
      return null;
    }
  }

  public async searchAssets(
    query: string,
    options?: { page?: number; limit?: number }
  ): Promise<AssetInfo[]> {
    try {
      const result = await this.rpcCall('searchAssets', [
        {
          nativeBalance: {
            min: 0,
          },
          tokenType: 'all',
          page: options?.page || 1,
          limit: options?.limit || 50,
        },
      ]);

      return result.items || [];
    } catch (e) {
      console.error('Failed to search assets:', e);
      return [];
    }
  }

  public async getTokenAccounts(
    ownerAddress: string,
    options?: { page?: number; limit?: number }
  ): Promise<any[]> {
    try {
      const result = await this.rpcCall('getTokenAccounts', [
        {
          owner: ownerAddress,
          page: options?.page || 1,
          limit: options?.limit || 100,
        },
      ]);

      return result.token_accounts || [];
    } catch (e) {
      console.error('Failed to get token accounts:', e);
      return [];
    }
  }

  public async getPriorityFeeEstimate(
    accountKeys: string[],
    options?: { priorityLevel?: 'Min' | 'Low' | 'Medium' | 'High' | 'VeryHigh' | 'UnsafeMax' }
  ): Promise<number> {
    try {
      const result = await this.rpcCall('getPriorityFeeEstimate', [
        {
          accountKeys,
          options: {
            priorityLevel: options?.priorityLevel || 'Medium',
          },
        },
      ]);

      return result.priorityFeeEstimate || 0;
    } catch (e) {
      console.error('Failed to get priority fee estimate:', e);
      return 5000;
    }
  }

  public async createWebhook(webhookConfig: WebhookConfig): Promise<string | null> {
    if (!this.checkApiKey()) {
      return null;
    }

    try {
      const url = this.getApiUrl('webhooks');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookConfig),
      });

      if (!response.ok) {
        throw new Error(`Failed to create webhook: ${response.status}`);
      }

      const data = await response.json();
      const webhookId = data.webhookID;
      
      this.webhooks.set(webhookId, webhookConfig);
      
      return webhookId;
    } catch (e) {
      console.error('Failed to create webhook:', e);
      return null;
    }
  }

  public async deleteWebhook(webhookId: string): Promise<boolean> {
    if (!this.checkApiKey()) {
      return false;
    }

    try {
      const url = this.getApiUrl(`webhooks/${webhookId}`);
      const response = await fetch(url, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`Failed to delete webhook: ${response.status}`);
      }

      this.webhooks.delete(webhookId);
      return true;
    } catch (e) {
      console.error('Failed to delete webhook:', e);
      return false;
    }
  }

  public async monitorWallet(
    address: string,
    onTransaction: (tx: TransactionInfo) => void
  ): Promise<void> {
    let lastSignature: string | undefined;

    const checkTransactions = async () => {
      const txs = await this.getTransactionHistory(address, { 
        limit: 5,
        before: lastSignature,
      });

      if (txs.length > 0) {
        for (const tx of txs.reverse()) {
          if (!lastSignature || tx.signature !== lastSignature) {
            onTransaction(tx);
            contextManager.addMemory(
              'market',
              `Transaction detected: ${tx.type} - ${tx.description}`,
              0.7,
              { signature: tx.signature }
            );
          }
        }
        lastSignature = txs[0].signature;
      }
    };

    setInterval(checkTransactions, 30000);
    checkTransactions();
  }

  public isConfigured(): boolean {
    return this.apiKey !== null;
  }
}

export const heliusRpc = new HeliusRpcClass();
