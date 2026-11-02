import "server-only";
import { z } from "zod";
import { DECISIONS } from "../agent/brief";
import type { PreventionReport } from "../prevention";
import { STATUS_LABEL, type DisputeReason } from "../paypal/types";
import type { ResolvedCase } from "../store/history";
import { ASSUMPTIONS, DISPUTE_FEE, loadBook, loadCase, loadPrevention, matchReason, reasonLabel, type Book } from "./data";
import { AnswerInputSchema, type AnswerInput, type AskEvent } from "./schema";

const DAY = 86400_000;

export type AskContext = {
  emit: (e: AskEvent) => void;
  /** Per-question cache so parallel tool calls read one consistent snapshot. */
  book?: Promise<Book>;
  prevention?: PreventionReport;
  /** Every number any tool returned in this conversation: the chart may only use these. */
  numbers: Set<number>;
  answer?: AnswerInput;
  answerRejects: number;
};

export function newContext(emit: (e: AskEvent) => void): AskContext {
  return { emit, numbers: new Set(), answerRejects: 0 };
}

const book = (ctx: AskContext) => (ctx.book ??= loadBook());
export const bookFor = book;
const prevention = (ctx: AskContext) => (ctx.prevention ??= loadPrevention());

const r2 = (n: number) => Math.round(n * 100) / 100;
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const isoDay = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : null);

// ---- Outcome buckets for resolved cases ---------------------------------------------------------

export type OutcomeBucket = "Won" | "Buyer closed" | "Settled" | "Refunded" | "Lost";
export function outcomeOf(c: ResolvedCase): OutcomeBucket {
  if (c.lost > 0) return "Lost";
  if (c.decision === "OFFER" || (c.recovered > 0 && c.refunded > 0)) return "Settled";
  if (c.recovered > 0) return c.decision === "FIGHT" ? "Won" : "Buyer closed";
  return "Refunded";
}
const OUTCOME_ORDER: OutcomeBucket[] = ["Won", "Buyer closed", "Settled", "Refunded", "Lost"];

function aggregate(cases: ResolvedCase[]) {
  const fought = cases.filter((c) => c.decision === "FIGHT");
  const won = fought.filter((c) => c.recovered > 0).length;
  const amount = cases.reduce((a, c) => a + c.amount, 0);
  const recovered = cases.reduce((a, c) => a + c.recovered, 0);
  return {
    count: cases.length,
    amount: r2(amount),
    recovered: r2(recovered),
    refunded: r2(cases.reduce((a, c) => a + c.refunded, 0)),
    lost: r2(cases.reduce((a, c) => a + c.lost, 0)),
    fought: fought.length,
    won_fights: won,
    win_rate_pct: pct(won, fought.length),
    recovery_rate_pct: pct(recovered, amount),
  };
}

// ---- Periods ------------------------------------------------------------------------------------

const PERIODS = ["this_quarter", "this_month", "last_30_days", "last_90_days", "all_time"] as const;
type Period = (typeof PERIODS)[number];

function periodRange(p: Period, nowMs = Date.now()) {
  const now = new Date(nowMs);
  switch (p) {
    case "this_quarter": {
      const q = Math.floor(now.getUTCMonth() / 3);
      return { from: Date.UTC(now.getUTCFullYear(), q * 3, 1), label: `Q${q + 1} ${now.getUTCFullYear()} to date` };
    }
    case "this_month":
      return { from: Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1), label: `${now.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} to date` };
    case "last_30_days":
      return { from: nowMs - 30 * DAY, label: "Last 30 days" };
    case "last_90_days":
      return { from: nowMs - 90 * DAY, label: "Last 90 days" };
    default:
      return { from: 0, label: "All time" };
  }
}

const weekLabel = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function weekly(cases: ResolvedCase[], weeks: number, nowMs = Date.now()) {
  const start = (i: number) => nowMs - (weeks - i) * 7 * DAY;
  const out = Array.from({ length: weeks }, (_, i) => ({ week_of: weekLabel(start(i)), recovered: 0, refunded: 0, lost: 0, closed: 0 }));
  for (const c of cases) {
    const i = Math.floor((new Date(c.closed_at).getTime() - start(0)) / (7 * DAY));
    if (i < 0 || i >= weeks) continue;
    out[i].recovered += c.recovered;
    out[i].refunded += c.refunded;
    out[i].lost += c.lost;
    out[i].closed++;
  }
  return out.map((w) => ({ ...w, recovered: r2(w.recovered), refunded: r2(w.refunded), lost: r2(w.lost) }));
}

