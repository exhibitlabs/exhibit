"use client";

import { clsx } from "clsx";
import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/** Counts from the previous value to the new one; the first render counts up from zero. */
export function CountUp({ value, format, duration = 1000 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [shown, setShown] = useState(0);
  const current = useRef(0);
  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let t0: number | null = null;
    let raf = 0;
    const tick = (t: number) => {
      // Start the clock on the first frame: a frame's timestamp can precede performance.now() at scheduling time.
      t0 ??= t;
      const p = reduce ? 1 : Math.max(0, Math.min(1, (t - t0) / duration));
      const v = p >= 1 ? value : from + (value - from) * (1 - Math.pow(1 - p, 3));
      current.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(shown)}</>;
}

/** A quiet area sparkline. Flat or empty series draw a dashed baseline instead of inventing a shape. */
export function Sparkline({ data, tone = "ink", className, delay = 0 }: { data: number[]; tone?: "ink" | "green" | "red"; className?: string; delay?: number }) {
  const id = useId().replace(/:/g, "");
  const w = 100;
  const h = 30;
  const max = Math.max(...data, 0);
  const min = Math.min(...data, 0);
  const color = tone === "green" ? "var(--green)" : tone === "red" ? "var(--red)" : "var(--ink)";
  if (data.length < 2 || max === min) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={clsx("h-[30px] w-full", className)} aria-hidden>
        <line x1="0" x2={w} y1={h - 1.5} y2={h - 1.5} stroke="var(--line-strong)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 2 - ((v - min) / (max - min)) * (h - 6)] as const);
  // Monotone-ish smoothing: cubic segments with horizontal tangents keep the line calm.
  const line = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${acc} C${cx},${py} ${cx},${y} ${x},${y}`;
  }, "");
  const [lx, ly] = pts[pts.length - 1];
  return (
    <div className={clsx("relative h-[30px] w-full", className)} aria-hidden>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <defs>
          <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#g${id})`} className="rise" style={{ animationDelay: `${delay + 300}ms`, animationDuration: "0.8s" }} />
        <path d={line} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" className="spark-draw" style={{ animationDelay: `${delay}ms` }} />
      </svg>
      {/* The end dot sits outside the stretched SVG so it stays round. */}
      <span className="rise absolute size-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${lx}%`, top: `${(ly / h) * 100}%`, background: color, animationDelay: `${delay + 900}ms` }} />
    </div>
  );
}

/** Hover tooltip for definitions, assumptions and sources. */
export function InfoTip({ children, align = "left", width = 260 }: { children: React.ReactNode; align?: "left" | "right" | "center"; width?: number }) {
  return (
    <span className="group/tip relative inline-flex align-middle">
      <Info className="size-3.5 text-faint transition-colors group-hover/tip:text-ink-2" strokeWidth={1.75} aria-hidden />
      <span
        role="tooltip"
        style={{ width }}
        className={clsx(
          "pointer-events-none absolute top-[calc(100%+8px)] z-50 rounded-lg bg-ink px-3 py-2.5 text-[12px] font-normal normal-case leading-[1.5] tracking-normal text-white/85 opacity-0 shadow-[0_8px_24px_rgb(0_0_0/0.18)] transition-opacity duration-150 group-hover/tip:opacity-100",
          align === "left" ? "left-[-10px]" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2",
        )}
      >
        {children}
      </span>
    </span>
  );
}

export function CardHead({ title, sub, right, tip, tipAlign }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; tip?: React.ReactNode; tipAlign?: "left" | "right" | "center" }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
          {title}
          {tip ? <InfoTip align={tipAlign}>{tip}</InfoTip> : null}
        </div>
        {sub ? <div className="mt-0.5 text-[12.5px] text-muted">{sub}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function LegendDot({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
      <span className="size-2 rounded-[3px]" style={{ background: color }} />
      {label}
      {value ? <span className="num text-ink-2">{value}</span> : null}
    </span>
  );
}

export function EmptyNote({ title, body, className }: { title: string; body?: string; className?: string }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center rounded-lg border border-dashed border-line-strong bg-[#fcfcfc] px-6 text-center", className)}>
      <div className="text-[13px] font-medium text-ink-2">{title}</div>
      {body ? <div className="mt-1 max-w-[300px] text-[12.5px] leading-snug text-muted">{body}</div> : null}
    </div>
  );
}
