import type { NextApiRequest, NextApiResponse } from 'next';

const ELIZAOS_URL = process.env.NEXT_PUBLIC_ELIZAOS_URL || '';
const ELIZAOS_AGENT_ID = process.env.NEXT_PUBLIC_ELIZAOS_AGENT_ID || '';

// Whitelist of ElizaOS paths the `custom` action is allowed to proxy. Keeps
// the proxy from being abused as an SSRF vector — user-supplied `endpoint`
// values are rejected unless they match this list exactly.
const ALLOWED_CUSTOM_ENDPOINTS = new Set<string>([
  '/api/messages/submit',
  '/api/messages',
  '/api/agents',
  '/api/chat',
]);

function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (normalized.startsWith('wss://')) {
    normalized = normalized.replace('wss://', 'https://');
  } else if (normalized.startsWith('ws://')) {
    normalized = normalized.replace('ws://', 'http://');
  }
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `https://${normalized}`;
  }
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const baseUrl = normalizeUrl(ELIZAOS_URL);
  const { action, endpoint, ...body } = req.body || {};
  
  try {
    if (req.method === 'GET' || action === 'test') {
      const testEndpoints = ['/', '/api', '/api/agents', '/agents'];
      
      for (const path of testEndpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);
          
          const response = await fetch(`${baseUrl}${path}`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok || response.status === 404 || response.status === 405) {
            return res.status(200).json({
              success: true,
              endpoint: path,
              status: response.status,
              serverUrl: baseUrl,
              agentId: ELIZAOS_AGENT_ID,
            });
          }
        } catch {
          continue;
        }
      }
      
      return res.status(503).json({
        success: false,
        error: 'Unable to reach ElizaOS server',
        serverUrl: baseUrl,
      });
    }
    
    if (req.method === 'POST') {
      // Get agent info
      if (action === 'agent-info') {
        const agentId = body.agentId || ELIZAOS_AGENT_ID;
        try {
          const response = await fetch(`${baseUrl}/api/agents`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          });
          
          if (response.ok) {
            const data = await response.json();
            const agents = data?.data?.agents || data?.agents || [];
            const agent = agents.find((a: { id: string }) => a.id === agentId);
            
            return res.status(200).json({
              success: true,
              agent: agent || null,
              allAgents: agents,
              serverUrl: baseUrl,
            });
          }
        } catch (e) {
          console.log('Agent info error:', e instanceof Error ? e.message : 'Unknown');
        }
        
        return res.status(503).json({
          success: false,
          error: 'Failed to get agent info',
        });
      }
      
      if (action === 'message') {
        const agentId = body.agentId || ELIZAOS_AGENT_ID;
        
        const endpointsToTry = [
          // ElizaOS v1.0.16+ format
          { url: `${baseUrl}/api/messages/submit`, payload: {
            channel_id: body.roomId || 'amica-chat',
            server_id: '00000000-0000-0000-0000-000000000000',
            author_id: body.userId || 'amica-client',
            content: body.text,
            source_type: 'rest',
            raw_message: {
              text: body.text,
              thought: '',
              actions: [],
            },
            metadata: {
              agent_id: agentId,
            },
          }},
          // Legacy formats
          { url: `${baseUrl}/api/messages`, payload: {
            channel_id: body.roomId || 'amica-chat',
            server_id: '00000000-0000-0000-0000-000000000000',
            author_id: body.userId || 'amica-client',
            content: body.text,
            source_type: 'rest',
            raw_message: body,
          }},
          { url: `${baseUrl}/api/agents/${agentId}/message`, payload: body },
          { url: `${baseUrl}/${agentId}/message`, payload: body },
          { url: `${baseUrl}/api/chat`, payload: body },
        ];
        
        for (const ep of endpointsToTry) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(ep.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(ep.payload),
              signal: controller.signal,
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const data = await response.json();
              return res.status(200).json({
                success: true,
                data: Array.isArray(data) ? data[0] : data,
                endpoint: ep.url,
              });
            } else if (response.status !== 404 && response.status !== 405) {
              const errorText = await response.text().catch(() => '');
              console.log(`ElizaOS endpoint ${ep.url} returned ${response.status}: ${errorText}`);
            }
          } catch (e) {
            console.log(`ElizaOS endpoint ${ep.url} error:`, e instanceof Error ? e.message : 'Unknown');
          }
        }
        
        return res.status(503).json({
          success: false,
          error: 'All ElizaOS message endpoints failed',
        });
      }
      
      if (action === 'custom' && endpoint) {
        // Reject anything not explicitly allowlisted to prevent SSRF /
        // path-traversal against the upstream ElizaOS server.
        if (
          typeof endpoint !== 'string' ||
          !endpoint.startsWith('/') ||
          endpoint.includes('..') ||
          !ALLOWED_CUSTOM_ENDPOINTS.has(endpoint)
        ) {
          return res.status(400).json({
            success: false,
            error: `Endpoint not allowed: ${String(endpoint)}`,
          });
        }
        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data = await response.json();
          return res.status(200).json({ success: true, data });
        } else {
          return res.status(response.status).json({
            success: false,
            error: `Request failed: ${response.status}`,
          });
        }
      }
      
      return res.status(400).json({ success: false, error: 'Invalid action' });
    }
    
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('ElizaOS proxy error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}
