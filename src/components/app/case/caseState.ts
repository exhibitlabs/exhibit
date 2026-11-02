// Client-safe helpers for the case page: which PayPal action a brief takes, whether PayPal allows
// it right now, whether the case has been answered, and where it sits in its lifecycle.
import type { CaseBrief } from "@/lib/agent/brief";
import { usd } from "@/lib/format";
import type { Dispute } from "@/lib/paypal/types";

export type ActionRow = { id: string; kind: string; actor: string; status: string; created_at: string; response: unknown };

/** PayPal calls that answer a case. Sandbox lifecycle controls (adjudicate) don't count. */
export const ANSWERS = new Set(["provide_evidence", "provide_supporting_info", "accept_claim", "make_offer", "send_message", "refund_capture"]);

export const ANSWER_LABEL: Record<string, string> = {
  provide_evidence: "Evidence filed",
  provide_supporting_info: "Sent to PayPal's review",
  accept_claim: "Claim accepted",
  make_offer: "Offer sent",
  send_message: "Buyer messaged",
  refund_capture: "Refunded",
};

/** The HATEOAS link each brief action needs on the dispute. */
export const REL_FOR: Record<CaseBrief["paypal_action"]["type"], string> = {
  provide_evidence: "provide_evidence",
  refund_then_prove: "provide_evidence",
  provide_supporting_info: "provide_supporting_info",
  make_offer: "make_offer",
  accept_claim: "accept_claim",
  send_message: "send_message",
};

export const API_OF: Record<string, string> = {
  provide_evidence: "POST /v1/customer/disputes/{id}/provide-evidence",
  provide_supporting_info: "POST /v1/customer/disputes/{id}/provide-supporting-info",
  refund_then_prove: "POST /v2/payments/captures/{id}/refund, then provide-evidence",
  make_offer: "POST /v1/customer/disputes/{id}/make-offer",
  accept_claim: "POST /v1/customer/disputes/{id}/accept-claim",
  send_message: "POST /v1/customer/disputes/{id}/send-message",
};

export function actionLabel(brief: CaseBrief, amount: number) {
  const a = brief.paypal_action;
  switch (a.type) {
    case "provide_evidence":
      return "File evidence with PayPal";
    case "provide_supporting_info":
      return "Send case to PayPal's review";
    case "refund_then_prove":
      return `Refund ${usd(a.amount ?? amount)} and file proof`;
    case "make_offer":
      return a.offer_type === "REPLACEMENT_WITHOUT_REFUND" ? "Offer a replacement" : `Offer ${usd(a.amount ?? 0)}${a.offer_type === "REFUND_WITH_RETURN" ? " with return" : " refund"}`;
    case "accept_claim":
      return `Accept and refund ${usd(amount)}`;
    case "send_message":
      return "Send message to buyer";
  }
}

/** Money leaves the merchant's account: these ask for a confirmation first. */
export function movesMoney(brief: CaseBrief) {
  const a = brief.paypal_action;
  return a.type === "accept_claim" || a.type === "refund_then_prove" || (a.type === "make_offer" && a.offer_type !== "REPLACEMENT_WITHOUT_REFUND" && !!a.amount);
}

export function canAct(d: Dispute, brief: CaseBrief | null) {
  return !!brief && d.status !== "RESOLVED" && d.links.some((l) => l.rel === REL_FOR[brief.paypal_action.type]);
}

export function answeredBy(actions: ActionRow[]) {
  return actions
    .filter((a) => a.status === "ok" && ANSWERS.has(a.kind))
    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
}

export function actorLabel(actor: string) {
  if (actor === "merchant") return "you";
  if (actor === "autopilot") return "Autopilot";
  const m = /^agent:(.+) approved by merchant$/.exec(actor);
  return m ? `${m[1]}, approved by you` : actor;
}

export type StepState = "done" | "active" | "todo" | "skipped";
export type LifeStep = { key: string; label: string; detail: string; at?: string; state: StepState; tone?: "green" | "red" | "ink" };

