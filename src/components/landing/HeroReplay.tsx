"use client";

import { clsx } from "clsx";
import { Check, Fingerprint, Landmark, Loader2, MapPinned, MessagesSquare, Package, Pause, Play, Scale, ScrollText, ShieldCheck, Truck, UserRound, type LucideIcon } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import type { IconKey, ReplayCase, ReplayNode } from "./replay-model";

const ICON: Record<IconKey, LucideIcon> = {
  dispute: Landmark,
  order: Package,
  carrier: Truck,
  customer: UserRound,
  risk: Fingerprint,
  inbox: MessagesSquare,
  policies: ScrollText,
  protection: ShieldCheck,
  tracking: MapPinned,
  scale: Scale,
};

// Replay pacing, in ms of screen time. Real time is shown on the clock.
const CLAIM = 900;
const STEP = 560;
const QUERY = 440;
const DRAFT = 1200;
const MARK_GAP = 120;
const SETTLE = 900;
const HOLD = 6200;

type Schedule = { starts: number[]; ends: number[]; draftAt: number; verdictAt: number; marksAt: number[]; settledAt: number; total: number; events: number[] };

function schedule(c: ReplayCase): Schedule {
  const starts = c.steps.map((_, i) => CLAIM + i * STEP);
  const ends = starts.map((s) => s + QUERY);
  const draftAt = (ends.at(-1) ?? CLAIM) + 200;
  const verdictAt = draftAt + (c.timing ? DRAFT : 700);
  const marksAt = c.verdict.marks.map((_, j) => verdictAt + 200 + j * MARK_GAP);
  const settledAt = verdictAt + SETTLE + c.verdict.marks.length * MARK_GAP;
  const total = settledAt + HOLD;
  const events = [...starts, ...ends, draftAt, verdictAt, ...marksAt, settledAt].sort((a, b) => a - b);
  return { starts, ends, draftAt, verdictAt, marksAt, settledAt, total, events };
}

/** Screen time to real run time, piecewise linear through the recorded tool timings. */
function realClock(c: ReplayCase, s: Schedule) {
  if (!c.timing) return null;
  const pts: [number, number][] = [[0, 0]];
  const push = (x: number, y: number) => pts.push([x, Math.max(y, pts[pts.length - 1][1])]);
  c.steps.forEach((st, i) => {
    push(s.starts[i], st.at ?? 0);
    push(s.ends[i], (st.at ?? 0) + (st.ms ?? 0));
  });
  push(s.draftAt, c.timing.lastResultAt);
  push(s.verdictAt, c.timing.briefAt);
  push(s.settledAt, c.timing.durationMs);
  return (t: number) => {
    if (t >= pts[pts.length - 1][0]) return c.timing!.durationMs;
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      if (t <= x1) return x1 === x0 ? y1 : y0 + ((t - x0) / (x1 - x0)) * (y1 - y0);
    }
    return c.timing!.durationMs;
  };
}

const fmtClock = (ms: number) => {
  const s = ms / 1000;
  return `00:${s < 10 ? "0" : ""}${s.toFixed(1)}`;
};

