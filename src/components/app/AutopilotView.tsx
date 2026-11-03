"use client";

import { clsx } from "clsx";
import { Check, Loader2, Lock, Undo2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CaseBrief } from "@/lib/agent/brief";
import { AUTOPILOT_LIMITS, evaluateAutopilot, simulateAutopilot, type AutopilotSettings, type SimCase } from "@/lib/autopilot-rules";
import { usd } from "@/lib/format";
import { REASON_LABEL, type DisputeReason } from "@/lib/paypal/types";
import { Button } from "../ui/Button";
import { DECISION_META } from "../ui/Chip";
import { toast } from "../ui/Toast";
import { PageHeader } from "./PageHeader";

type Case = { id: string; buyer: string; reason: string; amount: number; brief: CaseBrief };

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={clsx("relative h-5 w-[34px] shrink-0 rounded-full transition-colors", on ? "bg-ink" : "bg-[#cdcdca]")}>
      <span className={clsx("absolute top-[2px] size-4 rounded-full bg-white transition-[left]", on ? "left-4" : "left-[2px]")} />
    </button>
  );
}

function Money({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="inline-flex h-8 items-center rounded-[8px] border border-line-strong bg-surface px-2.5 text-[13px] focus-within:border-ink focus-within:shadow-[0_0_0_1px_var(--ink)]">
      <span className="text-muted">$</span>
      <input type="number" aria-label={label} min={AUTOPILOT_LIMITS.maxAmount.min} max={AUTOPILOT_LIMITS.maxAmount.max} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mono outline-none w-16 bg-transparent text-right text-[13px]" />
    </span>
  );
}

function Rule({ title, body, on, onToggle, stat, children }: { title: string; body: string; on: boolean; onToggle: (v: boolean) => void; stat?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-b border-line px-5 py-4 last:border-0">
      <div className="pt-0.5">
        <Toggle on={on} onChange={onToggle} label={title} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="text-[14px] font-medium text-ink">{title}</div>
          {stat ? <div className="num text-[12px] text-muted">{stat}</div> : null}
        </div>
        <div className="mt-0.5 text-[13px] leading-[20px] text-muted">{body}</div>
        {children ? (
          <fieldset disabled={!on} className={clsx("mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-2", !on && "text-muted")}>
            {children}
          </fieldset>
        ) : null}
      </div>
    </div>
  );
}

const W = 420;
const H = 230;
const PAD = { l: 44, r: 14, t: 12, b: 30 };

