"use client";

import { clsx } from "clsx";
import { useEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

/**
 * Entrance on scroll that never hides content. Server HTML is fully visible. After hydration, only
 * elements still below the fold are set to "pending" and rise in once as they enter; anything already
 * on screen, every element without JavaScript, and every visitor with reduced motion just sees the
 * content. `delay` (ms) staggers siblings: heading 0, text 70, picture 140.
 */
export function Reveal({ children, delay = 0, y, as: Tag = "div", className, style }: { children: ReactNode; delay?: number; y?: number; as?: ElementType; className?: string; style?: CSSProperties }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    el.dataset.reveal = "pending";
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.dataset.reveal = "in";
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const vars = { "--s-reveal-delay": `${delay}ms`, ...(y != null ? { "--s-reveal-y": `${y}px` } : {}) } as CSSProperties;
  return (
    <Tag ref={ref} className={clsx("s-reveal", className)} style={{ ...vars, ...style }}>
      {children}
    </Tag>
  );
}
