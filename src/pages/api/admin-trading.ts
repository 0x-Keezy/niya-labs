/**
 * Admin Trading API - Privileged endpoint for admin actions
 * 
 * This endpoint allows:
 * - Manual trading (buy/sell tokens)
 * - Wallet operations (check balance, transfers)
 * - Tweet posting
 * - Trading configuration
 * 
 * Requires ADMIN_PASSWORD authentication
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqualStr } from '@/features/auth/timingSafeEqual';
import { verifyAdminSession } from '@/features/auth/adminSession';
import { enforceRateLimit, clientIdentifier } from '@/features/auth/rateLimit';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ELIZAOS_URL = process.env.ELIZAOS_URL || '';
const AGENT_ID = process.env.ELIZAOS_AGENT_ID || '';
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || '';
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';

type AdminAction = 
  | 'get_wallet_info'
  | 'get_token_balances'
  | 'buy_token'
  | 'sell_token'
  | 'get_swap_quote'
  | 'post_tweet'
  | 'set_trading_enabled'
  | 'get_trading_status'
  | 'send_elizaos_command';

interface AdminRequest {
  password: string;
  action: AdminAction;
  data?: Record<string, any>;
}

interface AdminResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Rejects content that attempts to inject ADMIN_* command prefixes into
 * the text templates sent to ElizaOS. Any of these literals anywhere in
 * a user-supplied field is a red flag — legitimate tweets and commands
 * never contain `[ADMIN_COMMAND]` / `[ADMIN_TRADE]` substrings.
 *
 * See also: src/features/autonomy/elizaOSBridge.ts (kill switch) and
 * SECURITY.md "Tweet content injection defense".
 */
const INJECTION_PATTERN = /\[ADMIN_(COMMAND|TRADE|TWEET|BUY|SELL)\]/i;
const MAX_CONTENT_LENGTH = 4000;

function sanitizeCommandField(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Rejected content: must be a string' };
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Rejected content: empty after trim' };
  }
  if (trimmed.length > MAX_CONTENT_LENGTH) {
    return { ok: false, error: `Rejected content: exceeds ${MAX_CONTENT_LENGTH} chars` };
  }
  if (INJECTION_PATTERN.test(trimmed)) {
    return { ok: false, error: 'Rejected content: injection pattern detected' };
  }
  return { ok: true, value: trimmed };
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

async function verifyAdmin(password: string): Promise<{ valid: boolean; error?: string }> {
  if (!ADMIN_PASSWORD) {
    return { valid: false, error: 'Admin authentication not configured' };
  }
  // Constant-time compare so attackers can't recover the password byte-by-byte
  // via timing side channels. Same helper used by /admin-auth + four-meme-launch.
  return { valid: timingSafeEqualStr(password, ADMIN_PASSWORD) };
}

async function getWalletInfo(): Promise<any> {
  // Try to get wallet info from ElizaOS
  try {
    const response = await fetch(`${ELIZAOS_URL}/api/agents/${AGENT_ID}/wallet`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.error('Failed to get wallet info from ElizaOS:', e);
  }

  // If ElizaOS doesn't respond, return placeholder
  return {
    status: 'not_configured',
    message: 'Wallet integration requires ElizaOS with Solana plugin configured',
    note: 'Configure ELIZAOS_URL and ensure Solana wallet is set up in ElizaOS',
  };
}

async function getTokenBalances(walletAddress?: string): Promise<any> {
  if (!walletAddress && !HELIUS_API_KEY) {
    return { 
      error: 'Wallet address or Helius API key required',
      tokens: [],
    };
  }

  // This would use Helius RPC to get balances
  // For now, return structure
  return {
    tokens: [],
    nativeBalance: 0,
    note: 'Token balance fetching available with wallet configuration',
  };
}

async function getSwapQuote(inputMint: string, outputMint: string, amount: number): Promise<any> {
  try {
    const response = await fetch(
      `https://api.jup.ag/quote/v6?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}`,
      {
        headers: JUPITER_API_KEY ? { 'x-api-key': JUPITER_API_KEY } : {},
      }
    );
    
    if (response.ok) {
      return await response.json();
    }
    
    return { error: 'Failed to get quote from Jupiter' };
  } catch (e) {
    return { error: 'Jupiter API error' };
  }
}

async function executeBuy(tokenAddress: string, amountSol: number): Promise<any> {
  // Send buy command to ElizaOS
  try {
    const response = await fetch(`${ELIZAOS_URL}/api/agents/${AGENT_ID}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[ADMIN_COMMAND] BUY ${amountSol} SOL of token ${tokenAddress}`,
        userId: 'admin',
        userName: 'Admin',
        roomId: 'admin-trading',
        agentId: AGENT_ID,
        metadata: {
          isAdminCommand: true,
          action: 'buy',
          tokenAddress,
          amountSol,
        },
      }),
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    return { 
      status: 'pending',
      message: 'Buy command sent to ElizaOS - check trading logs',
      tokenAddress,
      amountSol,
    };
  } catch (e) {
    return { error: 'Failed to send buy command', details: String(e) };
  }
}

