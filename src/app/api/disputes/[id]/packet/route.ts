import type { CaseBrief } from "@/lib/agent/brief";
import { cachedDispute, caseFile, latestRun, refreshDispute } from "@/lib/disputes";
import { markDemoProgress } from "@/lib/demo-progress";
import { packetFilename, renderPacket } from "@/lib/packet/render";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const run = latestRun(id);
  const brief = run?.brief as CaseBrief | null | undefined;
  if (!brief) return Response.json({ error: "Run Exhibit on this dispute first." }, { status: 404 });
  const d = cachedDispute(id) ?? (await refreshDispute(id));
  const letter = new URL(req.url).searchParams.get("letter") ?? undefined;
  const pdf = await renderPacket(caseFile(d), brief, letter);
  const download = new URL(req.url).searchParams.get("download") === "1";
  markDemoProgress("evidence");
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${packetFilename(id)}"` },
  });
}
