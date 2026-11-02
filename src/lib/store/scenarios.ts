// The demo merchant: Kora Atelier, a small leather-goods studio. Every dispute below is a
// realistic case shape with the store, carrier and risk records an investigator would pull.
// Dates are relative to the moment of seeding so the demo inbox always looks live.

import type { Dispute, DisputeReason, DisputeStage, DisputeStatus } from "../paypal/types";
import type { Address, Conversation, Customer, Merchant, Order, Policy, Product, RiskSignals, Shipment } from "./types";

export const MERCHANT: Merchant = {
  name: "Kora Atelier",
  legal_name: "Kora Atelier LLC",
  email: "studio@koraatelier.example",
  website: "koraatelier.example",
  address: { name: "Kora Atelier LLC", line1: "68 Jay Street, Suite 402", city: "Brooklyn", state: "NY", postal_code: "11201", country: "US" },
  support_hours: "Mon–Fri, 9am–6pm ET",
};

export const POLICIES: Policy[] = [
  {
    id: "returns",
    title: "Returns & Refunds",
    url: "https://koraatelier.example/policies/returns",
    version: "2026-03",
    shown_at_checkout: true,
    body:
      "Unused items in original condition can be returned within 30 days of delivery for a full refund. " +
      "Start a return from your order page; we email a prepaid label for US orders. International buyers pay return shipping unless the item is defective. " +
      "Refunds are issued to the original payment method within 3 business days of the return arriving at our studio. " +
      "Defective or damaged items are repaired, replaced, or refunded at our cost.",
  },
  {
    id: "shipping",
    title: "Shipping",
    url: "https://koraatelier.example/policies/shipping",
    version: "2026-03",
    shown_at_checkout: true,
    body:
      "Orders ship from Brooklyn within 2 business days with full tracking. US orders ship UPS Ground or USPS; international orders ship DHL Express. " +
      "Orders over $250 ship with signature confirmation. Parcel lockers (for example DHL Packstation) are delivered as addressed and held by the carrier for pickup.",
  },
  {
    id: "terms",
    title: "Terms of Sale",
    url: "https://koraatelier.example/policies/terms",
    version: "2026-03",
    shown_at_checkout: true,
    body:
      "Every piece is cut and stitched by hand from full-grain, vegetable-tanned leather. Natural leather varies in tone, grain and markings from hide to hide, " +
      "and colors darken with light and use; product photos are taken in daylight and show a representative hide. These variations are not defects. " +
      "By placing an order you agree to these terms and to the Returns and Shipping policies.",
  },
];

export const PRODUCTS: Product[] = [
  { sku: "KA-WKD-COG", name: "The Weekender in Cognac", price: 284, material: "Full-grain vegetable-tanned leather, solid brass hardware", dimensions: "45 × 28 × 24 cm", color: "Cognac",
    description: "A two-night carry-all with a structured base, interior zip pocket and detachable shoulder strap.", listing_notes: ["Ships with dust bag", "Signature required on delivery"], photos: [{ caption: "Front, daylight", tone: "#9a5b2e" }, { caption: "Interior", tone: "#7a4523" }] },
  { sku: "KA-TOT-TAN", name: "Market Tote in Tan", price: 142, material: "Full-grain vegetable-tanned leather", dimensions: "38 × 34 × 12 cm", color: "Tan",
    description: "An unlined everyday tote with hand-stitched handles.", listing_notes: ["Natural leather: tone varies from hide to hide and deepens with use", "Photographed in daylight"], photos: [{ caption: "Front, daylight", tone: "#c08a52" }, { caption: "Hide variation swatches", tone: "#a8743f" }] },
  { sku: "KA-BRF-ESP", name: "Atelier Briefcase in Espresso", price: 420, material: "Full-grain leather, waxed linen thread", dimensions: "40 × 29 × 9 cm", color: "Espresso",
    description: "A slim briefcase with a padded 15-inch laptop sleeve and combination clasp.", listing_notes: ["Signature required on delivery"], photos: [{ caption: "Front", tone: "#3b2418" }] },
  { sku: "KA-WAL-BLK", name: "Bifold Wallet in Black", price: 68, material: "Full-grain leather", dimensions: "11 × 9 cm", color: "Black",
    description: "Six card slots and a full-length bill compartment.", listing_notes: [], photos: [{ caption: "Open", tone: "#1c1b1a" }] },
  { sku: "KA-BLT-COG", name: "Classic Belt in Cognac", price: 96, material: "Bridle leather, solid brass buckle", dimensions: "35 mm width", color: "Cognac",
    description: "A single-piece bridle leather belt, sized to order.", listing_notes: ["Made to order: ships in 2 business days"], photos: [{ caption: "Coiled", tone: "#9a5b2e" }] },
  { sku: "KA-CLU-SND", name: "Weekend Clutch in Sand", price: 180, material: "Suede-lined full-grain leather", dimensions: "30 × 20 cm", color: "Sand",
    description: "A soft clutch with a magnetic flap.", listing_notes: [], photos: [{ caption: "Front", tone: "#d9c3a0" }] },
  { sku: "KA-MSG-OLV", name: "Messenger Satchel in Olive", price: 212, material: "Full-grain leather, cotton canvas lining", dimensions: "36 × 27 × 10 cm", color: "Olive",
    description: "A cross-body satchel with an adjustable strap and two front pockets.", listing_notes: [], photos: [{ caption: "Front", tone: "#5b5a32" }] },
  { sku: "KA-DUF-CHS", name: "Travel Duffle in Chestnut", price: 355, material: "Full-grain leather, solid brass rings", dimensions: "52 × 28 × 28 cm", color: "Chestnut",
    description: "A soft duffle with a shoe compartment and detachable strap.", listing_notes: ["Quality-checked and photographed before dispatch"], photos: [{ caption: "Front", tone: "#6b3a1f" }] },
];

