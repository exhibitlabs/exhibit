"use client";

import { clsx } from "clsx";

export type TabItem<K extends string> = { key: K; label: React.ReactNode; count?: number | string; hidden?: boolean };

/** Underline tabs for switching views inside a card or page section. Arrow keys move between tabs. */
export function Tabs<K extends string>({ tabs, value, onChange, className, size = "md" }: { tabs: TabItem<K>[]; value: K; onChange: (k: K) => void; className?: string; size?: "sm" | "md" }) {
  const shown = tabs.filter((t) => !t.hidden);
  return (
    <div role="tablist" className={clsx("scroll-thin flex items-end gap-1 overflow-x-auto", className)}>
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
              "relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t-md px-2.5 font-medium transition-colors",
              size === "sm" ? "h-8 text-[12.5px]" : "h-10 text-[13px]",
              active ? "text-ink" : "text-muted hover:text-ink",
              "after:absolute after:inset-x-2 after:-bottom-px after:h-[2px] after:rounded-full after:transition-colors",
              active ? "after:bg-ink" : "after:bg-transparent",
            )}
          >
            {t.label}
            {t.count !== undefined && t.count !== "" ? <span className={clsx("num rounded px-1 text-[11px]", active ? "bg-ink text-white" : "bg-sunken text-muted")}>{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Pill-shaped segmented control, for filters and saved views. */
export function Segmented<K extends string>({ items, value, onChange, className }: { items: { key: K; label: React.ReactNode; count?: number }[]; value: K; onChange: (k: K) => void; className?: string }) {
  return (
    <div className={clsx("scroll-thin inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-sunken p-0.5", className)}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          aria-pressed={it.key === value}
          onClick={() => onChange(it.key)}
          className={clsx("inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-[12.5px] font-medium transition-colors", it.key === value ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08)]" : "text-muted hover:text-ink")}
        >
          {it.label}
          {it.count !== undefined ? <span className={clsx("num text-[11px]", it.key === value ? "text-muted" : "text-faint")}>{it.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
