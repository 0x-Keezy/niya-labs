import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

interface CollapsibleSectionProps {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

export function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
  className,
  testId
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto');

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [children]);

  return (
    <div className={clsx("border border-white/10 rounded-lg overflow-hidden", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-full flex items-center gap-3 px-4 py-3",
          "bg-white/5 hover:bg-white/10 transition-colors",
          "text-white text-sm font-medium"
        )}
        data-testid={testId ? `${testId}-toggle` : undefined}
      >
        <ChevronRightIcon 
          className={clsx(
            "w-4 h-4 text-white/50 transition-transform duration-200",
            isOpen && "rotate-90"
          )} 
        />
        {Icon && <Icon className="w-5 h-5 text-white/70" />}
        <span className="flex-1 text-left">{title}</span>
      </button>
      
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? contentHeight : 0,
          opacity: isOpen ? 1 : 0
        }}
      >
        <div ref={contentRef} className="p-4 bg-white/[0.02]">
          {children}
        </div>
      </div>
    </div>
  );
}

export default CollapsibleSection;
