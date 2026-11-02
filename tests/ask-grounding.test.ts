// Guarantee: Ask Exhibit only shows what the data says. An answer that cites a dispute or order that
// does not exist, or charts a number no tool returned, is rejected; and nothing it can call changes
// anything. Runs on the demo merchant, with every figure read back from the tools' own output.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { seedDemo } from "@/lib/seed";
import { ASK_TOOLS, DATA_TOOLS, executeAskTool, newContext, type AskContext } from "@/lib/ask/tools";
import { runAsk } from "@/lib/ask/run";
import { SUGGESTED_QUESTIONS, type AskEvent } from "@/lib/ask/schema";
import { paypalCalls, recordedActions } from "./support/fixtures";
import { instantTimers } from "./support/timers";

// Offline answers are built from tool calls; keep the context they ran in so their numbers can be checked afterwards.
const seen = vi.hoisted(() => ({ ctx: null as AskContext | null }));
vi.mock("@/lib/ask/tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ask/tools")>();
  return {
    ...actual,
    callTool: (name: string, input: unknown, ctx: AskContext, minMs?: number) => {
      seen.ctx = ctx;
      return actual.callTool(name, input, ctx, minMs);
    },
  };
});

beforeAll(() => {
  seedDemo();
});
afterEach(() => vi.restoreAllMocks());

type Row = { id: string; buyer: string; amount: number; hours_left: number | null };
async function ask<T = Record<string, unknown>>(name: string, input: unknown, ctx: AskContext) {
  const r = await executeAskTool(name, input, ctx);
  // Data tools reply with JSON; present_answer replies with a sentence.
  let data: unknown = null;
  if (!r.isError && name !== "present_answer") data = JSON.parse(r.text);
  return { ...r, data: data as T };
}
const answer = (over: Record<string, unknown> = {}) => ({ text: "Here is what needs you.", followups: ["Which orders are at risk?"], ...over });
const chart = (labels: string[], values: number[]) => ({ type: "bar", title: "Open disputes ($)", unit: "usd", labels, series: [{ name: "Amount", values }] });

/** A context that has read the open disputes, so their ids and amounts are citable. */
async function readOpenDisputes() {
  const ctx = newContext(() => {});
  const { data } = await ask<{ disputes: Row[] }>("list_disputes", { status: "open", limit: 5 }, ctx);
  expect(data.disputes.length).toBeGreaterThanOrEqual(2);
  return { ctx, rows: data.disputes };
}

describe("present_answer", () => {
  it("accepts cases that exist and chart values the tools returned", async () => {
    const { ctx, rows } = await readOpenDisputes();
    const result = await ask("present_answer", answer({ cases: rows.slice(0, 2).map((r) => ({ id: r.id })), chart: chart(rows.map((r) => r.buyer), rows.map((r) => r.amount)) }), ctx);
    expect(result).toMatchObject({ isError: false, text: "Answer accepted." });
    expect(ctx.answer?.cases?.map((c) => c.id)).toEqual(rows.slice(0, 2).map((r) => r.id));
  });

  it("rejects a chart value that no tool returned, and says which", async () => {
    const { ctx, rows } = await readOpenDisputes();
    const invented = 987654.32; // far from every figure the tools returned (a value within rounding distance of a real one is tolerated)
    const result = await ask("present_answer", answer({ chart: chart(["A", "B"], [rows[1].amount, invented]) }), ctx);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Answer rejected");
    expect(result.text).toContain(`chart value ${invented}`);
    expect(result.text).toContain("does not appear in any tool result");
    expect(ctx.answer).toBeUndefined();
  });

  it("rejects a dispute id that is not in the book", async () => {
    const { ctx, rows } = await readOpenDisputes();
    const result = await ask("present_answer", answer({ cases: [{ id: rows[0].id }, { id: "PP-D-00000" }] }), ctx);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("case id PP-D-00000 is not a dispute in the book");
    expect(ctx.answer).toBeUndefined();
  });

  it("rejects an order id that is not a watched order, and accepts one the radar returned", async () => {
    const { ctx } = await readOpenDisputes();
    const { data } = await ask<{ orders: { id: string }[] }>("at_risk_orders", {}, ctx);
    expect(data.orders.length).toBeGreaterThan(0);
    const bad = await ask("present_answer", answer({ orders: [{ id: "KA-00000" }] }), ctx);
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain("order id KA-00000 is not a watched order");
    const good = await ask("present_answer", answer({ orders: [{ id: data.orders[0].id }] }), ctx);
    expect(good.isError).toBe(false);
  });

  it("rejects a chart with a different number of values and labels", async () => {
    const { ctx, rows } = await readOpenDisputes();
    const result = await ask("present_answer", answer({ chart: chart(["A", "B", "C"], [rows[0].amount, rows[1].amount]) }), ctx);
    expect(result.isError).toBe(true);
    expect(result.text).toContain('chart series "Amount" has 2 values for 3 labels');
  });

  it("is grounded per conversation: a number that is real elsewhere is still ungrounded until a tool returns it", async () => {
    const { rows } = await readOpenDisputes();
    const fresh = newContext(() => {});
    const result = await ask("present_answer", answer({ chart: chart(["A"], [rows[0].amount]) }), fresh);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("does not appear in any tool result");
  });

  it("lets a zero through, since an empty bar needs no source", async () => {
    const fresh = newContext(() => {});
    expect((await ask("present_answer", answer({ chart: chart(["A", "B"], [0, 0]) }), fresh)).isError).toBe(false);
  });

  it("after two rejections keeps only the parts it can ground, rather than showing the rest", async () => {
    const { ctx, rows } = await readOpenDisputes();
    const bad = answer({ cases: [{ id: rows[0].id }, { id: "PP-D-00000" }], orders: [{ id: "KA-00000" }], chart: chart(["A"], [123456.78]) });
    expect((await ask("present_answer", bad, ctx)).isError).toBe(true);
    expect((await ask("present_answer", bad, ctx)).isError).toBe(true);

    const third = await ask("present_answer", bad, ctx);

    expect(third).toMatchObject({ isError: false, text: "Answer accepted." });
    expect(ctx.answer).toMatchObject({ text: "Here is what needs you.", chart: null, cases: [{ id: rows[0].id }], orders: [] });
  });

  it("refuses an answer that is not even the right shape", async () => {
    const { ctx } = await readOpenDisputes();
    for (const bad of [{}, answer({ text: "" }), answer({ text: "x".repeat(1601) }), answer({ cases: Array.from({ length: 7 }, (_, i) => ({ id: `PP-D-${i}` })) }), answer({ chart: { ...chart(["A"], [1]), type: "pie" } })]) {
      expect((await ask("present_answer", bad, ctx)).text).toContain("Invalid answer");
    }
    expect(ctx.answer).toBeUndefined();
  });
});

