// Individual finding card for the on-chain findings section.
// Each card shows a letter badge (A/B/C/D) with a severity state,
// a title+explanation paragraph, and an optional mono-font note.

interface FindingCardProps {
  letter: string;
  title: string;
  explanation: string;
  note?: string;
  state: 'crit' | 'warn' | 'good';
}

const STATE_STYLES: Record<
  FindingCardProps['state'],
  { bg: string; border: string }
> = {
  crit: { bg: '#FEE3E7', border: '#F7C8CD' },
  warn: { bg: '#FDF0D4', border: '#F3DFA6' },
  good: { bg: '#DCFCE7', border: '#B7EBC8' },
};

export default function FindingCard({
  letter,
  title,
  explanation,
  note,
  state,
}: FindingCardProps) {
  const { bg, border } = STATE_STYLES[state];

  return (
    <div
      className="transition-all duration-200 hover:shadow-md hover:scale-[1.01]"
      style={{
        display: 'grid',
        gridTemplateColumns: '26px 1fr',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 14,
        marginBottom: 8,
        backgroundColor: bg,
        border: `1px solid ${border}`,
      }}
    >
      {/* Letter badge */}
      <div className={`niya-finding-badge ${state}`}>{letter}</div>

      {/* Body */}
      <div>
        <p
          style={{
            fontFamily: "'Montserrat', sans-serif",
            fontSize: '12.5px',
            fontWeight: 500,
            lineHeight: 1.45,
            color: '#3A3A3A',
            margin: 0,
          }}
        >
          <b
            style={{
              color: '#1F1F1F',
              fontWeight: 700,
            }}
          >
            {title}
          </b>{' '}
          {explanation}
        </p>

        {note && (
          <p
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9,
              color: '#9B9B9B',
              marginTop: 5,
              marginBottom: 0,
            }}
          >
            {note}
          </p>
        )}
      </div>
    </div>
  );
}
