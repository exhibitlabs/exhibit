"use client";

import { clsx } from "clsx";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock3, Loader2, Play, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { expectedRecovery, type CaseBrief } from "@/lib/agent/brief";
import type { ProtectionReport } from "@/lib/agent/playbook";
import type { RunEvent } from "@/lib/agent/run";
import type { TimelineItem } from "@/lib/activity";
import type { AutopilotVerdict } from "@/lib/autopilot";
import type { ActionResult } from "@/lib/actions";
import type { CaseFile } from "@/lib/disputes";
import { dateTime, dueLabel, shortDate, usd } from "@/lib/format";
import { REASON_LABEL, STAGE_LABEL, STATUS_LABEL, type Dispute } from "@/lib/paypal/types";
import { ApprovalBanner } from "../AgentApprovals";
import type { ApiRowLite } from "../ApiInspector";
import { usePageKeys } from "../Shortcuts";
import { AI_LABEL, type AiProviderKind } from "../Sidebar";
import { Button } from "../../ui/Button";
import { Chip, DECISION_META } from "../../ui/Chip";
import { Dialog } from "../../ui/Dialog";
import { Tabs } from "../../ui/Tabs";
import { toast } from "../../ui/Toast";
import { Tip } from "../../ui/Tooltip";
import { AgentTrace } from "./AgentTrace";
import { ApiCalls } from "./ApiCalls";
import { BriefCard } from "./BriefCard";
import { CaseFacts } from "./CaseFacts";
import { CaseHistory } from "./CaseHistory";
import { ANSWER_LABEL, actionLabel, answeredBy, canAct, lifecycle, movesMoney, outcomeOf, type ActionRow } from "./caseState";
import type { Cite } from "./CitedText";
import { EvidenceGraph } from "./EvidenceGraph";
import { Lifecycle } from "./Lifecycle";
import { PacketViewer } from "./PacketViewer";
import { ProtectionCard, protectionChip, ResponsePanel } from "./ResponsePanel";

type RunState = { id: string; status: string; provider: string; model: string | null; brief: CaseBrief | null; events: RunEvent[]; finished_at?: string | null } | null;
type DetailTab = "packet" | "facts" | "trace" | "calls" | "history";
type CaseNav = { prev: { id: string; buyer: string } | null; next: { id: string; buyer: string } | null; index: number; total: number };

const TABS: DetailTab[] = ["packet", "facts", "trace", "calls", "history"];

/** Records the letter can cite, word for word: tracking numbers, the order id, signatures, delivery dates. */
function buildCites(cf: CaseFile, brief: CaseBrief | null): Cite[] {
  if (!brief) return [];
  const ex = (ref: string) => brief.exhibits.find((e) => e.ref === ref)?.label;
  const out: Cite[] = [];
  const add = (text: string | undefined | null, ref: string, title: string, detail: string) => {
    if (text && text.trim().length >= 3) out.push({ text, ref, title, detail, exhibit: ex(ref) });
  };
  const d = cf.dispute;
  const t = d.disputed_transactions[0];
  if (t) add(t.seller_transaction_id, `paypal:dispute:${d.dispute_id}`, "PayPal transaction", `Capture ${t.seller_transaction_id} · ${REASON_LABEL[d.reason]} · ${usd(Number(d.dispute_amount.value))}`);
  if (cf.order) {
    const o = cf.order;
    const detail = `${o.items.map((i) => i.name).join(", ")} · ${usd(o.total)} · placed ${shortDate(o.placed_at)}`;
    add(o.id, `order:${o.id}`, `Order ${o.id}`, detail);
    add(usd(o.total), `order:${o.id}`, `Order ${o.id} total`, detail);
    add(o.shipping_address.line1, `order:${o.id}`, "Shipping address on the PayPal transaction", `${o.shipping_address.name}, ${o.shipping_address.line1}, ${o.shipping_address.city} ${o.shipping_address.postal_code}`);
  }
  for (const s of cf.shipments) {
    const ref = `shipment:${s.id}`;
    const detail = `${s.carrier.replace(/_/g, " ")} ${s.tracking_number} · ${s.status.replace(/_/g, " ").toLowerCase()}${s.delivered_at ? ` ${shortDate(s.delivered_at)}` : ""}${s.signature ? ` · signed ${s.signature.name}` : ""}`;
    add(s.tracking_number, ref, s.direction === "RETURN" ? "Return tracking" : "Carrier tracking", detail);
    if (s.signature) add(s.signature.name, ref, "Delivery signature", `Signed ${dateTime(s.signature.at)} · ${s.carrier.replace(/_/g, " ")} ${s.tracking_number}`);
    if (s.delivered_at) add(s.delivered_at.slice(0, 10), ref, "Delivery scan", detail);
  }
  if (cf.risk) {
    const ref = `risk:${cf.risk.order_id}`;
    const detail = `AVS ${cf.risk.avs_result ?? "–"} · CVV ${cf.risk.cvv_result ?? "–"} · 3-D Secure ${cf.risk.three_ds?.toLowerCase() ?? "–"} · IP ${cf.risk.ip.city}`;
    add("3-D Secure", ref, "Checkout signals", detail);
    add("AVS", ref, "Checkout signals", detail);
  }
  add("Seller Protection", `paypal:seller-protection:${d.dispute_id}`, "PayPal Seller Protection check", "Each published US requirement checked against this case");
  for (const [text, id, title] of [
    ["return policy", "returns", "Returns & Refunds policy"],
    ["returns policy", "returns", "Returns & Refunds policy"],
    ["Terms of Sale", "terms", "Terms of Sale"],
    ["shipping policy", "shipping", "Shipping policy"],
  ] as const)
    add(text, `policy:${id}`, title, "Shown at checkout and accepted by the buyer");
  return out;
}

