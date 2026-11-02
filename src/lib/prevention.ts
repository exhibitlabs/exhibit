// Prevention radar: deterministic risk scoring over recent orders that have not been disputed yet.
// Each signal maps to the PayPal dispute reason it tends to cause and to a concrete fix that Exhibit
// can run: through the PayPal API where one exists (Orders v2 tracking, Payments v2 refunds), and
// through the merchant's support inbox for buyer messages (PayPal has no messaging API before a
// dispute exists). Consumed by the Prevention page, /api/prevention, Ask Exhibit and the MCP server.
//
// Stable API:
//   preventionReport(): PreventionReport
//   preventionOrder(orderId): PreventionOrder | undefined
//   draftPreventionMessage(orderId, action?): MessageDraft | undefined
//   runPreventionFix(orderId, action, opts?): Promise<PreventionFixResult>

import "server-only";
import { randomUUID } from "node:crypto";
import { syncTrackingToPayPal } from "./actions";
import { paypalMode } from "./config";
import { docGet, docList, docPut, kvGet, kvSet, logActivity, now } from "./db";
import { markDemoProgress } from "./demo-progress";
import { cachedDisputes } from "./disputes";
import { paypal, PayPalError } from "./paypal/client";
import type { DisputeReason } from "./paypal/types";
import { languageFor, NEGATIVE_RE, renderMessage, THREAT_RE, WISMO_RE, type MessageContext, type MessageDraft, type MessageSituation } from "./prevention-messages";
import type { ScenarioMeta } from "./store/repo";
import { store } from "./store/repo";
import type { Address, Conversation, Order, Shipment, SupportMessage } from "./store/types";

export type { MessageDraft } from "./prevention-messages";

// ---- Constants ----------------------------------------------------------------------------------

/** PayPal US merchant fees page, retrieved 2026-10-21 (docs/sources/paypal-us-dispute-fees-2026-10-21.md). */
export const DISPUTE_FEE = {
  PAYPAL: 15,
  CARD: 20,
  source: "https://www.paypal.com/us/webapps/mpp/merchant-fees",
  retrieved: "2026-10-21",
  note: "Standard Dispute Fee $15.00 for PayPal checkout transactions; $20.00 chargeback fee for card transactions. The $30 High Volume fee is not modelled.",
} as const;

const WINDOW_DAYS = 45;
const STALL_DAYS = 4;
const REFUND_SLA_DAYS = 3; // Returns policy: "within 3 business days of the return arriving".
const REPLY_SLA_HOURS = 24;
const DEFAULT_SIGNATURE_THRESHOLD = 250; // Shipping policy: "Orders over $250 ship with signature confirmation."
const HIGH_VALUE_FIRST_ORDER = 200;
const DAY = 86400_000;

export const REASON_LABEL: Partial<Record<DisputeReason, string>> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Not as described",
  UNAUTHORISED: "Unauthorized",
  CREDIT_NOT_PROCESSED: "Credit not processed",
};

// ---- Types --------------------------------------------------------------------------------------

export type PreventionSignalKind = "tracking_not_on_paypal" | "tracking_stalled" | "unsigned_high_value" | "address_mismatch" | "refund_overdue" | "buyer_waiting" | "weak_checkout";

export type PreventionAction = "push_tracking" | "refund" | "message_buyer" | "hold_and_verify" | "require_signature" | "dismiss";

export type PreventionFixOption = {
  action: PreventionAction;
  label: string;
  /** What Exhibit will do, in one sentence. */
  detail: string;
  /** "paypal" when the fix is a PayPal API call; "inbox" for buyer messages; "rule" for store settings. */
  channel: "paypal" | "inbox" | "rule" | "none";
  /** The PayPal endpoint the fix calls, if any. */
  api?: string;
  primary?: boolean;
};

export type PreventionSignal = {
  kind: PreventionSignalKind;
  label: string;
  /** Facts behind the signal, one sentence. */
  detail: string;
  /** Optional verbatim evidence (a buyer quote, a carrier scan). */
  quote?: string;
  /** 0–100 contribution before combining. */
  weight: number;
  reason: DisputeReason;
  reasonLabel: string;
  /** When the condition started; a fix recorded after this time addresses the signal. */
  since: string;
  fixes: PreventionAction[];
};

export type PreventionTimelineEvent = {
  at: string;
  kind: "order" | "payment" | "checkout" | "shipped" | "scan" | "exception" | "delivered" | "return" | "refund" | "message_in" | "message_out" | "fix" | "now";
  label: string;
  detail?: string;
  tone: "neutral" | "good" | "warn" | "bad";
};

export type PreventionStatus = "at_risk" | "prevented" | "dismissed" | "clear";
export type RiskBand = "high" | "elevated" | "watch" | "clear";

export type PreventionOrder = {
  orderId: string;
  buyer: string;
  email: string;
  country: string;
  language: string;
  item: string;
  amount: number;
  currency: string;
  funding: "PAYPAL" | "CARD";
  fee: number;
  /** Order total plus the PayPal dispute fee: what a dispute on this order would cost. */
  exposure: number;
  placedAt: string;
  status: PreventionStatus;
  score: number;
  band: RiskBand;
  signals: PreventionSignal[];
  top: PreventionSignal | null;
  /** Deduplicated fixes for the active signals, the primary one first. */
  fixes: PreventionFixOption[];
  shipment: { id: string; carrier: string; service: string; tracking: string; trackingUrl: string; status: Shipment["status"]; onPayPal: boolean; shippedAt: string; deliveredAt?: string; lastScan?: { at: string; location: string; description: string } } | null;
  hold: boolean;
  timeline: PreventionTimelineEvent[];
  /** Fixes Exhibit ran on this order, newest last. */
  history: PreventionActionRecord[];
  /** Exposure removed by Exhibit's fixes. */
  saved: number;
};

