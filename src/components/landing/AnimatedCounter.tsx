"use client";

/**
 * Scroll-triggered counter used on the landing's rug-risk score display.
 *
 * Counts from 0 to `target` when the element enters the viewport. Uses
 * Framer Motion's `useMotionValue` + `animate()` outside the React render
 * cycle so we don't cause a re-render on every tick (60 fps for 2.2 s
 * would otherwise trash React). Subscribes to the motion value and writes
 * the rounded integer directly to DOM via `textContent`.
 *
 * Respects `prefers-reduced-motion` — accessible users see the final
 * number immediately with no animation.
 */

import { useEffect, useRef } from "react";
import { animate, useInView, useMotionValue, useReducedMotion } from "framer-motion";

export default function AnimatedCounter({
  target,
  duration = 2.2,
  className,
  style,
}: {
  target: number;
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const count = useMotionValue(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView) return;

    if (reduce) {
      if (ref.current) ref.current.textContent = String(target);
      return;
    }

    const controls = animate(count, target, {
      duration,
      ease: [0.16, 1, 0.3, 1], // ease-out-expo — snappy start, soft landing
      onUpdate: (v) => {
        if (ref.current) ref.current.textContent = String(Math.round(v));
      },
    });

    return () => controls.stop();
  }, [inView, target, duration, reduce, count]);

  return (
    <span ref={ref} className={className} style={style}>
      0
    </span>
  );
}
