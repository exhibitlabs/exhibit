import { z } from "zod";
import { askIndex, runAsk } from "@/lib/ask/run";
import type { AskEvent } from "@/lib/ask/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Palette index: cases and at-risk orders for quick navigation, plus the provider label. */
export async function GET() {
  return Response.json(await askIndex());
}

const Body = z.object({
  question: z.string().trim().min(1).max(500),
  history: z.array(z.object({ q: z.string().max(500), a: z.string().max(2000) })).max(6).optional(),
});

/** Streams one Ask Exhibit answer as server-sent events. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Send { question }." }, { status: 400 });
  const { question, history = [] } = parsed.data;
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (e: AskEvent) => {
        if (!closed) controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
      };
      const ping = setInterval(() => !closed && controller.enqueue(encoder.encode(`: ping\n\n`)), 15000);
      runAsk(question, history, send).finally(() => {
        clearInterval(ping);
        if (!closed) {
          closed = true;
          controller.close();
        }
      });
    },
    cancel() {
      // The client closed the palette; answers aren't persisted, so just stop writing.
      closed = true;
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" } });
}
