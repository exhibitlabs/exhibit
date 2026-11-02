import { listApprovals, requestDisputeAction, requestPreventionFix, reviewPath, type ApprovalStatus } from "@/lib/approvals";
import type { PreventionAction } from "@/lib/prevention";
import { demoReady } from "@/lib/demo";

export const dynamic = "force-dynamic";

/**
 * GET  /api/approvals?status=pending&target=PP-D-1   → { approvals }
 * POST /api/approvals { kind: "dispute_action", disputeId, note?, client }
 *                     { kind: "prevention_fix", orderId, action?, note?, client }  → { approval, existing, reviewPath }
 *
 * Creating a request never executes anything; only the merchant's decision does (see [id]/route.ts).
 */
export async function GET(req: Request) {
  await demoReady();
  const q = new URL(req.url).searchParams;
  const approvals = listApprovals({ status: (q.get("status") as ApprovalStatus | null) ?? undefined, target: q.get("target") ?? undefined });
  return Response.json({ approvals: approvals.map((a) => ({ ...a, reviewPath: reviewPath(a) })) });
}

export async function POST(req: Request) {
  await demoReady();
  const body = (await req.json().catch(() => ({}))) as { kind?: string; disputeId?: string; orderId?: string; action?: PreventionAction; note?: string; client?: string };
  const client = (body.client ?? "").trim().slice(0, 60) || "An AI agent";
  const r =
    body.kind === "dispute_action" && body.disputeId
      ? requestDisputeAction(body.disputeId, client, body.note)
      : body.kind === "prevention_fix" && body.orderId
        ? requestPreventionFix(body.orderId, client, body.action, body.note)
        : { ok: false as const, status: 400, error: 'Send { kind: "dispute_action", disputeId } or { kind: "prevention_fix", orderId, action? }.' };
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ approval: r.approval, existing: r.existing, reviewPath: reviewPath(r.approval) }, { status: r.existing ? 200 : 201 });
}
