import { syncTrackingToPayPal } from "@/lib/actions";
import { touchDemo } from "@/lib/demo";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { shipmentIds?: string[] };
  touchDemo();
  const results = await syncTrackingToPayPal(body.shipmentIds);
  return Response.json({ results });
}
