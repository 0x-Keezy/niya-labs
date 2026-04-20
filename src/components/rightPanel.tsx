import { useState, useEffect, useRef, useContext } from "react";
import { ChatContext } from "@/features/chat/chatContext";
import { Message } from "@/features/chat/messages";

interface ChatMessage {
  id: number;
  visitorId: string | null;
  visitorName: string | null;
  role: string;
  content: string;
  emotion: string | null;
  createdAt: string;
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

interface RightPanelProps {
  chatLog: Message[];
  isOpen: boolean;
}

export function RightPanel({ chatLog, isOpen }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<"live" | "history">("live");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [visitorName, setVisitorName] = useState("");
  const [visitorId, setVisitorId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState({ queueLength: 0, activeViewers: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = generateVisitorId();
    setVisitorId(id);
    const savedName = localStorage.getItem("niya_visitor_name") || "";
    setVisitorName(savedName);
  }, []);

  useEffect(() => {
    if (activeTab === "live") {
      fetchMessages();
      fetchStats();
      const messageInterval = setInterval(fetchMessages, 30000);
      const statsInterval = setInterval(fetchStats, 60000);
      return () => {
        clearInterval(messageInterval);
        clearInterval(statsInterval);
      };
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "live") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else {
      historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, chatLog, activeTab]);

  async function fetchMessages() {
    try {
      const res = await fetch("/api/liveshow/messages?limit=50");
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error("Failed to fetch messages:", e);
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
      
      const res = await fetch("/api/liveshow/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visitorId,
          visitorName: visitorName.trim(),
          message: inputMessage.trim(),
        }),
      });

      if (res.ok) {
        setInputMessage("");
        fetchMessages();
      } else {
        const error = await res.json();
        alert(error.error || "Failed to send message");
      }
    } catch (e) {
      console.error("Failed to submit message:", e);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div 
      className="w-80 h-full flex flex-col bg-white border-l border-gray-200"
      data-testid="right-panel"
    >
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab("live")}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${
            activeTab === "live" 
              ? "text-amber-600 border-b-2 border-amber-500" 
              : "text-gray-500 hover:text-gray-700"
          }`}
          data-testid="tab-live-chat"
        >
          Live Chat
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${
            activeTab === "history" 
              ? "text-amber-600 border-b-2 border-amber-500" 
              : "text-gray-500 hover:text-gray-700"
          }`}
          data-testid="tab-chat-history"
        >
          Chat History
        </button>
      </div>

      {activeTab === "live" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-xs">
            <div className="flex gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-amber-600 font-bold">{stats.activeViewers}</span>
                <span className="text-gray-500">watching</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-gray-600 font-bold">{stats.queueLength}</span>
                <span className="text-gray-500">in queue</span>
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className="group" data-testid={`live-message-${msg.id}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <span className={`text-xs font-bold ${
                      msg.role === "assistant" ? "text-amber-600" : "text-gray-700"
                    }`}>
                      {msg.role === "assistant" ? "Niya" : (msg.visitorName || "Viewer")}
                    </span>
                    <p className="text-gray-600 text-sm mt-0.5">
                      {msg.content.replace(/\[[a-zA-Z]+\]/g, '').trim()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 border-t border-gray-200">
            <p className="text-xs text-gray-600 font-medium mb-2">Join the chat</p>
            {!visitorName && (
              <input
                type="text"
                placeholder="Your name..."
                value={visitorName}
                onChange={(e) => setVisitorName(e.target.value)}
                className="w-full mb-2 px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                data-testid="input-visitor-name"
                maxLength={20}
              />
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Type a message..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                data-testid="input-live-message"
                maxLength={200}
                disabled={isSubmitting}
              />
              <button
                type="submit"
                disabled={isSubmitting || !inputMessage.trim() || !visitorName.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                data-testid="button-send-live"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatLog.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8">
                No chat history yet
              </div>
            ) : (
              chatLog.map((msg, index) => (
                <div key={index} className="group" data-testid={`history-message-${index}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <span className={`text-xs font-bold ${
                        msg.role === "assistant" ? "text-amber-600" : "text-gray-700"
                      }`}>
                        {msg.role === "assistant" ? "Niya" : "You"}
                      </span>
                      <p className="text-gray-600 text-sm mt-0.5">
                        {msg.content.replace(/\[[a-zA-Z]+\]/g, '').trim()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={historyEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
