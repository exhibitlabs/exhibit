"use client";

import { clsx } from "clsx";
import { Activity, Bot, Inbox, Keyboard, LayoutDashboard, Radar, Settings, Sparkle, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavCounts, Notice } from "@/lib/nav";
import { Kbd } from "../ui/Kbd";
import { Logo } from "../ui/Logo";
import { Tip } from "../ui/Tooltip";
import { Notifications } from "./Notifications";

export type AiProviderKind = "anthropic" | "claude-code" | "replay";

/** How the AI runs, in the words the sidebar, Settings and the case page all use. */
export const AI_LABEL: Record<AiProviderKind, string> = { "claude-code": "Claude CLI · live", anthropic: "Claude API · live", replay: "Recorded runs" };

const NAV = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, match: (p: string) => p === "/app", key: "o" },
  { href: "/app/disputes", label: "Disputes", icon: Inbox, match: (p: string) => p.startsWith("/app/disputes"), key: "d", badge: "needsResponse" as const, badgeTip: "need a response" },
  { href: "/app/protection", label: "Prevention", icon: Radar, match: (p: string) => p.startsWith("/app/protection"), key: "p", badge: "atRisk" as const, badgeTip: "orders at risk" },
  { href: "/app/autopilot", label: "Autopilot", icon: Sparkles, match: (p: string) => p.startsWith("/app/autopilot"), key: "a" },
  { href: "/app/approvals", label: "Agent requests", icon: Bot, match: (p: string) => p.startsWith("/app/approvals"), key: "r", badge: "approvals" as const, badgeTip: "waiting for your approval" },
  { href: "/app/activity", label: "PayPal activity", icon: Activity, match: (p: string) => p.startsWith("/app/activity"), key: "l" },
  { href: "/app/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/app/settings"), key: "s" },
];

export function Sidebar({ merchant, mode, provider, counts, notices, open, onClose }: { merchant: string; mode: string; provider: AiProviderKind; counts: NavCounts; notices: Notice[]; open: boolean; onClose: () => void }) {
  const path = usePathname();
  return (
    <>
      {open ? <div className="ask-fade fixed inset-0 z-40 bg-black/20 lg:hidden" onClick={onClose} aria-hidden /> : null}
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-[248px] shrink-0 flex-col border-r border-line bg-[#fafafa] px-3 py-4 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:w-[232px] lg:translate-x-0",
          open ? "translate-x-0 shadow-[0_0_40px_rgb(0_0_0/0.12)]" : "-translate-x-full",
        )}
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between px-2 pb-5 pt-1">
          <Link href="/" aria-label="Exhibit home">
            <Logo />
          </Link>
          <div className="flex items-center gap-0.5">
            <Notifications notices={notices} />
            <button type="button" onClick={onClose} aria-label="Close menu" className="flex size-8 items-center justify-center rounded-md text-muted hover:bg-[#f0f0f0] lg:hidden">
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="mb-3 rounded-lg border border-line bg-surface px-3 py-2.5">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-faint">
            Merchant
            <span className={clsx("inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium normal-case tracking-normal", mode === "sandbox" ? "bg-green-soft text-green" : "bg-sunken text-ink-2")}>
              <span className={clsx("size-1.5 rounded-full", mode === "sandbox" ? "bg-green" : "bg-amber")} />
              {mode === "sandbox" ? "Sandbox" : "Demo"}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[13.5px] font-medium">{merchant}</div>
        </div>
        <button
          type="button"
          onClick={() => {
            onClose();
            window.dispatchEvent(new CustomEvent("exhibit:ask"));
          }}
          className="mb-3 flex h-8 items-center gap-2.5 rounded-md border border-line bg-surface px-2 text-[13px] text-ink-2 shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-colors hover:border-line-strong hover:text-ink"
        >
          <Sparkle className="size-4" strokeWidth={1.75} />
          Ask Exhibit
          <span className="ml-auto flex gap-0.5">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>
        <nav className="flex flex-col gap-0.5">
          {NAV.map((n) => {
            const active = n.match(path);
            const count = n.badge ? counts[n.badge] : 0;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                className={clsx("group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] transition-colors", active ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0/0.04)]" : "text-ink-2 hover:bg-[#f0f0f0]")}
              >
                <n.icon className="size-4 shrink-0" strokeWidth={1.75} />
                <span className="truncate">{n.label}</span>
                {count ? (
                  <span
                    title={`${count} ${n.badgeTip}`}
                    className={clsx(
                      "num ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-medium",
                      n.badge === "atRisk" ? "bg-[#ececec] text-ink-2" : "bg-ink text-white",
                    )}
                  >
                    {count}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-2 px-1 text-[12px] text-muted">
          <Tip label={mode === "sandbox" ? "Every call goes to api-m.sandbox.paypal.com" : "PayPal's API is simulated: real request shapes, errors and limits"} side="top" align="start">
            <div className="flex items-center gap-2">
              <span className={clsx("size-1.5 rounded-full", mode === "sandbox" ? "bg-green" : "bg-amber")} />
              {mode === "sandbox" ? "PayPal Sandbox · live API" : "Demo · PayPal simulator"}
            </div>
          </Tip>
          <Tip label={provider === "replay" ? "Recorded Claude runs; every tool call executes live" : provider === "claude-code" ? "The agent runs on this machine's Claude CLI login" : "The agent runs on the Claude API"} side="top" align="start">
            <div className="flex items-center gap-2">
              <span className={clsx("size-1.5 rounded-full", provider === "replay" ? "bg-faint" : "bg-green")} />
              {AI_LABEL[provider]}
            </div>
          </Tip>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("exhibit:shortcuts"))} className="-ml-1 flex items-center gap-2 rounded px-1 py-0.5 text-faint transition-colors hover:text-ink-2">
            <Keyboard className="size-3.5" strokeWidth={1.75} /> Shortcuts <Kbd className="ml-0.5">?</Kbd>
          </button>
        </div>
      </aside>
    </>
  );
}
