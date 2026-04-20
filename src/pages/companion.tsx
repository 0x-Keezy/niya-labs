import {
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import Head from "next/head";
import { clsx } from "clsx";
import { M_PLUS_2, Montserrat } from "next/font/google";
import {
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  Cog6ToothIcon,
  LinkIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";
import { IconBrain } from '@tabler/icons-react';
import { ExternalLink, Copy, Check, Lock, Heart, Minimize2, Maximize2, Minus, Info, Film, Share2, Sparkles } from "lucide-react";
import { ShareModal } from "@/components/shareModal";
import { NiyaAppShell } from "@/components/niya/NiyaAppShell";

import { AssistantText } from "@/components/assistantText";
import { Alert } from "@/components/alert";
import { UserText } from "@/components/userText";
import VrmViewer from "@/components/vrmViewer";
import Live2DViewer from "@/components/live2dViewer";
import { LoadingProgress } from "@/components/loadingProgress";
import { LoadingScreenOverlay } from "@/components/niya/LoadingScreenNiya";
import { DebugPane } from "@/components/debugPane";
import { Settings } from "@/components/settings";
import { LiveShowProcessor } from "@/components/liveChat";
import { AboutPanel } from "@/components/aboutPanel";
import { Moshi } from "@/features/moshi/components/Moshi";
import { BrainPanel } from "@/components/brainPanel";
import { AdminExpressionPanel } from "@/components/adminExpressionPanel";

import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import { Message, Role } from "@/features/chat/messages";
import { ChatContext } from "@/features/chat/chatContext";
import { AlertContext } from "@/features/alert/alertContext";

import { config, updateConfig } from '@/utils/config';
import { VrmStoreProvider } from "@/features/vrmStore/vrmStoreContext";
import { AmicaLifeContext } from "@/features/amicaLife/amicaLifeContext";

import { TimestampedPrompt } from "@/features/amicaLife/eventHandler";
import { handleChatLogs } from "@/features/externalAPI/externalAPI";
import { ThoughtText } from "@/components/thoughtText";
import { NotificationProvider, AIThinkingIndicator } from "@/components/notificationSystem";
import { detectEmotion, type Emotion } from "@/components/emotionDetector";
import { amicaLifeIntegration } from "@/features/autonomy/amicaLifeIntegration";
import { marketDataApi } from "@/features/autonomy/marketDataApi";
import { BinanceIntelligenceWidget } from "@/components/binanceIntelligenceWidget";
import { connectEmotionsToLive2D, disconnectEmotionsFromLive2D } from "@/features/emotions";
import { pumpfunApi, PumpFunTokenInfo } from "@/features/autonomy/pumpfunApi";
import { Wallet, X } from "lucide-react";
import { LanguageSelector } from "@/components/languageSelector";
import { StickerPicker } from "@/components/stickerPicker";
import { useTranslation } from "react-i18next";

const m_plus_2 = M_PLUS_2({
  variable: "--font-m-plus-2",
  display: "swap",
  preload: false,
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  display: "swap",
  subsets: ["latin"],
});

interface LiveMessage {
  id: number;
  visitorName: string | null;
  role: string;
  content: string;
  createdAt: string;
}

const STICKER_PATTERN = /\[sticker:([^\]]+)\]/g;

function stripStickers(text: string): string {
  return text.replace(STICKER_PATTERN, '').trim();
}

function renderMessageWithStickers(content: string): React.ReactNode {
  const cleanedContent = content.replace(/\[[a-zA-Z]+\]/g, '');
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  const regex = /\[sticker:([^\]]+)\]/g;
  
  while ((match = regex.exec(cleanedContent)) !== null) {
    if (match.index > lastIndex) {
      parts.push(cleanedContent.slice(lastIndex, match.index));
    }
    const stickerUrl = match[1];
    parts.push(
      <img 
        key={`sticker-${match.index}`}
        src={stickerUrl}
        alt="sticker"
        className="inline-block w-6 h-6 align-middle mx-0.5"
        loading="lazy"
      />
    );
    lastIndex = match.index + match[0].length;
  }
  
  if (lastIndex < cleanedContent.length) {
    parts.push(cleanedContent.slice(lastIndex));
  }
  
  return parts.length > 0 ? parts : cleanedContent.trim();
}

