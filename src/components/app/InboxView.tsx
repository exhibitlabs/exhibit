"use client";

import { Bell, Loader2, Play, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InboxRow } from "@/lib/inbox";
import { usd } from "@/lib/format";
import { Button } from "../ui/Button";
import { Kbd } from "../ui/Kbd";
import { Tabs } from "../ui/Tabs";
import { toast } from "../ui/Toast";
import { InboxGrid } from "./InboxGrid";
import { PageHeader } from "./PageHeader";
import { usePageKeys } from "./Shortcuts";

type Stats = { openCount: number; atRisk: number; dueSoon: number; needsResponse: number; analyzed: number; expected: number; recovered: number; winRate: number | null; decided: number };
type View = "open" | "needs" | "due" | "fight" | "refund" | "resolved";

const VIEWS: { key: View; label: string; test: (r: InboxRow) => boolean; empty: [string, string] }[] = [
  { key: "open", label: "All open", test: (r) => r.statusCode !== "RESOLVED", empty: ["No open disputes", "When PayPal opens a dispute, Exhibit investigates it on arrival and it lands here."] },
  { key: "needs", label: "Needs response", test: (r) => r.statusCode === "WAITING_FOR_SELLER_RESPONSE" && !r.answered, empty: ["Nothing needs a response", "Every open case is answered, or PayPal hasn't asked you for anything yet."] },
  { key: "due", label: "Due soon", test: (r) => r.statusCode !== "RESOLVED" && !r.answered && r.hoursLeft !== null && r.hoursLeft <= 72, empty: ["No deadline inside 72 hours", "PayPal closes unanswered cases for the buyer at the deadline; nothing is close."] },
  { key: "fight", label: "Exhibit says fight", test: (r) => r.statusCode !== "RESOLVED" && r.decision === "FIGHT", empty: ["No case to fight right now", "Exhibit fights only when your records show you did what you promised."] },
  { key: "refund", label: "Refund or offer", test: (r) => r.statusCode !== "RESOLVED" && (r.decision === "REFUND" || r.decision === "OFFER"), empty: ["No refunds or offers recommended", "When the buyer is right, Exhibit says so and refunds instead of fighting."] },
  { key: "resolved", label: "Resolved", test: (r) => r.statusCode === "RESOLVED", empty: ["No resolved cases yet", "PayPal's rulings land here: won, refunded or settled."] },
];

const span = (h: number) => (h < 48 ? `${h} hour${h === 1 ? "" : "s"}` : `${Math.round(h / 24)} days`);

/** The list's one line of context: how many, how much, and the deadline that matters most. */
function summary(rows: InboxRow[], stats: Stats) {
  if (!stats.openCount) return "No open disputes. Resolved cases stay under Resolved.";
  const next = rows.filter((r) => r.statusCode === "WAITING_FOR_SELLER_RESPONSE" && !r.answered && r.hoursLeft !== null).sort((a, b) => a.hoursLeft! - b.hoursLeft!)[0];
  const lead = `${stats.openCount} open, ${usd(stats.atRisk, 0)} at stake.`;
  if (!next) return `${lead} Every open case is answered; PayPal has them now.`;
  return `${lead} ${next.buyer}'s ${next.stage === "Chargeback" ? "chargeback" : "case"} is the next deadline, ${next.hoursLeft! < 0 ? `overdue by ${span(-next.hoursLeft!)}` : `in ${span(next.hoursLeft!)}`}.`;
}

