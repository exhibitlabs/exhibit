"use client";

import { clsx } from "clsx";
import { Bot, Database, FileCheck2, Gavel, TriangleAlert, User, Webhook } from "lucide-react";
import type { TimelineItem } from "@/lib/activity";
import { dateTime } from "@/lib/format";

const ICON = { agent: Bot, merchant: User, webhook: Webhook, system: Database, api: FileCheck2 } as const;

/** The audit trail for this case: who did what, in order. PayPal API calls live in their own tab. */
export function CaseHistory({ items }: { items: TimelineItem[] }) {
  const list = items.filter((i) => i.lane !== "api");
  if (!list.length) return <p className="rounded-[10px] border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-muted">Nothing on record for this case yet.</p>;
  return (
    <ol className="card border px-5 py-2">
      {list.map((e) => {
        const Icon = e.error ? TriangleAlert : e.kind === "sandbox" ? Gavel : ICON[e.lane];
        return (
          <li key={e.id} className="flex items-start gap-3 border-b border-rule py-2.5 last:border-0">
            <Icon className={clsx("mt-0.5 size-4 shrink-0", e.error ? "text-red" : e.lane === "merchant" ? "text-ink" : "text-muted")} strokeWidth={1.7} />
            <div className="min-w-0 flex-1">
              <div className={clsx("text-[13px] leading-[19px]", e.error ? "text-red" : "text-ink")}>{e.title}</div>
              <div className="text-[12px] text-muted">{e.actor}</div>
            </div>
            <span suppressHydrationWarning className="shrink-0 pt-px text-[12px] text-muted">
              {dateTime(e.at)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
