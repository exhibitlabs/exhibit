import "server-only";
import { paypalMode, type PayPalMode } from "./config";
import { listActivity } from "./db";
import { allActions, disputesForInbox, latestBriefs } from "./disputes";
import { inboxRows, type InboxRow } from "./inbox";
import { REASON_LABEL } from "./paypal/types";
import { demoOrders, resolvedFromPayPal, resolvedHistory, resolvedTotals, type ResolvedCase } from "./store/history";
import { store } from "./store/repo";

/**
 * The Command center: what Exhibit recovered, what is at risk, and what needs a person today.
 * Demo mode folds in the demo merchant's labelled 90-day history; sandbox mode uses real PayPal data only.
 */

const DAY = 86400_000;
const WEEKS = 13;

/** Assumptions shown next to the figures they drive. */
export const ASSUMPTIONS = {
  /** Manual work per case: pull the order, tracking, messages and policies, write and file the response. */
  minutesPerCase: 45,
  /** PayPal US Standard Dispute Fee (PayPal-funded claims) and chargeback fee (card). docs/sources/paypal-us-dispute-fees-2026-10-21.md */
  disputeFee: 15,
  chargebackFee: 20,
  feeSource: "https://www.paypal.com/us/webapps/mpp/merchant-fees",
};

/** Card-network monitoring thresholds. PayPal doesn't publish a merchant dispute-rate threshold. docs/sources/dispute-thresholds.md */
export const THRESHOLDS = [
  {
    id: "visa-vamp",
    network: "Visa",
    label: "VAMP",
    value: 1.5,
    minimum: "min. 1,500 a month",
    detail: "(TC40 fraud + TC15 disputes) ÷ settled card-not-present transactions. US threshold lowered from 2.2% to 1.5% on 1 April 2026.",
    source: "Visa Acquirer Monitoring Program fact sheet (2025 v2)",
    url: "https://corporate.visa.com/content/dam/VCOM/corporate/visa-perspectives/security-and-trust/documents/visa-acquirer-monitoring-program-fact-sheet-2025.pdf",
  },
  {
    id: "mc-ecm",
    network: "Mastercard",
    label: "ECM",
    value: 1.5,
    minimum: "min. 100 a month",
    detail: "Chargebacks this month ÷ Mastercard transactions last month.",
    source: "chargebackhelp.com summary of Mastercard's Excessive Chargeback Program (Apr 2026)",
    url: "https://chargebackhelp.com/?p=31728",
  },
  {
    id: "mc-hecm",
    network: "Mastercard",
    label: "HECM",
    value: 3,
    minimum: "min. 300 a month",
    detail: "Same ratio, higher tier, larger fines.",
    source: "chargebackhelp.com summary of Mastercard's Excessive Chargeback Program (Apr 2026)",
    url: "https://chargebackhelp.com/?p=31728",
  },
] as const;

export type QueueRow = InboxRow & {
  windowHours: number | null;
  next: "investigate" | "approve" | "waiting";
  acted: string | null;
};

export type FeedItem = {
  id: string;
  at: string;
  kind: "agent" | "action" | "prevention" | "webhook" | "ruling" | "system" | "error" | "outcome-won" | "outcome-refund" | "outcome-lost";
  title: string;
  detail: string | null;
  disputeId: string | null;
  href: string | null;
  amount: number | null;
};

export type WeekPoint = { start: string; label: string; recovered: number; refunded: number; lost: number };

export type ReasonRow = { reason: string; label: string; won: number; lost: number; settled: number; refunded: number; fought: number; foughtWon: number; total: number; winRate: number | null };

export type Kpi = { value: number; series: number[]; hint: string; empty?: string };

export type Overview = {
  mode: PayPalMode;
  merchant: string;
  generatedAt: string;
  demoHistory: boolean;
  headline: { recovered: number; atRisk: number; openCount: number; needsYou: number; dueSoon: number; expected: number };
  kpis: { recovered: Kpi; atRisk: Kpi; winRate: Omit<Kpi, "value"> & { value: number | null }; feesAvoided: Kpi; hoursSaved: Kpi };
  weekly: WeekPoint[];
  reasons: ReasonRow[];
  queue: QueueRow[];
  rate: {
    /** Rolling 30-day dispute rate at the end of each week (demo merchant only: needs order volume). */
    series: { label: string; rate: number }[];
    current: { disputes: number; orders: number | null; rate: number | null };
    start: { rate: number | null };
    ordersKnown: boolean;
    thresholds: typeof THRESHOLDS;
  };
  feed: FeedItem[];
  assumptions: typeof ASSUMPTIONS;
};

