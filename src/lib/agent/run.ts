import "server-only";
import { randomUUID } from "node:crypto";
import { AI_MODEL, aiProvider } from "../config";
import { db, logActivity, now } from "../db";
import { cachedDispute } from "../disputes";
import { evaluateAutopilot, type AutopilotVerdict } from "../autopilot";
import { executeBriefAction, type ActionResult } from "../actions";
import { store } from "../store/repo";
import { runWithAnthropic } from "./providers/anthropic";
import { runWithClaudeCode } from "./providers/claude-code";
import { runWithReplay, saveReplay } from "./providers/replay";
import type { AgentEvent, ToolContext } from "./tools";

export type RunEvent = AgentEvent | { t: "autopilot"; verdict: AutopilotVerdict } | { t: "action"; result: ActionResult };

/** Merges streamed deltas so stored runs stay compact. */
function append(events: RunEvent[], e: RunEvent) {
  const last = events[events.length - 1];
  if ((e.t === "thinking" || e.t === "text") && last && last.t === e.t) last.text += e.text;
  else events.push(structuredClone(e));
}

// Shared through globalThis: in development the API routes and pages can load separate copies of
// this module, and a case page opened mid-run (after a webhook, say) must still see the run.
const g = globalThis as typeof globalThis & { __exhibitRuns?: Map<string, Promise<void>> };
const running = (g.__exhibitRuns ??= new Map<string, Promise<void>>());

export function isRunning(disputeId: string) {
  return running.has(disputeId);
}

/**
 * Runs the agent on one dispute. Events stream to `emit` as they happen and are persisted, so a
 * page reload mid-run still shows the trace.
 */
export async function runAgent(disputeId: string, emit: (e: RunEvent) => void = () => {}, opts: { trigger?: "manual" | "webhook" | "batch" | "agent" } = {}) {
  const existing = running.get(disputeId);
  if (existing) {
    emit({ t: "error", message: "Exhibit is already working on this dispute." });
    return existing;
  }
  const provider = aiProvider();
  const runId = `run_${randomUUID().slice(0, 12)}`;
  const started = Date.now();
  const events: RunEvent[] = [];
  let lastFlush = 0;
  const conn = db();
  conn.prepare("INSERT INTO runs (id, dispute_id, provider, model, status, started_at) VALUES (?, ?, ?, ?, 'running', ?)").run(runId, disputeId, provider, provider === "replay" ? "recorded" : AI_MODEL, now());

  const flush = (force = false) => {
    if (!force && Date.now() - lastFlush < 400) return;
    lastFlush = Date.now();
    conn.prepare("UPDATE runs SET events = ? WHERE id = ?").run(JSON.stringify(events), runId);
  };
  const push = (e: RunEvent) => {
    append(events, e);
    try {
      emit(e);
    } catch {
      // The client went away; keep running and persisting.
    }
    flush(e.t !== "thinking" && e.t !== "text");
  };

  const work = (async () => {
    push({ t: "start", run_id: runId, provider, model: provider === "replay" ? "recorded run" : AI_MODEL, at: now(), dispute_id: disputeId });
    logActivity("agent", `Exhibit started on ${disputeId} (${opts.trigger ?? "manual"}, ${provider})`, disputeId);
    const ctx: ToolContext = { disputeId, emit: push };
    try {
      const { usage } =
        provider === "anthropic" ? await runWithAnthropic(ctx) : provider === "claude-code" ? await runWithClaudeCode(ctx) : await runWithReplay(ctx);
      const brief = ctx.brief!;
      push({ t: "brief", brief });
      const ms = Date.now() - started;
      push({ t: "done", ms, usage });
      conn.prepare("UPDATE runs SET status = 'done', finished_at = ?, brief = ?, events = ? WHERE id = ?").run(now(), JSON.stringify(brief), JSON.stringify(events), runId);
      logActivity("agent", `Brief filed for ${disputeId}: ${brief.decision} (${brief.win_likelihood}%) in ${(ms / 1000).toFixed(1)}s`, disputeId);

      if (process.env.EXHIBIT_RECORD_REPLAYS === "1" && provider !== "replay") {
        const meta = store.scenario(disputeId);
        if (meta) {
          const keep = events.filter((e): e is AgentEvent => ["thinking", "text", "tool_call"].includes(e.t));
          saveReplay({ scenario: meta.key, model: AI_MODEL, recorded_at: now(), ids: { dispute_id: disputeId, order_id: meta.order_id }, events: keep, brief });
        }
      }

      const d = ctx.dispute ?? cachedDispute(disputeId);
      if (d) {
        const verdict = evaluateAutopilot(brief, d);
        push({ t: "autopilot", verdict });
        // Runs started by an external AI agent (MCP) never execute: the merchant approves those in Exhibit.
        if (verdict.verdict === "AUTO" && opts.trigger !== "agent") {
          const result = await executeBriefAction(disputeId, {}, "autopilot");
          push({ t: "action", result });
        }
        flush(true);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      push({ t: "error", message });
      conn.prepare("UPDATE runs SET status = 'error', finished_at = ?, error = ?, events = ? WHERE id = ?").run(now(), message, JSON.stringify(events), runId);
      logActivity("agent_error", `Exhibit failed on ${disputeId}: ${message}`, disputeId);
    } finally {
      running.delete(disputeId);
    }
  })();
  running.set(disputeId, work);
  return work;
}
