"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** A fact in the text that matches a record Exhibit read: a tracking number, an order id, a signature. */
export type Cite = { text: string; ref: string; title: string; detail: string; exhibit?: string };

type Seg = { text: string } | { text: string; cite: Cite } | { text: string; exhibit: string; ref?: string; title?: string; why?: string };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const EXHIBITS = /\b(Exhibits?)(\s+)([A-H](?:(?:\s*,\s*|\s+and\s+|\s*&\s*)[A-H])*)\b/g;

function segment(text: string, cites: Cite[], exhibits: { label: string; ref: string; title: string; why: string }[]): Seg[] {
  type Hit = { start: number; end: number; make: () => Seg[] };
  const hits: Hit[] = [];
  for (const m of text.matchAll(EXHIBITS)) {
    const start = m.index ?? 0;
    hits.push({
      start,
      end: start + m[0].length,
      make: () => {
        const parts: Seg[] = [{ text: m[1] + m[2] }];
        for (const p of m[3].split(/(\s*,\s*|\s+and\s+|\s*&\s*)/)) {
          if (/^[A-H]$/.test(p)) {
            const x = exhibits.find((e) => e.label === p);
            parts.push({ text: p, exhibit: p, ref: x?.ref, title: x?.title, why: x?.why });
          } else if (p) parts.push({ text: p });
        }
        return parts;
      },
    });
  }
  const sorted = [...cites].filter((c) => c.text.trim().length >= 3).sort((a, b) => b.text.length - a.text.length);
  for (const c of sorted) {
    const re = new RegExp(`(?<![\\w-])${esc(c.text)}(?![\\w-])`, "gi");
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0;
      const end = start + m[0].length;
      if (hits.some((h) => start < h.end && end > h.start)) continue;
      hits.push({ start, end, make: () => [{ text: m[0], cite: c }] });
    }
  }
  hits.sort((a, b) => a.start - b.start);
  const out: Seg[] = [];
  let at = 0;
  for (const h of hits) {
    if (h.start > at) out.push({ text: text.slice(at, h.start) });
    out.push(...h.make());
    at = h.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

type Tip = { x: number; y: number; above: boolean; title: string; detail: string; exhibit?: string; note: string };

/**
 * The response letter with its citations made visible: "Exhibit B" becomes a badge, and every fact
 * that matches a record Exhibit read (tracking numbers, order ids, signatures, dates) is underlined.
 * Hovering shows the source record and lights it up in the evidence graph and the packet.
 */
export function CitedText({ text, cites, exhibits, onHover, className }: { text: string; cites: Cite[]; exhibits: { label: string; ref: string; title: string; why: string }[]; onHover?: (ref: string | null) => void; className?: string }) {
  const segs = useMemo(() => segment(text, cites, exhibits), [text, cites, exhibits]);
  const [tip, setTip] = useState<Tip | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const show = useCallback(
    (el: HTMLElement, t: Omit<Tip, "x" | "y" | "above">, ref?: string) => {
      const r = el.getBoundingClientRect();
      const w = 288;
      const above = r.bottom + 150 > window.innerHeight;
      setTip({ ...t, above, x: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)), y: above ? r.top - 6 : r.bottom + 6 });
      onHover?.(ref ?? null);
    },
    [onHover],
  );
  const hide = useCallback(() => {
    setTip(null);
    onHover?.(null);
  }, [onHover]);

  useEffect(() => {
    if (!tip) return;
    const off = () => hide();
    window.addEventListener("scroll", off, true);
    return () => window.removeEventListener("scroll", off, true);
  }, [tip, hide]);

  return (
    <div ref={box} className={clsx("whitespace-pre-wrap", className)}>
      {segs.map((s, i) => {
        if ("cite" in s) {
          const ex = s.cite.exhibit;
          return (
            <span
              key={i}
              tabIndex={0}
              onMouseEnter={(e) => show(e.currentTarget, { title: s.cite.title, detail: s.cite.detail, exhibit: ex, note: ex ? `In the packet as Exhibit ${ex}` : "From a record the agent read" }, s.cite.ref)}
              onFocus={(e) => show(e.currentTarget, { title: s.cite.title, detail: s.cite.detail, exhibit: ex, note: ex ? `In the packet as Exhibit ${ex}` : "From a record the agent read" }, s.cite.ref)}
              onMouseLeave={hide}
              onBlur={hide}
              className={clsx("cursor-help rounded-[3px] underline decoration-dotted decoration-[1.5px] underline-offset-[3px] transition-colors hover:bg-[rgb(232_163_61/0.14)]", ex ? "decoration-ink/60" : "decoration-line-strong")}
            >
              {s.text}
            </span>
          );
        }
        if ("exhibit" in s) {
          return (
            <span
              key={i}
              tabIndex={0}
              onMouseEnter={(e) => show(e.currentTarget, { title: s.title ?? `Exhibit ${s.exhibit}`, detail: s.why ?? "", exhibit: s.exhibit, note: "Cited by letter; the packet carries it" }, s.ref)}
              onFocus={(e) => show(e.currentTarget, { title: s.title ?? `Exhibit ${s.exhibit}`, detail: s.why ?? "", exhibit: s.exhibit, note: "Cited by letter; the packet carries it" }, s.ref)}
              onMouseLeave={hide}
              onBlur={hide}
              className="num mx-px inline-flex h-[17px] min-w-[17px] cursor-help items-center justify-center rounded bg-ink px-1 align-[1px] text-[10.5px] font-semibold text-white transition-transform hover:scale-110"
            >
              {s.text}
            </span>
          );
        }
        return <span key={i}>{s.text}</span>;
      })}
      {tip && typeof document !== "undefined"
        ? createPortal(
            <div role="tooltip" style={{ left: tip.x, top: tip.y }} className={clsx("app-shell pv-fade pointer-events-none fixed z-[97] w-72 rounded-xl bg-ink px-3.5 py-3 text-white shadow-[0_12px_32px_rgb(0_0_0/0.25)]", tip.above && "-translate-y-full")}>
              <div className="flex items-center gap-2">
                {tip.exhibit ? <span className="num flex size-[18px] items-center justify-center rounded bg-white text-[10.5px] font-semibold text-ink">{tip.exhibit}</span> : null}
                <span className="text-[12.5px] font-medium leading-tight">{tip.title}</span>
              </div>
              {tip.detail ? <div className="mt-1.5 text-[12px] leading-snug text-white/75">{tip.detail}</div> : null}
              <div className="mt-2 text-[10.5px] uppercase tracking-[0.07em] text-white/45">{tip.note}</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