/** Past fights by win likelihood and amount, with the zone your rule would have auto-filed. */
function DecisionMap({ cases, s }: { cases: SimCase[]; s: AutopilotSettings }) {
  const fights = cases.filter((c) => c.decision === "FIGHT");
  const [hover, setHover] = useState<SimCase | null>(null);
  const maxY = Math.max(400, Math.ceil(Math.max(...fights.map((c) => c.amount), 0) / 100) * 100);
  const x = (l: number) => PAD.l + ((l - 40) / 60) * (W - PAD.l - PAD.r);
  const y = (a: number) => H - PAD.b - (a / maxY) * (H - PAD.t - PAD.b);
  const minL = Math.max(s.fight.minLikelihood, AUTOPILOT_LIMITS.minLikelihood.min);
  const zoneOn = s.fight.enabled;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Past fights by win likelihood and amount">
        {[0, maxY / 2, maxY].map((a) => (
          <g key={a}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(a)} y2={y(a)} stroke="#efefed" />
            <text x={PAD.l - 8} y={y(a) + 4} textAnchor="end" className="fill-[#737371] text-[11px]">
              ${a}
            </text>
          </g>
        ))}
        {[40, 60, 80, 100].map((l) => (
          <text key={l} x={x(l)} y={H - 9} textAnchor="middle" className="fill-[#737371] text-[11px]">
            {l}%
          </text>
        ))}
        {zoneOn ? (
          <g>
            <rect x={x(minL)} y={y(Math.min(s.fight.maxAmount, maxY))} width={x(100) - x(minL)} height={y(0) - y(Math.min(s.fight.maxAmount, maxY))} fill="rgb(21 128 61 / 0.06)" stroke="rgb(21 128 61 / 0.4)" strokeDasharray="4 3" rx="4" />
          </g>
        ) : null}
        <line x1={x(AUTOPILOT_LIMITS.minLikelihood.min)} x2={x(AUTOPILOT_LIMITS.minLikelihood.min)} y1={PAD.t} y2={H - PAD.b} stroke="#cdcdca" strokeDasharray="2 3" />
        {fights.map((c) => {
          const inZone = zoneOn && c.confidence !== "LOW" && c.likelihood >= minL && c.amount <= s.fight.maxAmount;
          const won = c.recovered > 0;
          const color = won ? "var(--green)" : "var(--red)";
          return (
            <circle
              key={c.id}
              cx={x(c.likelihood)}
              cy={y(c.amount)}
              r={hover?.id === c.id ? 6 : 4.5}
              fill={c.confidence === "LOW" ? "#fff" : color}
              stroke={color}
              strokeWidth={c.confidence === "LOW" ? 1.6 : 1}
              opacity={inZone ? 1 : 0.38}
              onMouseEnter={() => setHover(c)}
              onMouseLeave={() => setHover(null)}
              className="cursor-pointer transition-[r,opacity] duration-200"
            />
          );
        })}
      </svg>
      {hover ? (
        <div className="pv-fade pointer-events-none absolute right-2 top-2 w-60 rounded-[8px] bg-ink px-3 py-2 text-[12px] leading-[18px] text-white shadow-[0_8px_24px_rgb(0_0_0/0.18)]">
          <div className="font-medium">
            <span className="mono">{hover.id}</span> · {usd(hover.amount, 0)}
          </div>
          <div className="text-white/70">
            {REASON_LABEL[hover.reason as DisputeReason] ?? hover.reason} · {hover.likelihood}% · {hover.confidence.toLowerCase()} confidence
          </div>
          <div className={hover.recovered > 0 ? "text-[#86efac]" : "text-[#fca5a5]"}>{hover.recovered > 0 ? "PayPal ruled for the merchant" : "PayPal ruled for the buyer"}</div>
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green" /> Won
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-red" /> Lost
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full border-[1.5px] border-ink-2" /> Low confidence, always yours
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-[3px] border border-dashed border-green/50 bg-green/10" /> Auto-file zone
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-3 border-t border-dashed border-[#cdcdca]" /> {AUTOPILOT_LIMITS.minLikelihood.min}% floor
        </span>
      </div>
    </div>
  );
}

export function AutopilotView({ initial, cases, history, mode }: { initial: AutopilotSettings; cases: Case[]; history: SimCase[]; mode: string }) {
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(s) !== JSON.stringify(saved);
  const sim = useMemo(() => simulateAutopilot(history, s), [history, s]);
  const preview = useMemo(() => cases.map((c) => ({ ...c, verdict: evaluateAutopilot(c.brief, c.amount, { ...s, enabled: true }) })), [cases, s]);
  const autoNow = preview.filter((p) => p.verdict.verdict === "AUTO");

  const update = (patch: Partial<AutopilotSettings>) => setS((prev) => ({ ...prev, ...patch }));
  const save = async (next = s) => {
    setSaving(true);
    try {
      const res = await fetch("/api/autopilot", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
      const stored = (await res.json()) as AutopilotSettings;
      if (!res.ok) throw new Error("Not saved");
      setS(stored);
      setSaved(stored);
      toast({ title: stored.enabled ? "Autopilot is on" : "Rules saved", sub: stored.enabled ? "When an investigation finishes and its brief is inside these rules, Exhibit sends the response. Everything else waits for you." : "Autopilot stays off until you switch it on.", tone: "success" });
    } catch {
      toast({ title: "Couldn't save the rules", tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  const ruleStat = (k: keyof typeof sim.byRule) => {
    const r = sim.byRule[k];
    const n = r.auto + r.review;
    return n ? `${r.auto} of ${n} past cases alone` : "no past cases";
  };

  const inRules = autoNow.reduce((a, c) => a + c.amount, 0);
  return (
    <>
      <PageHeader
        title="Autopilot"
        subtitle={
          <>
            <span className="font-medium text-ink">{saved.enabled ? "On." : "Off."}</span> {saved.enabled ? "Exhibit sends a response on its own when a brief falls inside these rules." : "Every response waits for you."}
            {sim.total ? ` Over the last 90 days these rules would have handled ${sim.auto} of ${sim.total} cases alone${sim.lostCount ? ` and lost ${sim.lostCount}` : ", with none lost"}.` : ""}
          </>
        }
      />
      <div className="grid items-start gap-4 px-4 pt-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="card border px-5 py-4" aria-label="Autopilot switch">
            <div className="flex items-start gap-4">
              <div className="pt-0.5">
                <Toggle on={s.enabled} onChange={(v) => update({ enabled: v })} label="Autopilot" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold text-ink">Autopilot {s.enabled ? "on" : "off"}</div>
                <p className="mt-1 text-[13px] leading-[20px] text-ink-2">
                  When it&apos;s on and an investigation finishes with a brief inside the rules below, Exhibit sends the response itself: for a new dispute from PayPal&apos;s webhook, a case you run, or a batch. Investigations an outside agent starts through MCP, and briefs prepared at a demo reset, never act on their own.
                </p>
              </div>
            </div>
          </section>

          <section className={clsx("card border transition-opacity", !s.enabled && "opacity-90")} aria-label="Rules">
            <Rule title="File evidence on strong cases" body="Submit the evidence packet when the case is strong and the amount is modest." on={s.fight.enabled} onToggle={(v) => update({ fight: { ...s.fight, enabled: v } })} stat={ruleStat("fight")}>
              <label className="flex items-center gap-2">
                Win likelihood at least
                <input type="range" aria-label="Minimum win likelihood" min={AUTOPILOT_LIMITS.minLikelihood.min} max={AUTOPILOT_LIMITS.minLikelihood.max} value={s.fight.minLikelihood} onChange={(e) => update({ fight: { ...s.fight, minLikelihood: Number(e.target.value) } })} className="w-32 accent-[#0a0a0a]" />
                <span className="num w-9 text-ink">{s.fight.minLikelihood}%</span>
              </label>
              <span className="flex items-center gap-2">
                and up to <Money label="Auto-file limit" value={s.fight.maxAmount} onChange={(v) => update({ fight: { ...s.fight, maxAmount: v } })} />
              </span>
            </Rule>
            <Rule title="Refund when the buyer is right" body="When Exhibit finds the merchant at fault, refund small claims at once instead of paying fees to lose them." on={s.refund.enabled} onToggle={(v) => update({ refund: { ...s.refund, enabled: v } })} stat={ruleStat("refund")}>
              <span className="flex items-center gap-2">
                Up to <Money label="Auto-refund limit" value={s.refund.maxAmount} onChange={(v) => update({ refund: { ...s.refund, maxAmount: v } })} />
              </span>
            </Rule>
            <Rule title="Send fair offers" body="Propose a partial refund, return or replacement in the inquiry stage." on={s.offers.enabled} onToggle={(v) => update({ offers: { ...s.offers, enabled: v } })} stat={ruleStat("offers")}>
              <span className="flex items-center gap-2">
                When the offer is at most <Money label="Offer limit" value={s.offers.maxAmount} onChange={(v) => update({ offers: { ...s.offers, maxAmount: v } })} />
              </span>
            </Rule>
            <Rule title="Message buyers in the inquiry stage" body="Reply in the buyer's language with the facts: often enough to close the case before it escalates." on={s.messages.enabled} onToggle={(v) => update({ messages: { enabled: v } })} stat={ruleStat("messages")} />
          </section>

          <section className="card border px-5 py-4" aria-label="Guardrails">
            <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Lock className="size-3.5 text-muted" /> Guardrails no rule can loosen
            </h2>
            <ul className="list-disc space-y-1.5 pl-4 text-[13px] leading-[20px] text-ink-2 marker:text-ghost">
              <li>Low-confidence briefs always go to you.</li>
              <li>
                Nothing above ${AUTOPILOT_LIMITS.maxAmount.max.toLocaleString("en-US")} is automatic, and evidence is never auto-filed below {AUTOPILOT_LIMITS.minLikelihood.min}%.
              </li>
              <li>A brief can only ask for an action PayPal allows on the dispute when the brief is written. Before filing, Exhibit re-reads the dispute, and PayPal rejects any action it no longer allows.</li>
              <li>Outside AI agents (MCP) can only ask. Their requests never run on Autopilot.</li>
              <li>If a brief&apos;s call and its PayPal action disagree, a person decides.</li>
              <li>Every automatic action is logged with the brief that justified it.</li>
            </ul>
            <Link href="/app/activity" className="mt-3 inline-flex rounded-[4px] text-[13px] font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
              See the audit trail
            </Link>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card border" aria-label="What these rules would have done">
            <div className="px-5 pb-4 pt-4">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[14px] font-semibold text-ink">What these rules would have done</h2>
                <span className="text-[12px] text-muted">{mode === "demo" ? "demo history, last 90 days" : "last 90 days"}</span>
              </div>
              {sim.total ? (
                <p className="mt-1.5 text-[14px] leading-[22px] text-ink-2">
                  Exhibit would have handled <span className="num font-semibold text-ink">{sim.auto} of {sim.total}</span> cases on its own, kept <span className="num font-semibold text-green">{usd(sim.recovered, 0)}</span>, refunded <span className="num font-semibold text-ink">{usd(sim.refunded, 0)}</span> where the buyer was right, and asked you about <span className="num font-semibold text-ink">{sim.review}</span>.
                </p>
              ) : (
                <p className="mt-1.5 text-[13px] text-muted">No resolved history to simulate yet. As PayPal resolves cases, this replays your rules over them.</p>
              )}
            </div>
            {sim.total ? (
              <>
                <div className="grid grid-cols-2 border-y border-line sm:grid-cols-4 sm:divide-x sm:divide-line max-sm:[&>*:nth-child(odd)]:border-r max-sm:[&>*:nth-child(-n+2)]:border-b [&>*]:border-line">
                  {[
                    ["Handled alone", `${sim.auto}`, `${Math.round((sim.auto / sim.total) * 100)}% of cases`],
                    ["Kept", usd(sim.recovered, 0), "on those cases"],
                    ["Asked you", `${sim.review}`, "left for review"],
                    ["Auto-filed, lost", `${sim.lostCount}`, sim.lostCount ? usd(sim.lost, 0) : "none"],
                  ].map(([k, v, h]) => (
                    <div key={k} className="px-5 py-3">
                      <div className="text-[12px] text-muted">{k}</div>
                      <div className={clsx("num mt-1 text-[20px] font-semibold leading-7 tracking-[-0.01em]", k === "Auto-filed, lost" && sim.lostCount ? "text-red" : "text-ink")}>{v}</div>
                      <div className="text-[12px] text-muted">{h}</div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4">
                  <div className="mb-1.5 flex h-2 overflow-hidden rounded-full bg-[#ededeb]" role="img" aria-label={`${sim.auto} handled alone, ${sim.review} for you`}>
                    <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${(sim.auto / sim.total) * 100}%` }} />
                  </div>
                  <div className="mb-4 flex justify-between text-[12px] text-muted">
                    <span className="num">Exhibit alone · {sim.auto}</span>
                    <span className="num">You · {sim.review}</span>
                  </div>
                  <h3 className="mb-1 text-[13px] font-medium text-ink">Past fights by win likelihood and amount</h3>
                  <DecisionMap cases={history} s={s} />
                </div>
              </>
            ) : null}
          </section>

          <section className="card border" aria-label="Your open cases under these rules">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-[14px] font-semibold text-ink">Your open cases under these rules</h2>
              <p className="mt-0.5 text-[13px] leading-[20px] text-muted">
                {autoNow.length} of {preview.length} briefed case{preview.length === 1 ? "" : "s"} ({usd(inRules, 0)}) fall inside them. Saving doesn&apos;t act on a brief already written: Autopilot acts when a case&apos;s next investigation finishes.
              </p>
            </div>
            <ul>
              {preview.map((p) => (
                <li key={p.id} className="border-b border-rule last:border-0">
                  <Link href={`/app/disputes/${p.id}`} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-hover">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 text-[14px]">
                        <span className="font-medium text-ink">{p.buyer}</span>
                        <span className="mono text-[12px] text-muted">{usd(p.amount)}</span>
                        <span className="text-[13px] text-muted">· {DECISION_META[p.brief.decision]?.label ?? p.brief.decision}</span>
                      </div>
                      <div className="mt-0.5 text-[13px] leading-[19px] text-muted">{p.verdict.reason}</div>
                    </div>
                    <span className={clsx("shrink-0 pt-0.5 text-[13px]", p.verdict.verdict === "AUTO" ? "font-medium text-ink" : "text-muted")}>{p.verdict.verdict === "AUTO" ? "Exhibit alone" : "Waits for you"}</span>
                  </Link>
                </li>
              ))}
              {!preview.length ? <li className="px-5 py-6 text-[13px] text-muted">Run Exhibit on a few cases to preview the rules on them.</li> : null}
            </ul>
          </section>
        </div>
      </div>

      {dirty ? (
        <div role="region" aria-label="Unsaved changes" className="toast-in fixed bottom-5 left-1/2 z-[85] flex -translate-x-1/2 items-center gap-3 rounded-[10px] border border-line bg-surface py-2 pl-4 pr-2 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.22)] lg:left-[calc(50%+116px)]">
          <span className="text-[13px] text-ink-2">Unsaved changes{s.enabled !== saved.enabled ? (s.enabled ? " · turns Autopilot on" : " · turns Autopilot off") : ""}</span>
          <Button size="sm" variant="ghost" onClick={() => setS(saved)} disabled={saving}>
            <Undo2 className="size-3.5" /> Discard
          </Button>
          <Button size="sm" variant="primary" onClick={() => save()} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Save rules
          </Button>
        </div>
      ) : null}
    </>
  );
}
