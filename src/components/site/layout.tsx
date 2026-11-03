import { clsx } from "clsx";
import type { CSSProperties, ElementType, ReactNode } from "react";

/**
 * Page width. `wrap` (1280) holds text and most sections; `wide` (1376) is for plates and full pictures;
 * `narrow` (760) is for long-form reading. Gutters shrink on phones.
 */
export function Container({ size = "wrap", as: Tag = "div", className, children, style }: { size?: "wrap" | "wide" | "narrow"; as?: ElementType; className?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <Tag className={clsx(size === "wide" ? "s-wide" : size === "narrow" ? "s-narrow" : "s-wrap", className)} style={style}>
      {children}
    </Tag>
  );
}

/**
 * A page section. Sections are spaced by top padding (128 px on desktop), so consecutive sections keep
 * one rhythm. `tone="band"` is the light grey band and `tone="night"` the one dark band; both get padding
 * on both sides. Pass `labelledBy` with the id of the section's heading.
 */
export function Section({
  id,
  tone = "plain",
  spacing = "default",
  labelledBy,
  label,
  className,
  children,
  style,
}: {
  id?: string;
  tone?: "plain" | "band" | "night";
  spacing?: "default" | "tight" | "flush";
  labelledBy?: string;
  label?: string;
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      className={clsx("s-section", tone === "band" && "s-section--band", tone === "night" && "s-section--night", spacing === "tight" && "s-section--tight", spacing === "flush" && "s-section--flush", className)}
      style={{ scrollMarginTop: "var(--s-nav-h)", ...style }}
    >
      {children}
    </section>
  );
}

/**
 * The standard section opening: heading on the left (8 of 12 columns), a short paragraph on the right,
 * aligned to the heading's baseline. Stacks on phones.
 */
export function SectionHead({ children, aside, even, className }: { children: ReactNode; aside?: ReactNode; even?: boolean; className?: string }) {
  return (
    <div className={clsx("s-sechead", even && "s-sechead--even", className)}>
      <div className="s-sechead__main">{children}</div>
      {aside ? <div className="s-sechead__aside">{aside}</div> : null}
    </div>
  );
}
