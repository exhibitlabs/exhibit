import { runAgent } from "@/lib/agent/run";
import { touchDemo } from "@/lib/demo";
import { cachedDisputes, latestBriefs } from "@/lib/disputes";

/**
 * Runs Exhibit two at a time in the background. With no body it investigates every open dispute
 * that has no brief yet; with { ids } it (re)investigates exactly those open disputes.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 50) : null;
  const briefs = latestBriefs();
  const open = cachedDisputes().filter((d) => d.status !== "RESOLVED");
  const todo = (ids ? open.filter((d) => ids.includes(d.dispute_id)) : open.filter((d) => !briefs.has(d.dispute_id))).map((d) => d.dispute_id);
  touchDemo();
  void (async () => {
    for (let i = 0; i < todo.length; i += 2) await Promise.all(todo.slice(i, i + 2).map((id) => runAgent(id, undefined, { trigger: "batch" })));
  })();
  return Response.json({ queued: todo });
}
