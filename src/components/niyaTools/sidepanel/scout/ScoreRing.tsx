// SVG progress ring used by the RugRiskCard hero. Pure presentational —
// the colour is derived from the score, not from semantic state.
//
// Score → colour mapping mirrors the bands documented in the rug-risk
// scoring heuristic (see ../../../../src/features/nylaTools/microstructure.ts):
//   0–30   → up (green)
//   31–65  → gold (amber)
//   66–100 → accent-2 (coral-pink)

import { useMemo } from 'react';

interface ScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  /** When true, render a check icon and "Healthy" instead of the number. */
  healthy?: boolean;
}

const COLORS = {
  ok: '#22C55E',
  warn: '#B8812A',
  danger: '#E67080',
  track: '#FBE3C6',
};

function colorForScore(score: number): string {
  if (score <= 30) return COLORS.ok;
  if (score <= 65) return COLORS.warn;
  return COLORS.danger;
}

export default function ScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
  healthy = false,
}: ScoreRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = useMemo(
    () => circumference * (1 - clamped / 100),
    [clamped, circumference],
  );
  const stroke = colorForScore(clamped);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={COLORS.track}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms ease, stroke 200ms ease' }}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {healthy ? (
          <>
            <div className="text-3xl" style={{ color: COLORS.ok }}>
              ✓
            </div>
            <div className="text-[9px] uppercase tracking-wider text-niya-ink-2">
              Healthy
            </div>
          </>
        ) : (
          <>
            <div
              className="font-display text-3xl font-bold leading-none"
              style={{ color: stroke }}
            >
              {Math.round(clamped)}
            </div>
            <div className="mt-0.5 text-[9px] uppercase tracking-wider text-niya-ink-2">
              of 100
            </div>
          </>
        )}
      </div>
    </div>
  );
}
