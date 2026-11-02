import { runAgent, type RunEvent } from "@/lib/agent/run";
import { touchDemo } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Streams the agent run as server-sent events. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const trigger = new URL(req.url).searchParams.get("trigger") === "agent" ? "agent" : "manual";
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
