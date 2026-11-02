import { sandboxDecide, sandboxRequireEvidence } from "@/lib/actions";
import { paypalMode } from "@/lib/config";
import { refreshDispute } from "@/lib/disputes";
import { logActivity } from "@/lib/db";
import { touchDemo } from "@/lib/demo";
import { PayPalError } from "@/lib/paypal/client";
import { simGet, simPut, linksFor } from "@/lib/paypal/simulator";

/** Test-environment controls that stand in for PayPal's reviewer and the buyer. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { op: "decide" | "require_evidence" | "buyer_accepts_offer"; outcome?: "SELLER_FAVOR" | "BUYER_FAVOR" };
  touchDemo();
  try {
    if (body.op === "decide") return Response.json({ dispute: await sandboxDecide(id, body.outcome ?? "SELLER_FAVOR") });
    if (body.op === "require_evidence") return Response.json({ dispute: await sandboxRequireEvidence(id) });
    if (body.op === "buyer_accepts_offer") {
      if (paypalMode() !== "demo") return Response.json({ error: "Accepting an offer as the buyer needs buyer credentials in the real sandbox." }, { status: 400 });
      const d = simGet(id);
      if (!d || d.status !== "WAITING_FOR_BUYER_RESPONSE") return Response.json({ error: "No open offer on this dispute." }, { status: 422 });
      const next = { ...d, status: "RESOLVED" as const, update_time: new Date().toISOString(), dispute_outcome: { outcome_code: "RESOLVED_WITH_PAYOUT", amount_refunded: d.offer?.seller_offered_amount } };
      next.links = linksFor(next);
      simPut(next);
      logActivity("sandbox", "Buyer accepted the offer; case closed", id);
      return Response.json({ dispute: await refreshDispute(id) });
    }
    return Response.json({ error: "unknown op" }, { status: 400 });
  } catch (e) {
    const status = e instanceof PayPalError ? e.status : 500;
    return Response.json({ error: e instanceof Error ? e.message : String(e), issue: e instanceof PayPalError ? e.issue : undefined }, { status });
  }
}