// ---- Open-case rows -----------------------------------------------------------------------------

const NEXT_STEP = { investigate: "Run Exhibit (no brief yet)", approve: "Approve Exhibit's brief", waiting: "Answered, waiting on PayPal" } as const;

function openRow(q: Book["queue"][number]) {
  return {
    id: q.id,
    buyer: q.buyer,
    item: q.item,
    reason: q.reason,
    stage: q.stage,
    status: q.status,
    amount: q.amount,
    currency: q.currency,
    opened: isoDay(q.createdAt),
    due_at: q.dueAt,
    hours_left: q.hoursLeft,
    next_step: NEXT_STEP[q.next],
    needs_you: q.next !== "waiting",
    exhibit_call: q.decision,
    win_likelihood_pct: q.likelihood,
    expected_recovery: q.expected === null ? null : r2(q.expected),
    headline: q.headline,
  };
}

// ---- Tools --------------------------------------------------------------------------------------

type ToolResult = { summary: string; data: unknown };
type AskTool<S extends z.ZodObject> = { name: string; label: string; description: string; schema: S; run: (input: z.infer<S>, ctx: AskContext) => Promise<ToolResult> | ToolResult };

const tool = <S extends z.ZodObject>(t: AskTool<S>) => t as unknown as AskTool<z.ZodObject>;

const ListDisputes = z.object({
  status: z.enum(["open", "needs_you", "resolved", "all"]).optional().describe("open = not resolved (default); needs_you = open and a person still has to act; resolved = closed cases including history."),
  reason: z.string().optional().describe("PayPal reason code or plain words, e.g. 'item not received', 'unauthorized'."),
  decision: z.enum([...DECISIONS, "NONE"]).optional().describe("Exhibit's call on the case; NONE = not investigated yet."),
  due_within_hours: z.number().int().min(1).max(2000).optional().describe("Only open cases whose PayPal response deadline is within this many hours."),
  buyer: z.string().optional().describe("Part of the buyer's name."),
  sort: z.enum(["deadline", "amount", "newest"]).optional(),
  limit: z.number().int().min(1).max(40).optional(),
});

const DisputeStats = z.object({
  group_by: z.enum(["reason", "status", "outcome", "decision", "stage", "week"]),
  scope: z.enum(["resolved", "open"]).optional().describe("resolved (default) = closed cases with outcomes and money; open = the live book."),
  period: z.enum(PERIODS).optional().describe("For resolved cases, by close date. Default last_90_days."),
  reason: z.string().optional().describe("Restrict to one reason (code or plain words)."),
});

const GetCase = z.object({ query: z.string().min(2).describe("A dispute id (PP-D-…) or the buyer's name.") });

const RecoverySummary = z.object({ period: z.enum(PERIODS).optional().describe("Default this_quarter.") });

const AtRiskOrders = z.object({
  band: z.enum(["high", "elevated", "watch"]).optional(),
  signal: z
    .enum(["tracking_not_on_paypal", "tracking_stalled", "unsigned_high_value", "address_mismatch", "refund_overdue", "buyer_waiting", "weak_checkout"])
    .optional(),
  reason: z.string().optional().describe("Only orders whose risk leads to this dispute reason, e.g. 'item not received'."),
  limit: z.number().int().min(1).max(25).optional(),
});

