"use client";

import { clsx } from "clsx";
import { Fingerprint, Landmark, Loader2, MessagesSquare, Package, ScrollText, ShieldCheck, Truck, UserRound, type LucideIcon } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CaseBrief } from "@/lib/agent/brief";
import type { RunEvent } from "@/lib/agent/run";
import { usd } from "@/lib/format";
import { REASON_LABEL, type Dispute } from "@/lib/paypal/types";
import { plain } from "@/lib/plain";

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
export function sourceOf(ref: string): SourceId | null {
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

// A cited record is green whatever the call (the website's cited lines too); the hub names the call. The ring is
// green only for a fight Exhibit expects to win: a refund the merchant chooses is a fair outcome, never red.
const DECISION: Record<CaseBrief["decision"], { label: string; tone: Tone; ring: Tone; legend: string }> = {
  FIGHT: { label: "Fight", tone: "green", ring: "green", legend: "Cited to fight" },
  MESSAGE_BUYER: { label: "Message buyer", tone: "green", ring: "ink", legend: "Cited in the reply" },
  OFFER: { label: "Offer", tone: "green", ring: "ink", legend: "Cited for the offer" },
  REFUND: { label: "Refund", tone: "green", ring: "ink", legend: "Cited to refund" },
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
      for (const id of new Set(r.refs.map(sourceOf).filter((x): x is SourceId => !!x))) nodes[id].points.push(plain(r.point));
    }
  }
  if (done) for (const s of SOURCES) if (nodes[s.id].status === "idle") nodes[s.id].status = "skipped";
  return nodes;
}

type Edge = { id: SourceId; d: string };

