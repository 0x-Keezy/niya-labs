import { useState, useEffect, useRef, useContext } from "react";
import { clsx } from "clsx";
import { 
  PlayIcon, 
  XMarkIcon,
  MusicalNoteIcon,
  FilmIcon,
  SpeakerWaveIcon,
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  AdjustmentsHorizontalIcon
} from "@heroicons/react/24/outline";
import { ViewerContext } from "@/features/vrmViewer/viewerContext";
import { ChatContext } from "@/features/chat/chatContext";
import { getBeatDetector, FrequencyData } from "@/features/beatSync/beatDetector";
import { getVRMBeatController } from "@/features/beatSync/vrmBeatController";

interface MediaPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimizeAvatar?: (minimized: boolean) => void;
}

type MediaMode = "idle" | "music" | "video";

export function MediaPanel({ isOpen, onClose, onMinimizeAvatar }: MediaPanelProps) {
  const { viewer } = useContext(ViewerContext);
  const { chat } = useContext(ChatContext);
  
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [mediaMode, setMediaMode] = useState<MediaMode>("music");
  const [bpm, setBpm] = useState(120);
  const [isMinimized, setIsMinimized] = useState(false);
  const [frequencies, setFrequencies] = useState<FrequencyData>({ bass: 0, mid: 0, high: 0, overall: 0 });
  const [beatSyncActive, setBeatSyncActive] = useState(false);
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const beatDetector = getBeatDetector();
  const beatController = getVRMBeatController();

  // Extract YouTube video ID from URL
  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/shorts\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  // Start beat sync in manual BPM mode (no microphone needed)
  const startBeatSync = async () => {
    await beatDetector.init();
    beatDetector.enableManualMode(bpm);
    beatDetector.start();
    
    // Set VRM for beat controller
    if (viewer.model?.vrm) {
      beatController.setVRM(viewer.model.vrm);
    }
    
    setBeatSyncActive(true);
    console.log("Beat sync started in manual mode at", bpm, "BPM");
  };

  // Handle BPM change
  const handleBpmChange = (newBpm: number) => {
    setBpm(newBpm);
    if (beatSyncActive) {
      beatDetector.setManualBpm(newBpm);
    }
  };

  // Handle URL submission
  const handleSubmit = async () => {
    const id = extractVideoId(youtubeUrl);
    if (id) {
      setVideoId(id);
      setIsPlaying(true);
      onMinimizeAvatar?.(true);
      setIsMinimized(true);
      
      // Start beat sync automatically
      await startBeatSync();
    }
  };

  // Update BPM and frequency display
  useEffect(() => {
    if (!isPlaying || !beatSyncActive) return;

    updateIntervalRef.current = setInterval(() => {
      const currentBpm = beatDetector.getBPM();
      const currentFreq = beatDetector.getFrequencyData();
      const isMusic = beatDetector.isLikelyMusic();
      
      setBpm(currentBpm);
      setFrequencies(currentFreq);
      setMediaMode(isMusic ? "music" : "video");
      
      // Control beat animations based on mode
      if (isMusic && !beatController.isRunning()) {
        beatController.start();
      } else if (!isMusic && beatController.isRunning()) {
        beatController.stop();
      }
      
      // Update VRM beat controller
      if (isMusic && viewer.model?.vrm) {
        beatController.update(1/30, currentBpm);
      }
    }, 1000 / 30); // 30fps update

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [isPlaying, beatSyncActive, viewer]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      beatDetector.stop();
      beatController.stop();
    };
  }, []);

  // Handle close
  const handleClose = () => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }
    setYoutubeUrl("");
    setVideoId(null);
    setIsPlaying(false);
    setMediaMode("music");
    setBpm(120);
    setFrequencies({ bass: 0, mid: 0, high: 0, overall: 0 });
    beatDetector.stop();
    beatController.stop();
    onMinimizeAvatar?.(false);
    setIsMinimized(false);
    setBeatSyncActive(false);
    onClose();
  };

  // Toggle minimized view
  const toggleMinimized = () => {
    setIsMinimized(!isMinimized);
    onMinimizeAvatar?.(!isMinimized);
  };

  // Trigger Niya reaction for video content
  const triggerReaction = async () => {
    if (!chat || mediaMode !== "video") return;
    
    const prompts = [
      "React to what you're watching in the video. Be expressive and natural!",
      "Comment on the video content you're seeing. What do you think?",
      "Share your thoughts about this video with chat!"
    ];
    
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    console.log("Niya reaction triggered:", randomPrompt);
  };

  if (!isOpen) return null;

  return (
    <div className={clsx(
      "fixed inset-0 z-50 flex items-center justify-center",
      "bg-black/50 backdrop-blur-sm"
    )}>
      <div className={clsx(
        "relative w-full max-w-4xl mx-4",
        "bg-gray-900/95 rounded-xl border border-white/10",
        "shadow-2xl"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            {mediaMode === "music" ? (
              <MusicalNoteIcon className="w-6 h-6 text-pink-500" />
            ) : mediaMode === "video" ? (
              <FilmIcon className="w-6 h-6 text-blue-500" />
            ) : (
              <SpeakerWaveIcon className="w-6 h-6 text-gray-500" />
            )}
            <span className="text-white font-medium">
              {mediaMode === "music" ? "Music Mode - Beat Sync Active" : 
               mediaMode === "video" ? "Video Mode - Reactions Active" : 
               "Media Player"}
            </span>
            {beatSyncActive && bpm > 0 && (
              <span className="px-2 py-1 bg-pink-600/30 text-pink-300 text-xs rounded-full">
                {bpm} BPM
              </span>
            )}
            {beatSyncActive && (
              <span className="px-2 py-1 bg-green-600/30 text-green-300 text-xs rounded-full flex items-center gap-1">
                <MusicalNoteIcon className="w-3 h-3" />
                Beat Sync Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMinimized}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              data-testid="button-toggle-minimize"
            >
              {isMinimized ? (
                <ArrowsPointingOutIcon className="w-5 h-5" />
              ) : (
                <ArrowsPointingInIcon className="w-5 h-5" />
              )}
            </button>
            <button
              onClick={handleClose}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              data-testid="button-close-media"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* URL Input */}
        {!videoId && (
          <div className="p-6">
            <label className="block text-gray-300 text-sm mb-2">
              Paste YouTube URL to watch with Niya
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-pink-500"
                data-testid="input-youtube-url"
              />
              <button
                onClick={handleSubmit}
                disabled={!youtubeUrl}
                className="px-6 py-3 bg-pink-600 hover:bg-pink-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors"
                data-testid="button-play-video"
              >
                <PlayIcon className="w-5 h-5" />
              </button>
            </div>
            
            {/* BPM Preset Selector */}
            <div className="mt-4">
              <label className="block text-gray-400 text-xs mb-2">
                Select BPM for beat sync (adjust to match the music)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="60"
                  max="180"
                  value={bpm}
                  onChange={(e) => handleBpmChange(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  data-testid="slider-bpm"
                />
                <span className="text-pink-400 font-mono text-sm w-16">{bpm} BPM</span>
              </div>
              <div className="flex justify-between mt-2">
                {[80, 100, 120, 140, 160].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleBpmChange(preset)}
                    className={clsx(
                      "px-2 py-1 text-xs rounded transition-colors",
                      bpm === preset 
                        ? "bg-pink-600 text-white" 
                        : "bg-gray-700 text-gray-400 hover:bg-gray-600"
                    )}
                    data-testid={`button-bpm-${preset}`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
            
            <p className="text-gray-500 text-xs mt-3">
              Niya will dance to the beat! Adjust the BPM slider to match the music tempo for best sync.
            </p>
          </div>
        )}

        {/* Video Player */}
        {videoId && (
          <div className="relative aspect-video">
            <iframe
              ref={iframeRef}
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {/* Beat Visualizer and BPM Control (when playing) */}
        {videoId && beatSyncActive && (
          <div className="p-4 border-t border-white/10">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-end gap-1 h-8">
                  <div 
                    className="w-4 bg-pink-500 rounded-t transition-all duration-75"
                    style={{ height: `${Math.min(100, frequencies.bass / 2)}%` }}
                  />
                  <div 
                    className="w-4 bg-purple-500 rounded-t transition-all duration-75"
                    style={{ height: `${Math.min(100, frequencies.mid / 2)}%` }}
                  />
                  <div 
                    className="w-4 bg-blue-500 rounded-t transition-all duration-75"
                    style={{ height: `${Math.min(100, frequencies.high / 2)}%` }}
                  />
                </div>
                <div className="flex gap-1 mt-1">
                  <span className="text-[10px] text-pink-400 w-4 text-center">B</span>
                  <span className="text-[10px] text-purple-400 w-4 text-center">M</span>
                  <span className="text-[10px] text-blue-400 w-4 text-center">H</span>
                </div>
              </div>
              
              {/* Live BPM adjuster */}
              <div className="flex items-center gap-2">
                <AdjustmentsHorizontalIcon className="w-4 h-4 text-gray-400" />
                <input
                  type="range"
                  min="60"
                  max="180"
                  value={bpm}
                  onChange={(e) => handleBpmChange(parseInt(e.target.value))}
                  className="w-24 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                  data-testid="slider-bpm-live"
                />
                <span className="text-pink-400 font-mono text-xs w-14">{bpm} BPM</span>
              </div>
              
              <p className="text-gray-400 text-sm">
                Niya is vibing to the beat!
              </p>
            </div>
          </div>
        )}

        {/* Video mode reaction button */}
        {mediaMode === "video" && videoId && (
          <div className="p-4 border-t border-white/10">
            <button
              onClick={triggerReaction}
              className="w-full px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 rounded-lg transition-colors"
              data-testid="button-trigger-reaction"
            >
              Ask Niya to react to this video
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default MediaPanel;
