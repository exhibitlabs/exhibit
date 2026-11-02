// Guarantee: no MCP tool can execute an action. Spawns the real `mcp/server.ts` over stdio, points it
// at Exhibit's real route handlers (tests/support/bridge.ts) and drives it as an AI agent would.
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CaseBrief } from "@/lib/agent/brief";
import type { ToolContext } from "@/lib/agent/tools";
import { getApproval } from "@/lib/approvals";
import { setAutopilot } from "@/lib/autopilot";
import { latestRun } from "@/lib/disputes";
import { simGet } from "@/lib/paypal/simulator";
import { store } from "@/lib/store/repo";
import { startBridge } from "./support/bridge";
import { footprint, installCase, installWatchedOrder, insertRun, makeBriefFor, recordedActions, resetState } from "./support/fixtures";

// The agent run is scripted: investigate_dispute runs the real route and the real runAgent, with a provider that files this brief.
const scripted = vi.hoisted(() => ({ brief: null as CaseBrief | null }));
vi.mock("@/lib/agent/providers/replay", async () => {
  const { executeTool } = await import("@/lib/agent/tools");
  return {
    runWithReplay: async (ctx: ToolContext) => {
      await executeTool("get_paypal_dispute", { dispute_id: ctx.disputeId }, ctx);
      ctx.brief = scripted.brief!;
      return { usage: { input_tokens: 0, output_tokens: 0 } };
    },
    saveReplay: () => {},
  };
});

type Bridge = Awaited<ReturnType<typeof startBridge>>;
type ToolReply = { content: { type: string; text?: string }[]; structuredContent?: Record<string, any>; isError?: boolean; text: string }; // eslint-disable-line @typescript-eslint/no-explicit-any

let bridge: Bridge;
let client: Client;

function connect(url: string) {
  const c = new Client({ name: "exhibit-test", version: "1.0.0" });
  return c
    .connect(new StdioClientTransport({ command: process.execPath, args: [path.resolve("mcp/server.ts")], env: { EXHIBIT_URL: url, EXHIBIT_CLIENT_NAME: "Test agent" }, stderr: "pipe" }))
    .then(() => c);
}

async function tool(name: string, args: Record<string, unknown> = {}, from = client): Promise<ToolReply> {
  const r = (await from.callTool({ name, arguments: args })) as Omit<ToolReply, "text">;
  return { ...r, text: r.content.map((c) => c.text ?? "").join("\n") };
}

beforeAll(async () => {
  bridge = await startBridge();
  client = await connect(bridge.url);
}, 30_000);
afterAll(async () => {
  await client?.close();
  await bridge?.close();
});
beforeEach(() => {
  resetState();
  bridge.seen.length = 0;
  scripted.brief = null;
});

/** An investigated case waiting on the merchant. */
function readyCase() {
  const kit = installCase();
  const brief = makeBriefFor(kit, "accept_claim");
  insertRun(kit.dispute.dispute_id, brief);
  return { kit, id: kit.dispute.dispute_id, brief };
}

const TOOLS = ["get_approval_status", "get_case_brief", "get_evidence_packet", "get_overview", "get_prevention_report", "investigate_dispute", "list_disputes", "request_dispute_action", "request_prevention_fix"];
const READ_ONLY = ["get_approval_status", "get_case_brief", "get_evidence_packet", "get_overview", "get_prevention_report", "list_disputes"];

describe("the tools Exhibit offers an AI agent", () => {
  it("are an allow-list: investigate and ask, never file, refund, message or decide", async () => {
    const { tools } = await client.listTools();
    // Adding a tool means changing this list on purpose. Read the new tool's endpoint calls first:
    // nothing an agent can call may reach the merchant-only decision route or an execute route.
    expect(tools.map((t) => t.name).sort()).toEqual(TOOLS);
    for (const t of tools) expect(t.annotations?.destructiveHint, t.name).toBe(false);
    for (const name of READ_ONLY) expect(tools.find((t) => t.name === name)?.annotations?.readOnlyHint, name).toBe(true);
    for (const name of ["request_dispute_action", "request_prevention_fix"]) expect(tools.find((t) => t.name === name)?.description, name).toMatch(/does NOT|executes nothing/);
  });

  it("give the request tools no way to pick the action, the amount or the decision", async () => {
    const { tools } = await client.listTools();
    const inputs = (name: string) => Object.keys((tools.find((t) => t.name === name)!.inputSchema.properties ?? {}) as object).sort();
    expect(inputs("request_dispute_action")).toEqual(["dispute_id", "note"]); // Exhibit's own brief decides what is filed
    expect(inputs("request_prevention_fix")).toEqual(["action", "note", "order_id"]);
    expect(inputs("get_approval_status")).toEqual(["approval_id"]);
    const forbidden = /^(decision|approve|approved|confirm|execute|override|amount|letter|message|offer_type)$/;
    for (const t of tools) expect(Object.keys((t.inputSchema.properties ?? {}) as object).filter((k) => forbidden.test(k)), t.name).toEqual([]);
  });
});