export type PreventionActionRecord = {
  id: string;
  at: string;
  action: PreventionAction;
  actor: string;
  ok: boolean;
  detail: string;
  addressed: PreventionSignalKind[];
  before: { score: number; signals: PreventionSignalKind[] };
  after: { score: number; signals: PreventionSignalKind[] };
  saved: number;
  paypal?: { method: string; path: string; id?: string };
  message?: { language: string; subject: string; body: string };
  error?: string;
};

type PreventionDoc = { order_id: string; addressed: Partial<Record<PreventionSignalKind, string>>; actions: PreventionActionRecord[]; hold?: boolean; dismissed_at?: string };

export type PreventionReport = {
  generatedAt: string;
  mode: "demo" | "sandbox";
  /** Orders with at least one active signal, highest score first. */
  atRisk: PreventionOrder[];
  /** Orders Exhibit fixed (or the merchant dismissed), newest first. */
  resolved: PreventionOrder[];
  /** Every watched order: at risk, resolved and clear. */
  orders: PreventionOrder[];
  totals: {
    watched: number;
    atRisk: number;
    exposure: number;
    /** Sum of risk scores as probabilities: disputes expected if nothing changes. */
    expectedDisputes: number;
    high: number;
    elevated: number;
    watch: number;
    prevented: number;
    saved: number;
    feesAvoided: number;
  };
  bySignal: { kind: PreventionSignalKind; label: string; reasonLabel: string; count: number; exposure: number }[];
  watches: { kind: PreventionSignalKind; label: string; reasonLabel: string; description: string }[];
  rules: { signatureThreshold: number };
  fee: typeof DISPUTE_FEE;
};

export type PreventionFixResult =
  | { ok: true; orderId: string; action: PreventionAction; detail: string; saved: number; record: PreventionActionRecord; order: PreventionOrder | undefined; prevented: boolean }
  | { ok: false; orderId: string; action: PreventionAction; error: string; issue?: string; debugId?: string };

// ---- Signal catalogue ---------------------------------------------------------------------------

