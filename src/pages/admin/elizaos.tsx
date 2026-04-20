import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { elizaOSBridge, ElizaLogEntry, ElizaTradingMetrics } from '@/features/autonomy/elizaOSBridge';
import { config, updateConfig } from '@/utils/config';

const Live2DViewer = dynamic(() => import('@/components/live2dViewer'), { ssr: false });

interface ConnectionStatus {
  isConnected: boolean;
  serverUrl?: string;
  lastHeartbeat?: number;
  connectionError?: string;
  bufferedMessages: number;
  capabilities: string[];
}

interface TradingMetricsExtended extends ElizaTradingMetrics {
  pendingActions: number;
}

interface PumpFunStatus {
  isConnected: boolean;
  tradeStats: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
  };
}

interface TradeLogEntry {
  id: string;
  timestamp: number;
  type: 'buy' | 'sell';
  mint: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  signature?: string;
  error?: string;
}

type TabType = 'elizaos' | 'pumpfun' | 'trading' | 'streaming' | 'xdrafts';

interface XDraft {
  id: number;
  text: string;
  replyToTweetId: string | null;
  status: string;
  tweetId: string | null;
  errorMessage: string | null;
  createdAt: string;
  postedAt: string | null;
}

interface StreamingStatus {
  isStreaming: boolean;
  startedAt: number | null;
  uptime: number;
  error: string | null;
}

