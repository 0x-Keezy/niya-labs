export { contextManager, type AgentContext, type MemoryEntry, type EmotionalState, type VisualContext, type MarketContext } from './contextManager';
export { visionProcessor, type VisionAnalysis } from './visionProcessor';
export { functionCallingEnhanced, availableFunctions, type FunctionCall, type FunctionResult } from './functionCallingEnhanced';
export { jupiterApi, type TokenPrice, type SwapQuote, type TokenInfo } from './jupiterApi';
export { heliusRpc, type HeliusConfig, type TransactionInfo, type AssetInfo, type WebhookConfig } from './heliusRpc';
export { elizaOSBridge, type ElizaMessage, type ElizaAction, type ElizaAgentState, type MarketTrigger } from './elizaOSBridge';

import { contextManager } from './contextManager';
import { visionProcessor } from './visionProcessor';
import { functionCallingEnhanced } from './functionCallingEnhanced';
import { jupiterApi } from './jupiterApi';
import { heliusRpc } from './heliusRpc';
import { elizaOSBridge } from './elizaOSBridge';

export interface AutonomyConfig {
  enableVision?: boolean;
  visionIntervalMs?: number;
  enableMarketMonitoring?: boolean;
  marketIntervalMs?: number;
  heliusApiKey?: string;
  elizaOSUrl?: string;
  connectElizaOS?: boolean;
}

export async function initializeAutonomy(config: AutonomyConfig = {}): Promise<void> {
  console.log('Initializing Niya Autonomy System...');

  contextManager.initialize();

  if (typeof window !== 'undefined') {
    visionProcessor.initialize();
    
    if (config.enableVision) {
      visionProcessor.startAutoCapture(config.visionIntervalMs || 60000);
    }
  }

  jupiterApi.initialize();
  
  if (config.enableMarketMonitoring) {
    jupiterApi.startPriceMonitoring(
      [jupiterApi.SOL_MINT],
      config.marketIntervalMs || 60000,
      (prices) => {
        const solPrice = prices.get(jupiterApi.SOL_MINT);
        if (solPrice) {
          contextManager.updateMarketContext({ solanaPrice: solPrice });
        }
      }
    );
  }

  if (config.heliusApiKey) {
    heliusRpc.initialize(config.heliusApiKey);
  } else {
    heliusRpc.initialize();
  }

  elizaOSBridge.initialize(config.elizaOSUrl);
  
  if (config.connectElizaOS) {
    elizaOSBridge.connect(config.elizaOSUrl);
  }

  console.log('Niya Autonomy System initialized');
}

export function shutdownAutonomy(): void {
  console.log('Shutting down Niya Autonomy System...');
  
  visionProcessor.stopAutoCapture();
  jupiterApi.stopPriceMonitoring();
  elizaOSBridge.disconnect();
  
  console.log('Niya Autonomy System shut down');
}

export function getAutonomyStatus(): {
  contextManager: boolean;
  visionProcessor: boolean;
  jupiterApi: boolean;
  heliusRpc: boolean;
  elizaOSBridge: boolean;
} {
  return {
    contextManager: true,
    visionProcessor: typeof window !== 'undefined',
    jupiterApi: true,
    heliusRpc: heliusRpc.isConfigured(),
    elizaOSBridge: elizaOSBridge.isConnected(),
  };
}
