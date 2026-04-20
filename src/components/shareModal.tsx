import { useState, useCallback, useMemo } from "react";
import { X, Twitter, Camera, MessageSquare, ImageIcon, Heart } from "lucide-react";

// Add your share images here - these will be served from the public folder
const SHARE_IMAGES: string[] = [
  "/assets/share/niya-share-1.png",
  "/assets/share/niya-share-2.png",
  "/assets/share/niya-share-3.png",
];

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatMessages?: { role: string; content: string; visitorName?: string | null }[];
  characterName?: string;
  viewerContainerId?: string;
}

export function ShareModal({
  isOpen,
  onClose,
  chatMessages = [],
  characterName = "Niya",
  viewerContainerId = "viewer-container",
}: ShareModalProps) {
  const [shareType, setShareType] = useState<"character" | "chat">("character");
  const [isCapturing, setIsCapturing] = useState(false);

  // Get a random share image for preview - recalculates each time modal opens
  const randomShareImage = useMemo(() => {
    if (!isOpen || SHARE_IMAGES.length === 0) return null;
    return SHARE_IMAGES[Math.floor(Math.random() * SHARE_IMAGES.length)];
  }, [isOpen]);

  const getShareText = useCallback(() => {
    const siteUrl = "https://niyaagent.com";
    if (shareType === "character") {
      return `Some call it AI. We call it a soul. Meet ${characterName}, the sweetest AI companion who vibes with you.\n\n${siteUrl}`;
    } else {
      const recentMessages = chatMessages.slice(-3);
      const chatPreview = recentMessages
        .map((m) => `${m.role === "assistant" ? characterName : "Me"}: ${m.content.slice(0, 50)}...`)
        .join("\n");
      return `Chatting with a soul, not just an AI. Meet ${characterName}!\n\n${chatPreview}\n\n${siteUrl}`;
    }
  }, [shareType, chatMessages, characterName]);

  const handleShareTwitter = () => {
    const text = encodeURIComponent(getShareText());
    window.open(
      `https://twitter.com/intent/tweet?text=${text}`,
      "_blank",
      "width=550,height=420"
    );
  };

  const handleSavePhoto = () => {
    if (SHARE_IMAGES.length === 0) return;
    
    // Pick a random image to download
    const imgToDownload = SHARE_IMAGES[Math.floor(Math.random() * SHARE_IMAGES.length)];
    const link = document.createElement("a");
    link.download = `niya-photo-${Math.floor(Math.random() * 1000)}.png`;
    link.href = imgToDownload;
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90dvh] overflow-hidden overflow-y-auto">
        <div className="bg-gradient-to-r from-amber-500 to-amber-400 p-4 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Share</h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
            data-testid="button-close-share"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setShareType("character")}
              className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                shareType === "character"
                  ? "bg-amber-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              data-testid="button-share-character"
            >
              <Heart className="w-4 h-4" />
              Character
            </button>
            <button
              onClick={() => setShareType("chat")}
              className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                shareType === "chat"
                  ? "bg-amber-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
              data-testid="button-share-chat"
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {getShareText()}
            </p>
          </div>

          {randomShareImage && (
            <div className="mb-4">
              <div className="relative rounded-lg overflow-hidden border border-gray-200">
                <img 
                  src={randomShareImage} 
                  alt="Share preview" 
                  className="w-full h-40 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <p className="absolute bottom-2 left-3 text-white text-xs">
                  Niya Official Art
                </p>
              </div>
              <button
                onClick={handleSavePhoto}
                className="mt-2 w-full py-2 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium text-sm flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
                data-testid="button-download-share-image"
              >
                <ImageIcon className="w-4 h-4" />
                Download Random Photo
              </button>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={handleShareTwitter}
              className="w-full py-3 px-4 bg-black text-white rounded-lg font-medium flex items-center justify-center gap-3 hover:bg-gray-800 transition-colors"
              data-testid="button-share-twitter"
            >
              <Twitter className="w-5 h-5" />
              Share on X (Twitter)
            </button>

            <button
              onClick={handleSavePhoto}
              className="w-full py-3 px-4 bg-amber-500/10 text-amber-600 rounded-lg font-medium flex items-center justify-center gap-3 hover:bg-amber-500/20 transition-colors"
              data-testid="button-save-photo"
            >
              <ImageIcon className="w-5 h-5" />
              Save Photo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