const product = (sku: string) => {
  const p = PRODUCTS.find((x) => x.sku === sku);
  if (!p) throw new Error(`unknown sku ${sku}`);
  return p;
};

type Clock = { at: (days: number, hour?: number, minute?: number) => string };

function clock(base: Date): Clock {
  return {
    at(days, hour = 12, minute = 0) {
      const d = new Date(base);
      d.setUTCDate(d.getUTCDate() + days);
      d.setUTCHours(hour, minute, 0, 0);
      return d.toISOString().replace(".000Z", "Z");
    },
  };
}

export type ScenarioRecords = {
  key: string;
  title: string;
  dispute: Dispute;
  order: Order;
  shipments: Shipment[];
  customer: Customer;
  conversation: Conversation;
  risk: RiskSignals;
  /** Visa reason code used when seeding this case as a sandbox chargeback. */
  chargebackReasonCode: string;
  /** What PayPal is expected to decide if the merchant responds the way the playbook suggests. */
  expectedOutcome: "SELLER_FAVOR" | "BUYER_FAVOR";
};

type ScenarioInput = {
  key: string;
  title: string;
  disputeId: string;
  txn: string;
  orderNo: string;
  reason: DisputeReason;
  stage: DisputeStage;
  status: DisputeStatus;
  channel: "INTERNAL" | "EXTERNAL";
  externalReasonCode?: string;
  createdDaysAgo: number;
  dueInDays: number;
  sku: string;
  qty?: number;
  amount?: number;
  shipping: Address;
  billing?: Address;
  buyer: { name: string; email: string; country: string; firstOrderDaysAgo: number; priorOrders: number; ltv: number; priorDisputes: number; notes?: string };
  shipment: Omit<Shipment, "id" | "order_id" | "pushed_to_paypal" | "shipped_at" | "events" | "delivered_at" | "signature"> & {
    shippedDaysAgo: number;
    deliveredDaysAgo?: number;
    signature?: string;
    events: [number, string, string, Shipment["events"][number]["code"]][];
    pushedToPayPal?: boolean;
  };
  returnShipment?: ScenarioInput["shipment"];
  messages: { daysAgo: number; from: "customer" | "merchant"; channel?: "email" | "chat"; subject?: string; body: string; language?: string }[];
  disputeMessages?: { daysAgo: number; body: string }[];
  risk: Omit<RiskSignals, "order_id">;
  requestedEvidence: string[];
  offerTypes?: Dispute["allowed_response_options"];
  subReasons?: string[];
  chargebackReasonCode: string;
  expectedOutcome: "SELLER_FAVOR" | "BUYER_FAVOR";
  funding?: "PAYPAL" | "CARD";
  refunds?: { id: string; amount: number; daysAgo: number }[];
};

