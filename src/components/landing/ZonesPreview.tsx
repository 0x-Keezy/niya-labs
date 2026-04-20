"use client";

/**
 * Animated preview for the "zones with interest scoring" Strategy card.
 *
 * Preserves the original composition — two purple interest zones, four
 * horizontal boundary lines (solid + dashed), and a curved price path
 * traversing them — but animates it so the viewer watches the chart
 * "construct itself":
 *
 *   0 – 18 %  — purple zone bands fade in + slight Y shift
 *   18 – 42 % — solid + dashed boundary lines grow from left
 *   42 – 80 % — curved gold price path draws through the zones
 *   80 – 92 % — hold steady
 *   92 – 100% — fade out, loop
 *
 * Uses `useReducedMotion` → static final frame if OS flag is set.
 */

import { motion, useReducedMotion } from "framer-motion";

const CYCLE = 9;

export default function ZonesPreview() {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <svg
        viewBox="0 0 280 72"
        style={{ display: "block", width: "100%", height: "auto", marginTop: 6 }}
        aria-hidden="true"
      >
        <rect x="0" y="8" width="280" height="14" fill="rgba(133,98,146,0.15)" />
        <line x1="0" y1="8" x2="280" y2="8" stroke="#856292" strokeWidth="1" />
        <line x1="0" y1="22" x2="280" y2="22" stroke="#856292" strokeWidth="1" strokeDasharray="4 3" />
        <rect x="0" y="30" width="280" height="18" fill="rgba(133,98,146,0.24)" />
        <line x1="0" y1="30" x2="280" y2="30" stroke="#856292" strokeWidth="1.2" />
        <line x1="0" y1="48" x2="280" y2="48" stroke="#856292" strokeWidth="1" strokeDasharray="4 3" />
        <path
          d="M 4 58 C 50 48, 80 16, 120 34 S 200 56, 240 22 S 270 10, 274 22"
          fill="none"
          stroke="#B8913F"
          strokeWidth="1.4"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 280 72"
      style={{ display: "block", width: "100%", height: "auto", marginTop: 6 }}
      aria-hidden="true"
    >
      {/* Upper purple zone — fades in with a small downward shift so it
          lands on its position rather than just appearing. */}
      <motion.rect
        x="0" y="8" width="280" height="14"
        fill="rgba(133,98,146,0.15)"
        initial={{ opacity: 0, y: -4 }}
        animate={{
          opacity: [0, 1, 1, 1, 0],
          y: [-4, 0, 0, 0, -4],
        }}
        transition={{
          duration: CYCLE,
          times: [0, 0.18, 0.5, 0.92, 1],
          repeat: Infinity,
          ease: "easeOut",
        }}
      />

      {/* Lower purple zone — same entrance, slight delay so they
          stagger rather than appear simultaneously. */}
      <motion.rect
        x="0" y="30" width="280" height="18"
        fill="rgba(133,98,146,0.24)"
        initial={{ opacity: 0, y: 4 }}
        animate={{
          opacity: [0, 1, 1, 1, 0],
          y: [4, 0, 0, 0, 4],
        }}
        transition={{
          duration: CYCLE,
          times: [0, 0.18, 0.5, 0.92, 1],
          repeat: Infinity,
          ease: "easeOut",
          delay: 0.1,
        }}
      />

      {/* Upper-zone boundary (solid top). Draws from left via scaleX. */}
      <motion.line
        x1="0" y1="8" x2="280" y2="8"
        stroke="#856292" strokeWidth="1"
        style={{ transformOrigin: "0px 8px" }}
        initial={{ scaleX: 0 }}
        animate={{
          scaleX: [0, 0, 1, 1, 0],
        }}
        transition={{
          duration: CYCLE,
          times: [0, 0.18, 0.35, 0.92, 1],
          repeat: Infinity,
          ease: "easeOut",
        }}
      />

      {/* Upper-zone midline (dashed). */}
      <motion.line
        x1="0" y1="22" x2="280" y2="22"
        stroke="#856292" strokeWidth="1" strokeDasharray="4 3"
        style={{ transformOrigin: "0px 22px" }}
        initial={{ scaleX: 0 }}
        animate={{
          scaleX: [0, 0, 1, 1, 0],
        }}
        transition={{
          duration: CYCLE,
          times: [0, 0.22, 0.4, 0.92, 1],
          repeat: Infinity,
          ease: "easeOut",
        }}
      />

      {/* Lower-zone boundary (solid top). */}
      <motion.line
        x1="0" y1="30" x2="280" y2="30"
        stroke="#856292" strokeWidth="1.2"
        style={{ transformOrigin: "0px 30px" }}
        initial={{ scaleX: 0 }}
        animate={{
          scaleX: [0, 0, 1, 1, 0],
        }}
        transition={{
          duration: CYCLE,
          times: [0, 0.26, 0.42, 0.92, 1],
          repeat: Infinity,
          ease: "easeOut",
        }}
      />

      {/* Lower-zone midline (dashed). */}
      <motion.line
        x1="0" y1="48" x2="280" y2="48"
        stroke="#856292" strokeWidth="1" strokeDasharray="4 3"
        style={{ transformOrigin: "0px 48px" }}
        initial={{ scaleX: 0 }}
        animate={{
          scaleX: [0, 0, 1, 1, 0],
        }}
        transition={{
          duration: CYCLE,
          times: [0, 0.3, 0.45, 0.92, 1],
          repeat: Infinity,
          ease: "easeOut",
        }}
      />

      {/* Gold curved price path — draws itself through the zones using
          Framer's pathLength animation. This is the "payoff" of the
          sequence: the reader watches price weave through the scored
          interest zones. */}
      <motion.path
        d="M 4 58 C 50 48, 80 16, 120 34 S 200 56, 240 22 S 270 10, 274 22"
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
          times: [0, 0.42, 0.78, 0.92, 1],
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </svg>
  );
}
