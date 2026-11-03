"use client";

import { clsx } from "clsx";
import { dateTime, dueLabel } from "@/lib/format";
import { DecisionChip } from "../ui/Chip";

/**
 * Time left in PayPal's response window: the countdown over a 2px track of the window that remains. Red only
 * inside 48 hours, the one point where an unanswered case is about to close for the buyer. Same everywhere.
 */
export function DeadlineBar({ hoursLeft, createdAt, dueAt, resolved }: { hoursLeft: number | null; createdAt?: string; dueAt: string | null; resolved?: boolean }) {
  if (resolved) return <span className="text-[13px] text-muted">Closed</span>;
  if (hoursLeft === null) return <span className="text-[13px] text-muted">No deadline</span>;
  const urgent = hoursLeft < 48;
  const windowH = createdAt && dueAt ? Math.max(1, (Date.parse(dueAt) - Date.parse(createdAt)) / 3600_000) : null;
  const left = windowH ? Math.max(0.04, Math.min(1, hoursLeft / windowH)) : 0.5;
  return (
    <span className="flex flex-col justify-center gap-1.5" title={dueAt ? `Respond by ${dateTime(dueAt)}` : undefined}>
      <span suppressHydrationWarning className={clsx("num text-[13px] font-medium leading-none", urgent ? "text-red" : "text-ink")}>
        {dueLabel(hoursLeft)}
      </span>
      <span className="h-[2px] w-16 overflow-hidden rounded-full bg-[#e8e8e6]" aria-hidden>
        <span className={clsx("block h-full rounded-full", urgent ? "bg-red" : "bg-ink-2")} style={{ width: `${left * 100}%` }} />
      </span>
    </span>
  );
}

/** Exhibit's call and its win likelihood: the tag, then the figure. */
export function CallPill({ decision, likelihood, empty = "Not analyzed yet" }: { decision: string | null; likelihood: number | null; empty?: string }) {
  if (!decision) return <span className="text-[13px] text-faint">{empty}</span>;
  return (
    <span className="flex items-center gap-2">
      <DecisionChip decision={decision} />
      <span className="num text-[13px] text-ink-2">{likelihood ?? 0}%</span>
    </span>
  );
}
