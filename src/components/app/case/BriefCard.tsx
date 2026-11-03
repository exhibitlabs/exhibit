"use client";

import { clsx } from "clsx";
import { AlertTriangle, CircleHelp, History } from "lucide-react";
import type { CaseBrief } from "@/lib/agent/brief";
import { usd } from "@/lib/format";
import { refLabel } from "@/lib/reflabel";
import { Chip, DECISION_META, type Tone } from "../../ui/Chip";
import { Tip } from "../../ui/Tooltip";

function Gauge({ value, tone }: { value: number; tone: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[68px]">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#ececec" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={tone} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="ring-fill" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="num text-[17px]">{value}</span>
        <span className="num text-[10px] text-muted">%</span>
      </div>
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
  const tone = brief.decision === "FIGHT" ? "var(--green)" : brief.decision === "REFUND" ? "var(--red)" : "var(--ink)";
  return (
    <section className={clsx("card rise overflow-hidden transition-opacity", stale && "opacity-60")} aria-label="Exhibit's brief">
      <div className="flex items-start gap-5 border-b border-line p-5">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Chip tone={m.tone}>{m.label}</Chip>
            <span className="text-[12px] text-muted">
              {brief.confidence.toLowerCase()} confidence
              {replayed && !prepared ? " · recorded run, replayed" : ms && !prepared ? ` · ${ms < 10_000 ? (ms / 1000).toFixed(1) : Math.round(ms / 1000)}s investigation` : ""}
            </span>
            {prepared ? (
              <Tip label="Prepared from a recorded run when the demo was reset. Every tool call ran live against this case, and the brief passed the same checks as a live one." wide side="bottom" align="start">
                <span className="inline-flex items-center gap-1 rounded-md bg-sunken px-1.5 py-0.5 text-[11px] text-muted">
                  <History className="size-3" /> Prepared at reset
                </span>
              </Tip>
            ) : null}
            {stale ? <span className="text-[11.5px] text-muted">· the previous brief, while Exhibit re-runs</span> : null}
          </div>
          <h2 className="display text-[22px] leading-[1.2] tracking-[-0.025em]">{brief.headline}</h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{brief.summary}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <Gauge value={brief.win_likelihood} tone={tone} />
          <span className="text-[11px] text-muted">{brief.decision === "REFUND" ? "chance if fought" : "win likelihood"}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 divide-line border-b border-line text-[12px] sm:grid-cols-4 sm:divide-x">
        <div className="px-5 py-3">
          <div className="text-muted">At stake</div>
          <div className="num mt-0.5 text-[15px]">{usd(amount)}</div>
        </div>
        <div className="px-5 py-3">
          <div className="text-muted">Expected back</div>
          <div className="num mt-0.5 text-[15px]">{usd(expected)}</div>
        </div>
        <div className="px-5 py-3">
          <div className="text-muted">Exhibits</div>
          <div className="num mt-0.5 text-[15px]">{brief.exhibits.length ? (brief.exhibits.length > 3 ? `${brief.exhibits[0].label}–${brief.exhibits.at(-1)!.label}` : brief.exhibits.map((e) => e.label).join(" · ")) : "none"}</div>
        </div>
        <div className="px-5 py-3">
          <div className="text-muted">Seller Protection</div>
          <div className="mt-1">{protection ? <Chip tone={protection.tone}>{protection.label}</Chip> : <span className="text-faint">n/a</span>}</div>
        </div>
      </div>
      <div className="space-y-3 p-5">
        <ol className="space-y-2.5">
          {brief.reasoning.map((r, i) => (
            <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed">
              <span className="num mt-0.5 text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <div>
                {r.point}
                {r.refs.length ? (
                  <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
                    {r.refs.map((ref) => {
                      const ex = brief.exhibits.find((e) => e.ref === ref);
                      return (
                        <button
                          type="button"
                          key={ref}
                          title={ref}
                          onMouseEnter={() => onHoverRef?.(ref)}
                          onMouseLeave={() => onHoverRef?.(null)}
                          onFocus={() => onHoverRef?.(ref)}
                          onBlur={() => onHoverRef?.(null)}
                          className={clsx("inline-flex items-center gap-1 rounded border px-1.5 py-px text-[11px] transition-colors", hoverRef === ref ? "border-ink bg-ink text-white" : "border-line text-muted hover:border-line-strong hover:text-ink")}
                        >
                          {ex ? <span className={clsx("num font-semibold", hoverRef === ref ? "text-white" : "text-ink")}>{ex.label}</span> : null}
                          {refLabel(ref)}
                        </button>
                      );
                    })}
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        {brief.risks.length || brief.missing_evidence.length ? (
          <div className="grid gap-3 pt-2 md:grid-cols-2">
            {brief.risks.length ? (
              <div className="rounded-lg border border-line p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink">
                  <AlertTriangle className="size-3.5" /> What could go wrong
                </div>
                <ul className="space-y-1 text-[12.5px] leading-snug text-ink-2">
                  {brief.risks.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {brief.missing_evidence.length ? (
              <div className="rounded-lg bg-sunken p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-ink-2">
                  <CircleHelp className="size-3.5" /> Would strengthen the case
                </div>
                <ul className="space-y-1 text-[12.5px] leading-snug text-ink-2">
                  {brief.missing_evidence.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
