"use client";

import { clsx } from "clsx";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Scales a fixed-size piece of product UI (designed at `width` x `height` px) to the width of its box,
 * like a screenshot, but as real HTML. The box's own size comes from CSS (or `ratio`, which keeps the
 * design's aspect). `min` stops shrinking below a readable scale: past it the UI is cropped, not shrunk.
 * Without JavaScript, `--fit` falls back to the `fallback` scale.
 */
export function FitBox({
  width,
  height,
  min = 0,
  max = 1,
  ratio,
  fallback = 0.6,
  className,
  style,
  innerClassName,
  children,
}: {
  width: number;
  height: number;
  min?: number;
  max?: number;
  ratio?: boolean;
  fallback?: number;
  className?: string;
  style?: CSSProperties;
  innerClassName?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const fit = () => el.style.setProperty("--fit", String(Math.min(max, Math.max(min, el.clientWidth / width))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, min, max]);
  return (
    <div ref={ref} className={clsx("s-fit", className)} style={{ ...(ratio ? { aspectRatio: `${width} / ${height}` } : {}), ...({ "--fit-fallback": fallback } as CSSProperties), ...style }}>
      <div className={clsx("s-fit__in", innerClassName)} style={{ width, height }}>
        {children}
      </div>
    </div>
  );
}
