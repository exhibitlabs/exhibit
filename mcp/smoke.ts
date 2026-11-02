/**
 * Smoke test for the Exhibit MCP server. Spawns `mcp/server.ts` over stdio with the MCP SDK client,
 * calls every tool against a DEMO-mode Exhibit, then approves one request over HTTP the way the
 * merchant's browser would and checks that the action really executed.
 *
 *   EXHIBIT_URL=http://localhost:3101 node mcp/smoke.ts
 *
 * Refuses to run against anything but the demo simulator: it never approves real sandbox filings.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.EXHIBIT_URL ?? "http://localhost:3101").replace(/\/+$/, "");
const here = path.dirname(fileURLToPath(import.meta.url));
let failures = 0;

function check(cond: unknown, label: string) {
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}`);
  if (!cond) failures++;
}

type ToolOut = { content: { type: string; text?: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };

const status = (await fetch(`${BASE}/api/status`).then((r) => r.json())) as { paypalMode: string };
if (status.paypalMode !== "demo") {
  console.error(`Refusing to run: ${BASE} is in ${status.paypalMode} mode. The smoke test approves a filing and must only run against the demo simulator.`);
  process.exit(2);
}

const client = new Client({ name: "exhibit-smoke", version: "1.0.0" });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [path.join(here, "server.ts")],
    env: { ...(process.env as Record<string, string>), EXHIBIT_URL: BASE, EXHIBIT_CLIENT_NAME: "Smoke test" },
    stderr: "inherit",
  }),
);

async function tool(name: string, args: Record<string, unknown> = {}) {
  const t0 = Date.now();
  const r = (await client.callTool({ name, arguments: args })) as ToolOut;
  const text = r.content.map((c) => c.text ?? "").join("\n");
  console.log(`\n── ${name}(${JSON.stringify(args)}) · ${Date.now() - t0}ms${r.isError ? " · ERROR" : ""}`);
  console.log(text.split("\n").slice(0, 14).map((l) => `   ${l.slice(0, 180)}`).join("\n") + (text.split("\n").length > 14 ? "\n   …" : ""));
  return r;
}

console.log(`Exhibit MCP smoke test against ${BASE} (demo)\n`);
const { tools } = await client.listTools();
console.log(`tools: ${tools.map((t) => t.name).join(", ")}`);
check(tools.length >= 9, "9 tools registered");
const { prompts } = await client.listPrompts();
check(prompts.some((p) => p.name === "triage_disputes"), "triage_disputes prompt");
const res = await client.readResource({ uri: "exhibit://disputes/open" });
check(JSON.parse(String((res.contents[0] as { text: string }).text)).length > 0, "exhibit://disputes/open resource lists open disputes");

const list = await tool("list_disputes", { status: "needs_response" });
const disputes = (list.structuredContent?.disputes ?? []) as { id: string; exhibit_call: string | null; stage: string }[];
check(!list.isError && disputes.length > 0, "list_disputes returns disputes");
await tool("list_disputes", { status: "all", reason: "UNAUTHORISED" });

// Prefer a case not yet investigated, so investigate_dispute does real work.
const target = disputes.find((d) => !d.exhibit_call) ?? disputes[0];
const inv = await tool("investigate_dispute", { dispute_id: target.id });
check(!inv.isError && typeof inv.structuredContent?.win_likelihood === "number", `investigate_dispute(${target.id}) returns a brief`);

const brief = await tool("get_case_brief", { dispute_id: target.id });
check(brief.structuredContent?.decision === inv.structuredContent?.decision, "get_case_brief returns the same brief");
const packet = await tool("get_evidence_packet", { dispute_id: target.id });
check(Number(packet.structuredContent?.bytes) > 1000, "get_evidence_packet returns a rendered PDF URL");
const prevention = await tool("get_prevention_report", { limit: 3 });
check(!prevention.isError, "get_prevention_report");
const overview = await tool("get_overview");
check(!overview.isError && typeof overview.structuredContent?.recovered === "number", "get_overview");
const missing = await tool("get_case_brief", { dispute_id: "PP-D-NOPE" });
check(missing.isError, "unknown dispute is a tool error, not a crash");

// The approval loop.
const before = (await fetch(`${BASE}/api/disputes/${target.id}/state`).then((r) => r.json())) as { actions: { actor: string }[] };
const req = await tool("request_dispute_action", { dispute_id: target.id, note: "Smoke test: strongest evidence of the queue." });
const approvalId = String(req.structuredContent?.approval_id);
check(req.structuredContent?.status === "pending", "request_dispute_action creates a pending approval");
const again = await tool("request_dispute_action", { dispute_id: target.id });
check(again.structuredContent?.approval_id === approvalId && again.structuredContent?.existing === true, "requesting twice returns the same approval");
const after = (await fetch(`${BASE}/api/disputes/${target.id}/state`).then((r) => r.json())) as { actions: { actor: string }[] };
check(after.actions.length === before.actions.length, "requesting executed nothing (no new PayPal action)");

const forged = await fetch(`${BASE}/api/approvals/${approvalId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "approve" }) });
check(forged.status === 403, `approve without a same-origin browser request is refused (${forged.status})`);

console.log(`\n── merchant approves ${approvalId} in the Exhibit UI (simulated same-origin POST)`);
const approve = await fetch(`${BASE}/api/approvals/${approvalId}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE, "Sec-Fetch-Site": "same-origin" }, body: JSON.stringify({ decision: "approve" }) });
const approved = (await approve.json()) as { approval?: { status: string; result: { detail?: string } } };
console.log(`   HTTP ${approve.status} · ${approved.approval?.status} · ${approved.approval?.result?.detail ?? JSON.stringify(approved).slice(0, 200)}`);
check(approve.ok && approved.approval?.status === "approved", "merchant approval executes the action");
const st = await tool("get_approval_status", { approval_id: approvalId });
check(st.structuredContent?.status === "approved", "get_approval_status reports approved");
const final = (await fetch(`${BASE}/api/disputes/${target.id}/state`).then((r) => r.json())) as { actions: { kind: string; actor: string; status: string }[] };
const executed = final.actions.find((a) => a.actor === "agent:Smoke test approved by merchant");
check(executed?.status === "ok", `PayPal action recorded: ${executed?.kind} by "${executed?.actor}"`);

// Prevention: request, then the merchant rejects.
const orders = (prevention.structuredContent?.orders ?? []) as { order_id: string }[];
if (orders.length) {
  const pr = await tool("request_prevention_fix", { order_id: orders[0].order_id, note: "Smoke test." });
  const pid = String(pr.structuredContent?.approval_id);
  check(pr.structuredContent?.status === "pending", "request_prevention_fix creates a pending approval");
  const rej = await fetch(`${BASE}/api/approvals/${pid}`, { method: "POST", headers: { "Content-Type": "application/json", Origin: BASE }, body: JSON.stringify({ decision: "reject", reason: "Smoke test" }) });
  check(rej.ok, "merchant rejects the prevention request");
  const ps = await tool("get_approval_status", { approval_id: pid });
  check(ps.structuredContent?.status === "rejected", "get_approval_status reports rejected");
}

await client.close();
console.log(`\n${failures ? `${failures} check(s) failed` : "All checks passed"}.`);
process.exit(failures ? 1 : 0);
