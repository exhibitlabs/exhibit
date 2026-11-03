"use client";

import { clsx } from "clsx";
import { AlertTriangle, CircleHelp } from "lucide-react";
import type { CaseBrief } from "@/lib/agent/brief";
import { usd } from "@/lib/format";
import { refLabel } from "@/lib/reflabel";
import { Chip, DECISION_META, type Tone } from "../../ui/Chip";
import { Tip } from "../../ui/Tooltip";
import { plain } from "@/lib/plain";

function Stat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx("px-5 py-3", className)}>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 text-[16px] leading-6 text-ink">{children}</div>
    </div>
  );
}

/** Exhibit's decision and the reasoning behind it. Every point carries the records it rests on. */
export function BriefCard({
  brief,
  amount,
  expected,
  ms,
  replayed,
  prepared,
  stale,
  protection,
  hoverRef,
  onHoverRef,
}: {
  brief: CaseBrief;
  amount: number;
  expected: number;
  ms?: number;
  /** A recorded run replayed: it has no investigation time worth showing. */
  replayed?: boolean;
  prepared?: boolean;
  stale?: boolean;
  protection?: { tone: Tone; label: string } | null;
  hoverRef?: string | null;
  onHoverRef?: (ref: string | null) => void;
}) {
  const m = DECISION_META[brief.decision];
  return (
    <section className={clsx("card overflow-hidden border transition-opacity", stale && "opacity-60")} aria-label="Exhibit's brief">
      <div className="px-5 pb-4 pt-4">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
          <Chip tone={m.tone}>{m.label}</Chip>
          <span>{brief.confidence.toLowerCase()} confidence</span>
          {replayed && !prepared ? <span>· recorded run, replayed</span> : ms && !prepared ? <span>· {ms < 10_000 ? (ms / 1000).toFixed(1) : Math.round(ms / 1000)} s investigation</span> : null}
          {prepared ? (
            <Tip label="Prepared from a recorded run when the demo was reset. Every tool call ran live against this case, and the brief passed the same checks as a live one." wide side="bottom" align="start">
              <span className="cursor-help underline decoration-line-strong decoration-dotted underline-offset-[3px]">· prepared at the demo reset</span>
            </Tip>
          ) : null}
          {stale ? <span>· the previous brief, while Exhibit re-runs</span> : null}
        </div>
        <h2 className="text-[20px] font-semibold leading-[27px] tracking-[-0.015em] text-ink">{plain(brief.headline)}</h2>
        <p className="mt-2 text-[14px] leading-[22px] text-ink-2">{plain(brief.summary)}</p>
      </div>
      <div className="grid grid-cols-2 border-y border-line sm:grid-cols-4 sm:divide-x sm:divide-line max-sm:[&>*:nth-child(odd)]:border-r max-sm:[&>*:nth-child(-n+2)]:border-b [&>*]:border-line">
        <Stat label={brief.decision === "REFUND" ? "Chance if fought" : "Win likelihood"}>
          <span className="num font-semibold">{brief.win_likelihood}%</span>
        </Stat>
        <Stat label="At stake">
          <span className="mono text-[14px]">{usd(amount)}</span>
        </Stat>
        <Stat label="Expected back">
          <span className="mono text-[14px]">{usd(expected)}</span>
        </Stat>
        <Stat label="Seller Protection">
          {protection ? <span className={clsx("text-[14px]", protection.tone === "green" ? "text-green" : protection.tone === "red" ? "text-red" : "text-ink-2")}>{protection.label}</span> : <span className="text-[14px] text-muted">–</span>}
        </Stat>
      </div>
      <div className="px-5 py-4">
        <h3 className="mb-2 text-[13px] font-medium text-muted">Why</h3>
        <ul className="space-y-3">
          {brief.reasoning.map((r, i) => (
            <li key={i} className="text-[14px] leading-[22px] text-ink">
              {plain(r.point)}
              {r.refs.length ? (
                <span className="ml-1.5 inline-flex flex-wrap gap-1 align-[1px]">
                  {r.refs.map((ref) => {
                    const ex = brief.exhibits.find((e) => e.ref === ref);
                    const on = hoverRef === ref;
                    return (
                      <button
                        type="button"
                        key={ref}
                        title={ref}
                        onMouseEnter={() => onHoverRef?.(ref)}
                        onMouseLeave={() => onHoverRef?.(null)}
                        onFocus={() => onHoverRef?.(ref)}
                        onBlur={() => onHoverRef?.(null)}
                        className={clsx("inline-flex h-5 items-center gap-1 rounded-[6px] border px-1.5 text-[12px] leading-none transition-colors", on ? "border-ink bg-ink text-white" : "border-line-strong text-muted hover:border-ink hover:text-ink")}
                      >
                        {ex ? <span className={clsx("mono font-semibold", on ? "text-white" : "text-ink")}>{ex.label}</span> : null}
                        {refLabel(ref)}
                      </button>
                    );
                  })}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      {brief.risks.length || brief.missing_evidence.length ? (
        <div className="grid gap-x-8 gap-y-4 border-t border-line px-5 py-4 md:grid-cols-2">
          {brief.risks.length ? (
            <div>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <AlertTriangle className="size-3.5 text-muted" strokeWidth={1.9} /> What could go wrong
              </h3>
              <ul className="list-disc space-y-1 pl-4 text-[13px] leading-[20px] text-ink-2 marker:text-ghost">
                {brief.risks.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {brief.missing_evidence.length ? (
            <div>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <CircleHelp className="size-3.5 text-muted" strokeWidth={1.9} /> Would strengthen the case
              </h3>
              <ul className="list-disc space-y-1 pl-4 text-[13px] leading-[20px] text-ink-2 marker:text-ghost">
                {brief.missing_evidence.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
