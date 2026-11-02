import "server-only";
// Offline answers: a deterministic intent router for the questions merchants ask most. It calls the
// same read-only tools the live agent uses (so the trace is real and every number comes from app
// data) and composes the answer from templates. Open-ended questions need a Claude key.

import { matchReason, reasonLabel } from "../data";
import { SUGGESTED_QUESTIONS, type AnswerInput, type AskTurn } from "../schema";
import { bookFor, callTool, type AskContext } from "../tools";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const due = (h: number | null) => (h === null ? "no deadline" : h < 0 ? "overdue" : h <= 72 ? `${h}h` : `${Math.round(h / 24)} days`);
const first = (name: string) => name.split(/\s+/)[0];
const lower = (s: string) => (/^[A-Z][a-z]/.test(s) && !s.startsWith("PayPal") ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const adj = (label: string) => lower(label).replace(/ /g, "-");
const SIGNAL_PHRASE: Record<string, string> = {
  tracking_not_on_paypal: "tracking never sent to PayPal",
  tracking_stalled: "stalled tracking",
  unsigned_high_value: "an unsigned high-value delivery",
  address_mismatch: "an address mismatch",
  refund_overdue: "an overdue refund",
  buyer_waiting: "a buyer waiting on a reply",
  weak_checkout: "weak checkout signals",
};
const SIGNAL_FIX: Record<string, string> = {
  tracking_not_on_paypal: "Prevention pushes tracking to PayPal in one click, so proof is on file before a claim.",
  buyer_waiting: "A reply from Prevention usually stops the claim before it's filed.",
  tracking_stalled: "Prevention drafts a status update to the buyer before they file.",
  refund_overdue: "Refunding now from Prevention avoids a credit-not-processed claim.",
  weak_checkout: "Prevention can hold the order and verify the buyer before it ships.",
};
const DECISION_WORD: Record<string, string> = { FIGHT: "Fight", OFFER: "Offer a resolution", REFUND: "Refund", MESSAGE_BUYER: "Message the buyer" };

// ---- Tool result shapes (as returned by tools.ts) -----------------------------------------------

type OpenRow = { id: string; buyer: string; item: string; reason: string; stage: string; status: string; amount: number; hours_left: number | null; next_step: string; needs_you: boolean; exhibit_call: string | null; win_likelihood_pct: number | null; headline: string | null };
type ListOut = { count: number; open_total: number; total_amount: number; needs_you: number; not_investigated: number; brief_ready: number; due_within_72h: number; disputes: OpenRow[] };
type Agg = { count: number; amount: number; recovered: number; refunded: number; lost: number; fought: number; won_fights: number; win_rate_pct: number | null; recovery_rate_pct: number | null };
type StatsOut = { groups: (Agg & { group: string })[]; total: Agg; period: string };
type OpenStatsOut = { groups: { group: string; count: number; amount: number }[]; total: { count: number; amount: number } };
type RiskOrder = { id: string; buyer: string; item: string; amount: number; score: number; band: string; top_signal: string | null; detail: string | null; leads_to: string | null; recommended_fix: string | null };
type RiskOut = { watched: number; at_risk: number; matching: number; exposure: number; matching_exposure: number; expected_disputes_if_nothing_changes: number; high: number; by_signal: { signal: string; kind: string; leads_to: string; orders: number; exposure: number }[]; orders: RiskOrder[] };
type RecoveryOut = {
  period: string; from: string; closed_cases: number; recovered: number; refunded: number; lost: number; fought: number; won_fights: number; win_rate_pct: number | null; settled: number; buyer_closed: number;
  inquiries_closed: number; fees_avoided: number; open_cases: number; open_exposure: number; expected_from_open: number; open_investigated: number; hours_saved: number;
  trend_13_weeks: { week_of: string; recovered: number; refunded: number; lost: number }[];
};
type CaseOut = {
  found: boolean; id: string; buyer: string; reason: string; stage: string; status: string; amount: number; opened: string; response_due: string | null; hours_left: number | null; next_step: string | null;
  order: { id: string; placed: string; items: string[]; total: number; paid_with: string; ship_to: string; refunds: { amount: number; at: string }[] } | null;
  shipment: { carrier: string; service: string; status: string; shipped: string; delivered: string | null; signed_by: string | null; last_scan: string | null } | null;
  return_shipment: { carrier: string; status: string; delivered: string | null } | null;
  checkout_signals: { avs: string | null; cvv: string | null; three_d_secure: string | null; device_seen_before: boolean; ip_city: string; ip_to_shipping_km: number; email_age_days: number } | null;
  customer: { first_order: string; orders: number; lifetime_value: number; prior_disputes: number } | null;
  exhibit_brief: { decision: string; headline: string; win_likelihood_pct: number; paypal_action: string } | null;
  dispute_fee: { amount: number; basis: string } | null;
  open_cases?: { id: string; buyer: string }[];
};

/** Runs tools side by side, staggered so the trace reads like an agent fanning out. */
async function fan<T extends unknown[]>(ctx: AskContext, calls: { [K in keyof T]: [string, unknown] }): Promise<T> {
  return (await Promise.all(calls.map(([name, input], i) => sleep(i * 170).then(() => callTool(name, input, ctx, 380 + i * 140))))) as T;
}

const fmtDate = (iso: string | null | undefined) => (iso ? new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "—");

// ---- Intents ------------------------------------------------------------------------------------

async function needsToday(ctx: AskContext): Promise<AnswerInput> {
  const [l, p] = await fan<[ListOut, RiskOut]>(ctx, [
    ["list_disputes", { status: "needs_you", sort: "deadline", limit: 12 }],
    ["at_risk_orders", { band: "high", limit: 3 }],
  ]);
  if (!l.count) {
    return {
      text: `**Nothing needs you right now.** All ${plural(l.open_total, "open dispute")} have been answered and are waiting on PayPal.${p.high ? ` Upstream, ${plural(p.high, "order")} ${p.high === 1 ? "is" : "are"} at high risk of becoming a dispute.` : ""}`,
      chart: null,
      orders: p.orders.slice(0, 3).map((o) => ({ id: o.id, note: o.top_signal ?? undefined })),
      followups: ["Which orders are about to turn into disputes?", "How much has Exhibit recovered this quarter?"],
    };
  }
  const urgent = l.disputes.filter((d) => d.hours_left !== null && d.hours_left <= 72);
  const lead = urgent.length
    ? `**${urgent.length === 1 ? "One dispute is" : `${urgent.length} disputes are`} due within 72 hours.** ${urgent
        .slice(0, 2)
        .map((d, i) => `${i ? "then " : ""}${d.buyer}'s ${usd(d.amount)} ${lower(d.reason)} ${lower(d.stage)}${i ? "" : " is due"} in ${due(d.hours_left)}`)
        .join(", ")
        .replace(/^./, (c) => c.toUpperCase())}.`
    : `**Nothing is due in the next 72 hours.** The closest deadline is ${l.disputes[0].buyer}'s ${lower(l.disputes[0].reason)} case, in ${due(l.disputes[0].hours_left)}.`;
  const bullets: string[] = [];
  if (l.not_investigated === l.count) bullets.push(`${l.count === l.open_total ? "All " : ""}${plural(l.count, "open case")} (${usd(l.total_amount)}) still need${l.count === 1 ? "s" : ""} a person, and none has an Exhibit brief yet. Run Exhibit on all open disputes and you're left with approvals only.`);
  else {
    const parts = [l.brief_ready ? `${l.brief_ready} ${l.brief_ready === 1 ? "has a brief" : "have briefs"} ready to approve` : null, l.not_investigated ? `${l.not_investigated} ${l.not_investigated === 1 ? "hasn't" : "haven't"} been investigated yet` : null].filter(Boolean) as string[];
    bullets.push(l.brief_ready === l.count ? `${plural(l.count, "case")} need${l.count === 1 ? "s" : ""} you, and every one has Exhibit's brief ready: approving is the only step left.` : `${plural(l.count, "case")} need${l.count === 1 ? "s" : ""} you: ${list(parts)}.`);
    const ready = l.disputes.find((d) => d.exhibit_call && d.headline);
    if (ready) bullets.push(`Quickest win: ${ready.buyer}, ${lower(ready.headline!)}.`);
    bullets.push(`${usd(l.total_amount)} is at stake across them.`);
  }
  if (p.orders[0]) bullets.push(`Upstream, ${plural(p.high, "order")} could become new disputes. Top of the list: ${p.orders[0].buyer}'s ${p.orders[0].item} (${lower(p.orders[0].top_signal ?? "at risk")}).`);
  const chartRows = l.disputes.filter((d) => d.hours_left !== null).slice(0, 8);
  return {
    text: `${lead}\n\n${bullets.map((b) => `- ${b}`).join("\n")}`,
    chart: chartRows.length > 1
      ? {
          type: "bar",
          title: "Hours left to respond to PayPal",
          unit: "hours",
          labels: chartRows.map((d) => first(d.buyer)),
          series: [
            { name: "Due within 72h", values: chartRows.map((d) => (d.hours_left! <= 72 ? d.hours_left! : 0)), tone: "red" },
            { name: "Later", values: chartRows.map((d) => (d.hours_left! > 72 ? d.hours_left! : 0)), tone: "ink" },
          ],
          stacked: true,
        }
      : null,
    cases: l.disputes.slice(0, 6).map((d) => ({ id: d.id, note: d.hours_left !== null && d.hours_left <= 72 ? `due in ${due(d.hours_left)}` : undefined })),
    orders: p.orders.slice(0, 1).map((o) => ({ id: o.id, note: o.recommended_fix ?? undefined })),
    followups: [urgent[0] ? `Summarize the ${urgent[0].buyer} case for my accountant` : "What's our win rate by dispute reason?", "Which orders are about to turn into disputes?", "How much has Exhibit recovered this quarter?"],
  };
}

