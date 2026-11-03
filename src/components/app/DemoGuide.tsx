"use client";

import { clsx } from "clsx";
import { ArrowRight, Check, Loader2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { DemoStatus } from "@/lib/demo";
import type { GuideStep } from "@/lib/demo-progress";
import { toast } from "../ui/Toast";

type StepDef = { key: GuideStep; title: string; hint: string; go: (s: DemoStatus) => string | (() => Promise<string | null>) };

const STEPS: StepDef[] = [
  { key: "run", title: "Run Exhibit on a case", hint: "Watch the evidence graph query each source", go: (s) => (s.guideCase ? `/app/disputes/${s.guideCase.id}?guide=run` : "/app/disputes") },
  { key: "evidence", title: "Review the evidence", hint: "The packet PayPal's reviewer reads", go: (s) => (s.guideCase ? `/app/disputes/${s.guideCase.id}?tab=packet` : "/app/disputes") },
  { key: "file", title: "File with PayPal", hint: "One click calls provide-evidence", go: (s) => (s.guideCase ? `/app/disputes/${s.guideCase.id}?guide=file` : "/app/disputes") },
  { key: "prevent", title: "Prevent a dispute", hint: "Fix an order before the buyer files", go: () => "/app/protection" },
  { key: "ask", title: "Ask a question", hint: "Answers from your own records", go: () => "ask" },
  {
    key: "approve",
    title: "Approve an agent request",
    hint: "An outside AI agent asks; you decide",
    go: (s) => async () => {
      if (s.pendingApprovals) return "/app/approvals";
      const r = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "agent_request" }) }).then((x) => x.json());
      if (r.error) {
        toast({ title: "No request sent", sub: r.error, tone: "error" });
        return null;
      }
      toast({ title: "A demo agent asked to act", sub: `${r.approval.title} · nothing runs until you approve` });
      return r.reviewPath as string;
    },
  },
];

type Guide = { status: DemoStatus; done: number; total: number; busy: GuideStep | null; run: (s: StepDef) => Promise<void>; open: boolean; setOpen: (v: boolean) => void };
const Ctx = createContext<Guide | null>(null);

/** The demo guide's state for the whole shell. Absent outside demo mode, so every piece renders nothing there. */
export const useDemoGuide = () => useContext(Ctx);

