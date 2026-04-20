import { clsx } from 'clsx';
import {
  Cog6ToothIcon,
  ChatBubbleLeftRightIcon,
  SpeakerWaveIcon,
  SpeakerXMarkIcon,
  CodeBracketIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { IconBrain } from '@tabler/icons-react';

interface IconBarProps {
  onSettingsClick: () => void;
  onChatClick: () => void;
  onBrainClick: () => void;
  onCodeClick: () => void;
  onMuteClick: () => void;
  onAboutClick: () => void;
  onCompactModeToggle: () => void;
  isMuted: boolean;
  isChatOpen: boolean;
  isBrainOpen: boolean;
  isCodeOpen?: boolean;
  isAboutOpen: boolean;
  isCompactMode: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isConnected?: boolean;
  className?: string;
}

interface IconButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  isActive?: boolean;
  label: string;
  testId: string;
  variant?: 'purple' | 'cyan' | 'red' | 'green' | 'default';
  disabled?: boolean;
}

const activeStyles = {
  purple: "bg-purple-500/30 text-purple-400 shadow-lg shadow-purple-500/20",
  cyan: "bg-cyan-500/30 text-cyan-400 shadow-lg shadow-cyan-500/20",
  red: "bg-red-500/30 text-red-400 shadow-lg shadow-red-500/20",
  green: "bg-green-500/30 text-green-400 shadow-lg shadow-green-500/20",
  default: "bg-white/20 text-white",
};

function IconBarButton({ icon: Icon, onClick, isActive, label, testId, variant = 'default', disabled = false }: IconButtonProps) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={clsx(
        "group relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200",
        disabled
          ? "text-white/20 cursor-not-allowed"
          : isActive 
            ? activeStyles[variant]
            : "text-white/50 hover:text-white hover:bg-white/10"
      )}
      title={label}
      data-testid={testId}
    >
      <Icon className="w-5 h-5" />
      <span className="absolute left-full ml-3 px-2 py-1 bg-black/80 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {label}
      </span>
    </button>
  );
}

function VADIndicator({ isListening, isSpeaking }: { isListening: boolean; isSpeaking: boolean }) {
  const barHeights = isSpeaking 
    ? ['h-2', 'h-4', 'h-6', 'h-4', 'h-2'] 
    : isListening 
      ? ['h-2', 'h-3', 'h-2', 'h-3', 'h-2']
      : ['h-1', 'h-1', 'h-1', 'h-1', 'h-1'];
  
  return (
    <div 
      className={clsx(
        "group relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200",
        isListening 
          ? "bg-green-500/20" 
          : "bg-white/5"
      )}
      data-testid="indicator-vad"
      title={isListening ? (isSpeaking ? "Listening..." : "Voice Active") : "Voice Inactive"}
    >
      <div className="flex items-center justify-center gap-0.5">
        {barHeights.map((height, i) => (
          <div
            key={i}
            className={clsx(
              "w-1 rounded-full transition-all",
              isListening && isSpeaking
                ? "bg-green-400"
                : isListening
                  ? "bg-green-400/60"
                  : "bg-white/20",
              height
            )}
            style={{
              animation: isSpeaking ? `vad-wave 0.5s ease-in-out ${i * 0.1}s infinite alternate` : 'none',
            }}
          />
        ))}
      </div>
      <span className="absolute left-full ml-3 px-2 py-1 bg-black/80 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {isListening ? (isSpeaking ? "Listening..." : "Voice Active") : "Voice Inactive"}
      </span>
      <style jsx>{`
        @keyframes vad-wave {
          0% { transform: scaleY(0.5); }
          100% { transform: scaleY(1.2); }
        }
      `}</style>
    </div>
  );
}

function CompactToggle({ isCompact, onClick }: { isCompact: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200",
        "text-white/50 hover:text-white hover:bg-white/10"
      )}
      title={isCompact ? "Expand Menu" : "Minimize Menu"}
      data-testid="button-compact-toggle"
    >
      {isCompact ? (
        <ArrowsPointingOutIcon className="w-5 h-5" />
      ) : (
        <ArrowsPointingInIcon className="w-5 h-5" />
      )}
    </button>
  );
}

export function IconBar({
  onSettingsClick,
  onChatClick,
  onBrainClick,
  onCodeClick,
  onMuteClick,
  onAboutClick,
  onCompactModeToggle,
  isMuted,
  isChatOpen,
  isBrainOpen,
  isCodeOpen = false,
  isAboutOpen,
  isCompactMode,
  isListening,
  isSpeaking,
  isConnected = true,
  className,
}: IconBarProps) {
  if (isCompactMode) {
    return (
      <div 
        className={clsx(
          "fixed left-4 top-4 z-40",
          "flex flex-col items-center gap-2 p-2",
          "bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10",
          className
        )}
        data-testid="icon-bar-compact"
      >
        <VADIndicator isListening={isListening} isSpeaking={isSpeaking} />
        <CompactToggle isCompact={true} onClick={onCompactModeToggle} />
      </div>
    );
  }

  return (
    <div 
      className={clsx(
        "fixed left-4 top-1/2 -translate-y-1/2 z-40",
        "flex flex-col gap-2 p-2",
        "bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10",
        className
      )}
      data-testid="icon-bar"
    >
      {/* VAD Indicator at top */}
      <VADIndicator isListening={isListening} isSpeaking={isSpeaking} />
      
      <div className="w-full h-px bg-white/10" />

      {/* Connection status indicator */}
      <div className="flex justify-center py-1" data-testid="status-connection">
        <div className={clsx(
          "w-2 h-2 rounded-full",
          isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
        )} />
      </div>

      {/* Main icons */}
      <IconBarButton
        icon={Cog6ToothIcon}
        onClick={onSettingsClick}
        label="Settings"
        testId="button-settings"
      />
      
      <IconBarButton
        icon={ChatBubbleLeftRightIcon}
        onClick={onChatClick}
        isActive={isChatOpen}
        label="Chat History"
        testId="button-chat-history"
        variant="cyan"
      />
      
      <IconBarButton
        icon={IconBrain}
        onClick={onBrainClick}
        isActive={isBrainOpen}
        label="Brain / Thoughts (Coming Soon)"
        testId="button-brain"
        variant="purple"
        disabled={true}
      />
      
      <IconBarButton
        icon={CodeBracketIcon}
        onClick={onCodeClick}
        isActive={isCodeOpen}
        label="Code / Debug"
        testId="button-code"
        variant="default"
      />
      
      <IconBarButton
        icon={InformationCircleIcon}
        onClick={onAboutClick}
        isActive={isAboutOpen}
        label="About Project"
        testId="button-about"
        variant="purple"
      />
      
      <div className="w-full h-px bg-white/10" />
      
      <IconBarButton
        icon={isMuted ? SpeakerXMarkIcon : SpeakerWaveIcon}
        onClick={onMuteClick}
        isActive={isMuted}
        label={isMuted ? "Unmute" : "Mute"}
        testId="button-mute"
        variant="red"
      />
      
      <div className="flex-1" />
      
      {/* Compact mode toggle at bottom */}
      <CompactToggle isCompact={false} onClick={onCompactModeToggle} />
    </div>
  );
}

export default IconBar;
