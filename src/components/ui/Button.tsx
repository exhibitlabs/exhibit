import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "amber";

/**
 * One button system for the whole app. Heights 28 / 32 / 40, radius 8, Geist 13 or 14 at 500.
 * Primary is ink and appears once per screen; secondary is white with a 1px edge; ghost is text.
 * `amber` is kept as an alias of secondary for older call sites.
 */
export const BUTTON_VARIANT: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-[#2a2a29] active:bg-black disabled:bg-[#ededeb] disabled:text-muted",
  secondary: "border border-line-strong bg-surface text-ink hover:border-[#cdcdca] hover:bg-hover disabled:border-line disabled:text-ghost disabled:hover:bg-surface",
  ghost: "text-ink-2 hover:bg-active hover:text-ink disabled:text-ghost disabled:hover:bg-transparent",
  danger: "border border-[#efd3d3] bg-surface text-red hover:border-[#e5bcbc] hover:bg-red-soft disabled:text-ghost",
  amber: "border border-line-strong bg-surface text-ink hover:border-[#cdcdca] hover:bg-hover disabled:text-ghost",
};

/** `icon` and `iconSm` are square buttons for a single glyph (give them an aria-label). */
export const BUTTON_SIZE = { sm: "h-7 px-2.5 text-[13px]", md: "h-8 px-3 text-[13px]", lg: "h-10 px-4 text-[14px]", icon: "size-8 text-[13px]", iconSm: "size-7 text-[13px]" } as const;

export const buttonClass = (variant: Variant = "secondary", size: keyof typeof BUTTON_SIZE = "md", className?: string) =>
  clsx("inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-[8px] font-medium transition-colors disabled:cursor-not-allowed", BUTTON_SIZE[size], BUTTON_VARIANT[variant], className);

export function Button({ variant = "secondary", size = "md", className, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof BUTTON_SIZE }) {
  return <button type={type} {...props} className={buttonClass(variant, size, className)} />;
}
