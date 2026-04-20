"use client";

/**
 * Animated preview for the Analyst card on the landing.
 *
 * Preserves the ORIGINAL composition (red dashed ceiling, green dashed
 * floor, gold trendline, 10 candles in green + red) but turns it into a
 * progressive-draw animation that loops:
 *
 *   0 – 15 %  — ceiling + floor dashed lines grow from left to right
 *   15 – 50 % — candles pop in one after another (scaleY + opacity)
 *   50 – 75 % — gold trendline traces itself from floor to ceiling
 *   75 – 92 % — everything holds steady (reading moment)
 *   92 – 100% — fade out in sync, ready for next loop
 *
 * Loop length = 8 s. Respects `prefers-reduced-motion` — static final
 * frame for motion-sensitive users.
 */

import { motion, useReducedMotion } from "framer-motion";

// Original candle layout from the static SVG — preserved so the card
// reads the same after the animation settles.
const GREEN_CANDLES = [
  { x: 28,  y: 56, h: 9 },
  { x: 54,  y: 48, h: 13 },
  { x: 80,  y: 42, h: 10 },
  { x: 132, y: 34, h: 14 },
  { x: 186, y: 28, h: 12 },
  { x: 232, y: 22, h: 11 },
];

const RED_CANDLES = [
  { x: 106, y: 40, h: 11 },
  { x: 158, y: 32, h: 11 },
  { x: 210, y: 26, h: 10 },
  { x: 256, y: 22, h: 8 },
];

// Total candles across both colors. Order them by x so the "pop-in"
// sequence reads left → right, which matches how a trader watches a
// chart build bar by bar.
const ALL_CANDLES = [
  ...GREEN_CANDLES.map((c) => ({ ...c, color: "#6B8E7F" as const })),
  ...RED_CANDLES.map((c) => ({ ...c, color: "#C47070" as const })),
].sort((a, b) => a.x - b.x);

// Cycle length in seconds. Feels "alive" without being distracting.
const CYCLE = 8;

export default function ChartPreview() {
  const reduce = useReducedMotion();

  if (reduce) {
    // Static final frame — identical to the pre-animation SVG so the
    // accessible experience doesn't lose any visual information.
    return (
      <svg
        viewBox="0 0 280 90"
        style={{ display: "block", width: "100%", height: "auto", marginTop: 8 }}
        aria-hidden="true"
      >
        <line x1="6" y1="18" x2="274" y2="18" stroke="#C47070" strokeWidth="1.3" strokeDasharray="5 4" />
        <line x1="6" y1="72" x2="274" y2="72" stroke="#6B8E7F" strokeWidth="1.3" strokeDasharray="5 4" />
        <line x1="10" y1="66" x2="270" y2="28" stroke="#B8913F" strokeWidth="1.4" />
        {ALL_CANDLES.map((c) => (
          <rect key={`${c.x}`} x={c.x} y={c.y} width="5" height={c.h} fill={c.color} />
        ))}
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 280 90"
      style={{ display: "block", width: "100%", height: "auto", marginTop: 8 }}
      aria-hidden="true"
    >
      {/* Ceiling (red dashed, top). scaleX grows from left so the dash
          pattern stays intact (pathLength would strip the dashes). */}
      <motion.line
        x1="6" y1="18" x2="274" y2="18"
        stroke="#C47070" strokeWidth="1.3" strokeDasharray="5 4"
        style={{ transformOrigin: "6px 18px" }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{
          scaleX: [0, 1, 1, 1, 0],
          opacity: [0, 1, 1, 1, 0],
        }}
        transition={{
          duration: CYCLE,
          times: [0, 0.15, 0.5, 0.92, 1],
          repeat: Infinity,
          ease: "easeOut",
        }}
      />

      {/* Floor (green dashed, bottom). Same draw-from-left trick. */}
      <motion.line
        x1="6" y1="72" x2="274" y2="72"
        stroke="#6B8E7F" strokeWidth="1.3" strokeDasharray="5 4"
        style={{ transformOrigin: "6px 72px" }}
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{
          scaleX: [0, 1, 1, 1, 0],
          opacity: [0, 1, 1, 1, 0],
        }}
        transition={{
          duration: CYCLE,
          times: [0, 0.15, 0.5, 0.92, 1],
          repeat: Infinity,
          ease: "easeOut",
          delay: 0.08,
        }}
      />

      {/* Candles — pop in sequence between 15% and 50% of the cycle.
          scaleY from the BOTTOM of each rect so they grow upward like
          a live tape. transformOrigin snaps to the candle's base. */}
      {ALL_CANDLES.map((c, i) => {
        // Each candle's entrance delay is spread across 15%–50% of the
        // cycle (= 2.8 s window over 10 candles = ~0.28 s apart).
        const entryStart = 0.15 + (i / ALL_CANDLES.length) * 0.35;
        return (
          <motion.rect
            key={`${c.x}`}
            x={c.x}
            y={c.y}
            width="5"
            height={c.h}
            fill={c.color}
            style={{ transformOrigin: `${c.x + 2.5}px ${c.y + c.h}px` }}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{
              scaleY: [0, 0, 1, 1, 0],
              opacity: [0, 0, 1, 1, 0],
            }}
            transition={{
              duration: CYCLE,
              times: [0, entryStart, entryStart + 0.04, 0.92, 1],
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
        );
      })}

      {/* Gold trendline — draws itself using pathLength from 50% to 75%
          of the cycle, after all candles are in place. Rendered as a
          single-segment path so Framer's pathLength works cleanly. */}
      <motion.path
        d="M 10 66 L 270 28"
        fill="none"
        stroke="#B8913F"
        strokeWidth="1.4"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{
          pathLength: [0, 0, 1, 1, 0],
          opacity: [0, 0, 1, 1, 0],
        }}
        transition={{
          duration: CYCLE,
          times: [0, 0.5, 0.72, 0.92, 1],
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </svg>
  );
}
