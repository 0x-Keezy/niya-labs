import { useState, useEffect, useRef, useContext, useCallback } from "react";
import { ChatContext } from "@/features/chat/chatContext";
import { broadcastManager } from "@/features/broadcast/broadcastManager";
import { Wallet, X } from "lucide-react";
import { StickerPicker } from "./stickerPicker";

// Module-level singleton lock to prevent double processing across React StrictMode mounts
// and multiple component instances
class ProcessingLock {
  private static instance: ProcessingLock;
  private _isProcessing: boolean = false;
  private _isAccumulating: boolean = false;
  private _accumulationTimer: NodeJS.Timeout | null = null;
  private _processorId: string | null = null;

  static getInstance(): ProcessingLock {
    if (!ProcessingLock.instance) {
      ProcessingLock.instance = new ProcessingLock();
    }
    return ProcessingLock.instance;
  }

  acquireProcessing(processorId: string): boolean {
    if (this._isProcessing) {
      console.log(`[ProcessingLock] Processing locked by ${this._processorId}, rejecting ${processorId}`);
      return false;
    }
    this._isProcessing = true;
    this._processorId = processorId;
    console.log(`[ProcessingLock] Processing acquired by ${processorId}`);
    return true;
  }

  releaseProcessing(processorId: string): void {
    if (this._processorId === processorId) {
      this._isProcessing = false;
      this._processorId = null;
      console.log(`[ProcessingLock] Processing released by ${processorId}`);
    }
  }

  get isProcessing(): boolean {
    return this._isProcessing;
  }

  get isAccumulating(): boolean {
    return this._isAccumulating;
  }

  startAccumulation(callback: () => void, delayMs: number): boolean {
    if (this._isAccumulating || this._isProcessing) {
      return false;
    }
    this._isAccumulating = true;
    console.log(`[ProcessingLock] Accumulation started, waiting ${delayMs}ms`);
    this._accumulationTimer = setTimeout(() => {
      this._isAccumulating = false;
      callback();
    }, delayMs);
    return true;
  }

  cancelAccumulation(): void {
    if (this._accumulationTimer) {
      clearTimeout(this._accumulationTimer);
      this._accumulationTimer = null;
    }
    this._isAccumulating = false;
  }
}

const processingLock = ProcessingLock.getInstance();

interface ChatMessage {
  id: number;
  visitorId: string | null;
  visitorName: string | null;
  role: string;
  content: string;
  emotion: string | null;
  createdAt: string;
}

interface QueueItem {
  id: number;
  visitorId: string;
  visitorName: string;
  message: string;
  position: number;
  createdAt: string;
}

interface LiveChatProps {
  onProcessMessage?: (message: string, visitorName: string, queueId: number) => void;
}

function generateVisitorId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("niya_visitor_id");
  if (!id) {
    id = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("niya_visitor_id", id);
  }
  return id;
}

