import "server-only";
// Offline provider: replays a recorded agent run when no model is configured. The recorded
// reasoning is replayed, but every tool call executes for real against the current case, and the
// recorded brief must pass the same validation as a live one.

import fs from "node:fs";
import path from "node:path";
import { caseFile } from "../../disputes";
import { store } from "../../store/repo";
import type { CaseBrief } from "../brief";
import { executeTool, validateBrief, type AgentEvent, type ToolContext } from "../tools";

export type Replay = {
  scenario: string;
  model: string;
  recorded_at: string;
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

export async function runWithReplay(ctx: ToolContext) {
  const meta = store.scenario(ctx.disputeId);
  const recording = meta ? loadReplay(meta.key) : undefined;
  if (!meta || !recording) {
    throw new Error("No AI provider is configured and there is no recorded run for this case. Set ANTHROPIC_API_KEY to run the agent live.");
  }
  const to = { dispute_id: ctx.disputeId, order_id: meta.order_id };
  const r = remap(recording, recording.ids, to) as Replay;

  // Calls the model made back to back (no text between them) ran in parallel, so replay them that way.
  let batch: Extract<Replay["events"][number], { t: "tool_call" }>[] = [];
  const flush = async () => {
    if (!batch.length) return;
    const calls = batch;
    batch = [];
    // Staggered so the evidence graph shows each source being queried, the way a live run reads.
    await Promise.all(calls.map((c, i) => sleep(i * 260).then(() => executeTool(c.name, c.input, ctx, c.id, 800 + i * 420))));
    await sleep(180);
  };
  for (const e of r.events) {
    if (e.t === "thinking" || e.t === "text") {
      await flush();
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
