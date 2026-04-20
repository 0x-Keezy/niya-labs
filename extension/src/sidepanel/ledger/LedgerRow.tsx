interface LedgerRowProps {
  label: string;
  value: string;
  qualifier?: string;
  state?: 'crit' | 'warn' | 'good' | 'neutral';
}

const STATE_COLORS: Record<string, string> = {
  crit: '#E67080',
  warn: '#E8A853',
  good: '#16A34A',
  neutral: '#1F1F1F',
};

export default function LedgerRow({
  label,
  value,
  qualifier,
  state,
}: LedgerRowProps) {
  const valueColor = STATE_COLORS[state ?? 'neutral'];

  return (
    <div
      className="border-b border-dashed border-niya-border"
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'baseline',
        gap: '10px',
        padding: '11px 0',
      }}
    >
      {/* Label */}
      <span
        className="font-body text-niya-ink-3"
        style={{ fontSize: '11px', fontWeight: 500 }}
      >
        {label}
      </span>

      {/* Leader dots */}
      <span className="niya-leader-dot" />

      {/* Value + optional qualifier */}
      <span className="whitespace-nowrap">
        <span
          className="font-mono"
          style={{
            fontSize: '13px',
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: valueColor,
          }}
        >
          {value}
        </span>
        {qualifier && (
          <span
            className="font-body italic text-niya-ink-mute"
            style={{ fontSize: '10px', marginLeft: '6px' }}
          >
            {qualifier}
          </span>
        )}
      </span>
    </div>
  );
}
