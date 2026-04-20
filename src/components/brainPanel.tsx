import { clsx } from 'clsx';
import { useState, useRef, useCallback, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { IconBrain, IconSparkles, IconMoodSmile, IconMoodSad, IconMoodAngry, IconMoodCrazyHappy, IconMoodNervous, IconMoodConfuzed, IconGripVertical } from '@tabler/icons-react';
import { TimestampedPrompt } from '@/features/amicaLife/eventHandler';
import { useEmotionState } from '@/features/emotions';
import { Mood } from '@/features/emotions/types';

interface BrainPanelProps {
  thoughts: TimestampedPrompt[];
  currentThought?: string;
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface Position {
  x: number;
  y: number;
}

const moodIcons: Record<Mood, typeof IconMoodSmile> = {
  calm: IconMoodSmile,
  happy: IconMoodCrazyHappy,
  excited: IconMoodCrazyHappy,
  smug: IconMoodSmile,
  annoyed: IconMoodNervous,
  angry: IconMoodAngry,
  sad: IconMoodSad,
  surprised: IconMoodConfuzed,
  focused: IconMoodSmile,
};

const moodColors: Record<Mood, string> = {
  calm: 'text-blue-400',
  happy: 'text-yellow-400',
  excited: 'text-orange-400',
  smug: 'text-purple-400',
  annoyed: 'text-red-300',
  angry: 'text-red-500',
  sad: 'text-blue-300',
  surprised: 'text-pink-400',
  focused: 'text-cyan-400',
};

const moodLabels: Record<Mood, string> = {
  calm: 'Calm',
  happy: 'Happy',
  excited: 'Excited!',
  smug: 'Smug',
  annoyed: 'Annoyed',
  angry: 'Angry!',
  sad: 'Sad',
  surprised: 'Surprised!',
  focused: 'Focused',
};

export function BrainPanel({ thoughts, currentThought, isOpen, onClose, className }: BrainPanelProps) {
  const emotionState = useEmotionState();
  const [position, setPosition] = useState<Position>({ x: 80, y: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<Position>({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: ReactMouseEvent) => {
    if (panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      setIsDragging(true);
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging && panelRef.current) {
      const panelHeight = panelRef.current.getBoundingClientRect().height || 400;
      const newX = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - panelHeight, e.clientY - dragOffset.current.y));
      setPosition({ x: newX, y: newY });
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);
  
  if (!isOpen) return null;

  const MoodIcon = moodIcons[emotionState.mood];
  const moodColor = moodColors[emotionState.mood];

  return (
    <div 
      ref={panelRef}
      style={{ left: position.x, top: position.y }}
      className={clsx(
        "fixed w-80 max-h-[70vh] z-40 flex flex-col",
        "bg-gradient-to-br from-[#FFF8E7] to-[#E8D4A8] backdrop-blur-xl rounded-2xl border-2 border-[#C9A86C]",
        "shadow-2xl shadow-[#C9A86C]/30 transition-shadow duration-300",
        isDragging && "cursor-grabbing",
        className
      )}
      data-testid="panel-brain"
    >
      {/* Header - Draggable */}
      <div 
        className="flex items-center justify-between p-4 border-b border-[#C9A86C]/30 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <IconGripVertical className="w-4 h-4 text-[#C9A86C]/60" />
          <div className="p-2 bg-[#F5D89A] rounded-lg">
            <IconBrain className="w-5 h-5 text-[#6B5344]" />
          </div>
          <div>
            <h3 className="text-[#6B5344] font-semibold text-sm">AI Brain</h3>
            <p className="text-[#6B5344]/60 text-xs">Emotions & Thoughts</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-[#6B5344]/40 transition-colors rounded-lg hover-elevate"
          data-testid="button-close-brain"
        >
          <XMarkIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Emotion State Section */}
      <div className="p-4 border-b border-[#C9A86C]/30 bg-gradient-to-r from-[#F5D89A]/30 to-[#E8D4A8]/30">
        <div className="flex items-center gap-3 mb-3">
          <div className={clsx("p-2 rounded-xl bg-[#6B5344]/10", moodColor)}>
            <MoodIcon className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className={clsx("font-semibold text-lg", moodColor)}>
                {moodLabels[emotionState.mood]}
              </span>
              <span className="text-[#6B5344]/60 text-xs">
                {Math.round(emotionState.intensity)}%
              </span>
            </div>
            {/* Intensity bar */}
            <div className="h-1.5 bg-[#6B5344]/10 rounded-full mt-1 overflow-hidden">
              <div 
                className={clsx("h-full rounded-full transition-all duration-500", 
                  emotionState.mood === 'calm' ? 'bg-blue-400' :
                  emotionState.mood === 'happy' ? 'bg-yellow-500' :
                  emotionState.mood === 'excited' ? 'bg-orange-400' :
                  emotionState.mood === 'angry' ? 'bg-red-500' :
                  emotionState.mood === 'sad' ? 'bg-blue-300' :
                  'bg-[#C9A86C]'
                )}
                style={{ width: `${emotionState.intensity}%` }}
              />
            </div>
          </div>
        </div>
        {emotionState.reason && (
          <p className="text-[#6B5344]/60 text-xs italic pl-11">
            &quot;{emotionState.reason}&quot;
          </p>
        )}
      </div>

      {/* Current thought */}
      {currentThought && (
        <div className="p-4 border-b border-[#C9A86C]/30 bg-[#F5D89A]/20">
          <div className="flex items-start gap-2">
            <IconSparkles className="w-4 h-4 text-[#C9A86C] mt-0.5 animate-pulse" />
            <div>
              <span className="text-[10px] text-[#C9A86C] uppercase tracking-wider font-medium">
                Currently thinking...
              </span>
              <p className="text-[#6B5344] text-sm mt-1 leading-relaxed">
                {currentThought}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Thought history */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {thoughts.length === 0 && !currentThought ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <IconBrain className="w-8 h-8 text-[#C9A86C]/40 mb-2" />
            <p className="text-[#6B5344]/50 text-sm">No thoughts yet...</p>
            <p className="text-[#6B5344]/30 text-xs mt-1">Internal reasoning will appear here</p>
          </div>
        ) : (
          thoughts.map((thought, i) => (
            <ThoughtItem key={i} thought={thought} />
          ))
        )}
      </div>
    </div>
  );
}

function ThoughtItem({ thought }: { thought: TimestampedPrompt }) {
  const timestamp = new Date(thought.timestamp).getTime();
  const timeAgo = getTimeAgo(isNaN(timestamp) ? Date.now() : timestamp);
  
  return (
    <div className="p-3 bg-[#6B5344]/5 rounded-xl border border-[#C9A86C]/20 transition-all hover-elevate">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#C9A86C] uppercase tracking-wider">
          Thought
        </span>
        <span className="text-[10px] text-[#6B5344]/40">
          {timeAgo}
        </span>
      </div>
      <p className="text-[#6B5344]/80 text-sm leading-relaxed">
        {thought.prompt}
      </p>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default BrainPanel;