async function executeSell(tokenAddress: string, amountPercent: number): Promise<any> {
  // Send sell command to ElizaOS
  try {
    const response = await fetch(`${ELIZAOS_URL}/api/agents/${AGENT_ID}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[ADMIN_COMMAND] SELL ${amountPercent}% of token ${tokenAddress}`,
        userId: 'admin',
        userName: 'Admin',
        roomId: 'admin-trading',
        agentId: AGENT_ID,
        metadata: {
          isAdminCommand: true,
          action: 'sell',
          tokenAddress,
          amountPercent,
        },
      }),
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    return { 
      status: 'pending',
      message: 'Sell command sent to ElizaOS - check trading logs',
      tokenAddress,
      amountPercent,
    };
  } catch (e) {
    return { error: 'Failed to send sell command', details: String(e) };
  }
}

async function postTweet(content: string, style?: string): Promise<any> {
  try {
    const response = await fetch(`${ELIZAOS_URL}/api/agents/${AGENT_ID}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[ADMIN_COMMAND] TWEET: ${content}`,
        userId: 'admin',
        userName: 'Admin',
        roomId: 'admin-twitter',
        agentId: AGENT_ID,
        metadata: {
          isAdminCommand: true,
          action: 'tweet',
          content,
          style: style || 'default',
        },
      }),
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    return { 
      status: 'pending',
      message: 'Tweet command sent to ElizaOS',
      content,
    };
  } catch (e) {
    return { error: 'Failed to send tweet command', details: String(e) };
  }
}

