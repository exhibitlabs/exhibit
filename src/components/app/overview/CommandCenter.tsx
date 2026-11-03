"use client";

import { clsx } from "clsx";
import { ArrowRight, Bell, Play } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { FeedItem, Overview, QueueRow, ReasonRow } from "@/lib/overview";
import { relTime, usd } from "@/lib/format";
import { Button, buttonClass } from "../../ui/Button";
import { DECISION_META } from "../../ui/Chip";
import { toast } from "../../ui/Toast";
import { GuideStrip } from "../DemoGuide";
import { NeedsYouGrid } from "./NeedsYouGrid";
import { CardHead, EmptyNote, InfoTip, LegendDot } from "./parts";

const ChartSkeleton = ({ h }: { h: number }) => <div className="skeleton rounded-[6px]" style={{ height: h }} />;
const RecoveryChart = dynamic(() => import("./Charts").then((m) => m.RecoveryChart), { ssr: false, loading: () => <ChartSkeleton h={248} /> });
const RateChart = dynamic(() => import("./Charts").then((m) => m.RateChart), { ssr: false, loading: () => <ChartSkeleton h={140} /> });

const money = (n: number) => usd(Math.round(n), 0);
const span = (h: number) => (h < 48 ? `${h} hour${h === 1 ? "" : "s"}` : `${Math.round(h / 24)} days`);

/** Outcome colours: kept is green, a refund chosen on purpose is a quiet grey, a settled offer a darker grey, a lost fight red. */
const SEG = [
  { key: "won", color: "var(--green)", label: "Won" },
  { key: "settled", color: "#9b9b98", label: "Offer" },
  { key: "refunded", color: "#d9d9d6", label: "Refunded" },
  { key: "lost", color: "var(--red)", label: "Lost" },
] as const;

/** The screen's finding: the open case that most needs the merchant, in one sentence. */
function finding(queue: QueueRow[], h: Overview["headline"]) {
  if (!queue.length) return "No open disputes. When PayPal opens one, Exhibit investigates it on arrival and it lands here.";
  const next = queue.filter((q) => q.next !== "waiting").sort((a, b) => (a.hoursLeft ?? 1e9) - (b.hoursLeft ?? 1e9))[0];
  if (!next) return `Every open case is answered; PayPal has ${h.openCount === 1 ? "it" : "all " + h.openCount} now.`;
  const kind = next.stage === "Chargeback" ? "chargeback" : next.stage === "Inquiry" ? "inquiry" : "claim";
  const due = next.hoursLeft === null ? "has no PayPal deadline" : next.hoursLeft < 0 ? `was due ${span(-next.hoursLeft)} ago` : `is due in ${span(next.hoursLeft)}`;
  const call = next.next === "investigate" ? ", and Exhibit hasn't investigated it yet" : next.decision ? `; Exhibit says ${DECISION_META[next.decision]?.label.toLowerCase() ?? next.decision} at ${next.likelihood}%` : "";
  return `${next.buyer}'s ${money(next.amount)} ${next.reason.toLowerCase()} ${kind} ${due}${call}.`;
}

function Kpi({ label, tip, value, hint, tone, align }: { label: string; tip: React.ReactNode; value: string | null; hint: string; tone?: "red"; align?: "left" | "right" }) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-1.5 text-[13px] text-muted">
        {label}
        <InfoTip align={align}>{tip}</InfoTip>
      </div>
      <div className={clsx("num mt-1.5 text-[24px] font-semibold leading-7 tracking-[-0.02em]", value === null ? "text-ghost" : tone === "red" ? "text-red" : "text-ink")}>{value ?? "–"}</div>
      <div className="mt-1 truncate text-[13px] text-muted">{hint}</div>
    </div>
  );
}

