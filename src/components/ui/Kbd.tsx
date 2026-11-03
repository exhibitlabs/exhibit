import { clsx } from "clsx";

/** A key cap: 18px, Geist Mono 11, the one place the app goes under 12px (a glyph, not a sentence). */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={clsx("mono inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-[4px] border border-line-strong bg-surface px-1 text-[11px] font-medium leading-none text-muted", className)}>
      {children}
    </kbd>
  );
}
