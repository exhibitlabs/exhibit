import { approveRequest, getApproval, rejectRequest } from "@/lib/approvals";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** GET /api/approvals/:id → { approval } (agents poll this to learn the merchant's decision). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const approval = getApproval(id);
  return approval ? Response.json({ approval }) : Response.json({ error: "Approval not found." }, { status: 404 });
}

/**
 * POST /api/approvals/:id { decision: "approve" | "reject", reason? }
 * The merchant's decision. Only accepted from the Exhibit UI itself (same-origin browser request);
 * the MCP server exposes no tool that reaches this route.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const sameOrigin = req.headers.get("sec-fetch-site") === "same-origin" || (!!origin && !!host && new URL(origin).host === host);
  if (!sameOrigin) return Response.json({ error: "Approvals are decided by the merchant in the Exhibit app." }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { decision?: string; reason?: string };
  const r = body.decision === "approve" ? await approveRequest(id) : body.decision === "reject" ? rejectRequest(id, body.reason) : { ok: false as const, status: 400, error: 'Send { decision: "approve" | "reject" }.' };
  if (!r.ok) return Response.json({ error: r.error, approval: "approval" in r ? r.approval : undefined }, { status: r.status });
  return Response.json({ approval: r.approval });
}