async function losing(ctx: AskContext, reasonText: string | undefined): Promise<AnswerInput> {
  let reason = matchReason(reasonText);
  if (!reason) {
    // No reason named: find where the most money goes out.
    const all = await callTool<StatsOut>("dispute_stats", { group_by: "reason", scope: "resolved", period: "last_90_days" }, ctx, 380);
    const worst = [...all.groups].sort((a, b) => b.refunded + b.lost - (a.refunded + a.lost))[0];
    reason = matchReason(worst?.group) ?? "MERCHANDISE_OR_SERVICE_NOT_RECEIVED";
  }
  const label = reasonLabel(reason);
  const [s, byReason, p, open] = await fan<[StatsOut, StatsOut, RiskOut, ListOut]>(ctx, [
    ["dispute_stats", { group_by: "outcome", scope: "resolved", period: "last_90_days", reason }],
    ["dispute_stats", { group_by: "reason", scope: "resolved", period: "last_90_days" }],
    ["at_risk_orders", { reason, limit: 4 }],
    ["list_disputes", { status: "open", reason }],
  ]);
  const t = s.total;
  const n = (g: string) => s.groups.find((x) => x.group === g)?.count ?? 0;
  const otherReason = byReason.groups.map((g) => g.group).find((g) => g !== label) ?? "Not as described";
  const followups = ["Which orders are about to turn into disputes?", "What's our win rate by dispute reason?", `Why are we losing ${lower(otherReason)} cases?`];
  if (!t.count) {
    return {
      text: `**No ${adj(label)} cases closed in the last 90 days**, so there's no loss pattern to read yet.${open.count ? ` ${open.count} ${open.count === 1 ? "is" : "are"} open now (${usd(open.total_amount)}).` : ""}`,
      chart: null,
      cases: open.disputes.slice(0, 4).map((d) => ({ id: d.id })),
      followups,
    };
  }
  const outflow = t.refunded + t.lost;
  const overall = byReason.total.recovery_rate_pct;
  const better = t.recovery_rate_pct !== null && overall !== null && t.recovery_rate_pct >= overall;
  const split = t.lost <= t.refunded ? "What goes out is mostly refunds, not lost fights." : "Lost fights are the bigger leak.";
  const lead =
    outflow === 0
      ? `**You aren't losing ${adj(label)} cases:** all ${t.count} closed in the last 90 days kept the money.`
      : better
        ? `**You're not losing many ${adj(label)} cases: you keep ${t.recovery_rate_pct}% of disputed dollars**, against ${overall}% across all reasons. ${split}`
        : `**You keep only ${t.recovery_rate_pct}% of disputed ${adj(label)} dollars**, against ${overall}% across all reasons. ${split}`;
  const outcomes = [n("Won") && `${n("Won")} won`, n("Buyer closed") && `${n("Buyer closed")} closed by the buyer`, n("Settled") && `${n("Settled")} settled`, n("Refunded") && `${n("Refunded")} refunded on Exhibit's advice`, n("Lost") && `${n("Lost")} lost after fighting`].filter(Boolean) as string[];
  const bullets = [`Last 90 days: ${list(outcomes)}${outflow ? ` (${usd(t.refunded)} refunded, ${usd(t.lost)} lost)` : ""}.`];
  if (t.fought) bullets.push(`Exhibit wins ${t.win_rate_pct}% of the ones it fights (${t.won_fights} of ${t.fought})${t.lost <= t.refunded && outflow ? ": the money goes out on cases the records couldn't win" : ""}.`);
  const sig = p.by_signal.filter((x) => x.orders > 0).slice(0, 2);
  if (sig.length) bullets.push(`Upstream: ${list(sig.map((x, i) => `${i ? x.orders : plural(x.orders, "open order")} with ${SIGNAL_PHRASE[x.kind] ?? lower(x.signal)}`))}.${SIGNAL_FIX[sig[0].kind] ? ` ${SIGNAL_FIX[sig[0].kind]}` : ""}`);
  return {
    text: `${lead}\n\n${bullets.map((b) => `- ${b}`).join("\n")}`,
    chart: { type: "donut", title: `Where ${adj(label)} money went · last 90 days`, unit: "usd", labels: ["Recovered", "Refunded", "Lost"], series: [{ name: "Amount", values: [t.recovered, t.refunded, t.lost] }] },
    cases: open.disputes.slice(0, 4).map((d) => ({ id: d.id, note: d.exhibit_call ? DECISION_WORD[d.exhibit_call] : d.hours_left !== null ? `due in ${due(d.hours_left)}` : undefined })),
    orders: p.orders.slice(0, 3).map((o) => ({ id: o.id, note: o.recommended_fix ?? undefined })),
    followups,
  };
}

