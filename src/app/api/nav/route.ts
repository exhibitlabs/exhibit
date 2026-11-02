import { demoReady } from "@/lib/demo";
import { navState } from "@/lib/nav";

export const dynamic = "force-dynamic";

/** Sidebar badges (needs a response, orders at risk, agent requests) and the notifications list. */
export async function GET() {
  await demoReady();
  return Response.json(navState());
}
