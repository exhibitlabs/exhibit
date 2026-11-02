import "server-only";
import { kvGet, kvSet } from "../db";
import { paypalMode } from "../config";
import type { DisputeReason, DisputeStage } from "../paypal/types";
import { PRODUCTS } from "./scenarios";

/**
 * Demo merchant only: a deterministic 90-day history of resolved disputes, so the Command center has
 * a track record to chart. Generated from a seeded RNG relative to the seed date and stored under its
 * own kv key. Outcomes follow the playbook: fight when the merchant's records win it, refund or offer
 * when the merchant was at fault. Sandbox mode never reads or writes this; it shows real cases only.
 */

export type Decision = "FIGHT" | "OFFER" | "REFUND" | "MESSAGE_BUYER";

export type ResolvedCase = {
  dispute_id: string;
  reason: DisputeReason;
  stage: DisputeStage;
  amount: number;
  decision: Decision | null;
  outcome: string;
  opened_at: string;
  closed_at: string;
  /** What the merchant kept, gave back by choice, and lost after fighting. Sums to amount. */
  recovered: number;
  refunded: number;
  lost: number;
  source: "demo-history" | "paypal";
};

const KV_KEY = "resolved_history_v7";

/** Demo merchant's daily order volume, growing slowly: about 2,250 orders a month three months ago, 2,500 now. */
const demoDailyOrders = (daysAgo: number) => 84.5 - daysAgo * 0.1;