const PERIOD_PHRASE: Record<string, string> = { this_quarter: "this quarter", this_month: "this month", last_30_days: "in the last 30 days", last_90_days: "in the last 90 days", all_time: "so far" };

function periodOf(q: string) {
  if (/quarter|\bq[1-4]\b|qtd/.test(q)) return "this_quarter";
  if (/this month|mtd/.test(q)) return "this_month";
  if (/30 days|last month|past month/.test(q)) return "last_30_days";
  if (/90 days|3 months|three months/.test(q)) return "last_90_days";
  if (/all.?time|ever|in total|so far|overall/.test(q)) return "all_time";
  return "this_quarter";
}

async function recovered(ctx: AskContext, period: string): Promise<AnswerInput> {
  const s = await callTool<RecoveryOut>("recovery_summary", { period }, ctx, 520);
  const phrase = PERIOD_PHRASE[period] ?? "this quarter";
  const trend = s.trend_13_weeks;
  const chart: AnswerInput["chart"] = trend.some((w) => w.recovered || w.refunded || w.lost)
    ? {
        type: "bar",
        title: "Closed-case money by week · last 13 weeks",
        unit: "usd",
        labels: trend.map((w) => w.week_of),
        series: [
          { name: "Recovered", values: trend.map((w) => w.recovered), tone: "green" },
          { name: "Refunded", values: trend.map((w) => w.refunded), tone: "grey" },
          { name: "Lost", values: trend.map((w) => w.lost), tone: "red" },
        ],
        stacked: true,
      }
    : null;
  if (!s.closed_cases) {
    return {
      text: `**No disputes have closed ${phrase} yet**, so nothing is recovered or lost so far. ${s.open_cases ? `${plural(s.open_cases, "case")} ${s.open_cases === 1 ? "is" : "are"} open with ${usd(s.open_exposure)} at stake.` : ""}`.trim(),
      chart,
      followups: ["Which disputes need me today?", "Which orders are about to turn into disputes?"],
    };
  }
  const bullets = [
    s.fought ? `Fights: ${s.won_fights} of ${s.fought} won (${s.win_rate_pct}%)${s.settled ? `, plus ${plural(s.settled, "case")} settled with a partial refund` : ""}${s.buyer_closed ? ` and ${s.buyer_closed} closed by the buyer after Exhibit messaged them` : ""}.` : null,
    s.fees_avoided ? `${usd(s.fees_avoided)} in PayPal dispute fees avoided by closing ${plural(s.inquiries_closed, "inquiry", "inquiries")} before they escalated.` : null,
    s.refunded || s.lost ? `Given back: ${usd(s.refunded)} refunded where Exhibit advised it${s.lost ? `, ${usd(s.lost)} lost after fighting` : ", nothing lost in a fight"}.` : null,
    s.open_cases ? `Still open: ${plural(s.open_cases, "case")}, ${usd(s.open_exposure)} at stake${s.expected_from_open > 0 ? `, about ${usd(s.expected_from_open)} expected back` : s.open_investigated === 0 ? ", none investigated yet" : ""}.` : null,
  ].filter(Boolean) as string[];
  return {
    text: `**Exhibit recovered ${usd(s.recovered)} ${phrase}** across ${plural(s.closed_cases, "closed dispute")} (${fmtDate(s.from)} to today).\n\n${bullets.map((b) => `- ${b}`).join("\n")}`,
    chart,
    followups: ["Why are we losing item-not-received cases?", "What's our win rate by dispute reason?", period === "this_quarter" ? "How much did we recover in the last 90 days?" : "Which disputes need me today?"],
  };
}