export function InboxView({ initialRows, initialStats, mode, emptyArt }: { initialRows: InboxRow[]; initialStats: Stats; mode: string; /** Dot art for the empty open queue, rendered by the page (a server component). */ emptyArt?: React.ReactNode }) {
  const [rows, setRows] = useState(initialRows);
  const [stats, setStats] = useState(initialStats);
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setViewState] = useState<View>(() => (initialRows.some(VIEWS[1].test) ? "needs" : "open"));
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [clearSignal, setClearSignal] = useState(0);
  const search = useRef<HTMLInputElement>(null);
  const setView = (k: View) => {
    setViewState(k);
    setSelected([]);
    setClearSignal((x) => x + 1);
  };

  const load = useCallback(async (sync = false) => {
    const res = await fetch(sync ? "/api/disputes/sync" : "/api/disputes", { method: sync ? "POST" : "GET", cache: "no-store" }).catch(() => null);
    if (!res) return;
    const data = await res.json();
    if (res.ok) {
      setRows(data.rows);
      setStats(data.stats);
    } else toast({ title: "Sync failed", sub: data.error, tone: "error" });
  }, []);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && void load(false), 4000);
    return () => clearInterval(t);
  }, [load]);

  usePageKeys((k) => {
    if (k !== "/") return false;
    search.current?.focus();
    return true;
  });

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const investigate = (ids?: string[]) =>
    act(ids ? "selected" : "batch", async () => {
      const r = await fetch("/api/batch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids ? { ids } : {}) }).then((x) => x.json());
      const n = r.queued?.length ?? 0;
      toast(n ? { title: `Exhibit is investigating ${n} case${n === 1 ? "" : "s"}`, sub: "Briefs land here as each one finishes, two at a time." } : { title: "Nothing to investigate", sub: "Every open case already has a brief." });
      setSelected([]);
      setClearSignal((x) => x + 1);
      window.dispatchEvent(new Event("exhibit:nav"));
      await load(false);
    });

  const counts = useMemo(() => Object.fromEntries(VIEWS.map((v) => [v.key, rows.filter(v.test).length])) as Record<View, number>, [rows]);
  const v = VIEWS.find((x) => x.key === view)!;
  const needle = q.trim().toLowerCase();
  const shown = rows.filter(v.test).filter((r) => !needle || [r.buyer, r.id, r.reason, r.item, r.headline, r.title, r.stage, r.status].some((f) => f?.toLowerCase().includes(needle)));
  const unanalyzed = rows.filter((r) => r.statusCode !== "RESOLVED" && !r.decision).length;

  const actions = (
    <>
      {mode === "demo" ? (
        <Button
          className="max-sm:hidden"
          disabled={!!busy}
          onClick={() =>
            act("incoming", async () => {
              const r = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "incoming" }) }).then((x) => x.json());
              toast({ title: "Webhook: CUSTOMER.DISPUTE.CREATED", sub: `${r.dispute_id ?? "New dispute"} · Exhibit is investigating it now` });
              await load(false);
            })
          }
        >
          <Bell className="size-3.5" /> Simulate new dispute
        </Button>
      ) : null}
      <Button className="max-sm:hidden" disabled={!!busy} onClick={() => act("sync", () => load(true).then(() => toast({ title: "Synced with PayPal", sub: "GET /v1/customer/disputes" })))}>
        <RefreshCw className={`size-3.5 ${busy === "sync" ? "animate-spin" : ""}`} /> Sync PayPal
      </Button>
      <Button variant="primary" disabled={!!busy || !unanalyzed} onClick={() => investigate()} title={unanalyzed ? undefined : "Every open case has a brief"}>
        {busy === "batch" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} {unanalyzed ? `Investigate ${unanalyzed} new` : "All investigated"}
      </Button>
    </>
  );

  return (
    <>
      <PageHeader title="Disputes" subtitle={summary(rows, stats)} actions={actions} />
      <div className="px-4 pt-5 sm:px-6">
        <div className="flex flex-col gap-3 border-b border-line lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <Tabs tabs={VIEWS.map((x) => ({ key: x.key, label: x.label, count: counts[x.key] }))} value={view} onChange={setView} />
          <label className="relative mb-2 flex h-8 min-w-0 items-center lg:w-72">
            <Search className="pointer-events-none absolute left-2.5 size-3.5 text-ghost" />
            <input
              ref={search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Escape") return;
                setQ("");
                e.currentTarget.blur();
              }}
              placeholder="Search buyer, case id, reason"
              aria-label="Search disputes"
              className="outline-none h-8 w-full rounded-[8px] border border-line-strong bg-surface pl-8 pr-8 text-[13px] text-ink transition-colors placeholder:text-faint focus:border-ink focus:shadow-[0_0_0_1px_var(--ink)]"
            />
            {q ? (
              <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-1.5 flex size-6 items-center justify-center rounded-[6px] text-muted hover:bg-active hover:text-ink">
                <X className="size-3.5" />
              </button>
            ) : (
              <Kbd className="absolute right-2">/</Kbd>
            )}
          </label>
        </div>

        {selected.length ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[10px] border border-line bg-frame px-4 py-2.5 text-[13px]">
            <span className="font-medium text-ink">{selected.length} selected</span>
            <span className="text-muted">Exhibit re-reads every source and writes a fresh brief. Nothing is sent to PayPal.</span>
            <span className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelected([]);
                  setClearSignal((x) => x + 1);
                }}
              >
                Clear
              </Button>
              <Button size="sm" variant="primary" disabled={!!busy} onClick={() => investigate(selected)}>
                {busy === "selected" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Investigate {selected.length}
              </Button>
            </span>
          </div>
        ) : null}

        {shown.length ? (
          <>
            <InboxGrid rows={shown} onSelection={setSelected} clearSignal={clearSignal} />
            {!needle && view !== "open" && view !== "resolved" && counts.open > shown.length ? (
              <p className="mt-4 text-[13px] text-muted">
                {counts.open - shown.length} more open case{counts.open - shown.length === 1 ? " isn't" : "s aren't"} in this view.{" "}
                <button type="button" onClick={() => setView("open")} className="rounded-[4px] font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
                  Show all {counts.open} open
                </button>
              </p>
            ) : null}
          </>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center rounded-[10px] border border-dashed border-line-strong px-6 py-12 text-center">
            {!needle && view === "open" ? emptyArt : null}
            <div className="text-[14px] font-medium text-ink">{needle ? `No dispute matches “${q.trim()}”` : v.empty[0]}</div>
            <div className="mt-1 max-w-sm text-[13px] leading-[20px] text-muted">{needle ? `in ${v.label.toLowerCase()}. Try a buyer's name, a PP-D id or a reason.` : v.empty[1]}</div>
            {needle || view !== "open" ? (
              <div className="mt-4 flex gap-2">
                {needle ? (
                  <Button size="sm" onClick={() => setQ("")}>
                    Clear search
                  </Button>
                ) : null}
                {view !== "open" ? (
                  <Button size="sm" variant="ghost" onClick={() => setView("open")}>
                    Show all open
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </>
  );
}
