import { draftPreventionMessage, preventionOrder, preventionReport, runPreventionFix, type PreventionAction } from "@/lib/prevention";
import { ensureSeeded } from "@/lib/seed";

const ACTIONS: PreventionAction[] = ["push_tracking", "refund", "message_buyer", "hold_and_verify", "require_signature", "dismiss"];

/**
 * GET  /api/prevention                    → PreventionReport
 * GET  /api/prevention?orderId=KA-10561   → { order, draft } (draft: the buyer message Exhibit would send)
 * POST /api/prevention { orderId, action, message?: { subject?, body } } → { result, report }
 */
export async function GET(req: Request) {
  ensureSeeded();
  const orderId = new URL(req.url).searchParams.get("orderId");
  if (orderId) {
    const order = preventionOrder(orderId);
    if (!order) return Response.json({ error: `Order ${orderId} is not on the prevention radar.` }, { status: 404 });
    const action = order.fixes.find((f) => f.action === "hold_and_verify") ? "hold_and_verify" : "message_buyer";
    return Response.json({ order, draft: draftPreventionMessage(orderId, action) ?? null });
  }
  return Response.json(preventionReport());
}

export async function POST(req: Request) {
  ensureSeeded();
  const body = (await req.json().catch(() => ({}))) as { orderId?: string; action?: PreventionAction; message?: { subject?: string; body: string }; actor?: string };
  if (!body.orderId || !body.action || !ACTIONS.includes(body.action)) {
    return Response.json({ error: `Send { orderId, action } with action one of ${ACTIONS.join(", ")}.` }, { status: 400 });
  }
  const result = await runPreventionFix(body.orderId, body.action, { message: body.message, actor: body.actor });
  return Response.json({ result, report: preventionReport() }, { status: result.ok ? 200 : 422 });
}
