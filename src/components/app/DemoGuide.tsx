"use client";

import { clsx } from "clsx";
import { ArrowRight, Check, ChevronDown, ListChecks, Loader2, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DemoStatus } from "@/lib/demo";
import type { GuideStep } from "@/lib/demo-progress";
import { toast } from "../ui/Toast";

type Mode = "open" | "min" | "hidden";
const KEY = "exhibit:guide";

type StepDef = { key: GuideStep; title: string; hint: string; go: (s: DemoStatus) => string | (() => Promise<string | null>) };

const STEPS: StepDef[] = [
  { key: "run", title: "Run Exhibit on a case", hint: "Watch the evidence graph query each source", go: (s) => (s.guideCase ? `/app/disputes/${s.guideCase.id}?guide=run` : "/app/disputes") },
  { key: "evidence", title: "Review the evidence", hint: "The packet PayPal's reviewer reads, page by page", go: (s) => (s.guideCase ? `/app/disputes/${s.guideCase.id}?tab=packet` : "/app/disputes") },
  { key: "file", title: "File with PayPal", hint: "One click calls provide-evidence", go: (s) => (s.guideCase ? `/app/disputes/${s.guideCase.id}?guide=file` : "/app/disputes") },
  { key: "prevent", title: "Prevent a dispute", hint: "Fix an order before the buyer files", go: () => "/app/protection" },
  { key: "ask", title: "Ask a question", hint: "Exhibit answers from your own records", go: () => "ask" },
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

/** "See Exhibit work in 3 minutes": a compact, dismissible checklist that ticks itself off as the real work happens. */
export function DemoGuide({ initial }: { initial: DemoStatus }) {
  const router = useRouter();
  const path = usePathname();
  const [status, setStatus] = useState(initial);
  const [mode, setMode] = useState<Mode | null>(null);
  const [busy, setBusy] = useState<GuideStep | null>(null);
  const prev = useRef(initial.progress);

  const update = useCallback((m: Mode) => {
    setMode(m);
    localStorage.setItem(KEY, m);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(KEY) as Mode | null;
    // First visit: open on the Command center, where the tour starts; a pill everywhere else so it
    // never covers a case. Wait a beat so the page settles before the guide slides in.
    const t = setTimeout(() => setMode(saved ?? (path === "/app" && window.innerWidth >= 1024 ? "open" : "min")), 350);
    const reopen = () => update("open");
    window.addEventListener("exhibit:guide", reopen);
    return () => {
      clearTimeout(t);
      window.removeEventListener("exhibit:guide", reopen);
    };
    // The first-visit default reads the path once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update]);

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

  // Celebrate a step the moment the real work behind it lands.
  useEffect(() => {
    const n = STEPS.filter((s) => status.progress[s.key]).length;
    for (const s of STEPS) if (status.progress[s.key] && !prev.current[s.key]) toast({ title: `Step done: ${s.title}`, sub: n === STEPS.length ? "That's the whole loop" : `${n} of ${STEPS.length} in the demo guide`, tone: "success" });
    prev.current = status.progress;
  }, [status.progress]);

  const done = STEPS.filter((s) => status.progress[s.key]).length;
  if (!mode || mode === "hidden") return null;

  const run = async (s: StepDef) => {
    const target = s.go(status);
    if (target === "ask") {
      update("min");
      window.dispatchEvent(new CustomEvent("exhibit:ask", { detail: { question: "Why are we losing item-not-received cases?" } }));
      return;
    }
    if (typeof target === "string") {
      update("min");
      router.push(target);
      return;
    }
    setBusy(s.key);
    try {
      const href = await target();
      if (href) {
        update("min");
        router.push(href);
      }
      void load();
    } finally {
      setBusy(null);
    }
  };

  if (mode === "min")
    return (
      <button
        type="button"
        onClick={() => update("open")}
        className="toast-in fixed bottom-5 right-5 z-[80] flex h-10 items-center gap-2.5 rounded-full border border-line bg-surface pl-2 pr-3.5 text-[12.5px] font-medium text-ink shadow-[0_10px_30px_-8px_rgb(0_0_0/0.18)] transition-colors hover:border-line-strong"
        aria-label={`Open the demo guide, ${done} of ${STEPS.length} done`}
      >
        <Ring value={done / STEPS.length} />
        Demo guide
        <span className="num text-muted">
          {done}/{STEPS.length}
        </span>
      </button>
    );

  return (
    <section aria-label="Demo guide" className="toast-in fixed bottom-5 right-5 z-[80] w-[344px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_60px_-18px_rgb(0_0_0/0.25),0_8px_20px_-12px_rgb(0_0_0/0.12)]">
      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
          <ListChecks className="size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold leading-tight tracking-[-0.01em]">{done === STEPS.length ? "You've seen the whole loop" : "See Exhibit work in 3 minutes"}</div>
          <div className="mt-0.5 text-[11.5px] text-muted">{done === STEPS.length ? "Every step ran for real against the simulator." : "Each step ticks off when the real work lands."}</div>
        </div>
        <button type="button" onClick={() => update("min")} aria-label="Minimize guide" className="flex size-6 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink">
          <ChevronDown className="size-4" />
        </button>
        <button type="button" onClick={() => update("hidden")} aria-label="Close guide" className="-ml-1 flex size-6 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="mx-4 mb-1.5 h-1 overflow-hidden rounded-full bg-sunken">
        <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${(done / STEPS.length) * 100}%` }} />
      </div>
      <ol className="px-2 pb-2">
        {STEPS.map((s, i) => {
          const ok = status.progress[s.key];
          return (
            <li key={s.key}>
              <button type="button" onClick={() => run(s)} disabled={busy !== null} className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[#fafafa]">
                <span className={clsx("flex size-5 shrink-0 items-center justify-center rounded-full border text-[10.5px] transition-colors", ok ? "border-green bg-green text-white" : "border-line-strong bg-surface text-muted")}>
                  {ok ? <Check className="size-3" strokeWidth={3} /> : busy === s.key ? <Loader2 className="size-3 animate-spin" /> : <span className="num">{i + 1}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={clsx("block text-[12.5px] font-medium leading-tight", ok ? "text-muted line-through decoration-line-strong" : "text-ink")}>{s.title}</span>
                  <span className="mt-0.5 block truncate text-[11.5px] text-muted">{s.key === "run" && status.guideCase && !ok ? `${status.guideCase.buyer}'s claim: watch every source get checked` : s.hint}</span>
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
              </button>
            </li>
          );
        })}
      </ol>
      <div className="border-t border-line bg-[#fcfcfc] px-4 py-2 text-[11px] text-muted">Shared demo · resets after {status.idleMinutes} minutes without activity</div>
    </section>
  );
}

function Ring({ value }: { value: number }) {
  const r = 10;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 24 24" className="size-6 -rotate-90" aria-hidden>
      <circle cx="12" cy="12" r={r} fill="none" stroke="#e5e5e5" strokeWidth="3" />
      <circle cx="12" cy="12" r={r} fill="none" stroke={value >= 1 ? "var(--green)" : "var(--ink)"} strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} className="transition-[stroke-dashoffset] duration-500" />
    </svg>
  );
}
