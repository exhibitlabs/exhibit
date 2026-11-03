"use client";

import { clsx } from "clsx";
import { Check, Loader2, Sparkles, UploadCloud, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PreventionAction, PreventionFixResult, PreventionOrder, PreventionReport, PreventionSignalKind } from "@/lib/prevention";
import { PreventionDrawer } from "./PreventionDrawer";
import { PreventionGrid } from "./PreventionGrid";
import { BAND, bandOf, money, ScoreRing, SIGNAL_SHORT, useTicker } from "./PreventionParts";
import { PreventionRadar } from "./PreventionRadar";
import { Button } from "../ui/Button";
import { toast } from "../ui/Toast";
import { PageHeader } from "./PageHeader";

type FixOutcome = { ok: boolean; prevented: boolean; saved: number; paypal: boolean; error?: string };

function Ticker({ value, format }: { value: number; format: (n: number) => string }) {
  const v = useTicker(value);
  return <>{format(v)}</>;
}

/** Every at-risk order as one segment, as wide as its exposure, in its band's colour. */
function HeatStrip({ orders, onSelect }: { orders: PreventionOrder[]; onSelect: (id: string) => void }) {
  if (!orders.length) return <div className="h-2.5 rounded-full bg-[#ededeb]" />;
  return (
    <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full">
      {orders.map((o) => (
        <button
          key={o.orderId}
          type="button"
          aria-label={`${o.buyer}, ${o.orderId}, risk ${o.score}, ${money(o.exposure)} exposure`}
          title={`${o.buyer} · ${o.orderId} · risk ${o.score} · ${money(o.exposure)}`}
          onClick={() => onSelect(o.orderId)}
          className="min-w-[4px] transition-opacity hover:opacity-70"
          style={{ flexGrow: o.exposure, background: BAND[bandOf(o)].color }}
        />
      ))}
    </div>
  );
}

