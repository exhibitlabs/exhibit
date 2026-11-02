"use client";

import { clsx } from "clsx";
import { Check, Minus } from "lucide-react";
import { dateTime } from "@/lib/format";
import type { LifeStep } from "./caseState";

/** The dispute's lifecycle, driven by PayPal's status, the brief and the actions on record. */
export function Lifecycle({ steps, running }: { steps: LifeStep[]; running: boolean }) {
  return (
    <ol className="scroll-thin flex items-stretch overflow-x-auto" aria-label="Dispute lifecycle">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        const tone = s.state === "done" && s.tone === "green" ? "green" : s.state === "done" && s.tone === "red" ? "red" : null;
        return (
          <li key={s.key} className={clsx("flex min-w-[150px] flex-1 items-start gap-2.5", !last && "pr-3")} aria-current={s.state === "active" ? "step" : undefined}>
            <div className="flex flex-col items-center pt-0.5">
              <span
                className={clsx(
                  "relative flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors duration-300",
                  s.state === "done" && (tone === "green" ? "border-green bg-green text-white" : tone === "red" ? "border-red bg-red text-white" : "border-ink bg-ink text-white"),
                  s.state === "active" && "border-ink bg-surface",
                  s.state === "todo" && "border-line-strong bg-surface",
                  s.state === "skipped" && "border-dashed border-line-strong bg-surface text-faint",
                )}
              >
                {s.state === "done" ? <Check className="size-2.5" strokeWidth={3.5} /> : s.state === "skipped" ? <Minus className="size-2.5" /> : s.state === "active" ? <span className={clsx("size-1.5 rounded-full bg-ink", running && s.key === "investigated" && "pulse-dot")} /> : null}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={clsx("truncate text-[12.5px] font-medium leading-tight", s.state === "todo" || s.state === "skipped" ? "text-faint" : tone === "green" ? "text-green" : tone === "red" ? "text-red" : "text-ink")}>{s.label}</span>
                {!last ? <span className={clsx("h-px min-w-4 flex-1", s.state === "done" ? "bg-ink/30" : "bg-line")} aria-hidden /> : null}
              </div>
              <div className={clsx("mt-0.5 truncate text-[11.5px] leading-tight", s.state === "active" ? "text-ink-2" : "text-muted")}>{s.detail}</div>
              {s.at ? (
                <div suppressHydrationWarning className="mt-0.5 truncate text-[11px] leading-tight text-faint">
                  {dateTime(s.at)}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
