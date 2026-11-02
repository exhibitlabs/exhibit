import { executeBriefAction } from "@/lib/actions";
import { touchDemo } from "@/lib/demo";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { letter?: string; buyerMessage?: string; amount?: number };
  touchDemo();
  const result = await executeBriefAction(id, body, "merchant");
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
