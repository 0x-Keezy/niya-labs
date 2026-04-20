import { useState } from 'react';
import { Smile, X } from 'lucide-react';

interface StickerPickerProps {
  onSelectSticker: (stickerUrl: string) => void;
}

const STICKER_COUNT = 50;

export function StickerPicker({ onSelectSticker }: StickerPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const stickers = Array.from({ length: STICKER_COUNT }, (_, i) => ({
    id: i + 1,
    url: `/stickers/${i + 1}.png`
  }));
  
  const handleSelect = (stickerUrl: string) => {
    onSelectSticker(stickerUrl);
    setIsOpen(false);
  };
  
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-500 hover:text-gray-700 transition-colors"
        data-testid="button-sticker-picker"
        title="Stickers"
      >
        <Smile className="w-5 h-5" />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div 
            className="absolute bottom-full right-0 mb-2 w-64 max-h-48 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden"
            data-testid="sticker-picker-panel"
          >
            <div className="flex items-center justify-between p-2 border-b border-gray-100">
              <span className="text-gray-700 text-xs font-medium">Stickers</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 grid grid-cols-6 gap-1 overflow-y-auto max-h-36">
              {stickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => handleSelect(sticker.url)}
                  className="w-9 h-9 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center"
                  data-testid={`sticker-${sticker.id}`}
                >
                  <img 
                    src={sticker.url} 
                    alt={`Sticker ${sticker.id}`}
                    className="w-7 h-7 object-contain"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
