"use client";

import { clsx } from "clsx";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Bot, CircleCheck, CircleX, Database, FileCheck2, Gavel, Play, RotateCcw, ShieldCheck, TriangleAlert, Webhook } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FeedItem, Overview, ReasonRow } from "@/lib/overview";
import { relTime, usd } from "@/lib/format";
import { Button } from "../../ui/Button";
import { NeedsYouGrid } from "./NeedsYouGrid";
import { CardHead, CountUp, EmptyNote, InfoTip, LegendDot, Sparkline } from "./parts";

const ChartSkeleton = ({ h }: { h: number }) => <div className="shimmer rounded-md" style={{ height: h, opacity: 0.5 }} />;
const RecoveryChart = dynamic(() => import("./Charts").then((m) => m.RecoveryChart), { ssr: false, loading: () => <ChartSkeleton h={300} /> });
const RateChart = dynamic(() => import("./Charts").then((m) => m.RateChart), { ssr: false, loading: () => <ChartSkeleton h={128} /> });

const money = (n: number) => usd(Math.round(n), 0);
const stagger = (i: number) => ({ animationDelay: `${i * 60}ms` });
const span = (h: number) => (h < 48 ? `${h} hour${h === 1 ? "" : "s"}` : `${Math.round(h / 24)} days`);

function Kpi({ i, label, tip, value, format, hint, series, tone, empty }: { i: number; label: string; tip: React.ReactNode; value: number | null; format: (n: number) => string; hint: string; series: number[]; tone?: "ink" | "green" | "red"; empty?: string }) {
  const blank = value === null || (value === 0 && !hint);
  return (
    <div className="card rise flex flex-col px-4 pb-3 pt-3.5" style={stagger(i)}>
      <div className="flex items-center gap-1.5 text-[12px] text-muted">
        {label}
        <InfoTip align={i > 2 ? "right" : "left"}>{tip}</InfoTip>
      </div>
      <div className={clsx("mt-2 text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums", blank ? "text-faint" : "text-ink")}>{value === null ? "—" : <CountUp value={value} format={format} />}</div>
      <div className="mt-1.5 h-4 truncate text-[12px] text-faint">{blank ? empty : hint}</div>
      <Sparkline data={series} tone={tone} className="mt-2.5" delay={150 + i * 80} />
    </div>
  );
}

