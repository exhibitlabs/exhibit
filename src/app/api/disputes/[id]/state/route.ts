import { disputeTimeline } from "@/lib/activity";
import { isRunning } from "@/lib/agent/run";
import { actionsFor, cachedDispute, latestRun } from "@/lib/disputes";
import { listActivity } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return Response.json({
    dispute: cachedDispute(id) ?? null,
    run: latestRun(id) ?? null,
    running: isRunning(id),
    actions: actionsFor(id),
    api: listActivity({ disputeId: id, kind: "api", limit: 60 }),
    history: disputeTimeline(id),
  });
}
