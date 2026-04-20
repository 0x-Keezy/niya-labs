import type { NextApiRequest, NextApiResponse } from 'next';
import { bnbTradingService, TradeResult } from '@/features/trading/bnbTradingService';
import { timingSafeEqualStr } from '@/features/auth/timingSafeEqual';
import { verifyAdminSession } from '@/features/auth/adminSession';
import { enforceRateLimit } from '@/features/auth/rateLimit';

interface TradeRequest {
  action: 'buy' | 'sell' | 'quote' | 'status' | 'guardrails';
  tokenAddress?: string;
  amount?: number;
  tokenAmount?: string;
  slippageBps?: number;
  guardrails?: {
    maxPositionBnb?: number;
    maxSlippageBps?: number;
    minLiquidityUsd?: number;
    cooldownMs?: number;
    dailyTradeLimitBnb?: number;
  };
}

interface TradeResponse {
  success: boolean;
  data?: any;
  error?: string;
}

const ADMIN_AUTH_HEADER = 'x-admin-auth';

function isAdminAuthorized(req: NextApiRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    console.error('[BNB Trade API] ADMIN_SECRET not configured');
    return false;
  }
  const authHeader = req.headers[ADMIN_AUTH_HEADER];
  // Constant-time compare — prevents timing-based recovery of ADMIN_SECRET.
  return timingSafeEqualStr(
    typeof authHeader === 'string' ? authHeader : null,
    adminSecret,
  );
}

function isValidBnbAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Per-action rate limits. Trades (buy/sell) are strictly 1/min — these are
// expensive on-chain actions and we want to prevent double-click fat-fingers
// as well as spam from a compromised admin cookie. Reads (status/guardrails)
// and quotes get more headroom for UI polling.
const RATE_LIMITS: Record<TradeRequest['action'], { limit: number; windowMs: number }> = {
  buy:        { limit: 1,  windowMs: 60_000 },
  sell:       { limit: 1,  windowMs: 60_000 },
  quote:      { limit: 10, windowMs: 60_000 },
  status:     { limit: 30, windowMs: 60_000 },
  guardrails: { limit: 30, windowMs: 60_000 },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TradeResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Auth gate first — we don't want anonymous spammers burning the rate-limit
  // quota of the real admin IP.
  // Phase 1.2 — cookie-first, legacy x-admin-auth header as fallback.
  const sessionValid = await verifyAdminSession(req);
  if (!sessionValid && !isAdminAuthorized(req)) {
    return res.status(401).json({ success: false, error: 'Unauthorized - Admin access required' });
  }

  const body = req.body as TradeRequest;
  const { action, tokenAddress, amount, tokenAmount, slippageBps, guardrails } = body;

  // Apply per-action rate limit. Unknown actions fall through to the default
  // case below where they get a 400 — no rate limit needed there.
  const rlConfig = action && RATE_LIMITS[action];
  if (rlConfig) {
    const rl = await enforceRateLimit(req, res as unknown as NextApiResponse, {
      endpoint: `admin/bnb-trade/${action}`,
      limit: rlConfig.limit,
      windowMs: rlConfig.windowMs,
    });
    if (!rl.allowed) return; // enforceRateLimit already wrote 429
  }

  try {
    switch (action) {
      case 'status': {
        const stats = bnbTradingService.getTradingStats();
        const currentGuardrails = bnbTradingService.getGuardrails();
        return res.status(200).json({
          success: true,
          data: {
            stats,
            guardrails: currentGuardrails,
          },
        });
      }

      case 'guardrails': {
        if (guardrails) {
          bnbTradingService.setGuardrails(guardrails);
        }
        return res.status(200).json({
          success: true,
          data: { guardrails: bnbTradingService.getGuardrails() },
        });
      }

      case 'quote': {
        if (!tokenAddress) {
          return res.status(400).json({ success: false, error: 'tokenAddress required' });
        }

        const tokenData = await bnbTradingService.getTokenData(tokenAddress);
        if (!tokenData) {
          return res.status(404).json({ success: false, error: 'Token not found' });
        }

        return res.status(200).json({
          success: true,
          data: {
            token: tokenData,
            phase: tokenData.phase,
            tradingRoute: tokenData.phase === 'bonding' ? 'four.meme' : 'PancakeSwap',
          },
        });
      }

      case 'buy': {
        if (!tokenAddress || !amount) {
          return res.status(400).json({ success: false, error: 'tokenAddress and amount required' });
        }

        if (!isValidBnbAddress(tokenAddress)) {
          return res.status(400).json({ success: false, error: 'Invalid BNB token address format' });
        }

        if (amount <= 0 || amount > 10) {
          return res.status(400).json({ success: false, error: 'Amount must be between 0 and 10 BNB' });
        }

        const validation = bnbTradingService.validateTrade({
          tokenAddress,
          amount,
          slippageBps,
          isAdminAction: true,
        });

        if (!validation.valid) {
          return res.status(400).json({ success: false, error: validation.reason });
        }

        const txData = await bnbTradingService.prepareBuyTransaction({
          tokenAddress,
          amount,
          slippageBps,
          isAdminAction: true,
        });

        if (!txData) {
          return res.status(500).json({ success: false, error: 'Failed to prepare transaction' });
        }

        return res.status(200).json({
          success: true,
          data: {
            prepared: true,
            transaction: txData,
            message: `Buy ${amount} BNB worth via ${txData.phase === 'bonding' ? 'four.meme' : 'PancakeSwap'}`,
            note: 'Transaction prepared but not executed. Use wallet to sign and send.',
          },
        });
      }

      case 'sell': {
        if (!tokenAddress || !tokenAmount) {
          return res.status(400).json({ success: false, error: 'tokenAddress and tokenAmount required' });
        }

        if (!isValidBnbAddress(tokenAddress)) {
          return res.status(400).json({ success: false, error: 'Invalid BNB token address format' });
        }

        const sellValidation = bnbTradingService.validateTrade({
          tokenAddress,
          amount: 0.01,
          slippageBps,
          isAdminAction: true,
        });

        if (!sellValidation.valid) {
          return res.status(400).json({ success: false, error: sellValidation.reason });
        }

        const txData = await bnbTradingService.prepareSellTransaction({
          tokenAddress,
          amount: 0,
          tokenAmount: BigInt(tokenAmount),
          slippageBps,
          isAdminAction: true,
        });

        if (!txData) {
          return res.status(500).json({ success: false, error: 'Failed to prepare transaction' });
        }

        return res.status(200).json({
          success: true,
          data: {
            prepared: true,
            transaction: txData,
            approval: txData.approvalRequired,
            message: `Sell tokens via ${txData.phase === 'bonding' ? 'four.meme' : 'PancakeSwap'}`,
            note: 'Approval may be required before sell. Transaction prepared but not executed.',
          },
        });
      }

      default:
        return res.status(400).json({ success: false, error: 'Invalid action' });
    }
  } catch (error: any) {
    console.error('[BNB Trade API] Error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal error' });
  }
}
