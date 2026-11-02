import { clsx } from "clsx";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("mx-auto w-full max-w-[1200px] px-5 sm:px-8", className)}>{children}</div>;
}

export function Section({ id, children, className, label }: { id?: string; children: ReactNode; className?: string; label?: string }) {
  return (
    <section id={id} aria-label={label} className={clsx("scroll-mt-16 py-20 md:py-28", className)}>
      {children}
    </section>
  );
}

/** Small mono label above a heading, e.g. "02 · Fair to buyers". */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("num text-[11.5px] uppercase tracking-[0.12em] text-muted", className)}>{children}</p>;
}

/**
 * Section heading in two tones: the claim in ink, the explanation in grey, as one sentence run.
 * Keeps headings short and the page calm.
 */
export function Heading({ kicker, title, rest, lede, className, as: Tag = "h2" }: { kicker?: ReactNode; title: ReactNode; rest?: ReactNode; lede?: ReactNode; className?: string; as?: "h1" | "h2" | "h3" }) {
  return (
    <div className={clsx("max-w-[780px]", className)}>
      {kicker ? <Kicker className="mb-5">{kicker}</Kicker> : null}
      <Tag className="text-balance text-[28px] font-semibold leading-[1.12] tracking-[-0.032em] text-ink sm:text-[34px] md:text-[40px]">
        {title}
        {rest ? <span className="text-[#8a8a8a]"> {rest}</span> : null}
      </Tag>
      {lede ? <p className="mt-5 max-w-[640px] text-pretty text-[16px] leading-relaxed text-muted sm:text-[17px]">{lede}</p> : null}
    </div>
  );
}

/** Sentences of a text, without splitting "$68.00" or "3-D". */
export const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

export function ButtonLink({ href, children, variant = "primary", external, className }: { href: string; children: ReactNode; variant?: "primary" | "secondary"; external?: boolean; className?: string }) {
  const cls = clsx(
    "group inline-flex h-11 items-center justify-center gap-2 rounded-full px-5 text-[14.5px] font-medium transition-[background-color,box-shadow,color] duration-150",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
    variant === "primary" ? "bg-ink text-white hover:bg-[#262626]" : "bg-white text-ink shadow-[inset_0_0_0_1px_var(--line-strong)] hover:bg-sunken",
    className,
  );
  if (external)
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

/** Inline text link with a small arrow. External links open in a new tab and say so to screen readers. */
export function ArrowLink({ href, children, external, className }: { href: string; children: ReactNode; external?: boolean; className?: string }) {
  const cls = clsx(
    "group inline-flex items-center gap-1 font-medium text-ink underline decoration-line-strong underline-offset-[5px] transition-colors hover:decoration-ink",
    "focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
    className,
  );
  if (external)
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer">
        {children}
        <ArrowUpRight className="size-3.5 shrink-0 text-muted transition-transform group-hover:-translate-y-px group-hover:translate-x-px" aria-hidden />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  return (
    <Link href={href} className={cls}>
      {children}
      <ArrowRight className="size-3.5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export type Decision = "FIGHT" | "REFUND" | "OFFER" | "MESSAGE_BUYER" | "PREVENT";

const DECISION_STYLE: Record<Decision, { label: string; cls: string }> = {
  FIGHT: { label: "Fight", cls: "bg-ink text-white" },
  REFUND: { label: "Refund", cls: "bg-white text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]" },
  OFFER: { label: "Offer", cls: "bg-sunken text-ink-2" },
  MESSAGE_BUYER: { label: "Message", cls: "bg-sunken text-ink-2" },
  PREVENT: { label: "Prevented", cls: "bg-green-soft text-green shadow-[inset_0_0_0_1px_rgb(21_128_61/0.18)]" },
};

export function DecisionPill({ decision, className }: { decision: Decision; className?: string }) {
  const d = DECISION_STYLE[decision];
  return <span className={clsx("inline-flex h-[22px] items-center rounded-md px-2 text-[12px] font-semibold leading-none", d.cls, className)}>{d.label}</span>;
}

/** A provenance line under a real artifact: where it came from and when. */
export function Provenance({ children, className, tone = "sandbox" }: { children: ReactNode; className?: string; tone?: "sandbox" | "demo" }) {
  return (
    <p className={clsx("flex items-start gap-2 text-[12.5px] leading-relaxed text-muted", className)}>
      <span className={clsx("mt-[7px] size-1.5 shrink-0 rounded-full", tone === "sandbox" ? "bg-green" : "bg-faint")} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Card surface used for product fragments. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("overflow-hidden rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgb(0_0_0/0.03)]", className)}>{children}</div>;
}

export const usd = (n: number, digits = 0) => `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 20, 2026" in UTC, so server and browser always agree. */
export function utcDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Oct 20, 13:34 UTC". */
export function utcDateTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm} UTC`;
}

export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
