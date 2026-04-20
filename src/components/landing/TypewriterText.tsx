"use client";

/**
 * Typewriter reveal — writes the given string character-by-character when
 * the element scrolls into view. Used on the "a typical stream" Page 03
 * transcript so viewers see Niya's message appear live rather than pre-
 * rendered, matching the on-air narrative of the section.
 *
 * Uses Framer Motion's `useInView` + a `setInterval` that batches state
 * updates (no per-char re-render flood). `prefers-reduced-motion` fallback
 * renders the full string immediately with no animation.
 */

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

export default function TypewriterText({
  text,
  speed = 28,
  delay = 0,
  cursor = true,
  className,
  style,
}: {
  text: string;
  /** ms per character */
  speed?: number;
  /** ms before typing starts after the element enters view */
  delay?: number;
  /** show a blinking block cursor while typing */
  cursor?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();

  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!inView) return;

    if (reduce) {
      setCount(text.length);
      setDone(true);
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;
    const startTimeout = setTimeout(() => {
      intervalId = setInterval(() => {
        setCount((c) => {
          if (c >= text.length) {
            if (intervalId) clearInterval(intervalId);
            setDone(true);
            return c;
          }
          return c + 1;
        });
      }, speed);
    }, delay);

    return () => {
      clearTimeout(startTimeout);
      if (intervalId) clearInterval(intervalId);
    };
  }, [inView, text, speed, delay, reduce]);

  return (
    <span ref={ref} className={className} style={style}>
      {text.slice(0, count)}
      {cursor && !done && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "0.5em",
            marginLeft: 2,
            background: "currentColor",
            opacity: 0.7,
            animation: "zine-pulse 0.9s ease-in-out infinite",
            verticalAlign: "-0.12em",
          }}
        >
          &nbsp;
        </span>
      )}
    </span>
  );
}
