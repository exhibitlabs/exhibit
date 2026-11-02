// Hand-built cases, written through the same public store/db/simulator APIs the app uses, so the
// tests do not depend on the demo seed (which changes as the demo is reworked).
import { createHash, randomUUID } from "node:crypto";
import type { ActionType, CaseBrief } from "@/lib/agent/brief";
import type { AgentEvent, ToolContext } from "@/lib/agent/tools";
import { db, docPut, kvSet, resetDatabase } from "@/lib/db";
import { caseFile, DISPUTE_KIND } from "@/lib/disputes";
import { refs } from "@/lib/evidence";
import { linksFor, simGet, simPut } from "@/lib/paypal/simulator";
import type { Dispute } from "@/lib/paypal/types";
import { store } from "@/lib/store/repo";
import type { Address, Conversation, Customer, Order, RiskSignals, Shipment, SupportMessage } from "@/lib/store/types";

export const DAY = 86_400_000;
export const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
export const ahead = (days: number) => new Date(Date.now() + days * DAY).toISOString();

export const idsFor = (n = 1) => ({
  dispute: `PP-D-9000${n}`,
  order: `KA-9000${n}`,
  capture: `CAPTURE9000${n}`,
  ppOrder: `PPORDER9000${n}`,
  shipment: `SHP-9000${n}`,
  email: `buyer${n}@example.com`,
  item: `ITEM-${n}`,
});

export const ADDRESS: Address = { name: "Ada Buyer", line1: "12 Quay Street", city: "Portland", state: "OR", postal_code: "97201", country: "US" };

export function makeOrder(over: Partial<Order> = {}, n = 1): Order {
  const id = idsFor(n);
  const product = store.products()[0];
  return {
    id: id.order,
    placed_at: ago(9),
    currency: "USD",
    customer_email: id.email,
    items: [{ sku: product.sku, name: product.name, qty: 1, unit_price: 142 }],
    subtotal: 142,
    shipping_cost: 0,
    tax: 0,
    total: 142,
    shipping_address: ADDRESS,
    shipping_method: "UPS Ground",
    paypal: { order_id: id.ppOrder, capture_id: id.capture, invoice_id: id.order, funding: "PAYPAL" },
    checkout: { ip: "203.0.113.7", user_agent: "Mozilla/5.0", accepted_terms_at: ago(9), policies_version: "2026-03" },
    shipment_ids: [id.shipment],
    ...over,
  };
}

/** Delivered to the transaction address and signed for, unless overridden. */
export function makeShipment(over: Partial<Shipment> = {}, n = 1): Shipment {
  const id = idsFor(n);
  return {
    id: id.shipment,
    order_id: id.order,
    direction: "OUTBOUND",
    carrier: "UPS",
    service: "Ground",
    tracking_number: `1Z999AA1012345678${n}`,
    tracking_url: `https://www.ups.com/track?tracknum=1Z999AA1012345678${n}`,
    shipped_at: ago(7),
    delivered_at: ago(4),
    status: "DELIVERED",
    delivered_to: ADDRESS,
    signature: { name: "A. Buyer", at: ago(4) },
    events: [
      { at: ago(7), location: "Brooklyn, NY", description: "Picked up", code: "PICKUP" },
      { at: ago(5), location: "Chicago, IL", description: "Departed facility", code: "TRANSIT" },
      { at: ago(4), location: "Portland, OR", description: "Delivered, signed A. Buyer", code: "DELIVERED" },
    ],
    pushed_to_paypal: true,
    ...over,
  };
}

export function makeCustomer(over: Partial<Customer> = {}, n = 1): Customer {
  const id = idsFor(n);
  return { email: id.email, name: "Ada Buyer", country: "US", first_order_at: ago(300), order_ids: [id.order, `KA-OLD-${n}`], lifetime_value: 480, prior_disputes: 0, ...over };
}

export function makeConversation(messages: SupportMessage[] = [], n = 1): Conversation {
  return { order_id: idsFor(n).order, messages };
}

export function makeMessage(over: Partial<SupportMessage> = {}): SupportMessage {
  return { id: `MSG-${randomUUID().slice(0, 6)}`, at: ago(1), from: "customer", channel: "email", subject: "Order", body: "Hello", language: "en", ...over };
}

export function makeRisk(over: Partial<RiskSignals> = {}, n = 1): RiskSignals {
  return {
    order_id: idsFor(n).order,
    avs_result: "Y",
    cvv_result: "M",
    three_ds: "AUTHENTICATED",
    ip: { address: "203.0.113.7", city: "Portland", region: "OR", country: "US" },
    ip_to_shipping_km: 12,
    device: { id: "dev-1", seen_before: true, first_seen: ago(120) },
    email_age_days: 900,
    orders_last_24h: 1,
    ...over,
  };
}

