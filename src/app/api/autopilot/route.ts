import { getAutopilot, setAutopilot, type AutopilotSettings } from "@/lib/autopilot";
import { logActivity } from "@/lib/db";
import { touchDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getAutopilot());
}

/** Saves the rules. Values are clamped to AUTOPILOT_LIMITS, so no request can loosen the hard limits. */
export async function PUT(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<AutopilotSettings> | null;
  if (!body || typeof body !== "object") return Response.json({ error: "Send the Autopilot settings as JSON." }, { status: 400 });
  touchDemo();
  const s = setAutopilot(body);
  logActivity(
    "settings",
    `Autopilot ${s.enabled ? "on" : "off"} · fight ${s.fight.enabled ? `≥${s.fight.minLikelihood}% up to $${s.fight.maxAmount}` : "off"} · refund ${s.refund.enabled ? `up to $${s.refund.maxAmount}` : "off"} · offers ${s.offers.enabled ? `up to $${s.offers.maxAmount}` : "off"} · messages ${s.messages.enabled ? "on" : "off"}`,
    null,
    s,
  );
  return Response.json(s);
}