function AtRiskRow({ o, selected, leaving, working, onSelect, onFix }: { o: PreventionOrder; selected: boolean; leaving: boolean; working: boolean; onSelect: () => void; onFix: (a: PreventionAction) => void }) {
  const fix = o.fixes.find((f) => f.primary);
  return (
    <div className={clsx("pv-row grid", leaving && "pv-row-leaving")}>
      <div className="min-h-0 overflow-hidden">
        <div
          role="button"
          tabIndex={0}
          aria-pressed={selected}
          onClick={onSelect}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}
          className={clsx("group flex cursor-pointer items-center gap-3.5 border-b border-rule px-5 py-3 transition-colors", selected ? "bg-active" : "hover:bg-hover", leaving && "bg-green-soft")}
        >
          <ScoreRing score={o.score} band={leaving ? "prevented" : bandOf(o)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[14px] font-medium text-ink">{o.buyer}</span>
              <span className="mono shrink-0 text-[12px] text-faint">{o.orderId}</span>
            </div>
            <div className="mt-0.5 truncate text-[13px] text-ink-2">
              {o.signals.slice(0, 2).map((s) => SIGNAL_SHORT[s.kind]).join(" · ")}
              {o.signals.length > 2 ? <span className="text-muted"> · +{o.signals.length - 2}</span> : null}
            </div>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            <div className="mono text-[13px] text-ink">{money(o.exposure)}</div>
            <div className="mt-0.5 text-[12px] text-muted">{o.top?.reasonLabel}</div>
          </div>
          <div className="flex min-w-[136px] shrink-0 justify-end">
            {leaving ? (
              <span className="inline-flex items-center gap-1 text-[13px] font-medium text-green">
                <Check className="size-3.5" strokeWidth={2.6} /> Prevented
              </span>
            ) : fix ? (
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onFix(fix.action);
                }}
                disabled={working}
              >
                {working ? <Loader2 className="size-3.5 animate-spin" /> : null}
                <span className="whitespace-nowrap">{fix.label.length > 20 ? fix.label.replace(" to PayPal", "") : fix.label}</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyRadarList({ report, art }: { report: PreventionReport; art?: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-8 py-6 text-center">
      {art}
      <div className="mt-4 text-[16px] font-semibold text-ink">No orders at risk</div>
      <p className="mt-1 max-w-sm text-[13px] leading-[20px] text-muted">
        Exhibit is watching {report.totals.watched} recent order{report.totals.watched === 1 ? "" : "s"} and flags the first sign of a dispute. It looks for:
      </p>
      <ul className="mt-4 w-full max-w-md text-left">
        {report.watches.map((w) => (
          <li key={w.kind} className="border-b border-rule py-2 last:border-0">
            <div className="text-[13px] font-medium text-ink">
              {w.label} <span className="font-normal text-muted">→ {w.reasonLabel}</span>
            </div>
            <div className="text-[12px] leading-[18px] text-muted">{w.description}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PreventionView({ initial, initialOrder = null, emptyArt }: { initial: PreventionReport; initialOrder?: string | null; /** Dot art for "No orders at risk", rendered by the page (a server component). */ emptyArt?: React.ReactNode }) {
  const [report, setReport] = useState(initial);
  const latest = useRef(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initialOrder && initial.atRisk.some((o) => o.orderId === initialOrder) ? initialOrder : null);
  const [filter, setFilter] = useState<PreventionSignalKind | null>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState<Set<string>>(new Set());
  const [success, setSuccess] = useState<{ orderId: string; saved: number } | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [pushing, setPushing] = useState(false);
  const selectedRef = useRef<string | null>(null);

  const apply = useCallback((r: PreventionReport) => {
    latest.current = r;
    setReport(r);
  }, []);

  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);

  const fixOne = useCallback(
    async (orderId: string, action: PreventionAction, message?: { subject?: string; body: string }, quiet = false): Promise<FixOutcome> => {
      setWorking((s) => new Set(s).add(orderId));
      try {
        const res = (await fetch("/api/prevention", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId, action, message }) }).then((r) => r.json())) as { result: PreventionFixResult; report: PreventionReport };
        if (!res.result?.ok) {
          const error = res.result && "error" in res.result ? res.result.error : "Unexpected response";
          if (!quiet) toast({ title: "Fix failed", sub: error, tone: "error" });
          if (res.report) apply(res.report);
          return { ok: false, prevented: false, saved: 0, paypal: false, error };
        }
        const r = res.result;
        const before = latest.current.orders.find((o) => o.orderId === orderId);
        if (r.prevented) {
          if (selectedRef.current === orderId) setSuccess({ orderId, saved: r.saved });
          setLeaving((s) => new Set(s).add(orderId));
          if (!quiet) toast({ title: "Dispute prevented", value: `${money(r.saved)} saved`, sub: `${before?.buyer ?? orderId} · ${orderId}`, tone: "success" });
          await new Promise((ok) => setTimeout(ok, 700));
          apply(res.report);
          setLeaving((s) => {
            const n = new Set(s);
            n.delete(orderId);
            return n;
          });
          if (selectedRef.current === orderId)
            setTimeout(() => {
              if (selectedRef.current === orderId) {
                setSelectedId(null);
                setSuccess(null);
              }
            }, 1300);
        } else {
          apply(res.report);
          if (action === "dismiss") setSelectedId(null);
          const after = res.report.orders.find((o) => o.orderId === orderId);
          if (!quiet)
            toast({
              title: action === "dismiss" ? "Taken off the radar" : r.record.paypal ? "Sent to PayPal" : "Done",
              sub: action === "dismiss" ? `${before?.buyer} · ${orderId}` : `Risk ${before?.score ?? "–"} → ${after?.score ?? 0} · ${after?.signals.length ?? 0} signal${after?.signals.length === 1 ? "" : "s"} left`,
            });
        }
        window.dispatchEvent(new Event("exhibit:nav"));
        return { ok: true, prevented: r.prevented, saved: r.saved, paypal: !!r.record.paypal };
      } finally {
        setWorking((s) => {
          const n = new Set(s);
          n.delete(orderId);
          return n;
        });
      }
    },
    [apply],
  );

  const fix = useCallback(async (orderId: string, action: PreventionAction, message?: { subject?: string; body: string }) => (await fixOne(orderId, action, message)).ok, [fixOne]);

  /** Runs every order's fixes in turn, then reports once: prevented, saved, PayPal calls, failures. */
  const fixAll = async () => {
    const queue = latest.current.atRisk.map((o) => o.orderId);
    setSelectedId(null);
    setBulk({ done: 0, total: queue.length });
    const tally = { prevented: 0, saved: 0, paypal: 0, failed: 0, fixes: 0 };
    for (const [i, id] of queue.entries()) {
      for (let step = 0; step < 3; step++) {
        const o = latest.current.orders.find((x) => x.orderId === id);
        const next = o?.status === "at_risk" ? o.fixes.find((f) => f.action !== "dismiss" && f.action !== "require_signature") : undefined;
        if (!next) break;
        const out = await fixOne(id, next.action, undefined, true);
        if (!out.ok) {
          tally.failed++;
          break;
        }
        tally.fixes++;
        if (out.paypal) tally.paypal++;
        if (out.prevented) {
          tally.prevented++;
          tally.saved += out.saved;
        }
      }
      setBulk({ done: i + 1, total: queue.length });
    }
    setTimeout(() => setBulk(null), 600);
    toast({
      title: tally.prevented ? `${tally.prevented} dispute${tally.prevented === 1 ? "" : "s"} prevented` : "Fixes sent",
      value: tally.saved ? `${money(tally.saved)} saved` : undefined,
      sub: `${tally.fixes} fix${tally.fixes === 1 ? "" : "es"} across ${queue.length} orders · ${tally.paypal} PayPal call${tally.paypal === 1 ? "" : "s"}${tally.failed ? ` · ${tally.failed} failed` : ""}`,
      tone: tally.failed && !tally.prevented ? "error" : "success",
    });
  };

  const pushAll = async () => {
    setPushing(true);
    try {
      const res = await fetch("/api/protection", { method: "POST", body: "{}" }).then((r) => r.json());
      const ok = (res.results as { ok: boolean }[]).filter((r) => r.ok).length;
      apply(await fetch("/api/prevention").then((r) => r.json()));
      toast({ title: `${ok} tracking number${ok === 1 ? "" : "s"} sent to PayPal`, sub: "POST /v2/checkout/orders/{id}/track", tone: ok ? "success" : "neutral" });
    } finally {
      setPushing(false);
    }
  };

  const t = report.totals;
  const list = report.atRisk.filter((o) => !filter || o.signals.some((s) => s.kind === filter));
  const selected = selectedId ? report.orders.find((o) => o.orderId === selectedId) : undefined;
  const preventable = Math.max(t.atRisk ? 1 : 0, Math.round(t.expectedDisputes));
  const shipped = report.orders.filter((o) => o.shipment);
  const missing = shipped.filter((o) => !o.shipment?.onPayPal).length;
  const top = report.atRisk[0];

  return (
    <>
      <PageHeader
        title="Prevention"
        subtitle={
          t.atRisk && top
            ? `${t.atRisk} recent order${t.atRisk === 1 ? " shows" : "s show"} the signs that come before a PayPal dispute, ${money(t.exposure)} exposed. The riskiest: ${top.buyer}'s ${money(top.exposure - top.fee)} order, ${top.signals
                .slice(0, 2)
                .map((x) => SIGNAL_SHORT[x.kind].toLowerCase())
                .join(" and ")}.`
            : `No order shows a sign of a coming dispute. Exhibit is watching ${t.watched} recent orders.`
        }
        actions={
          <>
            {missing ? (
              <Button disabled={pushing} onClick={pushAll} className="max-sm:hidden">
                {pushing ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />} Push {missing} tracking number{missing === 1 ? "" : "s"}
              </Button>
            ) : null}
            <Button variant="primary" onClick={fixAll} disabled={!!bulk || !t.atRisk}>
              {bulk ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {bulk ? `Fixing ${Math.min(bulk.done + 1, bulk.total)} of ${bulk.total}…` : t.atRisk ? `Fix all ${t.atRisk} at-risk orders` : "Nothing to fix"}
            </Button>
          </>
        }
      />
      <div className="space-y-4 px-4 pt-6 sm:px-6">
        <section aria-label="Risk now" className="grid rounded-[10px] border border-line lg:grid-cols-[1fr_1.6fr_1fr] lg:divide-x lg:divide-line max-lg:[&>*:not(:last-child)]:border-b max-lg:[&>*]:border-line">
          <div className="px-5 py-4">
            <div className="text-[13px] text-muted">At risk now</div>
            <div className="num mt-1.5 text-[24px] font-semibold leading-7 tracking-[-0.02em] text-ink">
              <Ticker value={t.exposure} format={(n) => money(n)} />
            </div>
            <div className="mt-1 text-[13px] text-muted">
              across <span className="num">{t.atRisk}</span> order{t.atRisk === 1 ? "" : "s"}, about <span className="num">{t.atRisk ? preventable : 0}</span> dispute{preventable === 1 ? "" : "s"} if nothing changes
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-muted">Risk across watched orders, width is exposure</span>
              <span className="num shrink-0 text-[13px] text-muted">{t.watched} watched</span>
            </div>
            <div className="mt-3.5">
              <HeatStrip orders={report.atRisk} onSelect={setSelectedId} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
              {(["high", "elevated", "watch", "prevented"] as const).map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5 text-muted">
                  <span className="size-2 rounded-[2px]" style={{ background: BAND[b].color }} />
                  {BAND[b].label} <span className="num text-ink">{b === "prevented" ? t.prevented : t[b]}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="px-5 py-4">
            <div className="text-[13px] text-muted">Prevented by Exhibit</div>
            <div className={clsx("num mt-1.5 text-[24px] font-semibold leading-7 tracking-[-0.02em]", t.prevented ? "text-green" : "text-ink")}>
              <Ticker value={t.prevented} format={(n) => String(Math.round(n))} />
            </div>
            <div className="mt-1 text-[13px] text-muted">
              <span className="num text-ink-2">
                <Ticker value={t.saved} format={(n) => money(n)} />
              </span>{" "}
              of exposure saved
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,min(500px,44%))]">
          {/* The list scrolls inside the card; the radar beside it sets the row's height, so both cards end level. */}
          <section className="card relative min-h-[440px] overflow-hidden border" aria-label="At-risk orders">
            <div className="absolute inset-0 flex flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="text-[14px] font-semibold text-ink">At-risk orders</h2>
                <span className="num text-[13px] text-muted">{list.length}</span>
                {filter ? (
                  <button type="button" onClick={() => setFilter(null)} className="inline-flex h-6 items-center gap-1 rounded-[6px] border border-line-strong px-2 text-[12px] text-ink-2 hover:bg-hover">
                    {report.bySignal.find((b) => b.kind === filter)?.label ?? filter} <X className="size-3" />
                  </button>
                ) : null}
              </div>
              <span className="hidden text-[12px] text-muted sm:inline">riskiest first · select one for the full story</span>
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
              {report.atRisk.length ? (
                list.map((o) => <AtRiskRow key={o.orderId} o={o} selected={o.orderId === selectedId} leaving={leaving.has(o.orderId)} working={working.has(o.orderId)} onSelect={() => setSelectedId(o.orderId)} onFix={(a) => fix(o.orderId, a)} />)
              ) : (
                <EmptyRadarList report={report} art={emptyArt} />
              )}
              {report.atRisk.length && report.resolved.length ? (
                <div className="px-5 py-3 text-[13px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5 text-green" strokeWidth={2.5} />
                    {report.resolved.length} order{report.resolved.length === 1 ? "" : "s"} off the radar · <span className="num text-ink">{money(t.saved)}</span> saved
                  </span>
                </div>
              ) : null}
            </div>
            </div>
          </section>

          <section className="card border px-5 pb-4 pt-3" aria-label="Dispute radar">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[14px] font-semibold text-ink">Dispute radar</h2>
              <span className="text-[12px] text-muted">nearer the centre, nearer a dispute</span>
            </div>
            <PreventionRadar orders={report.orders} selectedId={selectedId} onSelect={setSelectedId} filter={filter} onFilter={setFilter} leaving={leaving} />
          </section>
        </div>

        <PreventionGrid orders={report.orders} onSelect={setSelectedId} onFix={(id, a) => void fix(id, a)} working={working} onPushAll={pushAll} pushing={pushing} />

        <p className="max-w-[900px] px-1 text-[12px] leading-[18px] text-muted">
          Exposure is the open order value plus PayPal&apos;s US dispute fee ({money(report.fee.PAYPAL)} on PayPal checkout, {money(report.fee.CARD)} for a card chargeback), per PayPal&apos;s merchant fees page retrieved {report.fee.retrieved}. Risk scores are deterministic: each signal adds weight, and they combine as independent probabilities. Buyer messages go out from the support inbox; PayPal has no messaging API before a dispute is filed.
        </p>

        {selected ? (
          <PreventionDrawer
            key={selected.orderId}
            order={selected}
            success={success?.orderId === selected.orderId ? success : null}
            onClose={() => {
              setSelectedId(null);
              setSuccess(null);
            }}
            onFix={(id, a, m) => fix(id, a, m)}
          />
        ) : null}
      </div>
    </>
  );
}
