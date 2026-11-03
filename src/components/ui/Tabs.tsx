"use client";

import { clsx } from "clsx";

export type TabItem<K extends string> = { key: K; label: React.ReactNode; count?: number | string; hidden?: boolean };

/**
 * Underline tabs: Geist 14, the active label in ink with a 2px ink rule as wide as the label, on the parent's
 * full-width 1px rule. Counts sit after the label in grey tabular figures. Arrow keys move between tabs.
 */
export function Tabs<K extends string>({ tabs, value, onChange, className, size = "md" }: { tabs: TabItem<K>[]; value: K; onChange: (k: K) => void; className?: string; size?: "sm" | "md" }) {
  const shown = tabs.filter((t) => !t.hidden);
  return (
    <div role="tablist" className={clsx("scroll-thin -mb-px flex items-end gap-5 overflow-x-auto", className)}>
      {shown.map((t, i) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              e.preventDefault();
              const next = shown[(i + (e.key === "ArrowRight" ? 1 : shown.length - 1)) % shown.length];
              onChange(next.key);
              (e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=tab]")[shown.indexOf(next)])?.focus();
            }}
            className={clsx(
              "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 transition-colors",
              size === "sm" ? "h-10 text-[13px]" : "h-11 text-[14px]",
              active ? "border-ink font-medium text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {t.label}
            {t.count !== undefined && t.count !== "" ? <span className={clsx("num text-[13px] font-normal", active ? "text-muted" : "text-faint")}>{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** A segmented control for small filters inside a panel: as wide as its options, 28px items on a grey track. */
export function Segmented<K extends string>({ items, value, onChange, className }: { items: { key: K; label: React.ReactNode; count?: number }[]; value: K; onChange: (k: K) => void; className?: string }) {
  return (
    <div className={clsx("scroll-thin inline-flex max-w-full gap-0.5 overflow-x-auto rounded-[8px] bg-[#f1f1ef] p-0.5", className)}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          aria-pressed={it.key === value}
          onClick={() => onChange(it.key)}
          className={clsx("inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] px-2.5 text-[13px] transition-colors", it.key === value ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line)]" : "text-muted hover:text-ink")}
        >
          {it.label}
          {it.count !== undefined ? <span className={clsx("num text-[12px] font-normal", it.key === value ? "text-muted" : "text-faint")}>{it.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
