import { fetchBNBTokenData, BNBTokenData } from '../market/bnbMarketDataProvider';

export interface TradeParams {
  tokenAddress: string;
  amount: number;
  slippageBps?: number;
  isAdminAction?: boolean;
}

export interface TradeResult {
  success: boolean;
  txHash?: string;
  error?: string;
  amountIn?: number;
  amountOut?: number;
  price?: number;
  phase?: 'bonding' | 'graduated';
}

export interface TradingGuardrails {
  maxPositionBnb: number;
  maxSlippageBps: number;
  minLiquidityUsd: number;
  cooldownMs: number;
  dailyTradeLimitBnb: number;
}

const DEFAULT_GUARDRAILS: TradingGuardrails = {
  maxPositionBnb: 0.5,
  maxSlippageBps: 500,
  minLiquidityUsd: 1000,
  cooldownMs: 60000,
  dailyTradeLimitBnb: 2,
};

const FOUR_MEME_BONDING_CURVE = '0x5c952063c7fc8610FFDB798152D69F0B9550762b';
const PANCAKESWAP_ROUTER_V2 = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

export class BNBTradingService {
  private rpcUrl: string;
  private guardrails: TradingGuardrails;
  private lastTradeTime: number = 0;
  private dailyTradeVolume: number = 0;
  private dailyResetTime: number = Date.now();
  private autonomousTradingEnabled: boolean = false; // Disabled until parameters are finalized
  
  constructor(rpcUrl: string = 'https://bsc-dataseed.binance.org', guardrails?: Partial<TradingGuardrails>) {
    this.rpcUrl = rpcUrl;
    this.guardrails = { ...DEFAULT_GUARDRAILS, ...guardrails };
  }
  
  isAutonomousTradingEnabled(): boolean {
    return this.autonomousTradingEnabled;
  }
  
