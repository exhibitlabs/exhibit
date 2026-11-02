"use client";

import { Bell, Loader2, Play, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { InboxRow } from "@/lib/inbox";
import { usd } from "@/lib/format";
import { Button } from "../ui/Button";
import { Kbd } from "../ui/Kbd";
import { Segmented } from "../ui/Tabs";
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
  { key: "refund", label: "Exhibit says refund or offer", test: (r) => r.statusCode !== "RESOLVED" && (r.decision === "REFUND" || r.decision === "OFFER"), empty: ["No refunds or offers recommended", "When the buyer is right, Exhibit says so and refunds instead of fighting."] },
  { key: "resolved", label: "Resolved", test: (r) => r.statusCode === "RESOLVED", empty: ["No resolved cases yet", "PayPal's rulings land here: won, refunded or settled."] },
];

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "red" }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums ${tone === "red" ? "text-red" : "text-ink"}`}>{value}</div>
      {hint ? <div className="mt-1.5 truncate text-[12px] text-faint">{hint}</div> : null}
    </div>
  );
}

export function InboxView({ initialRows, initialStats, mode, header }: { initialRows: InboxRow[]; initialStats: Stats; mode: string; header: { eyebrow: string; title: string; subtitle: string } }) {
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
          variant="secondary"
          size="sm"
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
      <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => act("sync", () => load(true).then(() => toast({ title: "Synced with PayPal", sub: "GET /v1/customer/disputes" })))}>
        <RefreshCw className={`size-3.5 ${busy === "sync" ? "animate-spin" : ""}`} /> Sync PayPal
      </Button>
      <Button variant="primary" size="sm" disabled={!!busy || !unanalyzed} onClick={() => investigate()} title={unanalyzed ? undefined : "Every open case has a brief"}>
        {busy === "batch" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Investigate {unanalyzed ? `${unanalyzed} new` : "all"}
      </Button>
    </>
  );

  return (
    <>
      <PageHeader eyebrow={header.eyebrow} title={header.title} subtitle={header.subtitle} actions={actions} />
      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Stat label="Open · at risk" value={usd(stats.atRisk, 0)} hint={`${stats.openCount} open · ${stats.needsResponse} waiting on you`} />
        <Stat label="Due in 72 hours" value={String(stats.dueSoon)} hint="Unanswered cases close for the buyer" tone={stats.dueSoon ? "red" : undefined} />
        <Stat label="Expected back" value={usd(stats.expected, 0)} hint={`${stats.analyzed} of ${stats.openCount} open cases briefed`} />
        <Stat label="Recovered · 90 days" value={usd(stats.recovered, 0)} hint={stats.winRate !== null ? `${stats.winRate}% won of ${stats.decided} fought` : "No fought cases yet"} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Segmented items={VIEWS.map((x) => ({ key: x.key, label: x.label, count: counts[x.key] }))} value={view} onChange={setView} />
        <label className="relative flex h-8 min-w-0 items-center lg:w-72">
          <Search className="pointer-events-none absolute left-2.5 size-3.5 text-faint" />
          <input
            ref={search}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Escape") return;
              setQ("");
              e.currentTarget.blur();
            }}
            placeholder="Search buyer, case id, reason…"
            aria-label="Search disputes"
            className="h-8 w-full rounded-lg border border-line bg-surface pl-8 pr-8 text-[12.5px] outline-none transition-colors placeholder:text-faint focus:border-ink-2"
          />
          {q ? (
            <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 text-faint hover:text-ink">
              <X className="size-3.5" />
            </button>
          ) : (
            <Kbd className="absolute right-2">/</Kbd>
          )}
        </label>
      </div>

      {selected.length ? (
        <div className="rise flex items-center gap-3 rounded-xl bg-ink px-4 py-2.5 text-[13px] text-white">
          <span className="font-medium">{selected.length} selected</span>
          <span className="text-white/50">Exhibit re-reads every source and files a fresh brief. Nothing is sent to PayPal.</span>
          <span className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSelected([]);
                setClearSignal((x) => x + 1);
              }}
              className="rounded-md px-2.5 py-1 text-white/70 hover:text-white"
            >
              Clear
            </button>
            <button type="button" disabled={!!busy} onClick={() => investigate(selected)} className="inline-flex items-center gap-1.5 rounded-md bg-white px-3 py-1 font-medium text-ink hover:bg-white/90">
              {busy === "selected" ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />} Investigate {selected.length}
            </button>
          </span>
        </div>
      ) : null}

      {shown.length ? (
        <InboxGrid rows={shown} onSelection={setSelected} clearSignal={clearSignal} />
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-[#fcfcfc] px-6 py-14 text-center">
          <div className="text-[14px] font-medium text-ink">{needle ? `No dispute matches “${q.trim()}”` : v.empty[0]}</div>
          <div className="mt-1 max-w-sm text-[12.5px] leading-relaxed text-muted">{needle ? `in ${v.label.toLowerCase()}. Try a buyer's name, a PP-D id or a reason.` : v.empty[1]}</div>
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
      <p className="px-1 text-[11.5px] text-faint">Sorted by deadline, most urgent first. Hover a case for Exhibit&apos;s summary; select cases to investigate them together.</p>
      </div>
    </>
  );
}
