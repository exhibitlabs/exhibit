"use client";

import { useMemo, useState } from "react";
import type { PreventionOrder, PreventionSignalKind } from "@/lib/prevention";
import { BAND, bandOf, money, SIGNAL_ICON, SIGNAL_ORDER } from "./PreventionParts";

const W = 520;
const H = 420;
const CX = W / 2;
const CY = H / 2;
const R = 156;
const SPAN = 360 / SIGNAL_ORDER.length;
const RADAR_LABEL: Record<PreventionSignalKind, string> = {
  tracking_not_on_paypal: "No PayPal tracking",
  tracking_stalled: "Stalled",
  buyer_waiting: "Buyer waiting",
  refund_overdue: "Refund overdue",
  address_mismatch: "Wrong address",
  unsigned_high_value: "No signature",
  weak_checkout: "Weak checkout",
};

/** Score → distance from the centre: the closer to the middle, the closer to a dispute. */
const radiusFor = (score: number) => R * (0.1 + 0.78 * (1 - score / 100));
const RING = { high: radiusFor(65), elevated: radiusFor(40), watch: radiusFor(15), prevented: R * 0.95 };

const polar = (deg: number, r: number) => {
  const a = (deg * Math.PI) / 180;
  // Rounded: the dots position via inline CSS transform, and the browser re-serialises long floats, which trips hydration.
  const round = (n: number) => Math.round(n * 100) / 100;
  return { x: round(CX + r * Math.cos(a)), y: round(CY + r * Math.sin(a)) };
};

function kindOf(o: PreventionOrder): PreventionSignalKind {
  return o.top?.kind ?? (o.history.find((h) => h.before.signals.length)?.before.signals[0] as PreventionSignalKind | undefined) ?? "tracking_not_on_paypal";
}

type Dot = { o: PreventionOrder; x: number; y: number; r: number; color: string; kind: PreventionSignalKind };

