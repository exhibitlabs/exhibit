import { clsx } from "clsx";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "./layout";
import { Eyebrow, Heading } from "./type";

/**
 * The opening of an inner page: optional breadcrumbs, eyebrow, a two-tone h1, a lede, actions, and an
 * optional aside on the right (a DotArt piece, a small plate, a UI fragment). Renders the page's only h1.
 */
export function PageHeader({
  eyebrow,
  eyebrowIndex,
  title,
  rest,
  lede,
  actions,
  aside,
  crumbs,
  className,
  children,
}: {
  eyebrow?: ReactNode;
  /** Mono index in place of the gold square ("01"), for the five product capability pages only. */
  eyebrowIndex?: string;
  title: ReactNode;
  rest?: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  aside?: ReactNode;
  /** e.g. [{ label: "Product", href: "/" }, { label: "Prevention" }]; the last item is the current page. */
  crumbs?: { label: string; href?: string }[];
  className?: string;
  /** Anything else under the lede (facts, a note). */
  children?: ReactNode;
}) {
  return (
    <header className={clsx("s-pagehead", className)}>
      <Container>
        <div className="s-pagehead__grid">
          <div className="s-pagehead__main">
            {crumbs?.length ? (
              <nav aria-label="Breadcrumb">
                <ol className="s-pagehead__crumbs">
                  {crumbs.map((c, i) => (
                    <li key={c.label} className="flex items-center gap-2">
                      {i ? <span aria-hidden>/</span> : null}
                      {c.href && i < crumbs.length - 1 ? <Link href={c.href}>{c.label}</Link> : <span aria-current={i === crumbs.length - 1 ? "page" : undefined}>{c.label}</span>}
                    </li>
                  ))}
                </ol>
              </nav>
            ) : null}
            {eyebrow ? <Eyebrow index={eyebrowIndex}>{eyebrow}</Eyebrow> : null}
            <Heading as="h1" size="h1" title={title} rest={rest} />
            {lede ? <p className="s-lede s-pagehead__lede">{lede}</p> : null}
            {actions ? <div className="s-actions">{actions}</div> : null}
            {children}
          </div>
          {aside ? <div className="s-pagehead__aside">{aside}</div> : null}
        </div>
      </Container>
    </header>
  );
}