/** Demo merchant's order count between two points in time (days ago, from > to): the denominator for the dispute rate. */
export function demoOrders(fromDaysAgo: number, toDaysAgo: number) {
  let n = 0;
  for (let d = fromDaysAgo; d > toDaysAgo; d--) n += demoDailyOrders(d);
  return Math.round(n);
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Plan = { decision: Decision; win: number; offerShare?: number; inquiryOnly?: boolean };

/** Reason mix and, per reason, the playbook branches with their weights. */
const MIX: { reason: DisputeReason; weight: number; branches: [number, Plan][] }[] = [
  {
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    weight: 38,
    branches: [
      [0.62, { decision: "FIGHT", win: 0.93 }], // delivered, signed, address matches
      [0.16, { decision: "MESSAGE_BUYER", win: 0.85, inquiryOnly: true }], // still in transit: tracking to the buyer
      [0.22, { decision: "REFUND", win: 0 }], // lost or returned to sender: merchant's problem
    ],
  },
  {
    reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
    weight: 21,
    branches: [
      [0.42, { decision: "FIGHT", win: 0.7 }], // listing photos and specs match what shipped
      [0.58, { decision: "OFFER", win: 1, offerShare: 0.3 }], // partial refund, keep the item
    ],
  },
  {
    reason: "UNAUTHORISED",
    weight: 20,
    branches: [
      [0.72, { decision: "FIGHT", win: 0.81 }], // AVS + 3-D Secure + known device
      [0.28, { decision: "REFUND", win: 0 }], // weak signals, likely real fraud
    ],
  },
  {
    reason: "CREDIT_NOT_PROCESSED",
    weight: 13,
    branches: [
      [0.78, { decision: "REFUND", win: 0 }], // return arrived, refund was never issued
      [0.22, { decision: "FIGHT", win: 0.95 }], // refund already issued: proof of refund
    ],
  },
  {
    reason: "DUPLICATE_TRANSACTION",
    weight: 5,
    branches: [
      [0.6, { decision: "REFUND", win: 0 }],
      [0.4, { decision: "FIGHT", win: 0.9 }],
    ],
  },
  { reason: "INCORRECT_AMOUNT", weight: 3, branches: [[1, { decision: "OFFER", win: 1, offerShare: 0.2 }]] },
];

function pick<T>(r: () => number, items: [number, T][]): T {
  const total = items.reduce((a, [w]) => a + w, 0);
  let x = r() * total;
  for (const [w, v] of items) {
    if ((x -= w) <= 0) return v;
  }
  return items[items.length - 1][1];
}

export function buildResolvedHistory(base = new Date()): ResolvedCase[] {
  const r = rng(0x4b6f7261); // "Kora"
  const day = 86400_000;
  const end = base.getTime();
  const out: ResolvedCase[] = [];
  let seq = 48210;
  const tallies = new Map<Plan, { n: number; w: number }>();
  // Arrivals: about 0.95 disputes a day four months ago, easing to about 0.35 as Prevention kicks in.
  // Cases closed before the 90-day window are kept so rolling dispute rates have their full denominator.
  for (let d = -130; d <= -6; d++) {
    const lambda = 0.95 - ((d + 130) / 124) * 0.6;
    let arrivals = 0;
    let p = Math.exp(-lambda);
    let u = r();
    while (u > p) {
      arrivals++;
      u -= p;
      p *= lambda / arrivals;
    }
    for (let i = 0; i < arrivals; i++) {
      const m = pick(r, MIX.map((x) => [x.weight, x] as [number, (typeof MIX)[number]]));
      const plan = pick(r, m.branches);
      const tally = tallies.get(plan) ?? { n: 0, w: 0 };
      tallies.set(plan, tally);
      const product = PRODUCTS[Math.floor(r() * PRODUCTS.length)];
      const qty = product.price < 100 && r() < 0.45 ? 2 : 1;
      const intl = r() < 0.18;
      const amount = Math.min(600, Math.max(40, product.price * qty + (intl ? 24 : 0)));
      const stage: DisputeStage = plan.inquiryOnly || plan.decision === "OFFER" || r() < 0.5 ? "INQUIRY" : "CHARGEBACK";
      const opened = end + d * day + Math.floor(r() * day);
      const duration = stage === "INQUIRY" ? 3 + r() * 9 : 16 + r() * 26;
      let closed = opened + duration * day;
      seq += 3 + Math.floor(r() * 9);
      // Recent cases that would still be open close early instead, so the last weeks keep a realistic count.
      if (closed > end - day / 2) closed = opened + (end - day / 2 - opened) * (0.55 + 0.4 * r());
      if (closed - opened < 2 * day) continue;
      // Error diffusion instead of a coin flip: each playbook branch lands on its win rate even in a small sample.
      tally.n++;
      const won = tally.w + 1 <= Math.round(plan.win * tally.n);
      if (won) tally.w++;
      let recovered = 0;
      let refunded = 0;
      let lost = 0;
      let outcome: string;
      if (plan.decision === "REFUND") {
        refunded = amount;
        outcome = "RESOLVED_BUYER_FAVOUR";
      } else if (plan.decision === "OFFER") {
        refunded = Math.round(amount * (plan.offerShare ?? 0.3));
        recovered = amount - refunded;
        outcome = "RESOLVED_WITH_PAYOUT";
      } else if (plan.decision === "MESSAGE_BUYER") {
        if (won) {
          recovered = amount;
          outcome = "CANCELED_BY_BUYER";
        } else {
          refunded = amount;
          outcome = "RESOLVED_BUYER_FAVOUR";
        }
      } else if (won) {
        recovered = amount;
        outcome = "RESOLVED_SELLER_FAVOUR";
      } else {
        lost = amount;
        outcome = "RESOLVED_BUYER_FAVOUR";
      }
      out.push({
        dispute_id: `PP-D-${seq}`,
        reason: m.reason,
        stage,
        amount,
        decision: plan.decision,
        outcome,
        opened_at: new Date(opened).toISOString(),
        closed_at: new Date(closed).toISOString(),
        recovered,
        refunded,
        lost,
        source: "demo-history",
      });
    }
  }
  return out.sort((a, b) => a.closed_at.localeCompare(b.closed_at));
}

export function seedResolvedHistory(base = new Date()) {
  kvSet(KV_KEY, buildResolvedHistory(base));
}

/** The demo merchant's resolved history; empty in sandbox mode. Generated on first read if the seed predates it. */
export function resolvedHistory(): ResolvedCase[] {
  if (paypalMode() !== "demo") return [];
  const cached = kvGet<ResolvedCase[] | null>(KV_KEY, null);
  if (cached) return cached;
  const seededAt = kvGet<string | null>("seeded_at", null);
  if (!seededAt) return [];
  const list = buildResolvedHistory(new Date(seededAt));
  kvSet(KV_KEY, list);
  return list;
}

/** Turns a resolved PayPal dispute into the same shape, splitting the money by Exhibit's call. */
export function resolvedFromPayPal(x: {
  id: string;
  reasonCode: DisputeReason;
  stage: DisputeStage;
  amount: number;
  decision: Decision | null;
  outcome: string | null;
  createdAt: string;
  closedAt: string | null;
  refundedAmount?: number | null;
}): ResolvedCase {
  const outcome = x.outcome ?? "RESOLVED";
  let recovered = 0;
  let refunded = 0;
  let lost = 0;
  if (outcome === "RESOLVED_SELLER_FAVOUR" || outcome === "CANCELED_BY_BUYER" || outcome === "DENIED") recovered = x.amount;
  else if (outcome === "RESOLVED_WITH_PAYOUT") {
    // The buyer was paid. A full payout on a case Exhibit fought is a loss; otherwise it's what was given back.
    const paid = Math.min(x.amount, x.refundedAmount ?? x.amount);
    if (x.decision === "FIGHT" && paid >= x.amount) lost = x.amount;
    else {
      refunded = paid;
      recovered = x.amount - paid;
    }
  } else if (outcome === "RESOLVED_BUYER_FAVOUR" || outcome === "ACCEPTED") {
    if (x.decision === "FIGHT") lost = x.amount;
    else refunded = x.amount;
  }
  return {
    dispute_id: x.id,
    reason: x.reasonCode,
    stage: x.stage,
    amount: x.amount,
    decision: x.decision,
    outcome,
    opened_at: x.createdAt,
    closed_at: x.closedAt ?? x.createdAt,
    recovered,
    refunded,
    lost,
    source: "paypal",
  };
}

export function resolvedTotals(cases: ResolvedCase[]) {
  const fought = cases.filter((c) => c.decision === "FIGHT");
  const won = fought.filter((c) => c.recovered > 0).length;
  return {
    recovered: cases.reduce((a, c) => a + c.recovered, 0),
    refunded: cases.reduce((a, c) => a + c.refunded, 0),
    lost: cases.reduce((a, c) => a + c.lost, 0),
    fought: fought.length,
    won,
    winRate: fought.length ? Math.round((won / fought.length) * 100) : null,
  };
}
