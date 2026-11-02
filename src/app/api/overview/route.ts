import { demoReady } from "@/lib/demo";
import { buildOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";

/** Command center data: recovered, at risk, win rate by reason, deadline queue, dispute-rate health, activity. */
export async function GET() {
  try {
    await demoReady();
    return Response.json(await buildOverview());
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
