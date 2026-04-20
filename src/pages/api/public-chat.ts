/**
 * Public Chat API - Safe endpoint for non-admin users
 * 
 * This endpoint validates all incoming messages to prevent:
 * - Forced trading commands
 * - Tweet injection
 * - Wallet manipulation
 * - Prompt injection attacks
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { validateCommand, sanitizeMessage, getBlockedCommandResponse } from '@/features/autonomy/commandValidator';
import { enforceRateLimit } from '@/features/auth/rateLimit';

const ELIZAOS_URL = process.env.ELIZAOS_URL || '';
const AGENT_ID = process.env.ELIZAOS_AGENT_ID || '';

interface ChatRequest {
  message: string;
  userId?: string;
  roomId?: string;
}

interface ChatResponse {
  success: boolean;
  response?: string;
  blocked?: boolean;
  reason?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ChatResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // 20 messages / minute / IP.
  const rl = await enforceRateLimit(req, res, {
    endpoint: 'public-chat',
    limit: 20,
    windowMs: 60_000,
  });
  if (!rl.allowed) return;

  try {
    const { message, userId, roomId } = req.body as ChatRequest;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Validate the command for public users (viewer role)
    const validation = validateCommand(message, 'viewer');

    if (!validation.allowed) {
      console.log('[Public Chat] Blocked command:', {
        message: message.substring(0, 100),
        patterns: validation.detectedPatterns,
      });

      return res.status(200).json({
        success: true,
        blocked: true,
        reason: validation.reason,
        response: getBlockedCommandResponse(validation.reason),
      });
    }

    // Sanitize the message before sending
    const sanitizedMessage = sanitizeMessage(validation.sanitizedMessage || message);

    // Add safety prefix for ElizaOS (prevents internal command execution)
    const safeMessage = `[VIEWER_CHAT] ${sanitizedMessage}`;

    // Try to send to ElizaOS for response
    let elizaResponse: string | undefined;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      // Try ElizaOS endpoints
      const endpoints = [
        `/api/agents/${AGENT_ID}/message`,
        `/${AGENT_ID}/message`,
        `/api/message`,
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${ELIZAOS_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: safeMessage,
              userId: userId || 'public-viewer',
              userName: 'Viewer',
              roomId: roomId || 'public-chat',
              agentId: AGENT_ID,
            }),
            signal: controller.signal,
          });

          if (response.ok) {
            const data = await response.json();
            elizaResponse = data.text || data.response || data.content;
            if (elizaResponse) break;
          }
        } catch (e) {
          // Try next endpoint
        }
      }

      clearTimeout(timeoutId);
    } catch (e) {
      console.error('[Public Chat] ElizaOS error:', e);
    }

    // Return response (or fallback message if ElizaOS didn't respond)
    return res.status(200).json({
      success: true,
      response: elizaResponse || "I'm processing your request. You can ask me about market analysis, token information, or just chat!",
    });

  } catch (e) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error';
    console.error('[Public Chat] Error:', errorMsg);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
