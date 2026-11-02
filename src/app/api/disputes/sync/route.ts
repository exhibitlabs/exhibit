import { demoReady, touchDemo } from "@/lib/demo";
import { latestBriefs, syncDisputes } from "@/lib/disputes";
import { dashboardStats, inboxRows } from "@/lib/inbox";
import { PayPalError } from "@/lib/paypal/client";

export async function POST() {
  try {
    await demoReady();
    touchDemo();
    const disputes = await syncDisputes();
    const rows = inboxRows(disputes, latestBriefs());
    return Response.json({ rows, stats: dashboardStats(rows) });
  } catch (e) {
    const status = e instanceof PayPalError ? e.status : 500;
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status });
  }
}
