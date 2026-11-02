"use client";

import { clsx } from "clsx";
import { Bot, Check, Gauge, Loader2, Lock, ScrollText, ShieldCheck, Undo2, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { CaseBrief } from "@/lib/agent/brief";
import { AUTOPILOT_LIMITS, evaluateAutopilot, simulateAutopilot, type AutopilotSettings, type SimCase } from "@/lib/autopilot-rules";
import { usd } from "@/lib/format";
import { REASON_LABEL, type DisputeReason } from "@/lib/paypal/types";
import { Button } from "../ui/Button";
import { Chip, DecisionChip } from "../ui/Chip";
import { toast } from "../ui/Toast";
import { PageHeader } from "./PageHeader";

type Case = { id: string; buyer: string; reason: string; amount: number; brief: CaseBrief };

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={clsx("relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors", on ? "bg-ink" : "bg-line-strong")}>
      <span className={clsx("absolute top-[3px] size-4 rounded-full bg-white shadow transition-all", on ? "left-[19px]" : "left-[3px]")} />
    </button>
  );
}

function Money({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <span className="inline-flex h-8 items-center rounded-md border border-line-strong bg-surface px-2 text-[13px] focus-within:border-ink-2">
      <span className="text-muted">$</span>
      <input type="number" aria-label={label} min={AUTOPILOT_LIMITS.maxAmount.min} max={AUTOPILOT_LIMITS.maxAmount.max} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} className="num w-16 bg-transparent text-right outline-none" />
    </span>
  );
}