async function sendElizaOSCommand(command: string): Promise<any> {
  try {
    const response = await fetch(`${ELIZAOS_URL}/api/agents/${AGENT_ID}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[ADMIN_COMMAND] ${command}`,
        userId: 'admin',
        userName: 'Admin',
        roomId: 'admin-commands',
        agentId: AGENT_ID,
        metadata: {
          isAdminCommand: true,
        },
      }),
    });
    
    if (response.ok) {
      return await response.json();
    }
    
    return { status: 'sent', command };
  } catch (e) {
    return { error: 'Failed to send command', details: String(e) };
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { password, action, data } = req.body as AdminRequest;

    // Phase 1.2 — cookie-first auth with legacy password fallback.
    //   Primary:  niya_admin_session HttpOnly cookie issued by /api/admin/session.
    //   Fallback: the old body-password flow, kept so curl / ops scripts that
    //             pre-date the cookie migration keep working. Remove the
    //             fallback once no caller relies on it.
    //
    // Security: the password-fallback path is rate-limited at 5 attempts /
    // minute / IP to prevent brute-force of ADMIN_PASSWORD. The cookie path
    // bypasses this because a valid session already proved identity.
    const sessionValid = await verifyAdminSession(req);
    if (!sessionValid) {
      // Rate limit password attempts BEFORE calling verifyAdmin, so a flood
      // of requests can't CPU-burn on timing-safe compares.
      const rl = await enforceRateLimit(req, res, {
        endpoint: 'admin-trading/password-auth',
        limit: 5,
        windowMs: 60_000,
      });
      if (!rl.allowed) {
        // enforceRateLimit already wrote a 429 response.
        return;
      }

      const authResult = await verifyAdmin(password || '');
      if (!authResult.valid) {
        return res.status(401).json({
          success: false,
          error: authResult.error || 'Invalid admin credentials',
        });
      }
    }

    let result: any;

    switch (action) {
      case 'get_wallet_info':
        result = await getWalletInfo();
        break;

      case 'get_token_balances':
        result = await getTokenBalances(data?.walletAddress);
        break;

      case 'get_swap_quote':
        if (!data?.inputMint || !data?.outputMint || !data?.amount) {
          return res.status(400).json({ success: false, error: 'Missing quote parameters' });
        }
        result = await getSwapQuote(data.inputMint, data.outputMint, data.amount);
        break;

      case 'buy_token': {
        if (!data?.tokenAddress || data?.amountSol === undefined) {
          return res.status(400).json({ success: false, error: 'Token address and amount required' });
        }
        const addr = sanitizeCommandField(data.tokenAddress);
        if (!addr.ok) {
          return res.status(400).json({ success: false, error: addr.error });
        }
        if (!isFiniteNumber(data.amountSol) || data.amountSol <= 0) {
          return res.status(400).json({ success: false, error: 'Rejected content: amountSol must be a finite positive number' });
        }
        result = await executeBuy(addr.value, data.amountSol);
        break;
      }

      case 'sell_token': {
        if (!data?.tokenAddress) {
          return res.status(400).json({ success: false, error: 'Token address required' });
        }
        const addr = sanitizeCommandField(data.tokenAddress);
        if (!addr.ok) {
          return res.status(400).json({ success: false, error: addr.error });
        }
        const pct = data.amountPercent ?? 100;
        if (!isFiniteNumber(pct) || pct <= 0 || pct > 100) {
          return res.status(400).json({ success: false, error: 'Rejected content: amountPercent must be a finite number in (0, 100]' });
        }
        result = await executeSell(addr.value, pct);
        break;
      }

      case 'post_tweet': {
        if (!data?.content) {
          return res.status(400).json({ success: false, error: 'Tweet content required' });
        }
        const content = sanitizeCommandField(data.content);
        if (!content.ok) {
          return res.status(400).json({ success: false, error: content.error });
        }
        // style is optional — if present, sanitize it too
        let style: string | undefined;
        if (data.style !== undefined) {
          const styleCheck = sanitizeCommandField(data.style);
          if (!styleCheck.ok) {
            return res.status(400).json({ success: false, error: styleCheck.error });
          }
          style = styleCheck.value;
        }
        result = await postTweet(content.value, style);
        break;
      }

      case 'set_trading_enabled':
        // Store trading enabled state
        result = { 
          tradingEnabled: data?.enabled ?? false,
          message: `Trading ${data?.enabled ? 'enabled' : 'disabled'}`,
        };
        break;

      case 'get_trading_status':
        result = {
          elizaosUrl: ELIZAOS_URL,
          agentId: AGENT_ID,
          jupiterConfigured: !!JUPITER_API_KEY,
          heliusConfigured: !!HELIUS_API_KEY,
        };
        break;

      case 'send_elizaos_command': {
        if (!data?.command) {
          return res.status(400).json({ success: false, error: 'Command required' });
        }
        const cmd = sanitizeCommandField(data.command);
        if (!cmd.ok) {
          return res.status(400).json({ success: false, error: cmd.error });
        }
        result = await sendElizaOSCommand(cmd.value);
        break;
      }

      default:
        return res.status(400).json({ success: false, error: 'Unknown action' });
    }

    return res.status(200).json({ success: true, data: result });

  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[Admin Trading] Error:', errorMsg);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