export const ASK_TOOLS = [
  tool({
    name: "list_disputes",
    label: "Querying disputes",
    description: "Lists the merchant's PayPal disputes with deadline, amount, reason, stage, Exhibit's call (FIGHT/OFFER/REFUND/MESSAGE_BUYER, if investigated) and the next step a person owes. Use for 'what needs me', deadlines, finding cases.",
    schema: ListDisputes,
    async run(input, ctx) {
      const b = await book(ctx);
      const status = input.status ?? "open";
      const reason = matchReason(input.reason);
      if (status === "resolved") {
        let cases = b.resolved;
        if (reason) cases = cases.filter((c) => c.reason === reason);
        cases = [...cases].sort((x, y) => y.closed_at.localeCompare(x.closed_at));
        const limit = input.limit ?? 15;
        return {
          summary: `Queried ${cases.length} resolved disputes${reason ? ` · ${reasonLabel(reason).toLowerCase()}` : ""}`,
          data: {
            count: cases.length,
            totals: aggregate(cases),
            note: b.demoHistory ? "Includes the demo merchant's labelled 90-day history (closed cases without buyer details)." : undefined,
            disputes: cases.slice(0, limit).map((c) => ({ id: c.dispute_id, reason: reasonLabel(c.reason), stage: c.stage, amount: c.amount, exhibit_call: c.decision, outcome: outcomeOf(c), recovered: c.recovered, refunded: c.refunded, lost: c.lost, closed: isoDay(c.closed_at) })),
          },
        };
      }
      let rows = b.queue;
      if (status === "needs_you") rows = rows.filter((q) => q.next !== "waiting");
      if (status === "all") rows = [...rows];
      if (reason) rows = rows.filter((q) => q.reasonCode === reason);
      if (input.decision) rows = rows.filter((q) => (input.decision === "NONE" ? !q.decision : q.decision === input.decision));
      if (input.due_within_hours) rows = rows.filter((q) => q.hoursLeft !== null && q.hoursLeft <= input.due_within_hours!);
      if (input.buyer) rows = rows.filter((q) => q.buyer.toLowerCase().includes(input.buyer!.toLowerCase()));
      const sort = input.sort ?? "deadline";
      rows = [...rows].sort((x, y) => (sort === "amount" ? y.amount - x.amount : sort === "newest" ? y.createdAt.localeCompare(x.createdAt) : (x.hoursLeft ?? 1e9) - (y.hoursLeft ?? 1e9)));
      const limit = input.limit ?? 12;
      const list = rows.slice(0, limit).map(openRow);
      const filters = [status === "needs_you" ? "needing you" : null, reason ? reasonLabel(reason).toLowerCase() : null, input.due_within_hours ? `due ≤ ${input.due_within_hours}h` : null].filter(Boolean);
      return {
        summary: `Queried ${b.queue.length} open disputes${filters.length ? ` · ${rows.length} ${filters.join(", ")}` : ""} · sorted by ${sort}`,
        data: {
          count: rows.length,
          open_total: b.queue.length,
          total_amount: r2(rows.reduce((a, q) => a + q.amount, 0)),
          needs_you: rows.filter((q) => q.next !== "waiting").length,
          not_investigated: rows.filter((q) => q.next === "investigate").length,
          brief_ready: rows.filter((q) => q.next === "approve").length,
          due_within_72h: rows.filter((q) => q.hoursLeft !== null && q.hoursLeft <= 72).length,
          disputes: list,
        },
      };
    },
  }),

  tool({
    name: "dispute_stats",
    label: "Aggregating the dispute book",
    description: "Groups disputes and returns counts, amounts, money recovered/refunded/lost, fights won and win rate per group. Resolved scope covers closed cases (outcomes Won, Buyer closed, Settled, Refunded, Lost); open scope covers the live book.",
    schema: DisputeStats,
    async run(input, ctx) {
      const b = await book(ctx);
      const reason = matchReason(input.reason);
      const scope = input.scope ?? "resolved";
      if (scope === "open") {
        let rows = b.queue;
        if (reason) rows = rows.filter((q) => q.reasonCode === reason);
        const keyOf = (q: (typeof rows)[number]) =>
          input.group_by === "reason" ? q.reason : input.group_by === "status" ? q.status : input.group_by === "decision" ? (q.decision ?? "Not investigated") : input.group_by === "stage" ? q.stage : input.group_by === "week" ? weekLabel(new Date(q.createdAt).getTime()) : q.status;
        const groups = new Map<string, typeof rows>();
        for (const q of rows) groups.set(keyOf(q), [...(groups.get(keyOf(q)) ?? []), q]);
        const out = [...groups.entries()]
          .map(([group, qs]) => ({ group, count: qs.length, amount: r2(qs.reduce((a, q) => a + q.amount, 0)), needs_you: qs.filter((q) => q.next !== "waiting").length, expected_recovery: r2(qs.reduce((a, q) => a + (q.expected ?? 0), 0)) }))
          .sort((x, y) => y.amount - x.amount);
        return { summary: `Grouped ${rows.length} open disputes by ${input.group_by}`, data: { scope, groups: out, total: { count: rows.length, amount: r2(rows.reduce((a, q) => a + q.amount, 0)) } } };
      }
      const period = input.period ?? "last_90_days";
      const { from, label } = periodRange(period);
      let cases = b.resolved.filter((c) => new Date(c.closed_at).getTime() >= from);
      if (reason) cases = cases.filter((c) => c.reason === reason);
      let groups: { group: string; cases: ResolvedCase[] }[];
      if (input.group_by === "week") {
        const weeks = Math.min(13, Math.max(1, Math.ceil((Date.now() - (from || Date.now() - 91 * DAY)) / (7 * DAY))));
        const start = (i: number) => Date.now() - (weeks - i) * 7 * DAY;
        groups = Array.from({ length: weeks }, (_, i) => ({ group: weekLabel(start(i)), cases: cases.filter((c) => Math.floor((new Date(c.closed_at).getTime() - start(0)) / (7 * DAY)) === i) }));
      } else {
        const keyOf = (c: ResolvedCase) =>
          input.group_by === "reason" ? reasonLabel(c.reason) : input.group_by === "outcome" ? outcomeOf(c) : input.group_by === "decision" ? (c.decision ?? "None") : input.group_by === "stage" ? c.stage : STATUS_LABEL.RESOLVED;
        const m = new Map<string, ResolvedCase[]>();
        for (const c of cases) m.set(keyOf(c), [...(m.get(keyOf(c)) ?? []), c]);
        groups = [...m.entries()].map(([group, cs]) => ({ group, cases: cs }));
        if (input.group_by === "outcome") groups.sort((x, y) => OUTCOME_ORDER.indexOf(x.group as OutcomeBucket) - OUTCOME_ORDER.indexOf(y.group as OutcomeBucket));
        else groups.sort((x, y) => y.cases.length - x.cases.length);
      }
      return {
        summary: `Grouped ${cases.length} resolved disputes by ${input.group_by}${reason ? ` · ${reasonLabel(reason).toLowerCase()}` : ""} · ${label.replace(/^[A-Z][a-z]/, (m) => m.toLowerCase())}`,
        data: {
          scope,
          period: label,
          reason: reason ? reasonLabel(reason) : undefined,
          groups: groups.map((g) => ({ group: g.group, ...aggregate(g.cases) })),
          total: aggregate(cases),
          note: b.demoHistory ? "Resolved cases include the demo merchant's labelled 90-day history." : b.resolved.length ? undefined : "No resolved disputes yet.",
          outcome_meaning: input.group_by === "outcome" ? { Won: "fought and PayPal ruled for the merchant", "Buyer closed": "buyer closed the case after Exhibit messaged them", Settled: "partial refund accepted", Refunded: "Exhibit recommended refunding instead of fighting", Lost: "fought and PayPal ruled for the buyer" } : undefined,
        },
      };
    },
  }),

  tool({
    name: "get_case",
    label: "Opening the case file",
    description: "Opens one dispute by id or buyer name: the PayPal claim, order and items, shipment and delivery, checkout risk signals, buyer history, messages with the store, Exhibit's latest brief, and the dispute fee schedule.",
    schema: GetCase,
    async run(input, ctx) {
      const b = await book(ctx);
      const q = input.query.trim().toLowerCase();
      const row = b.rows.find((r) => r.id.toLowerCase() === q) ?? b.rows.find((r) => r.buyer.toLowerCase() === q) ?? b.rows.find((r) => r.id.toLowerCase().includes(q) || r.buyer.toLowerCase().includes(q)) ?? b.rows.find((r) => q.split(/\s+/).some((w) => w.length > 2 && r.buyer.toLowerCase().split(/\s+/).includes(w)));
      if (!row) return { summary: `No case matches “${input.query}”`, data: { found: false, open_cases: b.queue.map((x) => ({ id: x.id, buyer: x.buyer })) } };
      const c = loadCase(row.id);
      const f = c?.file;
      const o = f?.order;
      const sh = f?.shipments.find((s) => s.direction === "OUTBOUND") ?? f?.shipments[0];
      const ret = f?.shipments.find((s) => s.direction === "RETURN");
      const risk = f?.risk;
      const brief = c?.brief;
      const queue = b.queue.find((x) => x.id === row.id);
      const funding = o?.paypal.funding ?? null;
      return {
        summary: `Opened ${row.id} · ${row.buyer} · ${[o && "order", sh && "tracking", risk && "checkout signals", brief && "brief"].filter(Boolean).join(", ")}`,
        data: {
          found: true,
          id: row.id,
          buyer: row.buyer,
          reason: row.reason,
          stage: row.stage,
          status: row.status,
          amount: row.amount,
          currency: row.currency,
          opened: isoDay(row.createdAt),
          response_due: row.dueAt,
          hours_left: row.hoursLeft,
          next_step: queue ? NEXT_STEP[queue.next] : null,
          case_title: row.title,
          buyer_claim: f?.dispute.messages?.filter((m) => m.posted_by === "BUYER").map((m) => m.content.slice(0, 400)) ?? [],
          order: o
            ? { id: o.id, placed: isoDay(o.placed_at), items: o.items.map((i) => `${i.qty} × ${i.name}`), total: o.total, paid_with: funding === "CARD" ? "by card through PayPal checkout" : "with a PayPal account", ship_to: `${o.shipping_address.city}, ${o.shipping_address.country}`, shipping_method: o.shipping_method, refunds: o.refunds ?? [] }
            : null,
          shipment: sh
            ? { carrier: sh.carrier, service: sh.service, tracking: sh.tracking_number, status: sh.status, shipped: isoDay(sh.shipped_at), delivered: isoDay(sh.delivered_at), signed_by: sh.signature?.name ?? null, last_scan: sh.events.at(-1)?.description ?? null, tracking_on_paypal: sh.pushed_to_paypal }
            : null,
          return_shipment: ret ? { carrier: ret.carrier, status: ret.status, delivered: isoDay(ret.delivered_at) } : null,
          checkout_signals: risk
            ? { avs: risk.avs_result ?? null, cvv: risk.cvv_result ?? null, three_d_secure: risk.three_ds ?? null, device_seen_before: risk.device.seen_before, ip_city: risk.ip.city, ip_to_shipping_km: risk.ip_to_shipping_km, email_age_days: risk.email_age_days }
            : null,
          customer: f?.customer ? { first_order: isoDay(f.customer.first_order_at), orders: f.customer.order_ids.length, lifetime_value: f.customer.lifetime_value, prior_disputes: f.customer.prior_disputes } : null,
          store_messages: (f?.conversation?.messages ?? []).slice(-4).map((m) => ({ at: isoDay(m.at), from: m.from, text: m.body.slice(0, 240) })),
          exhibit_brief: brief
            ? { decision: brief.decision, headline: brief.headline, summary: brief.summary, win_likelihood_pct: brief.win_likelihood, confidence: brief.confidence, paypal_action: brief.paypal_action.type, exhibits: brief.exhibits.map((e) => `${e.label}: ${e.title}`), risks: brief.risks }
            : null,
          dispute_fee: funding ? { amount: funding === "CARD" ? DISPUTE_FEE.CARD : DISPUTE_FEE.PAYPAL, basis: funding === "CARD" ? "chargeback fee for card transactions" : "standard dispute fee", source: DISPUTE_FEE.source } : null,
        },
      };
    },
  }),

  tool({
    name: "recovery_summary",
    label: "Totalling recoveries",
    description: "What Exhibit recovered for the merchant over a period: money kept on closed cases, refunded, lost after fighting, fights won and win rate, dispute fees avoided by closing inquiries early, plus the open exposure and a 13-week trend.",
    schema: RecoverySummary,
    async run(input, ctx) {
      const b = await book(ctx);
      const period = input.period ?? "this_quarter";
      const { from, label } = periodRange(period);
      const cases = b.resolved.filter((c) => new Date(c.closed_at).getTime() >= from);
      const t = aggregate(cases);
      const inquiries = cases.filter((c) => c.stage === "INQUIRY").length;
      const open = b.queue;
      return {
        summary: `Totalled ${cases.length} closed cases · ${label.replace(/^[A-Z][a-z]/, (m) => m.toLowerCase())}`,
        data: {
          period: label,
          from: new Date(from).toISOString().slice(0, 10),
          to: new Date().toISOString().slice(0, 10),
          closed_cases: t.count,
          disputed_amount: t.amount,
          recovered: t.recovered,
          refunded: t.refunded,
          lost: t.lost,
          fought: t.fought,
          won_fights: t.won_fights,
          win_rate_pct: t.win_rate_pct,
          settled: cases.filter((c) => outcomeOf(c) === "Settled").length,
          buyer_closed: cases.filter((c) => outcomeOf(c) === "Buyer closed").length,
          inquiries_closed: inquiries,
          fees_avoided: inquiries * ASSUMPTIONS.disputeFee,
          fees_avoided_basis: `${inquiries} inquiries closed before escalation × $${ASSUMPTIONS.disputeFee} PayPal dispute fee`,
          hours_saved: Math.round((cases.length * ASSUMPTIONS.minutesPerCase) / 60),
          hours_saved_basis: `${cases.length} cases × ${ASSUMPTIONS.minutesPerCase} min of manual work`,
          open_cases: open.length,
          open_exposure: r2(open.reduce((a, q) => a + q.amount, 0)),
          expected_from_open: r2(open.reduce((a, q) => a + (q.expected ?? 0), 0)),
          open_investigated: open.filter((q) => q.decision).length,
          trend_13_weeks: weekly(b.resolved, 13),
          by_reason: Object.entries(Object.groupBy(cases, (c) => reasonLabel(c.reason))).map(([reason, cs]) => ({ reason, ...aggregate(cs ?? []) })).sort((x, y) => y.recovered - x.recovered),
          note: b.demoHistory ? "Includes the demo merchant's labelled 90-day history." : cases.length ? undefined : "No resolved disputes in this period yet.",
        },
      };
    },
  }),

  tool({
    name: "at_risk_orders",
    label: "Scanning orders for dispute risk",
    description: "Prevention radar: recent orders likely to turn into disputes (tracking not on PayPal, stalled tracking, unsigned high-value delivery, address mismatch, overdue refunds, waiting buyers, weak checkout), with risk score, exposure and the recommended fix.",
    schema: AtRiskOrders,
    run(input, ctx) {
      const p = prevention(ctx);
      const reason = matchReason(input.reason);
      let orders = p.atRisk;
      if (input.band) orders = orders.filter((o) => o.band === input.band);
      if (input.signal) orders = orders.filter((o) => o.signals.some((s) => s.kind === input.signal));
      if (reason) orders = orders.filter((o) => o.signals.some((s) => s.reason === reason));
      const limit = input.limit ?? 8;
      return {
        summary: `Scanned ${p.totals.watched} orders · ${orders.length} at risk${input.band ? ` (${input.band})` : ""}${reason ? ` · ${reasonLabel(reason).toLowerCase()}` : ""}`,
        data: {
          watched: p.totals.watched,
          at_risk: p.totals.atRisk,
          matching: orders.length,
          exposure: r2(p.totals.exposure),
          matching_exposure: r2(orders.reduce((a, o) => a + o.exposure, 0)),
          expected_disputes_if_nothing_changes: p.totals.expectedDisputes,
          high: p.totals.high,
          elevated: p.totals.elevated,
          watch: p.totals.watch,
          prevented_so_far: p.totals.prevented,
          by_signal: p.bySignal.filter((s) => !reason || s.reasonLabel === reasonLabel(reason)).map((s) => ({ signal: s.label, kind: s.kind, leads_to: s.reasonLabel, orders: s.count, exposure: r2(s.exposure) })),
          orders: orders.slice(0, limit).map((o) => ({
            id: o.orderId,
            buyer: o.buyer,
            item: o.item,
            amount: o.amount,
            placed: isoDay(o.placedAt),
            score: o.score,
            band: o.band,
            top_signal: o.top?.label ?? null,
            detail: o.top?.detail ?? null,
            leads_to: o.top?.reasonLabel ?? null,
            signals: o.signals.map((s) => s.label),
            recommended_fix: o.fixes.find((f) => f.primary)?.label ?? o.fixes[0]?.label ?? null,
            exposure: r2(o.exposure),
          })),
        },
      };
    },
  }),

  tool({
    name: "present_answer",
    label: "Writing the answer",
    description: "Files the final answer shown to the merchant. Call exactly once, after the data tools. Chart values, case ids and order ids must come from tool results in this conversation.",
    schema: AnswerInputSchema,
    run() {
      return { summary: "", data: {} };
    },
  }),
];

