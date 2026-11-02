"use client";

import { clsx } from "clsx";
import { Bot, ChevronRight, Database, Download, Landmark, Lock, TriangleAlert, User, Webhook, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Lane, TimelineItem } from "@/lib/activity";
import { dateTime } from "@/lib/format";
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
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-8 max-w-[240px] rounded-lg border border-line bg-surface px-2 text-[12.5px] text-ink-2 outline-none transition-colors hover:border-line-strong focus:border-ink-2">
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
        eyebrow="Audit trail"
        title="PayPal activity"
        subtitle="Every PayPal API call Exhibit makes, with its request, response and debug id, beside every decision by the agent, the merchant and PayPal's webhooks. Nothing happens off the record."
        actions={
          <a href="/api/activity" target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-[#fafafa]">
            <Download className="size-3.5" /> Export JSON
          </a>
        }
      />
      <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            ["PayPal calls", String(api.length), mode === "demo" ? "to the simulator, same shapes as live" : "to api-m.sandbox.paypal.com"],
            ["Endpoints used", String(surface.length), "Disputes, Orders, Payments, OAuth"],
            ["Errors", String(errors), errors ? "click one to see PayPal's response" : "no failed calls in this log"],
            ["Median latency", `${p50} ms`, mode === "demo" ? "simulated network latency" : "measured round trip"],
          ].map(([k, v, h]) => (
            <div key={k} className="card px-4 py-3.5">
              <div className="text-[12px] text-muted">{k}</div>
              <div className={clsx("mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums", k === "Errors" && errors ? "text-red" : "text-ink")}>{v}</div>
              <div className="mt-1.5 truncate text-[12px] text-faint">{h}</div>
            </div>
          ))}
        </div>

        <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="card overflow-hidden">
              <div className="border-b border-line px-4 py-3 text-[13px] font-medium">API surface</div>
              <ul className="divide-y divide-line/70">
                {surface.map(([k, v]) => (
                  <li key={k}>
                    <button type="button" onClick={() => setEndpoint(endpoint === k ? "all" : k)} className={clsx("flex w-full items-center gap-2 px-4 py-2 text-left text-[12px] transition-colors hover:bg-[#fafafa]", endpoint === k && "bg-sunken")}>
                      <MethodTag method={v.method} />
                      <span className="num min-w-0 flex-1 truncate text-ink-2" title={v.endpoint}>
                        {v.endpoint}
                      </span>
                      <span className="num text-ink">{v.count}</span>
                      {v.errors ? <span className="num text-red">{v.errors}!</span> : null}
                    </button>
                  </li>
                ))}
                {!surface.length ? <li className="px-4 py-4 text-[12.5px] text-muted">No calls yet.</li> : null}
              </ul>
            </section>
            <div className="flex gap-2.5 rounded-xl border border-line px-4 py-3 text-[12px] leading-relaxed text-muted">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-ink-2" />
              <span>Secrets never reach this log: the Authorization header isn&apos;t stored, and tokens, client secrets and card numbers are masked before anything is written.</span>
            </div>
          </aside>

          <section className="card min-w-0 overflow-hidden">
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
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] text-muted hover:bg-sunken hover:text-ink"
                  >
                    <X className="size-3.5" /> Clear
                  </button>
                ) : null}
              </div>
            </div>
            <ol className="scroll-thin max-h-[calc(100vh-260px)] min-h-[360px] overflow-y-auto">
              {shown.map((i) => {
                const L = LANE[i.lane];
                const Icon = i.error && !i.api ? TriangleAlert : L.icon;
                const body = (
                  <>
                    <span className={clsx("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border", i.lane === "api" ? "border-line bg-sunken text-ink-2" : i.lane === "merchant" ? "border-ink/25 bg-surface text-ink" : i.error ? "border-red/30 bg-red-soft text-red" : "border-line bg-surface text-ink-2")}>
                      <Icon className="size-3" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      {i.api ? (
                        <span className="flex min-w-0 items-center gap-2">
                          <MethodTag method={i.api.method} />
                          <span className="num min-w-0 truncate text-[12.5px] text-ink">{i.api.path}</span>
                        </span>
                      ) : (
                        <span className={clsx("block text-[12.5px] leading-snug", i.error ? "text-red" : "text-ink")}>{i.title}</span>
                      )}
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted">
                        <span>{i.actor}</span>
                        {i.api?.debugId ? <span className="num text-faint">debug {i.api.debugId}</span> : null}
                        {i.disputeId ? (
                          <Link href={`/app/disputes/${i.disputeId}`} onClick={(e) => e.stopPropagation()} className="num text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
                            {i.disputeId}
                          </Link>
                        ) : null}
                        {i.orderId ? <span className="num text-faint">{i.orderId}</span> : null}
                      </span>
                    </span>
                    {i.api ? (
                      <span className="flex shrink-0 items-center gap-2.5 pt-0.5">
                        <span className="num text-[11.5px] text-faint">{i.api.ms}ms</span>
                        <StatusPill status={i.api.status} />
                      </span>
                    ) : null}
                    <span suppressHydrationWarning className="hidden w-[118px] shrink-0 pt-0.5 text-right text-[11.5px] text-faint sm:block">
                      {dateTime(i.at)}
                    </span>
                    {i.api ? <ChevronRight className="mt-1 size-3.5 shrink-0 text-line-strong transition-colors group-hover:text-ink" /> : <span className="w-3.5 shrink-0" />}
                  </>
                );
                return (
                  <li key={i.id} className="border-b border-line/70 last:border-0">
                    {i.api ? (
                      <button type="button" onClick={() => setOpen(i.id)} className="group flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#fafafa]">
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
      </div>
      <ApiInspector id={open} onClose={() => setOpen(null)} mode={mode} />
    </>
  );
}
