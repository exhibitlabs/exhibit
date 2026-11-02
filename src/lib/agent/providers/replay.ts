import "server-only";
// Offline provider: replays a recorded agent run when no model is configured. The recorded
// reasoning is replayed, but every tool call executes for real against the current case, and the
// recorded brief must pass the same validation as a live one.

import fs from "node:fs";
import path from "node:path";
import { kvGet } from "../../db";
import { caseFile } from "../../disputes";
import { store } from "../../store/repo";
import { buildScenarios } from "../../store/scenarios";
import type { CaseBrief } from "../brief";
import { dayDelta, shiftDatesDeep } from "../replay-dates";
import { executeTool, validateBrief, type AgentEvent, type ToolContext } from "../tools";

export type Replay = {
  scenario: string;
  model: string;
  recorded_at: string;
  /** When the demo merchant was seeded for this recording. Defaults to the day it was recorded. */
  seed_base?: string;
  ids: { dispute_id: string; order_id: string };
  events: AgentEvent[];
  brief: CaseBrief;
};

export const REPLAY_DIR = path.join(process.cwd(), "replays");

export function replayPath(key: string) {
  return path.join(REPLAY_DIR, `${key}.json`);
}

export function loadReplay(key: string): Replay | undefined {
  const p = replayPath(key);
  return fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as Replay) : undefined;
}

export function saveReplay(r: Replay) {
  fs.mkdirSync(REPLAY_DIR, { recursive: true });
  fs.writeFileSync(replayPath(r.scenario), JSON.stringify(r, null, 2));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function remap(value: unknown, from: Replay["ids"], to: Replay["ids"]): unknown {
  if (from.dispute_id === to.dispute_id && from.order_id === to.order_id) return value;
  const fromNo = from.order_id.replace(/^KA-/, "");
  const toNo = to.order_id.replace(/^KA-/, "");
  let s = JSON.stringify(value);
  s = s.split(from.dispute_id).join(to.dispute_id);
  for (const prefix of ["KA-", "SHP-", "RTN-", "MSG-"]) s = s.split(`${prefix}${fromNo}`).join(`${prefix}${toNo}`);
  return JSON.parse(s);
}

/**
 * The demo merchant is seeded relative to "now", so a case's dates move by whole days between the
 * recording and today. Recorded text moves by the same number of days, exactly as ids are remapped.
 */
function redate(r: Replay, scenarioKey: string, base: string | undefined): Replay {
  const recordedBase = r.seed_base ?? r.recorded_at;
  const delta = base ? dayDelta(recordedBase, base) : 0;
  if (!delta) return r;
  const then = buildScenarios(new Date(recordedBase)).find((s) => s.key === scenarioKey);
  const known = then ? (JSON.stringify(then).match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g) ?? []) : [];
  return shiftDatesDeep(r, delta, new Date(recordedBase), known);
}

export async function runWithReplay(ctx: ToolContext, opts: { fast?: boolean } = {}) {
  const meta = store.scenario(ctx.disputeId);
  const recording = meta ? loadReplay(meta.key) : undefined;
  if (!meta || !recording) {
    throw new Error("This case has no recorded run, and no live AI is configured. Sign in to the Claude CLI or set ANTHROPIC_API_KEY to investigate it live.");
  }
  const to = { dispute_id: ctx.disputeId, order_id: meta.order_id };
  const r = redate(remap(recording, recording.ids, to) as Replay, meta.key, meta.base ?? kvGet<string | null>("seeded_at", null) ?? undefined);
  const wait = (ms: number) => (opts.fast ? Promise.resolve() : sleep(ms));

  // Calls the model made back to back (no text between them) ran in parallel, so replay them that way.
  let batch: Extract<Replay["events"][number], { t: "tool_call" }>[] = [];
  const flush = async () => {
    if (!batch.length) return;
    const calls = batch;
    batch = [];
    // The on-screen stagger below is also what lets get_paypal_dispute load the case before the tools that read it
    // run. With no delays they would all start at once and fail, so run them in the recorded order instead.
    if (opts.fast) {
      for (const c of calls) await executeTool(c.name, c.input, ctx, c.id, 0);
      return;
    }
    // Staggered so the evidence graph shows each source being queried, the way a live run reads.
    await Promise.all(calls.map((c, i) => wait(i * 260).then(() => executeTool(c.name, c.input, ctx, c.id, opts.fast ? 0 : 800 + i * 420))));
    await wait(180);
  };
  for (const e of r.events) {
    if (e.t === "thinking" || e.t === "text") {
      await flush();
      if (opts.fast) {
        ctx.emit({ t: e.t, text: e.text });
        continue;
      }
      // Re-stream recorded text in small chunks so it reads like live output.
      for (let i = 0; i < e.text.length; i += 24) {
        ctx.emit({ t: e.t, text: e.text.slice(i, i + 24) });
        await sleep(12);
      }
    } else if (e.t === "tool_call" && e.name !== "file_case_brief") {
      batch.push(e);
    }
  }
  await flush();
  if (!ctx.dispute) throw new Error("Recorded run never fetched the dispute.");
  const problems = validateBrief(r.brief, caseFile(ctx.dispute));
  if (problems.length) throw new Error(`Recorded brief no longer fits this case: ${problems[0]}`);
  await executeTool("file_case_brief", r.brief, ctx);
  return { usage: { input_tokens: 0, output_tokens: 0 } };
}
