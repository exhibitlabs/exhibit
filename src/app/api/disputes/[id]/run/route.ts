import { runAgent, type RunEvent } from "@/lib/agent/run";
import { touchDemo } from "@/lib/demo";
import { cachedDispute, refreshDispute } from "@/lib/disputes";
import { PayPalError } from "@/lib/paypal/client";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Streams the agent run as server-sent events. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const trigger = new URL(req.url).searchParams.get("trigger") === "agent" ? "agent" : "manual";
  // An id PayPal doesn't know is a bad request, not a run that starts and then fails (or spends a model call on nothing).
  if (!cachedDispute(id)) {
    const found = await refreshDispute(id).then(() => true, (e) => !(e instanceof PayPalError && e.status === 404));
    if (!found) return Response.json({ error: `PayPal has no dispute ${id}.` }, { status: 404 });
  }
  touchDemo();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      const send = (e: RunEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      const ping = setInterval(() => !closed && controller.enqueue(encoder.encode(`: ping\n\n`)), 15000);
      runAgent(id, send, { trigger }).finally(() => {
        clearInterval(ping);
        if (!closed) {
          closed = true;
          controller.close();
        }
      });
    },
    cancel() {
      // The run keeps going server-side and persists its events.
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
