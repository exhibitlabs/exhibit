"use client";

import { clsx } from "clsx";
import { dateTime, dueLabel } from "@/lib/format";
import { DecisionChip } from "../ui/Chip";

/** Time left in PayPal's response window: a countdown that turns red inside 48 hours. Same everywhere. */
export function DeadlineBar({ hoursLeft, createdAt, dueAt, resolved }: { hoursLeft: number | null; createdAt?: string; dueAt: string | null; resolved?: boolean }) {
  if (resolved) return <span className="text-[12.5px] text-faint">Closed</span>;
  if (hoursLeft === null) return <span className="text-[12.5px] text-faint">No deadline</span>;
  const urgent = hoursLeft < 48;
  const windowH = createdAt && dueAt ? Math.max(1, (Date.parse(dueAt) - Date.parse(createdAt)) / 3600_000) : null;
  const left = windowH ? Math.max(0.03, Math.min(1, hoursLeft / windowH)) : 0.5;
  return (
    <span className="flex flex-col justify-center gap-1.5" title={dueAt ? `Respond by ${dateTime(dueAt)}` : undefined}>
      <span suppressHydrationWarning className={clsx("flex items-center gap-1.5 text-[13px] font-medium", urgent ? "text-red" : hoursLeft < 120 ? "text-ink" : "text-ink-2")}>
        {urgent ? <span className="pulse-dot size-1.5 rounded-full bg-red" /> : null}
        <span className="num">{dueLabel(hoursLeft)}</span>
      </span>
      <span className="h-[3px] w-[80px] overflow-hidden rounded-full bg-[#efefef]">
        <span className="bar-grow block h-full rounded-full" style={{ width: `${left * 100}%`, background: urgent ? "var(--red)" : "var(--ink)" }} />
      </span>
    </span>
  );
}

/** Exhibit's call and its win likelihood. */
export function CallPill({ decision, likelihood, empty = "Not analyzed yet" }: { decision: string | null; likelihood: number | null; empty?: string }) {
  if (!decision) return <span className="text-[12px] text-faint">{empty}</span>;
  const l = likelihood ?? 0;
  return (
    <span className="flex items-center gap-2">
      <DecisionChip decision={decision} />
      <span className="relative h-1 w-10 shrink-0 overflow-hidden rounded-full bg-[#ececec]">
        <span className="bar-grow absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${Math.max(4, l)}%` }} />
      </span>
      <span className="num text-[12px] text-ink-2">{l}%</span>
    </span>
  );
}
