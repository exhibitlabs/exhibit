// Guarantee: a run files a brief and, only when the merchant's Autopilot says AUTO and the merchant
// (or a webhook, or a batch) started it, acts on it. An external agent's run and a failed run never act.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseBrief } from "@/lib/agent/brief";
import { runAgent, type RunEvent } from "@/lib/agent/run";
import type { ToolContext } from "@/lib/agent/tools";
import { setAutopilot } from "@/lib/autopilot";
import { DEFAULT_AUTOPILOT } from "@/lib/autopilot-rules";
import { listActivity } from "@/lib/db";
import { latestRun } from "@/lib/disputes";
import { simGet } from "@/lib/paypal/simulator";
import { installCase, insertRun, makeBriefFor, recordedActions, resetState, type CaseKit } from "./support/fixtures";
import { instantTimers } from "./support/timers";

// The provider is scripted, so the run's own logic (persist, judge, act) is what is under test.
const scripted = vi.hoisted(() => ({ brief: null as CaseBrief | null, fail: null as Error | null, gate: null as Promise<void> | null }));
vi.mock("@/lib/agent/providers/replay", async () => {
  const { executeTool } = await import("@/lib/agent/tools");
  return {
    runWithReplay: async (ctx: ToolContext) => {
      await executeTool("get_paypal_dispute", { dispute_id: ctx.disputeId }, ctx);
      await scripted.gate;
      if (scripted.fail) throw scripted.fail;
      ctx.brief = scripted.brief!;
      return { usage: { input_tokens: 0, output_tokens: 0 } };
    },
    saveReplay: () => {},
  };
});

const AUTO_REFUNDS = { ...DEFAULT_AUTOPILOT, enabled: true, refund: { enabled: true, maxAmount: 500 } };

let kit: CaseKit;
let id: string;
beforeEach(() => {
  instantTimers();
  resetState();
  kit = installCase();
  id = kit.dispute.dispute_id;
  scripted.brief = makeBriefFor(kit, "accept_claim"); // REFUND on a $142 dispute
  scripted.fail = null;
  scripted.gate = null;
});
afterEach(() => vi.restoreAllMocks());

type Trigger = NonNullable<NonNullable<Parameters<typeof runAgent>[2]>["trigger"]>;
async function run(trigger: Trigger = "manual") {
  const events: RunEvent[] = [];
  await runAgent(id, (e) => events.push(e), { trigger });
  return events;
}
const acted = (events: RunEvent[]) => events.some((e) => e.t === "action");
const verdictOf = (events: RunEvent[]) => events.find((e): e is Extract<RunEvent, { t: "autopilot" }> => e.t === "autopilot")?.verdict;

describe("a run", () => {
  it("stores the brief and the trace, and with Autopilot off leaves the decision to the merchant", async () => {
    const events = await run();

    expect(latestRun(id)).toMatchObject({ status: "done", provider: "replay", brief: { decision: "REFUND" } });
    expect(events.map((e) => e.t)).toEqual(expect.arrayContaining(["start", "tool_call", "tool_result", "brief", "done", "autopilot"]));
    expect(verdictOf(events)).toMatchObject({ verdict: "REVIEW", rule: "off" });
    expect(acted(events)).toBe(false);
    expect(recordedActions()).toEqual([]);
    expect(simGet(id)?.status).toBe("WAITING_FOR_SELLER_RESPONSE");
  });

  it("logs a recorded run as one, with no investigation time (it replays in seconds, so the clock says nothing about the agent)", async () => {
    await run();

    const filed = listActivity({ disputeId: id }).find((a) => a.message.startsWith("Brief filed"));
    expect(filed?.message).toBe(`Brief filed for ${id}: REFUND (${scripted.brief!.win_likelihood}%) from a recorded run`);
  });

  it.each(["manual", "webhook", "batch"] as const)("acts as the merchant's autopilot when the verdict is AUTO (%s)", async (trigger) => {
    setAutopilot(AUTO_REFUNDS);

    const events = await run(trigger);

    expect(verdictOf(events)).toMatchObject({ verdict: "AUTO", rule: "refund" });
    expect(events.find((e) => e.t === "action")).toMatchObject({ result: { ok: true, kind: "accept_claim" } });
    expect(recordedActions(id)).toEqual([expect.objectContaining({ kind: "accept_claim", actor: "autopilot", status: "ok" })]);
    expect(simGet(id)?.status).toBe("RESOLVED");
  });

  it.each(["agent", "seed"] as const)("never acts when it was started by %s, even when the verdict is AUTO", async (trigger) => {
    setAutopilot(AUTO_REFUNDS);

    const events = await run(trigger);

    expect(verdictOf(events)).toMatchObject({ verdict: "AUTO" }); // it would have acted for a merchant-started run
    expect(acted(events)).toBe(false);
    expect(recordedActions()).toEqual([]);
    expect(simGet(id)?.status).toBe("WAITING_FOR_SELLER_RESPONSE");
  });

  it("does not act when the case is outside the merchant's limits", async () => {
    setAutopilot({ ...AUTO_REFUNDS, refund: { enabled: true, maxAmount: 100 } }); // the dispute is $142

    const events = await run();

    expect(verdictOf(events)).toMatchObject({ verdict: "REVIEW", rule: "refund" });
    expect(recordedActions()).toEqual([]);
  });

  it("does not act on a brief whose action contradicts its decision", async () => {
    setAutopilot(AUTO_REFUNDS);
    scripted.brief = makeBriefFor(kit, "accept_claim", { decision: "MESSAGE_BUYER" }); // a "message" that would refund

    const events = await run();

    expect(verdictOf(events)).toMatchObject({ verdict: "REVIEW", rule: "consistency" });
    expect(recordedActions()).toEqual([]);
  });
});

describe("a run that fails", () => {
  it("is recorded as an error, acts on nothing, and does not hide the last good brief", async () => {
    setAutopilot(AUTO_REFUNDS);
    const good = makeBriefFor(kit, "accept_claim", { headline: "The last good brief" });
    insertRun(id, good, { startedAt: new Date(Date.now() - 60_000).toISOString() });
    scripted.fail = new Error("The model stopped responding");

    const events = await run();

    expect(events.find((e) => e.t === "error")).toMatchObject({ message: "The model stopped responding" });
    expect(acted(events)).toBe(false);
    expect(recordedActions()).toEqual([]);
    expect(latestRun(id)).toMatchObject({ status: "done", brief: { headline: "The last good brief" } });
  });

  it("shows the error when there is nothing else to show", async () => {
    scripted.fail = new Error("No credit left");
    await run();
    expect(latestRun(id)).toMatchObject({ status: "error", error: "No credit left", brief: null });
  });
});

describe("two runs on one dispute", () => {
  it("never overlap: the second is told Exhibit is already working on it", async () => {
    let release!: () => void;
    scripted.gate = new Promise<void>((resolve) => (release = resolve));
    const first = runAgent(id, () => {}, { trigger: "manual" });
    const events: RunEvent[] = [];

    const second = runAgent(id, (e) => events.push(e), { trigger: "manual" });
    expect(events).toEqual([{ t: "error", message: "Exhibit is already working on this dispute." }]);

    release();
    await Promise.all([first, second]);
    expect(latestRun(id)).toMatchObject({ status: "done" });
  });
});
