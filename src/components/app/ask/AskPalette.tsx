"use client";

import { clsx } from "clsx";
import { Activity, ArrowLeft, ArrowUpRight, Check, CornerDownLeft, CornerDownRight, Inbox, LayoutDashboard, Play, Radar, RefreshCw, Settings, Sparkle, Sparkles, TriangleAlert, Wrench } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Answer, AskEvent, AskIndex, AskProviderKind } from "@/lib/ask/schema";
import { SUGGESTED_QUESTIONS } from "@/lib/ask/schema";

const AskChart = dynamic(() => import("./AskChart").then((m) => m.AskChart), { ssr: false, loading: () => <div className="h-[176px] shimmer rounded-lg" /> });

// ---- Types --------------------------------------------------------------------------------------

type Step = { id: string; label: string; summary?: string; ms?: number; ok?: boolean };
type Turn = { id: string; q: string; steps: Step[]; text: string; answer?: Answer; status: "thinking" | "streaming" | "done" | "error"; error?: string; notice?: string; ms?: number };
type Item = { key: string; group: string; icon: ReactNode; label: ReactNode; text: string; meta?: ReactNode; hint?: string; run: () => void };

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const dueLabel = (h: number | null) => (h === null ? null : h < 0 ? "Overdue" : h <= 72 ? `${h}h left` : `${Math.round(h / 24)}d left`);

export const openAsk = (question?: string) => window.dispatchEvent(new CustomEvent("exhibit:ask", { detail: { question } }));

// ---- Small pieces -------------------------------------------------------------------------------

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="num inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-[5px] border border-line bg-[#fafafa] px-1 text-[10.5px] font-medium text-muted shadow-[0_1px_0_var(--line)]">{children}</kbd>;
}

function Caret() {
  return <span aria-hidden className="ask-caret ml-[2px] inline-block h-[1.05em] w-[7px] translate-y-[3px] rounded-[1.5px] bg-ink" />;
}

function inline(s: string, key: string) {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
      <strong key={`${key}-${i}`} className="font-semibold text-ink">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={`${key}-${i}`}>{part}</Fragment>
    ),
  );
}

