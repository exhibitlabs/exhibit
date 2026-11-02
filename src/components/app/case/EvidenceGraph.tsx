"use client";

import { clsx } from "clsx";
import { Fingerprint, Landmark, Loader2, MessagesSquare, Package, ScrollText, ShieldCheck, Truck, UserRound, type LucideIcon } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CaseBrief } from "@/lib/agent/brief";
import type { RunEvent } from "@/lib/agent/run";
import { usd } from "@/lib/format";
import { REASON_LABEL, type Dispute } from "@/lib/paypal/types";

type SourceId = "paypal" | "order" | "carrier" | "customer" | "risk" | "inbox" | "policies" | "protection";

const SOURCES: { id: SourceId; tool: string; title: string; system: string; icon: LucideIcon; side: "l" | "r" }[] = [
  { id: "paypal", tool: "get_paypal_dispute", title: "The dispute", system: "PayPal Disputes API", icon: Landmark, side: "l" },
  { id: "order", tool: "lookup_order", title: "Order & listing", system: "Store", icon: Package, side: "l" },
  { id: "carrier", tool: "get_carrier_tracking", title: "Delivery", system: "Carrier scans", icon: Truck, side: "l" },
  { id: "customer", tool: "get_customer_history", title: "Buyer history", system: "Store", icon: UserRound, side: "l" },
  { id: "risk", tool: "get_payment_risk_signals", title: "Checkout signals", system: "Payments risk", icon: Fingerprint, side: "r" },
  { id: "inbox", tool: "get_support_conversation", title: "Buyer messages", system: "Support inbox", icon: MessagesSquare, side: "r" },
  { id: "policies", tool: "get_store_policies", title: "Store policies", system: "Accepted at checkout", icon: ScrollText, side: "r" },
  { id: "protection", tool: "check_seller_protection", title: "Seller Protection", system: "PayPal rulebook", icon: ShieldCheck, side: "r" },
];

/** Which source an evidence ref came from. Refs are the agent's only way to cite anything. */
function sourceOf(ref: string): SourceId | null {
  const [ns, sub] = ref.split(":");
  if (ns === "paypal") return sub === "seller-protection" ? "protection" : "paypal";
  if (ns === "order" || ns === "listing") return "order";
  if (ns === "shipment") return "carrier";
  if (ns === "customer") return "customer";
  if (ns === "risk") return "risk";
  if (ns === "msg" || ns === "conversation") return "inbox";
  if (ns === "policy") return "policies";
  return null;
}

type NodeState = { status: "idle" | "querying" | "found" | "failed" | "skipped"; summary?: string; ms?: number; exhibits: CaseBrief["exhibits"]; points: string[] };

// Cited lines take the colour of the call the evidence supports.
const DECISION: Record<CaseBrief["decision"], { label: string; tone: Tone; legend: string }> = {
  FIGHT: { label: "Fight", tone: "green", legend: "Cited to fight" },
  MESSAGE_BUYER: { label: "Message buyer", tone: "ink", legend: "Cited in the reply" },
  OFFER: { label: "Offer", tone: "ink", legend: "Cited for the offer" },
  REFUND: { label: "Refund", tone: "red", legend: "Cited to refund" },
};
type Tone = "green" | "red" | "ink";
const TONE: Record<Tone, string> = { green: "var(--green)", red: "var(--red)", ink: "var(--ink)" };

