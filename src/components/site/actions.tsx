import { clsx } from "clsx";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type ButtonVariant = "ink" | "ghost" | "light" | "outline-light";

const isExternal = (href: string) => /^(https?:|mailto:)/.test(href);

/**
 * A link styled as a button. `ink` is the primary action, `ghost` the secondary; on the night band use
 * `light` and `outline-light`. `arrow` adds the moving arrow used on primary calls to action. External
 * URLs open in a new tab and say so to screen readers.
 */
export function ButtonLink({
  href,
  children,
  variant = "ink",
  size = "md",
  arrow,
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  arrow?: boolean;
  className?: string;
}) {
  const cls = clsx("s-btn", `s-btn--${variant}`, size !== "md" && `s-btn--${size}`, className);
  const inner = (
    <>
      {children}
      {arrow ? <ArrowRight className="s-icon s-btn__arrow" aria-hidden /> : null}
    </>
  );
  if (isExternal(href))
    return (
      <a href={href} className={cls} target={href.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer">
        {inner}
        {href.startsWith("mailto:") ? null : <span className="s-sr-only"> (opens in a new tab)</span>}
      </a>
    );
  return (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

/** Text link with an arrow ("Read the security page →"). External links get an up-right arrow. */
export function TextLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  if (isExternal(href))
    return (
      <a href={href} className={clsx("s-link", className)} target="_blank" rel="noopener noreferrer">
        {children}
        <ArrowUpRight className="s-icon s-link__out" aria-hidden />
        <span className="s-sr-only"> (opens in a new tab)</span>
      </a>
    );
  return (
    <Link href={href} className={clsx("s-link", className)}>
      {children}
      <ArrowRight className="s-icon s-link__arrow" aria-hidden />
    </Link>
  );
}

/** A row of buttons with the standard gap and top margin. */
export function Actions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("s-actions", className)}>{children}</div>;
}
