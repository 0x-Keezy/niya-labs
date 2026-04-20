import { io, Socket } from 'socket.io-client';
import { config } from '@/utils/config';
import { contextManager } from './contextManager';
import { jupiterApi } from './jupiterApi';
import { heliusRpc } from './heliusRpc';

export interface ElizaMessage {
  type: 'chat' | 'action' | 'market' | 'social' | 'system' | 'log' | 'trading';
  content: string;
  data?: Record<string, any>;
  timestamp: number;
}

export interface ElizaAction {
  name: string;
  parameters: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'critical';
  source: 'market' | 'social' | 'schedule' | 'user';
}

export interface ElizaAgentState {
  isConnected: boolean;
  agentId?: string;
  personality?: string;
  capabilities: string[];
  lastHeartbeat?: number;
  serverUrl?: string;
  connectionError?: string;
}

export interface MarketTrigger {
  type: 'price_change' | 'volume_spike' | 'whale_alert' | 'trend';
  symbol: string;
  threshold: number;
  direction?: 'up' | 'down' | 'any';
  action: ElizaAction;
}

export interface ElizaConnectionConfig {
  url?: string;
  autoConnect?: boolean;
  enableMarketSync?: boolean;
  marketSyncIntervalMs?: number;
  agentId?: string;
}

export interface ElizaLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: Record<string, unknown>;
}

export interface ElizaTradingMetrics {
  walletAddress?: string;
  solBalance?: number;
  bnbBalance?: number;
  tokenBalances?: Record<string, number>;
  lastSwap?: {
    inputToken: string;
    outputToken: string;
    amount: number;
    outputAmount?: number;
    txSignature?: string;
    timestamp: number;
    status: 'pending' | 'success' | 'failed';
  };
  totalSwaps24h?: number;
  pnl24h?: number;
}

const DEFAULT_ELIZAOS_URL = '';
const DEFAULT_AGENT_ID = '';

function normalizeHttpUrl(url: string): string {
  if (!url) return DEFAULT_ELIZAOS_URL;
  
  let normalized = url.trim();
  
  if (normalized.startsWith('wss://')) {
    normalized = normalized.replace('wss://', 'https://');
  } else if (normalized.startsWith('ws://')) {
    normalized = normalized.replace('ws://', 'http://');
  }
  
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    const isLocalhost = normalized.includes('localhost') || normalized.includes('127.0.0.1');
    normalized = isLocalhost ? `http://${normalized}` : `https://${normalized}`;
  }
  
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}

class ElizaOSBridgeClass {
  private socket: Socket | null = null;
  private state: ElizaAgentState = {
    isConnected: false,
    capabilities: [],
  };
  private messageHandlers: Map<string, (msg: ElizaMessage) => void> = new Map();
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private marketTriggers: MarketTrigger[] = [];
  private actionQueue: ElizaAction[] = [];
  private isProcessingActions: boolean = false;
  private marketSyncInterval: NodeJS.Timeout | null = null;
  private connectionConfig: ElizaConnectionConfig = {};
  private outboundBuffer: ElizaMessage[] = [];
  private logs: ElizaLogEntry[] = [];
  private maxLogs: number = 200;
  private tradingMetrics: ElizaTradingMetrics = {};
  private logListeners: Set<(log: ElizaLogEntry) => void> = new Set();
  private metricsListeners: Set<(metrics: ElizaTradingMetrics) => void> = new Set();
  private stateListeners: Set<(state: ElizaAgentState) => void> = new Set();
  private useHttpMode: boolean = false;
  private httpPollInterval: NodeJS.Timeout | null = null;

  private addLog(level: ElizaLogEntry['level'], message: string, data?: Record<string, unknown>): void {
    const logEntry: ElizaLogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data,
    };
    
    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    
    this.logListeners.forEach(listener => listener(logEntry));
    