  setAutonomousTradingEnabled(enabled: boolean): void {
    this.autonomousTradingEnabled = enabled;
    console.log(`[BNBTrading] Autonomous trading ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  async getTokenPhase(tokenAddress: string): Promise<'bonding' | 'graduated' | 'unknown'> {
    const data = await fetchBNBTokenData(tokenAddress, this.rpcUrl);
    if (!data) return 'unknown';
    return data.phase;
  }
  
  async getTokenData(tokenAddress: string): Promise<BNBTokenData | null> {
    return fetchBNBTokenData(tokenAddress, this.rpcUrl);
  }
  
  validateTrade(params: TradeParams): { valid: boolean; reason?: string } {
    const now = Date.now();
    
    // Block autonomous trades when disabled (admin actions always allowed)
    if (!params.isAdminAction && !this.autonomousTradingEnabled) {
      return { valid: false, reason: 'Autonomous trading is disabled - only admin trades allowed' };
    }
    
    if (now - this.dailyResetTime > 24 * 60 * 60 * 1000) {
      this.dailyTradeVolume = 0;
      this.dailyResetTime = now;
    }
    
    if (params.amount > this.guardrails.maxPositionBnb) {
      return { valid: false, reason: `Amount exceeds max position (${this.guardrails.maxPositionBnb} BNB)` };
    }
    
    if (this.dailyTradeVolume + params.amount > this.guardrails.dailyTradeLimitBnb) {
      return { valid: false, reason: `Would exceed daily trade limit (${this.guardrails.dailyTradeLimitBnb} BNB)` };
    }
    
    if (now - this.lastTradeTime < this.guardrails.cooldownMs && !params.isAdminAction) {
      const remaining = Math.ceil((this.guardrails.cooldownMs - (now - this.lastTradeTime)) / 1000);
      return { valid: false, reason: `Cooldown active: ${remaining}s remaining` };
    }
    
    const slippage = params.slippageBps ?? 100;
    if (slippage > this.guardrails.maxSlippageBps) {
      return { valid: false, reason: `Slippage (${slippage} bps) exceeds max (${this.guardrails.maxSlippageBps} bps)` };
    }
    
    return { valid: true };
  }
  
  async prepareBuyTransaction(params: TradeParams): Promise<{
    to: string;
    data: string;
    value: string;
    phase: 'bonding' | 'graduated';
  } | null> {
    const tokenData = await this.getTokenData(params.tokenAddress);
    if (!tokenData) {
      console.error('[BNBTrading] Failed to fetch token data');
      return null;
    }
    
    if (tokenData.marketCap < this.guardrails.minLiquidityUsd) {
      console.error('[BNBTrading] Token liquidity too low:', tokenData.marketCap);
      return null;
    }
    
    const amountInWei = BigInt(Math.floor(params.amount * 1e18)).toString();
    const slippageBps = params.slippageBps ?? 100;
    const deadline = Math.floor(Date.now() / 1000) + 300;
    
    if (tokenData.phase === 'bonding') {
      const buyData = this.encodeFourMemeBuy(params.tokenAddress, slippageBps);
      return {
        to: FOUR_MEME_BONDING_CURVE,
        data: buyData,
        value: amountInWei,
        phase: 'bonding',
      };
    } else {
      const path = [WBNB, params.tokenAddress];
      const minAmountOut = '0';
      const swapData = this.encodePancakeSwap(path, amountInWei, minAmountOut, deadline);
      return {
        to: PANCAKESWAP_ROUTER_V2,
        data: swapData,
        value: amountInWei,
        phase: 'graduated',
      };
    }
  }
  
  async prepareSellTransaction(params: TradeParams & { tokenAmount: bigint }): Promise<{
    to: string;
    data: string;
    value: string;
    phase: 'bonding' | 'graduated';
    approvalRequired?: { token: string; spender: string; amount: string };
  } | null> {
    const tokenData = await this.getTokenData(params.tokenAddress);
    if (!tokenData) {
      console.error('[BNBTrading] Failed to fetch token data');
      return null;
    }
    
    const slippageBps = params.slippageBps ?? 100;
    const deadline = Math.floor(Date.now() / 1000) + 300;
    const tokenAmountStr = params.tokenAmount.toString();
    
    if (tokenData.phase === 'bonding') {
      const sellData = this.encodeFourMemeSell(params.tokenAddress, tokenAmountStr, slippageBps);
      return {
        to: FOUR_MEME_BONDING_CURVE,
        data: sellData,
        value: '0',
        phase: 'bonding',
        approvalRequired: {
          token: params.tokenAddress,
          spender: FOUR_MEME_BONDING_CURVE,
          amount: tokenAmountStr,
        },
      };
    } else {
      const path = [params.tokenAddress, WBNB];
      const minAmountOut = '0';
      const swapData = this.encodePancakeSwapSell(path, tokenAmountStr, minAmountOut, deadline);
      return {
        to: PANCAKESWAP_ROUTER_V2,
        data: swapData,
        value: '0',
        phase: 'graduated',
        approvalRequired: {
          token: params.tokenAddress,
          spender: PANCAKESWAP_ROUTER_V2,
          amount: tokenAmountStr,
        },
      };
    }
  }
  
  private encodeFourMemeBuy(tokenAddress: string, slippageBps: number): string {
    const functionSelector = '0x' + 'b8a7e5d1';
    const tokenPadded = tokenAddress.slice(2).padStart(64, '0');
    const slippagePadded = slippageBps.toString(16).padStart(64, '0');
    return functionSelector + tokenPadded + slippagePadded;
  }
  
  private encodeFourMemeSell(tokenAddress: string, amount: string, slippageBps: number): string {
    const functionSelector = '0x' + 'a9e75a21';
    const tokenPadded = tokenAddress.slice(2).padStart(64, '0');
    const amountPadded = BigInt(amount).toString(16).padStart(64, '0');
    const slippagePadded = slippageBps.toString(16).padStart(64, '0');
    return functionSelector + tokenPadded + amountPadded + slippagePadded;
  }
  
  private encodePancakeSwap(path: string[], amountIn: string, minAmountOut: string, deadline: number): string {
    const funcSig = '0x7ff36ab5';
    return funcSig + this.encodeSwapParams(path, minAmountOut, deadline);
  }
  
  private encodePancakeSwapSell(path: string[], amountIn: string, minAmountOut: string, deadline: number): string {
    const funcSig = '0x18cbafe5';
    return funcSig + this.encodeSwapExactTokensParams(amountIn, path, minAmountOut, deadline);
  }
  
  private encodeSwapParams(path: string[], minAmountOut: string, deadline: number): string {
    const minOut = BigInt(minAmountOut).toString(16).padStart(64, '0');
    const pathOffset = (128).toString(16).padStart(64, '0');
    const toAddress = '0000000000000000000000000000000000000000000000000000000000000000';
    const deadlineHex = deadline.toString(16).padStart(64, '0');
    const pathLength = path.length.toString(16).padStart(64, '0');
    const pathAddresses = path.map(addr => addr.slice(2).padStart(64, '0')).join('');
    return minOut + pathOffset + toAddress + deadlineHex + pathLength + pathAddresses;
  }
  
  private encodeSwapExactTokensParams(amountIn: string, path: string[], minAmountOut: string, deadline: number): string {
    const amountInHex = BigInt(amountIn).toString(16).padStart(64, '0');
    const minOut = BigInt(minAmountOut).toString(16).padStart(64, '0');
    const pathOffset = (160).toString(16).padStart(64, '0');
    const toAddress = '0000000000000000000000000000000000000000000000000000000000000000';
    const deadlineHex = deadline.toString(16).padStart(64, '0');
    const pathLength = path.length.toString(16).padStart(64, '0');
    const pathAddresses = path.map(addr => addr.slice(2).padStart(64, '0')).join('');
    return amountInHex + minOut + pathOffset + toAddress + deadlineHex + pathLength + pathAddresses;
  }
  
  recordTrade(amountBnb: number) {
    this.lastTradeTime = Date.now();
    this.dailyTradeVolume += amountBnb;
  }
  
  getGuardrails(): TradingGuardrails {
    return { ...this.guardrails };
  }
  
  setGuardrails(guardrails: Partial<TradingGuardrails>) {
    this.guardrails = { ...this.guardrails, ...guardrails };
  }
  
  getTradingStats(): { dailyVolume: number; lastTradeTime: number; cooldownActive: boolean } {
    const now = Date.now();
    return {
      dailyVolume: this.dailyTradeVolume,
      lastTradeTime: this.lastTradeTime,
      cooldownActive: now - this.lastTradeTime < this.guardrails.cooldownMs,
    };
  }
}

export const bnbTradingService = new BNBTradingService();
