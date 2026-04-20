import clsx from 'clsx';
import { TIMEFRAMES, type Timeframe } from '../../lib/types';

interface Props {
  value: Timeframe;
  onChange: (tf: Timeframe) => void;
  disabled?: boolean;
}

export default function TimeframeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="flex gap-1">
      {TIMEFRAMES.map((tf) => {
        const active = tf === value;
        return (
          <button
            key={tf}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tf)}
            className={clsx(
              'rounded-lg border px-2.5 py-1 font-mono text-[10px] font-medium transition-colors',
              active
                ? 'border-[#0F1115] bg-[#0F1115] text-white'
                : 'border-niya-border bg-niya-panel text-niya-ink-3 hover:text-niya-ink',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {tf}
          </button>
        );
      })}
    </div>
  );
}
