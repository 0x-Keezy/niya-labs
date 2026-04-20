import { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { Message } from '@/features/chat/messages';
import { config } from '@/utils/config';
import { memoryStore, type ChatMessage as StoredMessage } from '@/features/stores/memoryStore';
import {
  XMarkIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface ChatPanelProps {
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function ChatPanel({ messages, isOpen, onClose, className }: ChatPanelProps) {
  const [activeTab, setActiveTab] = useState<'group' | 'private'>('group');
  const [isMinimized, setIsMinimized] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSavedIndexRef = useRef(0);

  useEffect(() => {
    memoryStore.getOrCreateCurrentSession().then(setSessionId);
  }, []);

  useEffect(() => {
    if (!sessionId || messages.length === 0) return;
    
    const newMessages = messages.slice(lastSavedIndexRef.current);
    newMessages.forEach(msg => {
      if (msg.role === 'user' || msg.role === 'assistant') {
        memoryStore.saveMessage({
          role: msg.role,
          content: msg.content as string,
          timestamp: new Date(),
        });
      }
    });
    lastSavedIndexRef.current = messages.length;
  }, [messages, sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleClearHistory = async () => {
    if (sessionId) {
      await memoryStore.clearSession(sessionId);
      const newSessionId = await memoryStore.createSession();
      setSessionId(newSessionId);
      lastSavedIndexRef.current = 0;
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className={clsx(
        "fixed right-4 top-16 bottom-32 w-80 z-40 flex flex-col",
        "bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10",
        "shadow-2xl shadow-black/50 transition-all duration-300",
        isMinimized && "bottom-auto h-14",
        className
      )}
      data-testid="panel-chat"
    >
      {/* Header with tabs */}
      <div className="flex items-center justify-between p-3 border-b border-white/10">
        <div className="flex gap-1">
          <button
            onClick={() => setActiveTab('group')}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
              activeTab === 'group'
                ? "bg-white/20 text-white"
                : "text-white/50 hover:text-white/80"
            )}
            data-testid="button-tab-group"
          >
            Group Chat
          </button>
          <button
            onClick={() => setActiveTab('private')}
            className={clsx(
              "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
              activeTab === 'private'
                ? "bg-white/20 text-white"
                : "text-white/50 hover:text-white/80"
            )}
            data-testid="button-tab-private"
          >
            Private Chat
          </button>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleClearHistory}
            className="p-1.5 text-white/40 hover:text-red-400 transition-colors rounded-lg hover:bg-white/10"
            title="Clear chat history"
            data-testid="button-clear-chat"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1.5 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            data-testid="button-minimize-chat"
          >
            {isMinimized ? (
              <ChevronUpIcon className="w-4 h-4" />
            ) : (
              <ChevronDownIcon className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/10"
            data-testid="button-close-chat"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages area */}
      {!isMinimized && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/30 text-sm">No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isAssistant = message.role === 'assistant';
  const displayName = isAssistant ? config('name') || 'AI' : 'You';
  const content = (message.content as string).replace(/\[(.*?)\]/g, '');

  return (
    <div className={clsx(
      "flex flex-col gap-1",
      isAssistant ? "items-start" : "items-end"
    )}>
      <span className={clsx(
        "text-[10px] font-medium uppercase tracking-wider px-1",
        isAssistant ? "text-purple-400" : "text-cyan-400"
      )}>
        {displayName}
      </span>
      <div className={clsx(
        "max-w-[90%] px-3 py-2 rounded-2xl text-sm leading-relaxed",
        isAssistant 
          ? "bg-purple-500/20 text-white rounded-tl-sm" 
          : "bg-cyan-500/20 text-white rounded-tr-sm"
      )}>
        {content}
      </div>
    </div>
  );
}

export default ChatPanel;