function buildNodes(events: RunEvent[], brief: CaseBrief | null, done: boolean) {
  const nodes = Object.fromEntries(SOURCES.map((s) => [s.id, { status: "idle", exhibits: [], points: [] } as NodeState])) as Record<SourceId, NodeState>;
  const byCall = new Map<string, SourceId>();
  for (const e of events) {
    if (e.t === "tool_call") {
      const s = SOURCES.find((x) => x.tool === e.name);
      if (!s) continue;
      byCall.set(e.id, s.id);
      if (nodes[s.id].status === "idle") nodes[s.id].status = "querying";
    } else if (e.t === "tool_result") {
      const id = byCall.get(e.id);
      if (!id) continue;
      // A source can be queried more than once (a duplicate-charge case looks up two orders): keep the first good result so a later empty lookup can't overwrite it.
      if (nodes[id].status === "found" || (nodes[id].status === "failed" && !e.ok)) continue;
      nodes[id] = { ...nodes[id], status: e.ok ? "found" : "failed", summary: e.summary, ms: e.ms };
    }
  }
  if (brief) {
    for (const x of brief.exhibits) {
      const id = sourceOf(x.ref);
      if (id) nodes[id].exhibits.push(x);
    }
    for (const r of brief.reasoning) {
      for (const id of new Set(r.refs.map(sourceOf).filter((x): x is SourceId => !!x))) nodes[id].points.push(r.point);
    }
  }
  if (done) for (const s of SOURCES) if (nodes[s.id].status === "idle") nodes[s.id].status = "skipped";
  return nodes;
}

type Edge = { id: SourceId; d: string };