/** "See Exhibit work in 3 minutes": six steps that tick themselves off as the real work lands. */
export function DemoGuideProvider({ initial, children }: { initial: DemoStatus; children: React.ReactNode }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState<GuideStep | null>(null);
  const [open, setOpen] = useState(false);
  const prev = useRef(initial.progress);

  const load = useCallback(async () => {
    const r = await fetch("/api/demo", { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    if (r?.mode === "demo") setStatus(r);
  }, []);

  useEffect(() => {
    const t = setInterval(load, 5000);
    const onDemo = () => void load();
    window.addEventListener("exhibit:demo-changed", onDemo);
    return () => {
      clearInterval(t);
      window.removeEventListener("exhibit:demo-changed", onDemo);
    };
  }, [load]);

  // Name a step the moment the real work behind it lands.
  useEffect(() => {
    const n = STEPS.filter((s) => status.progress[s.key]).length;
    for (const s of STEPS) if (status.progress[s.key] && !prev.current[s.key]) toast({ title: `Step done: ${s.title}`, sub: n === STEPS.length ? "That's the whole loop" : `${n} of ${STEPS.length} in the demo guide`, tone: "success" });
    prev.current = status.progress;
  }, [status.progress]);

  const run = useCallback(
    async (s: StepDef) => {
      const target = s.go(status);
      setOpen(false);
      if (target === "ask") {
        window.dispatchEvent(new CustomEvent("exhibit:ask", { detail: { question: "Why are we losing item-not-received cases?" } }));
        return;
      }
      if (typeof target === "string") {
        router.push(target);
        return;
      }
      setBusy(s.key);
      try {
        const href = await target();
        if (href) router.push(href);
        void load();
      } finally {
        setBusy(null);
      }
    },
    [status, router, load],
  );

  const done = STEPS.filter((s) => status.progress[s.key]).length;
  const value = useMemo<Guide>(() => ({ status, done, total: STEPS.length, busy, run, open, setOpen }), [status, done, busy, run, open]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function StepMark({ i, ok, busy }: { i: number; ok: boolean; busy: boolean }) {
  return (
    <span className={clsx("flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px]", ok ? "border-ink bg-ink text-white" : "border-line-strong bg-surface text-muted")}>
      {ok ? <Check className="size-3" strokeWidth={3} /> : busy ? <Loader2 className="size-3 animate-spin" /> : <span className="num">{i + 1}</span>}
    </span>
  );
}

function Progress({ value, className }: { value: number; className?: string }) {
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 18 18" className={clsx("size-[18px] -rotate-90", className)} aria-hidden>
      <circle cx="9" cy="9" r={r} fill="none" stroke="#dcdcda" strokeWidth="2.5" />
      <circle cx="9" cy="9" r={r} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} className="transition-[stroke-dashoffset] duration-500" />
    </svg>
  );
}

/** The top bar's way in: "Guide 2/6", opening the checklist under it. Closed by default; it never covers work on its own. */
export function GuideButton({ compact }: { compact?: boolean }) {
  const g = useDemoGuide();
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const open = g?.open ?? false;
  const setOpen = g?.setOpen;

  // Two buttons exist (desktop and phone top bars); only the visible one anchors the panel.
  const show = useCallback(() => {
    const el = btn.current;
    if (!el || el.offsetParent === null || !setOpen) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 16);
    setPos({ top: r.bottom + 8, left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)), width });
    setOpen(true);
  }, [setOpen]);

  useEffect(() => {
    window.addEventListener("exhibit:guide", show);
    return () => window.removeEventListener("exhibit:guide", show);
  }, [show]);

  useEffect(() => {
    if (!open || !setOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);
  if (!g) return null;
  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => (g.open ? g.setOpen(false) : show())}
        aria-expanded={g.open}
        aria-label={`Demo guide, ${g.done} of ${g.total} done`}
        className={clsx("flex h-8 items-center gap-2 rounded-[8px] px-2 text-[13px] transition-colors", g.open ? "bg-active text-ink" : "text-ink-2 hover:bg-active hover:text-ink")}
      >
        <Progress value={g.done / g.total} />
        {compact ? null : <span>Guide</span>}
        <span className="num text-muted">
          {g.done}/{g.total}
        </span>
      </button>
      {g.open && pos ? <GuidePanel ref={panel} pos={pos} /> : null}
    </>
  );
}