function ReasonBars({ reasons }: { reasons: ReasonRow[] }) {
  const max = Math.max(...reasons.map((r) => r.total), 1);
  const seg = [
    { key: "won", color: "var(--green)", label: "won" },
    { key: "settled", color: "#a3a3a3", label: "settled with an offer" },
    { key: "refunded", color: "#dcdcdc", label: "refunded honestly" },
    { key: "lost", color: "var(--red)", label: "lost" },
  ] as const;
  return (
    <div className="flex flex-1 flex-col px-5 pb-4">
      <div className="mb-2 grid grid-cols-[128px_minmax(0,1fr)_64px] items-center gap-3 text-[10.5px] uppercase tracking-[0.06em] text-faint">
        <span>Reason</span>
        <span>Cases</span>
        <span className="text-right">Win rate</span>
      </div>
      <div className="space-y-2">
        {reasons.slice(0, 6).map((r, ri) => (
          <div key={r.reason} className="grid grid-cols-[128px_minmax(0,1fr)_64px] items-center gap-3">
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[12.5px] text-ink-2">{r.label}</span>
              <span className="mt-0.5 block truncate text-[11px] text-faint">{[r.fought ? `${r.fought} fought` : null, r.settled ? `${r.settled} offered` : null, r.refunded ? `${r.refunded} refunded` : null].filter(Boolean).join(" · ")}</span>
            </span>
            <div className="flex items-center gap-2">
              <div className="bar-grow flex h-[9px] gap-px overflow-hidden rounded-[3px]" style={{ width: `${(r.total / max) * 100}%`, animationDelay: `${200 + ri * 70}ms` }}>
                {seg.map((s) => (r[s.key] ? <span key={s.key} title={`${r[s.key]} ${s.label}`} style={{ flex: r[s.key], background: s.color }} /> : null))}
              </div>
              <span className="num text-[11px] text-faint">{r.total}</span>
            </div>
            <span className="text-right">
              {r.winRate !== null ? (
                <span className={clsx("num text-[12.5px]", r.winRate >= 70 ? "text-ink" : "text-ink-2")}>{r.winRate}%</span>
              ) : (
                <span className="text-[11.5px] text-muted">{r.refunded ? "refunds" : "offers"}</span>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex flex-wrap gap-x-3.5 gap-y-1 pt-4">
        <LegendDot color="var(--green)" label="Won" />
        <LegendDot color="#a3a3a3" label="Offer" />
        <LegendDot color="#dcdcdc" label="Refunded" />
        <LegendDot color="var(--red)" label="Lost" />
      </div>
    </div>
  );
}

const FEED_ICON: Record<FeedItem["kind"], { icon: typeof Bot; cls: string }> = {
  agent: { icon: Bot, cls: "text-ink-2" },
  action: { icon: FileCheck2, cls: "text-ink-2" },
  prevention: { icon: ShieldCheck, cls: "text-ink-2" },
  webhook: { icon: Webhook, cls: "text-ink-2" },
  ruling: { icon: Gavel, cls: "text-ink-2" },
  system: { icon: Database, cls: "text-faint" },
  error: { icon: TriangleAlert, cls: "text-red" },
  "outcome-won": { icon: CircleCheck, cls: "text-green" },
  "outcome-refund": { icon: RotateCcw, cls: "text-muted" },
  "outcome-lost": { icon: CircleX, cls: "text-red" },
};

function Feed({ items, now }: { items: FeedItem[]; now: number }) {
  if (!items.length) return <EmptyNote className="mx-5 mb-5 h-[220px]" title="Nothing yet" body="Investigations, filings, refunds and webhooks show up here as they happen." />;
  return (
    <ol className="relative px-5 pb-3">
      <span className="absolute bottom-6 left-[31px] top-3 w-px bg-line" aria-hidden />
      {items.map((f, i) => {
        const meta = FEED_ICON[f.kind];
        const body = (
          <div className="flex items-start gap-3 py-[7px]">
            <span className="relative z-10 mt-px grid size-[22px] shrink-0 place-items-center rounded-full border border-line bg-surface">
              <meta.icon className={clsx("size-3", meta.cls)} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] leading-snug text-ink">{f.title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 truncate text-[11.5px] text-faint">
                {f.detail ? <span className="truncate">{f.detail}</span> : null}
              </div>
            </div>
            <div className="shrink-0 pt-px text-right leading-snug">
              <div className="text-[11px] text-faint">{relTime(f.at, now)}</div>
              {f.amount ? <div className={clsx("num text-[11.5px]", f.amount > 0 ? "text-green" : "text-muted")}>{f.amount > 0 ? "+" : "−"}{money(Math.abs(f.amount))}</div> : null}
            </div>
          </div>
        );
        return (
          <li key={f.id} className="rise" style={{ animationDelay: `${300 + i * 45}ms` }}>
            {f.href ? (
              <Link href={f.href} className="-mx-2 block rounded-md px-2 transition-colors hover:bg-[#fafafa]">
                {body}
              </Link>
            ) : (
              <div className="-mx-2 px-2">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function RateHealth({ rate }: { rate: Overview["rate"] }) {
  const line = rate.thresholds[0].value;
  const cur = rate.current.rate;
  const start = rate.start.rate;
  const down = cur !== null && start !== null && cur <= start;
  return (
    <div className="flex flex-1 flex-col px-5 pb-4">
      {cur !== null ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <span className="text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
                  <CountUp value={cur} format={(n) => `${n.toFixed(2)}%`} />
                </span>
                <span className={clsx("inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[12px] font-medium", cur < line ? "bg-green-soft text-green" : "bg-red-soft text-red")}>
                  <span className="size-1.5 rounded-full bg-current" />
                  {cur < line ? "Healthy" : "Over the line"}
                </span>
              </div>
              <div className="mt-1.5 whitespace-nowrap text-[12px] tabular-nums text-muted">
                {rate.current.disputes} disputes · {rate.current.orders?.toLocaleString("en-US")} orders · 30 days
              </div>
            </div>
            {start !== null ? (
              <div className="shrink-0 pt-0.5 text-right">
                <div className={clsx("inline-flex items-center gap-0.5 text-[12.5px] font-medium tabular-nums", down ? "text-green" : "text-red")}>
                  {down ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                  {Math.abs(start - cur).toFixed(2)} pts
                </div>
                <div className="mt-1 whitespace-nowrap text-[11.5px] text-faint">vs. 13 weeks ago</div>
              </div>
            ) : null}
          </div>
          <div className="mt-3">
            <RateChart series={rate.series} threshold={line} />
          </div>
        </>
      ) : (
        <>
          <div className="text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-ink">{rate.current.disputes}</div>
          <div className="mt-1.5 text-[12px] text-muted">disputes opened in the last 30 days</div>
          <EmptyNote className="mt-3 h-[112px]" title="Rate needs your order volume" body="Exhibit divides disputes by orders. Connect your store's order count to chart it against the network lines." />
        </>
      )}
      <div className="mt-3 space-y-1.5 border-t border-line pt-3">
        {rate.thresholds.map((t) => (
          <div key={t.id} className="flex items-center gap-2.5 text-[12px]">
            <span className="w-8 shrink-0 font-medium tabular-nums text-ink">{t.value.toFixed(1)}%</span>
            <span className="truncate text-ink-2">
              {t.network} <span className="text-muted">{t.label}</span>
            </span>
            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-faint">{t.minimum}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CommandCenter({ initial }: { initial: Overview }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/overview", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    const t = setInterval(() => void load(), 6000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const run = async (key: string, fn: () => Promise<string | void>) => {
    setBusy(key);
    try {
      const msg = await fn();
      if (msg) setToast(msg);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const { headline: h, kpis, queue, assumptions: a } = data;
  const now = Date.parse(data.generatedAt);
  const unanalyzed = queue.filter((q) => q.next === "investigate").length;
  const nextDue = queue.find((q) => q.hoursLeft !== null);
  const totals = data.weekly.reduce((acc, w) => ({ recovered: acc.recovered + w.recovered, refunded: acc.refunded + w.refunded, lost: acc.lost + w.lost }), { recovered: 0, refunded: 0, lost: 0 });
  const hasResolved = totals.recovered + totals.refunded + totals.lost > 0;
  const closed = kpis.recovered.hint.match(/(\d+) closed/)?.[1];
  const today = new Date(now).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <header className="flex items-end justify-between gap-6 border-b border-line px-8 pb-5 pt-6">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-[12px] text-muted">
            <span>Command center</span>
            <span className="text-line-strong">/</span>
            <span suppressHydrationWarning>{today}</span>
            {data.demoHistory ? (
              <span className="ml-1 inline-flex h-5 items-center gap-1.5 rounded-full border border-line bg-surface px-2 text-[11px] text-ink-2">
                <span className="size-1.5 rounded-full bg-amber" />
                Demo merchant · 90-day history
              </span>
            ) : data.mode === "sandbox" ? (
              <span className="ml-1 inline-flex h-5 items-center gap-1.5 rounded-full border border-line bg-surface px-2 text-[11px] text-ink-2">
                <span className="size-1.5 rounded-full bg-green" />
                Live PayPal sandbox data
              </span>
            ) : null}
          </div>
          <h1 className="display text-[30px] leading-[1.1]">
            {h.recovered > 0 ? (
              <>
                <span className="tabular-nums">
                  <CountUp value={h.recovered} format={money} />
                </span>{" "}
                recovered.{" "}
              </>
            ) : (
              <>
                <span className="tabular-nums">
                  <CountUp value={h.atRisk} format={money} />
                </span>{" "}
                at risk.{" "}
              </>
            )}
            <span className="text-faint">{h.needsYou ? `${h.needsYou} case${h.needsYou === 1 ? "" : "s"} need${h.needsYou === 1 ? "s" : ""} you.` : "Nothing needs you."}</span>
          </h1>
          <p className="mt-2 max-w-[760px] text-[13.5px] text-muted">
            {h.recovered > 0 && closed ? `Exhibit closed ${closed} dispute${closed === "1" ? "" : "s"} in the last 90 days${kpis.winRate.value !== null ? ` and won ${kpis.winRate.value}% of the ones it chose to fight` : ""}. ` : ""}
            {h.openCount ? `${money(h.atRisk)} is open across ${h.openCount} case${h.openCount === 1 ? "" : "s"}` : "No open disputes"}
            {nextDue?.hoursLeft != null ? (nextDue.hoursLeft < 0 ? `; a PayPal response deadline passed ${span(-nextDue.hoursLeft)} ago.` : `; the next PayPal deadline is in ${span(nextDue.hoursLeft)}.`) : "."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {data.mode === "demo" ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={!!busy}
              onClick={() =>
                run("incoming", async () => {
                  const r = await fetch("/api/demo", { method: "POST", body: JSON.stringify({ op: "incoming" }) }).then((x) => x.json());
                  return `Webhook: CUSTOMER.DISPUTE.CREATED ${r.dispute_id ?? ""} · Exhibit is on it`;
                })
              }
            >
              <Bell className="size-3.5" /> Simulate new dispute
            </Button>
          ) : null}
          {unanalyzed ? (
            <Button
              variant="primary"
              size="sm"
              disabled={!!busy}
              onClick={() =>
                run("batch", async () => {
                  const r = await fetch("/api/batch", { method: "POST" }).then((x) => x.json());
                  return `Exhibit is investigating ${r.queued?.length ?? unanalyzed} case(s)`;
                })
              }
            >
              <Play className="size-3.5" /> Investigate {unanalyzed} new
            </Button>
          ) : (
            <Link href="/app/disputes" className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-ink px-2.5 text-[12.5px] font-medium text-white transition-colors hover:bg-[#262626]">
              Open disputes <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </header>

      <div className="space-y-4 px-8 py-6">
        <section className="grid grid-cols-5 gap-4">
          <Kpi
            i={0}
            label="Recovered · 90 days"
            value={kpis.recovered.value}
            format={money}
            hint={kpis.recovered.hint}
            empty={kpis.recovered.empty}
            series={kpis.recovered.series}
            tone="green"
            tip="Money kept on cases resolved in the last 90 days: fights won, cases the buyer closed after Exhibit replied, and the part kept when a buyer accepted a partial refund."
          />
          <Kpi
            i={1}
            label="At risk now"
            value={kpis.atRisk.value}
            format={money}
            hint={kpis.atRisk.hint}
            series={kpis.atRisk.series}
            tip="Disputed amount on open cases. Expected back weighs each case by Exhibit's call and win likelihood. The sparkline is open exposure at the end of each week."
          />
          <Kpi
            i={2}
            label="Win rate · fought"
            value={kpis.winRate.value}
            format={(n) => `${Math.round(n)}%`}
            hint={kpis.winRate.hint}
            empty={kpis.winRate.empty}
            series={kpis.winRate.series}
            tip="Cases Exhibit chose to fight that PayPal decided for you. Refunds and offers are left out on purpose: Exhibit doesn't fight cases it expects to lose."
          />
          <Kpi
            i={3}
            label="Fees avoided"
            value={kpis.feesAvoided.value}
            format={money}
            hint={kpis.feesAvoided.hint}
            empty={kpis.feesAvoided.empty}
            series={kpis.feesAvoided.series}
            tip={
              <>
                Inquiries closed before the buyer escalated to a claim, at PayPal&apos;s ${a.disputeFee} Standard Dispute Fee, which PayPal may charge &ldquo;when a buyer files a dispute claim or chargeback&rdquo; (${a.chargebackFee} for card chargebacks). Source: PayPal US merchant fees page, updated 1 Oct 2026.
              </>
            }
          />
          <Kpi
            i={4}
            label="Merchant hours saved"
            value={kpis.hoursSaved.value}
            format={(n) => `${Math.round(n)}h`}
            hint={kpis.hoursSaved.hint}
            empty={kpis.hoursSaved.empty}
            series={kpis.hoursSaved.series}
            tip={`Assumes ${a.minutesPerCase} minutes of manual work per case: pulling the order, tracking, buyer messages and policies, then writing and filing the response. Counts resolved cases plus open cases Exhibit has briefed.`}
          />
        </section>

        <section className="grid grid-cols-12 gap-4">
          <div className="card rise col-span-7 flex flex-col overflow-hidden" style={stagger(5)}>
            <CardHead
              title="Needs you"
              sub={
                queue.length && !h.needsYou ? (
                  "Every open case is answered · waiting on PayPal"
                ) : queue.length ? (
                  <>
                    {h.needsYou} waiting on a decision{h.dueSoon ? <span className="text-red"> · {h.dueSoon} due within 48h</span> : null} · closest deadline first
                  </>
                ) : (
                  "No open disputes"
                )
              }
              right={
                <Link href="/app/disputes" className="inline-flex items-center gap-1 text-[12.5px] text-muted transition-colors hover:text-ink">
                  All disputes <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            {queue.length ? (
              <div className="border-t border-line">
                <NeedsYouGrid rows={queue.slice(0, 6)} />
              </div>
            ) : (
              <EmptyNote className="mx-5 mb-5 h-[240px]" title="Inbox zero" body="When PayPal opens a dispute, Exhibit investigates it on arrival and it lands here with a recommendation." />
            )}
            {queue.length > 6 ? (
              <Link href="/app/disputes" className="mt-auto border-t border-line px-5 py-2.5 text-[12.5px] text-muted transition-colors hover:bg-[#fafafa] hover:text-ink">
                +{queue.length - 6} more open case{queue.length - 6 === 1 ? "" : "s"}
              </Link>
            ) : null}
          </div>

          <div className="card rise col-span-5 flex flex-col" style={stagger(6)}>
            <CardHead
              title="Recovered vs. given back"
              tipAlign="right"
              sub="Weekly, by close date · last 13 weeks"
              tip="Above the line: money kept. Below: money returned to buyers, split into honest refunds (Exhibit's call when the merchant was at fault) and fights that were lost."
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-2">
              <LegendDot color="var(--green)" label="Recovered" value={money(totals.recovered)} />
              <LegendDot color="#d4d4d4" label="Refunded honestly" value={money(totals.refunded)} />
              <LegendDot color="var(--red)" label="Lost" value={money(totals.lost)} />
            </div>
            <div className="relative min-h-[236px] flex-1 px-3 pb-3">{hasResolved ? <div className="absolute inset-x-3 bottom-3 top-1"><RecoveryChart weekly={data.weekly} /></div> : <EmptyNote className="mx-2 h-[236px]" title="No resolved cases yet" body="Each case PayPal resolves lands here by week: what you kept, what Exhibit refunded on purpose, and what was lost." />}</div>
          </div>
        </section>

        <section className="grid grid-cols-12 gap-4">
          <div className="card rise col-span-4 flex flex-col" style={stagger(7)}>
            <CardHead
              title="Outcomes by reason"
              sub="Fights it picks, it wins. Where you were at fault, it refunds."
              tip="Resolved cases in the last 90 days by PayPal dispute reason. Win rate counts only the cases Exhibit chose to fight."
            />
            {data.reasons.length ? <ReasonBars reasons={data.reasons} /> : <EmptyNote className="mx-5 mb-5 h-[200px]" title="No resolved cases yet" body="Win rates by dispute reason appear once PayPal resolves a case." />}
          </div>

          <div className="card rise col-span-4 flex flex-col" style={stagger(8)}>
            <CardHead
              title="Dispute-rate health"
              sub="Rolling 30 days vs. card-network monitoring lines"
              tip={
                <>
                  PayPal doesn&apos;t publish a merchant dispute-rate threshold, so these are card-network lines. Visa VAMP: (fraud + disputes) ÷ settled card-not-present transactions, excessive at 1.5% in the US since 1 April 2026. Mastercard: chargebacks ÷ last month&apos;s transactions. Exhibit counts every PayPal dispute and chargeback ÷ orders, which is stricter than the card-only ratios. Sources: Visa VAMP fact sheet (2025 v2); Mastercard Excessive Chargeback Program summary. See docs/sources/dispute-thresholds.md.
                </>
              }
            />
            <RateHealth rate={data.rate} />
          </div>

          <div className="card rise col-span-4 flex flex-col" style={stagger(9)}>
            <CardHead
              title="Agent activity"
              sub="Investigations, filings, refunds and PayPal rulings"
              right={
                <span className="inline-flex items-center gap-1.5 text-[11.5px] text-muted">
                  <span className="pulse-dot size-1.5 rounded-full bg-green" /> Live
                </span>
              }
            />
            <Feed items={data.feed} now={now} />
            <Link href="/app/activity" className="mt-auto border-t border-line px-5 py-2.5 text-[12.5px] text-muted transition-colors hover:bg-[#fafafa] hover:text-ink">
              Full audit trail
            </Link>
          </div>
        </section>
      </div>

      {toast ? <div className="rise fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 text-[13px] text-white shadow-lg">{toast}</div> : null}
    </>
  );
}
