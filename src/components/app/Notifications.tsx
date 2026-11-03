"use client";

import { clsx } from "clsx";
import { Bell, Bot, CircleCheck, Clock3, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import type { Notice } from "@/lib/nav";
import { relTime } from "@/lib/format";

const SEEN_KEY = "exhibit:seen-notices";
const ICON = { approval: Bot, deadline: Clock3, resolved: CircleCheck, autopilot: Sparkles } as const;

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener("exhibit:seen", cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener("exhibit:seen", cb);
  };
};

/** Deadlines inside 72 hours, agent requests, rulings and Autopilot actions. Unread until opened. */
export function Notifications({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [now, setNow] = useState(0);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const seenRaw = useSyncExternalStore(subscribe, () => localStorage.getItem(SEEN_KEY) ?? "[]", () => "[]");
  const seen = new Set(JSON.parse(seenRaw) as string[]);
  const unread = notices.filter((n) => !seen.has(n.id));
  const urgent = unread.some((n) => n.urgent);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(380, window.innerWidth - 16);
    setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)) });
  }, []);

  const toggle = useCallback(() => {
    if (open) return setOpen(false);
    place();
    setNow(Date.now());
    setOpen(true);
  }, [open, place]);

  // N opens the panel. The shell renders a bell in each top bar; only the one on screen answers.
  useEffect(() => {
    const onKey = () => btn.current?.offsetParent !== null && toggle();
    window.addEventListener("exhibit:notifications", onKey);
    return () => window.removeEventListener("exhibit:notifications", onKey);
  }, [toggle]);

  useEffect(() => {
    if (!open) return;
    // Opening reads them: mark everything shown as seen.
    const t = setTimeout(() => {
      localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...readSeen(), ...notices.map((n) => n.id)])].slice(-200)));
      window.dispatchEvent(new Event("exhibit:seen"));
    }, 1200);
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    return () => {
      clearTimeout(t);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
    };
  }, [open, notices, place]);

  const needs = notices.filter((n) => n.kind === "approval" || n.kind === "deadline");
  const updates = notices.filter((n) => n.kind === "resolved" || n.kind === "autopilot");

  return (
    <>
      <button ref={btn} type="button" onClick={toggle} aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ""}`} aria-expanded={open} className={clsx("relative flex size-8 items-center justify-center rounded-[8px] transition-colors max-lg:size-10", open ? "bg-active text-ink" : "text-ink-2 hover:bg-active hover:text-ink")}>
        <Bell className="size-4" strokeWidth={1.7} />
        {unread.length ? <span className={clsx("absolute right-[7px] top-[7px] size-[7px] rounded-full ring-2 ring-frame max-lg:right-[11px] max-lg:top-[11px]", urgent ? "bg-red" : "bg-ink")} /> : null}
      </button>
      {open && pos
        ? createPortal(
            <div ref={panel} role="dialog" aria-label="Notifications" style={{ top: pos.top, left: pos.left, width: Math.min(380, window.innerWidth - 16) }} className="app-shell ask-in fixed z-[95] overflow-hidden rounded-[10px] border border-line bg-surface shadow-[0_24px_60px_-16px_rgb(0_0_0/0.22),0_6px_18px_-8px_rgb(0_0_0/0.1)]">
              <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
                <span className="text-[14px] font-semibold">Notifications</span>
                <span className="text-[12px] text-muted">{unread.length ? `${unread.length} new` : "All caught up"}</span>
              </div>
              <div className="scroll-thin max-h-[60vh] overflow-y-auto pb-2">
                {!notices.length ? (
                  <div className="px-4 pb-6 pt-4 text-center">
                    <div className="text-[14px] font-medium text-ink-2">Nothing needs you</div>
                    <div className="mt-1 text-[13px] text-muted">Deadlines inside 72 hours and agent requests show up here.</div>
                  </div>
                ) : null}
                {[
                  ["Needs you", needs],
                  ["Updates", updates],
                ].map(([label, list]) =>
                  (list as Notice[]).length ? (
                    <div key={label as string}>
                      <div className="px-4 pb-1 pt-2 text-[12px] text-muted">{label as string}</div>
                      {(list as Notice[]).map((n) => {
                        const Icon = ICON[n.kind];
                        return (
                          <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="mx-1.5 flex gap-3 rounded-[8px] px-2.5 py-2 transition-colors hover:bg-hover">
                            <Icon className={clsx("mt-0.5 size-4 shrink-0", n.urgent && n.kind === "deadline" ? "text-red" : n.kind === "resolved" ? "text-green" : "text-muted")} strokeWidth={1.8} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-start gap-2">
                                <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-ink">{n.title}</span>
                                {!seen.has(n.id) ? <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink" aria-label="unread" /> : null}
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] text-muted">{n.detail}</span>
                              {n.kind !== "deadline" ? <span suppressHydrationWarning className="mt-0.5 block text-[12px] text-faint">{relTime(n.at, now)}</span> : null}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  ) : null,
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