/** Paragraphs, "- " bullet runs and **bold**: all the formatting answers use. */
function Rich({ text, streaming }: { text: string; streaming: boolean }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const isBullet = /^\s*[-•]\s/.test(raw);
    if (!raw.trim()) {
      blocks.push({ list: false, lines: [] });
      continue;
    }
    const last = blocks.at(-1);
    if (last && last.lines.length && last.list === isBullet && (isBullet || !last.list)) last.lines.push(isBullet ? raw.replace(/^\s*[-•]\s/, "") : raw);
    else blocks.push({ list: isBullet, lines: [isBullet ? raw.replace(/^\s*[-•]\s/, "") : raw] });
  }
  const shown = blocks.filter((b) => b.lines.length);
  return (
    <div className="space-y-2.5 text-[14px] leading-[1.62] text-ink-2">
      {shown.map((b, i) => {
        const last = i === shown.length - 1;
        return b.list ? (
          <ul key={i} className="space-y-1.5">
            {b.lines.map((l, j) => (
              <li key={j} className="relative pl-4 before:absolute before:left-[2px] before:top-[0.78em] before:h-[1.5px] before:w-[7px] before:rounded-full before:bg-[#c7c7c7]">
                {inline(l, `${i}-${j}`)}
                {last && streaming && j === b.lines.length - 1 ? <Caret /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {inline(b.lines.join(" "), `${i}`)}
            {last && streaming ? <Caret /> : null}
          </p>
        );
      })}
      {streaming && !shown.length ? <Caret /> : null}
    </div>
  );
}

function StepRow({ step }: { step: Step }) {
  const done = step.summary !== undefined;
  return (
    <div className="ask-fade flex h-[22px] items-center gap-2 text-[12px]">
      <span className="flex size-3.5 shrink-0 items-center justify-center">
        {!done ? (
          <span className="size-3 animate-spin rounded-full border-[1.5px] border-line-strong border-t-ink" />
        ) : step.ok ? (
          <Check className="size-3.5 text-faint" strokeWidth={2.25} />
        ) : (
          <TriangleAlert className="size-3.5 text-red" strokeWidth={2} />
        )}
      </span>
      <span className={clsx("truncate", done ? "text-muted" : "text-ink-2")}>{done ? step.summary : `${step.label}…`}</span>
      {done && step.ms !== undefined ? <span className="num ml-auto shrink-0 text-[11px] text-faint">{(step.ms / 1000).toFixed(1)}s</span> : null}
    </div>
  );
}

function CaseCard({ c, onGo }: { c: Answer["cases"][number]; onGo: () => void }) {
  const due = dueLabel(c.hoursLeft);
  return (
    <Link href={c.href} onClick={onGo} className="group flex min-w-0 items-center gap-3 rounded-[10px] border border-line bg-surface px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-[#fafafa]">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">{c.buyer}</div>
        <div className="truncate text-[11.5px] text-muted">
          {c.reason} · {c.note ?? c.status}
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="num text-[12.5px] text-ink">{usd(c.amount)}</div>
        {due ? <div className={clsx("num text-[11px]", c.hoursLeft !== null && c.hoursLeft <= 72 ? "text-red" : "text-faint")}>{due}</div> : null}
      </div>
      <ArrowUpRight className="size-3.5 shrink-0 text-faint transition-colors group-hover:text-ink" />
    </Link>
  );
}

const BAND_DOT: Record<string, string> = { high: "bg-red", elevated: "bg-amber", watch: "bg-faint", clear: "bg-green" };

function OrderCard({ o, onGo }: { o: Answer["orders"][number]; onGo: () => void }) {
  return (
    <Link href={o.href} onClick={onGo} className="group flex min-w-0 items-center gap-3 rounded-[10px] border border-line bg-surface px-3 py-2.5 transition-colors hover:border-line-strong hover:bg-[#fafafa]">
      <span className={clsx("size-1.5 shrink-0 rounded-full", BAND_DOT[o.band] ?? "bg-faint")} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">
          {o.buyer} <span className="num text-[11.5px] font-normal text-faint">{o.id}</span>
        </div>
        <div className="truncate text-[11.5px] text-muted">{o.note && o.note !== o.signal ? `${o.signal ?? "At risk"} · ${o.note}` : (o.signal ?? o.item)}</div>
      </div>
      <div className="num shrink-0 text-[12.5px] text-ink">{usd(o.amount)}</div>
      <ArrowUpRight className="size-3.5 shrink-0 text-faint transition-colors group-hover:text-ink" />
    </Link>
  );
}

function TurnView({ turn, onAsk, onGo, latest }: { turn: Turn; onAsk: (q: string) => void; onGo: () => void; latest: boolean }) {
  const a = turn.answer;
  const streaming = turn.status === "streaming" || (turn.status === "thinking" && !!turn.text);
  return (
    <section className="px-5 pb-5 pt-4" data-turn={turn.id}>
      <h3 className="text-[15px] font-medium leading-snug tracking-[-0.01em] text-ink">{turn.q}</h3>
      <div className="mt-2.5">
        {turn.steps.map((s) => (
          <StepRow key={s.id} step={s} />
        ))}
        {turn.status === "thinking" && !turn.text && turn.steps.every((s) => s.summary !== undefined) ? (
          <div className="flex h-[22px] items-center gap-2 text-[12px]">
            <span className="flex size-3.5 items-center justify-center">
              <Sparkle className="pulse-dot size-3 text-ink" strokeWidth={2} />
            </span>
            <span className="text-ink-2">{turn.steps.length ? "Writing the answer…" : "Reading your dispute book…"}</span>
          </div>
        ) : null}
      </div>
      {turn.notice ? <div className="mt-2 rounded-md bg-sunken px-2.5 py-1.5 text-[12px] text-muted">{turn.notice}</div> : null}
      {turn.text ? (
        <div className="mt-3">
          <Rich text={turn.text} streaming={streaming} />
        </div>
      ) : null}
      {turn.status === "error" ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#f3d0d0] bg-red-soft px-3 py-2 text-[13px] text-red">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          {turn.error}
        </div>
      ) : null}
      {a?.chart ? (
        <div className="rise mt-4 rounded-xl border border-line px-3.5 pb-2.5 pt-3">
          <div className="mb-1.5 text-[12px] font-medium text-ink-2">{a.chart.title}</div>
          <AskChart chart={a.chart} />
        </div>
      ) : null}
      {a?.cases.length ? (
        <div className="rise mt-4">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">Cases</div>
          <div className="grid grid-cols-2 gap-2">
            {a.cases.map((c) => (
              <CaseCard key={c.id} c={c} onGo={onGo} />
            ))}
          </div>
        </div>
      ) : null}
      {a?.orders.length ? (
        <div className="rise mt-4">
          <div className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-faint">Orders at risk · fix in Prevention</div>
          <div className="grid grid-cols-2 gap-2">
            {a.orders.map((o) => (
              <OrderCard key={o.id} o={o} onGo={onGo} />
            ))}
          </div>
        </div>
      ) : null}
      {a?.followups.length && latest ? (
        <div className="rise mt-4 flex flex-wrap gap-1.5">
          {a.followups.map((f) => (
            <button key={f} onClick={() => onAsk(f)} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 text-[12.5px] text-ink-2 transition-colors hover:border-line-strong hover:bg-[#fafafa] hover:text-ink">
              <CornerDownRight className="size-3 text-faint" />
              {f}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ---- Palette ------------------------------------------------------------------------------------

const NAV: { label: string; href: string; icon: typeof Inbox; words: string }[] = [
  { label: "Overview", href: "/app", icon: LayoutDashboard, words: "command center home dashboard overview" },
  { label: "Disputes", href: "/app/disputes", icon: Inbox, words: "disputes inbox cases" },
  { label: "Prevention", href: "/app/protection", icon: Radar, words: "prevention protection radar at risk orders" },
  { label: "Autopilot", href: "/app/autopilot", icon: Sparkles, words: "autopilot rules automation" },
  { label: "PayPal activity", href: "/app/activity", icon: Activity, words: "paypal activity api log audit" },
  { label: "Settings", href: "/app/settings", icon: Settings, words: "settings sandbox keys" },
];

const matches = (q: string, text: string) => {
  const t = text.toLowerCase();
  return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => t.includes(w));
};

export function AskPalette({ provider, label }: { provider: AskProviderKind; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"menu" | "thread">("menu");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [index, setIndex] = useState<AskIndex | null>(null);
  const [active, setActive] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [bodyH, setBodyH] = useState(0);
  const [maxH, setMaxH] = useState(560);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const running = turns.some((t) => t.status === "thinking" || t.status === "streaming");
  const providerKind = index?.provider ?? provider;
  const providerLabel = index?.label ?? label;

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const show = useCallback(() => {
    setOpen(true);
    setView("menu");
    setQuery("");
    setActive(0);
    setMaxH(Math.max(280, Math.min(600, Math.round(window.innerHeight * 0.74) - 112)));
    fetch("/api/ask", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: AskIndex) => setIndex(d))
      .catch(() => {});
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const patch = useCallback((id: string, f: (t: Turn) => Turn) => setTurns((ts) => ts.map((t) => (t.id === id ? f(t) : t))), []);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q) return;
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const id = `t${Date.now()}`;
      const history = turns.filter((t) => t.answer).slice(-3).map((t) => ({ q: t.q, a: t.answer!.text }));
      setView("thread");
      setQuery("");
      // A turn still in flight was just aborted above: drop it rather than leave a spinner that never resolves.
      setTurns((ts) => [...ts.filter((t) => t.status === "done").slice(-4), { id, q, steps: [], text: "", status: "thinking" }]);
      try {
        const res = await fetch("/api/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q, history }), signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? `Ask failed (${res.status})`);
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const chunks = buf.split("\n\n");
          buf = chunks.pop() ?? "";
          for (const chunk of chunks) {
            const line = chunk.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const e = JSON.parse(line.slice(6)) as AskEvent;
            if (e.t === "step") patch(id, (t) => ({ ...t, steps: [...t.steps, { id: e.step.id, label: e.step.label }] }));
            else if (e.t === "step_done") patch(id, (t) => ({ ...t, steps: t.steps.map((s) => (s.id === e.id ? { ...s, summary: e.summary, ms: e.ms, ok: e.ok } : s)) }));
            else if (e.t === "text") patch(id, (t) => ({ ...t, text: t.text + e.text, status: "streaming" }));
            else if (e.t === "text_reset") patch(id, (t) => ({ ...t, text: "" }));
            else if (e.t === "notice") patch(id, (t) => ({ ...t, notice: e.message }));
            else if (e.t === "answer") patch(id, (t) => ({ ...t, answer: e.answer, text: e.answer.text, status: "done" }));
            else if (e.t === "error") patch(id, (t) => ({ ...t, status: "error", error: e.message }));
            else if (e.t === "done") patch(id, (t) => ({ ...t, ms: e.ms, status: t.status === "error" ? "error" : "done" }));
          }
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        patch(id, (t) => ({ ...t, status: "error", error: err instanceof Error ? err.message : String(err) }));
      }
    },
    [turns, patch],
  );

  // ⌘K / Ctrl+K anywhere in the app; Esc closes. The sidebar button and other pages dispatch exhibit:ask.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) close();
        else show();
      } else if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
      }
    };
    const onAsk = (e: Event) => {
      const q = (e as CustomEvent<{ question?: string }>).detail?.question;
      show();
      if (q) void ask(q);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("exhibit:ask", onAsk);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("exhibit:ask", onAsk);
    };
  }, [open, show, close, ask]);

  // ?ask=<question> opens the palette and asks on load (demo video, headless screenshots).
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const q = sp.get("ask");
    if (q === null) return;
    sp.delete("ask");
    window.history.replaceState(null, "", `${pathname}${sp.toString() ? `?${sp}` : ""}`);
    // Not cancelled on cleanup: the param is consumed once, even under StrictMode's double effects.
    setTimeout(() => {
      show();
      if (q && q !== "1") void ask(q);
    }, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Smooth height: the body animates to its content's height, up to the viewport cap.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!open || !el) return;
    const measure = () => setBodyH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, view]);

  // A new question scrolls its turn to the top, so the trace, prose and chart read from the start.
  const lastTurnId = turns.at(-1)?.id;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || view !== "thread" || !lastTurnId) return;
    const sec = el.querySelector<HTMLElement>(`[data-turn="${lastTurnId}"]`);
    if (sec) el.scrollTo({ top: sec.offsetTop, behavior: turns.length > 1 ? "smooth" : "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastTurnId, view]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const command = useCallback(
    async (key: string, fn: () => Promise<string>) => {
      setBusy(key);
      try {
        setToast(await fn());
        router.refresh();
      } catch (e) {
        setToast(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [router],
  );

  const items = useMemo<Item[]>(() => {
    const q = query.trim();
    const out: Item[] = [];
    const icon = (I: typeof Inbox) => <I className="size-4" strokeWidth={1.75} />;
    if (q) out.push({ key: "ask-free", group: "Ask Exhibit", icon: <Sparkle className="size-4" strokeWidth={1.75} />, label: <>Ask Exhibit: <span className="text-ink">“{q}”</span></>, text: q, hint: "Ask", run: () => void ask(q) });
    const sugg = (index?.suggestions ?? SUGGESTED_QUESTIONS).filter((s) => !q || matches(q, s));
    for (const s of sugg.slice(0, q ? 3 : 6)) out.push({ key: `s-${s}`, group: "Ask Exhibit", icon: <Sparkle className="size-4" strokeWidth={1.75} />, label: s, text: s, hint: "Ask", run: () => void ask(s) });
    const cmds: Item[] = [
      {
        key: "c-run",
        group: "Commands",
        icon: icon(Play),
        label: "Run Exhibit on all open disputes",
        text: "run exhibit investigate all open disputes batch",
        meta: busy === "c-run" ? <span className="size-3 animate-spin rounded-full border-[1.5px] border-line-strong border-t-ink" /> : undefined,
        run: () =>
          void command("c-run", async () => {
            const r = (await fetch("/api/batch", { method: "POST" }).then((x) => x.json())) as { queued: string[] };
            return r.queued.length ? `Exhibit is investigating ${r.queued.length} case${r.queued.length === 1 ? "" : "s"}` : "Every open dispute already has a brief";
          }),
      },
      {
        key: "c-sync",
        group: "Commands",
        icon: icon(RefreshCw),
        label: "Sync disputes from PayPal",
        text: "sync paypal refresh disputes pull",
        meta: busy === "c-sync" ? <span className="size-3 animate-spin rounded-full border-[1.5px] border-line-strong border-t-ink" /> : undefined,
        run: () =>
          void command("c-sync", async () => {
            const r = await fetch("/api/disputes/sync", { method: "POST" }).then((x) => x.json());
            if (r.error) throw new Error(r.error);
            return `Synced ${r.rows.length} disputes from PayPal`;
          }),
      },
    ];
    for (const n of NAV) cmds.push({ key: `n-${n.href}`, group: "Go to", icon: icon(n.icon), label: `Open ${n.label}`, text: `open go ${n.words}`, hint: "Open", run: () => go(n.href) });
    const cases = (index?.cases ?? []).filter((c) => (q ? matches(q, `${c.buyer} ${c.id} ${c.reason} ${c.status} case dispute`) : true)).slice(0, q ? 5 : 3);
    const caseItems: Item[] = cases.map((c) => ({
      key: `case-${c.id}`,
      group: q ? "Cases" : "Closest deadlines",
      icon: icon(Inbox),
      label: (
        <>
          {c.buyer} <span className="text-faint">· {c.reason}</span>
        </>
      ),
      text: c.buyer,
      meta: (
        <span className="num flex items-center gap-2 text-[12px]">
          {dueLabel(c.hoursLeft) ? <span className={c.hoursLeft !== null && c.hoursLeft <= 72 ? "text-red" : "text-faint"}>{dueLabel(c.hoursLeft)}</span> : null}
          <span className="text-ink-2">{usd(c.amount)}</span>
        </span>
      ),
      run: () => go(`/app/disputes/${c.id}`),
    }));
    const orders = (index?.orders ?? []).filter((o) => (q ? matches(q, `fix order ${o.buyer} ${o.id} ${o.signal ?? ""} ${o.item} prevention risk`) : false)).slice(0, 4);
    const orderItems: Item[] = orders.map((o) => ({
      key: `o-${o.id}`,
      group: "Prevention",
      icon: icon(Wrench),
      label: (
        <>
          Fix {o.buyer}&apos;s order <span className="text-faint">· {o.signal ?? "at risk"}</span>
        </>
      ),
      text: o.buyer,
      meta: <span className="num text-[12px] text-ink-2">{usd(o.amount)}</span>,
      run: () => go(`/app/protection?order=${encodeURIComponent(o.id)}`),
    }));
    const filteredCmds = cmds.filter((c) => !q || matches(q, `${c.text} ${typeof c.label === "string" ? c.label : ""}`));
    if (q) out.push(...caseItems, ...orderItems, ...filteredCmds);
    else out.push(...filteredCmds.slice(0, 2), ...caseItems, ...filteredCmds.slice(2, 5));
    return out;
  }, [query, index, ask, go, command, busy]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (view === "menu") {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(items.length - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        items[active]?.run();
      } else if (e.key === "Backspace" && !query && turns.length) {
        setView("thread");
      }
    } else {
      if (e.key === "Enter" && query.trim()) {
        e.preventDefault();
        void ask(query);
      } else if (e.key === "Backspace" && !query && !running) {
        e.preventDefault();
        setView("menu");
      }
    }
  };

  if (!open) return null;

  let lastGroup = "";
  return (
    <div className="ask-fade fixed inset-0 z-[100] flex justify-center bg-[rgb(250_250_250/0.55)] px-4 pt-[11vh] backdrop-blur-[3px]" onMouseDown={(e) => e.target === e.currentTarget && close()} role="dialog" aria-modal="true" aria-label="Ask Exhibit">
      <div className="ask-in flex h-fit w-full max-w-[700px] flex-col overflow-hidden rounded-2xl border border-[#e4e4e4] bg-surface shadow-[0_32px_90px_-20px_rgb(0_0_0/0.22),0_10px_28px_-12px_rgb(0_0_0/0.12)]">
        {/* Input */}
        <div className="flex h-[54px] shrink-0 items-center gap-3 border-b border-line px-4">
          {view === "thread" ? (
            <button onClick={() => setView("menu")} className="flex size-6 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink" aria-label="Back">
              <ArrowLeft className="size-4" strokeWidth={1.75} />
            </button>
          ) : (
            <Sparkle className="size-[18px] text-ink" strokeWidth={1.75} />
          )}
          {view === "thread" ? <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11.5px] font-medium text-ink-2">Ask Exhibit</span> : null}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={view === "thread" ? (running ? "Exhibit is answering…" : "Ask a follow-up…") : "Ask about your disputes, or jump to a case…"}
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
            spellCheck={false}
            autoComplete="off"
          />
          {query && view === "thread" ? (
            <span className="flex items-center gap-1 text-[11.5px] text-muted">
              <Kbd>
                <CornerDownLeft className="size-3" />
              </Kbd>
            </span>
          ) : (
            <Kbd>esc</Kbd>
          )}
        </div>

        {/* Body */}
        <div
          ref={scrollRef}
          style={{ height: Math.min(bodyH, maxH) }}
          className="scroll-thin relative overflow-y-auto overscroll-contain transition-[height] duration-[260ms] ease-[cubic-bezier(0.2,0.9,0.3,1)]"
        >
          <div ref={contentRef}>
            {view === "menu" ? (
              <div ref={listRef} className="p-2">
                {items.length === 0 ? <div className="px-3 py-6 text-center text-[13px] text-muted">No matches</div> : null}
                {items.map((it, i) => {
                  const header = it.group !== lastGroup ? it.group : null;
                  lastGroup = it.group;
                  return (
                    <Fragment key={it.key}>
                      {header ? <div className="px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-faint first:pt-1">{header}</div> : null}
                      <button
                        data-idx={i}
                        onMouseMove={() => active !== i && setActive(i)}
                        onClick={() => it.run()}
                        className={clsx("flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[13.5px] transition-colors", i === active ? "bg-[#f3f3f3] text-ink" : "text-ink-2")}
                      >
                        <span className={clsx("flex size-6 shrink-0 items-center justify-center rounded-md", i === active ? "text-ink" : "text-muted")}>{it.icon}</span>
                        <span className="min-w-0 flex-1 truncate">{it.label}</span>
                        {it.meta}
                        {i === active && it.hint ? (
                          <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] text-muted">
                            {it.hint}
                            <Kbd>
                              <CornerDownLeft className="size-3" />
                            </Kbd>
                          </span>
                        ) : null}
                      </button>
                    </Fragment>
                  );
                })}
              </div>
            ) : (
              <div className="divide-y divide-line">
                {turns.map((t, i) => (
                  <TurnView key={t.id} turn={t} latest={i === turns.length - 1} onAsk={(q) => void ask(q)} onGo={close} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex h-10 shrink-0 items-center gap-3 border-t border-line bg-[#fcfcfc] px-4 text-[11.5px] text-muted">
          {toast ? (
            <span className="ask-fade flex items-center gap-1.5 text-ink-2">
              <Check className="size-3.5 text-green" strokeWidth={2.25} />
              {toast}
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <span className={clsx("size-1.5 shrink-0 rounded-full", providerKind === "offline" ? "bg-faint" : "bg-green")} />
              <span className="truncate">{providerLabel}</span>
              <span className="text-faint">· read-only, grounded in your data</span>
            </span>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-3">
            {view === "menu" ? (
              <>
                <span className="flex items-center gap-1">
                  <Kbd>↑</Kbd>
                  <Kbd>↓</Kbd>
                </span>
                <span className="flex items-center gap-1">
                  <Kbd>
                    <CornerDownLeft className="size-3" />
                  </Kbd>
                  select
                </span>
              </>
            ) : (
              <span className="flex items-center gap-1">
                <Kbd>⌫</Kbd> back
              </span>
            )}
            <span className="flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