describe("Ask Exhibit's tools", () => {
  it("are the five read tools and the answer filer, nothing else", () => {
    expect(ASK_TOOLS.map((t) => t.name).sort()).toEqual(["at_risk_orders", "dispute_stats", "get_case", "list_disputes", "present_answer", "recovery_summary"]);
    expect(DATA_TOOLS.map((t) => t.name)).not.toContain("present_answer");
  });

  it("change nothing: no PayPal write, no action, no approval, no stored record", async () => {
    const ctx = newContext(() => {});
    await ask("list_disputes", {}, ctx); // warm the cache so first-load syncing is not counted
    const snapshot = () => ({
      docs: JSON.stringify(db().prepare("SELECT kind, id, json FROM docs ORDER BY kind, id").all()),
      kv: JSON.stringify(db().prepare("SELECT k, v FROM kv WHERE k NOT LIKE 'demo_%' ORDER BY k").all()),
      approvals: db().prepare("SELECT COUNT(*) n FROM approvals").get(),
      actions: recordedActions().length,
      writes: paypalCalls().filter((c) => c.method !== "GET" && c.path !== "/v1/oauth2/token").length,
    });
    const before = snapshot();

    const { data } = await ask<{ disputes: Row[] }>("list_disputes", { status: "all", limit: 40 }, ctx);
    for (const [name, input] of [
      ["list_disputes", { status: "resolved" }],
      ["dispute_stats", { group_by: "reason" }],
      ["dispute_stats", { group_by: "week", scope: "open" }],
      ["get_case", { query: data.disputes[0].id }],
      ["recovery_summary", { period: "last_90_days" }],
      ["at_risk_orders", {}],
    ] as [string, unknown][]) {
      const r = await ask(name, input, ctx);
      expect(r.isError, `${name}: ${r.text.slice(0, 160)}`).toBe(false);
    }

    expect(snapshot()).toEqual(before);
  });
});

describe("offline answers (no AI key, no login)", () => {
  async function askOffline(question: string) {
    const events: AskEvent[] = [];
    seen.ctx = null;
    await runAsk(question, [], (e) => events.push(e));
    const ctx = seen.ctx as AskContext | null; // set by the callTool wrapper above while the answer was built
    return { events, answer: events.find((e): e is Extract<AskEvent, { t: "answer" }> => e.t === "answer")?.answer, ctx };
  }

  it.each(SUGGESTED_QUESTIONS)("%s", async (question) => {
    instantTimers();
    const { events, answer, ctx } = await askOffline(question);

    expect(events[0]).toMatchObject({ t: "start", provider: "offline" });
    expect(events.filter((e) => e.t === "error")).toEqual([]);
    expect(events.at(-1)?.t).toBe("done");
    expect(answer?.text.length).toBeGreaterThan(20);
    expect(events.some((e) => e.t === "step"), "the answer shows the tool calls it was built from").toBe(true);

    // Case and order chips are resolved from real records.
    const ids = new Set(((await ask<{ disputes: Row[] }>("list_disputes", { status: "all", limit: 40 }, newContext(() => {}))).data.disputes ?? []).map((r) => r.id));
    for (const c of answer!.cases) expect(c.href).toBe(`/app/disputes/${c.id}`);
    for (const c of answer!.cases.filter((c) => c.status !== "Resolved")) expect(ids.has(c.id), c.id).toBe(true);

    // Every chart value came out of a tool in this conversation (the same rule present_answer enforces).
    for (const s of answer!.chart?.series ?? []) {
      for (const v of s.values) if (v !== 0) expect(ctx!.numbers.has(Math.round(v * 100) / 100) || ctx!.numbers.has(Math.round(v)), `${question}: ${s.name} ${v}`).toBe(true);
    }
  });
});
