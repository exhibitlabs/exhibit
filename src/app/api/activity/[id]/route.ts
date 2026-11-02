import { apiCallDetail } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/activity/:id → one PayPal API call with its sanitized request and response bodies. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const call = apiCallDetail(Number(id));
  return call ? Response.json(call) : Response.json({ error: "Not found" }, { status: 404 });
}
