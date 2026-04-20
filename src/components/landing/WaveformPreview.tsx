"use client";

/**
 * Animated waveform for the "§ the voice" card on Page 02.
 *
 * Ports the 14-bar static waveform from the v5-zine design but animates
 * each bar with a staggered scaleY loop so it feels like a live TTS
 * stream. Heights preserved verbatim from the source so the shape of
 * the waveform reads the same as the original static design.
 *
 * Respects `prefers-reduced-motion` → renders the exact static design
 * frame for motion-sensitive users.
 */

import { motion, useReducedMotion } from "framer-motion";

// Exact amplitudes from v5-zine-v1.html (the § the voice card). Each
// value is the percentage height of the container (42px tall).
const AMPLITUDES = [40, 68, 52, 88, 60, 34, 82, 44, 70, 28, 64, 48, 80, 54];

export default function WaveformPreview() {
  const reduce = useReducedMotion();

  return (
    <div
      className="mt-3 flex items-end"
      style={{ height: 42, gap: 3 }}
      aria-hidden="true"
    >
      {AMPLITUDES.map((h, i) => {
        const baseHeight = `${h}%`;

        if (reduce) {
          return (
            <span
              key={i}
              style={{
                flex: 1,
                background: "#B8913F",
                height: baseHeight,
                borderRadius: 1,
              }}
            />
          );
        }

        return (
          <motion.span
            key={i}
            style={{
              flex: 1,
              background: "#B8913F",
              height: baseHeight,
              borderRadius: 1,
              transformOrigin: "bottom",
            }}
            animate={{
              scaleY: [0.45, 1, 0.7, 1.05, 0.55],
            }}
            transition={{
              duration: 1.8,
              times: [0, 0.25, 0.5, 0.75, 1],
              repeat: Infinity,
              repeatType: "mirror",
              ease: "easeInOut",
              delay: i * 0.07,
            }}
          />
        );
      })}
    </div>
  );
}