/** A chargeback for an item-not-received claim, waiting on the seller. Links come from the simulator's lifecycle. */
export function makeDispute(over: Partial<Dispute> = {}, n = 1): Dispute {
  const id = idsFor(n);
  const d: Dispute = {
    dispute_id: id.dispute,
    create_time: ago(3),
    update_time: ago(3),
    disputed_transactions: [
      {
        seller_transaction_id: id.capture,
        invoice_number: id.order,
        create_time: ago(9),
        gross_amount: { currency_code: "USD", value: "142.00" },
        buyer: { name: "Ada Buyer", email: id.email },
        seller: { name: "Kora Atelier" },
        items: [{ item_id: id.item, item_name: "The Market Tote", item_quantity: "1" }],
      },
    ],
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    status: "WAITING_FOR_SELLER_RESPONSE",
    dispute_amount: { currency_code: "USD", value: "142.00" },
    dispute_life_cycle_stage: "CHARGEBACK",
    dispute_channel: "INTERNAL",
    messages: [{ posted_by: "BUYER", time_posted: ago(3), content: "My order never arrived." }],
    evidences: [{ evidence_type: "PROOF_OF_FULFILLMENT", source: "REQUESTED_FROM_SELLER" }],
    seller_response_due_date: ahead(5),
    allowed_response_options: {
      accept_claim: { accept_claim_types: ["REFUND"] },
      make_offer: { offer_types: ["REFUND", "REFUND_WITH_RETURN", "REFUND_WITH_REPLACEMENT", "REPLACEMENT_WITHOUT_REFUND"] },
    },
    links: [],
    ...over,
  };
  d.links = over.links ?? linksFor(d);
  return d;
}

export type CaseKit = { dispute: Dispute; order: Order; shipments: Shipment[]; customer: Customer; conversation: Conversation; risk: RiskSignals };

type CaseOptions = {
  n?: number;
  dispute?: Partial<Dispute>;
  order?: Partial<Order>;
  /** Pass [] for an order that was never shipped. */
  shipments?: Shipment[];
  messages?: SupportMessage[];
  risk?: Partial<RiskSignals>;
  customer?: Partial<Customer>;
};

/** Empties the database and marks it seeded, so route handlers never replace these cases with the demo merchant. */
export function resetState() {
  resetDatabase();
  kvSet("seeded_at", new Date().toISOString());
}

/** Writes one dispute and its store records (order, shipments, buyer, inbox, risk) into the test database. */
export function installCase(opts: CaseOptions = {}): CaseKit {
  const n = opts.n ?? 1;
  const order = makeOrder(opts.order, n);
  const shipments = opts.shipments ?? [makeShipment({ order_id: order.id }, n)];
  const customer = makeCustomer({ email: order.customer_email, ...opts.customer }, n);
  const conversation = makeConversation(opts.messages ?? [makeMessage({ id: `MSG-${n}-1`, at: ago(8), from: "customer", body: "When will my order ship?" })], n);
  conversation.order_id = order.id;
  const risk = makeRisk({ order_id: order.id, ...opts.risk }, n);
  const dispute = makeDispute(
    {
      disputed_transactions: [{ ...makeDispute({}, n).disputed_transactions[0], seller_transaction_id: order.paypal.capture_id, invoice_number: order.id }],
      ...opts.dispute,
    },
    n,
  );
  simPut(dispute);
  docPut(DISPUTE_KIND, dispute.dispute_id, dispute);
  store.putOrder(order);
  for (const s of shipments) store.putShipment(s);
  store.putCustomer(customer);
  store.putConversation(conversation);
  store.putRisk(risk);
  return { dispute, order, shipments, customer, conversation, risk };
}

type WatchOptions = {
  n?: number;
  order?: Partial<Order>;
  /** Pass null for an order that has not shipped. */
  outbound?: Partial<Shipment> | null;
  returned?: Partial<Shipment>;
  messages?: SupportMessage[];
  risk?: Partial<RiskSignals>;
  customer?: Partial<Customer>;
};

/**
 * A recent order with no dispute, for the Prevention radar. By default it shipped 3 days ago, is
 * still moving (last scan yesterday) and its tracking was never sent to PayPal: one signal only.
 */
export function installWatchedOrder(o: WatchOptions = {}) {
  const n = o.n ?? 5;
  const order = makeOrder({ placed_at: ago(4), ...o.order }, n);
  const outbound =
    o.outbound === null
      ? undefined
      : makeShipment(
          {
            order_id: order.id,
            status: "IN_TRANSIT",
            shipped_at: ago(3),
            delivered_at: undefined,
            delivered_to: undefined,
            signature: undefined,
            pushed_to_paypal: false,
            events: [
              { at: ago(3), location: "Brooklyn, NY", description: "Picked up", code: "PICKUP" },
              { at: ago(1), location: "Chicago, IL", description: "Departed facility", code: "TRANSIT" },
            ],
            ...o.outbound,
          },
          n,
        );
  const returned = o.returned ? makeShipment({ id: `RTN-9000${n}`, order_id: order.id, direction: "RETURN", pushed_to_paypal: true, signature: undefined, ...o.returned }, n) : undefined;
  store.putOrder(order);
  for (const s of [outbound, returned]) if (s) store.putShipment(s);
  store.putCustomer(makeCustomer({ email: order.customer_email, order_ids: [order.id, "KA-OLD-A", "KA-OLD-B"], ...o.customer }, n));
  store.putConversation({ order_id: order.id, messages: o.messages ?? [] });
  store.putRisk(makeRisk({ order_id: order.id, ...o.risk }, n));
  return { order, outbound, returned };
}

