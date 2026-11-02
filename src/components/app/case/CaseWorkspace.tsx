"use client";

import { clsx } from "clsx";
import { ArrowLeft, ChevronDown, Play, RotateCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { expectedRecovery, type CaseBrief } from "@/lib/agent/brief";
import type { ProtectionReport } from "@/lib/agent/playbook";
import type { RunEvent } from "@/lib/agent/run";
import type { AutopilotVerdict } from "@/lib/autopilot";
import type { ActionResult } from "@/lib/actions";
import type { CaseFile } from "@/lib/disputes";
import { dateTime, dueLabel, usd } from "@/lib/format";
import { REASON_LABEL, STAGE_LABEL, STATUS_LABEL, type Dispute } from "@/lib/paypal/types";
import { ApprovalBanner } from "../AgentApprovals";
import { Button } from "../../ui/Button";
import { Chip, outcomeMeta } from "../../ui/Chip";
import { AgentTrace } from "./AgentTrace";
import { BriefCard } from "./BriefCard";
import { CaseFacts } from "./CaseFacts";
import { EvidenceGraph } from "./EvidenceGraph";
import { ProtectionCard, ResponsePanel } from "./ResponsePanel";

type ApiLog = { id: number; at: string; message: string; meta: { method: string; path: string; status: number; ms: number; debugId?: string } };
type ActionRow = { id: string; kind: string; actor: string; status: string; created_at: string; response: unknown };
type RunState = { id: string; status: string; provider: string; model: string | null; brief: CaseBrief | null; events: RunEvent[] } | null;

function readEvents(run: RunState) {
  return (run?.events ?? []) as RunEvent[];
}

export function CaseWorkspace({ initial, protection, mode, provider }: { initial: { cf: CaseFile; run: RunState; running: boolean; actions: ActionRow[]; api: ApiLog[] }; protection: ProtectionReport; mode: string; provider: string }) {
  const router = useRouter();
  const [dispute, setDispute] = useState<Dispute>(initial.cf.dispute);
  const [run, setRun] = useState<RunState>(initial.run);
  const [events, setEvents] = useState<RunEvent[]>(readEvents(initial.run));
  const [running, setRunning] = useState(initial.running);
  const [api, setApi] = useState<ApiLog[]>(initial.api);
  const [actions, setActions] = useState<ActionRow[]>(initial.actions);
  const [lastAction, setLastAction] = useState<ActionResult | null>(null);
  const [traceOpen, setTraceOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streaming = useRef(false);

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/disputes/${dispute.dispute_id}/state`, { cache: "no-store" }).then((x) => x.json());
    if (r.dispute) setDispute(r.dispute);
    setApi(r.api);
    setActions(r.actions);
    if (!streaming.current) {
      setRun(r.run);
      setEvents(readEvents(r.run));
      setRunning(r.running);
    }
    return r as { running: boolean };
  }, [dispute.dispute_id]);

  // A webhook or batch run may already be in flight when the page opens.
  useEffect(() => {
    if (!running || streaming.current) return;
    const t = setInterval(async () => {
      const r = await refresh();
      if (!r.running) clearInterval(t);
    }, 1200);
    return () => clearInterval(t);
  }, [running, refresh]);

  const start = async () => {
    setError(null);
    setLastAction(null);
    setEvents([]);
    setRun(null);
    setRunning(true);
    setTraceOpen(true);
    streaming.current = true;
    try {
      const res = await fetch(`/api/disputes/${dispute.dispute_id}/run`, { method: "POST" });
      if (!res.body) throw new Error("No stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        const batch: RunEvent[] = [];
        for (const p of parts) {
          const line = p.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const e = JSON.parse(line.slice(6)) as RunEvent;
          batch.push(e);
          if (e.t === "error") setError(e.message);
        }
        if (batch.length) setEvents((prev) => [...prev, ...batch]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      streaming.current = false;
      setRunning(false);
      await refresh();
      setTraceOpen(false);
      router.refresh();
    }
  };

  const submit = async (overrides: { letter: string; buyerMessage?: string }) => {
    const res = await fetch(`/api/disputes/${dispute.dispute_id}/act`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(overrides) });
    setLastAction(await res.json());
    await refresh();
  };

  const sandbox = async (op: "decide" | "require_evidence" | "buyer_accepts_offer", outcome?: "SELLER_FAVOR" | "BUYER_FAVOR") => {
    const res = await fetch(`/api/disputes/${dispute.dispute_id}/sandbox`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, outcome }) });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    await refresh();
  };

  const briefEvent = events.find((e): e is Extract<RunEvent, { t: "brief" }> => e.t === "brief");
  const brief = briefEvent?.brief ?? (running ? null : run?.brief) ?? null;
  const doneEvent = events.find((e): e is Extract<RunEvent, { t: "done" }> => e.t === "done");
  const autopilotEvent = events.find((e): e is Extract<RunEvent, { t: "autopilot" }> => e.t === "autopilot");
  const autoAction = events.find((e): e is Extract<RunEvent, { t: "action" }> => e.t === "action");
  const amount = Number(dispute.dispute_amount.value);
  const t = dispute.disputed_transactions[0];
  const hours = dispute.seller_response_due_date && dispute.status !== "RESOLVED" ? Math.round((new Date(dispute.seller_response_due_date).getTime() - Date.now()) / 3600_000) : null;
  const outcome = outcomeMeta(dispute.dispute_outcome?.outcome_code);
  const steps = events.filter((e) => e.t === "tool_call").length;
  const showTrace = running || traceOpen || !brief;
  const cf: CaseFile = { ...initial.cf, dispute };
  const effectiveAction = lastAction ?? (autoAction?.result.ok ? autoAction.result : null);

  return (
    <div className="pb-16">
      <div className="border-b border-line px-8 pb-5 pt-6">
        <Link href="/app/disputes" className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] text-muted hover:text-ink">
          <ArrowLeft className="size-3.5" /> Disputes
        </Link>
        <div className="flex items-end justify-between gap-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="num text-[12.5px] text-muted">{dispute.dispute_id}</span>
              <Chip>{STAGE_LABEL[dispute.dispute_life_cycle_stage]}</Chip>
              {outcome ? (
                <Chip tone={outcome.tone} dot>
                  {outcome.label}
                </Chip>
              ) : (
                <Chip tone={dispute.status === "WAITING_FOR_SELLER_RESPONSE" ? "outline" : "neutral"} dot>
                  {STATUS_LABEL[dispute.status]}
                </Chip>
              )}
            </div>
            <h1 className="display text-[30px] leading-[1.1]">
              {t?.buyer?.name ?? "Buyer"} · {REASON_LABEL[dispute.reason]}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-muted">
              {t?.items?.map((i) => i.item_name).filter(Boolean).join(", ") || initial.cf.order?.items.map((i) => i.name).join(", ") || "Order"} · <span className="num">{usd(amount)}</span> · opened {dateTime(dispute.create_time)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-5">
            {hours !== null ? (
              <div className="text-right">
                <div className="text-[11.5px] text-muted">Response due</div>
                <div suppressHydrationWarning className={clsx("num text-[22px] leading-tight", hours < 48 ? "text-red" : "text-ink")}>{dueLabel(hours)}</div>
              </div>
            ) : null}
            <Button variant={brief ? "secondary" : "primary"} size="lg" disabled={running} onClick={start}>
              {running ? <RotateCw className="size-4 animate-spin" /> : brief ? <RotateCw className="size-4" /> : <Play className="size-4" />}
              {running ? "Investigating…" : brief ? "Re-run Exhibit" : "Run Exhibit"}
            </Button>
          </div>
        </div>
      </div>

      <ApprovalBanner
        disputeId={dispute.dispute_id}
        onDecided={(r) => {
          if (r) setLastAction(r);
          void refresh();
        }}
      />

      <div className="space-y-2 px-8 pt-6">
        <EvidenceGraph
          dispute={dispute}
          events={events}
          brief={brief}
          running={running}
          action={
            !brief && !running ? (
              <Button variant="primary" size="sm" onClick={start}>
                <Play className="size-3.5" /> Run Exhibit
              </Button>
            ) : null
          }
        />
        {!brief && !running && !events.length ? (
          <p className="-mt-1 px-1 text-[11.5px] text-faint">{provider === "replay" ? "No model key configured: replays a recorded run; every tool call still executes live." : `Live agent · ${provider === "anthropic" ? "Claude API" : "Claude (local login)"}`}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-[288px_minmax(0,1fr)_372px] gap-5 px-8 pt-6 min-[1600px]:grid-cols-[330px_minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <CaseFacts cf={cf} />
        </div>

        <div className="min-w-0 space-y-4">
          {error ? <div className="rounded-lg bg-red-soft px-4 py-3 text-[13px] text-red">{error}</div> : null}
          {brief ? <BriefCard brief={brief} amount={amount} expected={expectedRecovery(brief, amount)} ms={doneEvent?.ms} /> : null}

          {events.length || running ? (
            <section className="card">
              <button type="button" onClick={() => setTraceOpen(!traceOpen)} className="flex w-full items-center justify-between px-5 py-3.5">
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  {running ? <span className="size-2 rounded-full bg-amber pulse-dot" /> : <span className="size-2 rounded-full bg-green" />}
                  {running ? "Investigating" : "Investigation"}
                  <span className="font-normal text-muted">
                    · {steps} step{steps === 1 ? "" : "s"}
                    {doneEvent ? ` · ${(doneEvent.ms / 1000).toFixed(1)}s` : ""}
                    {run?.model && !running ? ` · ${run.model}` : ""}
                  </span>
                </span>
                {!running ? <ChevronDown className={clsx("size-4 text-faint transition-transform", showTrace && "rotate-180")} /> : null}
              </button>
              {showTrace ? (
                <div className="border-t border-line px-5 py-5">
                  <AgentTrace events={events} running={running} />
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="card">
            <div className="flex items-center justify-between px-5 py-3.5">
              <span className="text-[13px] font-medium">PayPal API calls</span>
              <span className="text-[12px] text-muted">{api.length} this case</span>
            </div>
            <div className="scroll-thin max-h-64 overflow-auto border-t border-line">
              <table className="w-full text-[12px]">
                <tbody>
                  {api.map((r) => (
                    <tr key={r.id} className="border-b border-line/70 last:border-0">
                      <td className="num w-14 py-2 pl-5 text-ink-2">{r.meta.method}</td>
                      <td className="num max-w-0 truncate py-2 pr-3 text-ink-2">{r.meta.path}</td>
                      <td className={clsx("num w-12 py-2 text-right", r.meta.status < 300 ? "text-green" : "text-red")}>{r.meta.status}</td>
                      <td className="num w-20 py-2 pl-2 text-right text-faint">{r.meta.ms}ms</td>
                      <td className="num w-36 max-w-36 truncate py-2 pl-3 pr-5 text-right text-faint">{r.meta.debugId ?? ""}</td>
                    </tr>
                  ))}
                  {!api.length ? (
                    <tr>
                      <td className="px-5 py-4 text-muted">No calls yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          {actions.length ? (
            <section className="card px-5 py-4">
              <div className="mb-2 text-[13px] font-medium">Actions</div>
              <ul className="space-y-1.5 text-[12.5px]">
                {actions.map((a) => (
                  <li key={a.id} className="flex items-center gap-2">
                    <span className={clsx("size-1.5 rounded-full", a.status === "ok" ? "bg-green" : "bg-red")} />
                    <span className="num text-ink-2">{a.kind}</span>
                    <span className="text-muted">by {a.actor}</span>
                    <span className="ml-auto text-faint">{dateTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          <ProtectionCard report={protection} />
          {brief && !running ? (
            <ResponsePanel
              key={run?.id ?? "brief"}
              dispute={dispute}
              brief={brief}
              autopilot={(autopilotEvent?.verdict as AutopilotVerdict | undefined) ?? null}
              mode={mode}
              lastAction={effectiveAction}
              onSubmit={submit}
              onSandbox={sandbox}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-line-strong px-5 py-8 text-center text-[13px] text-muted">{running ? "The response appears when the brief is filed." : "Run Exhibit to draft the response."}</div>
          )}
        </div>
      </div>
    </div>
  );
}
