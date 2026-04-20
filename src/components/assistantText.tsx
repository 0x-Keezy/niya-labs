import { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";
import { config } from "@/utils/config";
import { IconButton } from "./iconButton";

/**
 * Format text for better readability:
 * - Add spaces after punctuation if missing
 * - Split into sentences for cleaner display
 */
function formatText(text: string): string[] {
  // Remove emotion tags
  let clean = text.replace(/\[([a-zA-Z]*?)\]/g, "");
  
  // Fix missing spaces after punctuation (but not in numbers like "3.14" or URLs)
  clean = clean
    .replace(/\.(?=[A-Z])/g, ". ")  // Period followed by capital letter
    .replace(/\!(?=[A-Z])/g, "! ")  // Exclamation followed by capital
    .replace(/\?(?=[A-Z])/g, "? ")  // Question mark followed by capital
    .replace(/\,(?=[A-Za-z])/g, ", ") // Comma followed by letter (no space)
    .replace(/\s+/g, " ")           // Normalize multiple spaces
    .trim();
  
  // First try to split by explicit newlines
  let parts = clean.split(/\n\n+|\n/).map(p => p.trim()).filter(p => p.length > 0);
  
  // If no newlines found and text is long, split by sentences
  if (parts.length === 1 && clean.length > 100) {
    // Split on sentence-ending punctuation followed by space
    const sentences = clean.split(/(?<=[.!?])\s+/);
    
    // Group sentences into paragraphs of 2-3 sentences each
    const grouped: string[] = [];
    let current = "";
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (!sentence) continue;
      
      if (current) {
        current += " " + sentence;
      } else {
        current = sentence;
      }
      
      // Create new paragraph every 2-3 sentences or if current is long enough
      if ((i + 1) % 2 === 0 || current.length > 120) {
        grouped.push(current);
        current = "";
      }
    }
    
    if (current) {
      grouped.push(current);
    }
    
    return grouped.length > 0 ? grouped : [clean];
  }
  
  return parts.length > 0 ? parts : [clean];
}

export const AssistantText = ({ message }: { message: string }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [unlimited, setUnlimited] = useState(false)

  const paragraphs = formatText(message);

  useEffect(() => {
    // Only scroll when message changes, not on every render
    if (message) {
      scrollRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [message]);

  return (
    <div className="fixed bottom-0 left-0 mb-32 w-full pointer-events-none">
      <div className="mx-auto max-w-4xl w-full px-4 md:px-16">
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-lg border border-white/20 pointer-events-auto">
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <span className="inline-block px-3 py-1 bg-pink-600 rounded text-white font-bold tracking-wider text-xs">
              {config('name').toUpperCase()}
            </span>
            <IconButton
              iconName="24/FrameSize"
              className="bg-transparent hover:bg-white/20 active:bg-white/30"
              isProcessing={false}
              onClick={() => setUnlimited(!unlimited)}
            />
          </div>
          <div className={clsx(
            "px-5 pt-2 pb-4 overflow-y-auto",
            unlimited ? 'max-h-[calc(75vh)]' : 'max-h-32',
          )}>
            <div className="min-h-8 max-h-full text-gray-800 dark:text-gray-100 text-base font-medium leading-relaxed space-y-2">
              {paragraphs.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              <div ref={scrollRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