export const DATA_TOOLS = ASK_TOOLS.filter((t) => t.name !== "present_answer");

function collectNumbers(v: unknown, into: Set<number>) {
  if (typeof v === "number" && Number.isFinite(v)) {
    into.add(r2(v));
    into.add(Math.round(v));
  } else if (Array.isArray(v)) v.forEach((x) => collectNumbers(x, into));
  else if (v && typeof v === "object") Object.values(v).forEach((x) => collectNumbers(x, into));
}

/** Checks the final answer is grounded: ids resolve to real records and chart values appear in tool results. */
async function checkAnswer(a: AnswerInput, ctx: AskContext): Promise<string[]> {
  const problems: string[] = [];
  const b = await book(ctx);
  const ids = new Set(b.rows.map((r) => r.id));
  for (const c of a.cases ?? []) if (!ids.has(c.id)) problems.push(`case id ${c.id} is not a dispute in the book (valid: ${[...ids].slice(0, 12).join(", ")})`);
  if (a.orders?.length) {
    const orders = new Set(prevention(ctx).orders.map((o) => o.orderId));
    for (const o of a.orders) if (!orders.has(o.id)) problems.push(`order id ${o.id} is not a watched order; use ids from at_risk_orders`);
  }
  if (a.chart) {
    for (const s of a.chart.series) {
      if (s.values.length !== a.chart.labels.length) problems.push(`chart series "${s.name}" has ${s.values.length} values for ${a.chart.labels.length} labels`);
      for (const v of s.values) if (v !== 0 && !ctx.numbers.has(r2(v)) && !ctx.numbers.has(Math.round(v))) problems.push(`chart value ${v} in "${s.name}" does not appear in any tool result; copy values exactly from tool output`);
    }
  }
  return problems;
}