export function EvidenceGraph({ dispute, events, brief, running, action }: { dispute: Dispute; events: RunEvent[]; brief: CaseBrief | null; running: boolean; action?: React.ReactNode }) {
  const done = !running && !!brief;
  const nodes = useMemo(() => buildNodes(events, brief, done), [events, brief, done]);
  const [selected, setSelected] = useState<SourceId | null>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const wrap = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const nodeEls = useRef<Partial<Record<SourceId, HTMLButtonElement | null>>>({});

  const layout = useCallback(() => {
    const w = wrap.current?.getBoundingClientRect();
    const h = hub.current?.getBoundingClientRect();
    if (!w || !h) return;
    const cy = h.top + h.height / 2 - w.top;
    const next: Edge[] = [];
    for (const s of SOURCES) {
      const r = nodeEls.current[s.id]?.getBoundingClientRect();
      if (!r) continue;
      const y1 = r.top + r.height / 2 - w.top;
      const x1 = s.side === "l" ? r.right - w.left : r.left - w.left;
      const x2 = s.side === "l" ? h.left - w.left : h.right - w.left;
      const y2 = cy + (y1 - cy) * 0.22;
      const mx = (x1 + x2) / 2;
      next.push({ id: s.id, d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` });
    }
    setEdges(next);
  }, []);

  useLayoutEffect(() => {
    layout();
    const ro = new ResizeObserver(layout);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [layout, nodes]);

  const verdict = brief ? DECISION[brief.decision] : null;
  const tone: Tone = verdict?.tone ?? "green";
  const cite = TONE[tone];
  const checked = SOURCES.filter((s) => nodes[s.id].status === "found" || nodes[s.id].status === "failed").length;
  const amount = Number(dispute.dispute_amount.value);
  const sel = selected ? SOURCES.find((s) => s.id === selected)! : null;
  const selNode = selected ? nodes[selected] : null;

  const edgeStyle = (id: SourceId) => {
    const n = nodes[id];
    if (n.status === "querying") return { stroke: "var(--amber)", width: 1.6, dash: "5 6", flow: true, opacity: 1 };
    if (n.exhibits.length || (done && n.points.length)) return { stroke: cite, width: 1.9, dash: undefined, flow: false, opacity: 1 };
    if (n.status === "found") return { stroke: "var(--ink-2)", width: 1.1, dash: undefined, flow: false, opacity: done ? 0.22 : 0.45 };
    if (n.status === "failed") return { stroke: "var(--red)", width: 1.1, dash: "3 4", flow: false, opacity: 0.5 };
    return { stroke: "var(--line-strong)", width: 1, dash: "3 5", flow: false, opacity: 1 };
  };

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-3.5">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          Evidence graph
          <span className="font-normal text-muted">
            {running ? `· querying sources · ${checked} of ${SOURCES.length} read` : brief ? `· ${brief.exhibits.length} exhibits from ${SOURCES.filter((s) => nodes[s.id].exhibits.length).length} sources` : "· every source Exhibit can check"}
          </span>
        </div>
        {action}
      </div>

      <div ref={wrap} className="relative border-t border-line bg-[radial-gradient(circle_at_center,#e9e9e9_1px,transparent_1px)] bg-[length:18px_18px] px-6 py-7">
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          {edges.map((e) => {
            const s = edgeStyle(e.id);
            const dim = selected && selected !== e.id;
            return (
              <path
                key={e.id}
                d={e.d}
                fill="none"
                stroke={s.stroke}
                strokeWidth={s.width}
                strokeDasharray={s.dash}
                strokeLinecap="round"
                opacity={dim ? 0.12 : s.opacity}
                className={clsx("transition-[opacity,stroke] duration-500", s.flow && "edge-flow")}
              />
            );
          })}
        </svg>

        <div className="relative grid grid-cols-[minmax(0,1fr)_196px_minmax(0,1fr)] items-center gap-x-[clamp(48px,7vw,120px)]">
          {(["l", "r"] as const).map((side) => (
            <div key={side} className={clsx("grid w-full max-w-[340px] gap-3", side === "l" ? "col-start-1 row-start-1 justify-self-end" : "col-start-3 row-start-1 justify-self-start")}>
              {SOURCES.filter((s) => s.side === side).map((s) => (
                <SourceNode
                  key={s.id}
                  ref={(el) => {
                    nodeEls.current[s.id] = el;
                  }}
                  source={s}
                  node={nodes[s.id]}
                  tone={tone}
                  done={done}
                  active={selected === s.id}
                  dim={!!selected && selected !== s.id}
                  onClick={() => setSelected(selected === s.id ? null : s.id)}
                />
              ))}
            </div>
          ))}

          <div ref={hub} className="col-start-2 row-start-1 flex flex-col items-center justify-center rounded-2xl border border-line-strong bg-surface px-4 py-5 text-center shadow-[0_8px_30px_rgb(0_0_0/0.06)]">
            {brief && !running && verdict ? (
              <>
                <Ring value={brief.win_likelihood} color={cite} />
                <div className="mt-2 rounded-md bg-ink px-2 py-0.5 text-[12.5px] font-semibold text-white">{verdict.label}</div>
                <div className="mt-1.5 text-[11px] leading-snug text-muted">{brief.decision === "FIGHT" ? "likely to win" : brief.decision === "REFUND" ? "chance if fought" : "win likelihood"}</div>
              </>
            ) : (
              <>
                <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-faint">The claim</div>
                <div className="mt-1 text-[14px] font-semibold leading-tight">{REASON_LABEL[dispute.reason]}</div>
                <div className="num mt-1 text-[18px] leading-none">{usd(amount)}</div>
                <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted">
                  {running ? (
                    <>
                      <Loader2 className="size-3 animate-spin" /> Investigating
                    </>
                  ) : (
                    dispute.disputed_transactions[0]?.buyer?.name ?? "Buyer"
                  )}
                </div>
                {running ? (
                  <div className="mt-2.5 h-1 w-24 overflow-hidden rounded-full bg-sunken">
                    <div className="h-full rounded-full bg-amber transition-[width] duration-500" style={{ width: `${(checked / SOURCES.length) * 100}%` }} />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-[68px] border-t border-line px-5 py-3.5">
        {sel && selNode ? (
          <div className="rise grid gap-2 text-[12.5px]">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{sel.title}</span>
              <span className="text-faint">{sel.system}</span>
              {selNode.summary ? <span className="num text-ink-2">· {selNode.summary}</span> : null}
            </div>
            {selNode.exhibits.map((x) => (
              <div key={x.label} className="flex gap-2.5">
                <ExhibitBadge label={x.label} tone={tone} />
                <div className="min-w-0">
                  <span className="text-ink">{x.title}.</span> <span className="text-muted">{x.why}</span>
                </div>
              </div>
            ))}
            {selNode.points.slice(0, 2).map((p) => (
              <p key={p} className="border-l-2 border-line pl-3 leading-relaxed text-muted">
                {p}
              </p>
            ))}
            {!selNode.exhibits.length && !selNode.points.length ? (
              <p className="text-muted">{selNode.status === "skipped" ? "Not queried: it could not change the decision on this case." : selNode.status === "idle" || selNode.status === "querying" ? "Not read yet." : "Read, but not cited in the brief."}</p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-muted">
            {verdict && done ? (
              <>
                <Legend color={cite} label={verdict.legend} />
                <Legend color="var(--ink-2)" faint label="Read, not cited" />
              </>
            ) : (
              <>
                <Legend color="var(--amber)" dash label="Querying" />
                <Legend color="var(--ink-2)" faint label="Read" />
              </>
            )}
            <Legend color="var(--line-strong)" dash label="Not queried" />
            <span className="ml-auto text-faint">{brief ? "Click a source to see how the agent used it." : "Each line is a real record the agent may cite. It cannot cite anything else."}</span>
          </div>
        )}
      </div>
    </section>
  );
}

function SourceNode({
  ref,
  source,
  node,
  tone,
  done,
  active,
  dim,
  onClick,
}: {
  ref: (el: HTMLButtonElement | null) => void;
  source: (typeof SOURCES)[number];
  node: NodeState;
  tone: Tone;
  done: boolean;
  active: boolean;
  dim: boolean;
  onClick: () => void;
}) {
  const Icon = source.icon;
  const cited = node.exhibits.length > 0;
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={clsx(
        "group relative flex min-w-0 items-center gap-2.5 rounded-xl border bg-surface px-3 py-2.5 text-left transition-all duration-300",
        source.side === "r" && "flex-row-reverse text-right",
        node.status === "idle" || node.status === "skipped" ? "border-dashed border-line-strong" : "border-line",
        node.status === "querying" && "border-amber shadow-[0_0_0_3px_rgb(232_163_61/0.15)]",
        cited && (tone === "green" ? "border-green/40" : tone === "red" ? "border-red/40" : "border-ink/30"),
        active && "ring-2 ring-ink/80",
        dim && "opacity-40",
        node.status === "skipped" && !active && "opacity-55",
        "hover:-translate-y-px hover:shadow-[0_4px_14px_rgb(0_0_0/0.06)]",
      )}
    >
      <span
        className={clsx(
          "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-300",
          node.status === "found" || node.status === "failed" ? (cited ? "border-ink bg-ink text-white" : "border-line bg-sunken text-ink-2") : "border-line bg-surface text-faint",
          node.status === "querying" && "border-amber/50 bg-amber/10 text-ink",
        )}
      >
        {node.status === "querying" ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" strokeWidth={1.9} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx("flex items-center gap-1.5", source.side === "r" && "flex-row-reverse")}>
          <span className="truncate text-[12.5px] font-medium leading-tight">{source.title}</span>
          {node.ms !== undefined && node.ms > 20 ? <span className="num shrink-0 text-[10px] text-faint">{node.ms}ms</span> : null}
        </span>
        <span className={clsx("mt-0.5 block truncate text-[11px] leading-tight", node.summary ? "text-ink-2" : "text-faint")}>
          {node.status === "querying" ? "Querying…" : node.summary ?? (node.status === "skipped" || (done && node.status === "idle") ? "Skipped" : source.system)}
        </span>
      </span>
      {cited ? (
        <span className={clsx("absolute -top-2 flex gap-0.5", source.side === "l" ? "-right-2" : "-left-2")}>
          {node.exhibits.map((x) => (
            <ExhibitBadge key={x.label} label={x.label} tone={tone} />
          ))}
        </span>
      ) : null}
    </button>
  );
}

function ExhibitBadge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={clsx("rise num flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-sm", tone === "green" ? "bg-green" : tone === "red" ? "bg-red" : "bg-ink")}>{label}</span>;
}

function Ring({ value, color }: { value: number; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-[68px]">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--sunken)" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)} className="ring-fill" />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-[17px] font-medium">{value}%</span>
    </div>
  );
}

function Legend({ color, label, dash, faint }: { color: string; label: string; dash?: boolean; faint?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="18" height="6" aria-hidden>
        <line x1="1" y1="3" x2="17" y2="3" stroke={color} strokeWidth="2" strokeDasharray={dash ? "3 3" : undefined} strokeLinecap="round" opacity={faint ? 0.35 : 1} />
      </svg>
      {label}
    </span>
  );
}
