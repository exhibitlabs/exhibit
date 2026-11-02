// Guarantee: the no-key, no-login path works. With no AI provider, Exhibit replays a recorded run
// for each demo case, executes every tool call live against the case, and the recorded brief must
// pass the same validation as a live one. If the demo data and the recordings drift apart, this fails.
import fs from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { runAgent, type RunEvent } from "@/lib/agent/run";
import { validateBrief } from "@/lib/agent/tools";
import { aiProvider } from "@/lib/config";
import { docList } from "@/lib/db";
import { cachedDispute, caseFile, latestRun } from "@/lib/disputes";
import { resolveRef } from "@/lib/evidence";
import { seedDemo } from "@/lib/seed";
import type { ScenarioMeta } from "@/lib/store/repo";
import { simGet } from "@/lib/paypal/simulator";

const REPLAY_DIR = path.join(process.cwd(), "replays");
let scenarios: ScenarioMeta[] = [];

beforeAll(() => {
  seedDemo();
  scenarios = docList<ScenarioMeta>("scenario");
});

describe("recorded runs", () => {
  it("are available without any credentials, and the test environment is using them", () => {
    expect(aiProvider()).toBe("replay");
    expect(scenarios.length).toBeGreaterThanOrEqual(6);
    const missing = scenarios.map((s) => s.key).filter((key) => !fs.existsSync(path.join(REPLAY_DIR, `${key}.json`)));
    expect(missing, "every demo case needs a recorded run in replays/").toEqual([]);
  });

  it("replay on every demo case, with a brief that passes validation and cites only real records", async () => {
    for (const meta of scenarios) {
      const events: RunEvent[] = [];
      // `fast` is how the demo reset prepares its briefs: the same replay, without the on-screen pacing.
      await runAgent(meta.dispute_id, (e) => events.push(e), { trigger: "manual", fast: true });

      const label = `${meta.key} (${meta.dispute_id})`;
      const run = latestRun(meta.dispute_id);
      expect(run?.status, `${label}: ${run?.error ?? ""}`).toBe("done");
      const brief = run!.brief!;
      const cf = caseFile(cachedDispute(meta.dispute_id) ?? simGet(meta.dispute_id)!);
      expect(validateBrief(brief, cf), label).toEqual([]);
      for (const e of brief.exhibits) expect(resolveRef(e.ref, cf), `${label}: exhibit ${e.label} ${e.ref}`).toBeDefined();

      // Every tool ran for real against this case, and none of them failed.
      const results = events.filter((e): e is Extract<RunEvent, { t: "tool_result" }> => e.t === "tool_result" && e.name !== "file_case_brief");
      expect(results.length, label).toBeGreaterThanOrEqual(3);
      expect(results.filter((r) => !r.ok).map((r) => r.summary), label).toEqual([]);
      expect(events.some((e) => e.t === "action"), `${label}: a replay must not act on its own (Autopilot is off by default)`).toBe(false);
    }
  });

  it("agree with what the dispute allows right now: each brief's PayPal action is one of its links", async () => {
    for (const meta of scenarios) {
      const brief = latestRun(meta.dispute_id)?.brief;
      if (!brief) continue; // covered by the previous test
      const rels = new Set(simGet(meta.dispute_id)!.links.map((l) => l.rel));
      const needs = { provide_evidence: "provide_evidence", refund_then_prove: "provide_evidence", provide_supporting_info: "provide_supporting_info", make_offer: "make_offer", accept_claim: "accept_claim", send_message: "send_message" } as const;
      expect(rels.has(needs[brief.paypal_action.type]), `${meta.key}: ${brief.paypal_action.type}`).toBe(true);
    }
  });
});
