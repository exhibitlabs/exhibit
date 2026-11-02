import "server-only";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { executeBriefAction } from "./actions";
import type { ActionType, CaseBrief } from "./agent/brief";
import { APPROVALS_SCHEMA, db, logActivity, now } from "./db";
import { markDemoProgress } from "./demo-progress";
import { cachedDispute, latestRun } from "./disputes";
import { preventionOrder, runPreventionFix, type PreventionAction } from "./prevention";

/**
 * The approval queue. External AI agents (over MCP) never execute anything that moves money or
 * reaches a customer: they file a request here, the merchant approves it in Exhibit, and only then
 * does Exhibit run the action, through the same code path the merchant's own button uses.
 */

export type ApprovalKind = "dispute_action" | "prevention_fix";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "failed" | "stale";

export type Approval = {
  id: string;
  kind: ApprovalKind;
  /** Dispute id or order id. */
  target: string;
  /** Brief action type (provide_evidence, make_offer…) or prevention action (push_tracking…). */
  action: string;
  /** What the merchant is asked to approve, e.g. "File evidence with PayPal". */
  title: string;
  /** One or two sentences on exactly what will happen. */
  detail: string;
  amount: number | null;
  currency: string | null;
  movesMoney: boolean;
  /** Friendly name of the agent client, e.g. "Claude Desktop". */
  client: string;
  note: string | null;
  status: ApprovalStatus;
  /** The brief this request was made against: approval fails if the brief has changed since. */
  runId: string | null;
  createdAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  result: unknown;
};

type Row = {
  id: string;
  kind: ApprovalKind;
  target: string;
  action: string;
  title: string;
  detail: string;
  amount: number | null;
  currency: string | null;
  moves_money: number;
  client: string;
  note: string | null;
  status: ApprovalStatus;
  run_id: string | null;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  result: string | null;
};

const ready = new WeakSet<DatabaseSync>();
/** The table is created on first use so long-running dev servers pick it up without a restart. */
function conn() {
  const c = db();
  if (!ready.has(c)) {
    c.exec(APPROVALS_SCHEMA);
    ready.add(c);
  }
  return c;
}

const fromRow = (r: Row): Approval => ({
  id: r.id,
  kind: r.kind,
  target: r.target,
  action: r.action,
  title: r.title,
  detail: r.detail,
  amount: r.amount,
  currency: r.currency,
  movesMoney: !!r.moves_money,
  client: r.client,
  note: r.note,
  status: r.status,
  runId: r.run_id,
  createdAt: r.created_at,
  decidedAt: r.decided_at,
  decidedBy: r.decided_by,
  result: r.result ? JSON.parse(r.result) : null,
});

/** Where the merchant reviews a request in the Exhibit UI. */
export const reviewPath = (a: Approval) => (a.kind === "dispute_action" ? `/app/disputes/${a.target}?approval=${a.id}` : `/app/settings?approval=${a.id}#agent-approvals`);

export const BRIEF_ACTION_TITLE: Record<ActionType, string> = {
  provide_evidence: "File evidence with PayPal",
  provide_supporting_info: "Send the evidence packet to PayPal's chargeback review",
  make_offer: "Send the buyer an offer",
  accept_claim: "Accept the claim and refund the buyer",
  refund_then_prove: "Refund the buyer, then file proof of refund",
  send_message: "Message the buyer through PayPal",
};

const MONEY_ACTIONS: string[] = ["make_offer", "accept_claim", "refund_then_prove", "refund"];

export function listApprovals(opts: { status?: ApprovalStatus; target?: string; limit?: number } = {}): Approval[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (opts.status) {
    where.push("status = ?");
    args.push(opts.status);
  }
  if (opts.target) {
    where.push("target = ?");
    args.push(opts.target);
  }
  args.push(opts.limit ?? 100);
  const rows = conn()
    .prepare(`SELECT * FROM approvals ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY (status = 'pending') DESC, created_at DESC LIMIT ?`)
    .all(...args) as Row[];
  return rows.map(fromRow);
}

export function getApproval(id: string): Approval | undefined {
  const r = conn().prepare("SELECT * FROM approvals WHERE id = ?").get(id) as Row | undefined;
  return r ? fromRow(r) : undefined;
}

export type CreateResult = { ok: true; approval: Approval; existing: boolean } | { ok: false; error: string; status: number };