export const SIGNALS: Record<PreventionSignalKind, { label: string; reason: DisputeReason; description: string }> = {
  tracking_not_on_paypal: { label: "Tracking not on PayPal", reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED", description: "Shipped, but the tracking number never reached PayPal, so an item-not-received claim starts with no proof on file." },
  tracking_stalled: { label: "Tracking stalled", reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED", description: `No carrier scan for ${STALL_DAYS}+ days, a delivery exception, or past the promised delivery date.` },
  unsigned_high_value: { label: "No signature", reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED", description: "A high-value parcel delivered without signature confirmation: the weakest proof if the buyer says it never came." },
  address_mismatch: { label: "Address mismatch", reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED", description: "Delivered somewhere other than the PayPal transaction address, which voids Seller Protection." },
  refund_overdue: { label: "Refund overdue", reason: "CREDIT_NOT_PROCESSED", description: `The return arrived but no refund went out within ${REFUND_SLA_DAYS} days, as the returns policy promises.` },
  buyer_waiting: { label: "Buyer waiting", reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED", description: `A buyer message unanswered for ${REPLY_SLA_HOURS}h+, or one that mentions a dispute, a chargeback or a missing order.` },
  weak_checkout: { label: "Weak checkout", reason: "UNAUTHORISED", description: "A high-value first order with AVS or CVV mismatches, no 3-D Secure, or an IP far from the shipping address." },
};

const FIX: Record<PreventionAction, Omit<PreventionFixOption, "primary">> = {
  push_tracking: { action: "push_tracking", label: "Push tracking to PayPal", detail: "Sends the carrier and tracking number to the PayPal order, so proof of shipment is on file before any claim.", channel: "paypal", api: "POST /v2/checkout/orders/{id}/track" },
  refund: { action: "refund", label: "Refund now", detail: "Refunds the capture through PayPal and tells the buyer, before they file credit-not-processed.", channel: "paypal", api: "POST /v2/payments/captures/{id}/refund" },
  message_buyer: { action: "message_buyer", label: "Message buyer", detail: "Sends a status update in the buyer's language from the support inbox.", channel: "inbox" },
  hold_and_verify: { action: "hold_and_verify", label: "Hold & verify buyer", detail: "Holds fulfilment and asks the buyer to confirm billing details before anything ships.", channel: "inbox" },
  require_signature: { action: "require_signature", label: "Require signature over threshold", detail: "Turns on a store rule: every label above the threshold needs signature confirmation.", channel: "rule" },
  dismiss: { action: "dismiss", label: "Not a risk", detail: "Takes the order off the radar until something new happens.", channel: "none" },
};

/** Signals a buyer message addresses. */
const MESSAGE_ADDRESSES: PreventionSignalKind[] = ["tracking_stalled", "unsigned_high_value", "address_mismatch", "buyer_waiting"];

// ---- Helpers ------------------------------------------------------------------------------------

const days = (from: string, to = Date.now()) => (to - new Date(from).getTime()) / DAY;
const r2 = (n: number) => Math.round(n * 100) / 100;
const first = (name: string) => name.split(/\s+/)[0] ?? name;
const carrierName = (c: Shipment["carrier"]) => ({ UPS: "UPS", USPS: "USPS", FEDEX: "FedEx", DHL: "DHL Express", DHL_DEUTSCHE_POST: "DHL", ROYAL_MAIL: "Royal Mail" })[c];
const place = (a?: Address) => (a ? `${a.line1}${a.line2 ? `, ${a.line2}` : ""}, ${a.city}` : "");
const sameAddress = (a?: Address, b?: Address) =>
  !!a && !!b && a.postal_code.replace(/\s/g, "").toUpperCase() === b.postal_code.replace(/\s/g, "").toUpperCase() && a.line1.trim().toLowerCase() === b.line1.trim().toLowerCase();
const fmtDays = (d: number) => (d < 1 ? `${Math.max(1, Math.round(d * 24))}h` : `${Math.round(d)} day${Math.round(d) === 1 ? "" : "s"}`);

/** Promised delivery: the shipping policy says orders ship within 2 business days; carrier transit on top. */
function promisedBy(o: Order, sh?: Shipment) {
  const start = sh ? new Date(sh.shipped_at).getTime() : new Date(o.placed_at).getTime() + 2 * DAY;
  return new Date(start + (o.shipping_address.country === "US" ? 7 : 6) * DAY).toISOString();
}

function combine(weights: number[]) {
  return Math.round(100 * (1 - weights.reduce((acc, w) => acc * (1 - Math.min(95, w) / 100), 1)));
}

const band = (score: number): RiskBand => (score >= 65 ? "high" : score >= 40 ? "elevated" : score >= 15 ? "watch" : "clear");

function quoteOf(body: string, re: RegExp) {
  const sentences = body.split(/(?<=[.!?])\s+/);
  const hit = sentences.find((s) => re.test(s)) ?? sentences[0];
  return hit.length > 170 ? `${hit.slice(0, 167)}…` : hit;
}

function prevDoc(orderId: string): PreventionDoc {
  return docGet<PreventionDoc>("prevention", orderId) ?? { order_id: orderId, addressed: {}, actions: [] };
}

export function preventionRules() {
  return kvGet<{ signatureThreshold: number; enforced: boolean }>("prevention_rules", { signatureThreshold: DEFAULT_SIGNATURE_THRESHOLD, enforced: false });
}

function disputedOrderIds(): Set<string> {
  const ids = new Set<string>();
  for (const s of docList<ScenarioMeta>("scenario")) ids.add(s.order_id);
  for (const d of cachedDisputes()) {
    const o = store.orderForDispute(d);
    if (o) ids.add(o.id);
  }
  return ids;
}

// ---- Scoring ------------------------------------------------------------------------------------

type Facts = { order: Order; outbound?: Shipment; returned?: Shipment; conv?: Conversation; doc: PreventionDoc };

function detectSignals({ order, outbound, returned, conv, doc }: Facts): PreventionSignal[] {
  const out: PreventionSignal[] = [];
  const add = (kind: PreventionSignalKind, s: Omit<PreventionSignal, "kind" | "label" | "reason" | "reasonLabel">, reason = SIGNALS[kind].reason) =>
    out.push({ kind, label: SIGNALS[kind].label, reason, reasonLabel: REASON_LABEL[reason] ?? reason, ...s });
  const refunded = (order.refunds ?? []).reduce((a, r) => a + r.amount, 0);
  const rules = preventionRules();
  const t = Date.now();

  if (outbound && !outbound.pushed_to_paypal) {
    const inTransit = outbound.status !== "DELIVERED";
    add("tracking_not_on_paypal", {
      detail: `${carrierName(outbound.carrier)} ${outbound.tracking_number} shipped ${fmtDays(days(outbound.shipped_at))} ago and PayPal has never seen it${inTransit ? "; the parcel is still in transit" : ""}.`,
      weight: inTransit ? 40 : 30,
      since: outbound.shipped_at,
      fixes: ["push_tracking"],
    });
  }

  if (outbound && outbound.status !== "DELIVERED" && outbound.status !== "RETURNED_TO_SENDER") {
    const last = outbound.events.at(-1);
    const quiet = last ? days(last.at) : days(outbound.shipped_at);
    const late = t > new Date(promisedBy(order, outbound)).getTime();
    const exception = outbound.status === "EXCEPTION" || last?.code === "EXCEPTION";
    if (exception || quiet >= STALL_DAYS || late) {
      const w = exception ? 55 : Math.min(70, 30 + Math.max(0, quiet - STALL_DAYS) * 6 + (late ? 15 : 0));
      add("tracking_stalled", {
        detail: exception
          ? `${carrierName(outbound.carrier)} reported a delivery exception ${fmtDays(quiet)} ago in ${last?.location}.`
          : `No ${carrierName(outbound.carrier)} scan for ${fmtDays(quiet)}${late ? `, and the promised delivery date (${new Date(promisedBy(order, outbound)).toLocaleDateString("en-US", { month: "short", day: "numeric" })}) has passed` : ""}.`,
        quote: last ? `${last.description} · ${last.location}` : undefined,
        weight: Math.round(w),
        since: last?.at ?? outbound.shipped_at,
        fixes: ["message_buyer"],
      });
    }
  }

  if (outbound?.status === "DELIVERED" && !outbound.signature && order.total > rules.signatureThreshold) {
    add("unsigned_high_value", {
      detail: `$${order.total.toFixed(0)} delivered ${outbound.delivered_at ? fmtDays(days(outbound.delivered_at)) + " ago " : ""}with no signature, though the shipping policy promises signature confirmation over $${rules.signatureThreshold}.`,
      quote: outbound.events.at(-1)?.description,
      weight: order.total > 350 ? 40 : 30,
      since: outbound.delivered_at ?? outbound.shipped_at,
      fixes: rules.enforced ? ["message_buyer"] : ["message_buyer", "require_signature"],
    });
  }

  if (outbound?.status === "DELIVERED" && outbound.delivered_to && !sameAddress(outbound.delivered_to, order.shipping_address)) {
    add("address_mismatch", {
      detail: `Delivered to ${place(outbound.delivered_to)}, not the PayPal transaction address (${place(order.shipping_address)}). PayPal Seller Protection requires delivery to the transaction address.`,
      quote: outbound.events.at(-1)?.description,
      weight: 45,
      since: outbound.delivered_at ?? outbound.shipped_at,
      fixes: ["message_buyer"],
    });
  }

  if (returned?.status === "DELIVERED" && returned.delivered_at && refunded < order.total - order.shipping_cost - 0.005) {
    const waited = days(returned.delivered_at);
    if (waited >= REFUND_SLA_DAYS) {
      add("refund_overdue", {
        detail: `The return reached the studio ${fmtDays(waited)} ago and no refund has gone out; the returns policy promises one within ${REFUND_SLA_DAYS} business days.`,
        quote: returned.events.at(-1)?.description,
        weight: Math.min(85, Math.round(60 + (waited - REFUND_SLA_DAYS) * 4)),
        since: returned.delivered_at,
        fixes: ["refund"],
      });
    }
  }

  const lastMsg = conv?.messages.at(-1);
  if (lastMsg?.from === "customer") {
    const waited = days(lastMsg.at) * 24;
    const threat = THREAT_RE.test(lastMsg.body);
    const wismo = WISMO_RE.test(lastMsg.body);
    const negative = NEGATIVE_RE.test(lastMsg.body);
    if (waited >= REPLY_SLA_HOURS || threat || wismo) {
      const w = Math.min(85, 20 + Math.max(0, Math.floor((waited - REPLY_SLA_HOURS) / 24)) * 8 + (threat ? 45 : 0) + (wismo && !threat ? 20 : 0) + (negative ? 15 : 0));
      const reason: DisputeReason = negative && outbound?.status === "DELIVERED" && !wismo ? "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" : returned ? "CREDIT_NOT_PROCESSED" : "MERCHANDISE_OR_SERVICE_NOT_RECEIVED";
      const tone = threat ? "mentions opening a dispute" : wismo ? "is asking where the order is" : negative ? "is unhappy with the item" : "is waiting for a reply";
      add(
        "buyer_waiting",
        {
          detail: `${first(order.shipping_address.name)} ${tone}; unanswered for ${fmtDays(waited / 24)}${lastMsg.language !== "en" ? ` (written in ${({ de: "German", fr: "French", it: "Italian", es: "Spanish" } as Record<string, string>)[lastMsg.language] ?? lastMsg.language})` : ""}.`,
          quote: quoteOf(lastMsg.body, threat ? THREAT_RE : wismo ? WISMO_RE : NEGATIVE_RE),
          weight: w,
          since: lastMsg.at,
          fixes: returned && refunded < order.total - order.shipping_cost ? ["refund", "message_buyer"] : ["message_buyer"],
        },
        reason,
      );
    }
  }

  const risk = store.risk(order.id);
  const customer = store.customer(order.customer_email);
  const firstOrder = !customer || customer.order_ids.length <= 1;
  if (risk && firstOrder && order.total >= HIGH_VALUE_FIRST_ORDER) {
    const flags: string[] = [];
    if (risk.avs_result === "N") flags.push("AVS mismatch");
    if (risk.cvv_result === "N") flags.push("CVV mismatch");
    if (order.paypal.funding === "CARD" && (risk.three_ds === "NONE" || risk.three_ds === "NOT_ENROLLED")) flags.push("no 3-D Secure");
    if (risk.ip.country !== order.shipping_address.country || risk.ip_to_shipping_km > 1500) flags.push(`IP in ${risk.ip.city}, ${risk.ip_to_shipping_km.toLocaleString("en-US")} km from the shipping address`);
    if (risk.email_age_days < 14) flags.push(`email created ${risk.email_age_days} days ago`);
    if (risk.orders_last_24h >= 3) flags.push(`${risk.orders_last_24h} orders in 24h`);
    if (order.billing_address && !sameAddress(order.billing_address, order.shipping_address)) flags.push("billing and shipping addresses differ");
    if (flags.length >= 2) {
      add("weak_checkout", {
        detail: `$${order.total.toFixed(0)} first order${outbound ? "" : ", not shipped yet"}: ${flags.join(", ")}.`,
        weight: Math.min(85, 15 + flags.length * 12),
        since: order.placed_at,
        fixes: outbound ? ["message_buyer", "refund"] : ["hold_and_verify", "refund"],
      });
    }
  }

  // A fix recorded after a signal started addresses it; dismissing addresses everything up to that moment.
  return out
    .filter((s) => {
      const at = doc.addressed[s.kind];
      return !(at && at >= s.since) && !(doc.dismissed_at && doc.dismissed_at >= s.since);
    })
    .sort((a, b) => b.weight - a.weight);
}

function fixesFor(signals: PreventionSignal[], order: Order): PreventionFixOption[] {
  const seen = new Map<PreventionAction, PreventionFixOption>();
  for (const s of signals) for (const a of s.fixes) if (!seen.has(a)) seen.set(a, { ...FIX[a] });
  // PayPal API fixes outrank messages: they leave proof on PayPal's side.
  const rank: Record<PreventionAction, number> = { refund: 0, push_tracking: 1, hold_and_verify: 2, message_buyer: 3, require_signature: 4, dismiss: 9 };
  const top = signals[0];
  const list = [...seen.values()].sort((a, b) => {
    if (top?.kind === "weak_checkout") return (a.action === "hold_and_verify" ? -1 : 0) - (b.action === "hold_and_verify" ? -1 : 0) || rank[a.action] - rank[b.action];
    return rank[a.action] - rank[b.action];
  });
  if (signals.length) list.push({ ...FIX.dismiss });
  if (list[0]) list[0].primary = true;
  const refund = list.find((f) => f.action === "refund");
  if (refund) {
    const owed = order.total - (order.refunds ?? []).reduce((a, r) => a + r.amount, 0);
    const weak = top?.kind === "weak_checkout";
    refund.label = weak ? "Cancel & refund" : `Refund $${(signals.some((s) => s.kind === "refund_overdue") ? order.total - order.shipping_cost : owed).toFixed(2)}`;
    if (weak) refund.detail = "Cancels before anything ships and refunds the capture through PayPal: no goods lost, no chargeback fee.";
  }
  return list;
}

function timelineFor({ order, outbound, returned, conv, doc }: Facts): PreventionTimelineEvent[] {
  const ev: PreventionTimelineEvent[] = [];
  ev.push({ at: order.placed_at, kind: "order", label: "Order placed", detail: `${order.items.map((i) => `${i.qty} × ${i.name}`).join(", ")} · $${order.total.toFixed(2)}`, tone: "neutral" });
  ev.push({ at: order.placed_at, kind: "payment", label: order.paypal.funding === "CARD" ? "Card payment captured" : "PayPal payment captured", detail: `Capture ${order.paypal.capture_id}`, tone: "neutral" });
  const risk = store.risk(order.id);
  if (risk && (risk.avs_result === "N" || risk.three_ds === "NONE") && order.paypal.funding === "CARD")
    ev.push({ at: order.placed_at, kind: "checkout", label: "Checkout signals", detail: `AVS ${risk.avs_result ?? "–"} · CVV ${risk.cvv_result ?? "–"} · 3DS ${risk.three_ds ?? "–"} · IP ${risk.ip.city}, ${risk.ip.country}`, tone: "bad" });
  if (outbound) {
    ev.push({ at: outbound.shipped_at, kind: "shipped", label: `Shipped with ${carrierName(outbound.carrier)}`, detail: `${outbound.tracking_number}${outbound.pushed_to_paypal ? " · on PayPal" : " · not on PayPal"}`, tone: outbound.pushed_to_paypal ? "neutral" : "warn" });
    for (const e of outbound.events) {
      if (e.code === "PICKUP") continue;
      const delivered = e.code === "DELIVERED";
      ev.push({
        at: e.at,
        kind: delivered ? "delivered" : e.code === "EXCEPTION" ? "exception" : "scan",
        label: delivered ? "Delivered" : e.code === "EXCEPTION" ? "Delivery exception" : e.description,
        detail: delivered ? `${e.description}${outbound.signature ? ` · signed ${outbound.signature.name}` : ""}` : `${e.location}${e.code === "EXCEPTION" ? ` · ${e.description}` : ""}`,
        tone: delivered ? (outbound.signature && sameAddress(outbound.delivered_to, order.shipping_address) ? "good" : "warn") : e.code === "EXCEPTION" ? "bad" : "neutral",
      });
    }
  }
  if (returned) {
    ev.push({ at: returned.shipped_at, kind: "return", label: "Return shipped", detail: `${carrierName(returned.carrier)} ${returned.tracking_number}`, tone: "neutral" });
    if (returned.delivered_at) ev.push({ at: returned.delivered_at, kind: "return", label: "Return received at studio", detail: returned.events.at(-1)?.description, tone: "warn" });
  }
  for (const r of order.refunds ?? []) ev.push({ at: r.at, kind: "refund", label: `Refunded $${r.amount.toFixed(2)}`, detail: r.id, tone: "good" });
  for (const m of conv?.messages ?? []) ev.push({ at: m.at, kind: m.from === "customer" ? "message_in" : "message_out", label: m.from === "customer" ? "Buyer wrote" : "Reply sent", detail: m.body.length > 140 ? `${m.body.slice(0, 137)}…` : m.body, tone: m.from === "customer" ? (THREAT_RE.test(m.body) ? "bad" : "neutral") : "good" });
  for (const a of doc.actions) if (a.ok && a.action !== "message_buyer" && a.action !== "hold_and_verify") ev.push({ at: a.at, kind: "fix", label: FIX[a.action].label, detail: a.detail, tone: "good" });
  if (doc.hold) ev.push({ at: doc.actions.find((a) => a.action === "hold_and_verify")?.at ?? now(), kind: "fix", label: "Fulfilment on hold", detail: "Waiting for the buyer to confirm billing details", tone: "good" });
  ev.sort((a, b) => a.at.localeCompare(b.at));
  ev.push({ at: now(), kind: "now", label: "Now", tone: "neutral" });
  return ev;
}

function evaluate(order: Order): PreventionOrder {
  const shipments = store.shipmentsFor(order.id);
  const outbound = shipments.filter((s) => s.direction === "OUTBOUND").sort((a, b) => b.shipped_at.localeCompare(a.shipped_at))[0];
  const returned = shipments.find((s) => s.direction === "RETURN");
  const conv = store.conversation(order.id);
  const doc = prevDoc(order.id);
  const facts: Facts = { order, outbound, returned, conv, doc };
  const signals = detectSignals(facts);
  const customer = store.customer(order.customer_email);
  const refunded = (order.refunds ?? []).reduce((a, r) => a + r.amount, 0);
  const fee = order.paypal.funding === "CARD" ? DISPUTE_FEE.CARD : DISPUTE_FEE.PAYPAL;
  const exposure = r2(Math.max(0, order.total - refunded) + fee);
  const score = signals.length ? combine(signals.map((s) => s.weight)) : 0;
  const fixedSomething = doc.actions.some((a) => a.ok && a.action !== "dismiss" && a.action !== "require_signature");
  const status: PreventionStatus = signals.length ? "at_risk" : doc.dismissed_at && !fixedSomething ? "dismissed" : fixedSomething ? "prevented" : "clear";
  const last = outbound?.events.at(-1);
  const lastCustomer = conv?.messages.filter((m) => m.from === "customer").at(-1);
  return {
    orderId: order.id,
    buyer: customer?.name ?? order.shipping_address.name,
    email: order.customer_email,
    country: order.shipping_address.country,
    language: languageFor(order.shipping_address.country, lastCustomer?.language),
    item: order.items.map((i) => (i.qty > 1 ? `${i.qty} × ${i.name}` : i.name)).join(", "),
    amount: order.total,
    currency: order.currency,
    funding: order.paypal.funding,
    fee,
    exposure,
    placedAt: order.placed_at,
    status,
    score,
    band: band(score),
    signals,
    top: signals[0] ?? null,
    fixes: fixesFor(signals, order),
    shipment: outbound
      ? {
          id: outbound.id,
          carrier: carrierName(outbound.carrier),
          service: outbound.service,
          tracking: outbound.tracking_number,
          trackingUrl: outbound.tracking_url,
          status: outbound.status,
          onPayPal: outbound.pushed_to_paypal,
          shippedAt: outbound.shipped_at,
          deliveredAt: outbound.delivered_at,
          lastScan: last ? { at: last.at, location: last.location, description: last.description } : undefined,
        }
      : null,
    hold: !!doc.hold,
    timeline: timelineFor(facts),
    history: doc.actions,
    saved: r2(doc.actions.reduce((a, x) => a + (x.ok ? x.saved : 0), 0)),
  };
}

function watchedOrders(): Order[] {
  const disputed = disputedOrderIds();
  const cutoff = Date.now() - WINDOW_DAYS * DAY;
  return store.orders().filter((o) => !disputed.has(o.id) && new Date(o.placed_at).getTime() >= cutoff);
}

// ---- Public API ---------------------------------------------------------------------------------

export function preventionReport(): PreventionReport {
  const all = watchedOrders()
    .map(evaluate)
    // Fully refunded orders with nothing left to prevent are not watched (unless Exhibit refunded them).
    .filter((o) => o.status !== "clear" || o.exposure > o.fee + 0.005)
    .sort((a, b) => b.score - a.score || b.exposure - a.exposure);
  const atRisk = all.filter((o) => o.status === "at_risk");
  const resolved = all.filter((o) => o.status === "prevented" || o.status === "dismissed").sort((a, b) => (b.history.at(-1)?.at ?? "").localeCompare(a.history.at(-1)?.at ?? ""));
  const prevented = resolved.filter((o) => o.status === "prevented");
  const bySignal = new Map<PreventionSignalKind, { count: number; exposure: number }>();
  for (const o of atRisk)
    for (const s of o.signals) {
      const cur = bySignal.get(s.kind) ?? { count: 0, exposure: 0 };
      cur.count++;
      cur.exposure += o.exposure;
      bySignal.set(s.kind, cur);
    }
  const rules = preventionRules();
  return {
    generatedAt: now(),
    mode: paypalMode(),
    atRisk,
    resolved,
    orders: all,
    totals: {
      watched: all.length,
      atRisk: atRisk.length,
      exposure: r2(atRisk.reduce((a, o) => a + o.exposure, 0)),
      expectedDisputes: r2(atRisk.reduce((a, o) => a + o.score / 100, 0)),
      high: atRisk.filter((o) => o.band === "high").length,
      elevated: atRisk.filter((o) => o.band === "elevated").length,
      watch: atRisk.filter((o) => o.band === "watch" || o.band === "clear").length,
      prevented: prevented.length,
      saved: r2(prevented.reduce((a, o) => a + o.saved, 0)),
      feesAvoided: prevented.reduce((a, o) => a + o.fee, 0),
    },
    bySignal: (Object.keys(SIGNALS) as PreventionSignalKind[])
      .filter((k) => bySignal.has(k))
      .map((k) => ({ kind: k, label: SIGNALS[k].label, reasonLabel: REASON_LABEL[SIGNALS[k].reason] ?? SIGNALS[k].reason, count: bySignal.get(k)!.count, exposure: r2(bySignal.get(k)!.exposure) }))
      .sort((a, b) => b.exposure - a.exposure),
    watches: (Object.keys(SIGNALS) as PreventionSignalKind[]).map((k) => ({ kind: k, label: SIGNALS[k].label, reasonLabel: REASON_LABEL[SIGNALS[k].reason] ?? "", description: SIGNALS[k].description })),
    rules: { signatureThreshold: rules.signatureThreshold },
    fee: DISPUTE_FEE,
  };
}

export function preventionOrder(orderId: string): PreventionOrder | undefined {
  const o = store.order(orderId);
  if (!o || disputedOrderIds().has(o.id)) return undefined;
  return evaluate(o);
}

function messageContext(order: Order, extra: Partial<MessageContext> = {}): MessageContext {
  const shipments = store.shipmentsFor(order.id);
  const outbound = shipments.find((s) => s.direction === "OUTBOUND");
  const returned = shipments.find((s) => s.direction === "RETURN");
  const last = outbound?.events.at(-1);
  const conv = store.conversation(order.id);
  const m = store.merchant();
  const name = store.customer(order.customer_email)?.name ?? order.shipping_address.name;
  return {
    first: first(name),
    orderId: order.id,
    item: order.items[0]?.name ?? "order",
    qty: order.items[0]?.qty ?? 1,
    carrier: outbound ? carrierName(outbound.carrier) : "the carrier",
    tracking: outbound?.tracking_number ?? "",
    shippedAt: outbound?.shipped_at,
    lastScanAt: last?.at,
    lastScanLocation: last?.location,
    lastScanDescription: last?.description,
    customs: /customs|zoll|douane/i.test(last?.description ?? ""),
    deliveredAt: outbound?.delivered_at,
    deliveredTo: outbound?.delivered_to && !sameAddress(outbound.delivered_to, order.shipping_address) ? `${outbound.delivered_to.name}, ${place(outbound.delivered_to)}` : outbound?.delivered_to ? place(outbound.delivered_to) : undefined,
    shipTo: place(order.shipping_address),
    returnAt: returned?.delivered_at,
    replying: conv?.messages.at(-1)?.from === "customer",
    merchant: m.name,
    merchantEmail: m.email,
    ...extra,
  };
}

function situationFor(p: PreventionOrder, action: PreventionAction): MessageSituation {
  if (action === "hold_and_verify") return "verify";
  const kinds = new Set(p.signals.map((s) => s.kind));
  const waiting = p.signals.find((s) => s.kind === "buyer_waiting");
  const delivered = p.shipment?.status === "DELIVERED";
  if (waiting) {
    if (waiting.reason === "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED") return "not_as_expected";
    if (delivered && WISMO_RE.test(waiting.quote ?? "") ) return "delivered_not_found";
    if (delivered && THREAT_RE.test(waiting.quote ?? "")) return "delivered_not_found";
  }
  if (p.shipment?.status === "EXCEPTION") return "exception";
  if (kinds.has("tracking_stalled")) return "stalled";
  if (kinds.has("address_mismatch")) return "redirected";
  if (kinds.has("unsigned_high_value")) return "receipt_check";
  if (kinds.has("weak_checkout")) return "verify";
  return waiting ? "general" : "receipt_check";
}

/** The message Exhibit would send for this order, in the buyer's language. */
export function draftPreventionMessage(orderId: string, action: PreventionAction = "message_buyer"): MessageDraft | undefined {
  const order = store.order(orderId);
  const p = order && preventionOrder(orderId);
  if (!order || !p) return undefined;
  return renderMessage(situationFor(p, action), p.language, messageContext(order));
}

function sendInboxMessage(order: Order, draft: { subject: string; body: string; language: string }): SupportMessage {
  const conv = store.conversation(order.id) ?? { order_id: order.id, messages: [] };
  const lastIn = conv.messages.filter((m) => m.from === "customer").at(-1);
  const msg: SupportMessage = { id: `MSG-${order.id.replace(/\D/g, "")}-${conv.messages.length + 1}`, at: now(), from: "merchant", channel: lastIn?.channel ?? "email", subject: draft.subject, body: draft.body, language: draft.language };
  store.putConversation({ ...conv, messages: [...conv.messages, msg] });
  return msg;
}

/**
 * Runs one fix on an order and records before/after, so a fixed order drops off the radar.
 * `message` overrides the drafted buyer message (message_buyer, hold_and_verify).
 */
export async function runPreventionFix(orderId: string, action: PreventionAction, opts: { actor?: string; message?: { subject?: string; body: string } } = {}): Promise<PreventionFixResult> {
  const actor = opts.actor ?? "merchant";
  const order = store.order(orderId);
  const before = order ? preventionOrder(orderId) : undefined;
  if (!order || !before) return { ok: false, orderId, action, error: `Order ${orderId} is not on the prevention radar (unknown, or already disputed).` };
  if (!FIX[action]) return { ok: false, orderId, action, error: `Unknown action ${action}.` };
  const available = before.fixes.map((f) => f.action);
  if (action !== "require_signature" && !available.includes(action)) return { ok: false, orderId, action, error: `${FIX[action].label} does not apply to ${orderId} right now.` };

  const doc = prevDoc(orderId);
  const stamp = now();
  let detail = "";
  let addressed: PreventionSignalKind[] = [];
  let paypalCall: PreventionActionRecord["paypal"];
  let message: PreventionActionRecord["message"];
  let saved = before.exposure;

  try {
    if (action === "push_tracking") {
      const ids = store.shipmentsFor(orderId).filter((s) => s.direction === "OUTBOUND" && !s.pushed_to_paypal).map((s) => s.id);
      const res = await syncTrackingToPayPal(ids);
      const failed = res.find((r) => !r.ok);
      if (failed || !res.length) throw new Error(failed?.error ?? "No shipment to push.");
      addressed = ["tracking_not_on_paypal"];
      paypalCall = { method: "POST", path: `/v2/checkout/orders/${order.paypal.order_id}/track` };
      detail = `Tracking ${before.shipment?.carrier} ${before.shipment?.tracking} added to PayPal order ${order.paypal.order_id}.`;
      // Pushing tracking is proof, not a full fix, when other signals remain; count the saving only once the order clears.
    } else if (action === "refund") {
      const weak = before.top?.kind === "weak_checkout";
      const refundedSoFar = (order.refunds ?? []).reduce((a, r) => a + r.amount, 0);
      const owed = r2((weak ? order.total : order.total - order.shipping_cost) - refundedSoFar);
      if (owed <= 0) throw new Error("Nothing left to refund on this order.");
      const body = { amount: { currency_code: order.currency, value: owed.toFixed(2) }, note_to_payer: weak ? `Order ${order.id} cancelled and refunded` : `Refund for your return of order ${order.id}` };
      const refund = await paypal().refundCapture(order.paypal.capture_id, body, randomUUID());
      store.putOrder({ ...order, refunds: [...(order.refunds ?? []), { id: refund.id, amount: owed, at: stamp }] });
      paypalCall = { method: "POST", path: `/v2/payments/captures/${order.paypal.capture_id}/refund`, id: refund.id };
      addressed = weak ? before.signals.map((s) => s.kind) : ["refund_overdue"];
      // A refund that was owed anyway saves the dispute fee; cancelling a risky order before shipping saves the goods too.
      saved = weak ? before.exposure : before.fee;
      if (before.signals.some((s) => s.kind === "buyer_waiting") || weak) {
        const draft = renderMessage(weak ? "general" : "refund_issued", before.language, messageContext(order, { amount: `$${owed.toFixed(2)}`, refundId: refund.id }));
        const text = weak ? { ...draft, subject: `Order ${order.id} cancelled and refunded`, body: `Hi ${first(before.buyer)},\n\nWe couldn't verify the payment details on order ${order.id}, so we've cancelled it and refunded $${owed.toFixed(2)} in full (refund ${refund.id}). If you placed this order, reply and we'll help you re-order.\n\n${store.merchant().name} · ${store.merchant().email}` } : draft;
        sendInboxMessage(order, text);
        message = { language: text.language, subject: text.subject, body: text.body };
        addressed.push("buyer_waiting");
      }
      detail = `Refunded $${owed.toFixed(2)} on capture ${order.paypal.capture_id} (${refund.id})${message ? "; buyer told by email" : ""}.`;
    } else if (action === "message_buyer" || action === "hold_and_verify") {
      const draft = draftPreventionMessage(orderId, action)!;
      const text = opts.message?.body ? { ...draft, subject: opts.message.subject ?? draft.subject, body: opts.message.body } : draft;
      const sent = sendInboxMessage(order, text);
      message = { language: text.language, subject: text.subject, body: text.body };
      addressed = action === "hold_and_verify" ? ["weak_checkout"] : before.signals.map((s) => s.kind).filter((k) => MESSAGE_ADDRESSES.includes(k) || (k === "weak_checkout" && !!before.shipment));
      if (action === "hold_and_verify") doc.hold = true;
      detail = `${action === "hold_and_verify" ? "Fulfilment held; verification request" : "Message"} sent to ${before.email} in ${draft.languageName} (${sent.id}).`;
    } else if (action === "require_signature") {
      kvSet("prevention_rules", { ...preventionRules(), enforced: true });
      addressed = [];
      saved = 0;
      detail = `Rule on: labels over $${preventionRules().signatureThreshold} now require signature confirmation.`;
    } else if (action === "dismiss") {
      doc.dismissed_at = stamp;
      addressed = before.signals.map((s) => s.kind);
      saved = 0;
      detail = "Marked as not a risk.";
    }
  } catch (e) {
    const err = e instanceof PayPalError ? { error: e.message, issue: e.issue, debugId: e.debugId } : { error: e instanceof Error ? e.message : String(e) };
    doc.actions.push({ id: `pv_${randomUUID().slice(0, 10)}`, at: stamp, action, actor, ok: false, detail: err.error, addressed: [], before: { score: before.score, signals: before.signals.map((s) => s.kind) }, after: { score: before.score, signals: before.signals.map((s) => s.kind) }, saved: 0, paypal: paypalCall, error: err.error });
    docPut("prevention", orderId, doc);
    logActivity("action_error", `Prevention: ${FIX[action].label} failed on ${orderId}: ${err.error}`, null, { orderId, action, actor, ...err });
    return { ok: false, orderId, action, ...err };
  }

  for (const k of addressed) doc.addressed[k] = stamp;
  const record: PreventionActionRecord = {
    id: `pv_${randomUUID().slice(0, 10)}`,
    at: stamp,
    action,
    actor,
    ok: true,
    detail,
    addressed,
    before: { score: before.score, signals: before.signals.map((s) => s.kind) },
    after: { score: 0, signals: [] },
    saved: 0,
    paypal: paypalCall,
    message,
  };
  doc.actions.push(record);
  docPut("prevention", orderId, doc);
  const after = preventionOrder(orderId);
  const prevented = !!after && after.status !== "at_risk" && action !== "dismiss";
  record.after = { score: after?.score ?? 0, signals: after?.signals.map((s) => s.kind) ?? [] };
  // Saving is credited when the order leaves the radar: the whole exposure (or the fee, for a refund that was owed).
  const priorSaved = doc.actions.slice(0, -1).reduce((a, x) => a + (x.ok ? x.saved : 0), 0);
  const priorRefundOwed = doc.actions.some((x) => x.ok && x.action === "refund" && x.addressed.includes("refund_overdue"));
  record.saved = prevented ? r2(Math.max(0, (action === "refund" ? saved : priorRefundOwed ? before.fee : before.exposure) - priorSaved)) : 0;
  docPut("prevention", orderId, doc);
  logActivity("action", `Prevention · ${orderId}: ${detail} Risk ${before.score} → ${record.after.score}.`, null, { orderId, action, actor, before: record.before, after: record.after, saved: record.saved });
  if (action !== "dismiss") markDemoProgress("prevent");
  return { ok: true, orderId, action, detail, saved: record.saved, record, order: preventionOrder(orderId), prevented };
}
