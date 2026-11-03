"use client";

import { clsx } from "clsx";
import { Fingerprint, Landmark, MessagesSquare, Package, ScrollText, ShieldCheck, Truck, UserRound, type LucideIcon } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { UiPill, UiRing } from "../ui";
import type { SourceId, SourceState } from "./data";

// The app's evidence graph (src/components/app/case/EvidenceGraph.tsx) for one recorded run, rebuilt with the same
// layout, states and wiring: three columns from 760 px, two below, one under 520 px; the wires are measured from
// the nodes, as the app measures them. Selecting a source dims the others and shows, in the footer, what the agent
// got from it and how the brief used it, as the app's own footer does.

const ICON: Record<SourceId, LucideIcon> = {
  paypal: Landmark,
  order: Package,
  carrier: Truck,
  customer: UserRound,
  risk: Fingerprint,
  inbox: MessagesSquare,
  policies: ScrollText,
  protection: ShieldCheck,
};

type Edge = { id: SourceId; d: string };
type Wire = "cite" | "read" | "skip";
const wireOf = (s: SourceState): Wire => (s.exhibit || s.points.length ? "cite" : s.step ? "read" : "skip");
const STROKE: Record<Wire, { stroke: string; width: number; opacity: number; dash?: string }> = {
  cite: { stroke: "#15803d", width: 1.9, opacity: 1 },
  read: { stroke: "#3d3d3c", width: 1.1, opacity: 0.22 },
  skip: { stroke: "#dcdcda", width: 1, opacity: 1, dash: "3 5" },
};

