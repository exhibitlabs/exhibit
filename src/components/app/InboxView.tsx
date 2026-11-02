"use client";

import { Bell, Play, RefreshCw, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { InboxRow } from "@/lib/inbox";
import { usd } from "@/lib/format";
import { Button } from "../ui/Button";
import { InboxGrid } from "./InboxGrid";

type Stats = {
  openCount: number;
  atRisk: number;
  dueSoon: number;
  needsResponse: number;
  analyzed: number;
  expected: number;
  recovered: number;
  winRate: number | null;
  decided: number;
};

function Stat({ label, value, hint, emphasis }: { label: string; value: string; hint?: string; emphasis?: boolean }) {
  return (
    <div className="card px-5 py-4">
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`num mt-1.5 text-[26px] leading-none ${emphasis ? "text-ink" : "text-ink-2"}`}>{value}</div>
      {hint ? <div className="mt-2 text-[12px] text-faint">{hint}</div> : null}
    </div>
  );
}

export function InboxView({ initialRows, initialStats, mode }: { initialRows: InboxRow[]; initialStats: Stats; mode: string }) {
  const [rows, setRows] = useState(initialRows);
  const [stats, setStats] = useState(initialStats);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async (sync = false) => {
    const res = await fetch(sync ? "/api/disputes/sync" : "/api/disputes", { method: sync ? "POST" : "GET", cache: "no-store" });
    const data = await res.json();
    if (res.ok) {
      setRows(data.rows);
      setStats(data.stats);
    } else setToast(data.error ?? "Sync failed");
  }, []);

  useEffect(() => {
    const t = setInterval(() => void load(false), 4000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const act = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const unanalyzed = rows.filter((r) => r.statusCode !== "RESOLVED" && !r.decision).length;

  return (
    <div className="space-y-6 px-8 py-6">
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Open disputes · at risk" value={usd(stats.atRisk, 0)} hint={`${stats.openCount} open · ${stats.needsResponse} need a response`} emphasis />
        <Stat label="Due in the next 72 hours" value={String(stats.dueSoon)} hint="PayPal closes unanswered cases for the buyer" />
        <Stat label="Expected recovery" value={usd(stats.expected, 0)} hint={`${stats.analyzed} of ${stats.openCount} open cases analyzed`} />
        <Stat label="Recovered · last 90 days" value={usd(stats.recovered, 0)} hint={stats.winRate !== null ? `${stats.winRate}% won across ${stats.decided} fought cases` : undefined} />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[13px] text-muted">
          {unanalyzed ? `${unanalyzed} case${unanalyzed === 1 ? "" : "s"} waiting for Exhibit` : "Every open case has a brief"}
        </div>
        <div className="flex items-center gap-2">
          {mode === "demo" ? (
            <>
              <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => act("reset", async () => { await fetch("/api/demo", { method: "POST", body: JSON.stringify({ op: "reset" }) }); await load(true); setToast("Demo merchant reset"); })}>
                <RotateCcw className="size-3.5" /> Reset demo
              </Button>
              <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => act("incoming", async () => { const r = await fetch("/api/demo", { method: "POST", body: JSON.stringify({ op: "incoming" }) }).then((x) => x.json()); await load(false); setToast(`Webhook: CUSTOMER.DISPUTE.CREATED ${r.dispute_id ?? ""} — Exhibit is on it`); })}>
                <Bell className="size-3.5" /> Simulate new dispute
              </Button>
            </>
          ) : null}
          <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => act("sync", () => load(true))}>
            <RefreshCw className={`size-3.5 ${busy === "sync" ? "animate-spin" : ""}`} /> Sync PayPal
          </Button>
          <Button variant="primary" size="sm" disabled={!!busy || !unanalyzed} onClick={() => act("batch", async () => { const r = await fetch("/api/batch", { method: "POST" }).then((x) => x.json()); setToast(`Exhibit is investigating ${r.queued.length} case(s)`); })}>
            <Play className="size-3.5" /> Investigate all
          </Button>
        </div>
      </div>

      <InboxGrid rows={rows} />

      {toast ? <div className="rise fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 text-[13px] text-white shadow-lg">{toast}</div> : null}
    </div>
  );
}
