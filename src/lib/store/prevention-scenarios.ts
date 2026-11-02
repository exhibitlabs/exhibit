// Prevention radar demo data: ten recent Kora Atelier orders that have not been disputed yet,
// each carrying the early warning sign that usually comes before a PayPal dispute. Dates are
// relative to seeding, like the rest of the demo store. Read by src/lib/prevention.ts.

import "server-only";
import { PRODUCTS } from "./scenarios";
import { store } from "./repo";
import type { Address, Conversation, Customer, Order, RiskSignals, Shipment, ShipmentEvent } from "./types";

type Clock = (daysAgo: number, hour?: number, minute?: number) => string;

function clock(base: Date): Clock {
  return (daysAgo, hour = 12, minute = 0) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    d.setUTCHours(hour, minute, 0, 0);
    // Never in the future: a "today" scan at 16:00 seeded at 09:00 would read as tomorrow.
    return new Date(Math.min(d.getTime(), base.getTime() - 20 * 60_000)).toISOString().replace(".000Z", "Z");
  };
}

const URL_FOR: Record<Shipment["carrier"], (n: string) => string> = {
  UPS: (n) => `https://www.ups.com/track?tracknum=${n}`,
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  FEDEX: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  DHL: (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${n}`,
  DHL_DEUTSCHE_POST: (n) => `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${n}`,
  ROYAL_MAIL: (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${n}`,
};

const addr = (name: string, line1: string, city: string, state: string | undefined, postal_code: string, country: string, line2?: string): Address => ({ name, line1, line2, city, state, postal_code, country });

type Scan = [daysAgo: number, location: string, description: string, code: ShipmentEvent["code"]];

type Input = {
  no: string;
  sku: string;
  qty?: number;
  placedDaysAgo: number;
  ship: Address;
  billing?: Address;
  funding?: "PAYPAL" | "CARD";
  buyer: { name: string; email: string; country: string; priorOrders?: number; ltv?: number; emailAgeDays?: number };
  outbound?: {
    carrier: Shipment["carrier"];
    service: string;
    tracking: string;
    shippedDaysAgo: number;
    status: Shipment["status"];
    deliveredDaysAgo?: number;
    deliveredTo?: Address;
    signature?: string;
    scans: Scan[];
    onPayPal?: boolean;
  };
  returned?: { carrier: Shipment["carrier"]; tracking: string; shippedDaysAgo: number; deliveredDaysAgo: number; scans: Scan[] };
  messages?: { daysAgo: number; hour?: number; from: "customer" | "merchant"; channel?: "email" | "chat"; subject?: string; body: string; language?: string }[];
  risk?: Partial<Omit<RiskSignals, "order_id">>;
  notes?: string;
};

export type PreventionRecords = { order: Order; shipments: Shipment[]; customer: Customer; conversation: Conversation; risk: RiskSignals };

function build(at: Clock, s: Input): PreventionRecords {
  const p = PRODUCTS.find((x) => x.sku === s.sku);
  if (!p) throw new Error(`unknown sku ${s.sku}`);
  const qty = s.qty ?? 1;
  const intl = s.ship.country !== "US";
  const shippingCost = intl ? 24 : 0;
  const id = `KA-${s.no}`;
  const n = Number(s.no);
  const placed = at(s.placedDaysAgo, 15, 12);
  const scansFor = (scans: Scan[], deliveredDaysAgo?: number): ShipmentEvent[] =>
    scans.map(([d, location, description, code], i) => ({ at: code === "DELIVERED" && d === deliveredDaysAgo ? at(d, 16, 52) : at(d, Math.min(8 + i * 2, 20), (i * 17) % 60), location, description, code }));
  const shipments: Shipment[] = [];
  if (s.outbound) {
    const o = s.outbound;
    shipments.push({
      id: `SHP-${s.no}`,
      order_id: id,
      direction: "OUTBOUND",
      carrier: o.carrier,
      service: o.service,
      tracking_number: o.tracking,
      tracking_url: URL_FOR[o.carrier](o.tracking),
      shipped_at: at(o.shippedDaysAgo, 8, 0),
      delivered_at: o.deliveredDaysAgo !== undefined ? at(o.deliveredDaysAgo, 16, 52) : undefined,
      status: o.status,
      delivered_to: o.status === "DELIVERED" ? (o.deliveredTo ?? s.ship) : undefined,
      signature: o.signature && o.deliveredDaysAgo !== undefined ? { name: o.signature, at: at(o.deliveredDaysAgo, 16, 52) } : undefined,
      events: scansFor(o.scans, o.deliveredDaysAgo),
      pushed_to_paypal: o.onPayPal ?? true,
    });
  }
  if (s.returned) {
    const r = s.returned;
    shipments.push({
      id: `RTN-${s.no}`,
      order_id: id,
      direction: "RETURN",
      carrier: r.carrier,
      service: "Prepaid return label",
      tracking_number: r.tracking,
      tracking_url: URL_FOR[r.carrier](r.tracking),
      shipped_at: at(r.shippedDaysAgo, 10, 0),
      delivered_at: at(r.deliveredDaysAgo, 16, 52),
      status: "DELIVERED",
      delivered_to: store.merchant().address,
      events: scansFor(r.scans, r.deliveredDaysAgo),
      pushed_to_paypal: true,
    });
  }
  const order: Order = {
    id,
    placed_at: placed,
    currency: "USD",
    customer_email: s.buyer.email,
    items: [{ sku: p.sku, name: p.name, qty, unit_price: p.price }],
    subtotal: p.price * qty,
    shipping_cost: shippingCost,
    tax: 0,
    total: p.price * qty + shippingCost,
    shipping_address: s.ship,
    billing_address: s.billing,
    shipping_method: s.outbound?.service ?? (intl ? "DHL Express Worldwide" : "UPS Ground"),
    paypal: {
      order_id: `5O${(71000000000000 + n * 4813).toString()}`,
      capture_id: `${(20000000 + n).toString()}PV${(500000 + (n % 97) * 2711).toString()}${"ABCDEFGHJK"[n % 10]}`,
      invoice_id: id,
      funding: s.funding ?? "PAYPAL",
    },
    checkout: { ip: s.risk?.ip?.address ?? `98.${n % 200}.${(n * 7) % 250}.${(n * 13) % 250}`, user_agent: "Mozilla/5.0", accepted_terms_at: placed, policies_version: "2026-03" },
    shipment_ids: shipments.map((x) => x.id),
    notes: s.notes,
  };
  const customer: Customer = {
    email: s.buyer.email,
    name: s.buyer.name,
    country: s.buyer.country,
    first_order_at: s.buyer.priorOrders ? at(s.placedDaysAgo + 140) : placed,
    order_ids: [id],
    lifetime_value: (s.buyer.ltv ?? 0) + order.total,
    prior_disputes: 0,
  };
  const conversation: Conversation = {
    order_id: id,
    messages: (s.messages ?? []).map((m, i) => ({ id: `MSG-${s.no}-${i + 1}`, at: at(m.daysAgo, m.hour ?? 9 + i * 2, 14), from: m.from, channel: m.channel ?? "email", subject: m.subject, body: m.body, language: m.language ?? "en" })),
  };
  const risk: RiskSignals = {
    order_id: id,
    avs_result: "Y",
    cvv_result: "M",
    three_ds: s.funding === "CARD" ? "AUTHENTICATED" : undefined,
    ip: { address: order.checkout.ip, city: s.ship.city, country: s.ship.country },
    ip_to_shipping_km: 6,
    device: { id: `dv_${s.no}`, seen_before: !!s.buyer.priorOrders, first_seen: customer.first_order_at },
    email_age_days: s.buyer.emailAgeDays ?? 900,
    orders_last_24h: 1,
    ...s.risk,
  };
  return { order, shipments, customer, conversation, risk };
}

export function buildPreventionOrders(base = new Date()): PreventionRecords[] {
  const at = clock(base);
  const inputs: Input[] = [
    {
      // German buyer, DHL parcel stuck in customs, and a message threatening a PayPal dispute.
      no: "10561",
      sku: "KA-DUF-CHS",
      placedDaysAgo: 10,
      ship: addr("Lena Hoffmann", "Kastanienallee 34", "Berlin", undefined, "10435", "DE"),
      buyer: { name: "Lena Hoffmann", email: "lena.hoffmann@example.de", country: "DE" },
      outbound: {
        carrier: "DHL",
        service: "DHL Express Worldwide",
        tracking: "4518230917",
        shippedDaysAgo: 9,
        status: "IN_TRANSIT",
        scans: [
          [9, "Brooklyn, NY", "Shipment picked up", "PICKUP"],
          [8, "Cincinnati Hub, OH", "Departed facility", "TRANSIT"],
          [7, "Leipzig Hub, DE", "Arrived at facility", "TRANSIT"],
          [6, "Leipzig Hub, DE", "Customs status updated: clearance processing", "TRANSIT"],
        ],
      },
      messages: [
        {
          daysAgo: 2,
          hour: 7,
          from: "customer",
          subject: "Bestellung KA-10561",
          language: "de",
          body: "Hallo, wo ist meine Bestellung? Die Sendungsverfolgung zeigt seit fast einer Woche nichts Neues, nur „Verzollung“. Die Tasche war ein Geschenk für Samstag. Wenn ich bis Ende der Woche nichts höre, eröffne ich einen Konflikt bei PayPal. Viele Grüße, Lena Hoffmann",
        },
      ],
    },
    {
      // Return arrived at the studio a week ago; the refund was never issued.
      no: "10562",
      sku: "KA-WKD-COG",
      placedDaysAgo: 24,
      ship: addr("Priya Nair", "1120 E Pike St", "Seattle", "WA", "98122", "US", "Apt 4"),
      buyer: { name: "Priya Nair", email: "priya.nair@example.com", country: "US", priorOrders: 1, ltv: 142 },
      outbound: {
        carrier: "UPS",
        service: "UPS Ground",
        tracking: "1Z84V6A90389215527",
        shippedDaysAgo: 23,
        status: "DELIVERED",
        deliveredDaysAgo: 18,
        signature: "P NAIR",
        scans: [
          [23, "Brooklyn, NY", "Picked up", "PICKUP"],
          [21, "Hodgkins, IL", "Departed facility", "TRANSIT"],
          [18, "Seattle, WA", "Delivered, signed by P NAIR", "DELIVERED"],
        ],
      },
      returned: {
        carrier: "UPS",
        tracking: "1Z84V6A99012874430",
        shippedDaysAgo: 12,
        deliveredDaysAgo: 7,
        scans: [
          [12, "Seattle, WA", "Drop-off at The UPS Store", "PICKUP"],
          [9, "Hodgkins, IL", "Departed facility", "TRANSIT"],
          [7, "Brooklyn, NY", "Delivered to Kora Atelier LLC, signed by M. OKAFOR", "DELIVERED"],
        ],
      },
      messages: [
        { daysAgo: 14, from: "customer", subject: "Return for KA-10562", body: "Hi! The Weekender is beautiful but too big for carry-on. I'd like to return it for a refund please." },
        { daysAgo: 13, from: "merchant", subject: "Re: Return for KA-10562", body: "Of course, Priya. Your prepaid UPS label is attached. We refund within 3 business days of the bag arriving at the studio." },
        { daysAgo: 1, hour: 18, from: "customer", subject: "Re: Return for KA-10562", body: "UPS shows you received the bag a week ago but I still don't see a refund on PayPal. Can you check?" },
      ],
    },
    {
      // First order, $840, card with AVS and 3-D Secure failures, IP on another continent. Not shipped yet.
      no: "10563",
      sku: "KA-BRF-ESP",
      qty: 2,
      placedDaysAgo: 0,
      funding: "CARD",
      ship: addr("Jordan Reyes", "2001 Biscayne Blvd", "Miami", "FL", "33137", "US", "Unit 1408"),
      billing: addr("Jordan Reyes", "77 Larkin St", "San Francisco", "CA", "94102", "US"),
      buyer: { name: "Jordan Reyes", email: "jreyes.buys88@example.net", country: "US", emailAgeDays: 2 },
      risk: {
        avs_result: "N",
        cvv_result: "M",
        three_ds: "NONE",
        ip: { address: "102.89.34.211", city: "Lagos", country: "NG" },
        ip_to_shipping_km: 9_120,
        orders_last_24h: 3,
      },
      notes: "Requested express upgrade by email 20 minutes after checkout.",
    },
    {
      // Briefcase in transit; the UPS number never reached PayPal.
      no: "10564",
      sku: "KA-BRF-ESP",
      placedDaysAgo: 4,
      ship: addr("Marcus Bell", "4500 Duval St", "Austin", "TX", "78751", "US"),
      buyer: { name: "Marcus Bell", email: "marcus.bell@example.com", country: "US" },
      outbound: {
        carrier: "UPS",
        service: "UPS Ground",
        tracking: "1Z84V6A90392018834",
        shippedDaysAgo: 3,
        status: "IN_TRANSIT",
        onPayPal: false,
        scans: [
          [3, "Brooklyn, NY", "Picked up", "PICKUP"],
          [2, "Harrisburg, PA", "Departed facility", "TRANSIT"],
          [0, "Dallas, TX", "Arrived at facility", "TRANSIT"],
        ],
      },
    },
    {
      // "Tracking says delivered but nothing at my door" and an explicit claim threat. No signature.
      no: "10565",
      sku: "KA-MSG-OLV",
      placedDaysAgo: 7,
      ship: addr("Ryan Patel", "19 Maple Ave", "Montclair", "NJ", "07042", "US"),
      buyer: { name: "Ryan Patel", email: "ryan.patel@example.com", country: "US", priorOrders: 2, ltv: 164 },
      outbound: {
        carrier: "USPS",
        service: "USPS Ground Advantage",
        tracking: "9400111899223857104412",
        shippedDaysAgo: 6,
        status: "DELIVERED",
        deliveredDaysAgo: 2,
        scans: [
          [6, "Brooklyn, NY", "Accepted at USPS origin facility", "PICKUP"],
          [4, "Kearny, NJ", "In transit to next facility", "TRANSIT"],
          [2, "Montclair, NJ", "Delivered, front door/porch", "DELIVERED"],
        ],
      },
      messages: [
        {
          daysAgo: 1,
          hour: 8,
          from: "customer",
          channel: "chat",
          body: "USPS says my satchel was delivered Saturday but there's nothing at my door and none of my neighbours have it. If I don't hear back I'm filing a claim with PayPal.",
        },
      ],
    },
    {
      // Carrier redirected the parcel to a locker. Seller Protection needs delivery to the transaction address.
      no: "10566",
      sku: "KA-WKD-COG",
      placedDaysAgo: 6,
      ship: addr("Hannah Kim", "2245 Lawrence St", "Denver", "CO", "80205", "US", "Apt 5"),
      buyer: { name: "Hannah Kim", email: "hannah.kim@example.com", country: "US" },
      outbound: {
        carrier: "UPS",
        service: "UPS Ground",
        tracking: "1Z84V6A90377120946",
        shippedDaysAgo: 5,
        status: "DELIVERED",
        deliveredDaysAgo: 1,
        signature: "LOCKER",
        deliveredTo: addr("UPS Access Point Locker", "1600 Champa St", "Denver", "CO", "80202", "US"),
        scans: [
          [5, "Brooklyn, NY", "Picked up", "PICKUP"],
          [3, "Commerce City, CO", "Arrived at facility", "TRANSIT"],
          [2, "Denver, CO", "Delivery change requested by receiver: UPS Access Point", "TRANSIT"],
          [1, "Denver, CO", "Delivered to UPS Access Point locker, 1600 Champa St", "DELIVERED"],
        ],
      },
    },
    {
      // USPS parcel with no scan for eight days and well past the promised delivery date. No contact yet.
      no: "10567",
      sku: "KA-TOT-TAN",
      placedDaysAgo: 13,
      ship: addr("Olivia Brooks", "3317 SE Belmont St", "Portland", "OR", "97214", "US"),
      buyer: { name: "Olivia Brooks", email: "olivia.brooks@example.com", country: "US" },
      outbound: {
        carrier: "USPS",
        service: "USPS Ground Advantage",
        tracking: "9400111899223857109935",
        shippedDaysAgo: 12,
        status: "IN_TRANSIT",
        scans: [
          [12, "Brooklyn, NY", "Accepted at USPS origin facility", "PICKUP"],
          [10, "Chicago, IL", "Arrived at USPS regional facility", "TRANSIT"],
          [8, "Chicago, IL", "In transit to next facility", "TRANSIT"],
        ],
      },
    },
    {
      // UK buyer unsure about the colour, chat unanswered for 30 hours; tracking never sent to PayPal.
      no: "10568",
      sku: "KA-CLU-SND",
      placedDaysAgo: 8,
      ship: addr("Thomas Wright", "41 Elgin Crescent", "London", undefined, "W11 2JE", "GB"),
      buyer: { name: "Thomas Wright", email: "thomas.wright@example.co.uk", country: "GB" },
      outbound: {
        carrier: "DHL",
        service: "DHL Express Worldwide",
        tracking: "4518230988",
        shippedDaysAgo: 7,
        status: "DELIVERED",
        deliveredDaysAgo: 3,
        signature: "WRIGHT",
        onPayPal: false,
        scans: [
          [7, "Brooklyn, NY", "Shipment picked up", "PICKUP"],
          [5, "East Midlands Hub, GB", "Cleared customs", "TRANSIT"],
          [3, "London, GB", "Delivered, signed by WRIGHT", "DELIVERED"],
        ],
      },
      messages: [
        {
          daysAgo: 1,
          hour: 6,
          from: "customer",
          channel: "chat",
          body: "Hi, the clutch arrived but the colour looks much darker than the photos. Honestly not sure I want to keep it. What are my options?",
        },
      ],
    },
    {
      // French buyer, DHL exception: address incomplete, held at the depot.
      no: "10569",
      sku: "KA-BLT-COG",
      placedDaysAgo: 7,
      ship: addr("Sophie Laurent", "8 Rue de la République", "Lyon", undefined, "69002", "FR"),
      buyer: { name: "Sophie Laurent", email: "sophie.laurent@example.fr", country: "FR" },
      outbound: {
        carrier: "DHL",
        service: "DHL Express Worldwide",
        tracking: "4518231044",
        shippedDaysAgo: 6,
        status: "EXCEPTION",
        scans: [
          [6, "Brooklyn, NY", "Shipment picked up", "PICKUP"],
          [4, "Paris CDG Hub, FR", "Cleared customs", "TRANSIT"],
          [3, "Lyon, FR", "Delivery attempted: address incomplete, recipient not available", "EXCEPTION"],
        ],
      },
    },
    {
      // $379 delivered to the porch without the signature the shipping policy promises.
      no: "10560",
      sku: "KA-DUF-CHS",
      placedDaysAgo: 6,
      ship: addr("Daniel Okafor", "870 Ponce de Leon Ave NE", "Atlanta", "GA", "30306", "US"),
      buyer: { name: "Daniel Okafor", email: "daniel.okafor@example.com", country: "US", priorOrders: 1, ltv: 96 },
      outbound: {
        carrier: "FEDEX",
        service: "FedEx Home Delivery",
        tracking: "781234509876",
        shippedDaysAgo: 5,
        status: "DELIVERED",
        deliveredDaysAgo: 1,
        scans: [
          [5, "Brooklyn, NY", "Picked up", "PICKUP"],
          [3, "Memphis, TN", "Departed FedEx hub", "TRANSIT"],
          [1, "Atlanta, GA", "Delivered, left at front door. No signature required", "DELIVERED"],
        ],
      },
    },
  ];
  return inputs.map((s) => build(at, s));
}

/** Writes the prevention demo orders into the store. Called from seedDemo(). */
export function seedPreventionScenarios(base = new Date()) {
  for (const r of buildPreventionOrders(base)) {
    store.putOrder(r.order);
    for (const sh of r.shipments) store.putShipment(sh);
    store.putCustomer(r.customer);
    store.putConversation(r.conversation);
    store.putRisk(r.risk);
  }
}