function ReasonBars({ reasons }: { reasons: ReasonRow[] }) {
  const max = Math.max(...reasons.map((r) => r.total), 1);
  const shown = reasons.slice(0, 6);
  return (
    <div className="px-5 pb-5">
      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_48px] items-center gap-3 border-b border-line pb-1.5 text-[12px] text-muted">
        <span>Reason</span>
        <span>Cases</span>
        <span className="text-right">Win rate</span>
      </div>
      <ul>
        {shown.map((r) => (
          <li key={r.reason} className="grid min-h-[44px] grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_48px] items-center gap-3 border-b border-rule py-1.5 last:border-0">
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[14px] text-ink">{r.label}</span>
              <span className="mt-0.5 block truncate text-[13px] text-muted">{[r.fought ? `${r.fought} fought` : null, r.settled ? `${r.settled} offered` : null, r.refunded ? `${r.refunded} refunded` : null].filter(Boolean).join(" · ")}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="flex h-2 gap-px overflow-hidden rounded-[2px]" style={{ width: `${(r.total / max) * 100}%` }}>
                {SEG.map((s) => (r[s.key] ? <span key={s.key} title={`${r[s.key]} ${s.label.toLowerCase()}`} style={{ flex: r[s.key], background: s.color }} /> : null))}
              </span>
              <span className="num shrink-0 text-[13px] text-muted">{r.total}</span>
            </span>
            <span className="num text-right text-[14px] text-ink">{r.winRate !== null ? `${r.winRate}%` : <span className="text-muted">–</span>}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1">
        {SEG.map((s) => (
          <LegendDot key={s.key} color={s.color} label={s.label} />
        ))}
      </div>
    </div>
  );
}

function Feed({ items, now }: { items: FeedItem[]; now: number }) {
  if (!items.length) return <EmptyNote className="mx-5 mb-5" title="Nothing yet" body="Investigations, filings, refunds and webhooks show up here as they happen." />;
  return (
    <ol className="px-5">
      {items.slice(0, 6).map((f) => {
        const tone = f.kind === "outcome-won" ? "bg-green" : f.kind === "outcome-lost" || f.kind === "error" ? "bg-red" : f.kind === "system" ? "bg-ghost" : "bg-ink-2";
        const body = (
          <div className="flex items-start gap-3 py-2">
            <span className={clsx("mt-[7px] size-1.5 shrink-0 rounded-full", tone)} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className={clsx("truncate text-[14px] leading-5", f.kind === "error" ? "text-red" : "text-ink")}>{f.title}</div>
              {f.detail ? <div className="truncate text-[13px] leading-5 text-muted">{f.detail}</div> : null}
            </div>
            <div className="shrink-0 text-right leading-5">
              <div suppressHydrationWarning className="text-[13px] text-muted">
                {relTime(f.at, now)}
              </div>
              {f.amount ? <div className={clsx("num text-[13px]", f.amount > 0 ? "text-green" : "text-muted")}>{f.amount > 0 ? "+" : "−"}{money(Math.abs(f.amount))}</div> : null}
            </div>
          </div>
        );
        return (
          <li key={f.id} className="border-b border-rule last:border-0">
            {f.href ? (
              <Link href={f.href} className="-mx-2 block rounded-[8px] px-2 transition-colors hover:bg-hover">
                {body}
              </Link>
            ) : (
              <div>{body}</div>
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
  const better = cur !== null && start !== null && cur <= start;
  return (
    <div className="px-5 pb-5">
      {cur !== null ? (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="num text-[24px] font-semibold leading-7 tracking-[-0.02em] text-ink">{cur.toFixed(2)}%</div>
              <div className="mt-1 text-[13px] text-muted">
                <span className={cur < line ? "text-green" : "text-red"}>{cur < line ? "Under" : "Over"} the {line}% line</span> · {rate.current.disputes} disputes in {rate.current.orders?.toLocaleString("en-US")} orders
              </div>
            </div>
            {start !== null ? (
              <div className="shrink-0 text-right text-[13px] leading-5">
                <div className={clsx("num font-medium", cur === start ? "text-muted" : better ? "text-green" : "text-red")}>
                  {cur === start ? "0.00" : `${better ? "−" : "+"}${Math.abs(start - cur).toFixed(2)}`} pts
                </div>
                <div className="text-muted">vs 13 weeks ago</div>
              </div>
            ) : null}
          </div>
          <div className="mt-3">
            <RateChart series={rate.series} threshold={line} />
          </div>
        </>
      ) : (
        <>
          <div className="num text-[24px] font-semibold leading-7 text-ink">{rate.current.disputes}</div>
          <div className="mt-1 text-[13px] text-muted">disputes opened in the last 30 days</div>
          <EmptyNote className="mt-3" title="The rate needs your order volume" body="Exhibit divides disputes by orders. Connect your store's order count to chart it against the network lines." />
        </>
      )}
      <ul className="mt-3 border-t border-line pt-2">
        {rate.thresholds.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-1 text-[14px]">
            <span className="num w-10 shrink-0 text-ink">{t.value.toFixed(1)}%</span>
            <span className="min-w-0 truncate text-ink-2">
              {t.network} {t.label}
            </span>
            <span className="ml-auto shrink-0 text-[13px] text-muted">{t.minimum}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CommandCenter({ initial, guideArt }: { initial: Overview; /** Dot art for the demo guide strip, rendered by the page (a server component). */ guideArt?: React.ReactNode }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/overview", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 6000);
    return () => clearInterval(t);
  }, [load]);

  const run = async (key: string, fn: () => Promise<{ title: string; sub?: string } | void>) => {
    setBusy(key);
    try {
      const msg = await fn();
      if (msg) toast(msg);
      window.dispatchEvent(new Event("exhibit:nav"));
      await load();
    } finally {
      setBusy(null);
    }
  };

  const { headline: h, kpis, queue, assumptions: a } = data;
  const now = Date.parse(data.generatedAt);
  const unanalyzed = queue.filter((q) => q.next === "investigate").length;
  const briefed = queue.filter((q) => q.decision).length;
  const totals = data.weekly.reduce((acc, w) => ({ recovered: acc.recovered + w.recovered, refunded: acc.refunded + w.refunded, lost: acc.lost + w.lost }), { recovered: 0, refunded: 0, lost: 0 });
  const hasResolved = totals.recovered + totals.refunded + totals.lost > 0;
  const winHint = kpis.winRate.value !== null ? kpis.winRate.hint.replace(" fought cases", " fought, 90 days") : (kpis.winRate.empty ?? "");

  return (
    <>
      <header className="flex flex-col gap-4 px-4 pt-6 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.025em] text-ink">
            {h.recovered > 0 ? (
              <>
                <span className="num">{money(h.recovered)}</span> recovered.{" "}
              </>
            ) : (
              <>
                <span className="num">{money(h.atRisk)}</span> at stake.{" "}
              </>
            )}
            <span className="text-[#858583]">{h.needsYou ? `${h.needsYou} case${h.needsYou === 1 ? "" : "s"} need${h.needsYou === 1 ? "s" : ""} you.` : "Nothing needs you."}</span>
          </h1>
          <p className="mt-1.5 max-w-[760px] text-[14px] leading-[22px] text-ink-2">{finding(queue, h)}</p>
          <p className="mt-1 text-[12px] text-muted">{data.demoHistory ? "Demo merchant: the 90-day history behind these figures is generated; the open cases run live on the simulator." : data.mode === "sandbox" ? "Live PayPal sandbox disputes, resolved in the last 90 days and open now." : "Resolved in the last 90 days and open now."}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {data.mode === "demo" ? (
            <Button
              className="max-sm:hidden"
              disabled={!!busy}
              onClick={() =>
                run("incoming", async () => {
                  const r = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "incoming" }) }).then((x) => x.json());
                  return { title: "Webhook: CUSTOMER.DISPUTE.CREATED", sub: `${r.dispute_id ?? "New dispute"} · Exhibit is investigating it now` };
                })
              }
            >
              <Bell className="size-3.5" /> Simulate new dispute
            </Button>
          ) : null}
          {unanalyzed ? (
            <Button
              variant="primary"
              disabled={!!busy}
              onClick={() =>
                run("batch", async () => {
                  const r = await fetch("/api/batch", { method: "POST" }).then((x) => x.json());
                  const n = r.queued?.length ?? unanalyzed;
                  return { title: `Exhibit is investigating ${n} case${n === 1 ? "" : "s"}`, sub: "Briefs land in Needs you as each one finishes." };
                })
              }
            >
              <Play className="size-3.5" /> Investigate {unanalyzed} new
            </Button>
          ) : (
            <Link href="/app/disputes" className={buttonClass("primary", "md")}>
              Open disputes <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      </header>

      <div className="space-y-4 px-4 pt-6 sm:px-6">
        <GuideStrip art={guideArt} />

        <section aria-label="Key figures" className="grid grid-cols-2 rounded-[10px] border border-line max-lg:[&>*:nth-child(-n+2)]:border-b max-lg:[&>*:nth-child(odd)]:border-r lg:grid-cols-4 lg:divide-x lg:divide-line [&>*]:border-line">
          <Kpi label="At risk now" value={money(h.atRisk)} hint={`across ${h.openCount} open case${h.openCount === 1 ? "" : "s"}`} tip="The disputed amount on every open case. If you did nothing, this is what PayPal could return to buyers." />
          <Kpi
            label="Expected back"
            value={briefed ? money(h.expected) : null}
            hint={briefed ? `estimated on ${briefed} briefed case${briefed === 1 ? "" : "s"}` : "No case briefed yet"}
            tip="Each briefed case weighted by Exhibit's call: a fight by its win likelihood, an offer by what the merchant keeps, a refund at zero."
          />
          <Kpi label="Win rate when fought" value={kpis.winRate.value !== null ? `${Math.round(kpis.winRate.value)}%` : null} hint={winHint} align="right" tip="Cases Exhibit chose to fight that PayPal decided for you. Refunds and offers are left out on purpose: Exhibit doesn't fight cases it expects to lose." />
          <Kpi
            label="Fees avoided"
            value={kpis.feesAvoided.value || kpis.feesAvoided.hint ? money(kpis.feesAvoided.value) : null}
            hint={kpis.feesAvoided.hint ? kpis.feesAvoided.hint.replace(/ inquiries × \$\d+ claim fee/, " inquiries closed before a claim") : (kpis.feesAvoided.empty ?? "")}
            align="right"
            tip={
              <>
                Inquiries closed before the buyer escalated to a claim, at PayPal&apos;s ${a.disputeFee} Standard Dispute Fee, which PayPal may charge &ldquo;when a buyer files a dispute claim or chargeback&rdquo; (${a.chargebackFee} for card chargebacks). Source: PayPal US merchant fees page, updated 1 Oct 2026.
              </>
            }
          />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="card flex flex-col overflow-hidden border xl:col-span-8">
            <CardHead
              title="Needs you"
              sub={
                queue.length && !h.needsYou ? (
                  "Every open case is answered · waiting on PayPal"
                ) : queue.length ? (
                  <>
                    {h.needsYou} waiting on a decision{h.dueSoon ? <span className="text-red"> · {h.dueSoon} due within 48 hours</span> : null} · closest deadline first
                  </>
                ) : (
                  "No open disputes"
                )
              }
              right={
                <Link href="/app/disputes" className="inline-flex items-center gap-1 rounded-[6px] text-[13px] text-ink-2 transition-colors hover:text-ink">
                  All disputes <ArrowRight className="size-3.5" />
                </Link>
              }
            />
            {queue.length ? (
              <NeedsYouGrid rows={queue.slice(0, 6)} />
            ) : (
              <EmptyNote className="mx-5 mb-5" title="Inbox zero" body="When PayPal opens a dispute, Exhibit investigates it on arrival and it lands here with a recommendation." />
            )}
            {queue.length > 6 ? (
              <Link href="/app/disputes" className="border-t border-line px-5 py-3 text-[13px] text-ink-2 transition-colors hover:bg-hover hover:text-ink">
                View all {queue.length} open cases
              </Link>
            ) : null}
          </div>

          <div className="card flex flex-col border xl:col-span-4">
            <CardHead title="Kept and given back" tipAlign="right" sub="Weekly by close date, last 13 weeks" tip="Above the line: money kept. Below: money returned to buyers, split into refunds Exhibit chose because the merchant was at fault, and fights that were lost." />
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-1">
              <LegendDot color="var(--green)" label="Kept" value={money(totals.recovered)} />
              <LegendDot color="#d9d9d6" label="Refunded" value={money(totals.refunded)} />
              <LegendDot color="var(--red)" label="Lost" value={money(totals.lost)} />
            </div>
            {/* The chart grows with the queue beside it, so the row shares one bottom edge without a blank band. */}
            <div className="relative min-h-[248px] flex-1 px-3 pb-4 pt-2">
              {hasResolved ? (
                <div className="absolute inset-x-3 bottom-4 top-2">
                  <RecoveryChart weekly={data.weekly} height="100%" />
                </div>
              ) : (
                <EmptyNote className="mx-2" title="No resolved cases yet" body="Each case PayPal resolves lands here by week: what you kept, what Exhibit refunded on purpose, and what was lost." />
              )}
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="card border">
            <CardHead title="Outcomes by reason" sub="Resolved in the last 90 days" tip="Resolved cases by PayPal dispute reason. Win rate counts only the cases Exhibit chose to fight." />
            {data.reasons.length ? <ReasonBars reasons={data.reasons} /> : <EmptyNote className="mx-5 mb-5" title="No resolved cases yet" body="Win rates by dispute reason appear once PayPal resolves a case." />}
          </div>

          <div className="card border">
            <CardHead
              title="Dispute rate"
              sub="Rolling 30 days, against the card networks' lines"
              tip={
                <>
                  PayPal doesn&apos;t publish a merchant dispute-rate threshold, so these are card-network lines. Visa VAMP: (fraud + disputes) ÷ settled card-not-present transactions, excessive at 1.5% in the US since 1 April 2026. Mastercard: chargebacks ÷ last month&apos;s transactions. Exhibit counts every PayPal dispute and chargeback ÷ orders, which is stricter than the card-only ratios.
                </>
              }
            />
            <RateHealth rate={data.rate} />
          </div>

          <div className="card flex flex-col border md:col-span-2 xl:col-span-1">
            <CardHead title="Agent activity" sub="Filings, refunds and PayPal rulings" right={<Link href="/app/activity" className="inline-flex items-center gap-1 rounded-[6px] text-[13px] text-ink-2 transition-colors hover:text-ink">Audit trail <ArrowRight className="size-3.5" /></Link>} />
            <div className="pb-3">
              <Feed items={data.feed} now={now} />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