export function LiveChat({ onProcessMessage }: LiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [visitorId, setVisitorId] = useState("");
  const [myPosition, setMyPosition] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({ queueLength: 0, activeViewers: 0 });
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletPending, setWalletPending] = useState(false);
  const { chat: bot } = useContext(ChatContext);

  useEffect(() => {
    const id = generateVisitorId();
    setVisitorId(id);
    
    const savedName = localStorage.getItem("niya_visitor_name") || "";
    setVisitorName(savedName);
    
    const savedWallet = localStorage.getItem("niya_wallet_address") || "";
    setWalletAddress(savedWallet);
    
    checkWalletConnection();
  }, []);
  
  function getEthereumProvider() {
    if (typeof window === "undefined") return null;
    const win = window as any;
    if (win.phantom?.ethereum) return win.phantom.ethereum;
    if (win.trustwallet?.ethereum) return win.trustwallet.ethereum;
    if (win.coinbaseWalletExtension) return win.coinbaseWalletExtension;
    if (win.okxwallet) return win.okxwallet;
    if (win.rabby) return win.rabby;
    return win.ethereum;
  }
  
  async function checkWalletConnection() {
    const ethereum = getEthereumProvider();
    if (!ethereum) return;
    
    try {
      const accounts = await ethereum.request({ method: 'eth_accounts' });
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
        localStorage.setItem("niya_wallet_address", accounts[0]);
      }
    } catch (err) {
      console.warn("[LiveChat] Failed to check wallet:", err);
    }
  }
  
  async function connectWallet() {
    const ethereum = getEthereumProvider();
    
    if (!ethereum) {
      window.open('https://metamask.io/download/', '_blank');
      return;
    }
    
    setWalletPending(true);
    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setWalletAddress(accounts[0]);
        localStorage.setItem("niya_wallet_address", accounts[0]);
        setShowWalletModal(false);
      }
    } catch (err) {
      console.error("[LiveChat] Wallet connection failed:", err);
    } finally {
      setWalletPending(false);
    }
  }

  // Track processed SSE timestamps to prevent duplicate processing of the same broadcast event
  // This is different from content dedup - it prevents processing the same SSE event twice
  const processedSseTimestampsRef = useRef<Set<number>>(new Set());
  
  useEffect(() => {
    fetchMessages();
    fetchQueue();
    fetchStats();

    // Viewers poll less frequently since they receive real-time updates via SSE
    // Host needs faster polling to see user messages
    const isHost = broadcastManager.isHost();
    const messageInterval = setInterval(fetchMessages, isHost ? 3000 : 10000);
    const queueInterval = setInterval(fetchQueue, isHost ? 3000 : 10000);
    const statsInterval = setInterval(fetchStats, 30000);

    // Listen for instant refresh events from LiveShowProcessor (host only)
    const handleLiveChatRefresh = () => {
      console.log("[LiveChat] Instant refresh triggered");
      fetchMessages();
      fetchQueue();
    };
    window.addEventListener('livechat-refresh', handleLiveChatRefresh);
    
    // Subscribe to SSE sync events to receive Niya's messages in real-time
    // This ensures viewers see chat messages synchronized with audio/subtitles
    const unsubscribe = broadcastManager.subscribe((data: any) => {
      if (data.type === 'sync' && data.chatMessage && !broadcastManager.isHost()) {
        // Use the stable database ID from the broadcast event
        // This ensures all viewers have the same ID and dedup works correctly
        const messageId = data.chatMessage.id;
        const broadcastTimestamp = data.timestamp || Date.now();
        
        // Skip if we've already processed this exact broadcast event (by timestamp)
        if (processedSseTimestampsRef.current.has(broadcastTimestamp)) {
          console.log("[LiveChat] Already processed SSE timestamp:", broadcastTimestamp);
          return;
        }
        
        // Mark this timestamp as processed
        processedSseTimestampsRef.current.add(broadcastTimestamp);
        
        // Clean up old timestamps (keep last 100 to prevent memory leak)
        if (processedSseTimestampsRef.current.size > 100) {
          const timestamps = Array.from(processedSseTimestampsRef.current).sort((a, b) => a - b);
          timestamps.slice(0, 50).forEach(ts => processedSseTimestampsRef.current.delete(ts));
        }
        
        const sseMsg: ChatMessage = {
          id: messageId, // Use the stable DB ID from broadcast
          visitorId: null,
          visitorName: null,
          role: data.chatMessage.role,
          content: data.chatMessage.content,
          emotion: null,
          createdAt: new Date(broadcastTimestamp).toISOString(),
        };
        
        // Add immediately for synchronized display, avoiding duplicates by ID
        setMessages(prev => {
          // Check if message with this ID already exists
          if (prev.some(m => m.id === messageId)) {
            console.log("[LiveChat] Message already exists with ID:", messageId);
            return prev;
          }
          console.log("[LiveChat] Added synchronized SSE message (ID: %d):", messageId, sseMsg.content.substring(0, 50));
          return [...prev, sseMsg];
        });
      }
    });

    return () => {
      clearInterval(messageInterval);
      clearInterval(queueInterval);
      clearInterval(statsInterval);
      window.removeEventListener('livechat-refresh', handleLiveChatRefresh);
      unsubscribe();
    };
  }, []);

  // Auto-scroll to bottom on mount and when new messages arrive
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  
  // Track if user is manually scrolling up (to avoid interrupting their reading)
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    // If user scrolled up significantly, don't auto-scroll
    if (scrollTop < lastScrollTopRef.current - 50) {
      isUserScrollingRef.current = true;
    }
    
    // If user is near bottom, resume auto-scroll
    if (isNearBottom) {
      isUserScrollingRef.current = false;
    }
    
    lastScrollTopRef.current = scrollTop;
  }, []);
  
  // Scroll to bottom on mount
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);
  
  // Scroll to bottom when new messages arrive (unless user is reading history)
  useEffect(() => {
    if (!isUserScrollingRef.current && messages.length > 0) {
      const container = scrollContainerRef.current;
      if (container) {
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          });
        }, 50);
      }
    }
  }, [messages.length]);

  useEffect(() => {
    if (visitorId && queue.length > 0) {
      const myItems = queue.filter(q => q.visitorId === visitorId);
      if (myItems.length > 0) {
        setMyPosition(myItems[0].position);
      } else {
        setMyPosition(null);
      }
    }
  }, [queue, visitorId]);

  async function fetchMessages() {
    try {
      const apiUrl = `${window.location.origin}/api/liveshow/messages?limit=50`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const serverData: ChatMessage[] = await res.json();
        
        // Merge SSE messages with server data
        // Both now use the same stable DB IDs, so we can merge by ID
        setMessages(prev => {
          // Create a map of server messages by ID
          const serverIds = new Set(serverData.map(m => m.id));
          
          // Keep SSE messages that aren't in server data yet
          // This preserves the instant display until server catches up
          const sseOnlyMessages = prev.filter(m => !serverIds.has(m.id));
          
          // Combine: server data + SSE messages not yet in server
          // Server data comes first (chronologically), SSE messages appended
          return [...serverData, ...sseOnlyMessages];
        });
      }
    } catch (e: any) {
      const stack = e?.stack || '';
      const isReplitDevtoolsIssue = stack.includes('__replco') || stack.includes('injected.js');
      if (isReplitDevtoolsIssue) {
        console.warn("[LiveChat] Fetch blocked by Replit devtools - open in new tab for full functionality");
      } else {
        console.error("[LiveChat] Failed to fetch messages:", e?.message || e);
      }
    }
  }

  async function fetchQueue() {
    try {
      const apiUrl = `${window.location.origin}/api/liveshow/queue`;
      const res = await fetch(apiUrl);
      if (res.ok) {
        const data = await res.json();
        console.log("[LiveChat] Queue received:", data.length, "items");
        setQueue(data);
      }
    } catch (e) {
      console.error("[LiveChat] Failed to fetch queue:", e);
    }
  }

  async function fetchStats() {
    try {
      const res = await fetch("/api/liveshow/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!inputMessage.trim() || !visitorName.trim()) return;
    
    setIsSubmitting(true);
    
    try {
      localStorage.setItem("niya_visitor_name", visitorName);
      
      const apiUrl = `${window.location.origin}/api/liveshow/queue`;
      console.log("[LiveChat] Submitting message to:", apiUrl);
      
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          visitorName: visitorName.trim(),
          message: inputMessage.trim(),
          saveUserMessage: true,
          walletAddress: walletAddress || null,
        }),
      });

      console.log("[LiveChat] Submit response status:", res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log("[LiveChat] Message submitted successfully:", data);
        setInputMessage("");
        setMyPosition(data.position);
        fetchQueue();
        fetchMessages();
      } else if (res.status === 403) {
        const error = await res.json();
        if (error.error === "wallet_required") {
          setShowWalletModal(true);
        } else {
          alert(error.message || "Access denied");
        }
      } else {
        const error = await res.json();
        console.error("[LiveChat] Submit error:", error);
        alert(error.error || "Failed to send message");
      }
    } catch (e) {
      console.error("[LiveChat] Failed to submit message:", e);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div 
      className="fixed left-4 top-4 bottom-32 w-80 flex flex-col z-20 pointer-events-none"
      data-testid="live-chat-container"
    >
      <div className="p-3 bg-black/20 backdrop-blur-sm rounded-t-lg border-b border-white/10 pointer-events-auto">
        <div className="flex justify-between items-center text-white/80">
          <span className="font-bold text-sm tracking-wider uppercase">Live Chat</span>
          <div className="flex gap-3 text-[10px] font-medium opacity-60">
            <span data-testid="text-viewer-count">{stats.activeViewers} watching</span>
            <span data-testid="text-queue-count">{stats.queueLength} in queue</span>
          </div>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-3 pointer-events-auto scrollbar-hide bg-gradient-to-r from-black/40 to-transparent"
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="group animate-in fade-in slide-in-from-left-4 duration-300 max-w-[85%]"
            data-testid={`message-${msg.id}`}
          >
            <div className="flex flex-col bg-black/20 backdrop-blur-sm p-2 rounded-lg border-l-2 border-white/5 hover:bg-black/40 transition-colors">
              <span className={`text-[10px] font-bold uppercase tracking-tighter ${
                msg.role === "assistant" ? "text-purple-400" : "text-pink-400"
              }`}>
                {msg.role === "assistant" ? "Niya" : (msg.visitorName || "Viewer")}
              </span>
              <div className="text-white text-sm leading-relaxed drop-shadow-md flex flex-wrap items-center gap-1">
                {msg.content.split(/(\[sticker:[^\]]+\])/).map((part, i) => {
                  const stickerMatch = part.match(/\[sticker:([^\]]+)\]/);
                  if (stickerMatch) {
                    return (
                      <img 
                        key={i}
                        src={stickerMatch[1]} 
                        alt="sticker" 
                        className="w-6 h-6 inline-block object-contain"
                      />
                    );
                  }
                  const cleanText = part.replace(/\[[a-zA-Z]+\]/g, '').trim();
                  return cleanText ? <span key={i}>{cleanText}</span> : null;
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {myPosition && (
        <div className="bg-pink-600/40 backdrop-blur-md p-1.5 text-center text-white text-[10px] font-bold uppercase tracking-widest pointer-events-auto">
          Position in queue: #{myPosition}
        </div>
      )}

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl px-4 pointer-events-auto z-10">
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 overflow-visible">
          {!visitorName && (
            <input
              type="text"
              placeholder="Your name..."
              value={visitorName}
              onChange={(e) => setVisitorName(e.target.value)}
              className="w-full px-4 py-2 bg-black/40 text-white rounded-full text-xs border border-white/10 focus:outline-none focus:ring-1 focus:ring-purple-500 backdrop-blur-md"
              data-testid="input-visitor-name"
              maxLength={20}
            />
          )}
          <div className="relative group overflow-visible">
            {walletAddress && (
              <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Wallet className="w-3 h-3 text-green-400" />
              </div>
            )}
            <input
              type="text"
              placeholder={walletAddress ? "Chat unlimited with wallet..." : "1 free message, then connect wallet..."}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className={`w-full px-6 py-4 bg-black/60 text-white rounded-full text-sm border border-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500 backdrop-blur-lg transition-all pr-28 ${walletAddress ? 'pl-8' : ''}`}
              data-testid="input-message"
              maxLength={200}
              disabled={isSubmitting}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <StickerPicker 
                onSelectSticker={(stickerUrl) => {
                  setInputMessage(prev => prev + ` [sticker:${stickerUrl}]`);
                }}
              />
              <button
                type="submit"
                disabled={isSubmitting || !inputMessage.trim() || !visitorName.trim()}
                className="p-2 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-full text-xs font-bold uppercase tracking-widest transition-colors disabled:opacity-30"
                data-testid="button-send-message"
              >
                Send
              </button>
            </div>
          </div>
        </form>
      </div>

      {showWalletModal && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto"
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
  );
}

export function LiveShowProcessor() {
  const { chat: bot } = useContext(ChatContext);
  const [botReady, setBotReady] = useState(false);
  const currentQueueIdRef = useRef<number | null>(null);
  const responseCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Unique ID for this processor instance (for lock ownership tracking)
  const processorIdRef = useRef<string>(`processor_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`);
  
  // Configurable accumulation window: wait this many ms for more messages before processing
  // Random between 2-5 seconds for natural conversation pacing
  const getAccumulationWindow = () => Math.floor(Math.random() * 3000) + 2000; // 2000-5000ms

  // Log on mount and cleanup on unmount
  useEffect(() => {
    console.log("[LiveShowProcessor] Component mounted, bot exists:", !!bot, "bot.initialized:", bot?.initialized, "processorId:", processorIdRef.current);
    
    return () => {
      // Release any locks held by this processor on unmount
      processingLock.releaseProcessing(processorIdRef.current);
      processingLock.cancelAccumulation();
    };
  }, []);

  // Check for bot initialization every second until ready
  useEffect(() => {
    const checkInit = setInterval(() => {
      if (bot?.initialized && !botReady) {
        console.log("[LiveShowProcessor] Bot initialized - starting queue processor");
        setBotReady(true);
      }
    }, 1000);
    return () => clearInterval(checkInit);
  }, [bot, botReady]);

  // Only start the queue polling once bot is ready
  useEffect(() => {
    if (!botReady) return;
    
    console.log("[LiveShowProcessor] Queue polling started");
    
    const interval = setInterval(() => {
      checkForNewMessages();
    }, 2000); // Check every 2 seconds for new messages
    
    // Initial check after a short delay
    setTimeout(() => checkForNewMessages(), 500);
    
    return () => {
      clearInterval(interval);
      if (responseCheckIntervalRef.current) {
        clearInterval(responseCheckIntervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      processingLock.cancelAccumulation();
    };
  }, [botReady]);

  // Check if there are pending messages and start accumulation window if so
  async function checkForNewMessages() {
    // Only the host can process messages
    if (!broadcastManager.isHost()) {
      console.debug("[LiveShowProcessor] Not host, skipping message processing");
      return;
    }
    
    // Skip if already processing or accumulating (using singleton lock)
    if (processingLock.isProcessing || processingLock.isAccumulating) {
      return;
    }
    
    try {
      // Quick check if there are any pending messages (without claiming them)
      const res = await fetch(`${window.location.origin}/api/liveshow/queue?checkPending=true`);
      if (!res.ok) return;
      
      const data = await res.json();
      const hasPending = data.some?.((item: any) => item.status === 'pending') || 
                         (Array.isArray(data) && data.length > 0);
      
      if (hasPending) {
        // Start accumulation window - wait for more messages before processing
        const waitTime = getAccumulationWindow();
        const started = processingLock.startAccumulation(() => {
          processAccumulatedMessages();
        }, waitTime);
        
        if (started) {
          console.log(`[LiveShowProcessor] Messages detected, waiting ${waitTime}ms to accumulate more...`);
        }
      }
    } catch (e) {
      // Silently ignore check errors
    }
  }

  async function completeQueueItem(queueId: number, response: string) {
    try {
      console.log("[LiveShowProcessor] Completing queue item:", queueId);
      const apiUrl = `${window.location.origin}/api/liveshow/next`;
      await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueId,
          response,
        }),
      });
      console.log("[LiveShowProcessor] Queue item marked as answered");
      
      // Trigger instant refresh of LiveChat component
      window.dispatchEvent(new CustomEvent('livechat-refresh'));
    } catch (e) {
      console.error("[LiveShowProcessor] Failed to mark queue item as processed:", e);
    } finally {
      currentQueueIdRef.current = null;
      processingLock.releaseProcessing(processorIdRef.current);
      if (responseCheckIntervalRef.current) {
        clearInterval(responseCheckIntervalRef.current);
        responseCheckIntervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }

  // Process all accumulated messages after the accumulation window has passed
  async function processAccumulatedMessages() {
    // Only the host can process messages - viewers receive synced content via broadcast
    if (!broadcastManager.isHost()) {
      console.debug("[LiveShowProcessor] Not host, skipping message processing");
      return;
    }
    
    // Try to acquire the processing lock (singleton pattern prevents double processing)
    if (!processingLock.acquireProcessing(processorIdRef.current)) {
      console.log("[LiveShowProcessor] Already processing, skipping...");
      return;
    }
    
    if (!bot || !bot.receiveMessageFromUser) {
      console.debug("[LiveShowProcessor] Bot not available");
      processingLock.releaseProcessing(processorIdRef.current);
      return;
    }

    try {
      console.log("[LiveShowProcessor] Processing accumulated messages after wait window...");
      
      // Use batch endpoint to get ALL pending messages at once
      const apiUrl = `${window.location.origin}/api/liveshow/batch?limit=10`;
      const res = await fetch(apiUrl);
      
      if (!res.ok) {
        console.error("[LiveShowProcessor] API error:", res.status, res.statusText);
        processingLock.releaseProcessing(processorIdRef.current);
        return;
      }
      
      const data = await res.json();
      
      if (!data.items || data.items.length === 0) {
        console.log("[LiveShowProcessor] No pending messages in queue");
        processingLock.releaseProcessing(processorIdRef.current);
        return;
      }

      console.log("[LiveShowProcessor] Processing batch of", data.items.length, "messages");
      
      // Store all queue IDs for batch completion
      const queueIds = data.items.map((item: any) => item.id);
      currentQueueIdRef.current = queueIds[0];

      // Combine all messages into a single context-aware message
      // Niya responds to the CONTEXT of what viewers are saying, not to each message individually
      let combinedMessage: string;
      
      if (data.items.length === 1) {
        // Single message - treat as context for Niya to react to
        const item = data.items[0];
        const visitorName = item.visitorName || item.visitorId?.substring(0, 8) || 'Viewer';
        combinedMessage = `[STREAM CHAT] ${visitorName}: ${item.message}`;
      } else {
        // Multiple messages - combine as stream chat context
        // Niya should react to the overall conversation, not reply to each person
        const messageParts = data.items.map((item: any) => {
          const visitorName = item.visitorName || item.visitorId?.substring(0, 8) || 'Viewer';
          return `${visitorName}: ${item.message}`;
        });
        combinedMessage = `[STREAM CHAT]\n${messageParts.join('\n')}`;
      }

      console.log("[LiveShowProcessor] Combined message:", combinedMessage.substring(0, 100) + "...");

      const messagesBefore = bot.messageList?.length || 0;

      try {
        console.log("[LiveShowProcessor] Sending to bot (awaiting full response including TTS)...");
        // IMPORTANT: await the async function so TTS jobs get enqueued properly
        await bot.receiveMessageFromUser(combinedMessage, false);
        console.log("[LiveShowProcessor] Bot processing complete (TTS should be enqueued)");
        
        // After processing is complete, mark the batch as answered
        const lastMessage = bot.messageList?.[bot.messageList.length - 1];
        if (lastMessage?.role === "assistant") {
          await completeBatchQueueItems(queueIds, lastMessage.content);
        } else {
          await completeBatchQueueItems(queueIds, "");
        }
        return;
      } catch (botError) {
        console.error("[LiveShowProcessor] Bot processing error, reverting queue items:", botError);
        // Revert queue items to pending status so they can be retried
        await revertBatchQueueItems(queueIds);
        processingLock.releaseProcessing(processorIdRef.current);
        return;
      }

    } catch (e: any) {
      const errorName = e?.name || 'Unknown';
      const errorMsg = e?.message || String(e);
      const apiUrl = `${window.location.origin}/api/liveshow/batch`;
      const stack = e?.stack || '';
      
      const isReplitDevtoolsIssue = stack.includes('__replco') || stack.includes('injected.js');
      
      if (isReplitDevtoolsIssue) {
        console.warn("[LiveShowProcessor] Fetch blocked by Replit devtools - this is normal in the embedded preview. Open in a new tab for full functionality.");
      } else {
        console.error("[LiveShowProcessor] Fetch error:", {
          name: errorName,
          message: errorMsg,
          online: navigator.onLine,
          targetUrl: apiUrl,
        });
      }
      processingLock.releaseProcessing(processorIdRef.current);
    }
  }

  async function revertBatchQueueItems(queueIds: number[]) {
    try {
      console.log("[LiveShowProcessor] Reverting", queueIds.length, "queue items to pending");
      const apiUrl = `${window.location.origin}/api/liveshow/batch`;
      await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueIds,
          revert: true,
        }),
      });
      console.log("[LiveShowProcessor] Queue items reverted to pending");
    } catch (e) {
      console.error("[LiveShowProcessor] Failed to revert batch:", e);
    }
  }

  async function completeBatchQueueItems(queueIds: number[], response: string) {
    try {
      console.log("[LiveShowProcessor] Completing batch of", queueIds.length, "queue items");
      const apiUrl = `${window.location.origin}/api/liveshow/batch`;
      await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueIds,
          response,
        }),
      });
      console.log("[LiveShowProcessor] Batch marked as answered");
      
      // Trigger instant refresh of LiveChat component
      window.dispatchEvent(new CustomEvent('livechat-refresh'));
    } catch (e) {
      console.error("[LiveShowProcessor] Failed to complete batch:", e);
    } finally {
      currentQueueIdRef.current = null;
      processingLock.releaseProcessing(processorIdRef.current);
      if (responseCheckIntervalRef.current) {
        clearInterval(responseCheckIntervalRef.current);
        responseCheckIntervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }

  return null;
}