export function CaseWorkspace({
  initial,
  protection,
  mode,
  provider,
  nav,
  initialTab,
  guide,
}: {
  initial: { cf: CaseFile; run: RunState; running: boolean; actions: ActionRow[]; api: ApiRowLite[]; history: TimelineItem[] };
  protection: ProtectionReport;
  mode: string;
  provider: AiProviderKind;
  nav: CaseNav;
  initialTab: DetailTab | null;
  guide: string | null;
}) {
  const router = useRouter();
  const [dispute, setDispute] = useState<Dispute>(initial.cf.dispute);
  const [run, setRun] = useState<RunState>(initial.run);
  const [events, setEvents] = useState<RunEvent[]>((initial.run?.events ?? []) as RunEvent[]);
  const [running, setRunning] = useState(initial.running);
  const [api, setApi] = useState<ApiRowLite[]>(initial.api);
  const [actions, setActions] = useState<ActionRow[]>(initial.actions);
  const [history, setHistory] = useState<TimelineItem[]>(initial.history);
  const [lastAction, setLastAction] = useState<ActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>(initialTab ?? (initial.run?.brief ? "packet" : "facts"));
  const [draft, setDraft] = useState<{ key: string; letter: string; message: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [hoverRef, setHoverRef] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [compact, setCompact] = useState(false);
  const [prevBrief, setPrevBrief] = useState<CaseBrief | null>(null);
  const streaming = useRef(false);
  const queue = useRef<RunEvent[]>([]);
  const frame = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const details = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/disputes/${dispute.dispute_id}/state`, { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    if (!r) return { running: false };
    if (r.dispute) setDispute(r.dispute);
    setApi(r.api);
    setActions(r.actions);
    if (r.history) setHistory(r.history);
    if (!streaming.current) {
      setRun(r.run);
      setEvents((r.run?.events ?? []) as RunEvent[]);
      setRunning(r.running);
    }
    return r as { running: boolean };
  }, [dispute.dispute_id]);

  // A webhook, batch or agent-started run may already be in flight when the page opens.
  useEffect(() => {
    if (!running || streaming.current) return;
    const t = setInterval(async () => {
      const r = await refresh();
      if (!r.running) clearInterval(t);
    }, 1200);
    return () => clearInterval(t);
  }, [running, refresh]);

  // PayPal or an agent can change the case while it's open: refresh quietly.
  useEffect(() => {
    const t = setInterval(() => {
      if (!streaming.current && document.visibilityState === "visible") void refresh();
    }, 10_000);
    return () => clearInterval(t);
  }, [refresh]);

  // The sticky header compacts once the full title scrolls away.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCompact(!e.isIntersecting), { rootMargin: "-64px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const startEvent = events.find((e): e is Extract<RunEvent, { t: "start" }> => e.t === "start");
  const briefEvent = events.find((e): e is Extract<RunEvent, { t: "brief" }> => e.t === "brief");
  const brief = briefEvent?.brief ?? (running ? null : run?.brief) ?? null;
  const shownBrief = brief ?? (running ? prevBrief : null);
  const briefKey = startEvent?.run_id ?? run?.id ?? "none";
  const doneEvent = events.find((e): e is Extract<RunEvent, { t: "done" }> => e.t === "done");
  const autopilotEvent = events.find((e): e is Extract<RunEvent, { t: "autopilot" }> => e.t === "autopilot");
  const autoAction = events.find((e): e is Extract<RunEvent, { t: "action" }> => e.t === "action");
  const prepared = startEvent?.trigger === "seed";
  const amount = Number(dispute.dispute_amount.value);
  const t = dispute.disputed_transactions[0];
  const hours = dispute.seller_response_due_date && dispute.status !== "RESOLVED" ? Math.round((new Date(dispute.seller_response_due_date).getTime() - Date.now()) / 3600_000) : null;
  const cf: CaseFile = useMemo(() => ({ ...initial.cf, dispute }), [initial.cf, dispute]);
  const cites = useMemo(() => buildCites(cf, brief), [cf, brief]);
  const answered = answeredBy(actions);
  const allowed = canAct(dispute, brief);
  const effectiveAction = lastAction ?? (autoAction?.result.ok ? autoAction.result : null);
  const steps = lifecycle(dispute, brief, running, run?.finished_at ?? undefined, actions);
  const outcome = outcomeOf(dispute, answered?.kind);
  const letter = draft?.key === briefKey ? draft.letter : (brief?.response_letter ?? "");
  const message = draft?.key === briefKey ? draft.message : (brief?.buyer_message?.text ?? "");
  const setLetter = (v: string) => setDraft({ key: briefKey, letter: v, message });
  const setMessage = (v: string) => setDraft({ key: briefKey, letter, message: v });
  const toolSteps = events.filter((e) => e.t === "tool_call").length;
  const lastThought = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.t === "tool_call") return `Querying ${e.label}`;
      if (e.t === "thinking" || e.t === "text") {
        const line = e.text.trim().split("\n").filter(Boolean).at(-1);
        if (line) return line;
      }
    }
    return "Starting";
  }, [events]);

  const flushQueue = () => {
    frame.current = 0;
    const q = queue.current;
    queue.current = [];
    if (q.length) setEvents((prev) => [...prev, ...q]);
  };

  const start = async () => {
    if (running) return;
    setError(null);
    setLastAction(null);
    setPrevBrief(brief ?? prevBrief);
    setEvents([]);
    setRun(null);
    setRunning(true);
    setEditing(false);
    setTab("trace");
    streaming.current = true;
    let failed: string | null = null;
    try {
      const res = await fetch(`/api/disputes/${dispute.dispute_id}/run`, { method: "POST" });
      if (!res.ok || !res.body) throw new Error(`The run didn't start (${res.status}).`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const line = p.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const e = JSON.parse(line.slice(6)) as RunEvent;
          if (e.t === "error") failed = e.message;
          queue.current.push(e);
        }
        // One render per frame, however fast the stream arrives: keeps the graph and trace smooth.
        if (queue.current.length && !frame.current) frame.current = requestAnimationFrame(flushQueue);
      }
    } catch (e) {
      failed = e instanceof Error ? e.message : String(e);
    } finally {
      if (frame.current) cancelAnimationFrame(frame.current);
      flushQueue();
      streaming.current = false;
      setRunning(false);
      await refresh();
      if (failed) {
        setError(failed);
        toast({ title: "The investigation stopped", sub: prevBrief || brief ? "The previous brief is still in place." : failed, tone: "error" });
      } else {
        toast({ title: "Brief ready", sub: "Review the evidence and the response, then decide.", tone: "success" });
      }
      setPrevBrief(null);
      window.dispatchEvent(new Event("exhibit:nav"));
      router.refresh();
    }
  };

  const submit = async () => {
    setConfirm(false);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/disputes/${dispute.dispute_id}/act`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ letter, buyerMessage: brief?.buyer_message ? message : undefined }) });
      const result = (await res.json()) as ActionResult;
      setLastAction(result);
      if (result.ok) toast({ title: "Sent to PayPal", sub: result.detail, tone: "success" });
      else toast({ title: "PayPal didn't accept it", sub: result.error, tone: "error" });
      await refresh();
      window.dispatchEvent(new Event("exhibit:nav"));
    } finally {
      setSubmitting(false);
    }
  };

  const requestSubmit = () => {
    if (!brief || !allowed || submitting) return;
    setEditing(false);
    if (movesMoney(brief)) setConfirm(true);
    else void submit();
  };

  const sandbox = async (op: "decide" | "require_evidence" | "buyer_accepts_offer", outcome?: "SELLER_FAVOR" | "BUYER_FAVOR") => {
    const res = await fetch(`/api/disputes/${dispute.dispute_id}/sandbox`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, outcome }) });
    const data = await res.json();
    if (!res.ok) toast({ title: "The simulator refused", sub: data.error, tone: "error" });
    else toast({ title: op === "decide" ? (outcome === "SELLER_FAVOR" ? "PayPal ruled for the merchant" : "PayPal ruled for the buyer") : "The buyer accepted the offer", sub: "Case resolved", tone: outcome === "BUYER_FAVOR" ? "neutral" : "success" });
    await refresh();
    window.dispatchEvent(new Event("exhibit:nav"));
  };

  const showTab = (k: DetailTab) => {
    setTab(k);
    requestAnimationFrame(() => details.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  usePageKeys((k) => {
    if (k === "r" && !running) {
      void start();
      return true;
    }
    if (k === "e" && brief && !answered && !effectiveAction?.ok) {
      setEditing((v) => !v);
      return true;
    }
    if ((k === "j" && nav.next) || (k === "k" && nav.prev)) {
      router.push(`/app/disputes/${(k === "j" ? nav.next : nav.prev)!.id}`);
      return true;
    }
    const i = Number(k) - 1;
    if (Number.isInteger(i) && i >= 0 && i < TABS.length) {
      showTab(TABS[i]);
      return true;
    }
    return false;
  });

  const m = brief ? DECISION_META[brief.decision] : null;
  const filedLabel = answered ? (ANSWER_LABEL[answered.kind] ?? "Filed") : effectiveAction?.ok ? "Sent to PayPal" : null;

  const primary = running ? (
    <Button variant="primary" size="md" disabled>
      <Loader2 className="size-4 animate-spin" /> Investigating…
    </Button>
  ) : !brief ? (
    <Button variant="primary" size="md" onClick={start} className={clsx(guide === "run" && "ring-2 ring-amber ring-offset-2")}>
      <Play className="size-4" /> Run Exhibit
    </Button>
  ) : filedLabel ? (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-soft px-3.5 text-[13.5px] font-medium text-green">
      <Check className="size-4" strokeWidth={2.5} /> {filedLabel}
    </span>
  ) : allowed ? (
    <Button variant="primary" size="md" onClick={requestSubmit} disabled={submitting || editing || letter.length > 1900} className={clsx(guide === "file" && "ring-2 ring-amber ring-offset-2")}>
      {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
      {actionLabel(brief, amount)}
    </Button>
  ) : outcome ? (
    <Chip tone={outcome.tone === "green" ? "green" : outcome.tone === "red" ? "red" : "outline"} dot>
      {outcome.label}
    </Chip>
  ) : (
    <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-sunken px-3 text-[13px] text-ink-2">
      <Clock3 className="size-4" /> {dispute.status === "UNDER_REVIEW" ? "PayPal reviewing" : STATUS_LABEL[dispute.status]}
    </span>
  );

  return (
    <div className="pb-24">
      <header className={clsx("sticky top-12 z-20 border-b border-line bg-white/92 backdrop-blur-md transition-[padding] duration-200 lg:top-0", compact ? "py-2.5" : "pb-4 pt-5")}>
        <div className="px-4 sm:px-6 lg:px-8">
          {!compact ? (
            <div className="mb-3 flex items-center justify-between gap-3 text-[12.5px]">
              <Link href="/app/disputes" className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-ink">
                <ArrowLeft className="size-3.5" /> Disputes
              </Link>
              {nav.total > 1 ? (
                <span className="flex items-center gap-1 text-muted">
                  <span className="num mr-1 text-[11.5px]">
                    {nav.index + 1} of {nav.total} open
                  </span>
                  <Tip label={nav.prev ? `Previous: ${nav.prev.buyer} (K)` : "First case"}>
                    <button type="button" disabled={!nav.prev} onClick={() => nav.prev && router.push(`/app/disputes/${nav.prev.id}`)} aria-label="Previous case" className="flex size-7 items-center justify-center rounded-md border border-line bg-surface hover:border-line-strong disabled:opacity-40">
                      <ChevronLeft className="size-3.5" />
                    </button>
                  </Tip>
                  <Tip label={nav.next ? `Next: ${nav.next.buyer} (J)` : "Last case"}>
                    <button type="button" disabled={!nav.next} onClick={() => nav.next && router.push(`/app/disputes/${nav.next.id}`)} aria-label="Next case" className="flex size-7 items-center justify-center rounded-md border border-line bg-surface hover:border-line-strong disabled:opacity-40">
                      <ChevronRight className="size-3.5" />
                    </button>
                  </Tip>
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="min-w-0 flex-1">
              {!compact ? (
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="num text-[12px] text-muted">{dispute.dispute_id}</span>
                  <Chip>{STAGE_LABEL[dispute.dispute_life_cycle_stage]}</Chip>
                  <Chip tone={dispute.status === "WAITING_FOR_SELLER_RESPONSE" ? "outline" : "neutral"} dot>
                    {STATUS_LABEL[dispute.status]}
                  </Chip>
                </div>
              ) : null}
              <h1 className={clsx("display truncate leading-[1.15] transition-[font-size] duration-200", compact ? "text-[16px]" : "text-[26px]")}>
                {compact ? (
                  <Link href="/app/disputes" className="mr-2 inline-flex translate-y-[-1px] align-middle text-muted hover:text-ink" aria-label="Back to disputes">
                    <ArrowLeft className="size-4" />
                  </Link>
                ) : null}
                {t?.buyer?.name ?? "Buyer"} · {REASON_LABEL[dispute.reason]}
                {compact ? <span className="num ml-2 text-[13px] font-normal text-muted">{usd(amount)}</span> : null}
              </h1>
              {!compact ? (
                <p className="mt-1 truncate text-[13px] text-muted">
                  {t?.items?.map((i) => i.item_name).filter(Boolean).join(", ") || cf.order?.items.map((i) => i.name).join(", ") || "Order"} · <span className="num">{usd(amount)}</span> · opened {dateTime(dispute.create_time)}
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2.5">
              {hours !== null ? (
                <Tip label={`PayPal's deadline: ${dateTime(dispute.seller_response_due_date)}. Unanswered cases close for the buyer.`} wide side="bottom" align="end">
                  <span className={clsx("inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[13px]", hours < 48 ? "border-red/25 bg-red-soft text-red" : "border-line bg-surface text-ink")}>
                    <Clock3 className="size-3.5" />
                    <span suppressHydrationWarning className="num font-medium">
                      {dueLabel(hours)}
                    </span>
                    <span suppressHydrationWarning className={clsx("hidden text-[11.5px] sm:inline", hours < 48 ? "text-red/70" : "text-muted")}>
                      due {shortDate(dispute.seller_response_due_date)}
                    </span>
                  </span>
                </Tip>
              ) : null}
              {m && brief ? (
                <Tip label={brief.headline} wide side="bottom" align="end">
                  <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface pl-1.5 pr-3 text-[13px]">
                    <Chip tone={m.tone}>{m.label}</Chip>
                    <span className="num text-ink-2">{brief.win_likelihood}%</span>
                  </span>
                </Tip>
              ) : null}
              {primary}
              {brief && !running ? (
                <Tip label="Re-run Exhibit (R)" side="bottom" align="end">
                  <Button variant="secondary" size="md" onClick={start} aria-label="Re-run Exhibit" className="px-2.5">
                    <RotateCw className="size-4" />
                  </Button>
                </Tip>
              ) : null}
            </div>
          </div>
        </div>
      </header>
      <div ref={sentinel} aria-hidden className="h-px" />

      <div className="border-b border-line px-4 py-3.5 sm:px-6 lg:px-8">
        <Lifecycle steps={steps} running={running} />
      </div>

      <ApprovalBanner
        disputeId={dispute.dispute_id}
        onDecided={(r) => {
          if (r) setLastAction(r);
          void refresh();
          window.dispatchEvent(new Event("exhibit:nav"));
        }}
      />

      <div className="space-y-5 px-4 pt-5 sm:px-6 lg:px-8">
        {error ? (
          <div className="flex items-start gap-3 rounded-xl border border-red/20 bg-red-soft px-4 py-3 text-[13px] text-red">
            <span className="min-w-0 flex-1">
              <span className="font-medium">The last run stopped: </span>
              {error}
              {shownBrief || run?.brief ? <span className="text-red/80"> The brief below is the previous one, unchanged.</span> : null}
            </span>
            <button type="button" onClick={start} className="shrink-0 font-medium underline underline-offset-2">
              Try again
            </button>
          </div>
        ) : null}

        <EvidenceGraph
          dispute={dispute}
          events={events}
          brief={brief}
          running={running}
          highlight={hoverRef}
          action={
            !brief && !running ? (
              <Button variant="primary" size="sm" onClick={start}>
                <Play className="size-3.5" /> Run Exhibit
              </Button>
            ) : null
          }
          footer={
            running ? (
              <div className="flex items-center gap-2.5 border-t border-line bg-[#fcfcfc] px-5 py-2.5 text-[12.5px]">
                <span className="pulse-dot size-1.5 shrink-0 rounded-full bg-amber" />
                <span className="shrink-0 font-medium text-ink">{toolSteps} step{toolSteps === 1 ? "" : "s"}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{lastThought}</span>
                <button type="button" onClick={() => showTab("trace")} className="shrink-0 text-muted underline decoration-line-strong underline-offset-2 hover:text-ink">
                  Follow the reasoning
                </button>
              </div>
            ) : !brief && !events.length ? (
              <div className="border-t border-line bg-[#fcfcfc] px-5 py-2.5 text-[12px] text-muted">
                {provider === "replay" ? "Replays a recorded Claude run on this case. Every tool call, check and PayPal request executes live." : `Live agent on ${AI_LABEL[provider].replace(" · live", "")}. Reads only this case's records; it can't file anything.`}
              </div>
            ) : null
          }
        />

        {shownBrief ? (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <BriefCard
              brief={shownBrief}
              amount={amount}
              expected={expectedRecovery(shownBrief, amount)}
              ms={doneEvent?.ms}
              prepared={prepared && !!brief}
              stale={!brief}
              protection={protectionChip(protection)}
              hoverRef={hoverRef}
              onHoverRef={setHoverRef}
            />
            {brief && !running ? (
              <ResponsePanel
                dispute={dispute}
                brief={brief}
                letter={letter}
                setLetter={setLetter}
                message={message}
                setMessage={setMessage}
                editing={editing}
                setEditing={setEditing}
                cites={cites}
                onHoverRef={setHoverRef}
                autopilot={(autopilotEvent?.verdict as AutopilotVerdict | undefined) ?? null}
                mode={mode}
                answered={answered}
                lastAction={effectiveAction}
                submitting={submitting}
                onSubmit={requestSubmit}
                onShowCalls={() => showTab("calls")}
                onSandbox={sandbox}
                highlight={guide === "file"}
              />
            ) : (
              <div className="rounded-xl border border-dashed border-line-strong px-5 py-10 text-center text-[13px] text-muted">The new response appears when the brief is filed.</div>
            )}
          </div>
        ) : !running ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
              <div className="text-[14px] font-medium text-ink">No brief yet</div>
              <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">Run Exhibit and it checks every source above, decides whether to fight, offer, refund or message the buyer, and drafts the response with cited evidence. Nothing is sent until you decide.</p>
              <p className="mt-3 text-[12px] text-faint">
                Press <span className="num rounded border border-line bg-[#fafafa] px-1 text-muted">R</span> or use Run Exhibit above
              </p>
            </div>
            <ProtectionCard report={protection} defaultOpen />
          </div>
        ) : null}

        <div ref={details} className="scroll-mt-28">
          <div className="mb-3 border-b border-line">
            <Tabs
              value={tab}
              onChange={setTab}
              tabs={[
                { key: "packet", label: "Evidence packet", count: brief?.exhibits.length || undefined, hidden: !brief || running },
                { key: "facts", label: "Case facts" },
                { key: "trace", label: running ? "Investigating" : "Investigation", count: toolSteps || undefined },
                { key: "calls", label: "PayPal calls", count: api.length },
                { key: "history", label: "History", count: history.filter((h) => h.lane !== "api").length || undefined },
              ]}
            />
          </div>
          {tab === "packet" && brief && !running ? <PacketViewer disputeId={dispute.dispute_id} brief={brief} letter={letter} hoverRef={hoverRef} /> : null}
          {tab === "facts" || (tab === "packet" && (!brief || running)) ? (
            <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-3">
              <CaseFacts cf={cf} />
              <ProtectionCard report={protection} defaultOpen />
            </div>
          ) : null}
          {tab === "trace" ? (
            <section className="card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3 text-[12.5px]">
                <span className="flex items-center gap-2 font-medium">
                  {running ? <span className="pulse-dot size-2 rounded-full bg-amber" /> : <span className="size-2 rounded-full bg-green" />}
                  {running ? "Investigating" : events.length ? "Investigation" : "No investigation yet"}
                  <span className="font-normal text-muted">
                    · {toolSteps} tool call{toolSteps === 1 ? "" : "s"}
                    {doneEvent && !prepared ? ` · ${(doneEvent.ms / 1000).toFixed(1)}s` : ""}
                  </span>
                </span>
                <span className="text-muted">
                  {run?.provider === "replay" || startEvent?.provider === "replay" ? (prepared ? "Recorded run, replayed at demo reset · tools executed live" : "Recorded run · tools executed live") : run?.model ?? startEvent?.model ?? ""}
                </span>
              </div>
              <div className="px-5 py-5">{events.length ? <AgentTrace events={events} running={running} /> : <p className="text-[13px] text-muted">Run Exhibit to see each step: the records it reads, what it concludes, and the brief it files.</p>}</div>
            </section>
          ) : null}
          {tab === "calls" ? <ApiCalls rows={api} mode={mode} /> : null}
          {tab === "history" ? <CaseHistory items={history} /> : null}
        </div>
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={brief?.paypal_action.type === "make_offer" ? "Send this offer?" : "Refund the buyer?"}
        width={460}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={submit}>
              {brief ? actionLabel(brief, amount) : "Confirm"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-ink-2">
          {brief?.paypal_action.type === "accept_claim"
            ? `Exhibit accepts the claim through PayPal's accept-claim call. PayPal refunds ${t?.buyer?.name ?? "the buyer"} ${usd(amount)} and closes the case.`
            : brief?.paypal_action.type === "refund_then_prove"
              ? `Exhibit refunds ${usd(brief.paypal_action.amount ?? amount)} on the PayPal capture, then files proof of refund so PayPal can close the case.`
              : `Exhibit offers ${usd(brief?.paypal_action.amount ?? 0)} to ${t?.buyer?.name ?? "the buyer"} through PayPal. Money moves only if the buyer accepts.`}{" "}
          {mode === "demo" ? "This demo sends it to the PayPal simulator." : "This is the PayPal sandbox."}
        </p>
        <p className="mt-2 text-[12.5px] text-muted">
          {brief?.paypal_action.type === "make_offer" ? "A fair offer settles the case without a fight." : "Exhibit found the buyer is right here: refunding now avoids a lost fight and its fee, and keeps the customer."} The call is logged in PayPal activity.
        </p>
      </Dialog>
    </div>
  );
}