describe("an agent working a dispute", () => {
  it("reads the brief, asks for approval, and nothing is executed until the merchant approves", async () => {
    const { id } = readyCase();

    const listed = await tool("list_disputes", { status: "needs_response" });
    expect(listed.structuredContent?.disputes).toEqual([expect.objectContaining({ id, investigated: true, exhibit_call: "REFUND" })]);
    const brief = await tool("get_case_brief", { dispute_id: id });
    expect(brief.structuredContent).toMatchObject({ decision: "REFUND", proposed_paypal_action: { type: "accept_claim" } });
    expect(brief.text).toContain("Not executed");

    const before = footprint(id);
    const asked = await tool("request_dispute_action", { dispute_id: id, note: "Unwinnable and cheap to close." });
    const approvalId = String(asked.structuredContent?.approval_id);
    expect(asked.structuredContent).toMatchObject({ status: "pending", existing: false, moves_money: true, requested_by: "Test agent", approval_url: `${bridge.url}/app/disputes/${id}?approval=${approvalId}` });
    expect(asked.text).toContain("Nothing has been sent to PayPal");
    expect(footprint(id)).toEqual(before);

    const again = await tool("request_dispute_action", { dispute_id: id });
    expect(again.structuredContent).toMatchObject({ approval_id: approvalId, existing: true });
    expect((await tool("get_approval_status", { approval_id: approvalId })).text).toContain("Waiting for the merchant");

    // Whoever is not the merchant's browser on Exhibit's own origin gets a 403, and the request stays pending.
    const outsiders: Record<string, string>[] = [{}, { origin: "https://evil.example" }, { "sec-fetch-site": "cross-site" }];
    for (const headers of outsiders) {
      const r = await bridge.asOutsider(`/api/approvals/${approvalId}`, { decision: "approve" }, headers);
      expect(r.status, JSON.stringify(headers)).toBe(403);
    }
    expect(getApproval(approvalId)?.status).toBe("pending");
    expect(footprint(id)).toEqual(before);

    // The merchant approves in the app; now it runs, and the agent can see the outcome.
    expect((await bridge.asMerchant(`/api/approvals/${approvalId}`, { decision: "approve" })).status).toBe(200);
    expect(simGet(id)).toMatchObject({ status: "RESOLVED" });
    expect(recordedActions(id)).toEqual([expect.objectContaining({ kind: "accept_claim", actor: "agent:Test agent approved by merchant" })]);
    const done = await tool("get_approval_status", { approval_id: approvalId });
    expect(done.structuredContent).toMatchObject({ status: "approved" });
    expect(done.text).toContain("Approved by the merchant and executed");
  });

  it("is told the request expired when the case is re-investigated before the merchant approves", async () => {
    const { kit, id } = readyCase();
    const asked = await tool("request_dispute_action", { dispute_id: id });
    const approvalId = String(asked.structuredContent?.approval_id);
    insertRun(id, makeBriefFor(kit, "accept_claim", { headline: "Re-investigated" }), { startedAt: new Date(Date.now() + 5_000).toISOString() });
    const before = footprint(id);

    const r = await bridge.asMerchant(`/api/approvals/${approvalId}`, { decision: "approve" });

    expect(r.status).toBe(409);
    expect(footprint(id)).toEqual(before);
    const status = await tool("get_approval_status", { approval_id: approvalId });
    expect(status.structuredContent).toMatchObject({ status: "stale" });
    expect(status.text).toContain("Expired");
  });

  it("only ever writes to the two request endpoints, whatever tools it calls", async () => {
    const { kit, id } = readyCase();
    scripted.brief = makeBriefFor(kit, "accept_claim");
    installWatchedOrder();
    const approval = await tool("request_dispute_action", { dispute_id: id });

    const calls: [string, Record<string, unknown>][] = [
      ["list_disputes", {}],
      ["get_case_brief", { dispute_id: id }],
      ["get_evidence_packet", { dispute_id: id }],
      ["get_prevention_report", {}],
      ["get_overview", {}],
      ["investigate_dispute", { dispute_id: id }],
      ["request_dispute_action", { dispute_id: id }],
      ["request_prevention_fix", { order_id: "KA-90005" }],
      ["get_approval_status", { approval_id: String(approval.structuredContent?.approval_id) }],
    ];
    expect(calls.map(([name]) => name).sort()).toEqual(TOOLS); // every tool, so a new one cannot slip past this test
    for (const [name, args] of calls) {
      const r = await tool(name, args);
      expect(r.isError, `${name}: ${r.text.slice(0, 200)}`).toBeFalsy();
    }

    const writes = bridge
      .fromMcp()
      .filter((r) => r.method !== "GET")
      .map((r) => `${r.method} ${r.path.replace(id, ":dispute")}`);
    expect(new Set(writes)).toEqual(new Set(["POST /api/approvals", "POST /api/disputes/:dispute/run?trigger=agent"]));
    const touched = bridge.fromMcp().map((r) => r.path);
    expect(touched.filter((p) => /\/act|\/sandbox|\/batch|\/autopilot|\/webhooks|\/seed|\/sync/.test(p))).toEqual([]);
    expect(touched.filter((p) => /^\/api\/approvals\/[^/?]+$/.test(p) && bridge.fromMcp().find((r) => r.path === p)?.method !== "GET")).toEqual([]);
    expect(recordedActions()).toEqual([]); // nothing was executed on the dispute
  });
});

