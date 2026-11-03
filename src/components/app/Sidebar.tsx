"use client";

import { clsx } from "clsx";
import { Activity, Bot, Inbox, Keyboard, LayoutDashboard, Radar, Settings, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavCounts } from "@/lib/nav";
import { Kbd } from "../ui/Kbd";
import { Logo } from "../ui/Logo";

export type AiProviderKind = "anthropic" | "claude-code" | "replay";

/** How the AI runs, in the words the shell, Settings and the case page all use. */
export const AI_LABEL: Record<AiProviderKind, string> = { "claude-code": "Claude CLI · live", anthropic: "Claude API · live", replay: "Recorded runs" };

type NavItem = { href: string; label: string; icon: typeof Inbox; match: (p: string) => boolean; badge?: keyof NavCounts; badgeTip?: string };

const NAV: NavItem[] = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, match: (p) => p === "/app" },
  { href: "/app/disputes", label: "Disputes", icon: Inbox, match: (p) => p.startsWith("/app/disputes"), badge: "needsResponse", badgeTip: "need a response" },
  { href: "/app/protection", label: "Prevention", icon: Radar, match: (p) => p.startsWith("/app/protection"), badge: "atRisk", badgeTip: "orders at risk" },
  { href: "/app/autopilot", label: "Autopilot", icon: Sparkles, match: (p) => p.startsWith("/app/autopilot") },
  { href: "/app/approvals", label: "Agent requests", icon: Bot, match: (p) => p.startsWith("/app/approvals"), badge: "approvals", badgeTip: "waiting for your approval" },
  { href: "/app/activity", label: "PayPal activity", icon: Activity, match: (p) => p.startsWith("/app/activity") },
];

const SETTINGS: NavItem = { href: "/app/settings", label: "Settings", icon: Settings, match: (p) => p.startsWith("/app/settings") };

function NavLink({ n, active, count, onClick }: { n: NavItem; active: boolean; count?: number; onClick: () => void }) {
  return (
    <Link
      href={n.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={clsx("group flex h-8 items-center gap-2.5 rounded-[8px] px-2.5 text-[14px] transition-colors", active ? "bg-active font-medium text-ink" : "text-ink-2 hover:bg-[#efefed] hover:text-ink")}
    >
      <n.icon className={clsx("size-4 shrink-0", active ? "text-ink" : "text-muted group-hover:text-ink-2")} strokeWidth={1.6} />
      <span className="truncate">{n.label}</span>
      {count ? (
        <span title={`${count} ${n.badgeTip}`} className={clsx("num ml-auto text-[12px]", active ? "text-ink-2" : "text-muted")}>
          {count}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The left half of the frame: the product, the merchant it works for, the screens. It sits on the frame ground
 * with nothing between it and the top bar; the active screen is a neutral grey pill.
 */
export function Sidebar({ merchant, mode, counts, open, onClose }: { merchant: string; mode: string; counts: NavCounts; open: boolean; onClose: () => void }) {
  const path = usePathname();
  return (
    <>
      {open ? <div className="ask-fade fixed inset-0 z-40 bg-[rgb(10_10_10/0.18)] lg:hidden" onClick={onClose} aria-hidden /> : null}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-[264px] shrink-0 flex-col bg-frame px-3 pb-3 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:w-[232px] lg:translate-x-0",
          open ? "translate-x-0 shadow-[0_0_48px_rgb(0_0_0/0.14)]" : "-translate-x-full",
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-12 shrink-0 items-center justify-between px-2.5">
          <Link href="/" aria-label="Exhibit home" className="rounded-[6px]">
            <Logo />
          </Link>
          <button type="button" onClick={onClose} aria-label="Close menu" className="-mr-1 flex size-8 items-center justify-center rounded-[8px] text-muted hover:bg-active hover:text-ink lg:hidden">
            <X className="size-4" />
          </button>
        </div>
        <div className="mb-4 mt-1 px-2.5">
          <div className="truncate text-[14px] font-medium text-ink">{merchant}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
            <span className={clsx("size-1.5 shrink-0 rounded-full", mode === "sandbox" ? "bg-green" : "bg-amber")} aria-hidden />
            {mode === "sandbox" ? "PayPal sandbox merchant" : "Demo merchant"}
          </div>
        </div>
        <nav className="flex flex-col gap-0.5" aria-label="Screens">
          {NAV.map((n) => (
            <NavLink key={n.href} n={n} active={n.match(path)} count={n.badge ? counts[n.badge] : undefined} onClick={onClose} />
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5">
          <NavLink n={SETTINGS} active={SETTINGS.match(path)} onClick={onClose} />
          <button
            type="button"
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent("exhibit:shortcuts"));
            }}
            className="group flex h-8 items-center gap-2.5 rounded-[8px] px-2.5 text-[14px] text-ink-2 transition-colors hover:bg-[#efefed] hover:text-ink"
          >
            <Keyboard className="size-4 shrink-0 text-muted group-hover:text-ink-2" strokeWidth={1.6} />
            Shortcuts
            <Kbd className="ml-auto">?</Kbd>
          </button>
        </div>
      </aside>
    </>
  );
}
