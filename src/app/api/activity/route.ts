import { demoReady } from "@/lib/demo";
import { activityTimeline } from "@/lib/activity";

export const dynamic = "force-dynamic";

/** GET /api/activity → the audit timeline: PayPal API calls, agent and merchant actions, webhooks. Bodies are not included. */
export async function GET() {
  await demoReady();
  return Response.json(activityTimeline());
}
