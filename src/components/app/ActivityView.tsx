"use client";

import { clsx } from "clsx";
import { Bot, ChevronRight, Database, Download, Landmark, TriangleAlert, User, Webhook, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lane, TimelineItem } from "@/lib/activity";
import { dateTime } from "@/lib/format";
import { buttonClass } from "../ui/Button";
import { Segmented } from "../ui/Tabs";
import { ApiInspector, MethodTag, StatusPill } from "./ApiInspector";
import { PageHeader } from "./PageHeader";

const LANE: Record<Lane, { label: string; icon: typeof Bot }> = {
  api: { label: "PayPal API", icon: Landmark },
  agent: { label: "Agent", icon: Bot },
  merchant: { label: "Merchant", icon: User },
  webhook: { label: "Webhook", icon: Webhook },
  system: { label: "System", icon: Database },
};

type StatusFilter = "all" | "2xx" | "4xx" | "5xx";

function Select({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: React.ReactNode }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="outline-none h-8 max-w-[240px] rounded-[8px] border border-line-strong bg-surface px-2 text-[13px] text-ink-2 transition-colors hover:border-[#cdcdca] focus:border-ink focus:shadow-[0_0_0_1px_var(--ink)]">
      {children}
    </select>
  );
}

export function ActivityView({ initial, mode }: { initial: TimelineItem[]; mode: string }) {
  const [items, setItems] = useState(initial);
  const [lane, setLane] = useState<"all" | Lane>("all");
  const [endpoint, setEndpoint] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [dispute, setDispute] = useState("all");
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/activity", { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    if (r?.items) setItems(r.items);
  }, []);
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 5000);
    return () => clearInterval(t);
  }, [load]);

  const api = items.filter((i) => i.api);
  const surface = useMemo(() => {
    const m = new Map<string, { method: string; endpoint: string; count: number; errors: number; ms: number }>();
    for (const i of api) {
      const k = `${i.api!.method} ${i.api!.endpoint}`;
      const cur = m.get(k) ?? { method: i.api!.method, endpoint: i.api!.endpoint, count: 0, errors: 0, ms: 0 };
      cur.count++;
      cur.ms += i.api!.ms;
      if (i.api!.status >= 400) cur.errors++;
      m.set(k, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [api]);
  const disputes = useMemo(() => [...new Set(items.map((i) => i.disputeId).filter((x): x is string => !!x))].sort(), [items]);
  const latencies = api.map((i) => i.api!.ms).sort((a, b) => a - b);
  const p50 = latencies.length ? latencies[Math.floor(latencies.length / 2)] : 0;
  const errors = api.filter((i) => i.api!.status >= 400).length;

  const shown = items.filter((i) => {
    if (lane !== "all" && i.lane !== lane) return false;
    if (dispute !== "all" && i.disputeId !== dispute) return false;
    if (endpoint !== "all" && (!i.api || `${i.api.method} ${i.api.endpoint}` !== endpoint)) return false;
    if (status !== "all" && (!i.api || `${Math.floor(i.api.status / 100)}xx` !== status)) return false;
    return true;
  });
  const filtered = lane !== "all" || endpoint !== "all" || status !== "all" || dispute !== "all";

  return (
    <>
      <PageHeader
        title="PayPal activity"
        subtitle={
          <>
            <span className="num">{api.length}</span> PayPal call{api.length === 1 ? "" : "s"}
            {mode === "demo" ? " to the simulator" : " to api-m.sandbox.paypal.com"}, <span className={clsx("num", errors ? "font-medium text-red" : "")}>{errors}</span> error{errors === 1 ? "" : "s"}, median <span className="num">{p50}</span> ms{mode === "demo" ? " of simulated latency" : ""}. Every request, response and debug id is kept beside the decisions of the agent, the merchant and PayPal&apos;s webhooks.
          </>
        }
        actions={
          <a href="/api/activity" target="_blank" rel="noreferrer" className={buttonClass("secondary", "md")}>
            <Download className="size-3.5" /> Export JSON
          </a>
        }
      />
      <div className="grid grid-cols-1 items-start gap-4 px-4 pt-6 sm:px-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <section className="card overflow-hidden border" aria-label="API surface">
            <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="text-[14px] font-semibold text-ink">API surface</h2>
              <span className="num text-[13px] text-muted">{surface.length} endpoint{surface.length === 1 ? "" : "s"}</span>
            </div>
            <ul>
              {surface.map(([k, v]) => (
                <li key={k} className="border-b border-rule last:border-0">
                  <button type="button" aria-pressed={endpoint === k} onClick={() => setEndpoint(endpoint === k ? "all" : k)} className={clsx("flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-hover", endpoint === k && "bg-active")}>
                    <MethodTag method={v.method} />
                    <span className="mono min-w-0 flex-1 truncate text-[13px] text-ink-2" title={v.endpoint}>
                      {v.endpoint}
                    </span>
                    <span className="num text-[13px] text-ink">{v.count}</span>
                    {v.errors ? <span className="num text-[12px] font-medium text-red">{v.errors} err</span> : null}
                  </button>
                </li>
              ))}
              {!surface.length ? <li className="px-4 py-4 text-[13px] text-muted">No calls yet.</li> : null}
            </ul>
          </section>
          <p className="px-1 text-[13px] leading-[20px] text-muted">Secrets never reach this log: the Authorization header isn&apos;t stored, and tokens, client secrets and card numbers are masked before anything is written.</p>
        </aside>

        <section className="card min-w-0 overflow-hidden border" aria-label="Timeline">
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
            <Segmented
              value={lane}
              onChange={setLane}
              items={[
                { key: "all", label: "Everything", count: items.length },
                { key: "api", label: "PayPal API", count: api.length },
                { key: "agent", label: "Agent", count: items.filter((i) => i.lane === "agent").length },
                { key: "merchant", label: "Merchant", count: items.filter((i) => i.lane === "merchant").length },
                { key: "webhook", label: "Webhooks", count: items.filter((i) => i.lane === "webhook").length },
              ]}
            />
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Select label="Endpoint" value={endpoint} onChange={setEndpoint}>
                <option value="all">All endpoints</option>
                {surface.map(([k]) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
              <Select label="Status" value={status} onChange={(v) => setStatus(v as StatusFilter)}>
                <option value="all">Any status</option>
                <option value="2xx">2xx success</option>
                <option value="4xx">4xx refused</option>
                <option value="5xx">5xx error</option>
              </Select>
              <Select label="Dispute" value={dispute} onChange={setDispute}>
                <option value="all">All disputes</option>
                {disputes.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
              {filtered ? (
                <button
                  type="button"
                  onClick={() => {
                    setLane("all");
                    setEndpoint("all");
                    setStatus("all");
                    setDispute("all");
                  }}
                  className={buttonClass("ghost", "md")}
                >
                  <X className="size-3.5" /> Clear
                </button>
              ) : null}
            </div>
          </div>
          <ol className="scroll-thin max-h-[calc(100vh-240px)] min-h-[360px] overflow-y-auto">
            {shown.map((i) => {
              const L = LANE[i.lane];
              const Icon = i.error && !i.api ? TriangleAlert : L.icon;
              const body = (
                <>
                  {i.api ? (
                    <span className="pt-0.5">
                      <MethodTag method={i.api.method} />
                    </span>
                  ) : (
                    <span className="flex w-11 shrink-0 pt-0.5" title={L.label}>
                      <Icon className={clsx("size-4", i.error ? "text-red" : i.lane === "merchant" ? "text-ink" : "text-muted")} strokeWidth={1.7} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    {i.api ? <span className="mono block truncate text-[13px] leading-5 text-ink">{i.api.path}</span> : <span className={clsx("block text-[14px] leading-5", i.error ? "text-red" : "text-ink")}>{i.title}</span>}
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                      <span>{i.actor}</span>
                      {i.api?.debugId ? <span className="mono">debug {i.api.debugId}</span> : null}
                      {i.disputeId ? (
                        <Link href={`/app/disputes/${i.disputeId}`} onClick={(e) => e.stopPropagation()} className="mono rounded-[4px] text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
                          {i.disputeId}
                        </Link>
                      ) : null}
                      {i.orderId ? <span className="mono">{i.orderId}</span> : null}
                    </span>
                  </span>
                  {i.api ? (
                    <span className="flex shrink-0 items-center gap-2.5 pt-0.5">
                      <span className="mono text-[13px] text-muted">{i.api.ms} ms</span>
                      <StatusPill status={i.api.status} />
                    </span>
                  ) : null}
                  <span suppressHydrationWarning className="hidden w-[124px] shrink-0 pt-0.5 text-right text-[13px] text-muted sm:block">
                    {dateTime(i.at)}
                  </span>
                  {i.api ? <ChevronRight className="mt-1 size-3.5 shrink-0 text-ghost transition-colors group-hover:text-ink" /> : <span className="w-3.5 shrink-0" />}
                </>
              );
              return (
                <li key={i.id} className="border-b border-rule last:border-0">
                  {i.api ? (
                    <button type="button" onClick={() => setOpen(i.id)} className="group flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-hover">
                      {body}
                    </button>
                  ) : (
                    <div className="flex items-start gap-3 px-4 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
            {!shown.length ? <li className="px-4 py-12 text-center text-[13px] text-muted">{filtered ? "Nothing matches these filters." : "Nothing on record yet. Run Exhibit on a case and every call lands here."}</li> : null}
          </ol>
        </section>
      </div>
      <ApiInspector id={open} onClose={() => setOpen(null)} mode={mode} />
    </>
  );
}