export default function AppPage() {
  const { t } = useTranslation();
  const { viewer } = useContext(ViewerContext);
  const { alert } = useContext(AlertContext);
  const { chat: bot } = useContext(ChatContext);
  const { amicaLife } = useContext(AmicaLifeContext);
  
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletPending, setWalletPending] = useState(false);
  
  // Initialize visitorId synchronously to avoid race conditions
  const [visitorId, setVisitorId] = useState(() => {
    if (typeof window === "undefined") return "";
    let id = localStorage.getItem("niya_visitor_id");
    if (!id) {
      id = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("niya_visitor_id", id);
    }
    return id;
  });

  const [chatSpeaking, setChatSpeaking] = useState(false);
  const [chatProcessing, setChatProcessing] = useState(false);
  const [chatLog, setChatLog] = useState<Message[]>([]);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [userMessage, setUserMessage] = useState("");
  const [thoughtMessage, setThoughtMessage] = useState("");
  const [shownMessage, setShownMessage] = useState<Role>("system");
  const [subconciousLogs, setSubconciousLogs] = useState<TimestampedPrompt[]>([]);

  const [showContent, setShowContent] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBrainPanel, setShowBrainPanel] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral');
  const [showAboutPanel, setShowAboutPanel] = useState(false);
  const [showExpressionPanel, setShowExpressionPanel] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [characterMinimized, setCharacterMinimized] = useState(false);
  const [isAppLoading, setIsAppLoading] = useState(true);
  const [contentReady, setContentReady] = useState(false);

  const [muted, setMuted] = useState<boolean|null>(null);
  const [showMore, setShowMore] = useState(false);
  const [copied, setCopied] = useState<"contract" | "wallet" | "bnbContract" | null>(null);

  const [bgUrl, setBgUrl] = useState(config("bg_url"));
  const [bgColor, setBgColor] = useState(config("bg_color"));

  const [marketData, setMarketData] = useState<{bnb?: number; btc?: number; eth?: number}>({});
  const [liveMessages, setLiveMessages] = useState<LiveMessage[]>([]);
  const [tokenMint, setTokenMint] = useState<string>("");
  const [tokenMintConfigured, setTokenMintConfigured] = useState(false);
  const [tokenData, setTokenData] = useState<PumpFunTokenInfo | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [bnbTokenCA, setBnbTokenCA] = useState<string>("");
  const [bnbTokenConfigured, setBnbTokenConfigured] = useState(false);
  const [bnbTokenData, setBnbTokenData] = useState<{price?: number; marketCap?: number; change24h?: number; phase?: string} | null>(null);
  const [bnbTokenLoading, setBnbTokenLoading] = useState(true);
  const [agentWallet, setAgentWallet] = useState<string>("");
  const [agentWalletConfigured, setAgentWalletConfigured] = useState(false);
  const [stats, setStats] = useState({ queueLength: 0, activeViewers: 0 });
  const [liveInput, setLiveInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'live' | 'debug'>('live');
  const [debugLogs, setDebugLogs] = useState<{ts: number; type: string; arguments: any[]}[]>([]);
  const [debugFilters, setDebugFilters] = useState({ debug: false, info: true, warn: true, error: true });
  const [debugAutoScroll, setDebugAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const debugEndRef = useRef<HTMLDivElement>(null);
  const debugScrollRef = useRef<HTMLDivElement>(null);
  const didMountRef = useRef(false);

  useEffect(() => {
    amicaLife.checkSettingOff(!showSettings);
  }, [showSettings, amicaLife]);

  // Prevent browser scroll restoration from jumping the page
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    // Mark as mounted after first render
    didMountRef.current = true;
  }, []);

  // Connect emotion system to Live2D viewer
  useEffect(() => {
    connectEmotionsToLive2D();
    return () => {
      disconnectEmotionsFromLive2D();
    };
  }, []);

  // Check wallet connection on mount
  useEffect(() => {
    // Check if wallet is already connected from localStorage
    const savedWallet = localStorage.getItem("niya_wallet_address");
    if (savedWallet) {
      setWalletAddress(savedWallet);
      setWalletConnected(true);
    }

    // Check ethereum accounts for currently connected wallet
    const checkWallet = async () => {
      const ethereum = (window as any).ethereum;
      if (!ethereum) return;
      try {
        const accounts = await ethereum.request({ method: 'eth_accounts' });
        if (accounts && accounts.length > 0) {
          setWalletAddress(accounts[0]);
          setWalletConnected(true);
          localStorage.setItem("niya_wallet_address", accounts[0]);
        }
      } catch (err) {
        console.warn("[App] Failed to check wallet:", err);
      }
    };
    checkWallet();
  }, []);

  // App loading logic - show loading screen until content is ready
  useEffect(() => {
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 1500));
    
    const waitForContent = new Promise<void>(resolve => {
      if (document.readyState === 'complete') {
        resolve();
      } else {
        window.addEventListener('load', () => resolve(), { once: true });
      }
    });

    Promise.all([minLoadTime, waitForContent]).then(() => {
      setContentReady(true);
      // Small delay then hide loading
      setTimeout(() => {
        setIsAppLoading(false);
        // Emit NIYA_READY for any listeners
        window.postMessage({ type: 'NIYA_READY' }, '*');
      }, 100);
    });
  }, []);

  // Remove pixi-sound audio unlock overlay (class="pixi-sound")
  useEffect(() => {
    const removePixiSoundOverlay = () => {
      // The overlay uses class "pixi-sound" - this is the actual class from the library
      document.querySelectorAll('.pixi-sound, div.pixi-sound').forEach(el => el.remove());
    };

    // Run immediately and after delays (for dynamic injection during Live2D init)
    removePixiSoundOverlay();
    const t1 = setTimeout(removePixiSoundOverlay, 500);
    const t2 = setTimeout(removePixiSoundOverlay, 1000);
    const t3 = setTimeout(removePixiSoundOverlay, 2000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // CRITICAL: Unlock AudioContext on first user interaction (browser autoplay policy)
  useEffect(() => {
    let audioUnlocked = false;
    
    const unlockAudio = async () => {
      if (audioUnlocked) return;
      audioUnlocked = true;
      
      console.log('[AudioUnlock] User interaction detected, unlocking audio...');
      
      // Resume viewer's model AudioContext if available
      if (viewer?.model?._lipSync?.audio) {
        const audioCtx = viewer.model._lipSync.audio;
        if (audioCtx.state === 'suspended') {
          try {
            await audioCtx.resume();
            console.log('[AudioUnlock] VRM AudioContext resumed, state:', audioCtx.state);
          } catch (e) {
            console.error('[AudioUnlock] Failed to resume AudioContext:', e);
          }
        }
      }
      
      // Remove listeners after first unlock
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
    
    document.addEventListener('click', unlockAudio);
    document.addEventListener('touchstart', unlockAudio);
    document.addEventListener('keydown', unlockAudio);
    
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
      document.removeEventListener('keydown', unlockAudio);
    };
  }, [viewer]);

  useEffect(() => {
    if (muted === null) {
      setMuted(config('tts_muted') === 'true');
    }
    const interval = setInterval(() => {
      const newBgUrl = config("bg_url");
      const newBgColor = config("bg_color");
      if (newBgUrl !== bgUrl) setBgUrl(newBgUrl);
      if (newBgColor !== bgColor) setBgColor(newBgColor);
    }, 1000);
    return () => clearInterval(interval);
  }, [bgUrl, bgColor, muted]);

  useEffect(() => {
    if (!showContent) return;
    
    let cancelled = false;
    let monitoringStarted = false;
    
    async function fetchMarket() {
      if (cancelled) return;
      try {
        const res = await fetch('/api/market');
        if (res.ok && !cancelled) {
          const data = await res.json();
          setMarketData({
            bnb: data.BNB?.price,
            btc: data.BTC?.price,
            eth: data.ETH?.price,
          });
        }
      } catch (e) {}
    }
    
    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      fetchMarket();
      marketDataApi.startMonitoring();
      monitoringStarted = true;
    }, 2000);
    
    const unsubscribe = marketDataApi.subscribe((data) => {
      if (cancelled) return;
      setMarketData({
        bnb: data.bnb?.price,
        btc: data.bitcoin?.price,
        eth: data.ethereum?.price,
      });
    });
    
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      unsubscribe();
      if (monitoringStarted) {
        marketDataApi.stopMonitoring();
      }
    };
  }, [showContent]);

  // Load token mint from server config
  useEffect(() => {
    if (!showContent) return;
    
    async function loadTokenMint() {
      try {
        const response = await fetch('/api/config/token-mint');
        if (response.ok) {
          const data = await response.json();
          if (data.mint) {
            setTokenMint(data.mint);
            setTokenMintConfigured(data.configured);
            console.log('[TokenData] Token mint loaded:', data.mint.slice(0, 8) + '...');
          } else {
            console.log('[TokenData] No token mint configured');
            setTokenMintConfigured(false);
          }
        }
      } catch (e) {
        console.error('[TokenData] Failed to load token mint:', e);
      }
    }
    
    loadTokenMint();
  }, [showContent]);

  // Load BNB token CA from server config
  useEffect(() => {
    if (!showContent) return;
    
    async function loadBnbToken() {
      try {
        const response = await fetch('/api/config/bnb-token');
        if (response.ok) {
          const data = await response.json();
          if (data.ca) {
            setBnbTokenCA(data.ca);
            setBnbTokenConfigured(data.configured);
            console.log('[BNBToken] Token CA loaded:', data.ca.slice(0, 10) + '...');
          } else if (data.testCa) {
            setBnbTokenCA(data.testCa);
            setBnbTokenConfigured(false);
            console.log('[BNBToken] Using test token CA');
          } else {
            console.log('[BNBToken] No token CA configured');
            setBnbTokenConfigured(false);
          }
        }
      } catch (e) {
        console.error('[BNBToken] Failed to load token CA:', e);
      }
    }
    
    loadBnbToken();
    
    async function loadAgentWallet() {
      try {
        const response = await fetch('/api/config/wallet');
        if (response.ok) {
          const data = await response.json();
          if (data.walletAddress) {
            setAgentWallet(data.walletAddress);
            setAgentWalletConfigured(data.configured);
            console.log('[AgentWallet] Wallet loaded:', data.walletAddress.slice(0, 10) + '...');
          } else {
            console.log('[AgentWallet] No wallet configured');
            setAgentWalletConfigured(false);
          }
        }
      } catch (e) {
        console.error('[AgentWallet] Failed to load wallet:', e);
      }
    }
    
    loadAgentWallet();
  }, [showContent]);

  // Fetch BNB token data via server-side proxy (avoids CORS issues)
  useEffect(() => {
    if (!showContent || !bnbTokenCA) return;
    
    let cancelled = false;
    
    async function fetchBnbTokenDataViaProxy() {
      try {
        setBnbTokenLoading(true);
        
        const response = await fetch(`/api/bnb/token?ca=${bnbTokenCA}`);
        
        if (response.ok) {
          const data = await response.json();
          
          if (!cancelled) {
            setBnbTokenData({
              price: data.price || 0,
              marketCap: data.marketCap || 0,
              change24h: data.change24h || 0,
              phase: data.phase || 'bonding',
            });
            console.log('[BNBToken] Success via proxy:', data.symbol, 'MCap: $' + data.marketCap?.toLocaleString());
          }
        } else {
          console.warn('[BNBToken] Proxy returned:', response.status);
        }
      } catch (e) {
        console.error("[BNBToken] Failed to fetch:", e);
      } finally {
        if (!cancelled) setBnbTokenLoading(false);
      }
    }
    
    fetchBnbTokenDataViaProxy();
    const interval = setInterval(fetchBnbTokenDataViaProxy, 10000); // Refresh every 10s for volatile tokens
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [showContent, bnbTokenCA]);

  // Fetch Niya token data via server-side proxy (avoids CORS/Cloudflare blocks)
  useEffect(() => {
    if (!showContent || !tokenMint) return;
    
    let cancelled = false;
    
    async function fetchTokenDataViaProxy() {
      try {
        setTokenLoading(true);
        
        // Use our own API proxy to avoid CORS issues
        const response = await fetch(`/api/pumpfun/token?mint=${tokenMint}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('[TokenData] Success via proxy:', data.symbol, 'MCap: $' + data.marketCapUsd?.toLocaleString(), 'Vol24h: $' + data.volume24h?.toLocaleString());
          
          if (!cancelled) {
            setTokenData({
              mint: data.mint,
              name: data.name,
              symbol: data.symbol,
              description: data.description,
              imageUri: data.imageUri,
              marketCapSol: data.marketCapSol,
              marketCapUsd: data.marketCapUsd,
              priceUsd: data.priceUsd,
              priceNative: data.priceNative,
              volumeSol: data.volumeSol,
              volume24h: data.volume24h,
              priceChange24h: data.priceChange24h,
              fdv: data.fdv,
              dexId: data.dexId,
              pairAddress: data.pairAddress,
              complete: data.complete,
              bondingCurveKey: data.bondingCurveKey,
              source: data.source,
            });
          }
        } else {
          console.warn('[TokenData] Proxy returned:', response.status);
        }
      } catch (e) {
        console.error("[TokenData] Failed to fetch:", e);
      } finally {
        if (!cancelled) setTokenLoading(false);
      }
    }
    
    fetchTokenDataViaProxy();
    const interval = setInterval(fetchTokenDataViaProxy, 10000); // Refresh every 10s for volatile tokens
    
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [showContent, tokenMint]);

  useEffect(() => {
    if (!showContent) return;
    
    let msgInterval: NodeJS.Timeout | null = null;
    let statsInterval: NodeJS.Timeout | null = null;
    
    async function fetchMessages() {
      try {
        const res = await fetch("/api/liveshow/messages?limit=50");
        if (res.ok) {
          const data = await res.json();
          setLiveMessages(data);
        } else {
          console.error("[LiveChat] Failed to fetch messages:", res.status, res.statusText);
        }
      } catch (e: any) {
        const stack = e?.stack || '';
        if (stack.includes('__replco') || stack.includes('injected.js')) {
          console.warn("[LiveChat] Fetch blocked by Replit devtools - open in new tab for full functionality");
        } else {
          console.error("[LiveChat] Fetch messages error:", e?.message || e, "Online:", navigator.onLine);
        }
      }
    }
    async function fetchStats() {
      try {
        const res = await fetch("/api/liveshow/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        } else {
          console.error("[LiveChat] Failed to fetch stats:", res.status, res.statusText);
        }
      } catch (e: any) {
        const stack = e?.stack || '';
        if (stack.includes('__replco') || stack.includes('injected.js')) {
          console.warn("[LiveChat] Fetch blocked by Replit devtools - open in new tab for full functionality");
        } else {
          console.error("[LiveChat] Fetch stats error:", e?.message || e, "Online:", navigator.onLine);
        }
      }
    }
    
    const initTimeout = setTimeout(() => {
      fetchMessages();
      fetchStats();
      msgInterval = setInterval(fetchMessages, 30000);
      statsInterval = setInterval(fetchStats, 60000);
    }, 1000);
    
    return () => {
      clearTimeout(initTimeout);
      if (msgInterval) clearInterval(msgInterval);
      if (statsInterval) clearInterval(statsInterval);
    };
  }, [showContent]);

  // Auto-scroll removed to prevent forcing users down when they're reading history

  useEffect(() => {
    if (activeTab !== 'debug') return;
    
    function updateDebugLogs() {
      const logs = (window as any).error_handler_logs || [];
      setDebugLogs([...logs].slice(-100));
    }
    
    updateDebugLogs();
    const interval = setInterval(updateDebugLogs, 1000);
    return () => clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    // Skip auto-scroll on initial mount to prevent page jump
    if (!didMountRef.current) return;
    if (debugAutoScroll) {
      debugEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [debugLogs, debugAutoScroll]);

  function handleDebugScroll() {
    const el = debugScrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    setDebugAutoScroll(atBottom);
  }

  const isVideoBg = bgUrl && (bgUrl.endsWith('.mp4') || bgUrl.endsWith('.webm') || bgUrl.endsWith('.ogg'));

  function toggleTTSMute() {
    updateConfig('tts_muted', config('tts_muted') === 'true' ? 'false' : 'true');
    setMuted(config('tts_muted') === 'true');
  }

  useEffect(() => {
    bot.initialize(
      viewer,
      alert,
      setChatLog,
      setUserMessage,
      setAssistantMessage,
      setThoughtMessage,
      setShownMessage,
      setChatProcessing,
      setChatSpeaking,
    );

    if (config("tts_backend") === 'openai') {
      updateConfig("tts_backend", "openai_tts");
    }
  }, [bot, viewer]);

  // Track played audio IDs at component level to prevent duplicate playback
  // This is the FINAL deduplication layer - even if broadcastManager delivers duplicates,
  // app.tsx will only play each audio once
  const playedAudioIdsRef = useRef<Set<string>>(new Set());
  
  // Helper to generate a unique audio ID from broadcast data
  // Uses database ID when available for consistent deduplication across SSE, polling, and init
  const getAudioId = (data: any): string => {
    // Prefer database ID (used by SSE as broadcastId, polling as id, init as id)
    if (data.broadcastId) return `db-${data.broadcastId}`;
    if (data.id) return `db-${data.id}`;
    // Fallback to timestamp (createdAt from database)
    if (data.timestamp) return `ts-${data.timestamp}`;
    // Last resort - should never happen with proper server data
    if (data.audioBase64) return `hash-${data.audioBase64.substring(0, 50)}`;
    return `unknown-${Date.now()}`;
  };
  
  // Subscribe to broadcast system for synchronized content across all clients
  // This ensures all viewers see the same subtitles, hear the same audio, and see the same chat
  // The host generates content, viewers receive via SSE
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    // Fix #2: setTimeout leaks dentro de la subscribe callback quedaban
    // sin cleanup al unmount de /companion, pudiendo disparar un
    // NIYA_READY fantasma o tocar state desmontado. Tracking explícito.
    const pendingTimers: Set<ReturnType<typeof setTimeout>> = new Set();
    const trackedSetTimeout = (fn: () => void, ms: number) => {
      const id = setTimeout(() => {
        pendingTimers.delete(id);
        fn();
      }, ms);
      pendingTimers.add(id);
      return id;
    };

    import('@/features/broadcast/broadcastManager').then(({ broadcastManager }) => {
      unsubscribe = broadcastManager.subscribe(async (data: any) => {
        // SYNCHRONIZED EVENT - contains chat, subtitle, and audio ALL AT ONCE
        // This is the primary way viewers receive content for a true "live show" experience
        if (data.type === 'sync') {
          // ALL clients (host and viewers) process sync events
          // With server-based TTS architecture, everyone receives audio from the server
          
          // FINAL DEDUPLICATION CHECK - prevent playing same audio twice
          const audioId = getAudioId(data);
          if (playedAudioIdsRef.current.has(audioId)) {
            console.log('[Broadcast] Audio already played, skipping duplicate:', audioId);
            return;
          }
          
          console.log('[Broadcast] SYNC event received - preparing synchronized playback, id:', audioId);
          
          // Chat messages are handled directly by the LiveChat component
          // which subscribes to the same SSE events for synchronized display
          
          // CRITICAL: Decode audio FIRST, then show subtitle + play audio simultaneously
          // This ensures subtitle and audio appear at the exact same moment
          if (data.audioBase64 && config('tts_muted') !== 'true') {
            // Mark as played BEFORE starting playback to prevent race conditions
            playedAudioIdsRef.current.add(audioId);
            
            // Cleanup old IDs to prevent memory leak (keep last 50)
            if (playedAudioIdsRef.current.size > 100) {
              const ids = Array.from(playedAudioIdsRef.current);
              playedAudioIdsRef.current = new Set(ids.slice(-50));
            }
            
            try {
              // Convert base64 back to ArrayBuffer
              const binaryString = atob(data.audioBase64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const audioBuffer = bytes.buffer;
              
              // Create AudioContext and decode audio FIRST (before showing subtitle)
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
              if (audioContext.state === 'suspended') {
                await audioContext.resume();
              }
              
              const decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice(0));
              const source = audioContext.createBufferSource();
              source.buffer = decodedAudio;
              source.connect(audioContext.destination);
              
              // When audio finishes naturally, clean up and clear speaking state
              source.onended = () => {
                setChatSpeaking(false);
                setAssistantMessage('');
                setShownMessage('system');
                audioContext.close().catch(() => {});
                console.log('[Broadcast] Audio playback finished, cleared subtitles');
              };
              
              // NOW show subtitle and start audio AT THE SAME TIME
              if (data.subtitleText) {
                setAssistantMessage(data.subtitleText);
                setShownMessage('assistant');
                setChatSpeaking(true);
              }
              
              source.start(0);
              console.log('[Broadcast] Playing synchronized audio + subtitle for viewer');
            } catch (audioErr) {
              console.error('[Broadcast] Failed to play synchronized audio:', audioErr);
              // Clear speaking state on error
              setChatSpeaking(false);
              setAssistantMessage('');
              setShownMessage('system');
            }
          } else if (data.subtitleText) {
            // Audio muted or no audio - still show subtitle for a brief moment
            setAssistantMessage(data.subtitleText);
            setShownMessage('assistant');
            setChatSpeaking(true);
            // Auto-clear after a reasonable time since no audio to trigger onended
            trackedSetTimeout(() => {
              setChatSpeaking(false);
              setAssistantMessage('');
              setShownMessage('system');
            }, 5000);
          }
        } else if (data.type === 'sync-end') {
          // Speaking ended signal from server - clears subtitles for all clients
          // Small delay to let audio onended fire first if audio is playing
          // If audio isn't playing, this will be the one that clears the subtitles
          trackedSetTimeout(() => {
            // Always clear - if audio onended already ran, this is harmless
            // If audio didn't play, this ensures subtitles get cleared
            setChatSpeaking(false);
            setAssistantMessage('');
            setShownMessage('system');
          }, 500);
        } else if (data.type === 'subtitle') {
          // DISABLED: Legacy subtitle event causes desync - subtitles appear before audio
          // All subtitle display now happens via 'sync' event which includes audio
          // Keep this handler for backwards compatibility logging only
          console.log('[Broadcast] Ignoring legacy subtitle event - use sync instead');
          // DO NOT update subtitles here - let sync handle it
        } else if (data.type === 'init') {
          // Initialize with current state from server
          const isSpeaking = data.speaking || data.currentSpeaking;
          const currentSubtitle = data.subtitle || data.currentSubtitle || '';
          
          if (isSpeaking && currentSubtitle) {
            setAssistantMessage(currentSubtitle);
            setShownMessage('assistant');
            setChatSpeaking(true);
          }
          
          // Late-joiner catch-up: play most recent broadcast if currently speaking
          // Uses same deduplication to prevent duplicate playback
          if (isSpeaking && data.recentBroadcasts && data.recentBroadcasts.length > 0 && config('tts_muted') !== 'true') {
            const latest = data.recentBroadcasts[data.recentBroadcasts.length - 1];
            if (latest.audioBase64) {
              const audioId = getAudioId(latest);
              
              // Safety check: only process if we have a stable database ID
              // Fallback IDs (timestamp/hash) can cause duplicate playback across channels
              if (!audioId.startsWith('db-')) {
                console.warn('[Broadcast] Late-joiner audio lacks stable ID, skipping:', audioId);
                return;
              }
              
              if (!playedAudioIdsRef.current.has(audioId)) {
                // Mark as played BEFORE starting playback
                playedAudioIdsRef.current.add(audioId);
                
                // Cleanup old IDs to prevent memory leak (same as sync handler)
                if (playedAudioIdsRef.current.size > 100) {
                  const ids = Array.from(playedAudioIdsRef.current);
                  playedAudioIdsRef.current = new Set(ids.slice(-50));
                }
                
                console.log('[Broadcast] Late-joiner catch-up, playing audio id:', audioId);
                
                try {
                  const binaryString = atob(latest.audioBase64);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  const audioBuffer = bytes.buffer;
                  
                  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                  if (audioContext.state === 'suspended') {
                    await audioContext.resume();
                  }
                  
                  const decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice(0));
                  const source = audioContext.createBufferSource();
                  source.buffer = decodedAudio;
                  source.connect(audioContext.destination);
                  
                  if (latest.subtitleText) {
                    setAssistantMessage(latest.subtitleText);
                    setShownMessage('assistant');
                    setChatSpeaking(true);
                  }
                  
                  source.onended = () => {
                    setChatSpeaking(false);
                    setAssistantMessage('');
                    setShownMessage('system');
                    audioContext.close().catch(() => {});
                  };
                  
                  source.start(0);
                } catch (audioErr) {
                  console.error('[Broadcast] Failed to play catch-up audio:', audioErr);
                }
              } else {
                console.log('[Broadcast] Late-joiner audio already played, skipping:', audioId);
              }
            }
          }
          
          console.log('[Broadcast] Initialized with state, speaking:', isSpeaking);
        } else if (data.type === 'host-change') {
          console.log('[Broadcast] Host changed, isHost:', data.isHost);
        } else if (data.type === 'audio') {
          // Legacy audio event - for backwards compatibility
          // All clients can receive this for synchronized playback
          
          if (data.audioBase64 && config('tts_muted') !== 'true') {
            try {
              const binaryString = atob(data.audioBase64);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const audioBuffer = bytes.buffer;
              
              const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
              if (audioContext.state === 'suspended') {
                await audioContext.resume();
              }
              
              const decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice(0));
              const source = audioContext.createBufferSource();
              source.buffer = decodedAudio;
              source.connect(audioContext.destination);
              source.start(0);
              
              source.onended = () => {
                audioContext.close();
              };
            } catch (audioErr) {
              console.error('[Broadcast] Failed to play audio:', audioErr);
            }
          }
        }
      });
    }).catch(() => {});

    return () => {
      if (unsubscribe) unsubscribe();
      // Fix #2: cancel cualquier setTimeout pendiente de la subscribe
      // para que no dispare post-unmount y emita un NIYA_READY fantasma
      // que cierre el splash de la siguiente navegación.
      pendingTimers.forEach(clearTimeout);
      pendingTimers.clear();
    };
  }, []);

  useEffect(() => {
    amicaLife.initialize(
      viewer,
      bot,
      setSubconciousLogs,
      chatSpeaking,
    );
  }, [amicaLife, bot, viewer]);

  useEffect(() => {
    const autonomyEnabled = config('autonomy_enabled') === 'true';
    const marketEnabled = config('autonomy_market_enabled') === 'true';
    
    if (amicaLife && bot && viewer && autonomyEnabled) {
      amicaLifeIntegration.initialize(amicaLife, bot, viewer, {
        enableVisionCapture: false,
        enableMarketTriggers: marketEnabled,
        enableAutonomousTweets: marketEnabled,
        marketCheckIntervalMs: 60000,
      });
      
      if (marketEnabled) {
        marketDataApi.startMonitoring();
      }
    }
    
    return () => {
      if (autonomyEnabled) {
        amicaLifeIntegration.shutdown();
        marketDataApi.stopMonitoring();
      }
    };
  }, [amicaLife, bot, viewer]);

  useEffect(() => {
    handleChatLogs(chatLog);
  }, [chatLog]);

  useEffect(() => {
    if (assistantMessage) {
      const emotion = detectEmotion(assistantMessage);
      setCurrentEmotion(emotion);
    }
  }, [assistantMessage]);

  useEffect(() => {
    if (currentEmotion && viewer?.model) {
      const emotionMap: Record<string, string> = {
        happy: 'Happy',
        sad: 'Sad', 
        surprised: 'Surprised',
        angry: 'Angry',
        neutral: 'Neutral'
      };
      const vrmEmotion = emotionMap[currentEmotion] || 'Neutral';
      viewer.model.playEmotion(vrmEmotion);
    }
  }, [currentEmotion, viewer]);

  useEffect(() => setShowContent(true), []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsAdmin(localStorage.getItem('niya_admin_auth') === 'true');
      const handleStorage = () => {
        setIsAdmin(localStorage.getItem('niya_admin_auth') === 'true');
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }
  }, []);

  if (!showContent) return <></>;

  const handleCopy = (type: "contract" | "wallet" | "bnbContract", text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  async function handleLiveSend(e: React.FormEvent) {
    e.preventDefault();
    if (!liveInput.trim() || isSubmitting || !visitorId) return;
    
    const fullMessage = liveInput.trim();
    const messageContent = stripStickers(fullMessage);
    const isStickerOnly = !messageContent.trim();
    // Use wallet address if connected, otherwise use a default name
    const senderName = walletConnected 
      ? walletAddress.slice(0, 8) + "..." 
      : (localStorage.getItem("niya_visitor_name") || "Viewer");
    
    setIsSubmitting(true);
    setLiveInput("");
    
    try {
      const res = await fetch("/api/liveshow/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          visitorName: senderName,
          message: messageContent,
          displayMessage: fullMessage,
          walletAddress: walletConnected ? walletAddress : undefined,
          saveUserMessage: true,
          displayOnly: isStickerOnly,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setQueuePosition(data.position || null);
        const msgRes = await fetch("/api/liveshow/messages?limit=50");
        if (msgRes.ok) {
          const messages = await msgRes.json();
          setLiveMessages(messages);
        }
      } else if (res.status === 403) {
        const errData = await res.json();
        if (errData.error === "wallet_required") {
          setShowWalletModal(true);
        } else {
          window.alert(errData.message || "Access denied");
        }
      } else {
        const errData = await res.json();
        window.alert(errData.error || "Failed to send message");
      }
    } catch (e) {
      console.error("Failed to send message:", e);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function connectWallet() {
    const ethereum = (window as any).ethereum;
    
    if (!ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    
    setWalletPending(true);
    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
        setWalletConnected(true);
        localStorage.setItem("niya_wallet_address", accounts[0]);
        setShowWalletModal(false);
      }
    } catch (err) {
      console.error("[App] Wallet connection failed:", err);
    } finally {
      setWalletPending(false);
    }
  }

  const handleWalletConnected = (address: string) => {
    setWalletAddress(address);
    setWalletConnected(true);
    localStorage.setItem("niya_wallet_address", address);
  };

  const handleWalletDisconnected = () => {
    setWalletAddress("");
    setWalletConnected(false);
    localStorage.removeItem("niya_wallet_address");
  };

  return (
    <NotificationProvider>
      <Head>
        <title>Niya - Live Stream</title>
      </Head>
      <LoadingScreenOverlay isVisible={isAppLoading} />
      <div 
        className={clsx(
          m_plus_2.variable,
          montserrat.variable,
          "min-h-[100dvh] text-[#6B5344] relative"
        )}
        style={{
          backgroundImage: `url('/images/backvtber.png')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundAttachment: "fixed",
          opacity: contentReady ? 1 : 0,
          transition: "opacity 500ms ease-in-out"
        }}
      >
        {/* Overlay suave como en v0 */}
        <div className="absolute inset-0 bg-[#FFF8E7]/20 pointer-events-none" />
        
        <div
          className="px-4 sm:px-6 pt-6 sm:pt-8 pb-10 max-w-[1600px] 2xl:max-w-[1760px] 3xl:max-w-[2080px] mx-auto"
          style={{
            paddingLeft: "max(1rem, env(safe-area-inset-left))",
            paddingRight: "max(1rem, env(safe-area-inset-right))",
          }}
        >
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* STREAM (frame v0) */}
            <div className="w-full lg:flex-1 relative min-h-[400px] md:min-h-[520px] lg:min-h-[650px]">
              <div className="absolute -inset-3 bg-[#E8D4A8] rounded-[2rem] border-4 border-[#C9A86C]" />
              <div
                className="absolute -inset-1 bg-[#FFF8E7] rounded-[1.5rem] border-2 border-[#E8D4A8]"
                style={{
                  borderStyle: "dashed",
                  backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(232, 212, 168, 0.2) 10px, rgba(232, 212, 168, 0.2) 20px)",
                }}
              />
              <div 
                id="stream-boundary" 
                className="relative rounded-2xl overflow-hidden border-2 border-[#E8D4A8] isolate group h-[clamp(360px,60dvh,520px)] sm:h-[500px] lg:h-[650px] bg-white"
                style={{ contain: "paint" }}
              >
              {isVideoBg && (
                <video
                  key={bgUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover"
                >
                  <source src={bgUrl} type="video/mp4" />
                </video>
              )}

              {!isVideoBg && (
                <div 
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ 
                    backgroundImage: bgUrl ? `url(${bgUrl})` : `url(/bg/bg-room2.jpg)`,
                    backgroundColor: bgColor || 'transparent'
                  }}
                />
              )}

              <div className="absolute inset-0">
                <VrmStoreProvider>
                  <div id="viewer-container" className="absolute inset-0 overflow-hidden">
                    {config("viewer_type") === 'live2d' ? (
                      <Live2DViewer 
                        modelUrl={config("live2d_model_url")}
                        emotion={currentEmotion}
                        isSpeaking={chatSpeaking}
                        chatMode={false}
                        compactMode={false}
                        minimized={characterMinimized}
                      />
                    ) : (
                      <VrmViewer chatMode={false} compactMode={false} minimized={characterMinimized} />
                    )}
                  </div>
                  {showSettings && (
                    <Settings onClickClose={() => setShowSettings(false)} />
                  )}
                </VrmStoreProvider>
              </div>

              {isAdmin && showExpressionPanel && (
                <AdminExpressionPanel onClose={() => setShowExpressionPanel(false)} />
              )}

              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 sm:gap-3">
                <span className="bg-black text-white text-xs sm:text-sm font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                  {t("Live")}
                </span>
                <span className="bg-[#E8D4A8] text-[#6B5344] text-xs sm:text-sm font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-full">
                  ~{stats.activeViewers || 0} {t("Watching")}
                </span>
              </div>

              <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex gap-2 sm:gap-3">
                <button
                  onClick={() => setShowAboutPanel(!showAboutPanel)}
                  className={clsx(
                    "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-bold transition-all",
                    showAboutPanel 
                      ? "bg-[#F5D89A] text-[#6B5344]" 
                      : "bg-white text-black hover:bg-white/90"
                  )}
                  data-testid="button-about-project"
                >
                  <Info className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">{t("About")}</span>
                </button>
                <div className="bg-white/90 hover:bg-white px-3 py-2 rounded-full transition-all">
                  <LanguageSelector />
                </div>
              </div>

              <div className="absolute bottom-32 left-0 right-0 z-10 pointer-events-none px-6">
                <div className="max-w-xl mx-auto">
                  {shownMessage === 'assistant' && (
                    <AssistantText message={assistantMessage} />
                  )}
                </div>
              </div>

              <div className="absolute bottom-4 right-4 z-20 hidden sm:flex flex-col items-end gap-2">
                <div className="bg-black/70 backdrop-blur-sm rounded-lg p-3 text-xs">
                  <div className="text-white font-bold uppercase mb-2">{t("Market")}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between gap-6">
                      <span className="text-white/70">BNB</span>
                      <span className="font-mono text-green-400">${marketData.bnb?.toFixed(2) || '---'}</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-white/70">BTC</span>
                      <span className="font-mono text-green-400">${marketData.btc ? (marketData.btc / 1000).toFixed(2) + 'k' : '---'}</span>
                    </div>
                    <div className="flex justify-between gap-6">
                      <span className="text-white/70">ETH</span>
                      <span className="font-mono text-green-400">${marketData.eth?.toLocaleString() || '---'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-auto md:pointer-events-none md:group-hover:pointer-events-auto">
                  <button 
                    onClick={() => setShowShareModal(true)}
                    className="p-2.5 bg-white/90 hover:bg-white text-black rounded-full transition-all"
                    title="Share"
                    data-testid="button-share-hover"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setShowBrainPanel(!showBrainPanel)}
                    className={clsx(
                      "p-2.5 rounded-full transition-all",
                      showBrainPanel ? "bg-[#F5D89A] text-[#6B5344]" : "bg-white/90 hover:bg-white text-black"
                    )}
                    title="Thoughts"
                    data-testid="button-thoughts-hover"
                  >
                    <IconBrain className="w-4 h-4" />
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={() => setShowExpressionPanel(!showExpressionPanel)}
                      className={clsx(
                        "p-2.5 rounded-full transition-all",
                        showExpressionPanel ? "bg-purple-500 text-white" : "bg-white/90 hover:bg-white text-black"
                      )}
                      title="Expression Preview"
                      data-testid="button-expression-preview"
                    >
                      <Sparkles className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => setShowSettings(true)}
                    className="p-2.5 bg-white/90 hover:bg-white text-black rounded-full transition-all"
                    title="Settings"
                    data-testid="button-settings-hover"
                  >
                    <Cog6ToothIcon className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setCharacterMinimized(!characterMinimized)}
                    className={clsx(
                      "p-2.5 rounded-full transition-all",
                      characterMinimized ? "bg-[#F5D89A] text-[#6B5344]" : "bg-white/90 hover:bg-white text-black"
                    )}
                    title={characterMinimized ? "Maximize" : "Minimize"}
                    data-testid="button-minimize-hover"
                  >
                    {characterMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="hidden" aria-hidden="true">
                <div className="bg-[#E8D4A8] rounded-full px-5 py-3 flex items-center gap-4 max-w-md">
                  <span className="text-[#6B5344] text-sm font-bold whitespace-nowrap">flame.mp3</span>
                  <span className="text-[#6B5344]/70 text-sm whitespace-nowrap">niya beats</span>
                  <div className="flex-1 flex items-center gap-0.5 h-6">
                    {[35, 60, 45, 80, 55, 40, 75, 50, 65, 30, 70, 45, 85, 40, 60, 50, 75, 35, 55, 45].map((h, i) => (
                      <div 
                        key={i} 
                        className="w-1 bg-[#6B5344]/80 rounded-full"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                  <button 
                    onClick={toggleTTSMute}
                    className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors"
                    data-testid="button-audio-mute"
                  >
                    {muted ? <SpeakerXMarkIcon className="w-4 h-4 text-white" /> : <SpeakerWaveIcon className="w-4 h-4 text-white" />}
                  </button>
                  <button className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors" data-testid="button-audio-menu">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="3" y="5" width="7" height="14" rx="1" />
                      <rect x="14" y="5" width="7" height="14" rx="1" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity pointer-events-auto md:pointer-events-none md:group-hover:pointer-events-auto">
                <button 
                  onClick={toggleTTSMute}
                  className={clsx(
                    "p-3 rounded-full transition-all",
                    muted ? "bg-red-500 text-white" : "bg-white/90 hover:bg-white text-black"
                  )}
                  title={muted ? "Unmute" : "Mute"}
                  data-testid="button-mute"
                >
                  {muted ? <SpeakerXMarkIcon className="w-5 h-5" /> : <SpeakerWaveIcon className="w-5 h-5" />}
                </button>
              </div>
            </div>
            </div>

            {/* CHAT (frame v0) */}
            <div className="w-full lg:w-[340px] flex-shrink-0 relative" style={{ minHeight: "650px" }}>
              <div className="absolute -inset-3 bg-[#E8D4A8] rounded-[2rem] border-4 border-[#C9A86C]" />
              <div
                className="absolute -inset-1 bg-[#FFF8E7] rounded-[1.5rem] border-2 border-[#E8D4A8]"
                style={{ borderStyle: "dashed" }}
              />
              <div className="relative flex flex-col rounded-2xl border-2 border-[#E8D4A8] bg-[#FFFEF9] overflow-hidden shadow-lg min-h-[280px] max-h-[45dvh] md:max-h-[50dvh] lg:min-h-0 lg:max-h-none lg:h-[650px]" data-testid="chat-panel">
              <div className="px-4 pt-3 pb-2 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setActiveTab('live')}
                    className={clsx(
                      "text-[15px] font-bold transition-colors px-3 py-1.5 rounded-lg",
                      activeTab === 'live' ? "text-black bg-gray-100" : "text-gray-400 hover:text-gray-600"
                    )}
                    data-testid="tab-live-chat"
                  >
                    {t("Group Chat")}
                  </button>
                  <button 
                    onClick={() => setActiveTab('debug')}
                    className={clsx(
                      "text-[15px] font-bold transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg",
                      activeTab === 'debug' ? "text-black bg-gray-100" : "text-gray-400 hover:text-gray-600"
                    )}
                    data-testid="tab-debug-console"
                  >
                    {t("Debug Section")}
                    <Lock className="w-3 h-3" />
                  </button>
                </div>
                {activeTab === 'live' && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm border border-gray-100">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-[#6B5344] bg-[#F5D89A]">6</span>
                      <span className="text-[13px] font-bold text-[#D4A853] leading-none">$0.42</span>
                      <span className="text-[13px] font-medium leading-none text-gray-700">Changpeng Zhao</span>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm border border-gray-100">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-[#6B5344] bg-[#F5D89A]">1</span>
                      <span className="text-[13px] font-bold text-[#D4A853] leading-none">$1.25</span>
                      <span className="text-[13px] font-medium leading-none text-gray-700">Yi He</span>
                    </div>
                  </div>
                )}
                {activeTab === 'debug' && (
                  <div className="mt-2">
                    <span className="text-[11px] text-gray-400 font-mono">{t("System events and debug information")}</span>
                  </div>
                )}
              </div>

              {activeTab === 'live' ? (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {liveMessages.map((msg) => (
                      <div key={msg.id} data-testid={`chat-message-${msg.id}`}>
                        <div className="font-bold text-sm mb-1">
                          {msg.role === "assistant" ? (
                            <span className="text-[#D4A853]">Niya</span>
                          ) : (
                            <span className="text-gray-800">{msg.visitorName || "Viewer"}</span>
                          )}
                        </div>
                        <div className={clsx(
                          "rounded-xl px-4 py-3 text-sm",
                          msg.role === "assistant" 
                            ? "bg-[#F5D89A] text-[#6B5344]" 
                            : "bg-gray-100 text-gray-700"
                        )}>
                          {renderMessageWithStickers(msg.content)}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 border-t border-gray-100">
                    {walletConnected && (
                      <div className="flex items-center gap-2 mb-3 text-xs text-green-600">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span>{t("Connected")}: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
                        <span className="text-gray-400">• {t("Unlimited messages")}</span>
                      </div>
                    )}
                    {!walletConnected && (
                      <p className="text-gray-500 text-xs mb-3">{t("1 free message, then connect wallet for unlimited")}</p>
                    )}
                    {queuePosition && (
                      <p className="text-[#D4A853] text-xs mb-3 font-medium">{t("Position in queue")}: #{queuePosition}</p>
                    )}
                    <form onSubmit={handleLiveSend} className="flex gap-2 overflow-visible">
                      <input
                        type="text"
                        placeholder={walletConnected ? t("Chat unlimited...") : t("Type your free message...")}
                        value={liveInput}
                        onChange={(e) => setLiveInput(e.target.value)}
                        className="flex-1 px-4 py-3 bg-gray-50 rounded-xl text-sm text-gray-800 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D4A853]/50"
                        data-testid="input-live-message"
                        maxLength={200}
                        disabled={isSubmitting}
                      />
                      <div className="relative overflow-visible">
                        <StickerPicker 
                          onSelectSticker={(stickerUrl) => {
                            setLiveInput(prev => prev + ` [sticker:${stickerUrl}]`);
                          }}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting || !liveInput.trim()}
                        className="px-5 py-3 bg-[#F5D89A] hover:bg-[#E8D4A8] text-[#6B5344] rounded-xl text-sm font-bold transition-colors disabled:opacity-50"
                        data-testid="button-send-live"
                      >
                        {t("Send")}
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 border-b border-gray-200 flex flex-wrap gap-2 bg-gray-50">
                    <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={debugFilters.debug} 
                        onChange={(e) => setDebugFilters(f => ({...f, debug: e.target.checked}))}
                        className="w-3 h-3 accent-gray-500"
                      />
                      <span className="text-gray-500">debug</span>
                    </label>
                    <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={debugFilters.info} 
                        onChange={(e) => setDebugFilters(f => ({...f, info: e.target.checked}))}
                        className="w-3 h-3 accent-green-500"
                      />
                      <span className="text-green-600">info</span>
                    </label>
                    <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={debugFilters.warn} 
                        onChange={(e) => setDebugFilters(f => ({...f, warn: e.target.checked}))}
                        className="w-3 h-3 accent-yellow-500"
                      />
                      <span className="text-yellow-600">warn</span>
                    </label>
                    <label className="flex items-center gap-1 text-[10px] cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={debugFilters.error} 
                        onChange={(e) => setDebugFilters(f => ({...f, error: e.target.checked}))}
                        className="w-3 h-3 accent-red-500"
                      />
                      <span className="text-red-600">error</span>
                    </label>
                  </div>
                  <div 
                    ref={debugScrollRef}
                    onScroll={handleDebugScroll}
                    className="flex-1 overflow-y-auto p-2 space-y-1 bg-gray-50"
                  >
                    {(() => {
                      const filteredLogs = debugLogs.filter((log: any) => {
                        if (log.type === 'debug' && !debugFilters.debug) return false;
                        if ((log.type === 'info' || log.type === 'log') && !debugFilters.info) return false;
                        if (log.type === 'warn' && !debugFilters.warn) return false;
                        if (log.type === 'error' && !debugFilters.error) return false;
                        const logStr = [...(log.arguments || [])].map((v: unknown) => 
                          (typeof v === 'object') ? JSON.stringify(v) : String(v)
                        ).join(" ");
                        if (logStr.includes('i18next:') || 
                            logStr.includes('missingKey') || 
                            logStr.includes('languageChanged') ||
                            logStr.includes('[Fast Refresh]') ||
                            logStr.includes('[HMR]')) {
                          return false;
                        }
                        return true;
                      });
                      
                      if (filteredLogs.length === 0) {
                        return (
                          <div className="text-center py-8">
                            <CodeBracketIcon className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                            <p className="text-gray-400 text-sm">No debug logs yet</p>
                            <p className="text-gray-300 text-xs mt-1">Events will appear here</p>
                          </div>
                        );
                      }
                      
                      return filteredLogs.map((log: any, i: number) => {
                        const logMessage = [...(log.arguments || [])].map((v: unknown) =>
                          (typeof v === 'object') ? JSON.stringify(v) : String(v)
                        ).join(" ").slice(0, 500);
                        const isTruncated = [...(log.arguments || [])].map((v: unknown) =>
                          (typeof v === 'object') ? JSON.stringify(v) : String(v)
                        ).join(" ").length > 500;
                        
                        return (
                          <div 
                            key={log.ts + i} 
                            className={clsx(
                              "font-mono text-[11px] bg-white rounded-lg p-2 border",
                              log.type === 'error' ? "border-red-200 bg-red-50" :
                              log.type === 'warn' ? "border-yellow-200 bg-yellow-50" :
                              "border-gray-100"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-gray-400 text-[9px]">{new Date(log.ts).toLocaleTimeString()}</span>
                              <span className={clsx(
                                "px-1.5 py-0.5 rounded text-[9px] font-bold",
                                log.type === 'error' ? "bg-red-100 text-red-600" :
                                log.type === 'warn' ? "bg-yellow-100 text-yellow-600" :
                                (log.type === 'info' || log.type === 'log') ? "bg-green-100 text-green-600" :
                                "bg-gray-100 text-gray-600"
                              )}>
                                {log.type === 'log' ? 'INF' : log.type.toUpperCase().slice(0, 3)}
                              </span>
                            </div>
                            <p className={clsx(
                              "break-words leading-relaxed",
                              log.type === 'error' ? "text-red-700" :
                              log.type === 'warn' ? "text-yellow-700" :
                              "text-gray-700"
                            )}>
                              {logMessage}{isTruncated ? '...' : ''}
                            </p>
                          </div>
                        );
                      });
                    })()}
                    <div ref={debugEndRef} />
                  </div>
                  <div className="p-2 border-t border-gray-200 bg-white">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span className="font-mono">Niya v1.0</span>
                      <button 
                        onClick={() => {
                          (window as any).error_handler_logs = [];
                          setDebugLogs([]);
                        }}
                        className="hover:text-gray-600 transition-colors text-[10px]"
                        data-testid="button-clear-debug"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </>
              )}
              </div>
            {/* Close chat wrapper */}
            </div>
          </div>

          {/* BOTTOM INFO (frame v0) */}
          <div className="mt-10 relative">
            <div className="absolute -inset-3 bg-[#E8D4A8] rounded-[2rem] border-4 border-[#C9A86C]" />
            <div
              className="absolute -inset-1 bg-[#FFF8E7] rounded-[1.5rem] border-2 border-[#E8D4A8]"
              style={{ borderStyle: "dashed" }}
            />
            <div className="relative p-4 sm:p-6 lg:p-8 rounded-2xl border-2 border-[#E8D4A8] bg-[#FFFEF9] shadow-lg font-sans">
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_auto_auto_auto] gap-6 lg:gap-8 items-start">
              <div className="space-y-4">
                <div>
                  <div className="mb-2">
                    <img src="/images/45.png" alt="Niya" className="h-24 w-auto object-contain" />
                  </div>
                  <span className="inline-block mt-2 px-3 py-1 text-sm font-bold bg-gray-100 rounded-full border border-gray-300 text-black">
                    AI
                  </span>
                </div>
                <div className="text-gray-700 text-base leading-relaxed">
                  <p className="text-black">
                    {t("niya_description_short")}
                    {showMore && t("niya_description_long")}
                  </p>
                  <button
                    onClick={() => setShowMore(!showMore)}
                    className="text-[#D4A853] hover:underline mt-2 text-base font-bold"
                  >
                    {showMore ? t("Show Less") : t("Show More")}
                  </button>
                </div>
                <a
                  href="https://niyaagent.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 border border-gray-300 rounded-xl hover:border-[#D4A853] transition-colors text-base text-black"
                >
                  <span>https://niyaagent.com</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

              <div className="space-y-5">
                <div className="flex flex-col gap-4">
                  <div className="flex gap-8">
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1 font-bold">
                        <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs">{t("CONTRACT")}</span>
                        {bnbTokenCA && (
                          <a href={`https://bscscan.com/token/${bnbTokenCA}`} target="_blank" rel="noopener noreferrer" data-testid="link-bnb-bscscan">
                            <ExternalLink className="w-4 h-4 hover:text-[#D4A853]" />
                          </a>
                        )}
                        {bnbTokenCA && (
                          <button onClick={() => handleCopy("contract", bnbTokenCA)} data-testid="button-copy-contract">
                            {copied === "contract" ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-base font-mono text-black" data-testid="text-contract-address">
                        {bnbTokenConfigured && bnbTokenCA 
                          ? `${bnbTokenCA.slice(0, 6)}...${bnbTokenCA.slice(-4)}` 
                          : "TBA"}
                        {bnbTokenData?.phase === 'bonding' && bnbTokenConfigured && (
                          <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded">Bonding</span>
                        )}
                        {bnbTokenData?.phase === 'graduated' && bnbTokenConfigured && (
                          <span className="ml-2 text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded">PancakeSwap</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1 font-bold">
                        <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs">{t("WALLET")}</span>
                        {agentWallet && (
                          <a href={`https://bscscan.com/address/${agentWallet}`} target="_blank" rel="noopener noreferrer" data-testid="link-wallet-bscscan">
                            <ExternalLink className="w-4 h-4 hover:text-[#D4A853]" />
                          </a>
                        )}
                        {agentWallet && (
                          <button onClick={() => handleCopy("wallet", agentWallet)} data-testid="button-copy-wallet">
                            {copied === "wallet" ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        )}
                      </div>
                      <p className="text-base font-mono text-black" data-testid="text-wallet-address">
                        {agentWalletConfigured && agentWallet 
                          ? `${agentWallet.slice(0, 6)}...${agentWallet.slice(-4)}` 
                          : "TBA"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-8 pt-4 border-t border-gray-300">
                  <div>
                    <p className="text-sm text-gray-500 font-bold">{t("Market Cap")}</p>
                    <p className="text-2xl font-bold text-black">
                      {bnbTokenLoading ? "..." : 
                        bnbTokenData?.marketCap !== undefined && bnbTokenData.marketCap > 0
                          ? `$${bnbTokenData.marketCap.toLocaleString(undefined, {maximumFractionDigits: 0})}` 
                          : "$--"}
                    </p>
                    <p className="text-sm text-gray-400">BNB Chain</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 font-bold">{t("24H Change")}</p>
                    <p className="text-2xl font-bold text-black">
                      {bnbTokenLoading ? "..." : 
                        bnbTokenData?.change24h !== undefined
                          ? <span className={bnbTokenData.change24h >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {bnbTokenData.change24h >= 0 ? '+' : ''}{bnbTokenData.change24h.toFixed(2)}%
                            </span>
                          : "--"}
                    </p>
                    <p className="text-sm text-gray-400">
                      {bnbTokenData?.price ? `$${bnbTokenData.price.toFixed(8)}` : ""}
                    </p>
                  </div>
                  <div className="opacity-50">
                    <p className="text-sm text-gray-500 font-bold">{t("SUBSCRIBERS")}</p>
                    <p className="text-2xl font-bold text-black">0</p>
                    <p className="text-xs text-gray-400">{t("Coming soon")}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 min-w-0 opacity-50">
                    <div className="flex items-center justify-between">
                      <span className="text-base text-gray-500 font-bold">{t("TRADE")}</span>
                      <Lock className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex gap-3">
                      <button className="flex items-center gap-2 bg-gray-300 text-gray-500 font-bold text-base px-6 py-2.5 rounded-lg cursor-not-allowed" disabled>
                        <Heart className="w-5 h-5" />
                        {t("BUY")}
                      </button>
                      <button className="flex items-center gap-2 border border-gray-300 bg-gray-100 text-gray-500 font-bold text-base px-6 py-2.5 rounded-lg cursor-not-allowed" disabled>
                        <Minus className="w-5 h-5" />
                        {t("SELL")}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">{t("Coming soon")}</p>
                  </div>

                  <div className="space-y-3 min-w-0 opacity-50">
                    <div className="flex items-center justify-between">
                      <span className="text-base text-gray-500 font-bold">{t("SUBSCRIBE")}</span>
                      <Lock className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex gap-3">
                      <button className="flex items-center gap-2 bg-gray-200 text-gray-500 font-bold border border-gray-300 text-base px-6 py-2.5 rounded-lg cursor-not-allowed" disabled>
                        <Lock className="w-5 h-5" />
                        SUB
                      </button>
                      <button className="flex items-center gap-2 text-gray-400 font-bold text-base px-6 py-2.5 rounded-lg cursor-not-allowed" disabled>
                        <Lock className="w-5 h-5" />
                        {t("UNSUB")}
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">{t("Coming soon")}</p>
                  </div>
                </div>

                <div className="space-y-3 min-w-0">
                  <span className="text-base text-gray-500 font-bold">{t("FOLLOW")}</span>
                  <a 
                    href="https://x.com/NiyaAgent" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-3 bg-black hover:bg-gray-800 text-white font-bold text-base px-6 py-3 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                    style={{ width: 'calc(50% - 12px)' }}
                    data-testid="link-twitter-social"
                  >
                    <X className="w-5 h-5" />
                    <span>@NiyaAgent</span>
                    <ExternalLink className="w-4 h-4 opacity-70" />
                  </a>
                </div>
              </div>

              <div className="min-w-0">
                <BinanceIntelligenceWidget />
              </div>
            </div>
          </div>
          {/* Close bottom wrapper */}
          </div>
        </div>

        <BrainPanel
          thoughts={subconciousLogs}
          currentThought={thoughtMessage}
          isOpen={showBrainPanel}
          onClose={() => setShowBrainPanel(false)}
        />

        <AboutPanel
          isOpen={showAboutPanel}
          onClose={() => setShowAboutPanel(false)}
        />

        {showDebug && <DebugPane onClickClose={() => setShowDebug(false)} />}
        {config("chatbot_backend") === "moshi" && <Moshi setAssistantText={setAssistantMessage} />}
        
        {thoughtMessage !== "" && !showBrainPanel && <ThoughtText message={thoughtMessage} />}
        
        <AIThinkingIndicator isThinking={chatProcessing} />
        <Alert />
        <LiveShowProcessor />
        <LoadingProgress />
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          chatMessages={liveMessages}
          characterName="Niya"
          viewerContainerId="viewer-container"
        />

        {showWalletModal && (
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
            data-testid="wallet-modal"
          >
            <div className="bg-gradient-to-br from-[#FFF8E7] to-[#E8D4A8] p-6 rounded-2xl border-2 border-[#C9A86C] max-w-sm mx-4 shadow-2xl">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="w-6 h-6 text-[#C9A86C]" />
                  <h3 className="text-[#6B5344] font-bold text-lg">Connect Wallet</h3>
                </div>
                <button
                  onClick={() => setShowWalletModal(false)}
                  className="text-[#6B5344]/60 transition-colors hover-elevate"
                  data-testid="button-close-wallet-modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <p className="text-[#6B5344]/80 text-sm mb-4">
                You&apos;ve used your free message! Connect an EVM wallet (MetaMask, Trust Wallet, etc.) to continue chatting with Niya.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={connectWallet}
                  disabled={walletPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#F5D89A] border border-[#C9A86C] text-[#6B5344] rounded-xl text-sm font-bold transition-colors disabled:opacity-50 shadow-md hover-elevate active-elevate-2"
                  data-testid="button-connect-wallet-modal"
                >
                  {walletPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#6B5344] border-t-transparent rounded-full animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4" />
                      Connect EVM Wallet
                    </>
                  )}
                </button>
                
                <p className="text-[#6B5344]/50 text-xs text-center">
                  BNB Chain • MetaMask • Trust Wallet
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </NotificationProvider>
  );
}