function insert(a: Omit<Approval, "id" | "status" | "createdAt" | "decidedAt" | "decidedBy" | "result">): Approval {
  const id = `apv_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
  const at = now();
  conn()
    .prepare(
      "INSERT INTO approvals (id, kind, target, action, title, detail, amount, currency, moves_money, client, note, status, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
    )
    .run(id, a.kind, a.target, a.action, a.title, a.detail, a.amount, a.currency, a.movesMoney ? 1 : 0, a.client, a.note, a.runId, at);
  return getApproval(id)!;
}

function pendingFor(kind: ApprovalKind, target: string, action: string) {
  const r = conn().prepare("SELECT * FROM approvals WHERE kind = ? AND target = ? AND action = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1").get(kind, target, action) as Row | undefined;
  return r ? fromRow(r) : undefined;
}

function briefDetail(brief: CaseBrief, amount: number, currency: string) {
  const a = brief.paypal_action;
  const money = (v: number) => `${v.toFixed(2)} ${currency}`;
  switch (a.type) {
    case "provide_evidence":
      return `Exhibit files the response letter and a ${brief.exhibits.length}-exhibit PDF packet with PayPal, covering ${(a.evidence_types ?? ["OTHER"]).join(", ").toLowerCase().replace(/_/g, " ")}. Win likelihood ${brief.win_likelihood}%.`;
    case "provide_supporting_info":
      return `Exhibit sends the response letter and a ${brief.exhibits.length}-exhibit PDF packet to PayPal's chargeback review. Win likelihood ${brief.win_likelihood}%.`;
    case "make_offer":
      return `Exhibit offers the buyer ${(a.offer_type ?? "REFUND").replace(/_/g, " ").toLowerCase()}${a.amount ? ` of ${money(a.amount)}` : ""} through PayPal.`;
    case "accept_claim":
      return `Exhibit accepts liability; PayPal refunds the buyer ${money(amount)} and closes the case.`;
    case "refund_then_prove":
      return `Exhibit refunds ${money(a.amount ?? amount)} on the capture, then files proof of refund with PayPal.`;
    case "send_message":
      return `Exhibit sends the drafted message to the buyer in the PayPal Resolution Center${brief.buyer_message?.language && brief.buyer_message.language !== "en" ? ` (in ${brief.buyer_message.language})` : ""}.`;
  }
}

/** An agent asks to carry out the latest brief's PayPal action. Nothing is sent to PayPal here. */
export function requestDisputeAction(disputeId: string, client: string, note?: string | null): CreateResult {
  const d = cachedDispute(disputeId);
  if (!d) return { ok: false, status: 404, error: `Dispute ${disputeId} not found. Call list_disputes for valid ids.` };
  if (d.status === "RESOLVED") return { ok: false, status: 409, error: `Dispute ${disputeId} is already resolved; there is nothing to file.` };
  const run = latestRun(disputeId);
  const brief = run?.status === "done" ? run.brief : null;
  if (!run || !brief) return { ok: false, status: 409, error: `Exhibit has not investigated ${disputeId} yet. Call investigate_dispute first.` };
  const a = brief.paypal_action;
  const existing = pendingFor("dispute_action", disputeId, a.type);
  if (existing && existing.runId === run.id) return { ok: true, approval: existing, existing: true };
  const amount = Number(d.dispute_amount.value);
  const currency = d.dispute_amount.currency_code;
  const money = a.type === "accept_claim" ? amount : a.type === "make_offer" || a.type === "refund_then_prove" ? (a.amount ?? amount) : null;
  // A newer brief replaces an older pending request for the same dispute.
  if (existing) decide(existing.id, "stale", "system", { reason: "Superseded by a newer brief." });
  const approval = insert({
    kind: "dispute_action",
    target: disputeId,
    action: a.type,
    title: BRIEF_ACTION_TITLE[a.type],
    detail: briefDetail(brief, amount, currency),
    amount: money,
    currency,
    // A replacement-without-refund offer carries no amount: nothing leaves the merchant's account.
    movesMoney: MONEY_ACTIONS.includes(a.type) && !(a.type === "make_offer" && !a.amount),
    client,
    note: note?.slice(0, 500) || null,
    runId: run.id,
  });
  logActivity("approval", `${client} requested approval: ${approval.title} on ${disputeId}`, disputeId, { approval: approval.id, action: a.type, client, note: approval.note });
  return { ok: true, approval, existing: false };
}