// Server render: the wires for a 1092 px board (the window at its widest), so the picture is whole without JavaScript.
const SSR_W = 1092;
function fixedEdges(sources: SourceState[]): Edge[] {
  const gap = 101;
  const cell = (SSR_W - 188 - 2 * gap) / 2;
  const hubL = cell + gap;
  const hubR = hubL + 188;
  const rightX = hubR + gap;
  const cy = (4 * 53 + 3 * 10) / 2;
  return sources.map((s) => {
    const row = sources.filter((x) => x.side === s.side).indexOf(s);
    const y1 = row * 63 + 26.5;
    const y2 = cy + (y1 - cy) * 0.22;
    const [x1, x2] = s.side === "l" ? [cell, hubL] : [rightX, hubR];
    const mx = (x1 + x2) / 2;
    return { id: s.id, d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` };
  });
}

export function SourceGraph({ sources, win, head, initial = null }: { sources: SourceState[]; win: number; head: string; initial?: SourceId | null }) {
  const [sel, setSel] = useState<SourceId | null>(initial);
  const [edges, setEdges] = useState<Edge[]>(() => fixedEdges(sources));
  const wrap = useRef<HTMLDivElement>(null);
  const hub = useRef<HTMLDivElement>(null);
  const els = useRef<Partial<Record<SourceId, HTMLButtonElement | null>>>({});

  const layout = useCallback(() => {
    const w = wrap.current?.getBoundingClientRect();
    const h = hub.current?.getBoundingClientRect();
    if (!w || !h || w.width < 760) return setEdges([]);
    const cy = h.top + h.height / 2 - w.top;
    const next: Edge[] = [];
    for (const s of sources) {
      const r = els.current[s.id]?.getBoundingClientRect();
      if (!r) continue;
      const y1 = r.top + r.height / 2 - w.top;
      const x1 = s.side === "l" ? r.right - w.left : r.left - w.left;
      const x2 = s.side === "l" ? h.left - w.left : h.right - w.left;
      const y2 = cy + (y1 - cy) * 0.22;
      const mx = (x1 + x2) / 2;
      next.push({ id: s.id, d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}` });
    }
    setEdges(next);
  }, [sources]);

  useLayoutEffect(() => {
    layout();
    const ro = new ResizeObserver(layout);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [layout]);

  const current = sel ? sources.find((s) => s.id === sel)! : null;
  const node = (s: SourceState) => {
    const Icon = ICON[s.id];
    const state = s.exhibit ? "cite" : s.step ? "read" : "skip";
    const ms = s.step && s.step.ms > 20 ? `${s.step.ms} ms` : null;
    return (
      <li key={s.id}>
        <button
          ref={(el) => {
            els.current[s.id] = el;
          }}
          type="button"
          className={clsx("s-f-node s-pr-src", `s-f-node--${state}`, s.side === "r" && "s-f-node--r", sel === s.id && "is-on", sel && sel !== s.id && "is-dim")}
          aria-pressed={sel === s.id}
          aria-controls="source-detail"
          onClick={() => setSel(sel === s.id ? null : s.id)}
        >
          <span className="s-f-node__ic" aria-hidden>
            <Icon strokeWidth={1.8} />
          </span>
          <span className="s-f-node__tx">
            <span className="s-f-node__t">
              <span className="s-f-node__tt">{s.label}</span>
              {ms ? <span className="s-f-node__ms">{ms}</span> : null}
            </span>
            <span className="s-f-node__s">{s.step ? s.step.summary : "Skipped"}</span>
          </span>
          {s.exhibit ? (
            <span className="s-f-node__bx">
              <span className="s-ui-exhibit s-ui-exhibit--badge" aria-label={`Exhibit ${s.exhibit.label}`}>
                {s.exhibit.label}
              </span>
            </span>
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <div className="s-ui s-f-card s-pr-graph" data-ui>
      <div className="s-f-eg__h">
        <span className="s-f-eg__t">Evidence graph</span>
        <span className="s-f-eg__m">{head}</span>
      </div>
      <div ref={wrap} className="s-f-eg__board s-pr-graph__board">
        <svg className="s-pr-graph__wires" aria-hidden focusable="false">
          {edges.map((e) => {
            const s = sources.find((x) => x.id === e.id)!;
            const st = STROKE[wireOf(s)];
            return <path key={e.id} d={e.d} fill="none" stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash} strokeLinecap="round" opacity={sel && sel !== e.id ? 0.12 : st.opacity} />;
          })}
        </svg>
        <div className="s-pr-graph__grid">
          <ul className="s-pr-graph__col s-pr-graph__col--l" aria-label="Sources on the PayPal and store side">
            {sources.filter((s) => s.side === "l").map(node)}
          </ul>
          <div ref={hub} className="s-pr-hub">
            <UiRing value={win} label={`${win} percent likely to win`} />
            <UiPill decision="FIGHT" solid />
            <span className="s-f-hub__lk">likely to win</span>
          </div>
          <ul className="s-pr-graph__col s-pr-graph__col--r" aria-label="Sources on the payment and policy side">
            {sources.filter((s) => s.side === "r").map(node)}
          </ul>
        </div>
      </div>
      <div id="source-detail" className="s-pr-graph__foot" role="region" aria-live="polite" aria-label={current ? `${current.label}: how the agent used it` : "Legend"}>
        {current ? (
          <div className="s-pr-detail">
            <p className="s-pr-detail__id">
              <b>{current.label}</b>
              <span className="s-ui-muted">{current.sub}</span>
              {current.step ? <span>· {current.step.summary}</span> : null}
            </p>
            {current.exhibit ? (
              <div className="s-pr-detail__ex">
                <span className="s-ui-exhibit s-ui-exhibit--badge" aria-hidden>
                  {current.exhibit.label}
                </span>
                <p>
                  <span>{current.exhibit.title}.</span> <span className="s-ui-muted">{current.exhibit.why}</span>
                </p>
              </div>
            ) : null}
            {current.points.slice(0, 2).map((p) => (
              <p key={p} className="s-pr-detail__pt">
                {p}
              </p>
            ))}
            {!current.exhibit && !current.points.length ? <p className="s-ui-muted">{current.step ? "Read, but not cited in the brief." : "Not queried: it could not change the decision on this case."}</p> : null}
          </div>
        ) : (
          <div className="s-f-eg__foot s-pr-graph__legend">
            <Legend kind="cite">Cited to fight</Legend>
            <Legend kind="read">Read, not cited</Legend>
            <Legend kind="skip">Not queried</Legend>
            <span className="s-f-eg__hint">Select a source to see how the agent used it.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ kind, children }: { kind: Wire; children: React.ReactNode }) {
  const st = STROKE[kind];
  return (
    <span className="s-f-leg">
      <svg width="18" height="6" aria-hidden>
        <line x1="1" y1="3" x2="17" y2="3" stroke={st.stroke} strokeWidth="2" strokeLinecap="round" strokeDasharray={kind === "skip" ? "3 3" : undefined} opacity={kind === "read" ? 0.35 : 1} />
      </svg>
      {children}
    </span>
  );
}