async function atRisk(ctx: AskContext): Promise<AnswerInput> {
  const p = await callTool<RiskOut>("at_risk_orders", { limit: 6 }, ctx, 560);
  if (!p.at_risk) return { text: `**No order on the radar looks like a future dispute.** All ${p.watched} recent orders are clear.`, chart: null, followups: ["Which disputes need me today?"] };
  const high = p.orders.filter((o) => o.band === "high").slice(0, 3);
  const top = p.by_signal.filter((s) => s.orders > 0).sort((a, b) => b.orders - a.orders || b.exposure - a.exposure);
  const bullets = high.map((o) => `${o.buyer} · ${o.item} (${usd(o.amount)}): ${(o.detail ?? o.top_signal ?? "").replace(/\.?$/, ".")}${o.recommended_fix ? ` **Fix:** ${lower(o.recommended_fix)}.` : ""}`);
  if (top[0]) bullets.push(`Most common gap: ${plural(top[0].orders, "order")} with ${SIGNAL_PHRASE[top[0].kind] ?? lower(top[0].signal)} (${usd(top[0].exposure)}), which invites ${adj(top[0].leads_to)} claims.${SIGNAL_FIX[top[0].kind] ? ` ${SIGNAL_FIX[top[0].kind]}` : ""}`);
  return {
    text: `**${p.at_risk} of ${p.watched} recent orders look like future disputes**: ${usd(p.exposure)} in sales, about ${Math.round(p.expected_disputes_if_nothing_changes)} disputes if nothing changes. ${p.high ? `${p.high} ${p.high === 1 ? "is" : "are"} high risk:` : ""}\n\n${bullets.map((b) => `- ${b}`).join("\n")}`,
    chart: top.length > 1 ? { type: "bar", title: "At-risk orders by signal", unit: "count", labels: top.map((s) => s.signal), series: [{ name: "Orders", values: top.map((s) => s.orders), tone: "ink" }] } : null,
    orders: p.orders.slice(0, 6).map((o) => ({ id: o.id, note: o.recommended_fix ?? undefined })),
    followups: ["Why are we losing item-not-received cases?", "Which disputes need me today?", "How much has Exhibit recovered this quarter?"],
  };
}