export function PreventionRadar({
  orders,
  selectedId,
  onSelect,
  filter,
  onFilter,
  leaving,
}: {
  orders: PreventionOrder[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filter: PreventionSignalKind | null;
  onFilter: (k: PreventionSignalKind | null) => void;
  leaving: Set<string>;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const counts = useMemo(() => {
    const m = new Map<PreventionSignalKind, number>();
    for (const o of orders) if (o.status === "at_risk") for (const s of o.signals) m.set(s.kind, (m.get(s.kind) ?? 0) + 1);
    return m;
  }, [orders]);

  const dots = useMemo<Dot[]>(() => {
    const shown = orders.filter((o) => o.status === "at_risk" || o.status === "prevented");
    const bySector = new Map<PreventionSignalKind, PreventionOrder[]>();
    for (const o of shown) {
      const k = kindOf(o);
      bySector.set(k, [...(bySector.get(k) ?? []), o]);
    }
    const out: Dot[] = [];
    for (const [k, list] of bySector) {
      const i = SIGNAL_ORDER.indexOf(k);
      const start = -90 + i * SPAN;
      list
        .sort((a, b) => a.orderId.localeCompare(b.orderId))
        .forEach((o, j) => {
          const prevented = o.status === "prevented" || leaving.has(o.orderId);
          const angle = start + SPAN * ((j + 1) / (list.length + 1));
          // Stagger neighbours in the same band so dots never stack.
          const jitter = list.length > 2 ? (j % 2 ? 7 : -7) : 0;
          const p = polar(angle, prevented ? RING.prevented : radiusFor(o.score) + jitter);
          out.push({ o, ...p, r: prevented ? 5 : Math.min(13, 4.5 + Math.sqrt(o.exposure) / 3.4), color: prevented ? BAND.prevented.color : BAND[bandOf(o)].color, kind: k });
        });
    }
    return out;
  }, [orders, leaving]);

  const hovered = dots.find((d) => d.o.orderId === hover);

  return (
    <div className="relative mx-auto w-full max-w-[520px] select-none">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full">
        <defs>
          <radialGradient id="pv-core">
            <stop offset="0%" stopColor="#dc2626" stopOpacity="0.09" />
            <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="pv-sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0a0a0a" stopOpacity="0" />
            <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0.07" />
          </linearGradient>
        </defs>

        {/* Sector highlight for the active filter */}
        {SIGNAL_ORDER.map((k, i) => {
          if (filter !== k) return null;
          const a0 = polar(-90 + i * SPAN, R);
          const a1 = polar(-90 + (i + 1) * SPAN, R);
          return <path key={k} d={`M${CX},${CY} L${a0.x},${a0.y} A${R},${R} 0 0 1 ${a1.x},${a1.y} Z`} fill="#0a0a0a" fillOpacity="0.035" />;
        })}

        <circle cx={CX} cy={CY} r={RING.high} fill="url(#pv-core)" />
        {[RING.high, RING.elevated, RING.watch].map((r, i) => (
          <circle key={r} cx={CX} cy={CY} r={r} fill="none" stroke={i === 0 ? "#f3d0d0" : "#ebebeb"} strokeDasharray={i === 2 ? "2 4" : undefined} />
        ))}
        <circle cx={CX} cy={CY} r={RING.prevented} fill="none" stroke="#dcfce7" strokeWidth="7" />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e5e5e5" />

        {SIGNAL_ORDER.map((k, i) => {
          const p = polar(-90 + i * SPAN, R);
          return <line key={k} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#f0f0f0" />;
        })}

        {/* Band labels along the 12 o'clock spoke */}
        {[
          ["HIGH", RING.high],
          ["ELEVATED", RING.elevated],
          ["WATCH", RING.watch],
        ].map(([label, r]) => (
          <text key={label} x={CX + 4} y={CY - (r as number) + 11} className="num" fontSize="8.5" letterSpacing="0.08em" fill={label === "HIGH" ? "#d48a8a" : "#b5b5b5"}>
            {label}
          </text>
        ))}

        {/* Sweep */}
        <g className="pv-sweep" style={{ transformOrigin: `${CX}px ${CY}px` }}>
          <path d={`M${CX},${CY} L${polar(-40, R).x},${polar(-40, R).y} A${R},${R} 0 0 1 ${polar(0, R).x},${polar(0, R).y} Z`} fill="url(#pv-sweep)" />
          <line x1={CX} y1={CY} x2={polar(0, R).x} y2={polar(0, R).y} stroke="#0a0a0a" strokeOpacity="0.12" />
        </g>

        {/* Sector labels */}
        {SIGNAL_ORDER.map((k, i) => {
          const mid = -90 + (i + 0.5) * SPAN;
          const p = polar(mid, R + 16);
          const cos = Math.cos((mid * Math.PI) / 180);
          const anchor = Math.abs(cos) < 0.25 ? "middle" : cos > 0 ? "start" : "end";
          const n = counts.get(k) ?? 0;
          const active = filter === k;
          return (
            <g key={k} className="cursor-pointer" onClick={() => onFilter(active ? null : k)}>
              <text x={p.x} y={p.y} textAnchor={anchor} dominantBaseline="middle" fontSize="11.5" fontWeight={active ? 600 : 500} fill={active ? "#0a0a0a" : n ? "#3f3f3f" : "#b5b5b5"}>
                {RADAR_LABEL[k]}
                <tspan className="num" dx="5" fill={n ? (active ? "#0a0a0a" : "#a1a1a1") : "#d4d4d4"}>
                  {n}
                </tspan>
              </text>
            </g>
          );
        })}

        <circle cx={CX} cy={CY} r="2.5" fill="#0a0a0a" />

        {dots.map((d) => {
          const selected = d.o.orderId === selectedId;
          const dim = filter && !d.o.signals.some((s) => s.kind === filter) && d.o.status === "at_risk";
          return (
            <g
              key={d.o.orderId}
              style={{ transform: `translate(${d.x}px, ${d.y}px)`, transition: "transform 1s cubic-bezier(0.22,1,0.36,1), opacity 0.3s", opacity: dim ? 0.18 : 1 }}
              className="cursor-pointer"
              onMouseEnter={() => setHover(d.o.orderId)}
              onMouseLeave={() => setHover(null)}
              onClick={() => d.o.status === "at_risk" && onSelect(d.o.orderId)}
            >
              {selected ? <circle r={d.r + 7} fill="none" stroke={d.color} strokeOpacity="0.5" className="pv-ping" /> : null}
              {d.o.band === "high" && d.o.status === "at_risk" ? <circle r={d.r + 4} fill={d.color} fillOpacity="0.12" /> : null}
              <circle r={d.r} fill={d.color} stroke="#fff" strokeWidth="2" style={{ transition: "r 0.6s, fill 0.4s" }} />
              {d.o.status === "prevented" ? <path d="M-2.2,0.2 L-0.6,1.8 L2.4,-1.6" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
            </g>
          );
        })}
      </svg>

      {hovered ? (
        <div
          className="pointer-events-none absolute z-10 w-[220px] -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-lg border border-line bg-surface px-3 py-2.5 shadow-[0_8px_24px_rgb(0_0_0/0.08)]"
          style={{ left: `${(hovered.x / W) * 100}%`, top: `${(hovered.y / H) * 100}%` }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-medium">{hovered.o.buyer}</span>
            <span className="num text-[12px]" style={{ color: hovered.o.status === "prevented" ? BAND.prevented.text : BAND[bandOf(hovered.o)].text }}>
              {hovered.o.status === "prevented" ? "prevented" : hovered.o.score}
            </span>
          </div>
          <div className="num mt-0.5 text-[11px] text-faint">
            {hovered.o.orderId} · {money(hovered.o.exposure)} exposure
          </div>
          {hovered.o.top ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-[12px] text-ink-2">
              {(() => {
                const Icon = SIGNAL_ICON[hovered.o.top.kind];
                return <Icon className="size-3.5 text-muted" />;
              })()}
              {hovered.o.top.label} → {hovered.o.top.reasonLabel}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="-mt-1 flex justify-center gap-4 text-[11.5px] text-muted">
        {(["high", "elevated", "watch", "prevented"] as const).map((b) => (
          <span key={b} className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: BAND[b].color }} />
            {BAND[b].label}
          </span>
        ))}
        <span className="text-faint">· size = $ exposure</span>
      </div>
    </div>
  );
}