/** An agent asks to run a prevention fix on an order that may become a dispute. Nothing runs here. */
export function requestPreventionFix(orderId: string, client: string, action?: PreventionAction, note?: string | null): CreateResult {
  const order = preventionOrder(orderId);
  if (!order) return { ok: false, status: 404, error: `Order ${orderId} is not on the prevention radar. Call get_prevention_report for orders at risk.` };
  if (order.status !== "at_risk") return { ok: false, status: 409, error: `Order ${orderId} is no longer at risk (${order.status}).` };
  const fix = action ? order.fixes.find((f) => f.action === action) : (order.fixes.find((f) => f.primary) ?? order.fixes[0]);
  if (!fix) return { ok: false, status: 422, error: `${action ?? "No fix"} does not apply to ${orderId}. Available: ${order.fixes.map((f) => f.action).join(", ") || "none"}.` };
  const existing = pendingFor("prevention_fix", orderId, fix.action);
  if (existing) return { ok: true, approval: existing, existing: true };
  const approval = insert({
    kind: "prevention_fix",
    target: orderId,
    action: fix.action,
    title: `${fix.label} · ${orderId}`,
    detail: `${fix.detail} Risk ${order.score}/100 (${order.top?.label ?? order.band}); ${order.exposure.toFixed(2)} ${order.currency} exposed.`,
    amount: fix.action === "refund" ? order.amount : null,
    currency: order.currency,
    movesMoney: MONEY_ACTIONS.includes(fix.action),
    client,
    note: note?.slice(0, 500) || null,
    runId: null,
  });
  logActivity("approval", `${client} requested approval: ${fix.label} on order ${orderId}`, null, { approval: approval.id, orderId, action: fix.action, client, note: approval.note });
  return { ok: true, approval, existing: false };
}

function decide(id: string, status: ApprovalStatus, by: string, result: unknown) {
  conn().prepare("UPDATE approvals SET status = ?, decided_at = ?, decided_by = ?, result = ? WHERE id = ?").run(status, now(), by, JSON.stringify(result ?? null), id);
}

// One decision at a time per approval, even if the merchant double-clicks.
const g = globalThis as typeof globalThis & { __exhibitApproving?: Set<string> };
const inFlight = (g.__exhibitApproving ??= new Set<string>());

export type DecisionResult = { ok: true; approval: Approval } | { ok: false; error: string; status: number; approval?: Approval };

/** The merchant approves: Exhibit executes the action exactly as its own "File" button would. */
export async function approveRequest(id: string): Promise<DecisionResult> {
  const a = getApproval(id);
  if (!a) return { ok: false, status: 404, error: "Approval not found." };
  if (a.status !== "pending") return { ok: false, status: 409, error: `This request is already ${a.status}.`, approval: a };
  if (inFlight.has(id)) return { ok: false, status: 409, error: "Already executing.", approval: a };
  inFlight.add(id);
  const actor = `agent:${a.client} approved by merchant`;
  try {
    const subject = a.kind === "dispute_action" ? a.target : null;
    if (a.kind === "dispute_action") {
      const run = latestRun(a.target);
      if (!run || run.id !== a.runId || run.brief?.paypal_action.type !== a.action) {
        decide(id, "stale", "merchant", { error: "The case brief changed after this request. Ask the agent to request again." });
        logActivity("approval", `Approval for ${a.title} on ${a.target} expired: the brief changed since ${a.client} asked`, a.target, { approval: id });
        return { ok: false, status: 409, error: "The case brief changed after this request was made; nothing was filed.", approval: getApproval(id) };
      }
    }
    logActivity("approval", `Merchant approved ${a.client}'s request: ${a.title}${a.kind === "prevention_fix" ? "" : ` on ${a.target}`}`, subject, { approval: id });
    const result = a.kind === "dispute_action" ? await executeBriefAction(a.target, {}, actor) : await runPreventionFix(a.target, a.action as PreventionAction, { actor });
    decide(id, result.ok ? "approved" : "failed", "merchant", result);
    if (result.ok) markDemoProgress("approve");
    if (!result.ok) logActivity("action_error", `Approved request failed: ${a.title}: ${result.error}`, subject, { approval: id });
    return result.ok ? { ok: true, approval: getApproval(id)! } : { ok: false, status: 422, error: result.error, approval: getApproval(id) };
  } finally {
    inFlight.delete(id);
  }
}

export function rejectRequest(id: string, reason?: string): DecisionResult {
  const a = getApproval(id);
  if (!a) return { ok: false, status: 404, error: "Approval not found." };
  if (a.status !== "pending") return { ok: false, status: 409, error: `This request is already ${a.status}.`, approval: a };
  decide(id, "rejected", "merchant", { reason: reason ?? null });
  logActivity("approval", `Merchant rejected ${a.client}'s request: ${a.title}${a.kind === "prevention_fix" ? "" : ` on ${a.target}`}`, a.kind === "dispute_action" ? a.target : null, { approval: id, reason });
  return { ok: true, approval: getApproval(id)! };
}