export default function ElizaOSAdmin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('elizaos');
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    bufferedMessages: 0,
    capabilities: [],
  });
  
  const [logs, setLogs] = useState<ElizaLogEntry[]>([]);
  const [tradingMetrics, setTradingMetrics] = useState<TradingMetricsExtended>({
    pendingActions: 0,
  });
  
  const [serverUrl, setServerUrl] = useState('');
  const [agentId, setAgentId] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string; latencyMs?: number } | null>(null);
  const [logFilter, setLogFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'debug'>('all');

  const [pumpFunStatus, setPumpFunStatus] = useState<PumpFunStatus>({
    isConnected: false,
    tradeStats: { total: 0, successful: 0, failed: 0, pending: 0 },
  });
  const [pumpFunTrades, setPumpFunTrades] = useState<TradeLogEntry[]>([]);
  const [isConnectingPumpFun, setIsConnectingPumpFun] = useState(false);

  // Admin Trading Controls
  const [buyTokenAddress, setBuyTokenAddress] = useState('');
  const [buyAmountBnb, setBuyAmountBnb] = useState('0.1');
  const [sellTokenAddress, setSellTokenAddress] = useState('');
  const [sellPercent, setSellPercent] = useState('100');
  const [tweetContent, setTweetContent] = useState('');
  const [elizaCommand, setElizaCommand] = useState('');
  const [tradingActionResult, setTradingActionResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isExecutingAction, setIsExecutingAction] = useState(false);

  // Streaming states
  const [streamingRtmpUrl, setStreamingRtmpUrl] = useState('');
  const [streamingKey, setStreamingKey] = useState('');
  const [streamingStatus, setStreamingStatus] = useState<StreamingStatus>({
    isStreaming: false,
    startedAt: null,
    uptime: 0,
    error: null,
  });
  const [isStartingStream, setIsStartingStream] = useState(false);
  const [streamingLogs, setStreamingLogs] = useState<string[]>([]);
  const [isLive2DReady, setIsLive2DReady] = useState(false);
  const streamIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamTokenRef = useRef<string | null>(null);
  const streamingCanvasContainerRef = useRef<HTMLDivElement | null>(null);
  const captureRetryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isCapturingRef = useRef<boolean>(false);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compositeAnimationRef = useRef<number | null>(null);
  const backgroundImageRef = useRef<HTMLImageElement | HTMLVideoElement | null>(null);
  const avatarSyncUnsubscribeRef = useRef<(() => void) | null>(null);
  const avatarEmotionRef = useRef<string>('neutral');
  const audioManagerRef = useRef<{ disable: () => Promise<void>; isStreamingEnabled: () => boolean } | null>(null);
  const usingFallbackRef = useRef<boolean>(false);
  // Session ID to detect stale RAF callbacks from previous sessions
  const captureSessionIdRef = useRef<number>(0);
  // Separate RAF handle for JPEG fallback loop
  const jpegRafRef = useRef<number | null>(null);

  // X Drafts state
  const [xDrafts, setXDrafts] = useState<XDraft[]>([]);
  const [xDraftsLoading, setXDraftsLoading] = useState(false);
  const [newDraftText, setNewDraftText] = useState('');
  const [newDraftReplyId, setNewDraftReplyId] = useState('');
  const [draftActionLoading, setDraftActionLoading] = useState<number | null>(null);
  const [draftStatusFilter, setDraftStatusFilter] = useState<'all' | 'draft' | 'posted' | 'failed'>('all');

  const addLog = useCallback((level: ElizaLogEntry['level'], message: string, data?: Record<string, unknown>) => {
    setLogs(prev => [{
      timestamp: Date.now(),
      level,
      message,
      data,
    }, ...prev].slice(0, 100));
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthenticating(true);
    setAuthError('');

    try {
      // POST to /api/admin/session — on success the server sets an
      // HttpOnly cookie (`niya_admin_session`) that every subsequent admin
      // request carries automatically. The raw password never leaves this
      // handler, and in particular never touches sessionStorage / localStorage.
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setIsAuthenticated(true);
        // UX-only hint so reloading the tab keeps the authenticated view.
        // The cookie is the source of truth for authorization; this flag
        // holds no secrets and is safe to drop on 401.
        sessionStorage.setItem('elizaos_admin_auth', 'true');
        // Clear the password out of React state immediately — we want zero
        // copies of it lying around.
        setPassword('');
      } else {
        setAuthError(data.error || 'Invalid password');
      }
    } catch {
      setAuthError('Authentication failed');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const updateStatus = useCallback(() => {
    const state = elizaOSBridge.getState();
    setConnectionStatus({
      isConnected: state.isConnected,
      serverUrl: state.serverUrl,
      lastHeartbeat: state.lastHeartbeat,
      connectionError: state.connectionError,
      bufferedMessages: elizaOSBridge.getBufferedMessageCount(),
      capabilities: state.capabilities,
    });
    
    setTradingMetrics(prev => ({
      ...prev,
      pendingActions: elizaOSBridge.getPendingActions().length,
    }));
  }, []);

  const fetchPumpFunStatus = useCallback(async () => {
    try {
      const [statusRes, tradesRes] = await Promise.all([
        fetch('/api/pumpfun/status'),
        fetch('/api/pumpfun/trades'),
      ]);
      
      if (statusRes.ok) {
        const statusData = await statusRes.json();
        setPumpFunStatus({
          isConnected: statusData.isConnected,
          tradeStats: statusData.tradeStats,
        });
      }
      
      if (tradesRes.ok) {
        const tradesData = await tradesRes.json();
        setPumpFunTrades(tradesData.trades || []);
      }
    } catch (e) {
      console.error('[Admin] Failed to fetch PumpFun status:', e);
    }
  }, []);

  // X Drafts functions
  const fetchXDrafts = useCallback(async () => {
    setXDraftsLoading(true);
    try {
      const statusParam = draftStatusFilter === 'all' ? '' : `?status=${draftStatusFilter}`;
      // TODO(Phase1.2): migrate server endpoints to verifyAdminSession.
      // For now we rely on the HttpOnly `niya_admin_session` cookie being
      // sent automatically; the old `x-admin-auth` header is gone.
      const res = await fetch(`/api/x/drafts${statusParam}`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setXDrafts(data.data?.drafts || []);
      } else {
        const error = await res.json();
        addLog('error', `Failed to fetch X drafts: ${error.error}`);
      }
    } catch (e) {
      console.error('[Admin] Failed to fetch X drafts:', e);
      addLog('error', `Failed to fetch X drafts: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setXDraftsLoading(false);
    }
  }, [draftStatusFilter, addLog]);

  const createXDraft = async () => {
    if (!newDraftText.trim()) return;
    
    setDraftActionLoading(-1);
    try {
      // TODO(Phase1.2): migrate server endpoints to verifyAdminSession.
      const res = await fetch('/api/x/drafts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text: newDraftText.trim(),
          replyToTweetId: newDraftReplyId.trim() || null,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        addLog('info', 'X draft created successfully');
        setNewDraftText('');
        setNewDraftReplyId('');
        await fetchXDrafts();
      } else {
        addLog('error', `Failed to create X draft: ${data.error}`);
      }
    } catch (e) {
      addLog('error', `Failed to create X draft: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setDraftActionLoading(null);
    }
  };

  const approveXDraft = async (id: number) => {
    setDraftActionLoading(id);
    try {
      // TODO(Phase1.2): migrate server endpoints to verifyAdminSession.
      const res = await fetch(`/api/x/drafts/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (data.success) {
        addLog('info', `Tweet posted successfully: ${data.data.tweetUrl}`);
        await fetchXDrafts();
      } else {
        addLog('error', `Failed to approve draft: ${data.error}`);
      }
    } catch (e) {
      addLog('error', `Failed to approve draft: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setDraftActionLoading(null);
    }
  };

  const deleteXDraft = async (id: number) => {
    setDraftActionLoading(id);
    try {
      // TODO(Phase1.2): migrate server endpoints to verifyAdminSession.
      const res = await fetch(`/api/x/drafts/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      const data = await res.json();
      
      if (data.success) {
        addLog('info', 'Draft deleted');
        await fetchXDrafts();
      } else {
        addLog('error', `Failed to delete draft: ${data.error}`);
      }
    } catch (e) {
      addLog('error', `Failed to delete draft: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setDraftActionLoading(null);
    }
  };

  const handlePumpFunConnect = async (action: 'connect' | 'disconnect') => {
    setIsConnectingPumpFun(true);
    try {
      const res = await fetch('/api/pumpfun/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        addLog('info', `PumpFun ${action === 'connect' ? 'connected' : 'disconnected'}`);
        await fetchPumpFunStatus();
      } else {
        addLog('error', `PumpFun ${action} failed: ${data.error}`);
      }
    } catch (e) {
      addLog('error', `PumpFun ${action} error: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setIsConnectingPumpFun(false);
    }
  };

  const handleTestConnection = async () => {
    if (!serverUrl) return;
    
    setIsTestingConnection(true);
    setTestResult(null);
    addLog('info', `Testing connection to ${serverUrl}...`);
    
    try {
      const result = await elizaOSBridge.testConnection(serverUrl);
      setTestResult(result);
      
      if (result.success) {
        addLog('info', `Connection successful! Latency: ${result.latencyMs}ms`);
      } else {
        addLog('error', `Connection failed: ${result.error}`);
      }
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setTestResult({ success: false, error });
      addLog('error', `Connection test error: ${error}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleConnect = async () => {
    if (!serverUrl) return;
    
    addLog('info', `Connecting to ${serverUrl} with agent ${agentId || 'default'}...`);
    
    await updateConfig('elizaos_url', serverUrl);
    if (agentId) {
      await updateConfig('elizaos_agent_id', agentId);
    }
    
    elizaOSBridge.initialize({
      url: serverUrl,
      agentId: agentId || undefined,
    });
    elizaOSBridge.connect();
  };

  const handleDisconnect = () => {
    addLog('info', 'Disconnecting...');
    elizaOSBridge.disconnect();
    updateStatus();
  };

  const executeAdminAction = async (action: string, data: Record<string, any>) => {
    setIsExecutingAction(true);
    setTradingActionResult(null);
    
    try {
      // TODO(Phase1.2): migrate server endpoints to verifyAdminSession.
      const response = await fetch('/api/admin-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, data }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setTradingActionResult({ success: true, message: JSON.stringify(result.data, null, 2) });
        addLog('info', `Admin action ${action} completed`, result.data);
      } else {
        setTradingActionResult({ success: false, message: result.error || 'Action failed' });
        addLog('error', `Admin action ${action} failed`, { error: result.error });
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setTradingActionResult({ success: false, message: errorMsg });
      addLog('error', `Admin action ${action} error`, { error: errorMsg });
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleBuyToken = async () => {
    if (!buyTokenAddress || !buyAmountBnb) return;
    setIsExecutingAction(true);
    setTradingActionResult(null);
    
    try {
      // TODO(Phase1.2): migrate server endpoints to verifyAdminSession.
      const response = await fetch('/api/admin/bnb-trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'buy',
          tokenAddress: buyTokenAddress,
          amount: parseFloat(buyAmountBnb),
          slippageBps: 100,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setTradingActionResult({ success: true, message: `Buy prepared: ${result.data.message}\n${JSON.stringify(result.data.transaction, null, 2)}` });
        addLog('info', 'BNB buy transaction prepared', result.data);
      } else {
        setTradingActionResult({ success: false, message: result.error || 'Buy failed' });
        addLog('error', 'BNB buy failed', { error: result.error });
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setTradingActionResult({ success: false, message: errorMsg });
      addLog('error', 'BNB buy error', { error: errorMsg });
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handleSellToken = async () => {
    if (!sellTokenAddress) return;
    setIsExecutingAction(true);
    setTradingActionResult(null);
    
    try {
      // TODO(Phase1.2): migrate server endpoints to verifyAdminSession.
      const response = await fetch('/api/admin/bnb-trade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'sell',
          tokenAddress: sellTokenAddress,
          tokenAmount: (BigInt(sellPercent) * BigInt('1000000000000000000') / BigInt(100)).toString(),
          slippageBps: 100,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setTradingActionResult({ success: true, message: `Sell prepared: ${result.data.message}\n${JSON.stringify(result.data.transaction, null, 2)}` });
        addLog('info', 'BNB sell transaction prepared', result.data);
      } else {
        setTradingActionResult({ success: false, message: result.error || 'Sell failed' });
        addLog('error', 'BNB sell failed', { error: result.error });
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      setTradingActionResult({ success: false, message: errorMsg });
      addLog('error', 'BNB sell error', { error: errorMsg });
    } finally {
      setIsExecutingAction(false);
    }
  };

  const handlePostTweet = () => {
    if (!tweetContent) return;
    executeAdminAction('post_tweet', { content: tweetContent });
  };

  const handleSendElizaCommand = () => {
    if (!elizaCommand) return;
    executeAdminAction('send_elizaos_command', { command: elizaCommand });
  };

  // Streaming functions
  const addStreamingLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setStreamingLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 50));
  }, []);

  const saveStreamingSettings = async () => {
    await updateConfig('streaming_rtmp_url', streamingRtmpUrl);
    await updateConfig('streaming_key', streamingKey);
    addStreamingLog('Settings saved');
  };

  const captureCanvas = useCallback(async () => {
    // Prevent concurrent capture attempts
    if (isCapturingRef.current) {
      addStreamingLog('Capture already in progress, skipping...');
      return;
    }
    
    // Clear any pending retry timer
    if (captureRetryTimerRef.current) {
      clearTimeout(captureRetryTimerRef.current);
      captureRetryTimerRef.current = null;
    }
    
    // CRITICAL: Cancel any lingering RAF handles from previous sessions
    // Cancel MediaRecorder loop handle
    if (compositeAnimationRef.current) {
      cancelAnimationFrame(compositeAnimationRef.current);
      compositeAnimationRef.current = null;
    }
    // Cancel JPEG fallback loop handle (separate tracking)
    if (jpegRafRef.current) {
      cancelAnimationFrame(jpegRafRef.current);
      jpegRafRef.current = null;
    }
    
    // Increment session ID to invalidate any pending RAF callbacks from previous sessions
    captureSessionIdRef.current++;
    const currentSessionId = captureSessionIdRef.current;
    
    // Reset fallback flag
    usingFallbackRef.current = false;
    
    isCapturingRef.current = true;
    
    // Find the canvas inside our streaming container
    const container = streamingCanvasContainerRef.current;
    if (!container) {
      addStreamingLog('Streaming container not found');
      isCapturingRef.current = false;
      return;
    }

    // Wait a moment for Live2D to render
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Select the active Live2D canvas (not the hidden placeholder)
    const live2dCanvas = container.querySelector('canvas[data-live2d="active"]') as HTMLCanvasElement;
    if (!live2dCanvas) {
      console.log('[Streaming] No active Live2D canvas found, retrying...');
      addStreamingLog('No active Live2D canvas found - waiting for model to load...');
      isCapturingRef.current = false;
      // Retry after a delay
      captureRetryTimerRef.current = setTimeout(() => captureCanvas(), 1500);
      return;
    }

    console.log('[Streaming] Live2D canvas found:', live2dCanvas.width, 'x', live2dCanvas.height);
    addStreamingLog(`Live2D canvas found: ${live2dCanvas.width}x${live2dCanvas.height}`);

    try {
      // Create HD composite canvas (1280x720)
      const STREAM_WIDTH = 1280;
      const STREAM_HEIGHT = 720;
      
      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = STREAM_WIDTH;
      compositeCanvas.height = STREAM_HEIGHT;
      // CRITICAL: Canvas must be visible AND at a reasonable display size for captureStream() to work
      // Some browsers optimize away rendering for very small canvases
      // Using 160x90 visible preview in bottom-right corner (hidden behind UI)
      compositeCanvas.style.cssText = 'position:fixed;bottom:10px;right:10px;width:160px;height:90px;pointer-events:none;z-index:9999;border:2px solid red;opacity:0.8;';
      compositeCanvas.id = 'streaming-composite-canvas';
      document.body.appendChild(compositeCanvas);
      compositeCanvasRef.current = compositeCanvas;
      console.log('[Streaming] Composite canvas added to DOM (160x90 visible preview)');
      
      const ctx = compositeCanvas.getContext('2d', { alpha: false });
      if (!ctx) {
        addStreamingLog('Error: Could not get composite canvas context');
        isCapturingRef.current = false;
        return;
      }
      
      // Load background from config
      let bgUrl = '';
      try {
        bgUrl = config('bg_url') || '/bg/chilling-cat-loop.mp4';
      } catch {
        bgUrl = '/bg/chilling-cat-loop.mp4';
      }
      
      addStreamingLog(`Loading background: ${bgUrl}`);
      console.log('[Streaming] Loading background:', bgUrl);
      
      // Fallback background color
      let bgColor = '#1a1a2e';
      try {
        const configBgColor = config('bg_color');
        if (configBgColor && configBgColor.startsWith('#')) {
          bgColor = configBgColor;
        }
      } catch {
        // Use default
      }
      
      // Determine if background is video or image
      const isVideoBg = bgUrl.match(/\.(mp4|webm|ogg)$/i);
      
      if (isVideoBg) {
        // Create hidden video element for background
        const bgVideo = document.createElement('video');
        bgVideo.src = bgUrl;
        bgVideo.crossOrigin = 'anonymous';
        bgVideo.loop = true;
        bgVideo.muted = true;
        bgVideo.playsInline = true;
        bgVideo.style.display = 'none';
        document.body.appendChild(bgVideo);
        
        try {
          // Wait for video metadata to load before using dimensions
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Video metadata timeout'));
            }, 10000);
            
            bgVideo.onloadedmetadata = () => {
              clearTimeout(timeout);
              addStreamingLog(`Video metadata loaded: ${bgVideo.videoWidth}x${bgVideo.videoHeight}`);
              resolve();
            };
            bgVideo.onerror = () => {
              clearTimeout(timeout);
              reject(new Error('Video load error'));
            };
            // Trigger load
            bgVideo.load();
          });
          
          // Now try to play (may fail due to autoplay policy)
          try {
            await bgVideo.play();
            backgroundImageRef.current = bgVideo;
            addStreamingLog('Background video loaded and playing');
            console.log('[Streaming] Background video playing');
          } catch (playError) {
            // Autoplay blocked - try muted play or use as static frame
            addStreamingLog(`Autoplay blocked, using static frame: ${playError instanceof Error ? playError.message : 'Unknown'}`);
            console.log('[Streaming] Autoplay blocked, using static frame');
            backgroundImageRef.current = bgVideo; // Still use it for drawing frames
          }
        } catch (e) {
          addStreamingLog(`Background video error: ${e instanceof Error ? e.message : 'Unknown'}`);
          console.error('[Streaming] Background video error:', e);
          // Cleanup failed video
          bgVideo.remove();
          backgroundImageRef.current = null;
        }
      } else if (bgUrl && !bgUrl.startsWith('#')) {
        // Load image background
        const bgImage = new Image();
        bgImage.crossOrigin = 'anonymous';
        
        await new Promise<void>((resolve) => {
          bgImage.onload = () => {
            backgroundImageRef.current = bgImage;
            addStreamingLog(`Background image loaded: ${bgImage.width}x${bgImage.height}`);
            resolve();
          };
          bgImage.onerror = () => {
            addStreamingLog('Background image failed to load, using fallback color');
            resolve();
          };
          bgImage.src = bgUrl;
        });
      }
      
      // Frame counter for debugging (renamed to avoid conflict with streaming frameCount)
      let renderFrameCount = 0;
      
      // Animation loop to composite background + Live2D avatar
      const renderComposite = () => {
        renderFrameCount++;
        
        // Log every 120 frames (~4 seconds at 30fps) to verify animation is running
        if (renderFrameCount === 1 || renderFrameCount % 120 === 0) {
          console.log(`[Streaming] Render frame #${renderFrameCount}, bg=${backgroundImageRef.current ? 'loaded' : 'null'}`);
        }
        
        // STEP 1: Clear and fill with fallback background color
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, STREAM_WIDTH, STREAM_HEIGHT);
        
        // STEP 2: Draw background image/video (if available) FIRST
        const bg = backgroundImageRef.current;
        if (bg) {
          try {
            const bgWidth = bg instanceof HTMLVideoElement ? bg.videoWidth : bg.width;
            const bgHeight = bg instanceof HTMLVideoElement ? bg.videoHeight : bg.height;
            
            if (bgWidth > 0 && bgHeight > 0) {
              const scale = Math.max(STREAM_WIDTH / bgWidth, STREAM_HEIGHT / bgHeight);
              const w = bgWidth * scale;
              const h = bgHeight * scale;
              const x = (STREAM_WIDTH - w) / 2;
              const y = (STREAM_HEIGHT - h) / 2;
              ctx.drawImage(bg, x, y, w, h);
            }
          } catch (e) {
            if (renderFrameCount === 1) {
              console.error('[Streaming] Background draw failed:', e);
            }
          }
        }
        
        // STEP 3: Draw Live2D avatar on top (centered horizontally, shifted down to show full body)
        try {
          if (live2dCanvas.width > 0 && live2dCanvas.height > 0) {
            const avatarScale = Math.min(STREAM_WIDTH / live2dCanvas.width, STREAM_HEIGHT / live2dCanvas.height) * 0.9;
            const avatarW = live2dCanvas.width * avatarScale;
            const avatarH = live2dCanvas.height * avatarScale;
            const avatarX = (STREAM_WIDTH - avatarW) / 2;
            // Shift avatar down slightly (8% of canvas height) to avoid leg cutoff
            const avatarY = (STREAM_HEIGHT - avatarH) / 2 + (STREAM_HEIGHT * 0.08);
            ctx.drawImage(live2dCanvas, avatarX, avatarY, avatarW, avatarH);
          }
        } catch {
          // Avatar draw failed
        }
        
        // STEP 4: Debug frame counter (bottom-left corner, always visible)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(5, STREAM_HEIGHT - 30, 150, 25);
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 14px monospace';
        ctx.fillText(`Frame: ${renderFrameCount}`, 10, STREAM_HEIGHT - 12);
        
        // NOTE: renderFrame does NOT call requestAnimationFrame itself
        // The loop is managed externally for proper frame capture
      };
      
      // SIMPLIFIED APPROACH: Direct JPEG frame capture (more reliable with WebGL canvas)
      // MediaRecorder + captureStream doesn't work reliably with Live2D WebGL canvas
      const FRAME_RATE = 24;
      let jpegFrameCount = 0;
      let jpegErrorCount = 0;
      let ffmpegDeadDetected = false;
      let lastJpegTime = 0;
      const JPEG_INTERVAL = 1000 / FRAME_RATE;
      
      addStreamingLog(`Starting JPEG capture: ${STREAM_WIDTH}x${STREAM_HEIGHT} @ ${FRAME_RATE}fps`);
      
      // Setup audio stream for TTS (audio will be sent separately or merged server-side)
      try {
        const { audioStreamManager } = await import('@/features/streaming/audioStreamManager');
        if (audioManagerRef.current && audioManagerRef.current.isStreamingEnabled()) {
          await audioManagerRef.current.disable();
        }
        const audioStream = audioStreamManager.enable();
        audioManagerRef.current = audioStreamManager;
        const audioTracks = audioStream.getAudioTracks();
        if (audioTracks.length > 0) {
          addStreamingLog(`Audio enabled: ${audioTracks[0].label || 'TTS audio'}`);
        }
      } catch (audioErr) {
        addStreamingLog(`Audio setup: ${audioErr instanceof Error ? audioErr.message : 'OK'}`);
      }
      
      // Combined render + capture loop
      const captureLoop = () => {
        // Check session validity
        if (captureSessionIdRef.current !== currentSessionId || !isCapturingRef.current || ffmpegDeadDetected) {
          jpegRafRef.current = null;
          return;
        }
        
        const now = performance.now();
        const elapsed = now - lastJpegTime;
        
        // Always render the composite (for preview)
        renderComposite();
        
        // Only capture and send at target frame rate
        if (elapsed >= JPEG_INTERVAL - 5) {
          lastJpegTime = now;
          
          // Capture JPEG and send to server
          compositeCanvas.toBlob(async (blob) => {
            if (!blob || !streamTokenRef.current || ffmpegDeadDetected || !isCapturingRef.current) return;
            if (captureSessionIdRef.current !== currentSessionId) return;
            
            jpegFrameCount++;
            if (jpegFrameCount === 1) {
              addStreamingLog(`First JPEG frame sent (${Math.round(blob.size / 1024)}KB)`);
              console.log('[Streaming] First JPEG frame captured and sent');
            } else if (jpegFrameCount % 60 === 0) {
              addStreamingLog(`JPEG frame #${jpegFrameCount} (${Math.round(blob.size / 1024)}KB)`);
            }
            
            try {
              const response = await fetch('/api/streaming/frame', {
                method: 'POST',
                headers: { 'X-Stream-Token': streamTokenRef.current! },
                body: blob,
              });
              
              if (!response.ok) {
                jpegErrorCount++;
                const err = await response.json().catch(() => ({ error: 'Unknown' }));
                if (err.ffmpegDead) {
                  ffmpegDeadDetected = true;
                  addStreamingLog(`FFmpeg FAILED: ${err.details || err.error}`);
                  setStreamingStatus(prev => ({ ...prev, error: err.details || err.error }));
                } else if (jpegErrorCount <= 5) {
                  addStreamingLog(`Frame error: ${err.error}`);
                }
              }
            } catch (e) {
              jpegErrorCount++;
              if (jpegErrorCount <= 5) {
                addStreamingLog(`Network error: ${e instanceof Error ? e.message : 'Unknown'}`);
              }
            }
          }, 'image/jpeg', 0.85);
        }
        
        // Schedule next frame
        if (isCapturingRef.current && !ffmpegDeadDetected && captureSessionIdRef.current === currentSessionId) {
          jpegRafRef.current = requestAnimationFrame(captureLoop);
        } else {
          jpegRafRef.current = null;
        }
      };
      
      // Start the capture loop
      jpegRafRef.current = requestAnimationFrame(captureLoop);
      addStreamingLog('JPEG capture loop started');

    } catch (e) {
      addStreamingLog(`Capture error: ${e instanceof Error ? e.message : 'Unknown'}`);
      
      // Clean up all resources on error to prevent leaks
      if (jpegRafRef.current) {
        cancelAnimationFrame(jpegRafRef.current);
        jpegRafRef.current = null;
      }
      
      // Cleanup background video if it exists
      if (backgroundImageRef.current instanceof HTMLVideoElement) {
        backgroundImageRef.current.pause();
        backgroundImageRef.current.remove();
      }
      backgroundImageRef.current = null;
      
      // Remove composite canvas from DOM on error
      if (compositeCanvasRef.current) {
        compositeCanvasRef.current.remove();
        compositeCanvasRef.current = null;
      }
      
      isCapturingRef.current = false;
    }
  }, [addStreamingLog]);

  const startStreaming = async () => {
    if (!streamingRtmpUrl || !streamingKey) {
      addStreamingLog('Error: RTMP URL and Stream Key are required');
      return;
    }

    setIsStartingStream(true);
    addStreamingLog('Starting stream...');

    try {
      await saveStreamingSettings();

      // TODO(Phase1.2): migrate server endpoints to verifyAdminSession.
      const res = await fetch('/api/streaming/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'start',
          rtmpUrl: streamingRtmpUrl,
          streamKey: streamingKey,
        }),
      });

      const data = await res.json();

      if (data.success) {
        addStreamingLog('Stream initialized on server');
        streamTokenRef.current = data.authToken;

        await captureCanvas();
        setStreamingStatus(prev => ({ ...prev, isStreaming: true }));
        
        // Start polling for FFmpeg status and errors every 3 seconds
        streamIntervalRef.current = setInterval(async () => {
          try {
            const statusRes = await fetch('/api/streaming/start', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'status' }),
            });
            const status = await statusRes.json();
            
            // Show FFmpeg logs if available
            if (status.ffmpegLogs && status.ffmpegLogs.length > 0) {
              const recentLogs = status.ffmpegLogs.slice(-5);
              recentLogs.forEach((log: string) => {
                // Only show important logs (errors, connection info)
                if (log.toLowerCase().includes('error') || 
                    log.toLowerCase().includes('failed') ||
                    log.toLowerCase().includes('frame=') ||
                    log.toLowerCase().includes('connection') ||
                    log.toLowerCase().includes('tls') ||
                    log.toLowerCase().includes('ssl')) {
                  addStreamingLog(`[FFmpeg] ${log.substring(0, 100)}`);
                }
              });
            }
            
            // Check if FFmpeg is alive
            if (status.ffmpegStarted) {
              addStreamingLog('FFmpeg connected and encoding frames');
              // Clear interval once connection is confirmed
              if (streamIntervalRef.current) {
                clearInterval(streamIntervalRef.current);
                streamIntervalRef.current = null;
              }
            }
            
            // Show errors
            if (status.error) {
              addStreamingLog(`FFmpeg Error: ${status.error}`);
              // Stop streaming on fatal error
              if (!status.ffmpegAlive && status.error) {
                addStreamingLog('FFmpeg process died - check logs above');
              }
            }
          } catch (e) {
            // Ignore polling errors
          }
        }, 3000);
      } else {
        addStreamingLog(`Error: ${data.error}`);
      }
    } catch (e) {
      addStreamingLog(`Failed to start: ${e instanceof Error ? e.message : 'Unknown'}`);
    } finally {
      setIsStartingStream(false);
    }
  };

  const stopStreaming = async () => {
    addStreamingLog('Stopping stream...');

    // Clear capture retry timer and reset capture state
    if (captureRetryTimerRef.current) {
      clearTimeout(captureRetryTimerRef.current);
      captureRetryTimerRef.current = null;
    }
    
    // CRITICAL: Increment session ID to immediately invalidate all pending RAF callbacks
    // Any callback that checks sessionId will see it has changed and exit
    captureSessionIdRef.current++;
    
    // Set flags false for additional safety
    isCapturingRef.current = false;
    usingFallbackRef.current = false;

    // Cancel any pending RAF handles (belt-and-suspenders with session ID)
    // Cancel MediaRecorder loop
    if (compositeAnimationRef.current) {
      cancelAnimationFrame(compositeAnimationRef.current);
      compositeAnimationRef.current = null;
    }
    // Cancel JPEG fallback loop (separate handle)
    if (jpegRafRef.current) {
      cancelAnimationFrame(jpegRafRef.current);
      jpegRafRef.current = null;
    }

    // Cleanup background video if it exists
    if (backgroundImageRef.current instanceof HTMLVideoElement) {
      backgroundImageRef.current.pause();
      backgroundImageRef.current.remove();
    }
    backgroundImageRef.current = null;
    
    // Remove composite canvas from DOM
    if (compositeCanvasRef.current) {
      compositeCanvasRef.current.remove();
      compositeCanvasRef.current = null;
    }
    // Also cleanup any orphaned canvas by ID
    const orphanedCanvas = document.getElementById('streaming-composite-canvas');
    if (orphanedCanvas) orphanedCanvas.remove();

    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }

    // Cleanup audio stream manager and WAIT for AudioContext to fully close
    if (audioManagerRef.current) {
      try {
        if (audioManagerRef.current.isStreamingEnabled()) {
          await audioManagerRef.current.disable();
          addStreamingLog('Audio streaming disabled');
        }
      } catch (e) {
        // Ignore cleanup errors
      }
      audioManagerRef.current = null;
    }
    
    // Unsubscribe from avatar state sync
    if (avatarSyncUnsubscribeRef.current) {
      avatarSyncUnsubscribeRef.current();
      avatarSyncUnsubscribeRef.current = null;
    }
    avatarEmotionRef.current = 'neutral';
    addStreamingLog('Avatar state sync disabled');

    try {
      // TODO(Phase1.2): migrate server endpoints to verifyAdminSession.
      await fetch('/api/streaming/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'stop' }),
      });

      streamTokenRef.current = null;
      setStreamingStatus({
        isStreaming: false,
        startedAt: null,
        uptime: 0,
        error: null,
      });
      addStreamingLog('Stream stopped');
    } catch (e) {
      addStreamingLog(`Stop error: ${e instanceof Error ? e.message : 'Unknown'}`);
    }
  };

  useEffect(() => {
    // Cookie is HttpOnly, so JS can't read it directly — we keep a
    // non-secret UX hint in sessionStorage to optimistically restore the
    // authenticated view on reload. If the cookie has actually expired,
    // subsequent admin requests will 401 and the Phase 1.2 migration will
    // knock the user back to the login screen.
    const savedAuth = sessionStorage.getItem('elizaos_admin_auth');
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
    
    const savedUrl = config('elizaos_url') || '';
    if (savedUrl) {
      setServerUrl(savedUrl);
    }
    
    const savedAgentId = config('elizaos_agent_id') || 'b6e1a7e7-ba41-068a-bc54-f4221638a4d8';
    if (savedAgentId) {
      setAgentId(savedAgentId);
    }

    // Load streaming settings
    try {
      setStreamingRtmpUrl(config('streaming_rtmp_url') || '');
      setStreamingKey(config('streaming_key') || '');
    } catch {
      // Config keys may not exist yet
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    updateStatus();
    fetchPumpFunStatus();
    
    // Check streaming status
    const checkStreamingStatus = async () => {
      try {
        const res = await fetch('/api/streaming/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'status' }),
        });
        const data = await res.json();
        setStreamingStatus(data);
      } catch {
        // Ignore errors
      }
    };
    checkStreamingStatus();

    const interval = setInterval(() => {
      updateStatus();
      if (activeTab === 'pumpfun') {
        fetchPumpFunStatus();
      }
      if (activeTab === 'streaming') {
        checkStreamingStatus();
      }
      if (activeTab === 'xdrafts') {
        fetchXDrafts();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, updateStatus, fetchPumpFunStatus, fetchXDrafts, activeTab]);

  useEffect(() => {
    if (!isAuthenticated) return;
    
    const existingLogs = elizaOSBridge.getLogs();
    if (existingLogs.length > 0) {
      setLogs(existingLogs);
    }
    
    const unsubLog = elizaOSBridge.onLog((log) => {
      setLogs(prev => [log, ...prev].slice(0, 100));
    });
    
    const unsubMetrics = elizaOSBridge.onMetrics((metrics: ElizaTradingMetrics) => {
      setTradingMetrics(prev => ({
        ...prev,
        ...metrics,
      }));
    });
    
    return () => {
      unsubLog();
      unsubMetrics();
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <>
        <Head>
          <title>Autonomy Admin - Authentication</title>
        </Head>
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg p-8 w-full max-w-md">
            <h1 className="text-2xl font-bold text-white mb-6 text-center">Autonomy Dashboard</h1>
            <p className="text-gray-400 text-center mb-6 text-sm">ElizaOS + PumpFun Trading</p>
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                  Admin Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter admin password"
                  data-testid="input-admin-password"
                />
              </div>
              {authError && (
                <p className="text-red-400 text-sm" data-testid="text-auth-error">{authError}</p>
              )}
              <button
                type="submit"
                disabled={isAuthenticating || !password}
                className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                data-testid="button-login"
              >
                {isAuthenticating ? 'Authenticating...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Autonomy Dashboard - ElizaOS + PumpFun</title>
      </Head>
      <div className="min-h-screen bg-gray-900 text-white p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Autonomy Dashboard</h1>
              <p className="text-gray-400 text-sm">ElizaOS + PumpFun Trading Control</p>
            </div>
            <button
              onClick={async () => {
                try {
                  // Invalidate the server session and clear the cookie.
                  await fetch('/api/admin/session', {
                    method: 'DELETE',
                    credentials: 'include',
                  });
                } catch {
                  // Network error during logout is non-fatal — we still
                  // clear local state below.
                }
                sessionStorage.removeItem('elizaos_admin_auth');
                setIsAuthenticated(false);
                setPassword('');
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
              data-testid="button-logout"
            >
              Logout
            </button>
          </header>

          <div className="flex gap-2 border-b border-gray-700 pb-2">
            <button
              onClick={() => setActiveTab('elizaos')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === 'elizaos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              data-testid="tab-elizaos"
            >
              ElizaOS
              <span className={`ml-2 w-2 h-2 rounded-full inline-block ${connectionStatus.isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            </button>
            <button
              onClick={() => setActiveTab('pumpfun')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === 'pumpfun'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              data-testid="tab-pumpfun"
            >
              PumpFun Trading
              <span className={`ml-2 w-2 h-2 rounded-full inline-block ${pumpFunStatus.isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            </button>
            <button
              onClick={() => setActiveTab('trading')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === 'trading'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              data-testid="tab-trading"
            >
              Admin Trading
            </button>
            <button
              onClick={() => setActiveTab('streaming')}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === 'streaming'
                  ? 'bg-amber-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              data-testid="tab-streaming"
            >
              Streaming
              <span className={`ml-2 w-2 h-2 rounded-full inline-block ${streamingStatus.isStreaming ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
            </button>
            <button
              onClick={() => { setActiveTab('xdrafts'); fetchXDrafts(); }}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === 'xdrafts'
                  ? 'bg-sky-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              data-testid="tab-xdrafts"
            >
              X Drafts
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${xDrafts.filter(d => d.status === 'draft').length > 0 ? 'bg-sky-400 text-white' : 'bg-gray-600 text-gray-300'}`}>
                {xDrafts.filter(d => d.status === 'draft').length}
              </span>
            </button>
          </div>

          {activeTab === 'elizaos' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Railway ElizaOS Connection</h2>
                  
                  <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded-lg text-sm text-blue-200">
                    <p className="font-medium mb-1">Railway Setup Required:</p>
                    <p>Add <code className="bg-blue-900/50 px-1 rounded">CORS_ORIGIN=https://replit.app,https://replit.com</code> to Railway variables</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Server URL</label>
                      <div className="flex gap-4">
                        <input
                          type="text"
                          value={serverUrl}
                          onChange={(e) => setServerUrl(e.target.value)}
                          placeholder="https://your-elizaos-server.railway.app"
                          className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          data-testid="input-server-url"
                        />
                        <button
                          onClick={handleTestConnection}
                          disabled={isTestingConnection || !serverUrl}
                          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 rounded-lg font-medium"
                          data-testid="button-test-connection"
                        >
                          {isTestingConnection ? 'Testing...' : 'Test'}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Agent ID</label>
                      <input
                        type="text"
                        value={agentId}
                        onChange={(e) => setAgentId(e.target.value)}
                        placeholder="b6e1a7e7-ba41-068a-bc54-f4221638a4d8"
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                        data-testid="input-agent-id"
                      />
                      <p className="text-xs text-gray-500 mt-1">Find this in your ElizaOS character config or Railway logs</p>
                    </div>
                    
                    {testResult && (
                      <div className={`p-3 rounded-lg ${testResult.success ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`} data-testid="text-test-result">
                        {testResult.success 
                          ? `Server reachable! Latency: ${testResult.latencyMs}ms`
                          : `Failed: ${testResult.error}`
                        }
                      </div>
                    )}
                    
                    <div className="flex gap-4">
                      {!connectionStatus.isConnected ? (
                        <button
                          onClick={handleConnect}
                          disabled={!serverUrl}
                          className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-medium"
                          data-testid="button-connect"
                        >
                          Connect to Agent
                        </button>
                      ) : (
                        <button
                          onClick={handleDisconnect}
                          className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium"
                          data-testid="button-disconnect"
                        >
                          Disconnect
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Logs</h2>
                    <div className="flex gap-1">
                      {(['all', 'info', 'warn', 'error', 'debug'] as const).map((level) => (
                        <button
                          key={level}
                          onClick={() => setLogFilter(level)}
                          className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                            logFilter === level
                              ? level === 'error' ? 'bg-red-600 text-white' :
                                level === 'warn' ? 'bg-yellow-600 text-white' :
                                level === 'debug' ? 'bg-purple-600 text-white' :
                                level === 'info' ? 'bg-blue-600 text-white' :
                                'bg-gray-600 text-white'
                              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                          data-testid={`button-filter-${level}`}
                        >
                          {level.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4 h-80 overflow-y-auto font-mono text-sm" data-testid="container-logs">
                    {logs.filter(log => logFilter === 'all' || log.level === logFilter).length === 0 ? (
                      <p className="text-gray-500">No logs yet...</p>
                    ) : (
                      logs
                        .filter(log => logFilter === 'all' || log.level === logFilter)
                        .map((log, i) => (
                          <div key={i} className="py-1 border-b border-gray-800">
                            <span className="text-gray-500">
                              {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                              log.level === 'error' ? 'bg-red-900 text-red-300' :
                              log.level === 'warn' ? 'bg-yellow-900 text-yellow-300' :
                              log.level === 'debug' ? 'bg-purple-900 text-purple-300' :
                              'bg-blue-900 text-blue-300'
                            }`}>
                              {log.level.toUpperCase()}
                            </span>
                            <span className="ml-2 text-gray-300">{log.message}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Status</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Connection</span>
                      <span className={`flex items-center gap-2 ${connectionStatus.isConnected ? 'text-green-400' : 'text-red-400'}`} data-testid="text-connection-status">
                        <span className={`w-2 h-2 rounded-full ${connectionStatus.isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                        {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Server URL</span>
                      <span className="text-gray-300 text-sm truncate max-w-[150px]" title={connectionStatus.serverUrl} data-testid="text-server-url">
                        {connectionStatus.serverUrl || 'N/A'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Last Heartbeat</span>
                      <span className="text-gray-300" data-testid="text-last-heartbeat">
                        {connectionStatus.lastHeartbeat 
                          ? `${Math.round((Date.now() - connectionStatus.lastHeartbeat) / 1000)}s ago`
                          : 'N/A'
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Buffered Messages</span>
                      <span className={`${connectionStatus.bufferedMessages > 0 ? 'text-yellow-400' : 'text-gray-300'}`} data-testid="text-buffered-messages">
                        {connectionStatus.bufferedMessages}
                      </span>
                    </div>
                    
                    {connectionStatus.connectionError && (
                      <div className="p-3 bg-red-900/50 rounded-lg text-red-300 text-sm" data-testid="text-connection-error">
                        {connectionStatus.connectionError}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Capabilities</h2>
                  <div className="flex flex-wrap gap-2" data-testid="container-capabilities">
                    {connectionStatus.capabilities.length === 0 ? (
                      <span className="text-gray-500">None detected</span>
                    ) : (
                      connectionStatus.capabilities.map((cap, i) => (
                        <span key={i} className="px-3 py-1 bg-blue-900/50 text-blue-300 rounded-full text-sm">
                          {cap}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Trading</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Wallet</span>
                      <span className="text-gray-300 text-sm truncate max-w-[120px]" title={tradingMetrics.walletAddress} data-testid="text-wallet-address">
                        {tradingMetrics.walletAddress 
                          ? `${tradingMetrics.walletAddress.slice(0, 4)}...${tradingMetrics.walletAddress.slice(-4)}`
                          : 'Not connected'
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">BNB Balance</span>
                      <span className="text-gray-300" data-testid="text-bnb-balance">
                        {tradingMetrics.bnbBalance !== undefined 
                          ? `${tradingMetrics.bnbBalance.toFixed(4)} BNB`
                          : 'N/A'
                        }
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Pending Actions</span>
                      <span className={`${tradingMetrics.pendingActions > 0 ? 'text-yellow-400' : 'text-gray-300'}`} data-testid="text-pending-actions">
                        {tradingMetrics.pendingActions}
                      </span>
                    </div>
                    
                    {tradingMetrics.lastSwap && (
                      <div className="p-3 bg-gray-700 rounded-lg text-sm">
                        <p className="text-gray-400">Last Swap</p>
                        <p className="text-gray-200">
                          {tradingMetrics.lastSwap.amount} {tradingMetrics.lastSwap.inputToken} → {tradingMetrics.lastSwap.outputToken}
                        </p>
                        <p className="text-gray-500 text-xs">
                          {new Date(tradingMetrics.lastSwap.timestamp).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pumpfun' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">PumpPortal WebSocket</h2>
                  
                  <div className="mb-4 p-3 bg-purple-900/30 border border-purple-700 rounded-lg text-sm text-purple-200">
                    <p className="font-medium mb-1">Connection Info:</p>
                    <p>REST: <code className="bg-purple-900/50 px-1 rounded">https://pumpportal.fun/api</code></p>
                    <p>WebSocket: <code className="bg-purple-900/50 px-1 rounded">wss://pumpportal.fun/api/data</code></p>
                  </div>
                  
                  <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-sm text-yellow-200">
                    <p className="font-medium mb-1">Development Mode Only:</p>
                    <p>WebSocket connection state is in-memory. For production, use ElizaOS on Railway.</p>
                  </div>
                  
                  <div className="flex gap-4">
                    {!pumpFunStatus.isConnected ? (
                      <button
                        onClick={() => handlePumpFunConnect('connect')}
                        disabled={isConnectingPumpFun}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 rounded-lg font-medium"
                        data-testid="button-pumpfun-connect"
                      >
                        {isConnectingPumpFun ? 'Connecting...' : 'Connect to PumpFun'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handlePumpFunConnect('disconnect')}
                        disabled={isConnectingPumpFun}
                        className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg font-medium"
                        data-testid="button-pumpfun-disconnect"
                      >
                        {isConnectingPumpFun ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Trade History</h2>
                  <div className="bg-gray-900 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-800">
                        <tr>
                          <th className="text-left p-3 text-gray-400">Time</th>
                          <th className="text-left p-3 text-gray-400">Type</th>
                          <th className="text-left p-3 text-gray-400">Token</th>
                          <th className="text-right p-3 text-gray-400">Amount</th>
                          <th className="text-center p-3 text-gray-400">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pumpFunTrades.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-gray-500">
                              No trades yet...
                            </td>
                          </tr>
                        ) : (
                          pumpFunTrades.slice(0, 20).map((trade) => (
                            <tr key={trade.id} className="border-t border-gray-800">
                              <td className="p-3 text-gray-300">
                                {new Date(trade.timestamp).toLocaleTimeString()}
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  trade.type === 'buy' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                                }`}>
                                  {trade.type.toUpperCase()}
                                </span>
                              </td>
                              <td className="p-3 text-gray-300 font-mono">
                                {trade.mint.slice(0, 8)}...
                              </td>
                              <td className="p-3 text-right text-gray-300">
                                {trade.amount} SOL
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  trade.status === 'success' ? 'bg-green-900 text-green-300' :
                                  trade.status === 'failed' ? 'bg-red-900 text-red-300' :
                                  'bg-yellow-900 text-yellow-300'
                                }`}>
                                  {trade.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">WebSocket</span>
                      <span className={`flex items-center gap-2 ${pumpFunStatus.isConnected ? 'text-green-400' : 'text-red-400'}`}>
                        <span className={`w-2 h-2 rounded-full ${pumpFunStatus.isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
                        {pumpFunStatus.isConnected ? 'Connected' : 'Disconnected'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Trade Statistics</h2>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Total Trades</span>
                      <span className="text-gray-300 font-bold">{pumpFunStatus.tradeStats.total}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Successful</span>
                      <span className="text-green-400 font-bold">{pumpFunStatus.tradeStats.successful}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Failed</span>
                      <span className="text-red-400 font-bold">{pumpFunStatus.tradeStats.failed}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400">Pending</span>
                      <span className="text-yellow-400 font-bold">{pumpFunStatus.tradeStats.pending}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">How It Works</h2>
                  <div className="text-sm text-gray-400 space-y-2">
                    <p>PumpFun trading is handled via PumpPortal API:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-500">
                      <li>WebSocket for real-time token events</li>
                      <li>REST API for quotes and swaps</li>
                      <li>Circuit breaker protects against failures</li>
                      <li>ElizaOS can trigger trades autonomously</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trading' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Buy Token</h2>
                  <p className="text-sm text-gray-400 mb-4">Send a buy command to ElizaOS. Requires configured wallet.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Token Address (Mint)</label>
                      <input
                        type="text"
                        value={buyTokenAddress}
                        onChange={(e) => setBuyTokenAddress(e.target.value)}
                        placeholder="Token mint address..."
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 font-mono text-sm"
                        data-testid="input-buy-token"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Amount (BNB)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={buyAmountBnb}
                        onChange={(e) => setBuyAmountBnb(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        data-testid="input-buy-amount"
                      />
                    </div>
                    <button
                      onClick={handleBuyToken}
                      disabled={isExecutingAction || !buyTokenAddress || !buyAmountBnb}
                      className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium rounded-lg"
                      data-testid="button-buy-token"
                    >
                      {isExecutingAction ? 'Sending...' : 'Buy on BNB Chain'}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Sell Token</h2>
                  <p className="text-sm text-gray-400 mb-4">Send a sell command to ElizaOS.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Token Address (Mint)</label>
                      <input
                        type="text"
                        value={sellTokenAddress}
                        onChange={(e) => setSellTokenAddress(e.target.value)}
                        placeholder="Token mint address..."
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-sm"
                        data-testid="input-sell-token"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Sell Percentage</label>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        max="100"
                        value={sellPercent}
                        onChange={(e) => setSellPercent(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        data-testid="input-sell-percent"
                      />
                    </div>
                    <button
                      onClick={handleSellToken}
                      disabled={isExecutingAction || !sellTokenAddress}
                      className="w-full py-2 px-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-medium rounded-lg"
                      data-testid="button-sell-token"
                    >
                      {isExecutingAction ? 'Sending...' : 'Send Sell Command'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Post Tweet</h2>
                  <p className="text-sm text-gray-400 mb-4">Send a tweet via ElizaOS Twitter integration.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Tweet Content</label>
                      <textarea
                        value={tweetContent}
                        onChange={(e) => setTweetContent(e.target.value)}
                        placeholder="What's happening?"
                        rows={3}
                        maxLength={280}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        data-testid="input-tweet-content"
                      />
                      <p className="text-xs text-gray-500 mt-1">{tweetContent.length}/280 characters</p>
                    </div>
                    <button
                      onClick={handlePostTweet}
                      disabled={isExecutingAction || !tweetContent}
                      className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium rounded-lg"
                      data-testid="button-post-tweet"
                    >
                      {isExecutingAction ? 'Sending...' : 'Post Tweet'}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">ElizaOS Command</h2>
                  <p className="text-sm text-gray-400 mb-4">Send a raw command to ElizaOS agent.</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-1">Command</label>
                      <textarea
                        value={elizaCommand}
                        onChange={(e) => setElizaCommand(e.target.value)}
                        placeholder="Enter command for ElizaOS..."
                        rows={2}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none font-mono text-sm"
                        data-testid="input-eliza-command"
                      />
                    </div>
                    <button
                      onClick={handleSendElizaCommand}
                      disabled={isExecutingAction || !elizaCommand}
                      className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-medium rounded-lg"
                      data-testid="button-send-command"
                    >
                      {isExecutingAction ? 'Sending...' : 'Send Command'}
                    </button>
                  </div>
                </div>

                {tradingActionResult && (
                  <div className={`bg-gray-800 rounded-lg p-6 ${tradingActionResult.success ? 'border border-green-600' : 'border border-red-600'}`}>
                    <h2 className="text-xl font-semibold mb-4">{tradingActionResult.success ? 'Result' : 'Error'}</h2>
                    <pre className={`text-sm p-3 rounded-lg overflow-auto max-h-40 ${tradingActionResult.success ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'}`} data-testid="text-action-result">
                      {tradingActionResult.message}
                    </pre>
                  </div>
                )}

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Security Notice</h2>
                  <div className="text-sm text-gray-400 space-y-2">
                    <p className="text-yellow-400 font-medium">Admin-only actions:</p>
                    <ul className="list-disc list-inside space-y-1 text-gray-500">
                      <li>Buy/Sell commands require ElizaOS wallet configured</li>
                      <li>Tweets require Twitter API credentials in ElizaOS</li>
                      <li>All actions are logged for audit purposes</li>
                      <li>Public users cannot access these controls</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'streaming' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-6">
                {/* Live2D Avatar Preview for Streaming */}
                <div className="bg-gray-800 rounded-lg p-4">
                  <h2 className="text-xl font-semibold mb-3">Avatar Preview</h2>
                  <div 
                    ref={streamingCanvasContainerRef}
                    className="relative w-full aspect-video bg-gradient-to-b from-gray-900 to-gray-950 rounded-lg overflow-hidden border border-gray-700"
                    style={{ minHeight: '300px' }}
                    data-testid="container-streaming-avatar"
                  >
                    <Live2DViewer 
                      embeddedMode={true}
                      onModelLoaded={() => {
                        setIsLive2DReady(true);
                        addStreamingLog('Live2D avatar loaded and ready for streaming');
                      }}
                      onError={(err) => {
                        addStreamingLog(`Live2D error: ${err.message}`);
                      }}
                    />
                    {!isLive2DReady && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <p className="text-gray-400 text-sm">Loading avatar...</p>
                      </div>
                    )}
                    {streamingStatus.isStreaming && (
                      <div className="absolute top-2 left-2 flex items-center gap-2 bg-red-600 px-2 py-1 rounded text-xs font-bold">
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        LIVE
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">This avatar will be streamed to your RTMP destination</p>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">RTMP Configuration</h2>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">RTMP URL</label>
                      <input
                        type="text"
                        value={streamingRtmpUrl}
                        onChange={(e) => setStreamingRtmpUrl(e.target.value)}
                        placeholder="rtmps://pump-prod-xxx.rtmp.live..."
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500 font-mono text-sm"
                        data-testid="input-rtmp-url"
                      />
                      <p className="text-xs text-gray-500 mt-1">Get this from PumpFun Live or Twitch/YouTube</p>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Stream Key</label>
                      <input
                        type="password"
                        value={streamingKey}
                        onChange={(e) => setStreamingKey(e.target.value)}
                        placeholder="Your stream key"
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500 font-mono text-sm"
                        data-testid="input-stream-key"
                      />
                      <p className="text-xs text-gray-500 mt-1">Keep this secret - never share it</p>
                    </div>

                    <button
                      onClick={saveStreamingSettings}
                      className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg py-2 font-medium"
                      data-testid="button-save-stream-settings"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Stream Control</h2>

                  <div className="flex items-center gap-4 mb-4">
                    <span className={`flex items-center gap-2 ${streamingStatus.isStreaming ? 'text-green-400' : 'text-gray-400'}`}>
                      <span className={`w-3 h-3 rounded-full ${streamingStatus.isStreaming ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`} />
                      {streamingStatus.isStreaming ? 'LIVE' : 'Offline'}
                    </span>
                    {streamingStatus.isStreaming && (
                      <span className="text-gray-400 text-sm" data-testid="text-stream-uptime">
                        Uptime: {Math.floor((streamingStatus.uptime || 0) / 60)}m {(streamingStatus.uptime || 0) % 60}s
                      </span>
                    )}
                  </div>
                  
                  {!streamingStatus.isStreaming ? (
                    <button
                      onClick={startStreaming}
                      disabled={isStartingStream || !streamingRtmpUrl || !streamingKey}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded-lg py-3 font-bold text-lg"
                      data-testid="button-go-live"
                    >
                      {isStartingStream ? 'Starting...' : 'Go Live'}
                    </button>
                  ) : (
                    <button
                      onClick={stopStreaming}
                      className="w-full bg-gray-600 hover:bg-gray-500 rounded-lg py-3 font-bold text-lg"
                      data-testid="button-stop-stream"
                    >
                      Stop Streaming
                    </button>
                  )}

                  {streamingStatus.error && (
                    <p className="text-red-400 text-sm mt-2" data-testid="text-stream-error">
                      Error: {streamingStatus.error}
                    </p>
                  )}
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Platforms</h2>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-purple-900/30 rounded-lg border border-purple-700">
                      <div>
                        <p className="font-medium">PumpFun Live</p>
                        <p className="text-xs text-gray-400">Stream to your token</p>
                      </div>
                      <a 
                        href="https://pump.fun" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 text-sm"
                      >
                        Get RTMP
                      </a>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-purple-900/30 rounded-lg border border-purple-700">
                      <div>
                        <p className="font-medium">Twitch</p>
                        <p className="text-xs text-gray-400">Traditional streaming</p>
                      </div>
                      <a 
                        href="https://dashboard.twitch.tv/settings/stream" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 text-sm"
                      >
                        Get Key
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Stream Logs</h2>
                  <div className="bg-gray-900 rounded-lg p-4 h-80 overflow-y-auto font-mono text-sm" data-testid="container-stream-logs">
                    {streamingLogs.length === 0 ? (
                      <p className="text-gray-500">No logs yet...</p>
                    ) : (
                      streamingLogs.map((log, i) => (
                        <p key={i} className="text-gray-300 py-1 border-b border-gray-800">
                          {log}
                        </p>
                      ))
                    )}
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4">Instructions</h2>
                  <div className="space-y-3 text-sm text-gray-300">
                    <div className="p-3 bg-amber-900/30 border border-amber-700 rounded-lg">
                      <p className="font-medium text-amber-300 mb-1">PumpFun Live Setup:</p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-400">
                        <li>Go to pump.fun and open your token page</li>
                        <li>Click Settings then RTMP key and url</li>
                        <li>Copy the RTMP URL and Stream Key</li>
                        <li>Paste them here and click Go Live</li>
                      </ol>
                    </div>

                    <div className="p-3 bg-blue-900/30 border border-blue-700 rounded-lg">
                      <p className="font-medium text-blue-300 mb-1">Twitch Setup:</p>
                      <ol className="list-decimal list-inside space-y-1 text-gray-400">
                        <li>Go to Twitch Dashboard then Settings then Stream</li>
                        <li>Copy your Stream Key</li>
                        <li>Use URL: rtmp://live.twitch.tv/live</li>
                        <li>Paste them here and click Go Live</li>
                      </ol>
                    </div>

                    <div className="p-3 bg-gray-700 rounded-lg">
                      <p className="font-medium mb-1">Alternative: OBS Studio</p>
                      <p className="text-gray-400">
                        For better quality, use OBS to capture this browser window
                        and stream directly. This avoids server processing costs.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'xdrafts' && (
            <div className="space-y-6">
              <div className="bg-gray-800 rounded-lg p-6">
                <h2 className="text-xl font-semibold mb-4">Create New Draft</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Tweet Text ({newDraftText.length}/280)
                    </label>
                    <textarea
                      value={newDraftText}
                      onChange={(e) => setNewDraftText(e.target.value.slice(0, 280))}
                      placeholder="What's happening?"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white resize-none h-24 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      data-testid="input-draft-text"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">
                      Reply to Tweet ID (optional)
                    </label>
                    <input
                      type="text"
                      value={newDraftReplyId}
                      onChange={(e) => setNewDraftReplyId(e.target.value)}
                      placeholder="e.g., 1234567890123456789"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                      data-testid="input-draft-reply-id"
                    />
                  </div>
                  <button
                    onClick={createXDraft}
                    disabled={!newDraftText.trim() || draftActionLoading === -1}
                    className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                    data-testid="button-create-draft"
                  >
                    {draftActionLoading === -1 ? 'Creating...' : 'Save Draft'}
                  </button>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">Draft Queue</h2>
                  <div className="flex gap-2">
                    <select
                      value={draftStatusFilter}
                      onChange={(e) => setDraftStatusFilter(e.target.value as 'all' | 'draft' | 'posted' | 'failed')}
                      className="px-3 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-white"
                      data-testid="select-draft-filter"
                    >
                      <option value="all">All</option>
                      <option value="draft">Pending</option>
                      <option value="posted">Posted</option>
                      <option value="failed">Failed</option>
                    </select>
                    <button
                      onClick={fetchXDrafts}
                      disabled={xDraftsLoading}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm"
                      data-testid="button-refresh-drafts"
                    >
                      {xDraftsLoading ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                </div>

                {xDrafts.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No drafts found</p>
                ) : (
                  <div className="space-y-3">
                    {xDrafts.map((draft) => (
                      <div
                        key={draft.id}
                        className={`p-4 rounded-lg border ${
                          draft.status === 'draft' ? 'bg-gray-900 border-gray-700' :
                          draft.status === 'posted' ? 'bg-green-900/20 border-green-700' :
                          'bg-red-900/20 border-red-700'
                        }`}
                        data-testid={`draft-item-${draft.id}`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="text-white whitespace-pre-wrap break-words">{draft.text}</p>
                            <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
                              <span>Created: {new Date(draft.createdAt).toLocaleString()}</span>
                              {draft.replyToTweetId && (
                                <span>Reply to: {draft.replyToTweetId}</span>
                              )}
                              {draft.tweetId && (
                                <a
                                  href={`https://x.com/i/web/status/${draft.tweetId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sky-400 hover:underline"
                                >
                                  View Tweet
                                </a>
                              )}
                              {draft.errorMessage && (
                                <span className="text-red-400">Error: {draft.errorMessage}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              draft.status === 'draft' ? 'bg-yellow-600 text-white' :
                              draft.status === 'posted' ? 'bg-green-600 text-white' :
                              'bg-red-600 text-white'
                            }`}>
                              {draft.status.toUpperCase()}
                            </span>
                            {draft.status === 'draft' && (
                              <>
                                <button
                                  onClick={() => approveXDraft(draft.id)}
                                  disabled={draftActionLoading === draft.id}
                                  className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded text-sm font-medium"
                                  data-testid={`button-approve-${draft.id}`}
                                >
                                  {draftActionLoading === draft.id ? '...' : 'Post'}
                                </button>
                                <button
                                  onClick={() => deleteXDraft(draft.id)}
                                  disabled={draftActionLoading === draft.id}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded text-sm font-medium"
                                  data-testid={`button-delete-${draft.id}`}
                                >
                                  Delete
                                </button>
                              </>
                            )}
                            {draft.status !== 'draft' && (
                              <button
                                onClick={() => deleteXDraft(draft.id)}
                                disabled={draftActionLoading === draft.id}
                                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white rounded text-sm"
                                data-testid={`button-delete-${draft.id}`}
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-3">Rate Limits & Safety</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-gray-900 rounded">
                    <p className="text-gray-400">Max drafts per day</p>
                    <p className="text-xl font-bold text-white">50</p>
                  </div>
                  <div className="p-3 bg-gray-900 rounded">
                    <p className="text-gray-400">Min post interval</p>
                    <p className="text-xl font-bold text-white">60s</p>
                  </div>
                  <div className="p-3 bg-gray-900 rounded">
                    <p className="text-gray-400">Max tweet length</p>
                    <p className="text-xl font-bold text-white">280 chars</p>
                  </div>
                  <div className="p-3 bg-gray-900 rounded">
                    <p className="text-gray-400">Pending drafts</p>
                    <p className="text-xl font-bold text-yellow-400">{xDrafts.filter(d => d.status === 'draft').length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
