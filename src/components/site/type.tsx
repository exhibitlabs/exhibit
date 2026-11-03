import { clsx } from "clsx";
import type { ReactNode } from "react";

/**
 * Small label above a heading. Default: the logo's gold square and a phrase ("The gap"). With `index`,
 * a mono number replaces the square ("01 Investigate"), used only for the five product sections.
 */
export function Eyebrow({ children, index, className, as: Tag = "p" }: { children: ReactNode; index?: string; className?: string; as?: "p" | "div" | "span" }) {
  return (
    <Tag className={clsx("s-eyebrow", className)}>
      {index ? <span className="s-eyebrow__idx">{index}</span> : <i className="s-eyebrow__sq" aria-hidden />}
      <span>{children}</span>
    </Tag>
  );
}

export type HeadingSize = "display" | "h1" | "h2" | "h3" | "h4";

/**
 * Two-tone heading: the claim in ink (`title`), the explanation in grey (`rest`). `rest` starts on its own
 * line unless `inline`. Use grey only at h2 size and up (it is large-text contrast). Pass `id` so the
 * section can point `aria-labelledby` at it.
 */
export function Heading({
  title,
  rest,
  as: Tag = "h2",
  size,
  inline,
  id,
  className,
}: {
  title: ReactNode;
  rest?: ReactNode;
  as?: "h1" | "h2" | "h3" | "h4" | "p";
  size?: HeadingSize;
  inline?: boolean;
  id?: string;
  className?: string;
}) {
  const s = size ?? (Tag === "h1" ? "display" : Tag === "h3" ? "h3" : Tag === "h4" ? "h4" : "h2");
  return (
    <Tag id={id} className={clsx("s-h", `s-h--${s}`, className)}>
      <span className="s-h__title">{title}</span>
      {rest ? (
        <>
          {inline ? " " : null}
          <span className={clsx("s-h__rest", !inline && "s-h__rest--block")}>{rest}</span>
        </>
      ) : null}
    </Tag>
  );
}

/** The paragraph that follows a heading: 16.5 px, body grey, balanced line breaks. */
export function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("s-lede", className)}>{children}</p>;
}

/** Running text at 15.5 px. */
export function Body({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("s-body", className)}>{children}</p>;
}

/** Secondary note at 13 px. */
export function Small({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("s-small", className)}>{children}</p>;
}

/** Inline mono for ids and records: dispute ids, debug ids, endpoints. Never for prose. */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={clsx("s-mono", className)}>{children}</span>;
}
