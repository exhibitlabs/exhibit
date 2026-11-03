import { clsx } from "clsx";

/**
 * A quiet hover and focus tooltip. CSS only, so it works in server and client components alike.
 * Wrap the trigger; the label reads on hover or keyboard focus.
 */
export function Tip({ label, children, side = "top", align = "center", className, wide }: { label: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom"; align?: "center" | "start" | "end"; className?: string; wide?: boolean }) {
  return (
    <span className={clsx("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={clsx(
          "pointer-events-none invisible absolute z-[70] rounded-[6px] bg-ink px-2 py-1 text-[12px] font-normal leading-snug text-white opacity-0 shadow-[0_6px_18px_rgb(0_0_0/0.16)] transition-[opacity,visibility] delay-0 duration-150 group-hover/tt:visible group-hover/tt:opacity-100 group-hover/tt:delay-300 group-focus-within/tt:visible group-focus-within/tt:opacity-100",
          wide ? "w-64 whitespace-normal" : "whitespace-nowrap",
          side === "top" ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]",
          align === "center" ? "left-1/2 -translate-x-1/2" : align === "start" ? "left-0" : "right-0",
        )}
      >
        {label}
      </span>
    </span>
  );
}