    const logMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    logMethod(`ElizaOS Bridge [${level.toUpperCase()}]: ${message}`, data || '');
  }

  private notifyStateChange(): void {
    this.stateListeners.forEach(listener => listener({ ...this.state }));
  }

  public initialize(configOrUrl?: string | ElizaConnectionConfig): void {
    if (typeof configOrUrl === 'string') {
      this.connectionConfig = { url: configOrUrl };
    } else if (configOrUrl) {
      this.connectionConfig = configOrUrl;
    }
    
    const rawUrl = this.connectionConfig.url || 
      (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_ELIZAOS_URL : '') || 
      config('elizaos_url') || 
      DEFAULT_ELIZAOS_URL;
    const elizaUrl = normalizeHttpUrl(rawUrl);
    this.state.serverUrl = elizaUrl;
    
    // Get Agent ID from config, connectionConfig, or default
    const configAgentId = config('elizaos_agent_id');
    this.state.agentId = this.connectionConfig.agentId || 
      (configAgentId && configAgentId.trim() !== '' ? configAgentId : '') ||
      DEFAULT_AGENT_ID;
    
    this.addLog('info', 'Initializing ElizaOS Bridge...');
    this.addLog('info', `Server URL configured: ${elizaUrl}`);
    this.addLog('info', `Agent ID: ${this.state.agentId}`);
    
    this.setupDefaultTriggers();
    this.startActionProcessor();
    
    if (this.connectionConfig.autoConnect) {
      this.addLog('info', 'Auto-connect enabled, connecting...');
      this.connect();
    } else {
      this.addLog('info', 'Initialized (standalone mode - connection pending)');
    }
    
    if (this.connectionConfig.enableMarketSync) {
      this.startMarketSync(this.connectionConfig.marketSyncIntervalMs || 60000);
    }
  }

  public async connect(url?: string): Promise<void> {
    if (typeof window === 'undefined') {
      this.addLog('warn', 'Not available in server environment');
      return;
    }

    const rawUrl = url || this.connectionConfig.url || 
      process.env.NEXT_PUBLIC_ELIZAOS_URL || 
      config('elizaos_url') || 
      DEFAULT_ELIZAOS_URL;
    const elizaUrl = normalizeHttpUrl(rawUrl);
    this.state.serverUrl = elizaUrl;
    this.state.connectionError = undefined;

    if (this.state.isConnected) {
      this.addLog('info', 'Already connected');
      return;
    }

    this.addLog('info', `Connecting to ${elizaUrl}...`);
    this.notifyStateChange();

    // First try HTTP connection (more reliable for Railway deployments)
    const httpTest = await this.testConnection(elizaUrl);
    if (httpTest.success) {
      // ElizaOS server is reachable - enable HTTP mode
      this.addLog('info', `HTTP mode enabled: ElizaOS server reachable (${httpTest.latencyMs}ms)`);
      this.useHttpMode = true;
      this.state.isConnected = true;
      this.state.connectionError = undefined;
      this.state.lastHeartbeat = Date.now();
      this.state.capabilities = ['chat', 'market', 'trading'];
      this.notifyStateChange();
      this.flushOutboundBuffer();
      
      // Start HTTP polling for updates
      this.startHttpPolling();
      
      // Also initialize Socket.IO as fallback for messaging (since REST endpoints may not exist)
      this.addLog('info', 'Initializing Socket.IO as messaging fallback...');
    } else {
      // Fall back to Socket.IO if HTTP fails completely
      this.addLog('info', 'HTTP connection test failed, trying Socket.IO only...');
      this.useHttpMode = false;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    // Generate persistent entityId for this session (ElizaOS v2 requires entityId in auth)
    const entityId = this.generateUUID();
    const agentId = this.state.agentId || config('elizaos_agent_id') || DEFAULT_AGENT_ID;
    
    this.addLog('info', `Connecting with entityId: ${entityId}, agentId: ${agentId}`);

    try {
      this.socket = io(elizaUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 5000,
        reconnectionDelayMax: 60000,
        autoConnect: true,
        auth: {
          entityId: entityId,
          agentId: agentId,
          userId: entityId,
          client: 'niya-vtuber',
          version: '1.0.0',
        },
      });

      this.socket.on('connect', () => {
        this.addLog('info', 'Socket.IO connected successfully');
        this.state.isConnected = true;
        this.state.connectionError = undefined;
        this.reconnectAttempts = 0;
        this.state.lastHeartbeat = Date.now();
        this.notifyStateChange();
        
        this.sendHandshake();
        this.flushOutboundBuffer();
      });

      this.socket.on('disconnect', (reason) => {
        this.addLog('warn', `Disconnected: ${reason}`);
        this.state.isConnected = false;
        this.notifyStateChange();
      });

      this.socket.on('connect_error', (error) => {
        let errorMessage = error.message;
        let userHint = '';
        
        if (error.message.includes('entityId') || error.message.includes('agentId')) {
          userHint = ' - Check your Agent ID in the Autonomy Dashboard. Get a valid Agent ID from your ElizaOS server at /api/agents';
        } else if (error.message.includes('CORS') || error.message.includes('blocked')) {
          userHint = ' - CORS issue. Ensure your ElizaOS server allows connections from this domain';
        } else if (!this.state.agentId) {
          userHint = ' - No Agent ID configured. Enter your ElizaOS Agent ID in the dashboard';
        }
        
        this.addLog('error', `Connection error: ${errorMessage}${userHint}`);
        this.state.connectionError = `${errorMessage}${userHint}`;
        this.state.isConnected = false;
        this.notifyStateChange();
      });

      this.socket.on('error', (error) => {
        this.addLog('error', `Socket error: ${error}`);
        this.state.connectionError = String(error);
        this.notifyStateChange();
      });

      this.socket.on('message', (data: any) => {
        this.handleIncomingMessage(data);
      });

      this.socket.on('messageSent', (data: any) => {
        this.addLog('debug', 'Message sent confirmation', data);
      });

      this.socket.on('messageReceived', (data: any) => {
        this.handleAgentResponse(data);
      });

      this.socket.on('log', (data: any) => {
        this.handleLogMessage({
          type: 'log',
          content: data.message || String(data),
          data: data,
          timestamp: Date.now(),
        });
      });

      this.socket.on('trading', (data: any) => {
        this.handleTradingMessage({
          type: 'trading',
          content: 'trading_update',
          data: data,
          timestamp: Date.now(),
        });
      });

      this.socket.on('pong', () => {
        this.state.lastHeartbeat = Date.now();
        this.notifyStateChange();
      });

    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      this.addLog('error', `Failed to connect: ${errorMsg}`);
      this.state.connectionError = errorMsg;
      this.notifyStateChange();
    }
  }

  private handleIncomingMessage(data: any): void {
    try {
      const message: ElizaMessage = {
        type: data.type || 'chat',
        content: data.content || data.text || String(data),
        data: data,
        timestamp: data.timestamp || Date.now(),
      };
      this.handleMessage(message);
    } catch (e) {
      this.addLog('error', 'Failed to parse incoming message', { error: String(e), data });
    }
  }

  private handleAgentResponse(data: any): void {
    this.addLog('info', 'Agent response received', data);
    
    const message: ElizaMessage = {
      type: 'chat',
      content: data.text || data.content || '',
      data: data,
      timestamp: Date.now(),
    };
    
    this.handleMessage(message);
  }
  
  private startMarketSync(intervalMs: number): void {
    if (this.marketSyncInterval) {
      clearInterval(this.marketSyncInterval);
    }
    
    this.marketSyncInterval = setInterval(() => {
      if (this.state.isConnected) {
        this.syncMarketData();
      }
    }, intervalMs);
    
    this.addLog('info', `Market sync started (every ${intervalMs / 1000}s)`);
  }
  
  private stopMarketSync(): void {
    if (this.marketSyncInterval) {
      clearInterval(this.marketSyncInterval);
      this.marketSyncInterval = null;
    }
  }
  
  private startHttpPolling(): void {
    // Clean up existing interval
    if (this.httpPollInterval) {
      clearInterval(this.httpPollInterval);
    }
    
    // Poll for heartbeat/status every 30 seconds
    this.httpPollInterval = setInterval(() => {
      if (this.useHttpMode && this.state.isConnected) {
        this.state.lastHeartbeat = Date.now();
        this.notifyStateChange();
      }
    }, 30000);
    
    this.addLog('debug', 'HTTP polling started');
  }
  
  private stopHttpPolling(): void {
    if (this.httpPollInterval) {
      clearInterval(this.httpPollInterval);
      this.httpPollInterval = null;
    }
  }
  
  private flushOutboundBuffer(): void {
    if (this.outboundBuffer.length === 0) return;
    
    this.addLog('info', `Flushing ${this.outboundBuffer.length} queued messages`);
    
    const messages = [...this.outboundBuffer];
    this.outboundBuffer = [];
    
    for (const message of messages) {
      this.sendImmediate(message);
    }
  }
  
  private sendImmediate(message: ElizaMessage): boolean {
    if (!this.socket?.connected) {
      return false;
    }

    try {
      this.socket.emit('message', {
        agentId: this.state.agentId,
        ...message,
      });
      return true;
    } catch (e) {
      this.addLog('error', 'Failed to send message', { error: String(e) });
      return false;
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private sendHandshake(): void {
    const context = contextManager.getFullContext();
    const agentId = this.connectionConfig.agentId || this.state.agentId || DEFAULT_AGENT_ID;
    
    // Generate a proper UUID for entityId (ElizaOS v2 requires valid UUIDs)
    const clientEntityId = this.generateUUID();
    const roomId = this.generateUUID();
    
    // ElizaOS v2 expects specific format for Socket.IO registration
    this.socket?.emit('register', {
      agentId: agentId,
      entityId: clientEntityId,
      userId: clientEntityId,
      roomId: roomId,
      client: 'niya',
      version: '1.0.0',
      source: 'niya-vtuber',
      capabilities: [
        'chat',
        'voice',
        'avatar',
        'emotions',
        'twitter',
        'vision',
        'trading',
      ],
      context: {
        personality: context.personality,
        emotionalState: context.emotionalState.current,
      },
    });

    this.addLog('info', `Handshake sent - agent: ${agentId}, entity: ${clientEntityId}`);
  }

  public send(message: ElizaMessage, options?: { buffer?: boolean }): boolean {
    const shouldBuffer = options?.buffer !== false;
    
    if (!this.socket?.connected) {
      if (shouldBuffer && message.type !== 'system') {
        this.addLog('debug', 'Not connected, buffering message');
        this.outboundBuffer.push(message);
        return true;
      }
      this.addLog('warn', 'Not connected, message dropped');
      return false;
    }

    return this.sendImmediate(message);
  }

  public async sendChatToAgent(text: string, roomId?: string): Promise<void> {
    if (!this.state.isConnected) {
      this.addLog('warn', 'Cannot send chat: not connected');
      return;
    }

    const agentId = this.state.agentId || DEFAULT_AGENT_ID;
    
    // ElizaOS v1.0.16+ message format
    const entityId = this.generateUUID();
    const elizaMessagePayload = {
      channel_id: roomId || 'niya-chat',
      server_id: 'niya-companion',
      author_id: entityId,
      content: text,
      source_type: 'rest',
      raw_message: {
        text: text,
        userName: 'Niya AI',
        agentId: agentId,
      },
    };
    
    // Legacy format for older ElizaOS versions
    const legacyMessagePayload = {
      text: text,
      userId: entityId,
      userName: 'Niya',
      roomId: roomId || this.generateUUID(),
      agentId: agentId,
      entityId: entityId,
    };

    // Use HTTP mode with server-side proxy to avoid CORS
    let httpSuccess = false;
    if (this.useHttpMode) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        
        const response = await fetch('/api/elizaos-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'message',
            ...legacyMessagePayload,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            this.addLog('info', `Chat response via proxy (${result.endpoint})`);
            this.handleAgentResponse(result.data);
            httpSuccess = true;
          } else {
            this.addLog('warn', 'Proxy returned success but no data - trying Socket.IO fallback');
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          this.addLog('warn', `Proxy chat failed: ${errorData.error || response.status} - trying Socket.IO fallback`);
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        this.addLog('warn', `HTTP chat error: ${errorMsg} - trying Socket.IO fallback`);
      }
    }

    // Use Socket.IO as primary or fallback
    if (!httpSuccess && this.socket?.connected) {
      this.socket.emit('message', legacyMessagePayload);
      this.addLog('info', `Chat sent via Socket.IO: ${text.substring(0, 50)}...`);
    } else if (!httpSuccess && !this.socket?.connected) {
      this.addLog('warn', 'No available transport for chat (HTTP failed, Socket not connected)');
      this.state.connectionError = 'No transport available for messaging';
      this.notifyStateChange();
    }
  }

  private handleMessage(message: ElizaMessage): void {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message);
    }

    switch (message.type) {
      case 'action':
        this.handleAction(message);
        break;
      case 'market':
        this.handleMarketUpdate(message);
        break;
      case 'chat':
        this.handleChatMessage(message);
        break;
      case 'system':
        this.handleSystemMessage(message);
        break;
      case 'log':
        this.handleLogMessage(message);
        break;
      case 'trading':
        this.handleTradingMessage(message);
        break;
    }
  }
  
  private handleLogMessage(message: ElizaMessage): void {
    const logEntry: ElizaLogEntry = {
      timestamp: message.timestamp,
      level: message.data?.level || 'info',
      message: message.content,
      data: message.data,
    };
    
    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    
    this.logListeners.forEach(listener => listener(logEntry));
  }
  
  // Expected Niya wallet address for validation
  private static readonly EXPECTED_WALLET = 'BCKHxpFWKgourqf2BHyApftDR8udHMFJcEK8yzTemC7C';

  private handleTradingMessage(message: ElizaMessage): void {
    if (!message.data) return;
    
    const data = message.data;
    
    if (data.walletAddress !== undefined) {
      this.tradingMetrics.walletAddress = data.walletAddress;
      // Verify wallet matches expected Niya wallet
      if (data.walletAddress !== ElizaOSBridgeClass.EXPECTED_WALLET) {
        this.addLog('error', `Wallet mismatch! ElizaOS wallet (${data.walletAddress}) does not match expected Niya wallet (${ElizaOSBridgeClass.EXPECTED_WALLET})`);
      } else {
        this.addLog('info', `Wallet verified: ${data.walletAddress}`);
      }
    }
    if (data.solBalance !== undefined) {
      this.tradingMetrics.solBalance = data.solBalance;
    }
    if (data.tokenBalances !== undefined) {
      this.tradingMetrics.tokenBalances = data.tokenBalances;
    }
    if (data.lastSwap !== undefined) {
      this.tradingMetrics.lastSwap = data.lastSwap;
    }
    if (data.totalSwaps24h !== undefined) {
      this.tradingMetrics.totalSwaps24h = data.totalSwaps24h;
    }
    if (data.pnl24h !== undefined) {
      this.tradingMetrics.pnl24h = data.pnl24h;
    }
    
    this.metricsListeners.forEach(listener => listener({ ...this.tradingMetrics }));
  }

  private handleAction(message: ElizaMessage): void {
    if (!message.data?.action) return;

    const action: ElizaAction = {
      name: message.data.action,
      parameters: message.data.parameters || {},
      priority: message.data.priority || 'medium',
      source: 'market',
    };

    this.queueAction(action);
  }

  private handleMarketUpdate(message: ElizaMessage): void {
    if (message.data) {
      contextManager.updateMarketContext({
        solanaPrice: message.data.solPrice,
        priceChange24h: message.data.priceChange,
      });

      this.checkMarketTriggers(message.data);
    }
  }

  private handleChatMessage(message: ElizaMessage): void {
    contextManager.addMemory('conversation', message.content, 0.6, {
      source: 'elizaos',
    });
  }

  private handleSystemMessage(message: ElizaMessage): void {
    if (message.content === 'handshake_ack' && message.data) {
      this.state.agentId = message.data.agentId || this.state.agentId;
      this.state.personality = message.data.personality;
      this.state.capabilities = message.data.capabilities || [];
      this.addLog('info', 'Handshake acknowledged', { agentId: this.state.agentId, capabilities: this.state.capabilities });
      this.notifyStateChange();
    }
  }

  public on(type: string, handler: (msg: ElizaMessage) => void): void {
    this.messageHandlers.set(type, handler);
  }

  public off(type: string): void {
    this.messageHandlers.delete(type);
  }

  public onStateChange(listener: (state: ElizaAgentState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public onLog(listener: (log: ElizaLogEntry) => void): () => void {
    this.logListeners.add(listener);
    return () => this.logListeners.delete(listener);
  }

  public onMetrics(listener: (metrics: ElizaTradingMetrics) => void): () => void {
    this.metricsListeners.add(listener);
    return () => this.metricsListeners.delete(listener);
  }

  private setupDefaultTriggers(): void {
    this.addMarketTrigger({
      type: 'price_change',
      symbol: 'SOL',
      threshold: 10,
      direction: 'up',
      action: {
        name: 'post_tweet',
        parameters: {
          style: 'viral',
          topic: 'sol_pump',
        },
        priority: 'high',
        source: 'market',
      },
    });

    this.addMarketTrigger({
      type: 'price_change',
      symbol: 'SOL',
      threshold: 10,
      direction: 'down',
      action: {
        name: 'post_tweet',
        parameters: {
          style: 'witty',
          topic: 'sol_dump',
        },
        priority: 'high',
        source: 'market',
      },
    });
  }

  public addMarketTrigger(trigger: MarketTrigger): void {
    this.marketTriggers.push(trigger);
  }

  public removeMarketTrigger(index: number): void {
    this.marketTriggers.splice(index, 1);
  }

  private checkMarketTriggers(marketData: Record<string, any>): void {
    for (const trigger of this.marketTriggers) {
      let shouldTrigger = false;

      switch (trigger.type) {
        case 'price_change':
          const change = marketData.priceChange || 0;
          if (trigger.direction === 'up' && change >= trigger.threshold) {
            shouldTrigger = true;
          } else if (trigger.direction === 'down' && change <= -trigger.threshold) {
            shouldTrigger = true;
          } else if (trigger.direction === 'any' && Math.abs(change) >= trigger.threshold) {
            shouldTrigger = true;
          }
          break;

        case 'volume_spike':
          if (marketData.volumeChange >= trigger.threshold) {
            shouldTrigger = true;
          }
          break;

        case 'whale_alert':
          if (marketData.whaleTransaction && marketData.amount >= trigger.threshold) {
            shouldTrigger = true;
          }
          break;
      }

      if (shouldTrigger) {
        this.queueAction({
          ...trigger.action,
          parameters: {
            ...trigger.action.parameters,
            marketData,
          },
        });
      }
    }
  }

  public queueAction(action: ElizaAction): void {
    const insertIndex = this.actionQueue.findIndex(
      a => this.getPriorityValue(a.priority) < this.getPriorityValue(action.priority)
    );

    if (insertIndex === -1) {
      this.actionQueue.push(action);
    } else {
      this.actionQueue.splice(insertIndex, 0, action);
    }

    this.addLog('info', `Action queued: ${action.name} (${action.priority})`);
  }

  private getPriorityValue(priority: ElizaAction['priority']): number {
    const values = { low: 1, medium: 2, high: 3, critical: 4 };
    return values[priority];
  }

  private startActionProcessor(): void {
    setInterval(async () => {
      if (this.isProcessingActions || this.actionQueue.length === 0) {
        return;
      }

      this.isProcessingActions = true;

      try {
        const action = this.actionQueue.shift();
        if (action) {
          await this.executeAction(action);
        }
      } finally {
        this.isProcessingActions = false;
      }
    }, 5000);
  }

  private async executeAction(action: ElizaAction): Promise<void> {
    this.addLog('info', `Executing action: ${action.name}`);

    try {
      switch (action.name) {
        case 'post_tweet':
          const { autonomousTweeter } = await import('@/features/externalAPI/socialMedia/twitterAutonomous');
          await autonomousTweeter.triggerAutonomousTweet(
            action.source,
            action.parameters
          );
          break;

        case 'adjust_emotion':
          const { functionCallingEnhanced } = await import('./functionCallingEnhanced');
          await functionCallingEnhanced.executeFunction({
            name: 'adjust_emotion',
            arguments: action.parameters,
          });
          break;

        case 'update_context':
          if (action.parameters.memory) {
            contextManager.addMemory(
              action.parameters.type || 'observation',
              action.parameters.memory,
              action.parameters.importance || 0.5
            );
          }
          break;

        case 'execute_swap':
          // KILL SWITCH — autonomous swaps default to disabled. Set
          // AUTONOMY_TRADING_KILL_SWITCH=off in the environment to enable
          // agent-initiated trades. Documented in SECURITY.md.
          if (process.env.AUTONOMY_TRADING_KILL_SWITCH !== 'off') {
            this.addLog(
              'warn',
              'Autonomous swap blocked by AUTONOMY_TRADING_KILL_SWITCH (default=on). Set env to "off" to allow.',
            );
            break;
          }
          await this.requestSwap({
            inputToken: action.parameters.inputToken || action.parameters.inputMint || 'SOL',
            outputToken: action.parameters.outputToken || action.parameters.outputMint || '',
            amount: action.parameters.amount || 0,
            slippage: action.parameters.slippage,
          });
          break;

        default:
          this.addLog('warn', `Unknown action: ${action.name}`);
      }

      contextManager.addMemory(
        'action',
        `Executed: ${action.name}`,
        0.5,
        { action }
      );
    } catch (e) {
      this.addLog('error', `Action failed: ${action.name}`, { error: String(e) });
    }
  }

  public async syncMarketData(): Promise<void> {
    try {
      const solPrice = await jupiterApi.getSolanaPrice();
      
      if (solPrice && this.socket?.connected) {
        this.socket.emit('marketData', {
          agentId: this.state.agentId,
          symbol: 'SOL',
          price: solPrice,
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      this.addLog('error', 'Failed to sync market data', { error: String(e) });
    }
  }

  public requestAction(actionType: string, parameters?: Record<string, any>): void {
    if (!this.socket?.connected) {
      this.addLog('warn', 'Cannot request action: not connected');
      return;
    }

    this.socket.emit('action', {
      agentId: this.state.agentId,
      actionType,
      parameters,
    });
  }

  public sendChatMessage(content: string, metadata?: Record<string, any>): void {
    this.sendChatToAgent(content);
    contextManager.addMemory('conversation', content, 0.5, { to: 'elizaos' });
  }

  public disconnect(): void {
    this.stopMarketSync();
    
    if (this.httpPollInterval) {
      clearInterval(this.httpPollInterval);
      this.httpPollInterval = null;
    }
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.useHttpMode = false;
    this.state.isConnected = false;
    this.reconnectAttempts = 0;
    this.addLog('info', 'Disconnected');
    this.notifyStateChange();
  }
  
  public resetReconnect(): void {
    this.reconnectAttempts = 0;
  }
  
  public getBufferedMessageCount(): number {
    return this.outboundBuffer.length;
  }

  public getState(): ElizaAgentState {
    return { ...this.state };
  }

  public isConnected(): boolean {
    return this.socket?.connected || false;
  }

  public getPendingActions(): ElizaAction[] {
    return [...this.actionQueue];
  }
  
  public getServerUrl(): string | undefined {
    return this.state.serverUrl;
  }
  
  public getConnectionError(): string | undefined {
    return this.state.connectionError;
  }

  public getLogs(): ElizaLogEntry[] {
    return [...this.logs];
  }

  public getTradingMetrics(): ElizaTradingMetrics {
    return { ...this.tradingMetrics };
  }
  
  public async testConnection(url?: string): Promise<{ success: boolean; error?: string; latencyMs?: number }> {
    const testUrl = normalizeHttpUrl(url || process.env.NEXT_PUBLIC_ELIZAOS_URL || config('elizaos_url') || DEFAULT_ELIZAOS_URL);
    
    this.addLog('info', `Testing connection to ${testUrl}...`);
    
    const startTime = Date.now();
    
    // Use server-side proxy to avoid CORS issues
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      
      const response = await fetch('/api/elizaos-proxy', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const latencyMs = Date.now() - startTime;
          this.addLog('info', `ElizaOS server reachable via proxy (${latencyMs}ms)`);
          return { success: true, latencyMs };
        }
      }
      
      const errorData = await response.json().catch(() => ({}));
      this.addLog('error', `Proxy test failed: ${errorData.error || response.status}`);
      return { success: false, error: errorData.error || `HTTP ${response.status}` };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      this.addLog('error', `Connection test failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  public async requestSwap(params: {
    inputToken: string;
    outputToken: string;
    amount: number;
    slippage?: number;
  }): Promise<void> {
    // Defense-in-depth: the kill switch is also checked at the call site in
    // executeAction(), but this guard protects any direct caller that bypasses
    // the switch statement (e.g. future admin UI wiring, external API).
    if (process.env.AUTONOMY_TRADING_KILL_SWITCH !== 'off') {
      this.addLog(
        'warn',
        'Swap request blocked by AUTONOMY_TRADING_KILL_SWITCH (default=on). Set env to "off" to allow.',
      );
      return;
    }

    // Hard cap on Solana slippage — mirrors the 10 BNB cap on the BNB side so
    // an agent can never sign a 50% slippage swap that drains the wallet.
    const MAX_SOL_SLIPPAGE_BPS = 500; // 5%
    const requestedBps = (params.slippage || 0.5) * 100;
    const clampedBps = Math.min(requestedBps, MAX_SOL_SLIPPAGE_BPS);
    if (clampedBps !== requestedBps) {
      this.addLog(
        'warn',
        `Clamped slippage ${requestedBps} → ${MAX_SOL_SLIPPAGE_BPS} bps (MAX_SOL_SLIPPAGE_BPS).`,
      );
    }

    if (!this.socket?.connected) {
      this.addLog('warn', 'Cannot request swap: not connected');
      return;
    }

    this.socket.emit('trading', {
      agentId: this.state.agentId,
      action: 'EXECUTE_SWAP',
      parameters: {
        inputMint: params.inputToken,
        outputMint: params.outputToken,
        amount: params.amount,
        slippageBps: clampedBps,
      },
    });

    this.addLog('info', `Swap requested: ${params.amount} ${params.inputToken} -> ${params.outputToken}`);
  }

  public async getWalletBalance(): Promise<void> {
    if (!this.socket?.connected) {
      this.addLog('warn', 'Cannot get wallet balance: not connected');
      return;
    }

    this.socket.emit('trading', {
      agentId: this.state.agentId,
      action: 'GET_BALANCE',
    });
  }

  public async fetchAgents(): Promise<any[]> {
    const url = normalizeHttpUrl(this.state.serverUrl || DEFAULT_ELIZAOS_URL);
    try {
      const response = await fetch(`${url}/api/agents`);
      const data = await response.json();
      return data.data?.agents || [];
    } catch (e) {
      this.addLog('error', 'Failed to fetch agents', { error: String(e) });
      return [];
    }
  }
}

export const elizaOSBridge = new ElizaOSBridgeClass();