function Rule({ title, body, on, onToggle, stat, children }: { title: string; body: string; on: boolean; onToggle: (v: boolean) => void; stat?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-b border-line px-5 py-4 last:border-0">
      <Toggle on={on} onChange={onToggle} label={title} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <div className="text-[14px] font-medium">{title}</div>
          {stat ? <div className="text-[12px] text-muted">{stat}</div> : null}
        </div>
        <div className="mt-0.5 text-[12.5px] text-muted">{body}</div>
        {children ? <div className={clsx("mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px] text-ink-2", !on && "pointer-events-none opacity-40")}>{children}</div> : null}
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
            <line x1={PAD.l} x2={W - PAD.r} y1={y(a)} y2={y(a)} stroke="#f2f2f2" />
            <text x={PAD.l - 8} y={y(a) + 3.5} textAnchor="end" className="fill-[#a1a1a1] text-[10px]">
              ${a}
            </text>
          </g>
        ))}
        {[40, 60, 80, 100].map((l) => (
          <text key={l} x={x(l)} y={H - 10} textAnchor="middle" className="fill-[#a1a1a1] text-[10px]">
            {l}%
          </text>
        ))}
        {zoneOn ? (
          <g>
            <rect x={x(minL)} y={y(Math.min(s.fight.maxAmount, maxY))} width={x(100) - x(minL)} height={y(0) - y(Math.min(s.fight.maxAmount, maxY))} fill="rgb(21 128 61 / 0.07)" stroke="rgb(21 128 61 / 0.35)" strokeDasharray="4 3" rx="4" className="transition-all duration-300" />
          </g>
        ) : null}
        <line x1={x(AUTOPILOT_LIMITS.minLikelihood.min)} x2={x(AUTOPILOT_LIMITS.minLikelihood.min)} y1={PAD.t} y2={H - PAD.b} stroke="#d4d4d4" strokeDasharray="2 3" />
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
        <div className="pv-fade pointer-events-none absolute right-2 top-2 w-56 rounded-lg bg-ink px-3 py-2 text-[11.5px] leading-snug text-white shadow-lg">
          <div className="font-medium">
            {hover.id} · {usd(hover.amount, 0)}
          </div>
          <div className="text-white/70">
            {REASON_LABEL[hover.reason as DisputeReason] ?? hover.reason} · {hover.likelihood}% · {hover.confidence.toLowerCase()} confidence
          </div>
          <div className={hover.recovered > 0 ? "text-[#86efac]" : "text-[#fca5a5]"}>{hover.recovered > 0 ? "PayPal ruled for the merchant" : "PayPal ruled for the buyer"}</div>
        </div>
      ) : null}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-green" /> won
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-red" /> lost
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full border-[1.5px] border-ink-2" /> low confidence: always yours
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-3.5 rounded-[3px] border border-dashed border-green/50 bg-green/10" /> auto-file zone
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-px w-3 border-t border-dashed border-line-strong" /> {AUTOPILOT_LIMITS.minLikelihood.min}% floor
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
      toast({ title: stored.enabled ? "Autopilot is on" : "Rules saved", sub: stored.enabled ? "New disputes inside these limits are answered on arrival. Everything else waits for you." : "Autopilot stays off until you switch it on.", tone: "success" });
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

  return (
    <>
      <PageHeader
        eyebrow="Autopilot · rules, not vibes"
        title="Autopilot"
        subtitle="Decide which responses Exhibit may send on its own. It never acts outside these limits, and the simulation shows what it would have done before you switch it on."
        actions={
          <span className={clsx("inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-[12.5px] font-medium", saved.enabled ? "border-green/30 bg-green-soft text-green" : "border-line bg-surface text-ink-2")}>
            <span className={clsx("size-1.5 rounded-full", saved.enabled ? "bg-green" : "bg-faint")} />
            {saved.enabled ? "On · acting within your rules" : "Off · everything waits for you"}
          </span>
        }
      />
      <div className="grid items-start gap-6 px-4 py-6 sm:px-6 lg:px-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="card flex items-center gap-4 px-5 py-4">
            <Toggle on={s.enabled} onChange={(v) => update({ enabled: v })} label="Autopilot" />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-medium">Autopilot {s.enabled ? "on" : "off"}</div>
              <div className="text-[12.5px] text-muted">When on, Exhibit answers new disputes the moment PayPal&apos;s webhook arrives, within the limits below.</div>
            </div>
          </div>

          <div className={clsx("card transition-opacity", !s.enabled && "opacity-80")}>
            <Rule title="File evidence on strong cases" body="Submit the evidence packet when the case is strong and the amount is modest." on={s.fight.enabled} onToggle={(v) => update({ fight: { ...s.fight, enabled: v } })} stat={ruleStat("fight")}>
              <span className="flex items-center gap-2">
                Win likelihood at least
                <input type="range" aria-label="Minimum win likelihood" min={AUTOPILOT_LIMITS.minLikelihood.min} max={AUTOPILOT_LIMITS.minLikelihood.max} value={s.fight.minLikelihood} onChange={(e) => update({ fight: { ...s.fight, minLikelihood: Number(e.target.value) } })} className="w-32 accent-[#0a0a0a]" />
                <span className="num w-9 text-ink">{s.fight.minLikelihood}%</span>
              </span>
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
          </div>

          <div className="card px-5 py-4">
            <div className="mb-3 flex items-center gap-2 text-[13.5px] font-medium">
              <Lock className="size-3.5" /> Guardrails no rule can loosen
            </div>
            <ul className="grid gap-2.5 text-[12.5px] leading-snug text-ink-2 sm:grid-cols-2">
              {[
                [Gauge, "Low-confidence briefs always go to you."],
                [ShieldCheck, `Nothing above $${AUTOPILOT_LIMITS.maxAmount.max.toLocaleString("en-US")} is automatic, and evidence is never auto-filed below ${AUTOPILOT_LIMITS.minLikelihood.min}%.`],
                [ScrollText, "Only actions PayPal allows on the dispute right now, checked again when filing."],
                [Bot, "Outside AI agents (MCP) can only ask. Their requests never run on autopilot."],
                [UserRound, "If a brief's call and its PayPal action disagree, a person decides."],
                [Check, "Every automatic action is logged with the brief that justified it."],
              ].map(([Icon, text], i) => {
                const I = Icon as typeof Lock;
                return (
                  <li key={i} className="flex gap-2.5">
                    <I className="mt-0.5 size-3.5 shrink-0 text-muted" />
                    <span>{text as string}</span>
                  </li>
                );
              })}
            </ul>
            <Link href="/app/activity" className="mt-3 inline-block text-[12px] text-muted underline decoration-line-strong underline-offset-2 hover:text-ink">
              See the audit trail
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <section className="card">
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[14px] font-medium">What these rules would have done</h2>
                <span className="text-[11.5px] text-faint">{mode === "demo" ? "demo merchant · last 90 days" : "last 90 days"}</span>
              </div>
              {sim.total ? (
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">
                  Exhibit would have handled <span className="font-semibold text-ink">{sim.auto} of {sim.total}</span> cases on its own, recovered <span className="font-semibold text-green">{usd(sim.recovered, 0)}</span>, refunded <span className="font-semibold text-ink">{usd(sim.refunded, 0)}</span> where the buyer was right, and asked you about <span className="font-semibold text-ink">{sim.review}</span>.
                </p>
              ) : (
                <p className="mt-1.5 text-[13px] text-muted">No resolved history to simulate yet. As PayPal resolves cases, this replays your rules over them.</p>
              )}
            </div>
            {sim.total ? (
              <>
                <div className="grid grid-cols-2 divide-line border-b border-line sm:grid-cols-4 sm:divide-x">
                  {[
                    ["Handled alone", `${sim.auto}`, `${Math.round((sim.auto / sim.total) * 100)}% of cases`],
                    ["Recovered", usd(sim.recovered, 0), "on those cases"],
                    ["Asked you", `${sim.review}`, "cases left for review"],
                    ["Auto-filed, lost", `${sim.lostCount}`, sim.lostCount ? usd(sim.lost, 0) : "none"],
                  ].map(([k, v, h]) => (
                    <div key={k} className="px-5 py-3">
                      <div className="text-[11.5px] text-muted">{k}</div>
                      <div className={clsx("mt-1 text-[20px] font-semibold leading-none tracking-[-0.02em] tabular-nums", k === "Auto-filed, lost" && sim.lostCount ? "text-red" : "text-ink")}>{v}</div>
                      <div className="mt-1 text-[11px] text-faint">{h}</div>
                    </div>
                  ))}
                </div>
                <div className="px-5 py-4">
                  <div className="mb-2 flex h-2.5 overflow-hidden rounded-full bg-sunken" aria-label={`${sim.auto} handled alone, ${sim.review} for you`}>
                    <div className="h-full bg-ink transition-[width] duration-500" style={{ width: `${(sim.auto / sim.total) * 100}%` }} />
                  </div>
                  <div className="mb-4 flex justify-between text-[11.5px] text-muted">
                    <span>Exhibit alone · {sim.auto}</span>
                    <span>You · {sim.review}</span>
                  </div>
                  <div className="mb-1.5 text-[12px] font-medium text-ink-2">Past fights: win likelihood vs amount</div>
                  <DecisionMap cases={history} s={s} />
                </div>
              </>
            ) : null}
          </section>

          <section className="card">
            <div className="border-b border-line px-5 py-3.5">
              <div className="text-[13.5px] font-medium">On your open cases now</div>
              <div className="mt-0.5 text-[12.5px] text-muted">
                Switched on, Exhibit would answer {autoNow.length} of {preview.length} briefed cases ({usd(autoNow.reduce((a, c) => a + c.amount, 0), 0)}).{s.enabled ? "" : " Autopilot is off, so nothing runs."}
              </div>
            </div>
            <ul className="divide-y divide-line">
              {preview.map((p) => (
                <li key={p.id}>
                  <Link href={`/app/disputes/${p.id}`} className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-[#fafafa]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[13px]">
                        <span className="font-medium">{p.buyer}</span>
                        <span className="num text-[12px] text-muted">{usd(p.amount)}</span>
                      </div>
                      <div className="mt-0.5 text-[12px] leading-snug text-muted">{p.verdict.reason}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <DecisionChip decision={p.brief.decision} />
                      {p.verdict.verdict === "AUTO" ? <Chip tone="green">alone</Chip> : <Chip>you</Chip>}
                    </div>
                  </Link>
                </li>
              ))}
              {!preview.length ? <li className="px-5 py-6 text-[13px] text-muted">Run Exhibit on a few cases to preview the rules on them.</li> : null}
            </ul>
          </section>
        </div>
      </div>

      {dirty ? (
        <div className="toast-in fixed bottom-5 left-1/2 z-[85] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-line bg-surface py-2 pl-4 pr-2 shadow-[0_16px_40px_-12px_rgb(0_0_0/0.25)] lg:left-[calc(50%+116px)]">
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