export function EvidenceGraph({ dispute, events, brief, running, action, highlight, footer }: { dispute: Dispute; events: RunEvent[]; brief: CaseBrief | null; running: boolean; action?: React.ReactNode; highlight?: string | null; footer?: React.ReactNode }) {
  const done = !running && !!brief;
  // Streamed thinking arrives many times a second; only tool calls and results change the graph.
  const toolCount = useMemo(() => events.reduce((n, e) => n + (e.t === "tool_call" || e.t === "tool_result" ? 1 : 0), 0), [events]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed only when a tool event lands, by design
  const toolEvents = useMemo(() => events.filter((e) => e.t === "tool_call" || e.t === "tool_result"), [toolCount]);
  const nodes = useMemo(() => buildNodes(toolEvents, brief, done), [toolEvents, brief, done]);
  const [selected, setSelected] = useState<SourceId | null>(null);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [narrow, setNarrow] = useState(false);
  const [single, setSingle] = useState(false);
  const hl = highlight ? sourceOf(highlight) : null;
  const wrap = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const nodeEls = useRef<Partial<Record<SourceId, HTMLButtonElement | null>>>({});

  const layout = useCallback(() => {
    const w = wrap.current?.getBoundingClientRect();
    if (w) {
      setNarrow(w.width < 760);
      setSingle(w.width < 520);
    }
    const h = hub.current?.getBoundingClientRect();
    if (!w || !h || w.width < 760) return setEdges([]);
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
    if (n.status === "querying") return { stroke: "var(--ink)", width: 1.5, dash: "5 6", flow: true, opacity: 0.8 };
    if (n.exhibits.length || (done && n.points.length)) return { stroke: cite, width: 1.9, dash: undefined, flow: false, opacity: 1 };
    if (n.status === "found") return { stroke: "var(--ink-2)", width: 1.1, dash: undefined, flow: false, opacity: done ? 0.22 : 0.45 };
    if (n.status === "failed") return { stroke: "var(--red)", width: 1.1, dash: "3 4", flow: false, opacity: 0.5 };
    return { stroke: "var(--line-strong)", width: 1, dash: "3 5", flow: false, opacity: 1 };
  };

  return (
    <section className="card overflow-hidden border" aria-label="Evidence graph">
      <div className="flex min-h-12 items-center justify-between gap-4 px-5 py-2.5">
        <h2 className="flex min-w-0 items-baseline gap-2 text-[14px] font-semibold text-ink">
          Evidence graph
          <span className="truncate text-[13px] font-normal text-muted">
            {running ? `Querying sources, ${checked} of ${SOURCES.length} read` : brief ? `${brief.exhibits.length} exhibits from ${SOURCES.filter((s) => nodes[s.id].exhibits.length).length} sources` : "Every source Exhibit can check"}
          </span>
        </h2>
        {action}
      </div>

      <div ref={wrap} className="relative border-t border-line px-6 py-5">
        {/* The board: a faint dot grid drawn as an SVG pattern, under the wires. */}
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          <defs>
            <pattern id="eg-dots" width="18" height="18" patternUnits="userSpaceOnUse">
              <circle cx="9" cy="9" r="0.9" fill="#e3e3e1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#eg-dots)" />
        </svg>
        <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden>
          {edges.map((e) => {
            const s = edgeStyle(e.id);
            const dim = (selected && selected !== e.id) || (hl && hl !== e.id);
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

        <div className={clsx("relative grid items-center", single ? "grid-cols-1 gap-2.5" : narrow ? "grid-cols-2 gap-2.5" : "grid-cols-[minmax(0,1fr)_188px_minmax(0,1fr)] gap-x-[clamp(48px,7vw,120px)]")}>
          {(["l", "r"] as const).map((side) => (
            <div key={side} className={clsx("grid w-full gap-2.5", single ? "col-span-1" : narrow ? "col-span-1 row-start-2" : "max-w-[340px] row-start-1", !narrow && (side === "l" ? "col-start-1 justify-self-end" : "col-start-3 justify-self-start"))}>
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
                  active={selected === s.id || hl === s.id}
                  dim={(!!selected && selected !== s.id) || (!!hl && hl !== s.id)}
                  onClick={() => setSelected(selected === s.id ? null : s.id)}
                />
              ))}
            </div>
          ))}

          <div ref={hub} className={clsx("flex flex-col items-center justify-center rounded-[10px] border border-line-strong bg-surface px-4 py-4 text-center", single ? "row-start-1" : narrow ? "col-span-2 row-start-1" : "col-start-2 row-start-1")}>
            {brief && !running && verdict ? (
              <>
                <Ring value={brief.win_likelihood} color={TONE[verdict.ring]} />
                <div className="mt-2 rounded-[6px] bg-ink px-2 py-0.5 text-[13px] font-semibold text-white">{verdict.label}</div>
                <div className="mt-1.5 text-[12px] leading-snug text-muted">{brief.decision === "FIGHT" ? "likely to win" : brief.decision === "REFUND" ? "chance if fought" : "win likelihood"}</div>
              </>
            ) : (
              <>
                <div className="text-[12px] text-muted">The claim</div>
                <div className="mt-0.5 text-[14px] font-semibold leading-tight">{REASON_LABEL[dispute.reason]}</div>
                <div className="mono mt-1.5 text-[16px] leading-none">{usd(amount)}</div>
                <div className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
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
                    <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${(checked / SOURCES.length) * 100}%` }} />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>

      {footer}
      <div className="min-h-12 border-t border-line px-5 py-3">
        {sel && selNode ? (
          <div className="grid gap-2 text-[13px]">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{sel.title}</span>
              <span className="text-muted">{sel.system}</span>
              {selNode.summary ? <span className="text-ink-2">· {selNode.summary}</span> : null}
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
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[12px] text-muted">
            {verdict && done ? (
              <>
                <Legend color={cite} label={verdict.legend} />
                <Legend color="var(--ink-2)" faint label="Read, not cited" />
              </>
            ) : (
              <>
                <Legend color="var(--ink)" dash label="Querying" />
                <Legend color="var(--ink-2)" faint label="Read" />
              </>
            )}
            <Legend color="var(--line-strong)" dash label="Not queried" />
            <span className="ml-auto">{brief ? "Select a source to see how the agent used it." : "Each wire is a real record the agent may cite. It can't cite anything else."}</span>
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
  const read = node.status === "found" || node.status === "failed";
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "group relative flex min-w-0 items-center gap-2.5 rounded-[10px] border bg-surface px-3 py-2 text-left transition-[opacity,border-color,box-shadow] duration-300",
        source.side === "r" && "flex-row-reverse text-right",
        node.status === "idle" || node.status === "skipped" ? "border-dashed border-line-strong" : "border-line",
        node.status === "querying" && "border-ink shadow-[0_0_0_3px_rgb(10_10_10/0.06)]",
        cited && (tone === "green" ? "border-green/40" : tone === "red" ? "border-red/40" : "border-ink/30"),
        active && "border-ink shadow-[0_0_0_1px_var(--ink)]",
        dim && "opacity-40",
        node.status === "skipped" && !active && "opacity-60",
        "hover:border-line-strong",
      )}
    >
      {/* Node-type tiles: the icon names the source, the fill says whether it was cited (ink), read (grey) or not queried (outline). */}
      <span className={clsx("flex size-8 shrink-0 items-center justify-center rounded-[8px] border transition-colors duration-300", read ? (cited ? "border-ink bg-ink text-white" : "border-line bg-sunken text-ink-2") : "border-line bg-surface text-ghost", node.status === "querying" && "border-ink/30 text-ink")}>
        {node.status === "querying" ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" strokeWidth={1.8} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={clsx("flex items-baseline gap-1.5", source.side === "r" && "flex-row-reverse")}>
          <span className="truncate text-[13px] font-medium leading-[18px]">{source.title}</span>
          {node.ms !== undefined && node.ms > 20 ? <span className="mono shrink-0 text-[11px] text-faint">{node.ms} ms</span> : null}
        </span>
        <span className={clsx("block truncate text-[12px] leading-[17px]", node.summary ? "text-ink-2" : "text-muted")}>
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
  return <span className={clsx("flex size-[18px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ring-2 ring-surface", tone === "green" ? "bg-green" : tone === "red" ? "bg-red" : "bg-ink")}>{label}</span>;
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
      <span className="num absolute inset-0 flex items-center justify-center text-[16px] font-semibold">{value}%</span>
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