const THREE_DS: Record<string, string> = { AUTHENTICATED: "authenticated", ATTEMPTED: "attempted", NOT_ENROLLED: "not enrolled", NONE: "not used" };
const AVS: Record<string, string> = { Y: "full match", A: "address only", Z: "ZIP only", N: "no match", U: "unavailable" };
const CVV: Record<string, string> = { M: "match", N: "no match", U: "unavailable" };

async function caseSummary(ctx: AskContext, query: string, forAccountant: boolean): Promise<AnswerInput> {
  const c = await callTool<CaseOut>("get_case", { query }, ctx, 620);
  if (!c.found) {
    return { text: `I couldn't find a dispute matching “${query}”. Open cases: ${list((c.open_cases ?? []).slice(0, 6).map((x) => x.buyer))}.`, chart: null, followups: (c.open_cases ?? []).slice(0, 3).map((x) => `Summarize the ${x.buyer} case`) };
  }
  const o = c.order;
  const sh = c.shipment;
  const lines: string[] = [];
  if (o) lines.push(`**What happened:** ${first(c.buyer)} bought ${list(o.items.map((i) => i.replace(/^1 × /, "")))} for ${usd(o.total)} on ${fmtDate(o.placed)}, paying ${o.paid_with}. On ${fmtDate(c.opened)} a ${lower(c.stage)} for ${usd(c.amount)} was opened as “${lower(c.reason)}”.`);
  if (sh) {
    const st = sh.status === "DELIVERED" ? `delivered ${fmtDate(sh.delivered)}${sh.signed_by ? `, signed for by ${sh.signed_by}` : ""}` : sh.status === "RETURNED_TO_SENDER" ? "returned to sender" : lower(sh.last_scan ?? sh.status.replace(/_/g, " "));
    lines.push(`**Delivery:** ${sh.service}, shipped ${fmtDate(sh.shipped)}, ${st}.`);
  }
  if (c.return_shipment) lines.push(`**Return:** ${c.return_shipment.carrier} return ${c.return_shipment.status === "DELIVERED" ? `received ${fmtDate(c.return_shipment.delivered)}` : lower(c.return_shipment.status.replace(/_/g, " "))}; ${o?.refunds.length ? `refunded ${usd(o.refunds.reduce((a, r) => a + r.amount, 0))}` : "no refund issued yet"}.`);
  const cs = c.checkout_signals;
  if (cs && (/unauthori/i.test(c.reason) || cs.avs === "N" || cs.cvv === "N" || cs.ip_to_shipping_km > 500)) {
    lines.push(`**Checkout:** AVS ${AVS[cs.avs ?? "U"] ?? cs.avs}, CVV ${CVV[cs.cvv ?? "U"] ?? cs.cvv}, 3-D Secure ${THREE_DS[cs.three_d_secure ?? "NONE"] ?? cs.three_d_secure}, ${cs.device_seen_before ? "a device seen on earlier orders" : "a new device"}, IP in ${cs.ip_city} ${cs.ip_to_shipping_km} km from the delivery address.`);
  }
  if (c.customer) lines.push(`**Buyer history:** customer since ${fmtDate(c.customer.first_order)}, ${plural(c.customer.orders, "order")}, ${usd(c.customer.lifetime_value)} lifetime, ${plural(c.customer.prior_disputes, "prior dispute")}.`);
  const answered = c.next_step?.startsWith("Answered");
  lines.push(
    c.exhibit_brief
      ? `**Exhibit's call:** ${DECISION_WORD[c.exhibit_brief.decision] ?? c.exhibit_brief.decision}, ${c.exhibit_brief.win_likelihood_pct}% likely to win. ${c.exhibit_brief.headline.replace(/\.?$/, ".")}${answered ? " The response is filed; PayPal is deciding." : ""}`
      : `**Exhibit's call:** not investigated yet. Run Exhibit on the case for a decision and an evidence packet.`,
  );
  if (forAccountant) lines.push(`**Money:** ${usd(c.amount)} disputed${c.dispute_fee ? `; PayPal's US fee schedule lists a ${usd(c.dispute_fee.amount)} ${c.dispute_fee.basis}` : ""}. PayPal decides the outcome${c.response_due && !answered ? `; the response is due ${fmtDate(c.response_due)}` : ""}.`);
  const head = `**${c.buyer} · ${c.reason} · ${usd(c.amount)}**, ${lower(c.stage)} ${c.id}, ${lower(c.status)}${c.hours_left !== null && !answered ? `, due in ${due(c.hours_left)}` : ""}.`;
  return {
    text: `${head}\n\n${lines.map((l) => `- ${l}`).join("\n")}`,
    chart: null,
    cases: [{ id: c.id, note: c.next_step ?? undefined }],
    followups: ["Which disputes need me today?", `Why are we losing ${lower(c.reason)} cases?`, "How much has Exhibit recovered this quarter?"],
  };
}

async function winRate(ctx: AskContext): Promise<AnswerInput> {
  const s = await callTool<StatsOut>("dispute_stats", { group_by: "reason", scope: "resolved", period: "last_90_days" }, ctx, 520);
  if (!s.total.count) return { text: "**No disputes have closed in the last 90 days yet**, so there's no win rate to report.", chart: null, followups: ["Which disputes need me today?"] };
  const groups = s.groups.slice(0, 6);
  const bullets = groups.slice(0, 4).map((g) => (g.fought ? `${g.group}: ${g.win_rate_pct}% of fights won (${g.won_fights} of ${g.fought}), ${usd(g.recovered)} kept of ${usd(g.amount)}.` : `${g.group}: never fought; ${plural(g.count, "case")} settled or refunded, ${usd(g.recovered)} kept of ${usd(g.amount)}.`));
  return {
    text: `**Exhibit wins ${s.total.win_rate_pct ?? 0}% of the disputes it fights** (${s.total.won_fights} of ${s.total.fought}) over ${plural(s.total.count, "closed case")} in the last 90 days.\n\n${bullets.map((b) => `- ${b}`).join("\n")}`,
    chart: {
      type: "bar",
      title: "Closed-case money by reason · last 90 days",
      unit: "usd",
      labels: groups.map((g) => g.group),
      series: [
        { name: "Recovered", values: groups.map((g) => g.recovered), tone: "green" },
        { name: "Refunded", values: groups.map((g) => g.refunded), tone: "grey" },
        { name: "Lost", values: groups.map((g) => g.lost), tone: "red" },
      ],
      stacked: true,
    },
    followups: ["Why are we losing item-not-received cases?", "How much has Exhibit recovered this quarter?", "Which disputes need me today?"],
  };
}

async function openBook(ctx: AskContext): Promise<AnswerInput> {
  const [l, s] = await fan<[ListOut, OpenStatsOut]>(ctx, [
    ["list_disputes", { status: "open", sort: "deadline" }],
    ["dispute_stats", { group_by: "reason", scope: "open" }],
  ]);
  if (!l.count) return { text: "**No disputes are open.**", chart: null, followups: ["How much has Exhibit recovered this quarter?"] };
  return {
    text: `**${plural(l.count, "open dispute")}, ${usd(l.total_amount)} at stake.** ${l.due_within_72h ? `${l.due_within_72h} ${l.due_within_72h === 1 ? "is" : "are"} due within 72 hours; ` : ""}the next deadline is ${l.disputes[0].buyer}'s, in ${due(l.disputes[0].hours_left)}.\n\n${s.groups.slice(0, 4).map((g) => `- ${g.group}: ${plural(g.count, "case")}, ${usd(g.amount)}`).join("\n")}`,
    chart: { type: "donut", title: "Open exposure by reason", unit: "usd", labels: s.groups.map((g) => g.group), series: [{ name: "At stake", values: s.groups.map((g) => g.amount) }] },
    cases: l.disputes.slice(0, 6).map((d) => ({ id: d.id })),
    followups: ["Which disputes need me today?", "What's our win rate by dispute reason?"],
  };
}

// ---- Router -------------------------------------------------------------------------------------

export const OFFLINE_FALLBACK = "That one needs the live agent: add a Claude key for open questions. Offline, I answer questions about deadlines, losses by reason, recoveries, at-risk orders and individual cases.";

/** Picks an intent for the question, or undefined when only a live model could answer it. */
export async function routeOffline(question: string, history: AskTurn[], ctx: AskContext): Promise<(() => Promise<AnswerInput>) | undefined> {
  const q = question.toLowerCase().replace(/[’']/g, "'");
  const b = await bookFor(ctx);
  // A named buyer or a dispute id means a case question.
  const byId = b.rows.find((r) => q.includes(r.id.toLowerCase()));
  const byName =
    b.rows.find((r) => q.includes(r.buyer.toLowerCase())) ??
    b.rows.find((r) => {
      const [fn, ...rest] = r.buyer.toLowerCase().split(/\s+/);
      const ln = rest.at(-1);
      return (ln && ln.length > 3 && new RegExp(`\\b${ln}\\b`).test(q)) || (fn.length > 3 && new RegExp(`\\b${fn}('s)?\\b`).test(q) && b.rows.filter((x) => x.buyer.toLowerCase().startsWith(fn)).length === 1);
    });
  const hit = byId ?? byName;
  if (hit && !/why .*los|losing/.test(q)) return () => caseSummary(ctx, hit.id, /accountant|bookkeep|finance|cpa|tax|summar/.test(q));
  // "that case" / "this one" after a case answer.
  if (/\b(that|this) (case|one|dispute)\b/.test(q) && history.length) {
    const prev = b.rows.find((r) => history.at(-1)!.a.includes(r.buyer) || history.at(-1)!.a.includes(r.id));
    if (prev) return () => caseSummary(ctx, prev.id, /accountant|summar/.test(q));
  }
  if (/(about to|turn into|become|becoming|at[- ]risk orders?|risky|prevent|before they|likely to dispute|future disputes?)/.test(q) || (/orders?/.test(q) && /risk/.test(q))) return () => atRisk(ctx);
  if (/\bwhy\b.*\b(los|lose|losing|lost)|\blosing\b|\bleak/.test(q)) return () => losing(ctx, q);
  if (/win rate|by reason|breakdown|which reasons?|best.*worst|how often (do )?we win/.test(q)) return () => winRate(ctx);
  if (/recover|won back|money back|saved|fees avoided|how much .*(won|kept|back)|roi|paid for itself/.test(q)) return () => recovered(ctx, periodOf(q));
  if (/\bneeds? (me|my|attention)|today|urgent|due|deadline|priorit|first|focus|what should i|to.?do/.test(q)) return () => needsToday(ctx);
  if (/\bopen\b|at stake|exposure|how many (open )?disputes|overview|status of/.test(q)) return () => openBook(ctx);
  if (/\bwin\b|winning/.test(q)) return () => winRate(ctx);
  return undefined;
}

export async function askOffline(question: string, history: AskTurn[], ctx: AskContext): Promise<AnswerInput> {
  const intent = await routeOffline(question, history, ctx);
  if (!intent) return { text: OFFLINE_FALLBACK, chart: null, followups: SUGGESTED_QUESTIONS.slice(0, 3) };
  return intent();
}
