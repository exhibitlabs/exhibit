"use client";

import { clsx } from "clsx";
import { Info } from "lucide-react";

/** Hover and focus tooltip for definitions, assumptions and sources. */
export function InfoTip({ children, align = "left", width = 280, label = "About this figure" }: { children: React.ReactNode; align?: "left" | "right" | "center"; width?: number; label?: string }) {
  return (
    <span className="group/tip relative inline-flex align-middle">
      <button type="button" aria-label={label} className="flex size-4 items-center justify-center rounded-full text-ghost transition-colors hover:text-ink-2 focus-visible:text-ink-2">
        <Info className="size-3.5" strokeWidth={1.8} aria-hidden />
      </button>
      <span
        role="tooltip"
        style={{ width }}
        className={clsx(
          "pointer-events-none invisible absolute top-[calc(100%+8px)] z-50 rounded-[8px] bg-ink px-3 py-2.5 text-[12px] font-normal normal-case leading-[18px] tracking-normal text-white/85 opacity-0 shadow-[0_8px_24px_rgb(0_0_0/0.18)] transition-[opacity,visibility] duration-150 group-focus-within/tip:visible group-focus-within/tip:opacity-100 group-hover/tip:visible group-hover/tip:opacity-100",
          align === "left" ? "left-[-10px]" : align === "right" ? "right-0" : "left-1/2 -translate-x-1/2",
        )}
      >
        {children}
      </span>
    </span>
  );
}

/** A panel's head: a 14px title (with an optional definition), one grey line, and its own action on the right. */
export function CardHead({ title, sub, right, tip, tipAlign, className }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode; tip?: React.ReactNode; tipAlign?: "left" | "right" | "center"; className?: string }) {
  return (
    <div className={clsx("flex items-start justify-between gap-4 px-5 pb-3 pt-4", className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-1.5 text-[14px] font-semibold text-ink">
          {title}
          {tip ? <InfoTip align={tipAlign}>{tip}</InfoTip> : null}
        </h2>
        {sub ? <div className="mt-0.5 text-[13px] text-muted">{sub}</div> : null}
      </div>
      {right ? <div className="shrink-0 pt-px">{right}</div> : null}
    </div>
  );
}

/** A legend entry: the swatch is the mark it explains, scaled down. */
export function LegendDot({ color, label, value }: { color: string; label: string; value?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-muted">
      <span className="size-2 shrink-0 rounded-[2px]" style={{ background: color }} />
      {label}
      {value ? <span className="num text-ink-2">{value}</span> : null}
    </span>
  );
}

/** An empty section keeps its frame: one sentence in a 1px dashed box. */
export function EmptyNote({ title, body, className, children }: { title: string; body?: string; className?: string; children?: React.ReactNode }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center rounded-[8px] border border-dashed border-line-strong px-6 py-6 text-center", className)}>
      {children}
      <div className="text-[14px] font-medium text-ink-2">{title}</div>
      {body ? <div className="mt-1 max-w-[320px] text-[13px] leading-[19px] text-muted">{body}</div> : null}
    </div>
  );
}
