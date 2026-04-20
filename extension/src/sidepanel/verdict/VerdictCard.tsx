import type { MicrostructureResult } from '../../lib/types';
import ScaleBar from './ScaleBar';

interface VerdictCardProps {
  result: MicrostructureResult;
}

/**
 * Wrap standalone numbers found in the headline with pink <em> tags.
 * Matches patterns like "42%", "3.5M", "$12K", plain "100", etc.
 */
function renderHeadline(text: string) {
  const parts = text.split(/(\$?[\d,.]+[%KMBx]?)/g);
  return parts.map((part, i) =>
    /^\$?[\d,.]+[%KMBx]?$/.test(part) ? (
      <em key={i} className="not-italic text-niya-pink">{part}</em>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function getSubText(score: number): string {
  if (score <= 25) return 'Low concentration risk. Distribution looks healthy.';
  if (score <= 50) return 'Some concentration detected. Proceed with caution.';
  if (score <= 75) return 'High holder concentration. Elevated rug-pull risk.';
  return 'Extreme concentration. Very high chance of manipulation.';
}

export default function VerdictCard({ result }: VerdictCardProps) {
  const { rugRiskScore, riskHeadline } = result;

  return (
    <div style={{ padding: '20px 20px 22px' }}>
      <div className="niya-dark-inset" style={{ padding: '20px' }}>
        {/* Label row */}
        <div className="flex items-center gap-2 mb-4">
          <span
            className="inline-block rounded-full"
            style={{
              width: '14px',
              height: '2px',
              backgroundColor: '#E89B8B',
              flexShrink: 0,
            }}
          />
          <span
            className="font-body uppercase"
            style={{
              fontSize: '9px',
              fontWeight: 800,
              letterSpacing: '0.22em',
              color: '#E89B8B',
            }}
          >
            RUG RISK VERDICT
          </span>
        </div>

        {/* Score + Headline grid */}
        <div
          className="grid items-center"
          style={{ gridTemplateColumns: 'auto 1fr', gap: '18px' }}
        >
          {/* LEFT: big score */}
          <div className="flex items-start">
            <span
              className="font-display text-niya-pink animate-scale-in"
              style={{
                fontSize: '64px',
                fontWeight: 800,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
                textShadow: '0 0 24px rgba(232,155,139,0.35)',
              }}
            >
              {rugRiskScore}
            </span>
            <sup
              className="font-display"
              style={{
                fontSize: '14px',
                fontWeight: 500,
                opacity: 0.5,
                color: '#E89B8B',
                marginTop: '8px',
                marginLeft: '2px',
              }}
            >
              /100
            </sup>
          </div>

          {/* RIGHT: headline + sub text */}
          <div className="min-w-0">
            <p
              className="font-display text-niya-dark-ink animate-fade-in"
              style={{ fontSize: '17px', fontWeight: 700, lineHeight: 1.3 }}
            >
              {renderHeadline(riskHeadline)}
            </p>
            <p
              className="font-body text-niya-dark-ink mt-1.5"
              style={{ fontSize: '11px', opacity: 0.55, lineHeight: 1.4 }}
            >
              {getSubText(rugRiskScore)}
            </p>
          </div>
        </div>

        {/* Scale bar */}
        <div style={{ marginTop: '18px' }}>
          <ScaleBar score={rugRiskScore} />
        </div>
      </div>
    </div>
  );
}
