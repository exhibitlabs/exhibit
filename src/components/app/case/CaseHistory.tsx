"use client";

import { clsx } from "clsx";
import { Bot, Database, FileCheck2, Gavel, TriangleAlert, User, Webhook } from "lucide-react";
import type { TimelineItem } from "@/lib/activity";
import { dateTime } from "@/lib/format";

const ICON = { agent: Bot, merchant: User, webhook: Webhook, system: Database, api: FileCheck2 } as const;

/** The audit trail for this case: who did what, in order. PayPal API calls live in their own tab. */
export function CaseHistory({ items }: { items: TimelineItem[] }) {
  const list = items.filter((i) => i.lane !== "api");
  if (!list.length) return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-muted">Nothing on record for this case yet.</p>;
  return (
    <ol className="card relative px-5 py-3">
      <span className="absolute bottom-6 left-[31px] top-6 w-px bg-line" aria-hidden />
      {list.map((e) => {
        const Icon = e.error ? TriangleAlert : e.kind === "sandbox" ? Gavel : ICON[e.lane];
        return (
          <li key={e.id} className="relative flex items-start gap-3 py-2">
            <span className={clsx("relative z-10 mt-px grid size-[22px] shrink-0 place-items-center rounded-full border bg-surface", e.error ? "border-red/30 text-red" : e.lane === "merchant" ? "border-ink/30 text-ink" : "border-line text-ink-2")}>
              <Icon className="size-3" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className={clsx("text-[12.5px] leading-snug", e.error ? "text-red" : "text-ink")}>{e.title}</div>
              <div className="mt-0.5 text-[11.5px] text-muted">{e.actor}</div>
            </div>
            <span suppressHydrationWarning className="shrink-0 pt-px text-[11px] text-faint">
              {dateTime(e.at)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
