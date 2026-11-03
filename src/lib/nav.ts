import "server-only";
import { listApprovals } from "./approvals";
import { allActions, cachedDisputes } from "./disputes";
import { preventionReport } from "./prevention";
import { REASON_LABEL } from "./paypal/types";

/** PayPal actions that answer a case; once one succeeds, the case is waiting on PayPal or the buyer. */
const ANSWERS = new Set(["provide_evidence", "provide_supporting_info", "accept_claim", "make_offer", "send_message", "refund_capture"]);

export type NavCounts = { needsResponse: number; atRisk: number; approvals: number };

export type Notice = {
  id: string;
  kind: "deadline" | "approval" | "resolved" | "autopilot";
  title: string;
  detail: string;
  at: string;
  href: string;
  urgent?: boolean;
};

const hoursUntil = (iso?: string) => (iso ? Math.round((Date.parse(iso) - Date.now()) / 3600_000) : null);
const span = (h: number) => (h < 0 ? `${Math.abs(h) < 48 ? `${Math.abs(h)}h` : `${Math.round(Math.abs(h) / 24)}d`} ago` : h < 48 ? `in ${h}h` : `in ${Math.round(h / 24)} days`);

/** Sidebar badges and the notifications popover, from live state (cheap enough to poll). */
export function navState(): { counts: NavCounts; notices: Notice[] } {
  const disputes = cachedDisputes();
  const actions = allActions();
  const answered = new Set(actions.filter((a) => a.status === "ok" && ANSWERS.has(a.kind)).map((a) => a.dispute_id));
  const needs = disputes.filter((d) => d.status === "WAITING_FOR_SELLER_RESPONSE" && !answered.has(d.dispute_id));
  const pending = listApprovals({ status: "pending", limit: 20 });
  let atRisk = 0;
  try {
    atRisk = preventionReport().totals.atRisk;
  } catch {
    // Prevention data is optional for the badge.
  }

  const notices: Notice[] = [];
  for (const a of pending) {
    notices.push({
      id: `apv:${a.id}`,
      kind: "approval",
      title: `${a.client} requests: ${a.title}`,
      detail: a.kind === "dispute_action" ? `${a.target}${a.amount !== null ? ` · $${a.amount.toFixed(2)}` : ""} · waiting for your approval` : `Order ${a.target} · waiting for your approval`,
      at: a.createdAt,
      href: a.kind === "dispute_action" ? `/app/disputes/${a.target}?approval=${a.id}` : `/app/approvals?approval=${a.id}`,
      urgent: true,
    });
  }
  for (const d of needs) {
    const h = hoursUntil(d.seller_response_due_date);
    if (h === null || h > 72) continue;
    const buyer = d.disputed_transactions[0]?.buyer?.name ?? "Buyer";
    notices.push({
      id: `due:${d.dispute_id}:${d.seller_response_due_date}`,
      kind: "deadline",
      title: h < 0 ? `Response overdue: ${buyer}` : `Response due ${span(h)}: ${buyer}`,
      detail: `${REASON_LABEL[d.reason] ?? d.reason} · $${d.dispute_amount.value} · ${d.dispute_id}`,
      at: d.seller_response_due_date!,
      href: `/app/disputes/${d.dispute_id}`,
      urgent: h < 48,
    });
  }
  const dayAgo = new Date(Date.now() - 48 * 3600_000).toISOString();
  for (const d of disputes.filter((x) => x.status === "RESOLVED" && x.update_time >= dayAgo)) {
    const code = d.dispute_outcome?.outcome_code;
    const buyer = d.disputed_transactions[0]?.buyer?.name ?? "Buyer";
    notices.push({
      id: `res:${d.dispute_id}:${d.update_time}`,
      kind: "resolved",
      title: code === "RESOLVED_SELLER_FAVOUR" ? `PayPal ruled for you: ${buyer}` : code === "RESOLVED_WITH_PAYOUT" ? `Settled with an offer: ${buyer}` : `Closed in the buyer's favour: ${buyer}`,
      detail: `${REASON_LABEL[d.reason] ?? d.reason} · $${d.dispute_amount.value} · ${d.dispute_id}`,
      at: d.update_time,
      href: `/app/disputes/${d.dispute_id}`,
    });
  }
  for (const a of actions.filter((x) => x.actor === "autopilot" && x.status === "ok" && x.created_at >= dayAgo).slice(0, 5)) {
    notices.push({ id: `auto:${a.id}`, kind: "autopilot", title: `Autopilot: ${a.kind.replace(/_/g, " ")}`, detail: `${a.dispute_id} · within your rules`, at: a.created_at, href: `/app/disputes/${a.dispute_id}` });
  }
  const order = { approval: 0, deadline: 1, autopilot: 2, resolved: 3 } as const;
  notices.sort((a, b) => order[a.kind] - order[b.kind] || (a.kind === "deadline" ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)));
  return { counts: { needsResponse: needs.length, atRisk, approvals: pending.length }, notices: notices.slice(0, 12) };
}