export type ToolExec = { text: string; isError: boolean };

/** Validates and runs one tool, streaming a trace step around it. Results are data, never instructions. */
export async function executeAskTool(name: string, rawInput: unknown, ctx: AskContext, id = `s${Math.random().toString(36).slice(2, 9)}`, minMs = 0): Promise<ToolExec> {
  const t = ASK_TOOLS.find((x) => x.name === name);
  if (!t) return { text: `Unknown tool ${name}`, isError: true };
  const parsed = t.schema.safeParse(rawInput ?? {});
  if (name === "present_answer") {
    if (!parsed.success) return { text: `Invalid answer: ${z.prettifyError(parsed.error)}`, isError: true };
    const a = parsed.data as AnswerInput;
    const problems = await checkAnswer(a, ctx);
    if (problems.length && ctx.answerRejects++ < 2) return { text: `Answer rejected, fix and call present_answer again:\n- ${problems.join("\n- ")}`, isError: true };
    if (problems.length) {
      // Out of retries: keep the grounded parts only.
      const b = await book(ctx);
      const ids = new Set(b.rows.map((r) => r.id));
      const orders = new Set(prevention(ctx).orders.map((o) => o.orderId));
      ctx.answer = { ...a, chart: problems.some((p) => p.startsWith("chart")) ? null : a.chart, cases: a.cases?.filter((c) => ids.has(c.id)), orders: a.orders?.filter((o) => orders.has(o.id)) };
    } else ctx.answer = a;
    return { text: "Answer accepted.", isError: false };
  }
  const started = Date.now();
  ctx.emit({ t: "step", step: { id, name, label: t.label } });
  if (!parsed.success) {
    ctx.emit({ t: "step_done", id, summary: `${t.label}: invalid input`, ms: Date.now() - started, ok: false });
    return { text: `Invalid input: ${z.prettifyError(parsed.error)}`, isError: true };
  }
  try {
    const r = await t.run(parsed.data, ctx);
    collectNumbers(r.data, ctx.numbers);
    const wait = minMs - (Date.now() - started);
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    ctx.emit({ t: "step_done", id, summary: r.summary, ms: Date.now() - started, ok: true });
    return { text: JSON.stringify(r.data), isError: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    ctx.emit({ t: "step_done", id, summary: `${t.label} failed`, ms: Date.now() - started, ok: false });
    return { text: `Tool failed: ${message}`, isError: true };
  }
}

/** Runs a data tool and returns its parsed result (offline router). */
export async function callTool<T = Record<string, unknown>>(name: string, input: unknown, ctx: AskContext, minMs = 0): Promise<T> {
  const r = await executeAskTool(name, input, ctx, undefined, minMs);
  if (r.isError) throw new Error(r.text);
  return JSON.parse(r.text) as T;
}

export { money as fmtMoney, type DisputeReason };
