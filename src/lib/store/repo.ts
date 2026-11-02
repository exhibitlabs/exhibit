import "server-only";
import { docGet, docList, docPut } from "../db";
import type { Dispute } from "../paypal/types";
import { MERCHANT, POLICIES, PRODUCTS } from "./scenarios";
import type { Conversation, Customer, Order, RiskSignals, Shipment } from "./types";

/** `base` is the clock the case was seeded with; recorded runs shift their dates to match it. */
export type ScenarioMeta = { dispute_id: string; key: string; title: string; order_id: string; expectedOutcome: "SELLER_FAVOR" | "BUYER_FAVOR"; base?: string };
export type HistoryCase = { dispute_id: string; reason: Dispute["reason"]; amount: number; outcome: string; closed_at: string; handled_by: string };

export const store = {
  merchant: () => MERCHANT,
  policies: () => POLICIES,
  policy: (id: string) => POLICIES.find((p) => p.id === id),
  products: () => PRODUCTS,
  product: (sku: string) => PRODUCTS.find((p) => p.sku === sku),

  putOrder: (o: Order) => docPut("order", o.id, o),
  putShipment: (s: Shipment) => docPut("shipment", s.id, s),
  putCustomer: (c: Customer) => docPut("customer", c.email, c),
  putConversation: (c: Conversation) => docPut("conversation", c.order_id, c),
  putRisk: (r: RiskSignals) => docPut("risk", r.order_id, r),
  putScenario: (m: ScenarioMeta) => docPut("scenario", m.dispute_id, m),
  putHistory: (h: HistoryCase) => docPut("history", h.dispute_id, h),

  order: (id: string) => docGet<Order>("order", id),
  orders: () => docList<Order>("order"),
  shipment: (id: string) => docGet<Shipment>("shipment", id),
  shipments: () => docList<Shipment>("shipment"),
  shipmentsFor: (orderId: string) => docList<Shipment>("shipment").filter((s) => s.order_id === orderId),
  customer: (email: string) => docGet<Customer>("customer", email),
  conversation: (orderId: string) => docGet<Conversation>("conversation", orderId),
  risk: (orderId: string) => docGet<RiskSignals>("risk", orderId),
  scenario: (disputeId: string) => docGet<ScenarioMeta>("scenario", disputeId),
  history: () => docList<HistoryCase>("history"),

  /** Joins a PayPal dispute to the store order: capture id first, then the invoice number we send as invoice_id. */
  orderForDispute(d: Pick<Dispute, "disputed_transactions">): Order | undefined {
    const t = d.disputed_transactions?.[0];
    if (!t) return undefined;
    const all = docList<Order>("order");
    return (
      all.find((o) => o.paypal.capture_id === t.seller_transaction_id) ??
      (t.invoice_number ? all.find((o) => o.paypal.invoice_id === t.invoice_number || o.id === t.invoice_number) : undefined)
    );
  },
};