describe("an agent that investigates", () => {
  it("never triggers autopilot: even with Autopilot on and the brief inside every limit, the run only prepares the brief", async () => {
    const { kit, id } = readyCase();
    const everything = { enabled: true, minLikelihood: 0, maxAmount: 10_000 };
    setAutopilot({ enabled: true, fight: everything, refund: { enabled: true, maxAmount: 10_000 }, offers: { enabled: true, maxAmount: 10_000 }, messages: { enabled: true } });
    scripted.brief = makeBriefFor(kit, "accept_claim");

    const r = await tool("investigate_dispute", { dispute_id: id });

    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toMatchObject({ decision: "REFUND", proposed_paypal_action: { type: "accept_claim" } });
    const run = latestRun(id)!;
    const events = run.events as { t: string; verdict?: { verdict: string } }[];
    const why = `run ${run.id} ${run.status} ${run.error ?? ""} started ${run.started_at}; events: ${events.map((e) => e.t).join(",")}`;
    expect(events.find((e) => e.t === "autopilot")?.verdict?.verdict, why).toBe("AUTO"); // it would have acted for the merchant...
    expect(events.some((e) => e.t === "action")).toBe(false); // ...but an agent-triggered run never does
    expect(bridge.fromMcp().some((q) => q.path === `/api/disputes/${id}/run?trigger=agent`)).toBe(true);
    expect(recordedActions()).toEqual([]);
    expect(simGet(id)?.status).toBe("WAITING_FOR_SELLER_RESPONSE");
  });
});

describe("an agent working the prevention radar", () => {
  it("asks for a fix, and the merchant's rejection is reported back with nothing sent", async () => {
    const { order, outbound } = installWatchedOrder();

    const report = await tool("get_prevention_report", { limit: 5 });
    expect(report.structuredContent?.orders).toEqual([expect.objectContaining({ order_id: order.id, fixes: expect.arrayContaining([expect.objectContaining({ action: "push_tracking", recommended: true })]) })]);

    const asked = await tool("request_prevention_fix", { order_id: order.id, note: "PayPal has no tracking." });
    const approvalId = String(asked.structuredContent?.approval_id);
    expect(asked.structuredContent).toMatchObject({ status: "pending", target: order.id, action: "push_tracking", moves_money: false });
    expect(store.shipment(outbound!.id)?.pushed_to_paypal).toBe(false);

    expect((await bridge.asMerchant(`/api/approvals/${approvalId}`, { decision: "reject", reason: "Handled by hand" })).status).toBe(200);
    const status = await tool("get_approval_status", { approval_id: approvalId });
    expect(status.structuredContent).toMatchObject({ status: "rejected" });
    expect(status.text).toContain("Nothing was sent");
    expect(store.shipment(outbound!.id)?.pushed_to_paypal).toBe(false);
  });
});

describe("failures", () => {
  it("come back as tool errors an agent can act on", async () => {
    const { kit } = readyCase();
    const fresh = installCase({ n: 2 });
    expect(await tool("get_case_brief", { dispute_id: "PP-D-NOPE" })).toMatchObject({ isError: true, text: expect.stringContaining("not found") });
    expect(await tool("request_dispute_action", { dispute_id: fresh.dispute.dispute_id })).toMatchObject({ isError: true, text: expect.stringContaining("investigate_dispute") });
    expect(await tool("get_approval_status", { approval_id: "apv_missing" })).toMatchObject({ isError: true });
    expect(await tool("get_evidence_packet", { dispute_id: fresh.dispute.dispute_id })).toMatchObject({ isError: true });
    expect(await tool("request_prevention_fix", { order_id: kit.order.id })).toMatchObject({ isError: true });
  });

  it("explain how to start Exhibit when it is not running", async () => {
    const orphan = await connect("http://127.0.0.1:9");
    try {
      const r = await tool("list_disputes", {}, orphan);
      expect(r.isError).toBe(true);
      expect(r.text).toMatch(/Could not reach Exhibit at http:\/\/127\.0\.0\.1:9.*Is the app running\?/);
    } finally {
      await orphan.close();
    }
  });
});
