import "server-only";
import { expectedRecovery, type CaseBrief } from "./agent/brief";
import { allActions } from "./disputes";
import type { Dispute } from "./paypal/types";
import { REASON_LABEL, STAGE_LABEL, STATUS_LABEL } from "./paypal/types";
import { resolvedFromPayPal, resolvedHistory, resolvedTotals } from "./store/history";
import { store } from "./store/repo";

export type InboxRow = {
  id: string;
  buyer: string;
  item: string;
  reason: string;
  reasonCode: Dispute["reason"];
  stage: string;
  stageCode: Dispute["dispute_life_cycle_stage"];
  status: string;
  statusCode: Dispute["status"];
  amount: number;
  currency: string;
  createdAt: string;
  closedAt: string | null;
  refunded: number | null;
  dueAt: string | null;
  hoursLeft: number | null;
  decision: CaseBrief["decision"] | null;
  likelihood: number | null;
  headline: string | null;
  expected: number | null;
  outcome: string | null;
  title: string | null;
  /** The brief's summary, PayPal action, exhibit count and confidence (null before a brief). */
  summary?: string | null;
  action?: CaseBrief["paypal_action"]["type"] | null;
  exhibits?: number;
  confidence?: CaseBrief["confidence"] | null;
  /** The PayPal call that answered the case, if one succeeded ("Evidence filed"), and when. */
  answered?: string | null;
  answeredAt?: string | null;
  /** What happens next: Exhibit investigates, the merchant responds, or PayPal/the buyer has it. */
  nextStep?: "investigate" | "respond" | "waiting" | "resolved";
};

const ANSWER_LABEL: Record<string, string> = {
  provide_evidence: "Evidence filed",
  provide_supporting_info: "Sent to PayPal's review",
  accept_claim: "Claim accepted",
  make_offer: "Offer sent",
  send_message: "Buyer messaged",
  refund_capture: "Refunded",
};

export function inboxRows(disputes: Dispute[], briefs: Map<string, CaseBrief>): InboxRow[] {
  const answers = new Map<string, { kind: string; at: string }>();
  for (const a of allActions()) if (a.status === "ok" && ANSWER_LABEL[a.kind] && !answers.has(a.dispute_id)) answers.set(a.dispute_id, { kind: a.kind, at: a.created_at });
  return disputes.map((d) => {
    const t = d.disputed_transactions[0];
    const brief = briefs.get(d.dispute_id) ?? null;
    const amount = Number(d.dispute_amount.value);
    const due = d.status === "RESOLVED" ? null : (d.seller_response_due_date ?? null);
    return {
      id: d.dispute_id,
      buyer: t?.buyer?.name ?? "Unknown buyer",
      item: t?.items?.map((i) => i.item_name).filter(Boolean).join(", ") || store.orderForDispute(d)?.items.map((i) => i.name).join(", ") || "—",
      reason: REASON_LABEL[d.reason] ?? d.reason,
      reasonCode: d.reason,
      stage: STAGE_LABEL[d.dispute_life_cycle_stage] ?? d.dispute_life_cycle_stage,
      stageCode: d.dispute_life_cycle_stage,
      status: STATUS_LABEL[d.status] ?? d.status,
      statusCode: d.status,
      amount,
      currency: d.dispute_amount.currency_code,
      createdAt: d.create_time,
      closedAt: d.status === "RESOLVED" ? (d.update_time ?? null) : null,
      refunded: d.dispute_outcome?.amount_refunded ? Number(d.dispute_outcome.amount_refunded.value) : null,
      dueAt: due,
      hoursLeft: due ? Math.round((new Date(due).getTime() - Date.now()) / 3600_000) : null,
      decision: brief?.decision ?? null,
      likelihood: brief?.win_likelihood ?? null,
      headline: brief?.headline ?? null,
      expected: brief ? expectedRecovery(brief, amount) : null,
      outcome: d.dispute_outcome?.outcome_code ?? null,
      title: store.scenario(d.dispute_id)?.title ?? null,
      summary: brief?.summary ?? null,
      action: brief?.paypal_action.type ?? null,
      exhibits: brief?.exhibits.length ?? 0,
      confidence: brief?.confidence ?? null,
      answered: answers.has(d.dispute_id) ? ANSWER_LABEL[answers.get(d.dispute_id)!.kind] : null,
      answeredAt: answers.get(d.dispute_id)?.at ?? null,
      nextStep: d.status === "RESOLVED" ? "resolved" : answers.has(d.dispute_id) || d.status !== "WAITING_FOR_SELLER_RESPONSE" ? (brief ? "waiting" : "investigate") : brief ? "respond" : "investigate",
    };
  });
}

export function resolvedOf(r: InboxRow) {
  return resolvedFromPayPal({ id: r.id, reasonCode: r.reasonCode, stage: r.stageCode, amount: r.amount, decision: r.decision, outcome: r.outcome, createdAt: r.createdAt, closedAt: r.closedAt, refundedAmount: r.refunded });
}

export function dashboardStats(rows: InboxRow[]) {
  const open = rows.filter((r) => r.statusCode !== "RESOLVED");
  // Resolved cases: the demo merchant's 90-day history plus anything PayPal has resolved since (same math as the Command center).
  const since = new Date(Date.now() - 90 * 86400_000).toISOString();
  const resolved = [...resolvedHistory(), ...rows.filter((r) => r.statusCode === "RESOLVED").map(resolvedOf)].filter((c) => c.closed_at >= since);
  const t = resolvedTotals(resolved);
  return {
    openCount: open.length,
    atRisk: open.reduce((a, r) => a + r.amount, 0),
    dueSoon: open.filter((r) => r.hoursLeft !== null && r.hoursLeft <= 72).length,
    needsResponse: open.filter((r) => r.statusCode === "WAITING_FOR_SELLER_RESPONSE").length,
    analyzed: open.filter((r) => r.decision).length,
    expected: open.reduce((a, r) => a + (r.expected ?? 0), 0),
    recovered: t.recovered,
    winRate: t.winRate,
    decided: t.fought,
  };
}