function GuidePanel({ ref, pos }: { ref: React.Ref<HTMLDivElement>; pos: { top: number; left: number; width: number } }) {
  const g = useDemoGuide()!;
  return (
    <div ref={ref} role="dialog" aria-label="Demo guide" style={pos} className="ask-in fixed z-[95] overflow-hidden rounded-[10px] border border-line bg-surface shadow-[0_24px_60px_-16px_rgb(0_0_0/0.22),0_6px_18px_-8px_rgb(0_0_0/0.1)]">
      <div className="flex items-start gap-3 px-4 pb-2 pt-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-ink">{g.done === g.total ? "You've seen the whole loop" : "See Exhibit work in 3 minutes"}</div>
          <div className="mt-0.5 text-[12px] text-muted">{g.done === g.total ? "Every step ran for real against the simulator." : "Each step ticks off when the real work lands."}</div>
        </div>
        <button type="button" onClick={() => g.setOpen(false)} aria-label="Close guide" className="-mr-1.5 -mt-0.5 flex size-7 items-center justify-center rounded-[6px] text-muted hover:bg-active hover:text-ink">
          <X className="size-3.5" />
        </button>
      </div>
      <ol className="px-2 pb-2">
        {STEPS.map((s, i) => {
          const ok = g.status.progress[s.key];
          return (
            <li key={s.key}>
              <button type="button" onClick={() => void g.run(s)} disabled={g.busy !== null} className="group flex w-full items-center gap-3 rounded-[8px] px-2 py-2 text-left transition-colors hover:bg-hover">
                <StepMark i={i} ok={ok} busy={g.busy === s.key} />
                <span className="min-w-0 flex-1">
                  <span className={clsx("block text-[13px] font-medium leading-tight", ok ? "text-muted" : "text-ink")}>{s.title}</span>
                  <span className="mt-0.5 block truncate text-[12px] text-muted">{s.key === "run" && g.status.guideCase && !ok ? `${g.status.guideCase.buyer}'s claim: watch every source get checked` : s.hint}</span>
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-ghost transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
              </button>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-line px-4 py-2.5 text-[12px] text-muted">Shared demo · resets after {g.status.idleMinutes} quiet minutes</div>
    </div>
  );
}

const STRIP_KEY = "exhibit:guide-strip";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(STRIP_KEY, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(STRIP_KEY, cb);
  };
};

/** First run on the demo overview: the six steps as a strip above the work, dismissible to the top bar's Guide. */
export function GuideStrip({ className, art }: { className?: string; /** Dot art beside the steps, rendered by the page (a server component). */ art?: React.ReactNode }) {
  const g = useDemoGuide();
  const hidden = useSyncExternalStore(subscribe, () => localStorage.getItem(STRIP_KEY) === "hidden", () => false);
  const pathname = usePathname();
  if (!g || hidden || pathname !== "/app") return null;
  const set = (v: "hidden" | null) => {
    if (v) localStorage.setItem(STRIP_KEY, v);
    else localStorage.removeItem(STRIP_KEY);
    window.dispatchEvent(new Event(STRIP_KEY));
  };
  const hide = () => {
    set("hidden");
    toast({ title: "Demo guide hidden", sub: "It stays under Guide in the top bar.", action: { label: "Undo", run: () => set(null) } });
  };
  const all = g.done === g.total;
  return (
    <section aria-label="Demo guide" className={clsx("rounded-[10px] border border-line", className)}>
      <div className="flex gap-5 px-4 py-4 sm:px-5">
        {art}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-ink">{all ? "You've seen the whole loop" : "See Exhibit work in 3 minutes"}</h2>
            <div className="flex items-center gap-3 text-[13px] text-muted">
              <span className="num">
                {g.done} of {g.total} done
              </span>
              <button type="button" onClick={hide} className="rounded-[6px] px-1.5 py-0.5 text-ink-2 underline decoration-line-strong underline-offset-2 transition-colors hover:text-ink hover:decoration-ink">
                {all ? "Close" : "Hide guide"}
              </button>
            </div>
          </div>
          <p className="mt-0.5 text-[13px] text-muted">{all ? "Every step ran for real against the PayPal simulator. The guide stays under Guide in the top bar." : "Six steps on this demo merchant. Each ticks off when the real work lands; the simulator, the agent's tools and the approval gate all run for real."}</p>
          <ol className="mt-2.5 grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map((s, i) => {
              const ok = g.status.progress[s.key];
              return (
                <li key={s.key}>
                  <button type="button" onClick={() => void g.run(s)} disabled={g.busy !== null} className="group -mx-2 flex w-[calc(100%+16px)] items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left transition-colors hover:bg-hover">
                    <StepMark i={i} ok={ok} busy={g.busy === s.key} />
                    <span className="min-w-0 flex-1">
                      <span className={clsx("block truncate text-[14px] font-medium", ok ? "text-muted" : "text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-2")}>{s.title}</span>
                      <span className="block truncate text-[13px] text-muted">{s.key === "run" && g.status.guideCase && !ok ? `${g.status.guideCase.buyer}'s claim, every source checked` : s.hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