// PayPal actions that answer a case (the sandbox lifecycle controls don't count).
const ANSWERS = new Set(["provide_evidence", "provide_supporting_info", "accept_claim", "make_offer", "send_message", "refund", "refund_then_prove"]);
const ANSWER_LABEL: Record<string, string> = {
  provide_evidence: "Evidence filed",
  provide_supporting_info: "Info filed",
  accept_claim: "Refunded",
  make_offer: "Offer sent",
  send_message: "Messaged",
  refund: "Refunded",
  refund_then_prove: "Refunded",
};

const DECISION_WORD: Record<string, string> = { FIGHT: "fight", OFFER: "offer", REFUND: "refund", MESSAGE_BUYER: "message the buyer" };

/** Audit-log lines are written for engineers; the feed reads them back in plain words. */
function prettify(message: string) {
  let m = /^Brief filed for \S+: (\w+) \((\d+)%\)/.exec(message);
  if (m) return `Brief ready: ${DECISION_WORD[m[1]] ?? m[1].toLowerCase()}, ${m[2]}% likely to win`;
  m = /^Exhibit started on \S+ \((\w+)/.exec(message);
  if (m) return m[1] === "webhook" ? "Investigation started on arrival" : "Investigation started";
  if (message.startsWith("CUSTOMER.DISPUTE.CREATED")) return "New dispute arrived by webhook";
  m = /^Filed (\w+) with a (\d+)-exhibit packet/.exec(message);
  if (m) return `Evidence filed with PayPal: ${m[2]}-exhibit packet`;
  return message.replace(/ for PP-[A-Z]-[\w-]+/, "");
}

const shortDay = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export async function buildOverview(): Promise<Overview> {
  const mode = paypalMode();
  const disputes = await disputesForInbox();
  const rows = inboxRows(disputes, latestBriefs());
  const nowMs = Date.now();
  const since = nowMs - 90 * DAY;

  const history = resolvedHistory();
  const resolvedNow = rows.filter((r) => r.statusCode === "RESOLVED").map((r) =>
    resolvedFromPayPal({ id: r.id, reasonCode: r.reasonCode, stage: r.stageCode, amount: r.amount, decision: r.decision, outcome: r.outcome, createdAt: r.createdAt, closedAt: r.closedAt, refundedAmount: r.refunded }),
  );
  const resolved: ResolvedCase[] = [...history, ...resolvedNow].filter((c) => new Date(c.closed_at).getTime() >= since);
  const totals = resolvedTotals(resolved);
  const open = rows.filter((r) => r.statusCode !== "RESOLVED");

  // ---- Queue: open cases, closest deadline first, with whether a person still has to act.
  const actions = allActions();
  const queue: QueueRow[] = open
    .map((r) => {
      const answered = actions.find((a) => a.dispute_id === r.id && a.status === "ok" && ANSWERS.has(a.kind));
      const windowHours = r.dueAt ? Math.max(1, (new Date(r.dueAt).getTime() - new Date(r.createdAt).getTime()) / 3600_000) : null;
      const next: QueueRow["next"] = answered ? "waiting" : r.decision ? "approve" : "investigate";
      return { ...r, windowHours, next, acted: answered ? (ANSWER_LABEL[answered.kind] ?? answered.kind) : null };
    })
    .sort((a, b) => (a.hoursLeft ?? 1e9) - (b.hoursLeft ?? 1e9));
  const needsYou = queue.filter((q) => q.next !== "waiting").length;

  // ---- Weekly buckets over the last 13 weeks (oldest first).
  const weekStart = (i: number) => nowMs - (WEEKS - i) * 7 * DAY;
  const weekly: WeekPoint[] = Array.from({ length: WEEKS }, (_, i) => ({ start: new Date(weekStart(i)).toISOString(), label: shortDay(weekStart(i)), recovered: 0, refunded: 0, lost: 0 }));
  const weekOf = (iso: string) => Math.floor((new Date(iso).getTime() - weekStart(0)) / (7 * DAY));
  for (const c of resolved) {
    const w = weekly[Math.min(WEEKS - 1, Math.max(0, weekOf(c.closed_at)))];
    w.recovered += c.recovered;
    w.refunded += c.refunded;
    w.lost += c.lost;
  }

  // Exposure at the end of each week: cases opened by then and not yet closed.
  const allCases = [...history.map((c) => ({ opened: c.opened_at, closed: c.closed_at, amount: c.amount })), ...rows.map((r) => ({ opened: r.createdAt, closed: r.closedAt, amount: r.amount }))];
  const exposure = Array.from({ length: WEEKS }, (_, i) => {
    const t = weekStart(i + 1);
    return allCases.filter((c) => new Date(c.opened).getTime() <= t && (!c.closed || new Date(c.closed).getTime() > t)).reduce((a, c) => a + c.amount, 0);
  });

  // Cumulative series for win rate, fees avoided and hours saved.
  const byWeek = Array.from({ length: WEEKS }, (_, i) => resolved.filter((c) => Math.min(WEEKS - 1, Math.max(0, weekOf(c.closed_at))) <= i));
  const winSeries = byWeek.map((cs) => resolvedTotals(cs).winRate ?? 0);
  const avoidedOf = (cs: ResolvedCase[]) => cs.filter((c) => c.stage === "INQUIRY").length * ASSUMPTIONS.disputeFee;
  const analyzedOpen = open.filter((r) => r.decision).length;
  const hoursOf = (n: number) => Math.round((n * ASSUMPTIONS.minutesPerCase) / 60);
  const inquiriesClosed = resolved.filter((c) => c.stage === "INQUIRY").length;
  const handled = resolved.length + analyzedOpen;

  // ---- Win rate by reason.
  const reasonMap = new Map<string, ReasonRow>();
  for (const c of resolved) {
    const r = reasonMap.get(c.reason) ?? { reason: c.reason, label: REASON_LABEL[c.reason] ?? c.reason, won: 0, lost: 0, settled: 0, refunded: 0, fought: 0, foughtWon: 0, total: 0, winRate: null };
    r.total++;
    // Buckets follow the money, so this card always agrees with the recovery chart.
    if (c.lost > 0) r.lost++;
    else if (c.recovered > 0 && c.refunded > 0) r.settled++;
    else if (c.recovered > 0) r.won++;
    else r.refunded++;
    if (c.decision === "FIGHT") {
      r.fought++;
      if (c.recovered > 0) r.foughtWon++;
    }
    reasonMap.set(c.reason, r);
  }
  const reasons = [...reasonMap.values()]
    .map((r) => ({ ...r, winRate: r.fought ? Math.round((r.foughtWon / r.fought) * 100) : null }))
    .sort((a, b) => b.total - a.total);

  // ---- Dispute rate: disputes opened in a rolling 30-day window ÷ orders in the same window.
  const openedBetween = (fromMs: number, toMs: number) =>
    allCases.filter((c) => {
      const t = new Date(c.opened).getTime();
      return t > fromMs && t <= toMs;
    }).length;
  const rateAt = (endMs: number) => {
    const daysAgo = (nowMs - endMs) / DAY;
    const orders = mode === "demo" ? demoOrders(daysAgo + 30, daysAgo) : null;
    const disputesIn = openedBetween(endMs - 30 * DAY, endMs);
    return { disputes: disputesIn, orders, rate: orders ? Math.round((disputesIn / orders) * 10000) / 100 : null };
  };
  const rateSeries = mode === "demo" ? Array.from({ length: WEEKS + 1 }, (_, i) => ({ label: shortDay(weekStart(i)), rate: rateAt(weekStart(i)).rate ?? 0 })) : [];
  const rateNow = rateAt(nowMs);

  // ---- Activity feed: the audit log plus the history's PayPal rulings.
  const ids = new Set(rows.map((r) => r.id));
  const log = listActivity({ limit: 80 }).filter((a) => !["api", "settings"].includes(a.kind));
  const briefed = new Set(log.filter((a) => a.message.startsWith("Brief filed")).map((a) => a.dispute_id));
  const feed: FeedItem[] = [];
  for (const a of log) {
    if (a.message.startsWith("Exhibit started") && briefed.has(a.dispute_id)) continue;
    const kind: FeedItem["kind"] = a.kind.endsWith("_error") ? "error" : a.kind === "agent" ? "agent" : a.kind === "action" ? "action" : a.kind === "webhook" ? "webhook" : a.kind === "sandbox" ? "ruling" : "system";
    const prev = /^Prevention · (\S+): (.*?)(?:\s*Risk (\d+) → (\d+)\.)?$/.exec(a.message);
    if (prev) {
      feed.push({ id: `a${a.id}`, at: a.at, kind: "prevention", title: prev[2].replace(/\.$/, ""), detail: `${prev[1]}${prev[3] ? ` · risk ${prev[3]} → ${prev[4]}` : ""}`, disputeId: null, href: "/app/protection", amount: null });
      continue;
    }
    const row = a.dispute_id ? rows.find((r) => r.id === a.dispute_id) : undefined;
    feed.push({ id: `a${a.id}`, at: a.at, kind, title: prettify(a.message), detail: a.dispute_id ? `${a.dispute_id}${row ? ` · ${row.buyer}` : ""}` : null, disputeId: a.dispute_id, href: a.dispute_id && ids.has(a.dispute_id) ? `/app/disputes/${a.dispute_id}` : null, amount: null });
  }
  for (const c of history.slice(-12)) {
    const label = REASON_LABEL[c.reason] ?? c.reason;
    const kind: FeedItem["kind"] = c.lost > 0 ? "outcome-lost" : c.recovered > 0 && c.refunded === 0 ? "outcome-won" : c.recovered > 0 ? "outcome-won" : "outcome-refund";
    const title =
      c.outcome === "CANCELED_BY_BUYER"
        ? "Buyer closed the case after Exhibit sent tracking"
        : c.outcome === "RESOLVED_WITH_PAYOUT"
          ? "Buyer accepted Exhibit's partial refund"
          : c.lost > 0
            ? "PayPal ruled for the buyer"
            : c.refunded > 0
              ? "Refunded honestly: merchant at fault"
              : "PayPal ruled in your favour";
    feed.push({ id: `h${c.dispute_id}`, at: c.closed_at, kind, title, detail: `${c.dispute_id} · ${label}`, disputeId: c.dispute_id, href: null, amount: c.recovered > 0 ? c.recovered : -(c.refunded + c.lost) });
  }
  feed.sort((a, b) => b.at.localeCompare(a.at));

  // Prevention fixes come in bursts; a run of them reads as one line.
  const compact: FeedItem[] = [];
  for (const f of feed) {
    const last = compact[compact.length - 1];
    if (f.kind === "prevention" && last?.kind === "prevention" && new Date(last.at).getTime() - new Date(f.at).getTime() < 30 * 60_000) {
      const n = Number(/^(\d+) /.exec(last.title)?.[1] ?? 1) + 1;
      const orders = new Set([...(last.detail ?? "").split(/, | · /).filter((x) => x.startsWith("KA-")), (f.detail ?? "").split(" · ")[0]]);
      compact[compact.length - 1] = { ...last, title: `${n} orders protected before they could become disputes`, detail: [...orders].slice(0, 3).join(", ") + (orders.size > 3 ? ` +${orders.size - 3}` : "") };
      continue;
    }
    compact.push(f);
  }

  const recoveredHint = totals.won || resolved.length ? `${totals.won} won · ${resolved.filter((c) => c.decision === "OFFER").length} settled · ${resolved.length} closed` : "";
  return {
    mode,
    merchant: store.merchant().name,
    generatedAt: new Date(nowMs).toISOString(),
    demoHistory: history.length > 0,
    headline: {
      recovered: totals.recovered,
      atRisk: open.reduce((a, r) => a + r.amount, 0),
      openCount: open.length,
      needsYou,
      dueSoon: open.filter((r) => r.hoursLeft !== null && r.hoursLeft <= 48).length,
      expected: open.reduce((a, r) => a + (r.expected ?? 0), 0),
    },
    kpis: {
      recovered: { value: totals.recovered, series: weekly.map((w) => w.recovered), hint: recoveredHint, empty: "No resolved cases yet" },
      atRisk: { value: open.reduce((a, r) => a + r.amount, 0), series: [...exposure.slice(0, -1), open.reduce((a, r) => a + r.amount, 0)], hint: `${open.length} open · ${Math.round(open.reduce((a, r) => a + (r.expected ?? 0), 0)).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} expected back` },
      winRate: { value: totals.winRate, series: winSeries, hint: totals.fought ? `${totals.won} of ${totals.fought} fought cases` : "", empty: "No fought cases decided yet" },
      feesAvoided: { value: inquiriesClosed * ASSUMPTIONS.disputeFee, series: byWeek.map(avoidedOf), hint: inquiriesClosed ? `${inquiriesClosed} inquiries × $${ASSUMPTIONS.disputeFee} claim fee` : "", empty: "No inquiries closed yet" },
      hoursSaved: { value: hoursOf(handled), series: byWeek.map((cs, i) => hoursOf(cs.length + (i === WEEKS - 1 ? analyzedOpen : 0))), hint: handled ? `${handled} cases × ${ASSUMPTIONS.minutesPerCase} min` : "", empty: "No cases handled yet" },
    },
    weekly,
    reasons,
    queue,
    rate: { series: rateSeries, current: rateNow, start: { rate: rateSeries[0]?.rate ?? null }, ordersKnown: mode === "demo", thresholds: THRESHOLDS },
    feed: compact.slice(0, 6),
    assumptions: ASSUMPTIONS,
  };
}
