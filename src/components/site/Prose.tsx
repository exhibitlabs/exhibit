import { clsx } from "clsx";
import type { ReactNode } from "react";

/**
 * Long-form text (legal pages, docs, about): 16 px at 1.7, 680 px measure, styled h2, h3, lists, links,
 * inline code, code blocks, blockquotes, tables and rules. Write plain semantic HTML inside.
 */
export function Prose({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "article" | "section" }) {
  return <Tag className={clsx("s-prose", className)}>{children}</Tag>;
}
