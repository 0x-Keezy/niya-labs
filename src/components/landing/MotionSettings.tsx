"use client";

/**
 * Shared Framer Motion settings for the zine landing.
 *
 * One source of truth for spring physics, ease curves and durations so every
 * animated element on the landing shares the same "feel" — no stiff linear
 * easing, no mismatched damping, no surprise instant swaps. Matches the
 * Taste-Skill MOTION_INTENSITY = 6 baseline: perpetual micro-interactions
 * with spring physics, never cinematic over-the-top motion.
 *
 * All consumers should also call `useReducedMotion()` from framer-motion and
 * fall back to the final state when the user prefers reduced motion — see
 * examples in the animated components that import these constants.
 */

import type { Transition } from "framer-motion";

/** Base spring — zine-appropriate tactile feel, not overshoot-heavy. */
export const SPRING: Transition = {
  type: "spring",
  stiffness: 100,
  damping: 20,
};

/** Snappier spring for quick interactions (hover, click bounce). */
export const SPRING_SNAPPY: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 22,
};

/** Soft entry — used for sections fading in on mount / scroll. */
export const ENTRANCE: Transition = {
  duration: 0.6,
  ease: [0.16, 1, 0.3, 1], // ease-out-expo
};

/** Stagger config for revealing lists/words sequentially. */
export const STAGGER_CONTAINER: Transition = {
  staggerChildren: 0.08,
  delayChildren: 0.1,
};

/** Perpetual loop — for live dots, sparkles, chart preview candles. */
export const PERPETUAL = (duration = 6): Transition => ({
  duration,
  repeat: Infinity,
  repeatType: "loop" as const,
  ease: "linear",
});

/** Hover scale — multiplier for tactile buttons / polaroids. */
export const HOVER_LIFT = {
  scale: 1.02,
  transition: SPRING_SNAPPY,
};

/**
 * Standard viewport-triggered reveal props for scroll-into-view fades.
 * Use with `<motion.div {...VIEWPORT_REVEAL}>`.
 */
export const VIEWPORT_REVEAL = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: ENTRANCE,
} as const;
