"use client";

import { clsx } from "clsx";
import { Check, Loader2, ShieldCheck, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PreventionAction, PreventionFixResult, PreventionOrder, PreventionReport, PreventionSignalKind } from "@/lib/prevention";
import { PreventionDrawer } from "./PreventionDrawer";
import { PreventionGrid } from "./PreventionGrid";
import { BAND, bandOf, money, ScoreRing, SIGNAL_ICON, SignalChip, useTicker } from "./PreventionParts";
import { PreventionRadar } from "./PreventionRadar";
import { toast } from "../ui/Toast";

type FixOutcome = { ok: boolean; prevented: boolean; saved: number; paypal: boolean; error?: string };

function Ticker({ value, format }: { value: number; format: (n: number) => string }) {
  const v = useTicker(value);
  return <>{format(v)}</>;
}

function HeatStrip({ orders, onSelect }: { orders: PreventionOrder[]; onSelect: (id: string) => void }) {
  if (!orders.length) return <div className="h-9 rounded-md bg-[#f0fdf4]" />;
  return (
    <div className="flex h-9 gap-[3px]">
      {orders.map((o) => {
        const b = bandOf(o);
        return (
          <button
            key={o.orderId}
            title={`${o.buyer} · ${o.orderId} · risk ${o.score} · ${money(o.exposure)}`}
            onClick={() => onSelect(o.orderId)}
            className="pv-seg relative min-w-[6px] rounded-[4px] transition-all duration-500"
            style={{ flexGrow: o.exposure, background: BAND[b].color, opacity: 0.35 + (o.score / 100) * 0.65 }}
          />
        );
      })}
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
          onClick={onSelect}
          onKeyDown={(e) => e.key === "Enter" && onSelect()}
          className={clsx("group flex cursor-pointer items-center gap-3.5 border-b border-[#f3f3f3] px-5 py-3 transition-colors", selected ? "bg-[#f7f7f7]" : "hover:bg-[#fafafa]", leaving && "bg-green-soft")}
        >
          <ScoreRing score={o.score} band={leaving ? "prevented" : bandOf(o)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-[13.5px] font-medium">{o.buyer}</span>
              <span className="num shrink-0 text-[11px] text-faint">{o.orderId}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {o.signals.slice(0, 2).map((s) => (
                <SignalChip key={s.kind} kind={s.kind} />
              ))}
              {o.signals.length > 2 ? <span className="num text-[11px] text-faint">+{o.signals.length - 2}</span> : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="num text-[13.5px]">{money(o.exposure)}</div>
            <div className="mt-1 text-[11.5px] text-muted">{o.top?.reasonLabel}</div>
          </div>
          <div className="w-[140px] shrink-0 text-right">
            {leaving ? (
              <span className="inline-flex items-center gap-1 text-[12.5px] font-medium text-green">
                <Check className="size-3.5" strokeWidth={2.6} /> Prevented
              </span>
            ) : fix ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onFix(fix.action);
                }}
                disabled={working}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink shadow-[0_1px_1px_rgb(0_0_0/0.03)] transition-colors hover:border-line-strong hover:bg-[#fafafa] disabled:text-faint"
              >
                {working ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {fix.label.length > 20 ? fix.label.replace(" to PayPal", "") : fix.label}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyRadarList({ report }: { report: PreventionReport }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-10 py-6 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-green-soft text-green">
        <ShieldCheck className="size-5" />
      </span>
      <div className="display mt-4 text-[20px]">No orders at risk</div>
      <p className="mt-1.5 max-w-sm text-[13px] text-muted">
        Exhibit is watching {report.totals.watched} recent order{report.totals.watched === 1 ? "" : "s"} and will flag the first sign of a dispute.
      </p>
      <div className="mt-6 grid w-full max-w-md grid-cols-1 gap-2 text-left">
        {report.watches.map((w) => {
          const Icon = SIGNAL_ICON[w.kind];
          return (
            <div key={w.kind} className="flex items-start gap-2.5 rounded-lg border border-line px-3 py-2">
              <Icon className="mt-0.5 size-3.5 shrink-0 text-muted" />
              <div className="min-w-0">
                <div className="text-[12.5px] font-medium">
                  {w.label} <span className="font-normal text-faint">→ {w.reasonLabel}</span>
                </div>
                <div className="text-[11.5px] leading-snug text-muted">{w.description}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PreventionView({ initial, initialOrder = null }: { initial: PreventionReport; initialOrder?: string | null }) {
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

  return (
    <div className="space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      {/* Hero strip */}
      <div className="card grid divide-y divide-line lg:grid-cols-[1.05fr_1.5fr_1fr] lg:divide-x lg:divide-y-0">
        <div className="px-6 py-5">
          <div className="text-[12px] text-muted">At risk right now</div>
          <div className="display num mt-1.5 text-[40px] leading-none tracking-[-0.04em]">
            <Ticker value={t.exposure} format={(n) => money(n)} />
          </div>
          <div className="mt-2.5 text-[13px] leading-snug text-ink-2">
            across <span className="num">{t.atRisk}</span> order{t.atRisk === 1 ? "" : "s"}
            <br />
            Exhibit can prevent{" "}
            <span className="font-medium text-ink">
              ~<span className="num">{t.atRisk ? preventable : 0}</span> dispute{preventable === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <span className="text-[12px] text-muted">Risk across watched orders · width = $ exposure</span>
            <span className="num text-[11.5px] text-faint">{t.watched} watched</span>
          </div>
          <div className="mt-3">
            <HeatStrip orders={report.atRisk} onSelect={setSelectedId} />
          </div>
          <div className="mt-3 flex items-center gap-4 text-[12px]">
            {(["high", "elevated", "watch"] as const).map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5 text-muted">
                <span className="size-2 rounded-full" style={{ background: BAND[b].color }} />
                {BAND[b].label} <span className="num text-ink">{t[b]}</span>
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-muted">
              <span className="size-2 rounded-full" style={{ background: BAND.prevented.color }} />
              Prevented <span className="num text-ink">{t.prevented}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-between px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[12px] text-muted">Prevented by Exhibit</div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className={clsx("display num text-[40px] leading-none tracking-[-0.04em] transition-colors", t.prevented ? "text-green" : "text-ink")}>
                  <Ticker value={t.prevented} format={(n) => String(Math.round(n))} />
                </span>
                <span className="text-[12.5px] text-muted">
                  · <span className="num text-ink">
                    <Ticker value={t.saved} format={(n) => money(n)} />
                  </span>{" "}
                  saved
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={fixAll}
            disabled={!!bulk || !t.atRisk}
            className="mt-4 inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-ink px-3.5 text-[13.5px] font-medium text-white transition-colors hover:bg-[#262626] disabled:bg-[#d4d4d4]"
          >
            {bulk ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {bulk ? `Fixing ${Math.min(bulk.done + 1, bulk.total)} of ${bulk.total}…` : t.atRisk ? `Fix all ${t.atRisk} at-risk orders` : "Nothing to fix"}
          </button>
        </div>
      </div>

      {/* Radar + ranked list */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,min(500px,44%))_minmax(0,1fr)]">
        <div className="card px-5 pb-4 pt-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[14px] font-medium">Dispute radar</h2>
            <span className="text-[11.5px] text-faint">closer to the centre = closer to a dispute</span>
          </div>
          <PreventionRadar orders={report.orders} selectedId={selectedId} onSelect={setSelectedId} filter={filter} onFilter={setFilter} leaving={leaving} />
        </div>

        <div className="card relative min-h-[420px] overflow-hidden">
          <div className="absolute inset-0 flex flex-col">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-[14px] font-medium">At-risk orders</h2>
                <span className="num rounded-md bg-sunken px-1.5 py-0.5 text-[11.5px] text-muted">{list.length}</span>
                {filter ? (
                  <button onClick={() => setFilter(null)} className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-0.5 text-[11.5px] text-white">
                    {report.bySignal.find((b) => b.kind === filter)?.label ?? filter} <X className="size-3" />
                  </button>
                ) : null}
              </div>
              <span className="text-[11.5px] text-faint">ranked by risk · click for the full story</span>
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
              {report.atRisk.length ? (
                list.map((o) => (
                  <AtRiskRow key={o.orderId} o={o} selected={o.orderId === selectedId} leaving={leaving.has(o.orderId)} working={working.has(o.orderId)} onSelect={() => setSelectedId(o.orderId)} onFix={(a) => fix(o.orderId, a)} />
                ))
              ) : (
                <EmptyRadarList report={report} />
              )}
              {report.atRisk.length && report.resolved.length ? (
                <div className="px-5 py-3 text-[12px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Check className="size-3.5 text-green" strokeWidth={2.5} />
                    {report.resolved.length} order{report.resolved.length === 1 ? "" : "s"} off the radar ·{" "}
                    <span className="num text-ink">{money(t.saved)}</span> saved
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <PreventionGrid orders={report.orders} onSelect={setSelectedId} onFix={(id, a) => void fix(id, a)} working={working} onPushAll={pushAll} pushing={pushing} />

      <p className="px-1 text-[11.5px] leading-relaxed text-faint">
        Exposure is the open order value plus PayPal&apos;s US dispute fee ({money(report.fee.PAYPAL)} on PayPal checkout, {money(report.fee.CARD)} card chargeback), per PayPal&apos;s merchant fees page retrieved {report.fee.retrieved}. Risk scores are deterministic: each
        signal adds weight and they combine as independent probabilities. Buyer messages go out from the support inbox; PayPal has no messaging API before a dispute is filed.
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
  );
}