const CARRIER_URL: Record<Shipment["carrier"], (n: string) => string> = {
  UPS: (n) => `https://www.ups.com/track?tracknum=${n}`,
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  FEDEX: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  DHL: (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${n}`,
  DHL_DEUTSCHE_POST: (n) => `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${n}`,
  ROYAL_MAIL: (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${n}`,
};

function build(c: Clock, s: ScenarioInput): ScenarioRecords {
  const p = product(s.sku);
  const qty = s.qty ?? 1;
  const subtotal = p.price * qty;
  const shippingCost = s.shipping.country === "US" ? 0 : 24;
  const total = s.amount ?? subtotal + shippingCost;
  const placedAt = c.at(-s.shipment.shippedDaysAgo - 1, 15, 12);
  const orderId = `KA-${s.orderNo}`;
  const shipmentId = `SHP-${s.orderNo}`;
  const mkShipment = (id: string, direction: Shipment["direction"], sh: ScenarioInput["shipment"]): Shipment => ({
    id,
    order_id: orderId,
    direction,
    carrier: sh.carrier,
    service: sh.service,
    tracking_number: sh.tracking_number,
    tracking_url: sh.tracking_url || CARRIER_URL[sh.carrier](sh.tracking_number),
    status: sh.status,
    delivered_to: sh.delivered_to,
    delivery_photo: sh.delivery_photo,
    qc_photo: sh.qc_photo,
    shipped_at: c.at(-sh.shippedDaysAgo, Math.min(8 + 2 * Math.max(0, sh.events.findIndex((e) => e[3] === "PICKUP")), 15), (Math.max(0, sh.events.findIndex((e) => e[3] === "PICKUP")) * 17) % 60),
    delivered_at: sh.deliveredDaysAgo !== undefined ? c.at(-sh.deliveredDaysAgo, 16, 52) : undefined,
    signature: sh.signature && sh.deliveredDaysAgo !== undefined ? { name: sh.signature, at: c.at(-sh.deliveredDaysAgo, 16, 52) } : undefined,
    // Scan times rise through the day; the delivery scan uses the carrier's recorded delivery time.
    events: sh.events.map(([d, location, description, code], i) =>
      code === "DELIVERED" && sh.deliveredDaysAgo === d
        ? { at: c.at(-d, 16, 52), location, description, code }
        : { at: c.at(-d, Math.min(8 + i * 2, 15), (i * 17) % 60), location, description, code },
    ),
    pushed_to_paypal: sh.pushedToPayPal ?? true,
  });
  const shipments = [mkShipment(shipmentId, "OUTBOUND", s.shipment)];
  if (s.returnShipment) shipments.push(mkShipment(`RTN-${s.orderNo}`, "RETURN", s.returnShipment));

  const order: Order = {
    id: orderId,
    placed_at: placedAt,
    currency: "USD",
    customer_email: s.buyer.email,
    items: [{ sku: p.sku, name: p.name, qty, unit_price: p.price }],
    subtotal,
    shipping_cost: shippingCost,
    tax: 0,
    total,
    shipping_address: s.shipping,
    billing_address: s.billing,
    shipping_method: s.shipment.service,
    paypal: { order_id: `5O${s.txn.slice(2, 16)}`, capture_id: s.txn, invoice_id: orderId, funding: s.funding ?? "PAYPAL" },
    checkout: { ip: s.risk.ip.address, user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 19_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1", accepted_terms_at: placedAt, policies_version: "2026-03" },
    shipment_ids: shipments.map((x) => x.id),
    refunds: s.refunds?.map((r) => ({ id: r.id, amount: r.amount, at: c.at(-r.daysAgo) })),
  };

  const dispute: Dispute = {
    dispute_id: s.disputeId,
    create_time: c.at(-s.createdDaysAgo, 9, 31),
    update_time: c.at(-Math.max(0, s.createdDaysAgo - 1), 10, 2),
    disputed_transactions: [
      {
        buyer_transaction_id: `9B${s.txn.slice(2)}`,
        seller_transaction_id: s.txn,
        create_time: placedAt,
        transaction_status: "COMPLETED",
        gross_amount: { currency_code: "USD", value: total.toFixed(2) },
        invoice_number: orderId,
        buyer: { name: s.buyer.name, email: s.buyer.email },
        seller: { email: MERCHANT.email, merchant_id: "KORAATELIER01", name: MERCHANT.name },
        items: [{ item_id: p.sku, item_name: p.name, item_quantity: String(qty), reason: s.reason }],
      },
    ],
    reason: s.reason,
    status: s.status,
    dispute_amount: { currency_code: "USD", value: total.toFixed(2) },
    external_reason_code: s.externalReasonCode,
    dispute_life_cycle_stage: s.stage,
    dispute_channel: s.channel,
    messages: (s.disputeMessages ?? []).map((m) => ({ posted_by: "BUYER" as const, time_posted: c.at(-m.daysAgo, 9, 40), content: m.body })),
    extensions: s.subReasons
      ? { merchant_contacted: s.messages.some((m) => m.from === "customer"), merchandize_dispute_properties: { issue_type: "PRODUCT", product_details: { product_received: "YES", sub_reasons: s.subReasons } } }
      : { merchant_contacted: s.messages.some((m) => m.from === "customer") },
    evidences: s.requestedEvidence.map((t) => ({ evidence_type: t, source: "REQUESTED_FROM_SELLER" as const })),
    seller_response_due_date: c.at(s.dueInDays, 23, 59),
    allowed_response_options: s.offerTypes,
    links: [],
  };

  const customer: Customer = {
    email: s.buyer.email,
    name: s.buyer.name,
    country: s.buyer.country,
    first_order_at: c.at(-s.buyer.firstOrderDaysAgo),
    order_ids: [orderId, ...Array.from({ length: s.buyer.priorOrders }, (_, i) => `KA-${Number(s.orderNo) - 900 - i * 137}`)],
    lifetime_value: s.buyer.ltv,
    prior_disputes: s.buyer.priorDisputes,
    notes: s.buyer.notes,
  };

  const conversation: Conversation = {
    order_id: orderId,
    messages: s.messages.map((m, i) => ({ id: `MSG-${s.orderNo}-${i + 1}`, at: c.at(-m.daysAgo, 13 + i, 5), from: m.from, channel: m.channel ?? "email", subject: m.subject, body: m.body, language: m.language ?? "en" })),
  };

  return {
    key: s.key,
    title: s.title,
    dispute,
    order,
    shipments,
    customer,
    conversation,
    risk: { order_id: orderId, ...s.risk },
    chargebackReasonCode: s.chargebackReasonCode,
    expectedOutcome: s.expectedOutcome,
  };
}

const addr = (name: string, line1: string, city: string, state: string | undefined, postal: string, country: string, line2?: string): Address => ({ name, line1, line2, city, state, postal_code: postal, country });

export function buildScenarios(base = new Date()): ScenarioRecords[] {
  const c = clock(base);
  const hale = addr("Megan Hale", "2207 Cedar Bend Dr", "Austin", "TX", "78758", "US");
  const grant = addr("Oliver Grant", "14 Albion Road", "London", undefined, "N16 9PH", "GB");
  const reyes = addr("Daniel Reyes", "481 Oak Park Ave", "Columbus", "OH", "43215", "US");
  const kim = addr("Jordan Kim", "77 Ridgewood Ct", "Portland", "OR", "97205", "US");
  const brooksGift = addr("Ethan Brooks", "2650 Larimer St", "Denver", "CO", "80205", "US");
  const patel = addr("Priya Patel", "39 Maple Lane", "Edison", "NJ", "08817", "US");
  const vogel = addr("Lena Vogel", "Packstation 128", "Berlin", undefined, "10405", "DE", "PostNummer 41827793");
  const ortiz = addr("Sam Ortiz", "1180 Mission Rd", "San Diego", "CA", "92103", "US");

  return [
    build(c, {
      key: "inr-delivered-signed",
      title: "Says it never arrived, but UPS shows a signed delivery",
      disputeId: "PP-D-50211", txn: "4KD68427R6189540B", orderNo: "10482",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED", stage: "CHARGEBACK", status: "WAITING_FOR_SELLER_RESPONSE", channel: "INTERNAL",
      createdDaysAgo: 2, dueInDays: 8, sku: "KA-WKD-COG", shipping: hale,
      buyer: { name: "Megan Hale", email: "megan.hale@example.com", country: "US", firstOrderDaysAgo: 410, priorOrders: 3, ltv: 618, priorDisputes: 0 },
      shipment: { direction: "OUTBOUND", carrier: "UPS", service: "UPS Ground, signature required", tracking_number: "1Z84V6A90392847516", tracking_url: "", status: "DELIVERED",
        delivered_to: hale, signature: "M. HALE", delivery_photo: "Parcel at front door of 2207 Cedar Bend Dr, house number visible", shippedDaysAgo: 19, deliveredDaysAgo: 15,
        events: [[19, "Brooklyn, NY", "Label created", "LABEL"], [19, "Brooklyn, NY", "Picked up", "PICKUP"], [17, "Dallas, TX", "Arrived at facility", "TRANSIT"], [15, "Austin, TX", "Out for delivery", "OUT_FOR_DELIVERY"], [15, "Austin, TX 78758", "Delivered — signed by M. HALE, front door", "DELIVERED"]] },
      messages: [],
      disputeMessages: [{ daysAgo: 2, body: "I never received my bag. It has been over two weeks." }],
      risk: { avs_result: "Y", cvv_result: "M", three_ds: "NONE", ip: { address: "71.42.118.20", city: "Austin", region: "TX", country: "US" }, ip_to_shipping_km: 6, device: { id: "dv_8f2a", seen_before: true, first_seen: c.at(-410) }, email_age_days: 2900, orders_last_24h: 1 },
      requestedEvidence: ["PROOF_OF_FULFILLMENT"],
      chargebackReasonCode: "1310", expectedOutcome: "SELLER_FAVOR",
    }),
    build(c, {
      key: "snad-color",
      title: "“Darker than the photos”: natural leather variation",
      disputeId: "PP-D-50214", txn: "8MN20476KT3315922", orderNo: "10497",
      reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED", stage: "INQUIRY", status: "WAITING_FOR_SELLER_RESPONSE", channel: "INTERNAL",
      createdDaysAgo: 1, dueInDays: 9, sku: "KA-TOT-TAN", shipping: grant, subReasons: ["DIFFERENT"],
      buyer: { name: "Oliver Grant", email: "oliver.grant@example.co.uk", country: "GB", firstOrderDaysAgo: 22, priorOrders: 0, ltv: 166, priorDisputes: 0 },
      shipment: { direction: "OUTBOUND", carrier: "DHL", service: "DHL Express Worldwide", tracking_number: "4419283746", tracking_url: "", status: "DELIVERED", delivered_to: grant,
        shippedDaysAgo: 12, deliveredDaysAgo: 8, events: [[12, "New York, NY", "Shipment picked up", "PICKUP"], [11, "Cincinnati Hub, OH", "Departed facility", "TRANSIT"], [9, "London Heathrow, GB", "Customs cleared", "TRANSIT"], [8, "London N16, GB", "Delivered", "DELIVERED"]] },
      messages: [
        { daysAgo: 7, from: "customer", subject: "Tote colour", body: "Hi — the tote arrived today. It's lovely but noticeably darker and browner than the tan in your photos. Not sure I want to keep it." },
        { daysAgo: 6, from: "merchant", subject: "Re: Tote colour", body: "Thanks Oliver! Vegetable-tanned hides vary and our photos are shot in daylight. Happy to help either way — would a partial refund or a return suit you better?" },
      ],
      disputeMessages: [{ daysAgo: 1, body: "The colour is much darker than the product photos. It looks brown, not tan." }],
      risk: { avs_result: "U", cvv_result: "U", three_ds: "NONE", ip: { address: "86.12.44.201", city: "London", country: "GB" }, ip_to_shipping_km: 3, device: { id: "dv_31cc", seen_before: false, first_seen: c.at(-22) }, email_age_days: 1640, orders_last_24h: 1 },
      requestedEvidence: [],
      offerTypes: { make_offer: { offer_types: ["REFUND", "REFUND_WITH_RETURN"] }, accept_claim: { accept_claim_types: ["REFUND", "REFUND_WITH_RETURN"] } },
      chargebackReasonCode: "1330", expectedOutcome: "BUYER_FAVOR",
    }),
    build(c, {
      key: "unauth-friendly-fraud",
      title: "Card “unauthorized”, yet AVS, CVV and 3-D Secure all passed",
      disputeId: "PP-D-50219", txn: "2HT58193LQ0047731", orderNo: "10503",
      reason: "UNAUTHORISED", stage: "CHARGEBACK", status: "WAITING_FOR_SELLER_RESPONSE", channel: "EXTERNAL", externalReasonCode: "10.4",
      createdDaysAgo: 3, dueInDays: 1, sku: "KA-BRF-ESP", shipping: reyes, billing: reyes, funding: "CARD",
      buyer: { name: "Daniel Reyes", email: "d.reyes@example.com", country: "US", firstOrderDaysAgo: 260, priorOrders: 2, ltv: 664, priorDisputes: 0 },
      shipment: { direction: "OUTBOUND", carrier: "UPS", service: "UPS 2nd Day Air, signature required", tracking_number: "1Z84V6A90298355102", tracking_url: "", status: "DELIVERED", delivered_to: reyes, signature: "D REYES",
        shippedDaysAgo: 24, deliveredDaysAgo: 22, events: [[24, "Brooklyn, NY", "Picked up", "PICKUP"], [23, "Louisville, KY", "Departed facility", "TRANSIT"], [22, "Columbus, OH 43215", "Delivered — signed by D REYES", "DELIVERED"]] },
      messages: [{ daysAgo: 21, from: "customer", channel: "chat", body: "Briefcase arrived, it's beautiful. Does the combination lock come set to 000?" }, { daysAgo: 21, from: "merchant", channel: "chat", body: "Yes — 000 out of the box. Instructions to reset it are on the card in the inner pocket." }],
      risk: { avs_result: "Y", cvv_result: "M", three_ds: "AUTHENTICATED", ip: { address: "73.88.201.14", city: "Columbus", region: "OH", country: "US" }, ip_to_shipping_km: 4, device: { id: "dv_aa07", seen_before: true, first_seen: c.at(-260) }, email_age_days: 3400, orders_last_24h: 1 },
      requestedEvidence: ["PROOF_OF_FULFILLMENT", "OTHER"],
      chargebackReasonCode: "1040", expectedOutcome: "SELLER_FAVOR",
    }),
    build(c, {
      key: "inr-returned-to-sender",
      title: "Never arrived, and USPS really did return it to us",
      disputeId: "PP-D-50223", txn: "6WX14709PA8802164", orderNo: "10511",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED", stage: "CHARGEBACK", status: "WAITING_FOR_SELLER_RESPONSE", channel: "INTERNAL",
      createdDaysAgo: 1, dueInDays: 9, sku: "KA-WAL-BLK", shipping: kim,
      buyer: { name: "Jordan Kim", email: "jordan.kim@example.com", country: "US", firstOrderDaysAgo: 30, priorOrders: 0, ltv: 68, priorDisputes: 0 },
      shipment: { direction: "OUTBOUND", carrier: "USPS", service: "USPS Ground Advantage", tracking_number: "9400111899223847569021", tracking_url: "", status: "RETURNED_TO_SENDER",
        shippedDaysAgo: 27, events: [[27, "Brooklyn, NY 11201", "Shipping label created", "LABEL"], [26, "Brooklyn, NY", "Accepted at USPS origin facility", "PICKUP"], [22, "Portland, OR 97205", "Undeliverable as addressed — no such number", "EXCEPTION"], [14, "Brooklyn, NY 11201", "Delivered to sender (return)", "RETURNED"]] },
      messages: [{ daysAgo: 12, from: "customer", subject: "Where is my wallet?", body: "Tracking hasn't moved in ages. Can you check?" }],
      disputeMessages: [{ daysAgo: 1, body: "Never got my wallet and no reply to my email." }],
      risk: { avs_result: "Y", cvv_result: "M", three_ds: "NONE", ip: { address: "24.20.150.9", city: "Portland", region: "OR", country: "US" }, ip_to_shipping_km: 2, device: { id: "dv_7d19", seen_before: false, first_seen: c.at(-30) }, email_age_days: 1200, orders_last_24h: 1 },
      requestedEvidence: ["PROOF_OF_FULFILLMENT"],
      offerTypes: { accept_claim: { accept_claim_types: ["REFUND"] } },
      chargebackReasonCode: "1310", expectedOutcome: "BUYER_FAVOR",
    }),
    build(c, {
      key: "duplicate-two-orders",
      title: "“Charged twice”: two orders, two addresses, both delivered",
      disputeId: "PP-D-50227", txn: "3FL90265HC7741208", orderNo: "10519",
      reason: "DUPLICATE_TRANSACTION", stage: "CHARGEBACK", status: "WAITING_FOR_SELLER_RESPONSE", channel: "INTERNAL",
      createdDaysAgo: 4, dueInDays: 2, sku: "KA-BLT-COG", shipping: brooksGift,
      buyer: { name: "Aaron Brooks", email: "aaron.brooks@example.com", country: "US", firstOrderDaysAgo: 18, priorOrders: 1, ltv: 192, priorDisputes: 0, notes: "Placed KA-10518 (to self, Seattle) and KA-10519 (gift to Ethan Brooks, Denver) eleven minutes apart." },
      shipment: { direction: "OUTBOUND", carrier: "UPS", service: "UPS Ground", tracking_number: "1Z84V6A90311046229", tracking_url: "", status: "DELIVERED", delivered_to: brooksGift,
        shippedDaysAgo: 16, deliveredDaysAgo: 12, events: [[16, "Brooklyn, NY", "Picked up", "PICKUP"], [14, "Hodgkins, IL", "Departed facility", "TRANSIT"], [12, "Denver, CO 80205", "Delivered — front porch", "DELIVERED"]] },
      messages: [{ daysAgo: 18, from: "customer", subject: "Second belt is a gift", body: "Just ordered a second belt for my brother in Denver — could you include a gift note that says 'Happy 30th, E'?" }, { daysAgo: 18, from: "merchant", subject: "Re: Second belt is a gift", body: "Done — gift note added to order KA-10519. Happy birthday to Ethan!" }],
      disputeMessages: [{ daysAgo: 4, body: "I was charged $96 twice for the same belt." }],
      risk: { avs_result: "Y", cvv_result: "M", three_ds: "NONE", ip: { address: "98.97.12.77", city: "Seattle", region: "WA", country: "US" }, ip_to_shipping_km: 1640, device: { id: "dv_b1e3", seen_before: true, first_seen: c.at(-18) }, email_age_days: 2100, orders_last_24h: 2 },
      requestedEvidence: ["OTHER"],
      chargebackReasonCode: "1261", expectedOutcome: "SELLER_FAVOR",
    }),
    build(c, {
      key: "credit-not-processed",
      title: "Return arrived 4 days ago, refund still not issued",
      disputeId: "PP-D-50231", txn: "7RB33058ND1156690", orderNo: "10466",
      reason: "CREDIT_NOT_PROCESSED", stage: "CHARGEBACK", status: "WAITING_FOR_SELLER_RESPONSE", channel: "INTERNAL",
      createdDaysAgo: 1, dueInDays: 9, sku: "KA-CLU-SND", shipping: patel,
      buyer: { name: "Priya Patel", email: "priya.patel@example.com", country: "US", firstOrderDaysAgo: 540, priorOrders: 4, ltv: 905, priorDisputes: 0 },
      shipment: { direction: "OUTBOUND", carrier: "UPS", service: "UPS Ground", tracking_number: "1Z84V6A90277390018", tracking_url: "", status: "DELIVERED", delivered_to: patel,
        shippedDaysAgo: 34, deliveredDaysAgo: 31, events: [[34, "Brooklyn, NY", "Picked up", "PICKUP"], [31, "Edison, NJ 08817", "Delivered", "DELIVERED"]] },
      returnShipment: { direction: "RETURN", carrier: "UPS", service: "UPS Ground (prepaid return label)", tracking_number: "1Z84V6A99013377240", tracking_url: "", status: "DELIVERED", delivered_to: { ...MERCHANT.address },
        shippedDaysAgo: 8, deliveredDaysAgo: 4, events: [[8, "Edison, NJ", "Return picked up", "PICKUP"], [4, "Brooklyn, NY 11201", "Delivered to Kora Atelier — received by K. NAIR", "DELIVERED"]] },
      messages: [
        { daysAgo: 10, from: "customer", subject: "Return KA-10466", body: "Starting a return — the clutch is too small for my phone. Label please?" },
        { daysAgo: 10, from: "merchant", subject: "Re: Return KA-10466", body: "Of course — prepaid UPS label attached. We refund within 3 business days of it arriving." },
        { daysAgo: 2, from: "customer", subject: "Re: Return KA-10466", body: "UPS says you got it on the weekend. Still no refund?" },
      ],
      disputeMessages: [{ daysAgo: 1, body: "Returned the item, merchant received it, no refund." }],
      risk: { avs_result: "Y", cvv_result: "M", three_ds: "NONE", ip: { address: "68.36.9.140", city: "Edison", region: "NJ", country: "US" }, ip_to_shipping_km: 3, device: { id: "dv_5530", seen_before: true, first_seen: c.at(-540) }, email_age_days: 4100, orders_last_24h: 1 },
      requestedEvidence: ["PROOF_OF_REFUND"],
      offerTypes: { accept_claim: { accept_claim_types: ["REFUND"] } },
      chargebackReasonCode: "1360", expectedOutcome: "BUYER_FAVOR",
    }),
    build(c, {
      key: "inquiry-packstation-de",
      title: "German buyer says “zugestellt” but empty-handed: it's in her Packstation",
      disputeId: "PP-D-50236", txn: "5JC71842VW2290035", orderNo: "10524",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED", stage: "INQUIRY", status: "WAITING_FOR_SELLER_RESPONSE", channel: "INTERNAL",
      createdDaysAgo: 0, dueInDays: 10, sku: "KA-MSG-OLV", shipping: vogel,
      buyer: { name: "Lena Vogel", email: "lena.vogel@example.de", country: "DE", firstOrderDaysAgo: 9, priorOrders: 0, ltv: 236, priorDisputes: 0 },
      shipment: { direction: "OUTBOUND", carrier: "DHL_DEUTSCHE_POST", service: "DHL Express → DHL Paket (Packstation)", tracking_number: "00340434161094042557", tracking_url: "", status: "DELIVERED", delivered_to: vogel,
        shippedDaysAgo: 7, deliveredDaysAgo: 2, events: [[7, "New York, NY", "Shipment picked up", "PICKUP"], [5, "Leipzig, DE", "Customs cleared", "TRANSIT"], [3, "Berlin, DE", "In delivery vehicle", "OUT_FOR_DELIVERY"], [2, "Packstation 128, 10405 Berlin", "Zugestellt in Packstation 128 — Abholcode per E-Mail/App versendet. Lagerfrist: 7 Tage.", "DELIVERED"]] },
      messages: [],
      disputeMessages: [{ daysAgo: 0, body: "Hallo, mein Paket ist nie angekommen. Die Sendungsverfolgung zeigt „zugestellt“, aber ich habe nichts erhalten. Ich bin sehr enttäuscht." }],
      risk: { avs_result: "U", cvv_result: "U", three_ds: "NONE", ip: { address: "91.64.33.8", city: "Berlin", country: "DE" }, ip_to_shipping_km: 2, device: { id: "dv_e6f0", seen_before: false, first_seen: c.at(-9) }, email_age_days: 980, orders_last_24h: 1 },
      requestedEvidence: [],
      offerTypes: { make_offer: { offer_types: ["REFUND"] } },
      chargebackReasonCode: "1310", expectedOutcome: "SELLER_FAVOR",
    }),
    build(c, {
      key: "snad-damaged-ring",
      title: "Strap ring arrived broken, but the QC photo shows it intact",
      disputeId: "PP-D-50240", txn: "9QA46620BX5508417", orderNo: "10529",
      reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED", stage: "INQUIRY", status: "WAITING_FOR_SELLER_RESPONSE", channel: "INTERNAL",
      createdDaysAgo: 2, dueInDays: 8, sku: "KA-DUF-CHS", shipping: ortiz, subReasons: ["DAMAGED"],
      buyer: { name: "Sam Ortiz", email: "sam.ortiz@example.com", country: "US", firstOrderDaysAgo: 14, priorOrders: 0, ltv: 355, priorDisputes: 0 },
      shipment: { direction: "OUTBOUND", carrier: "FEDEX", service: "FedEx Home Delivery", tracking_number: "781946335022", tracking_url: "", status: "DELIVERED", delivered_to: ortiz,
        qc_photo: "Pre-dispatch QC photo: both brass strap rings intact, timestamped at packing", shippedDaysAgo: 9, deliveredDaysAgo: 4,
        events: [[9, "Brooklyn, NY", "Picked up", "PICKUP"], [7, "Memphis, TN", "In transit — package handled at hub", "TRANSIT"], [4, "San Diego, CA 92103", "Delivered — left at front door", "DELIVERED"]] },
      messages: [{ daysAgo: 3, from: "customer", subject: "Broken ring on duffle", body: "One of the brass rings for the shoulder strap is cracked through. Photo attached. Bit disappointed for the price." }],
      disputeMessages: [{ daysAgo: 2, body: "Item arrived damaged — strap ring broken so the strap can't be used." }],
      risk: { avs_result: "Y", cvv_result: "M", three_ds: "NONE", ip: { address: "70.181.4.62", city: "San Diego", region: "CA", country: "US" }, ip_to_shipping_km: 5, device: { id: "dv_c44a", seen_before: false, first_seen: c.at(-14) }, email_age_days: 2600, orders_last_24h: 1 },
      requestedEvidence: [],
      offerTypes: { make_offer: { offer_types: ["REFUND", "REFUND_WITH_RETURN", "REFUND_WITH_REPLACEMENT", "REPLACEMENT_WITHOUT_REFUND"] } },
      chargebackReasonCode: "1330", expectedOutcome: "SELLER_FAVOR",
    }),
  ];
}

/** Closed cases that give the dashboard a 90-day history. Amounts are demo data, not benchmarks. */
export function buildHistory(base = new Date()) {
  const c = clock(base);
  return [
    { dispute_id: "PP-D-49870", reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" as const, amount: 198, outcome: "RESOLVED_SELLER_FAVOUR", closed_at: c.at(-12), handled_by: "exhibit" },
    { dispute_id: "PP-D-49812", reason: "UNAUTHORISED" as const, amount: 260, outcome: "RESOLVED_SELLER_FAVOUR", closed_at: c.at(-19), handled_by: "exhibit" },
    { dispute_id: "PP-D-49755", reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" as const, amount: 89, outcome: "RESOLVED_BUYER_FAVOUR", closed_at: c.at(-26), handled_by: "exhibit" },
    { dispute_id: "PP-D-49701", reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" as const, amount: 34, outcome: "RESOLVED_BUYER_FAVOUR", closed_at: c.at(-33), handled_by: "exhibit" },
    { dispute_id: "PP-D-49640", reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED" as const, amount: 142, outcome: "RESOLVED_SELLER_FAVOUR", closed_at: c.at(-41), handled_by: "exhibit" },
    { dispute_id: "PP-D-49588", reason: "DUPLICATE_TRANSACTION" as const, amount: 96, outcome: "RESOLVED_SELLER_FAVOUR", closed_at: c.at(-48), handled_by: "exhibit" },
  ];
}

/** Recent orders without disputes, used by the Protection page. Some never had tracking pushed to PayPal. */
export function buildRecentOrders(base = new Date()): { order: Order; shipment: Shipment }[] {
  const c = clock(base);
  const people: [string, Address][] = [
    ["ava.chen@example.com", addr("Ava Chen", "410 Elm St", "Cambridge", "MA", "02139", "US")],
    ["noah.williams@example.com", addr("Noah Williams", "88 Harbor View", "Charleston", "SC", "29401", "US")],
    ["mia.rossi@example.it", addr("Mia Rossi", "Via Torino 21", "Milano", undefined, "20123", "IT")],
    ["liam.oconnor@example.ie", addr("Liam O'Connor", "5 Grafton Lane", "Dublin", undefined, "D02 X285", "IE")],
    ["sofia.garcia@example.com", addr("Sofia Garcia", "1520 Bayshore Blvd", "Tampa", "FL", "33606", "US")],
    ["ethan.wright@example.com", addr("Ethan Wright", "300 Lakeview Ave", "Chicago", "IL", "60614", "US")],
    ["chloe.martin@example.fr", addr("Chloé Martin", "12 Rue Oberkampf", "Paris", undefined, "75011", "FR")],
    ["lucas.meyer@example.de", addr("Lucas Meyer", "Schillerstraße 9", "München", undefined, "80336", "DE")],
    ["emma.johnson@example.com", addr("Emma Johnson", "742 Evergreen Ter", "Springfield", "IL", "62704", "US")],
    ["kai.tanaka@example.com", addr("Kai Tanaka", "1801 Sunset Blvd", "Los Angeles", "CA", "90026", "US")],
    ["zoe.ahmed@example.co.uk", addr("Zoe Ahmed", "3 Clifton Down", "Bristol", undefined, "BS8 3HT", "GB")],
    ["ben.carter@example.com", addr("Ben Carter", "62 Spring St", "Burlington", "VT", "05401", "US")],
  ];
  const skus = ["KA-WKD-COG", "KA-TOT-TAN", "KA-WAL-BLK", "KA-BLT-COG", "KA-MSG-OLV", "KA-CLU-SND", "KA-DUF-CHS", "KA-BRF-ESP"];
  return people.map(([email, a], i) => {
    const p = product(skus[i % skus.length]);
    const intl = a.country !== "US";
    const n = 10540 + i;
    const shipped = 1 + (i % 6);
    const delivered = shipped > 3 ? shipped - 3 : undefined;
    const carrier: Shipment["carrier"] = intl ? "DHL" : i % 2 ? "UPS" : "USPS";
    const tracking = carrier === "UPS" ? `1Z84V6A9${(40000000 + n * 7919).toString().slice(0, 10)}` : carrier === "USPS" ? `9400111899${(223800000000 + n * 104729).toString()}` : `${(5500000000 + n * 7).toString()}`;
    const order: Order = {
      id: `KA-${n}`,
      placed_at: c.at(-shipped - 1, 14, 20),
      currency: "USD",
      customer_email: email,
      items: [{ sku: p.sku, name: p.name, qty: 1, unit_price: p.price }],
      subtotal: p.price,
      shipping_cost: intl ? 24 : 0,
      tax: 0,
      total: p.price + (intl ? 24 : 0),
      shipping_address: a,
      shipping_method: intl ? "DHL Express Worldwide" : carrier === "UPS" ? "UPS Ground" : "USPS Ground Advantage",
      paypal: { order_id: `5O${(70000000000000 + n * 3571).toString()}`, capture_id: `${(10000000 + n).toString()}PX${(400000 + i * 3331).toString()}${"ABCDEFGHJK"[i % 10]}`, invoice_id: `KA-${n}`, funding: i % 3 === 0 ? "CARD" : "PAYPAL" },
      checkout: { ip: `73.${10 + i}.${40 + i}.${100 + i}`, user_agent: "Mozilla/5.0", accepted_terms_at: c.at(-shipped - 1, 14, 20), policies_version: "2026-03" },
      shipment_ids: [`SHP-${n}`],
    };
    const shipment: Shipment = {
      id: `SHP-${n}`,
      order_id: order.id,
      direction: "OUTBOUND",
      carrier,
      service: order.shipping_method,
      tracking_number: tracking,
      tracking_url: CARRIER_URL[carrier](tracking),
      shipped_at: c.at(-shipped, 18, 30),
      delivered_at: delivered !== undefined ? c.at(-delivered, 15, 10) : undefined,
      status: delivered !== undefined ? "DELIVERED" : "IN_TRANSIT",
      delivered_to: delivered !== undefined ? a : undefined,
      events: [{ at: c.at(-shipped, 18, 30), location: "Brooklyn, NY", description: "Picked up", code: "PICKUP" }],
      // Five of twelve shipments were never synced to PayPal: the gap Protection closes.
      pushed_to_paypal: ![1, 3, 6, 8, 10].includes(i),
    };
    return { order, shipment };
  });
}