function subscribeReducedMotion(cb: () => void) {
  const m = window.matchMedia("(prefers-reduced-motion: reduce)");
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const useReducedMotion = () =>
  useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

type NodeStatus = "idle" | "querying" | "found" | "skipped";

type View = {
  t: number;
  hub: "claim" | "investigating" | "drafting" | "verdict";
  status: Record<string, NodeStatus>;
  found: number;
  marks: { node: string; label: string; title: string }[];
  flags: Record<string, string>;
  log: { i: number; done: boolean }[];
  settled: boolean;
};

function viewAt(c: ReplayCase, s: Schedule, t: number): View {
  const status: Record<string, NodeStatus> = Object.fromEntries(c.nodes.map((n) => [n.id, "idle" as NodeStatus]));
  const flags: Record<string, string> = {};
  let found = 0;
  const log: View["log"] = [];
  c.steps.forEach((st, i) => {
    if (t < s.starts[i]) return;
    const done = t >= s.ends[i];
    // A source can be queried twice; once found it stays found.
    if (status[st.node] !== "found") status[st.node] = done ? "found" : "querying";
    if (done) {
      found++;
      if (st.flag) flags[st.node] = st.flag;
    }
    log.push({ i, done });
  });
  if (t >= s.verdictAt) for (const n of c.nodes) if (status[n.id] === "idle") status[n.id] = "skipped";
  const marks = c.verdict.marks.filter((_, j) => t >= s.marksAt[j]);
  const hub = t < (s.starts[0] ?? CLAIM) ? "claim" : t < s.draftAt ? "investigating" : t < s.verdictAt ? "drafting" : "verdict";
  return { t, hub, status, found, marks, flags, log, settled: t >= s.settledAt };
}

export function HeroReplay({ cases }: { cases: ReplayCase[] }) {
  const schedules = useMemo(() => cases.map(schedule), [cases]);
  const clocks = useMemo(() => cases.map((c, i) => realClock(c, schedules[i])), [cases, schedules]);
  const reduced = useReducedMotion();

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState(0);
  const [userPaused, setUserPaused] = useState(false);
  const [manual, setManual] = useState(false);
  const [inView, setInView] = useState(true);

  const tRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const c = cases[idx];
  const s = schedules[idx];
  const animating = reduced ? manual : !userPaused;
  // With reduced motion and no explicit play, every case shows its finished state.
  const shownPhase = reduced && !manual ? s.events.length : phase;
  const t = shownPhase === 0 ? 0 : s.events[Math.min(shownPhase, s.events.length) - 1];
  const view = useMemo(() => viewAt(c, s, t), [c, s, t]);

  const paint = useCallback(
    (time: number) => {
      const sch = schedules[idx];
      const clock = clocks[idx];
      if (clockRef.current && clock) clockRef.current.textContent = fmtClock(clock(Math.min(time, sch.settledAt)));
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.min(1, time / sch.total)})`;
    },
    [schedules, clocks, idx],
  );

  // Pause while offscreen so visitors see each case from the start.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting && e.intersectionRatio > 0.15), { threshold: [0, 0.15, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced && !manual) {
      paint(schedules[idx].settledAt);
      return;
    }
    paint(tRef.current);
    if (!animating || !inView) return;
    // A 40 ms timer rather than requestAnimationFrame: timers also run under headless virtual time,
    // so screenshots and crawlers see the replay progress. CSS transitions smooth the bar.
    let last = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(120, now - last);
      last = now;
      const sch = schedules[idx];
      tRef.current += dt;
      if (tRef.current >= sch.total || (manual && tRef.current >= sch.settledAt)) {
        window.clearInterval(timer);
        if (manual) {
          setManual(false);
          return;
        }
        tRef.current = 0;
        setPhase(0);
        setIdx((i) => (i + 1) % cases.length);
        return;
      }
      let p = 0;
      while (p < sch.events.length && sch.events[p] <= tRef.current) p++;
      setPhase((prev) => (prev === p ? prev : p));
      paint(tRef.current);
    }, 40);
    return () => window.clearInterval(timer);
  }, [animating, inView, idx, manual, reduced, schedules, cases.length, paint]);

  const select = (k: number) => {
    tRef.current = 0;
    setPhase(0);
    setIdx(k);
    setUserPaused(false);
    if (reduced) setManual(false);
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, k: number) => {
    const next = e.key === "ArrowRight" ? (k + 1) % cases.length : e.key === "ArrowLeft" ? (k - 1 + cases.length) % cases.length : e.key === "Home" ? 0 : e.key === "End" ? cases.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  };

  const togglePlay = () => {
    if (reduced) {
      tRef.current = 0;
      setPhase(0);
      setManual((m) => !m);
      return;
    }
    setUserPaused((p) => !p);
  };

  const playingNow = animating && inView;

  return (
    <div>
    <div ref={rootRef} className="rounded-[26px] bg-[#f4f4f4] p-1.5 ring-1 ring-line sm:p-2.5">
      <div className="overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_1px_2px_rgb(0_0_0/0.04),0_30px_80px_-40px_rgb(10_10_10/0.28)]">
        {/* Case switcher */}
        <div className="flex items-center gap-2 border-b border-line px-2 py-2 sm:px-3">
          <div role="tablist" aria-label="Real cases" className="grid flex-1 grid-cols-3 gap-1 sm:flex sm:flex-none">
            {cases.map((x, k) => (
              <button
                key={x.key}
                ref={(el) => {
                  tabRefs.current[k] = el;
                }}
                type="button"
                role="tab"
                id={`replay-tab-${x.key}`}
                aria-selected={k === idx}
                aria-controls="replay-panel"
                tabIndex={k === idx ? 0 : -1}
                onClick={() => select(k)}
                onKeyDown={(e) => onTabKey(e, k)}
                className={clsx(
                  "relative flex min-w-0 flex-col items-start gap-0.5 rounded-xl px-2.5 py-2 text-left transition-colors sm:min-w-[188px] sm:px-3",
                  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ink",
                  k === idx ? "bg-sunken" : "hover:bg-[#fafafa]",
                )}
              >
                <span className="flex w-full items-center gap-1.5">
                  <span className={clsx("text-[13px] font-semibold", k === idx ? "text-ink" : "text-ink-2")}>{x.tab.verb}</span>
                  <span className={clsx("num text-[12px]", k === idx ? "text-ink-2" : "text-muted")}>{x.tab.amount}</span>
                </span>
                <span className={clsx("w-full truncate text-[11.5px]", k === idx ? "text-ink-2" : "text-muted")}>
                  <span className="hidden sm:inline">{x.tab.who} · </span>
                  {x.tab.reason}
                </span>
              </button>
            ))}
          </div>
          <div className="ml-auto hidden items-center gap-3 pr-1 lg:flex">
            <span className="flex items-center gap-1.5 text-[12px] text-muted">
              <span className={clsx("size-1.5 rounded-full", c.provenance.tone === "sandbox" ? "bg-green" : "bg-faint")} aria-hidden />
              {c.provenance.short}
            </span>
          </div>
        </div>

        <div id="replay-panel" role="tabpanel" aria-labelledby={`replay-tab-${c.key}`}>
          <p className="sr-only">
            {c.provenance.long} {c.claim.title}, {c.claim.amount}, {c.tab.who}. {c.verdict.headlineLabel}: {c.verdict.headline}
          </p>
          <Graph c={c} view={view} />
          <List c={c} view={view} />
          <Outcome key={c.key} c={c} view={view} />
        </div>

        {/* Footer: provenance, real clock, progress, pause */}
        <div className="flex items-center gap-3 border-t border-line px-3 py-2.5 sm:px-4">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playingNow ? "Pause replay" : "Play replay"}
            className="flex size-7 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-sunken focus-visible:outline-2 focus-visible:outline-ink"
          >
            {playingNow ? <Pause className="size-3.5" fill="currentColor" strokeWidth={0} /> : <Play className="size-3.5 translate-x-px" fill="currentColor" strokeWidth={0} />}
          </button>
          <span className="relative h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
            <span ref={barRef} className="absolute inset-0 origin-left scale-x-0 rounded-full bg-ink/70 transition-transform duration-75 ease-linear" />
          </span>
          {c.timing ? (
            <span className="num shrink-0 text-[11.5px] text-muted">
              <span ref={clockRef}>00:00.0</span>
              <span className="text-muted"> / {fmtClock(c.timing.durationMs)} real time</span>
            </span>
          ) : (
            <span className="num shrink-0 text-[11.5px] text-muted">radar check · demo data</span>
          )}
        </div>
      </div>
    </div>
    <p className="mx-auto mt-4 flex max-w-[860px] items-start gap-2 text-[12.5px] leading-relaxed text-muted md:justify-center md:text-center">
      <span className={clsx("mt-[7px] size-1.5 shrink-0 rounded-full", c.provenance.tone === "sandbox" ? "bg-green" : "bg-faint")} aria-hidden />
      <span key={c.key} className="lp-fade">
        {c.provenance.long}
      </span>
    </p>
    </div>
  );
}

// ---- Desktop graph ----------------------------------------------------------------------------

const ROW_Y = [12.5, 37.5, 62.5, 87.5];

function edgePath(side: "l" | "r", row: number) {
  const y1 = ROW_Y[row] * 4;
  const y2 = 200 + (y1 - 200) * 0.24;
  const x1 = side === "l" ? 296 : 704;
  const xm = side === "l" ? 400 : 600;
  return `M ${x1} ${y1} C ${xm} ${y1}, ${xm} ${y2}, 500 ${y2}`;
}

const TONE = { green: "var(--green)", ink: "var(--ink)" } as const;

function Graph({ c, view }: { c: ReplayCase; view: View }) {
  const rows = { l: c.nodes.filter((n) => n.side === "l"), r: c.nodes.filter((n) => n.side === "r") };
  const verdict = view.hub === "verdict";
  const tone = TONE[c.verdict.tone];
  const prevention = c.decision === "PREVENT";

  return (
    <div className="relative hidden h-[392px] bg-[radial-gradient(circle,#e6e6e6_1px,transparent_1.3px)] bg-[length:18px_18px] md:block" aria-hidden>
      <svg className="absolute inset-0 size-full" viewBox="0 0 1000 400" preserveAspectRatio="none">
        {(["l", "r"] as const).flatMap((side) =>
          rows[side].map((n, row) => {
            const st = view.status[n.id];
            const cited = view.marks.some((m) => m.node === n.id);
            const flagged = !!view.flags[n.id];
            let stroke = "var(--line-strong)";
            let width = 1;
            let dash: string | undefined = "3 5";
            let opacity = 1;
            let flow = false;
            if (st === "querying") [stroke, width, dash, flow] = ["var(--amber)", 1.6, "5 6", true];
            else if (prevention && flagged) [stroke, width, dash] = [verdict ? tone : "var(--red)", 1.7, undefined];
            else if (cited) [stroke, width, dash] = [tone, 1.8, undefined];
            else if (st === "found") [stroke, width, dash, opacity] = ["var(--ink-2)", 1.1, undefined, verdict ? 0.2 : 0.4];
            else if (st === "skipped") [stroke, dash, opacity] = ["var(--line-strong)", "2 6", 0.8];
            return (
              <path
                // Remount on every state change: a keyframe fade (not a CSS transition) follows the
                // animation timeline, so the final colour is right in every browser and in headless renders.
                key={`${c.key}-${n.id}-${st}-${cited ? "c" : ""}${flagged ? "f" : ""}${verdict ? "v" : ""}`}
                d={edgePath(side, row)}
                fill="none"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                style={{ stroke, strokeWidth: width, strokeDasharray: dash ?? "none", opacity }}
                className={clsx("lp-edge", flow && "lp-flow")}
              />
            );
          }),
        )}
      </svg>

      {(["l", "r"] as const).map((side) =>
        rows[side].map((n, row) => (
          <GraphNode key={`${c.key}-${n.id}`} node={n} row={row} c={c} view={view} />
        )),
      )}

      <Hub c={c} view={view} />
    </div>
  );
}

function Legends({ c }: { c: ReplayCase }) {
  const prevention = c.decision === "PREVENT";
  return (
    <span className="hidden items-center gap-4 text-[11px] normal-case tracking-normal text-muted md:flex">
      <Legend color="var(--amber)" dash label={prevention ? "Checking" : "Querying"} />
      <Legend color={prevention ? "var(--red)" : TONE[c.verdict.tone]} label={prevention ? "Warning sign" : c.decision === "FIGHT" ? "Cited to fight" : "Cited to refund"} />
      <Legend color="var(--line-strong)" dash label="Not needed" />
    </span>
  );
}

function Legend({ color, label, dash }: { color: string; label: string; dash?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="16" height="4" aria-hidden>
        <line x1="1" y1="2" x2="15" y2="2" stroke={color} strokeWidth="2" strokeDasharray={dash ? "3 3" : undefined} strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}

function GraphNode({ node, row, c, view }: { node: ReplayNode; row: number; c: ReplayCase; view: View }) {
  const st = view.status[node.id];
  const step = c.steps.find((x) => x.node === node.id);
  const marks = view.marks.filter((m) => m.node === node.id);
  const flag = view.flags[node.id];
  const verdict = view.hub === "verdict";
  const Icon = ICON[node.icon];
  const left = node.side === "l";
  const active = st === "found" || st === "querying";
  const tone = c.verdict.tone;
  return (
    <div
      className={clsx("absolute w-[min(27.5%,292px)] -translate-y-1/2", left ? "right-[70.4%]" : "left-[70.4%]")}
      style={{ top: `${ROW_Y[row]}%` }}
    >
      <div
        className={clsx(
          "relative flex items-center gap-2.5 rounded-xl border bg-white px-2.5 py-2 lg:px-3 lg:py-2.5",
          !left && "flex-row-reverse text-right",
          st === "idle" && "border-dashed border-line-strong",
          st === "skipped" && "border-dashed border-line-strong bg-[#fcfcfc]",
          st === "querying" && "border-amber shadow-[0_0_0_3px_rgb(232_163_61/0.16)]",
          st === "found" && !marks.length && !flag && "border-line shadow-[0_1px_2px_rgb(0_0_0/0.04)]",
          marks.length > 0 && (tone === "green" ? "border-green/35 shadow-[0_1px_2px_rgb(0_0_0/0.04)]" : "border-ink/30 shadow-[0_1px_2px_rgb(0_0_0/0.04)]"),
          flag && (verdict ? "border-green/35" : "border-red/35"),
        )}
      >
        <span
          className={clsx(
            "flex size-8 shrink-0 items-center justify-center rounded-lg border",
            st === "querying" ? "border-amber/50 bg-amber/10 text-ink" : active ? (marks.length ? "border-ink bg-ink text-white" : "border-line bg-sunken text-ink-2") : "border-line bg-white text-muted",
          )}
        >
          {st === "querying" ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" strokeWidth={1.9} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={clsx("flex items-baseline gap-1.5", !left && "flex-row-reverse")}>
            <span className="truncate text-[12.5px] font-medium leading-tight text-ink">{node.title}</span>
            {st === "found" && step?.ms != null && step.ms >= 20 ? <span className="num shrink-0 text-[10px] text-muted">{step.ms} ms</span> : null}
          </span>
          <span className={clsx("mt-0.5 block truncate text-[11.5px] leading-tight", st === "found" ? "text-ink-2" : "text-muted")}>
            {st === "querying" ? (c.decision === "PREVENT" ? "Checking…" : "Querying…") : st === "found" ? step?.summary : st === "skipped" ? "Not needed for this case" : node.system}
          </span>
        </span>
        {marks.length ? (
          <span className={clsx("absolute -top-2 flex gap-0.5", left ? "-right-2" : "-left-2")}>
            {marks.map((m) => (
              <span key={m.label} className={clsx("lp-pop num flex size-[18px] items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-sm", tone === "green" ? "bg-green" : "bg-ink")}>
                {m.label}
              </span>
            ))}
          </span>
        ) : null}
        {flag ? (
          <span className={clsx("absolute -top-2.5 flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shadow-sm", left ? "-right-2" : "-left-2", verdict ? "bg-green text-white" : "bg-red text-white")}>
            {verdict ? <Check className="size-2.5" strokeWidth={3.5} /> : "!"} {flag}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Ring({ value, color }: { value: number; color: string }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  return (
    <div className="relative size-[70px]">
      <svg viewBox="0 0 64 64" className="size-full -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--sunken)" strokeWidth="5" />
        <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.max(value, 2) / 100)} className="lp-ring" style={{ ["--lp-ring-from" as string]: circ }} />
      </svg>
      <span className="num absolute inset-0 flex items-center justify-center text-[17px] font-medium">{value}%</span>
    </div>
  );
}

function Hub({ c, view }: { c: ReplayCase; view: View }) {
  const total = c.steps.length;
  const tone = TONE[c.verdict.tone];
  return (
    <div className="absolute left-1/2 top-1/2 w-[clamp(168px,19%,214px)] -translate-x-1/2 -translate-y-1/2">
      <div className="flex min-h-[168px] flex-col items-center justify-center rounded-2xl border border-line-strong bg-white px-4 py-5 text-center shadow-[0_10px_34px_-12px_rgb(0_0_0/0.16)]">
        {view.hub === "verdict" ? (
          <div key="v" className="lp-fade flex flex-col items-center">
            {c.verdict.ring ? (
              <Ring value={c.verdict.ring.value} color={tone} />
            ) : c.verdict.score ? (
              <div className="num flex items-baseline gap-1.5 text-[26px] font-medium leading-none tracking-[-0.02em]">
                <span className="text-muted line-through decoration-1">{c.verdict.score.before}</span>
                <span className="text-[16px] text-muted">→</span>
                <span className="text-green">{c.verdict.score.after}</span>
              </div>
            ) : null}
            <span className={clsx("mt-2.5 rounded-md px-2 py-0.5 text-[12.5px] font-semibold", c.decision === "PREVENT" ? "bg-green-soft text-green" : c.decision === "FIGHT" ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-inset ring-line-strong")}>
              {c.decision === "PREVENT" ? "Prevented" : c.tab.verb}
            </span>
            <span className="mt-1.5 text-[11px] leading-snug text-muted">{c.verdict.ring?.label ?? "risk score, out of 100"}</span>
          </div>
        ) : view.hub === "drafting" ? (
          <div key="d" className="lp-fade flex flex-col items-center">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{c.timing ? "Writing the brief" : "Scoring the risk"}</span>
            <span className="mt-2 text-[13px] font-medium text-ink">{c.timing ? "Citing each record" : "2 warning signs"}</span>
            {c.timing ? (
              <span className="mt-3 block h-1.5 w-24 overflow-hidden rounded-full bg-sunken">
                <span className="lp-shimmer block h-full w-full" />
              </span>
            ) : (
              <span className="num mt-2 text-[22px] font-medium text-red">{c.verdict.score?.before}</span>
            )}
          </div>
        ) : (
          <div key="c" className="flex flex-col items-center">
            <span className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{c.claim.kicker}</span>
            <span className="mt-1 text-[14px] font-semibold leading-tight text-ink">{c.claim.title}</span>
            <span className="num mt-1.5 text-[19px] leading-none text-ink">{c.claim.amount}</span>
            <span className="mt-2 text-[11px] text-muted">{c.claim.who}</span>
            <span className="mt-3 block h-1 w-24 overflow-hidden rounded-full bg-sunken">
              <span className="block h-full rounded-full bg-amber" style={{ width: `${(view.found / total) * 100}%` }} />
            </span>
            <span className="mt-1.5 flex items-center gap-1 text-[10.5px] text-muted">
              {view.hub === "investigating" ? (
                <>
                  <Loader2 className="size-3 animate-spin" /> {view.found} of {total} read
                </>
              ) : (
                "Opening the case"
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Phone list -------------------------------------------------------------------------------

function List({ c, view }: { c: ReplayCase; view: View }) {
  const order = [...c.steps.map((s) => s.node), ...c.nodes.map((n) => n.id).filter((id) => !c.steps.some((s) => s.node === id))];
  const ids = order.filter((id, i) => order.indexOf(id) === i);
  const tone = TONE[c.verdict.tone];
  return (
    <div className="border-b border-line bg-[#fcfcfc] px-3 pb-3 pt-3 md:hidden" aria-hidden>
      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-white px-3.5 py-3">
        <div className="min-w-0">
          <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{c.claim.kicker}</div>
          <div className="mt-0.5 truncate text-[14px] font-semibold text-ink">
            {c.claim.title} <span className="num font-normal text-ink-2">{c.claim.amount}</span>
          </div>
          <div className="truncate text-[11.5px] text-muted">{c.claim.who}</div>
        </div>
        {view.hub === "verdict" ? (
          <div className="lp-fade flex shrink-0 flex-col items-end gap-1">
            <span className={clsx("rounded-md px-2 py-0.5 text-[12.5px] font-semibold", c.decision === "PREVENT" ? "bg-green-soft text-green" : c.decision === "FIGHT" ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-inset ring-line-strong")}>
              {c.decision === "PREVENT" ? "Prevented" : c.tab.verb}
            </span>
            <span className="num text-[11.5px] text-muted">{c.verdict.ring ? `${c.verdict.ring.value}% ${c.verdict.ring.label}` : `risk ${c.verdict.score?.before} → ${c.verdict.score?.after}`}</span>
          </div>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-muted">
            {view.hub === "claim" ? null : <Loader2 className="size-3 animate-spin" />}
            {view.hub === "claim" ? "Opening" : view.hub === "drafting" ? (c.timing ? "Writing" : "Scoring") : `${view.found} of ${c.steps.length}`}
          </span>
        )}
      </div>
      <ol className="relative space-y-1.5 before:absolute before:bottom-4 before:left-[17px] before:top-4 before:w-px before:bg-line">
        {ids.map((id) => {
          const n = c.nodes.find((x) => x.id === id)!;
          const st = view.status[id];
          const step = c.steps.find((x) => x.node === id);
          const marks = view.marks.filter((m) => m.node === id);
          const flag = view.flags[id];
          const Icon = ICON[n.icon];
          return (
            <li key={`${c.key}-${id}`} className="relative flex items-center gap-2.5 rounded-lg px-1 py-1">
              <span
                className={clsx(
                  "relative z-10 flex size-[34px] shrink-0 items-center justify-center rounded-lg border",
                  st === "querying" ? "border-amber bg-white text-ink" : st === "found" ? (marks.length ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2") : "border-dashed border-line-strong bg-white text-muted",
                )}
              >
                {st === "querying" ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" strokeWidth={1.9} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-medium text-ink">{n.title}</span>
                <span className={clsx("block truncate text-[11.5px]", st === "found" ? "text-ink-2" : "text-muted")}>
                  {st === "found" ? step?.summary : st === "querying" ? "Querying…" : st === "skipped" ? "Not needed" : n.system}
                </span>
              </span>
              {marks.length ? (
                <span className="flex shrink-0 gap-0.5">
                  {marks.map((m) => (
                    <span key={m.label} className="lp-pop num flex size-[18px] items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ background: tone }}>
                      {m.label}
                    </span>
                  ))}
                </span>
              ) : flag ? (
                <span className={clsx("shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white", view.hub === "verdict" ? "bg-green" : "bg-red")}>{view.hub === "verdict" ? "Fixed" : flag}</span>
              ) : st === "found" && step?.ms != null && step.ms >= 20 ? (
                <span className="num shrink-0 text-[10px] text-muted">{step.ms} ms</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A REST path that wraps at slashes, never mid-word. */
function Endpoint({ value }: { value: string }) {
  const parts = value.split("/");
  return (
    <p className="num mt-1 text-[11px] leading-relaxed text-muted">
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 ? <wbr /> : null}
          <span className="whitespace-nowrap">
            {i > 0 ? "/" : ""}
            {p}
          </span>
        </Fragment>
      ))}
    </p>
  );
}

// ---- Outcome: live log while running, the brief once it lands --------------------------------

function Outcome({ c, view }: { c: ReplayCase; view: View }) {
  const v = c.verdict;
  const show = view.hub === "verdict";
  return (
    <div className="relative min-h-[212px] md:min-h-[188px]">
      {!show ? (
        <div className="px-4 py-4 sm:px-5" aria-hidden>
          <div className="flex items-center justify-between gap-4 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">
            {c.timing ? "Agent trace" : "Radar checks"}
            <Legends c={c} />
          </div>
          <ol className="num mt-2.5 space-y-1.5 text-[11.5px] sm:text-[12px]">
            {view.log.slice(-4).map(({ i, done }) => {
              const st = c.steps[i];
              return (
                <li key={i} className="lp-fade flex min-w-0 items-center gap-2.5">
                  {done ? <Check className={clsx("size-3.5 shrink-0", st.flag ? "text-red" : "text-green")} strokeWidth={3} /> : <Loader2 className="size-3.5 shrink-0 animate-spin text-amber" />}
                  <span className="shrink-0 text-ink">{st.tool ?? c.nodes.find((n) => n.id === st.node)?.title}</span>
                  {st.arg ? <span className="hidden shrink-0 text-muted lg:inline">{st.arg}</span> : null}
                  {done ? <span className="min-w-0 truncate font-sans text-muted">{st.flag ? `${st.flag}: ${st.summary}` : st.summary}</span> : null}
                </li>
              );
            })}
            {view.hub === "drafting" ? (
              <li className="lp-fade flex items-center gap-2.5">
                <Loader2 className="size-3.5 shrink-0 animate-spin text-amber" />
                <span className="text-ink">{c.timing ? "file_case_brief" : "score"}</span>
                <span className="font-sans text-muted">{c.timing ? "decision, likelihood, cited reasoning, exhibits, letter" : "two warning signs on one order"}</span>
              </li>
            ) : null}
            {view.hub === "claim" ? <li className="font-sans text-muted">Opening the case…</li> : null}
          </ol>
        </div>
      ) : (
        <div className="lp-fade grid gap-5 px-4 py-4 sm:px-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] md:gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
          <div className="min-w-0">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{v.headlineLabel}</div>
            <p className="mt-2 text-[15px] font-semibold leading-snug tracking-[-0.012em] text-ink sm:text-[16px]">{v.headline}</p>
            <p className="num mt-2 text-[11.5px] text-muted">{v.stats.join(" · ")}</p>
          </div>
          <div className="min-w-0">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{v.marksLabel}</div>
            {c.decision === "PREVENT" && v.quote ? (
              <figure className="mt-2">
                <blockquote className="text-[13px] leading-snug text-ink" lang="de">
                  „{v.quote.text}“
                </blockquote>
                <figcaption className="mt-1 text-[12px] leading-snug text-muted">{v.quote.translation}</figcaption>
              </figure>
            ) : (
              <ul className="mt-2 space-y-1">
                {v.marks.map((m) => (
                  <li key={m.label} className="flex min-w-0 items-center gap-2 text-[12.5px]">
                    <span className={clsx("num flex size-[17px] shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white", v.tone === "green" ? "bg-green" : "bg-ink")}>{m.label}</span>
                    <span className="truncate text-ink-2">{m.title}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="min-w-0 md:col-span-2 lg:col-span-1">
            <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted">{c.decision === "PREVENT" ? "What Exhibit did" : "Next step"}</div>
            <p className="mt-2 text-[13px] font-medium text-ink">{v.action.label}</p>
            {v.action.endpoint ? <Endpoint value={v.action.endpoint} /> : null}
            <p className="mt-1.5 text-[12px] leading-snug text-muted">{v.action.detail}</p>
            {c.decision !== "PREVENT" && v.quote ? <p className="mt-2 border-l-2 border-line pl-2.5 text-[12px] italic leading-snug text-muted">“{v.quote.text}”</p> : null}
          </div>
        </div>
      )}
    </div>
  );
}