/**
 * How the case ended. Red is for a fight that was lost; a refund the merchant chose because the
 * buyer was right is a fair outcome, not a failure, so it reads neutral.
 */
export function outcomeOf(d: Dispute, answeredKind?: string): { label: string; tone: "green" | "red" | "ink" } | null {
  const c = d.dispute_outcome?.outcome_code;
  if (d.status !== "RESOLVED" || !c) return d.status === "RESOLVED" ? { label: "Resolved", tone: "ink" } : null;
  if (c === "RESOLVED_SELLER_FAVOUR") return { label: "Won", tone: "green" };
  if (c === "RESOLVED_WITH_PAYOUT") return { label: "Settled", tone: "ink" };
  if (c === "RESOLVED_BUYER_FAVOUR") {
    if (answeredKind === "accept_claim" || answeredKind === "refund_capture") return { label: "Refunded", tone: "ink" };
    if (answeredKind === "provide_evidence" || answeredKind === "provide_supporting_info") return { label: "Lost", tone: "red" };
    return { label: "Closed for the buyer", tone: "red" };
  }
  return { label: c.replace(/_/g, " ").toLowerCase(), tone: "ink" };
}

/** Opened → Investigated → Filed → PayPal reviewing → Resolved, from real dispute, run and action state. */
export function lifecycle(d: Dispute, brief: CaseBrief | null, running: boolean, runAt: string | undefined, actions: ActionRow[]): LifeStep[] {
  const answer = answeredBy(actions);
  const resolved = d.status === "RESOLVED";
  const out = outcomeOf(d, answer?.kind);
  const reviewing = d.status === "UNDER_REVIEW" || d.status === "WAITING_FOR_BUYER_RESPONSE";
  const acceptedOutright = resolved && answer?.kind === "accept_claim";
  const actionNeeded = canAct(d, brief);
  return [
    { key: "opened", label: "Opened", detail: d.dispute_life_cycle_stage === "INQUIRY" ? "Inquiry" : d.dispute_channel === "EXTERNAL" ? "Chargeback · card issuer" : "Chargeback", at: d.create_time, state: "done" },
    {
      key: "investigated",
      label: "Investigated",
      detail: running ? "Exhibit is working" : brief ? `${brief.decision === "MESSAGE_BUYER" ? "Message" : brief.decision[0] + brief.decision.slice(1).toLowerCase()} · ${brief.win_likelihood}%` : "Not yet",
      at: brief && !running ? runAt : undefined,
      state: running ? "active" : brief ? "done" : resolved ? "skipped" : "active",
    },
    {
      key: "filed",
      label: answer ? (ANSWER_LABEL[answer.kind] ?? "Filed") : "Filed",
      detail: answer ? `by ${actorLabel(answer.actor)}` : actionNeeded ? "Waiting for you" : resolved ? "Not needed" : brief ? "PayPal isn't asking yet" : "After the brief",
      at: answer?.created_at,
      state: answer ? "done" : actionNeeded && !running ? "active" : resolved ? "skipped" : "todo",
    },
    {
      key: "review",
      label: d.status === "WAITING_FOR_BUYER_RESPONSE" ? "Buyer deciding" : "PayPal reviewing",
      detail: acceptedOutright ? "Skipped: you accepted" : reviewing ? (d.status === "WAITING_FOR_BUYER_RESPONSE" ? "Offer or message with the buyer" : "PayPal's reviewer has the case") : resolved ? "Done" : "After filing",
      state: acceptedOutright ? "skipped" : reviewing ? "active" : resolved ? "done" : "todo",
    },
    {
      key: "resolved",
      label: out?.label ?? "Resolved",
      detail: resolved ? (d.dispute_outcome?.amount_refunded ? `${usd(Number(d.dispute_outcome.amount_refunded.value))} to the buyer` : "Merchant keeps the payment") : "PayPal decides",
      at: resolved ? d.update_time : undefined,
      state: resolved ? "done" : "todo",
      tone: out?.tone,
    },
  ];
}
