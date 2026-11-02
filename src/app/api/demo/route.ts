import { runAgent } from "@/lib/agent/run";
import { listApprovals } from "@/lib/approvals";
import { paypalMode } from "@/lib/config";
import { demoReady, demoStatus, resetDemo, simulateAgentRequest, touchDemo } from "@/lib/demo";
import { refreshDispute } from "@/lib/disputes";
import { simulateIncomingDispute } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/demo → the demo's clock (seeded, last activity, when it resets) and the guide's progress. */
export async function GET() {
  await demoReady();
  return Response.json(demoStatus(listApprovals({ status: "pending" }).length));
}

/**
 * Demo-mode controls. Sandbox mode refuses every op: its data is never reset or altered from here.
 *   { op: "reset" }          re-seed the demo merchant (fresh dates) and prepare briefs
 *   { op: "incoming" }       a new dispute arrives the way a CUSTOMER.DISPUTE.CREATED webhook delivers it
 *   { op: "agent_request" }  stand in for an outside AI agent: queue an approval request (nothing executes)
 *   { op: "touch" }          someone is using the demo (keeps it from resetting under them)
 */
export async function POST(req: Request) {
  if (paypalMode() !== "demo") return Response.json({ error: "Demo controls are only available in demo mode. Sandbox data is never reset." }, { status: 400 });
  const { op } = (await req.json().catch(() => ({}))) as { op?: string };
  if (op === "touch") {
    touchDemo();
    return Response.json({ ok: true });
  }
  if (op === "reset") {
    try {
      await resetDemo("manual");
      return Response.json({ ok: true, status: demoStatus() });
    } catch (e) {
      return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 409 });
    }
  }
  await demoReady();
  touchDemo();
  if (op === "incoming") {
    const d = simulateIncomingDispute();
    if (!d) return Response.json({ error: "no template" }, { status: 500 });
    await refreshDispute(d.dispute_id);
    void runAgent(d.dispute_id, undefined, { trigger: "webhook" });
    return Response.json({ ok: true, dispute_id: d.dispute_id });
  }
  if (op === "agent_request") {
    const r = simulateAgentRequest();
    if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
    return Response.json({ approval: r.approval, reviewPath: r.reviewPath }, { status: 201 });
  }
  return Response.json({ error: "unknown op" }, { status: 400 });
}