export const caseFileOf = (kit: CaseKit) => caseFile(kit.dispute);

/** A well-formed FIGHT brief whose every ref resolves against the fixture case. */
export function makeBrief(kit: CaseKit, over: Partial<CaseBrief> = {}): CaseBrief {
  const ship = kit.shipments[0];
  const shipRef = ship ? refs.shipment(ship.id) : refs.order(kit.order.id);
  return {
    decision: "FIGHT",
    headline: "Signed for at the door: fight with proof of delivery",
    summary: "UPS delivered to the PayPal transaction address and the household signed for it.",
    win_likelihood: 90,
    confidence: "HIGH",
    reasoning: [
      { point: "UPS shows delivery to the transaction address.", refs: [shipRef, refs.order(kit.order.id)] },
      { point: "The buyer wrote to the store about this order before the dispute.", refs: [refs.dispute(kit.dispute.dispute_id)] },
    ],
    risks: [],
    missing_evidence: [],
    exhibits: [
      { label: "A", title: "UPS delivery record", ref: shipRef, why: "Delivered and signed." },
      { label: "B", title: "Order record", ref: refs.order(kit.order.id), why: "The shipping address matches." },
    ],
    paypal_action: { type: "provide_evidence", evidence_types: ["PROOF_OF_FULFILLMENT"], tracking_ref: shipRef },
    response_letter: `Order ${kit.order.id} was delivered and signed for at the transaction address (Exhibit A).`,
    buyer_message: null,
    ...over,
  };
}

/** A well-formed brief whose PayPal action is `type`, with a decision that matches it. */
export function makeBriefFor(kit: CaseKit, type: ActionType, over: Partial<CaseBrief> = {}): CaseBrief {
  const brief = makeBrief(kit);
  const shipRef = kit.shipments[0] ? refs.shipment(kit.shipments[0].id) : undefined;
  const buyer = { language: "en", text: "Hi Ada, here is an update on your order." };
  const by: Record<ActionType, Partial<CaseBrief>> = {
    provide_evidence: { decision: "FIGHT", paypal_action: { type, evidence_types: ["PROOF_OF_FULFILLMENT"], tracking_ref: shipRef } },
    provide_supporting_info: { decision: "FIGHT", paypal_action: { type } },
    make_offer: { decision: "OFFER", paypal_action: { type, offer_type: "REFUND", amount: 20 }, buyer_message: buyer },
    accept_claim: { decision: "REFUND", paypal_action: { type }, win_likelihood: 5 },
    refund_then_prove: { decision: "REFUND", paypal_action: { type } },
    send_message: { decision: "MESSAGE_BUYER", paypal_action: { type }, buyer_message: buyer },
  };
  return { ...brief, ...by[type], ...over };
}

/** Stores a finished agent run, the way runAgent does, without running an agent. */
export function insertRun(disputeId: string, brief: CaseBrief | null, o: { status?: "done" | "error" | "running"; startedAt?: string } = {}) {
  const id = `run_${randomUUID().slice(0, 12)}`;
  const at = o.startedAt ?? new Date().toISOString();
  db()
    .prepare("INSERT INTO runs (id, dispute_id, provider, model, status, started_at, finished_at, events, brief) VALUES (?, ?, 'replay', 'recorded', ?, ?, ?, '[]', ?)")
    .run(id, disputeId, o.status ?? "done", at, at, brief ? JSON.stringify(brief) : null);
  return id;
}

export function toolContext(disputeId: string) {
  const events: AgentEvent[] = [];
  const ctx: ToolContext = { disputeId, emit: (e) => events.push(e) };
  return { ctx, events };
}

/** Rows the app wrote to `actions` (every PayPal action it took on a dispute). */
export function recordedActions(disputeId?: string) {
  const rows = disputeId ? db().prepare("SELECT * FROM actions WHERE dispute_id = ?").all(disputeId) : db().prepare("SELECT * FROM actions").all();
  return rows as { id: string; dispute_id: string; kind: string; actor: string; request: string | null; response: string | null; status: string }[];
}

/** Every PayPal API call the client logged, newest first (the sandbox "API log" in the UI). */
export function paypalCalls() {
  return (db().prepare("SELECT message, meta FROM activity WHERE kind = 'api' ORDER BY id").all() as { message: string; meta: string }[]).map((r) => ({ message: r.message, ...(JSON.parse(r.meta) as { method: string; path: string; status: number }) }));
}

/** Everything that would show an action ran: PayPal's copy of the dispute, our action log, and any PayPal write call. */
export function footprint(disputeId: string) {
  const dispute = simGet(disputeId);
  return {
    paypalStatus: dispute?.status,
    paypalCopy: createHash("sha256").update(JSON.stringify(dispute)).digest("hex").slice(0, 12), // a hash keeps a failing diff readable
    actions: recordedActions().length,
    paypalWrites: paypalCalls().filter((c) => c.method !== "GET" && c.path !== "/v1/oauth2/token").length,
  };
}
