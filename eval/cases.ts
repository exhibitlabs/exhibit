// The labelled evaluation set: 30 synthetic PayPal disputes for the demo merchant, Kora Atelier.
//
// Each case is built in the demo store's scenario format (ScenarioRecords, src/lib/store/scenarios.ts)
// and carries the decision a careful merchant should take (`expected`) and a one-line `rationale`,
// written together, before Exhibit ran on anything, under the rules in eval/LABELING.md.
//
// The title, label and rationale stay in this file. The harness only writes the dispute (to the
// PayPal simulator) and the order, shipments, buyer, support thread and risk signals (to the store),
// so the agent never sees them. Dates are relative to the moment of seeding, like the demo.

import { createHash } from "node:crypto";
import type { Decision } from "@/lib/agent/brief";
import type { Dispute, DisputeReason, DisputeStage, DisputeStatus, EvidenceType } from "@/lib/paypal/types";
import { MERCHANT, PRODUCTS, type ScenarioRecords } from "@/lib/store/scenarios";
import type { Address, Conversation, Customer, Order, RiskSignals, Shipment, ShipmentEvent } from "@/lib/store/types";

type Scan = [daysAgo: number, location: string, description: string, code: ShipmentEvent["code"]];

type ShipmentSpec = {
  carrier: Shipment["carrier"];
  service: string;
  tracking: string;
  status: Shipment["status"];
  shippedDaysAgo: number;
  deliveredDaysAgo?: number;
  /** Defaults to the transaction address (outbound) or the studio (returns). */
  deliveredTo?: Address;
  signature?: string;
  deliveryPhoto?: string;
  qcPhoto?: string;
  scans: Scan[];
};

type MessageSpec = { daysAgo: number; from: "customer" | "merchant"; channel?: "email" | "chat"; subject?: string; body: string; language?: string };

export type EvalCase = {
  id: string;
  /** For the report only; never written to the store. */
  title: string;
  expected: Decision;
  rationale: string;
  dispute: {
    id: string;
    reason: DisputeReason;
    stage: DisputeStage;
    status?: DisputeStatus;
    channel?: "INTERNAL" | "EXTERNAL";
    externalReasonCode?: string;
    createdDaysAgo: number;
    dueInDays: number;
    /** Disputed amount when it is less than the order total. */
    amount?: number;
    requested: EvidenceType[];
    options?: Dispute["allowed_response_options"];
    subReasons?: string[];
    buyerMessages?: [daysAgo: number, text: string][];
  };
  order: {
    no: string;
    txn: string;
    sku: string;
    qty?: number;
    placedDaysAgo?: number;
    shipTo: Address;
    billing?: Address;
    funding?: "PAYPAL" | "CARD";
    refunds?: { id: string; amount: number; daysAgo: number }[];
  };
  buyer: { name: string; email: string; country: string; firstOrderDaysAgo: number; otherOrders?: string[]; priorOrders?: number; ltv: number; priorDisputes?: number; notes?: string };
  /** null: the order never shipped. */
  outbound: ShipmentSpec | null;
  returned?: ShipmentSpec;
  thread: MessageSpec[];
  risk: Omit<RiskSignals, "order_id" | "device"> & { device: { id: string; seenBefore: boolean; firstSeenDaysAgo: number } };
};

const addr = (name: string, line1: string, city: string, state: string | undefined, postal: string, country: string): Address => ({ name, line1, city, state, postal_code: postal, country });

const INR: DisputeReason = "MERCHANDISE_OR_SERVICE_NOT_RECEIVED";
const SNAD: DisputeReason = "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED";

// PayPal wallet payments carry no card AVS/CVV result for the merchant.
const wallet = { avs_result: "U", cvv_result: "U", three_ds: "NONE" } as const;

export const EVAL_CASES: EvalCase[] = [
  // ---- Item not received ------------------------------------------------------------------------
  {
    id: "inr-01",
    title: "Says it never arrived; USPS shows it delivered to the porch of the transaction address (no signature under $250)",
    expected: "FIGHT",
    rationale: "USPS shows 'delivered' with a date at the exact transaction address and a verifiable tracking number, which meets PayPal's proof-of-delivery requirements; a signature is not one of them.",
    dispute: { id: "PP-D-61204", reason: INR, stage: "CHARGEBACK", createdDaysAgo: 3, dueInDays: 7, requested: ["PROOF_OF_FULFILLMENT"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[3, "I never received this order. Please refund me."]] },
    order: { no: "19410", txn: "3TK52918HB4470213", sku: "KA-MSG-OLV", shipTo: addr("Rachel Ostrowski", "4418 Sycamore Ln", "Raleigh", "NC", "27609", "US") },
    buyer: { name: "Rachel Ostrowski", email: "rachel.ostrowski@example.com", country: "US", firstOrderDaysAgo: 190, priorOrders: 1, ltv: 280 },
    outbound: {
      carrier: "USPS", service: "USPS Ground Advantage", tracking: "9400111899561234408817", status: "DELIVERED", shippedDaysAgo: 14, deliveredDaysAgo: 10,
      deliveryPhoto: "Parcel on the doormat at the front door of 4418 Sycamore Ln, house number visible",
      scans: [[14, "Brooklyn, NY 11201", "Shipping label created", "LABEL"], [14, "Brooklyn, NY", "Accepted at USPS origin facility", "PICKUP"], [12, "Greensboro, NC", "Arrived at USPS regional facility", "TRANSIT"], [10, "Raleigh, NC 27609", "Out for delivery", "OUT_FOR_DELIVERY"], [10, "Raleigh, NC 27609", "Delivered, front door/porch", "DELIVERED"]],
    },
    thread: [],
    risk: { ...wallet, ip: { address: "174.99.23.61", city: "Raleigh", region: "NC", country: "US" }, ip_to_shipping_km: 9, device: { id: "dv_41ab", seenBefore: true, firstSeenDaysAgo: 190 }, email_age_days: 2100, orders_last_24h: 1 },
  },
  {
    id: "inr-02",
    title: "Inquiry: UPS lost the parcel (investigation opened 12 days ago, never delivered); the buyer has asked for a refund",
    expected: "REFUND",
    rationale: "The carrier lost the parcel (UPS opened an investigation and there is no delivery scan), so there is no proof of delivery; the buyer paid, got nothing and asked for a refund. Refund, then claim from UPS.",
    dispute: {
      id: "PP-D-61217", reason: INR, stage: "INQUIRY", createdDaysAgo: 2, dueInDays: 8, requested: [],
      options: { make_offer: { offer_types: ["REFUND", "REPLACEMENT_WITHOUT_REFUND"] }, accept_claim: { accept_claim_types: ["REFUND"] } },
      buyerMessages: [[2, "Never received my clutch. Tracking stopped weeks ago and the seller only says they're looking into it."]],
    },
    order: { no: "19139", txn: "8LM20475WD3391845", sku: "KA-CLU-SND", shipTo: addr("Marcus Bell", "915 W Fulton Market, Apt 6B", "Chicago", "IL", "60607", "US") },
    buyer: { name: "Marcus Bell", email: "marcus.bell@example.com", country: "US", firstOrderDaysAgo: 22, ltv: 180 },
    outbound: {
      carrier: "UPS", service: "UPS Ground", tracking: "1Z84V6A90370112294", status: "EXCEPTION", shippedDaysAgo: 21,
      scans: [[21, "Brooklyn, NY", "Label created", "LABEL"], [21, "Brooklyn, NY", "Picked up", "PICKUP"], [19, "Harrisburg, PA", "Departed facility", "TRANSIT"], [17, "Hodgkins, IL", "Arrived at facility", "TRANSIT"], [12, "Hodgkins, IL", "Package could not be located in the facility. An investigation has been opened.", "EXCEPTION"]],
    },
    thread: [
      { daysAgo: 13, from: "customer", subject: "Where is my clutch?", body: "Hi, tracking has shown my clutch at a UPS facility in Illinois for days. Any news?" },
      { daysAgo: 12, from: "merchant", subject: "Re: Where is my clutch?", body: "So sorry Marcus. UPS has opened a trace on 1Z84V6A90370112294 and we'll update you as soon as we hear back." },
      { daysAgo: 4, from: "customer", subject: "Re: Where is my clutch?", body: "Still nothing after more than a week. I'd like a refund, please." },
    ],
    risk: { ...wallet, ip: { address: "73.44.190.12", city: "Chicago", region: "IL", country: "US" }, ip_to_shipping_km: 4, device: { id: "dv_8c20", seenBefore: false, firstSeenDaysAgo: 22 }, email_age_days: 1500, orders_last_24h: 1 },
  },
  {
    id: "inr-03",
    title: "\"Delivered and signed\", but at the buyer's old address, not the one on the transaction",
    expected: "REFUND",
    rationale: "The signature is a stranger's at an address that is not the transaction address; PayPal requires delivery to the address on the Transaction Details page, so there is no valid proof of delivery, and the store shipped to the wrong address.",
    dispute: { id: "PP-D-61223", reason: INR, stage: "CHARGEBACK", createdDaysAgo: 2, dueInDays: 8, requested: ["PROOF_OF_FULFILLMENT"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[2, "My order was sent to an address I no longer live at. I never received it."]] },
    order: { no: "19487", txn: "5RC68203JX1145589", sku: "KA-WKD-COG", shipTo: addr("Hannah Lindqvist", "77 Harbor Point Rd", "Annapolis", "MD", "21403", "US") },
    buyer: { name: "Hannah Lindqvist", email: "hannah.lindqvist@example.com", country: "US", firstOrderDaysAgo: 400, priorOrders: 2, ltv: 710, notes: "Moved in September from 1290 Elm Ridge Ct, Columbia MD 21044 to 77 Harbor Point Rd, Annapolis MD 21403." },
    outbound: {
      carrier: "UPS", service: "UPS Ground, signature required", tracking: "1Z84V6A90385530471", status: "DELIVERED", shippedDaysAgo: 12, deliveredDaysAgo: 9,
      deliveredTo: addr("Hannah Lindqvist", "1290 Elm Ridge Ct", "Columbia", "MD", "21044", "US"), signature: "M. PRICE",
      scans: [[12, "Brooklyn, NY", "Label created", "LABEL"], [12, "Brooklyn, NY", "Picked up", "PICKUP"], [10, "Baltimore, MD", "Arrived at facility", "TRANSIT"], [9, "Columbia, MD 21044", "Out for delivery", "OUT_FOR_DELIVERY"], [9, "Columbia, MD 21044", "Delivered, signed by M. PRICE", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 8, from: "customer", subject: "Weekender delivered to the wrong address", body: "UPS says my weekender was delivered to 1290 Elm Ridge Ct and signed for by 'M. Price'. That's my old address. I moved in September and entered the new one at checkout. Can you help?" },
      { daysAgo: 7, from: "merchant", subject: "Re: Weekender delivered to the wrong address", body: "Hi Hannah, we're looking into this with UPS and will get back to you." },
    ],
    risk: { ...wallet, ip: { address: "68.48.201.77", city: "Annapolis", region: "MD", country: "US" }, ip_to_shipping_km: 3, device: { id: "dv_19fe", seenBefore: true, firstSeenDaysAgo: 400 }, email_age_days: 3000, orders_last_24h: 1 },
  },
  {
    id: "inr-04",
    title: "Inquiry: \"nothing in my mailbox\", but UPS shows the building's front desk signed for it two days ago",
    expected: "MESSAGE_BUYER",
    rationale: "Inquiry stage, and UPS shows the front desk signed for the parcel at the right address two days ago while the buyer only checked her mailbox; telling her where it is resolves this without a fight or a refund.",
    dispute: { id: "PP-D-61238", reason: INR, stage: "INQUIRY", createdDaysAgo: 1, dueInDays: 9, requested: [], options: { make_offer: { offer_types: ["REFUND"] }, accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[1, "Tracking says delivered but there was nothing in my mailbox. Where is my tote?"]] },
    order: { no: "19802", txn: "1VB93357NP6602748", sku: "KA-TOT-TAN", shipTo: addr("Aisha Mensah", "350 W 42nd St, Apt 18C", "New York", "NY", "10036", "US") },
    buyer: { name: "Aisha Mensah", email: "aisha.mensah@example.com", country: "US", firstOrderDaysAgo: 5, ltv: 142 },
    outbound: {
      carrier: "UPS", service: "UPS Ground", tracking: "1Z84V6A90391283364", status: "DELIVERED", shippedDaysAgo: 4, deliveredDaysAgo: 2, signature: "R. DIAZ (FRONT DESK)",
      scans: [[4, "Brooklyn, NY", "Picked up", "PICKUP"], [3, "Secaucus, NJ", "Departed facility", "TRANSIT"], [2, "New York, NY 10036", "Out for delivery", "OUT_FOR_DELIVERY"], [2, "New York, NY 10036", "Delivered, received by front desk (R. DIAZ)", "DELIVERED"]],
    },
    thread: [],
    risk: { ...wallet, ip: { address: "100.2.41.199", city: "New York", region: "NY", country: "US" }, ip_to_shipping_km: 2, device: { id: "dv_a7d3", seenBefore: false, firstSeenDaysAgo: 5 }, email_age_days: 900, orders_last_24h: 1 },
  },
  {
    id: "inr-05",
    title: "Inquiry in French: after a missed delivery DHL left the parcel at a ServicePoint near her; the 7-day hold is running",
    expected: "MESSAGE_BUYER",
    rationale: "Inquiry stage: after a missed delivery DHL left the parcel at a ServicePoint near her, held for 7 days with 4 left; a message in French with the pickup address solves it, and a refund would be premature.",
    dispute: { id: "PP-D-61241", reason: INR, stage: "INQUIRY", createdDaysAgo: 1, dueInDays: 9, requested: [], options: { make_offer: { offer_types: ["REFUND"] }, accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[1, "Bonjour, le suivi DHL indique « livré » mais je n'ai jamais reçu mon colis. Je suis très déçue."]] },
    order: { no: "19644", txn: "6HD40812QT9930157", sku: "KA-CLU-SND", shipTo: addr("Camille Laurent", "18 Rue Mercière", "Lyon", undefined, "69002", "FR") },
    buyer: { name: "Camille Laurent", email: "camille.laurent@example.fr", country: "FR", firstOrderDaysAgo: 9, ltv: 204 },
    outbound: {
      carrier: "DHL", service: "DHL Express Worldwide", tracking: "7731940562", status: "DELIVERED", shippedDaysAgo: 8, deliveredDaysAgo: 3,
      deliveredTo: addr("DHL ServicePoint Tabac Presse Bellecour", "3 Rue Gasparin", "Lyon", undefined, "69002", "FR"),
      scans: [
        [8, "New York, NY", "Shipment picked up", "PICKUP"], [7, "Cincinnati Hub, OH", "Departed facility", "TRANSIT"], [5, "Paris Charles de Gaulle, FR", "Customs cleared", "TRANSIT"],
        [4, "Lyon, FR", "Delivery attempted, recipient not available. Notice left; the shipment will be held at a DHL ServicePoint.", "EXCEPTION"],
        [3, "Lyon, FR 69002", "Delivered to DHL ServicePoint Tabac Presse Bellecour, 3 Rue Gasparin. Held for collection for 7 days.", "DELIVERED"],
      ],
    },
    thread: [],
    risk: { ...wallet, ip: { address: "90.12.88.143", city: "Lyon", country: "FR" }, ip_to_shipping_km: 1, device: { id: "dv_5be1", seenBefore: false, firstSeenDaysAgo: 9 }, email_age_days: 1300, orders_last_24h: 1 },
  },
  {
    id: "inr-06",
    title: "Card-issuer chargeback for \"not received\" (13.1): outside Seller Protection, but UPS has the cardholder's signature at his own address",
    expected: "FIGHT",
    rationale: "Seller Protection excludes not-received chargebacks filed with the card issuer, but the issuer still decides on evidence, and a signed delivery at the cardholder's own billing and shipping address answers the claim.",
    dispute: { id: "PP-D-61256", reason: INR, stage: "CHARGEBACK", channel: "EXTERNAL", externalReasonCode: "13.1", createdDaysAgo: 4, dueInDays: 6, requested: ["PROOF_OF_FULFILLMENT"], options: { accept_claim: { accept_claim_types: ["REFUND"] } } },
    order: { no: "19178", txn: "2PX71164AF5528036", sku: "KA-BRF-ESP", funding: "CARD", shipTo: addr("Gregory Walsh", "62 Juniper Hill Rd", "Westport", "CT", "06880", "US"), billing: addr("Gregory Walsh", "62 Juniper Hill Rd", "Westport", "CT", "06880", "US") },
    buyer: { name: "Gregory Walsh", email: "greg.walsh@example.com", country: "US", firstOrderDaysAgo: 300, priorOrders: 1, ltv: 516 },
    outbound: {
      carrier: "UPS", service: "UPS 2nd Day Air, signature required", tracking: "1Z84V6A90226648115", status: "DELIVERED", shippedDaysAgo: 20, deliveredDaysAgo: 18, signature: "G WALSH",
      scans: [[20, "Brooklyn, NY", "Picked up", "PICKUP"], [19, "Hartford, CT", "Departed facility", "TRANSIT"], [18, "Westport, CT 06880", "Out for delivery", "OUT_FOR_DELIVERY"], [18, "Westport, CT 06880", "Delivered, signed by G WALSH", "DELIVERED"]],
    },
    thread: [],
    risk: { avs_result: "Y", cvv_result: "M", three_ds: "NONE", ip: { address: "24.151.60.34", city: "Westport", region: "CT", country: "US" }, ip_to_shipping_km: 5, device: { id: "dv_0c6e", seenBefore: true, firstSeenDaysAgo: 300 }, email_age_days: 4000, orders_last_24h: 1 },
  },
  {
    id: "inr-07",
    title: "Inquiry after the store already sent the signed delivery record; the buyer replied \"I don't care what UPS says\"",
    expected: "FIGHT",
    rationale: "The store already sent the tracking and the signature and the buyer rejected them; the records meet PayPal's proof-of-delivery requirements (delivered, matching address, verifiable tracking), so the next step is to file that proof, not to message again or pay.",
    dispute: {
      id: "PP-D-61262", reason: INR, stage: "INQUIRY", createdDaysAgo: 1, dueInDays: 9, requested: [],
      options: { make_offer: { offer_types: ["REFUND", "REPLACEMENT_WITHOUT_REFUND"] }, accept_claim: { accept_claim_types: ["REFUND"] } },
      buyerMessages: [[1, "Item not received. The seller refuses to refund me."]],
    },
    order: { no: "19605", txn: "9GW35580KE2217649", sku: "KA-DUF-CHS", shipTo: addr("Tyler Brennan", "2104 Lakeshore Dr", "Madison", "WI", "53705", "US") },
    buyer: { name: "Tyler Brennan", email: "tyler.brennan@example.com", country: "US", firstOrderDaysAgo: 10, ltv: 355 },
    outbound: {
      carrier: "UPS", service: "UPS Ground, signature required", tracking: "1Z84V6A90244719938", status: "DELIVERED", shippedDaysAgo: 9, deliveredDaysAgo: 6, signature: "T BRENNAN",
      deliveryPhoto: "Parcel handed over at the front door of 2104 Lakeshore Dr",
      scans: [[9, "Brooklyn, NY", "Picked up", "PICKUP"], [7, "Chicago, IL", "Departed facility", "TRANSIT"], [6, "Madison, WI 53705", "Out for delivery", "OUT_FOR_DELIVERY"], [6, "Madison, WI 53705", "Delivered, signed by T BRENNAN", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 4, from: "customer", subject: "Duffle", body: "My duffle never came." },
      { daysAgo: 4, from: "merchant", subject: "Re: Duffle", body: "Hi Tyler, UPS shows the duffle was delivered and signed for by \"T BRENNAN\" at 2104 Lakeshore Dr, with a photo at your front door. Tracking: 1Z84V6A90244719938. Could someone in your household have taken it in?" },
      { daysAgo: 3, from: "customer", subject: "Re: Duffle", body: "I don't care what UPS says. Refund me or I'm opening a PayPal case." },
    ],
    risk: { ...wallet, ip: { address: "72.33.10.215", city: "Madison", region: "WI", country: "US" }, ip_to_shipping_km: 6, device: { id: "dv_e2a9", seenBefore: false, firstSeenDaysAgo: 10 }, email_age_days: 700, orders_last_24h: 1 },
  },
  {
    id: "inr-08",
    title: "Not-received chargeback PayPal is already reviewing: only supporting information can be sent",
    expected: "FIGHT",
    rationale: "PayPal is already reviewing the case, so supporting information is the only response it accepts, and the records (a signed delivery at the transaction address) support the merchant.",
    dispute: { id: "PP-D-61279", reason: INR, stage: "CHARGEBACK", status: "UNDER_REVIEW", createdDaysAgo: 3, dueInDays: 7, requested: [], buyerMessages: [[3, "I did not receive the weekender bag."]] },
    order: { no: "19333", txn: "4JN86621RM0053382", sku: "KA-WKD-COG", shipTo: addr("Natalie Ferreira", "1735 Peachtree St NE, Apt 2207", "Atlanta", "GA", "30309", "US") },
    buyer: { name: "Natalie Ferreira", email: "natalie.ferreira@example.com", country: "US", firstOrderDaysAgo: 220, priorOrders: 2, ltv: 566 },
    outbound: {
      carrier: "UPS", service: "UPS Ground, signature required", tracking: "1Z84V6A90291157302", status: "DELIVERED", shippedDaysAgo: 16, deliveredDaysAgo: 12, signature: "N FERREIRA",
      scans: [[16, "Brooklyn, NY", "Label created", "LABEL"], [16, "Brooklyn, NY", "Picked up", "PICKUP"], [14, "Charlotte, NC", "Departed facility", "TRANSIT"], [12, "Atlanta, GA 30309", "Out for delivery", "OUT_FOR_DELIVERY"], [12, "Atlanta, GA 30309", "Delivered, signed by N FERREIRA", "DELIVERED"]],
    },
    thread: [],
    risk: { ...wallet, ip: { address: "73.207.55.18", city: "Atlanta", region: "GA", country: "US" }, ip_to_shipping_km: 3, device: { id: "dv_77c4", seenBefore: true, firstSeenDaysAgo: 220 }, email_age_days: 2500, orders_last_24h: 1 },
  },

  // ---- Not as described -------------------------------------------------------------------------
  {
    id: "snad-01",
    title: "Inquiry: a 2 cm scuff from a box crushed in transit; the packing photo was clean and the buyer wants to keep the bag",
    expected: "OFFER",
    rationale: "The scuff is real and happened in transit (UPS logged box damage; the packing photo was clean), so the buyer has a point, but it is cosmetic and he wants to keep the bag; a partial refund settles it for far less than the $284 a refund or a fight puts at stake.",
    dispute: {
      id: "PP-D-61283", reason: SNAD, stage: "INQUIRY", createdDaysAgo: 1, dueInDays: 9, subReasons: ["DAMAGED"], requested: [],
      options: { make_offer: { offer_types: ["REFUND", "REFUND_WITH_RETURN", "REFUND_WITH_REPLACEMENT", "REPLACEMENT_WITHOUT_REFUND"] }, accept_claim: { accept_claim_types: ["REFUND", "REFUND_WITH_RETURN"] } },
      buyerMessages: [[1, "Item arrived damaged (scuffed corner). Would like a partial refund."]],
    },
    order: { no: "19681", txn: "7CS14498UL3376520", sku: "KA-WKD-COG", shipTo: addr("Daniel Okafor", "5120 N Kenmore Ave", "Chicago", "IL", "60640", "US") },
    buyer: { name: "Daniel Okafor", email: "daniel.okafor@example.com", country: "US", firstOrderDaysAgo: 8, ltv: 284 },
    outbound: {
      carrier: "UPS", service: "UPS Ground, signature required", tracking: "1Z84V6A90309861157", status: "DELIVERED", shippedDaysAgo: 7, deliveredDaysAgo: 4, signature: "D OKAFOR",
      qcPhoto: "Pre-dispatch QC photo: Weekender in Cognac, all panels and corners unmarked, timestamped at packing",
      scans: [[7, "Brooklyn, NY", "Picked up", "PICKUP"], [6, "Hodgkins, IL", "Damage reported: outer box crushed, re-taped at facility", "TRANSIT"], [4, "Chicago, IL 60640", "Out for delivery", "OUT_FOR_DELIVERY"], [4, "Chicago, IL 60640", "Delivered, signed by D OKAFOR", "DELIVERED"]],
    },
    thread: [{ daysAgo: 3, from: "customer", subject: "Scuff on the weekender", body: "The weekender arrived in a crushed box and there's a scuff about 2 cm long on the bottom corner. I really like the bag otherwise and would rather keep it. What can you do?" }],
    risk: { ...wallet, ip: { address: "98.215.77.40", city: "Chicago", region: "IL", country: "US" }, ip_to_shipping_km: 4, device: { id: "dv_3f88", seenBefore: false, firstSeenDaysAgo: 8 }, email_age_days: 1800, orders_last_24h: 1 },
  },
  {
    id: "snad-02",
    title: "Chargeback: the buyer ordered the clutch and got a tote, and the store's own packing photo shows the tote",
    expected: "REFUND",
    rationale: "The store's own pre-dispatch photo shows the wrong product went into the box and the buyer's two emails went unanswered; nothing in the records supports a fight, so accept and ask for the tote back.",
    dispute: {
      id: "PP-D-61290", reason: SNAD, stage: "CHARGEBACK", createdDaysAgo: 2, dueInDays: 8, subReasons: ["DIFFERENT"], requested: ["ITEM_DESCRIPTION", "OTHER"],
      options: { accept_claim: { accept_claim_types: ["REFUND", "REFUND_WITH_RETURN"] } },
      buyerMessages: [[2, "Received the wrong item. I ordered a clutch and got a tote. The seller never replied."]],
    },
    order: { no: "19449", txn: "0QE57731GV8814463", sku: "KA-CLU-SND", shipTo: addr("Priya Raman", "2231 Fillmore St", "San Francisco", "CA", "94115", "US") },
    buyer: { name: "Priya Raman", email: "priya.raman@example.com", country: "US", firstOrderDaysAgo: 14, ltv: 180 },
    outbound: {
      carrier: "USPS", service: "USPS Ground Advantage", tracking: "9400111899561239901142", status: "DELIVERED", shippedDaysAgo: 13, deliveredDaysAgo: 8,
      qcPhoto: "Pre-dispatch QC photo: Market Tote in Tan (KA-TOT-TAN) in the box labelled for this order",
      scans: [[13, "Brooklyn, NY 11201", "Shipping label created", "LABEL"], [13, "Brooklyn, NY", "Accepted at USPS origin facility", "PICKUP"], [10, "Denver, CO", "In transit to next facility", "TRANSIT"], [8, "San Francisco, CA 94115", "Out for delivery", "OUT_FOR_DELIVERY"], [8, "San Francisco, CA 94115", "Delivered, in/at mailbox", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 7, from: "customer", subject: "Wrong item", body: "I ordered the Weekend Clutch in Sand but the box had a tan tote in it. Could you send the clutch?" },
      { daysAgo: 5, from: "customer", subject: "Re: Wrong item", body: "Following up, no reply yet." },
    ],
    risk: { ...wallet, ip: { address: "76.21.144.9", city: "San Francisco", region: "CA", country: "US" }, ip_to_shipping_km: 2, device: { id: "dv_b504", seenBefore: false, firstSeenDaysAgo: 14 }, email_age_days: 1600, orders_last_24h: 1 },
  },
  {
    id: "snad-03",
    title: "Chargeback 47 days after delivery: \"it went darker\" after daily use; the listing and the terms say it will",
    expected: "FIGHT",
    rationale: "The listing ('tone ... deepens with use') and the terms accepted at checkout ('colors darken with light and use') disclose exactly this, the buyer used the tote daily for six weeks and the 30-day return window had passed; the item is as described.",
    dispute: {
      id: "PP-D-61305", reason: SNAD, stage: "CHARGEBACK", createdDaysAgo: 2, dueInDays: 8, subReasons: ["DIFFERENT"], requested: ["ITEM_DESCRIPTION", "OTHER"],
      options: { accept_claim: { accept_claim_types: ["REFUND", "REFUND_WITH_RETURN"] } },
      buyerMessages: [[2, "The bag's colour changed and it no longer matches the description."]],
    },
    order: { no: "17909", txn: "5AZ29946TB1187204", sku: "KA-TOT-TAN", shipTo: addr("Laura Bennett", "47 Garden St", "Hoboken", "NJ", "07030", "US") },
    buyer: { name: "Laura Bennett", email: "laura.bennett@example.com", country: "US", firstOrderDaysAgo: 53, ltv: 142 },
    outbound: {
      carrier: "UPS", service: "UPS Ground", tracking: "1Z84V6A90316640823", status: "DELIVERED", shippedDaysAgo: 52, deliveredDaysAgo: 49,
      scans: [[52, "Brooklyn, NY", "Picked up", "PICKUP"], [50, "Edison, NJ", "Departed facility", "TRANSIT"], [49, "Hoboken, NJ 07030", "Out for delivery", "OUT_FOR_DELIVERY"], [49, "Hoboken, NJ 07030", "Delivered, front door", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 5, from: "customer", subject: "Tote colour", body: "I've used the tote every day for about six weeks and it has gone noticeably darker, especially the handles. It doesn't look like the photos any more. I'd like to return it." },
      { daysAgo: 4, from: "merchant", subject: "Re: Tote colour", body: "Hi Laura, that deepening is the patina vegetable-tanned leather develops with use; it's described on the listing and in our terms. Our return window is 30 days from delivery for unused items, so we can't take this one back, but we're happy to send you a free leather conditioner." },
    ],
    risk: { ...wallet, ip: { address: "71.187.12.230", city: "Hoboken", region: "NJ", country: "US" }, ip_to_shipping_km: 2, device: { id: "dv_6d12", seenBefore: false, firstSeenDaysAgo: 53 }, email_age_days: 1900, orders_last_24h: 1 },
  },
  {
    id: "snad-04",
    title: "Inquiry: \"browner than the photos\" on arrival; the store explained hide variation and offered a return or 20% back, and she opened a case anyway",
    expected: "OFFER",
    rationale: "The terms disclose hide variation, so the store is not at fault, but the satchel is unused and inside the 30-day window, so the returns policy would refund it anyway; a formal offer (a return for a full refund, or a partial refund to keep it) is the cheapest fair close.",
    dispute: {
      id: "PP-D-61318", reason: SNAD, stage: "INQUIRY", createdDaysAgo: 1, dueInDays: 9, subReasons: ["DIFFERENT"], requested: [],
      options: { make_offer: { offer_types: ["REFUND", "REFUND_WITH_RETURN"] }, accept_claim: { accept_claim_types: ["REFUND", "REFUND_WITH_RETURN"] } },
      buyerMessages: [[1, "Colour is not as pictured. The satchel is much browner than the olive shown."]],
    },
    order: { no: "19723", txn: "3MH62285YC4409571", sku: "KA-MSG-OLV", shipTo: addr("Sofia Marchetti", "1402 South St", "Philadelphia", "PA", "19146", "US") },
    buyer: { name: "Sofia Marchetti", email: "sofia.marchetti@example.com", country: "US", firstOrderDaysAgo: 7, ltv: 212 },
    outbound: {
      carrier: "UPS", service: "UPS Ground", tracking: "1Z84V6A90320774416", status: "DELIVERED", shippedDaysAgo: 6, deliveredDaysAgo: 4,
      scans: [[6, "Brooklyn, NY", "Picked up", "PICKUP"], [5, "Edison, NJ", "Departed facility", "TRANSIT"], [4, "Philadelphia, PA 19146", "Out for delivery", "OUT_FOR_DELIVERY"], [4, "Philadelphia, PA 19146", "Delivered, front door", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 3, from: "customer", subject: "Satchel colour", body: "The satchel arrived but the olive is much browner than in your photos. I'm disappointed." },
      { daysAgo: 3, from: "merchant", subject: "Re: Satchel colour", body: "Thanks Sofia. Each hide takes the dye a little differently and our photos are shot in daylight, so tones vary. As it's unused and within 30 days, you can return it for a full refund with our prepaid label, or keep it with 20% back. Which would you prefer?" },
      { daysAgo: 2, from: "customer", subject: "Re: Satchel colour", body: "I'll think about it." },
    ],
    risk: { ...wallet, ip: { address: "108.52.30.181", city: "Philadelphia", region: "PA", country: "US" }, ip_to_shipping_km: 3, device: { id: "dv_c9a0", seenBefore: false, firstSeenDaysAgo: 7 }, email_age_days: 2200, orders_last_24h: 1 },
  },
  {
    id: "snad-05",
    title: "Inquiry: a handle's stitching came undone after two weeks; the buyer asks for a repair or a replacement",
    expected: "OFFER",
    rationale: "Stitching that fails after two weeks is a defect the returns policy promises to repair, replace or refund at the store's cost, and the buyer asked for a repair or replacement; a replacement offer is the fair close, a fight is wrong and a full refund gives more than she asked for.",
    dispute: {
      id: "PP-D-61324", reason: SNAD, stage: "INQUIRY", createdDaysAgo: 1, dueInDays: 9, subReasons: ["DAMAGED"], requested: [],
      options: { make_offer: { offer_types: ["REFUND", "REFUND_WITH_RETURN", "REFUND_WITH_REPLACEMENT", "REPLACEMENT_WITHOUT_REFUND"] }, accept_claim: { accept_claim_types: ["REFUND", "REFUND_WITH_RETURN"] } },
      buyerMessages: [[1, "The handle stitching came apart after two weeks. I'd like a replacement or a repair."]],
    },
    order: { no: "19216", txn: "8RF03367DS7752916", sku: "KA-TOT-TAN", shipTo: addr("Elena Petrova", "620 Michigan Ave, Apt 12", "Evanston", "IL", "60202", "US") },
    buyer: { name: "Elena Petrova", email: "elena.petrova@example.com", country: "US", firstOrderDaysAgo: 20, ltv: 142 },
    outbound: {
      carrier: "USPS", service: "USPS Ground Advantage", tracking: "9400111899561236670025", status: "DELIVERED", shippedDaysAgo: 19, deliveredDaysAgo: 16,
      scans: [[19, "Brooklyn, NY 11201", "Shipping label created", "LABEL"], [19, "Brooklyn, NY", "Accepted at USPS origin facility", "PICKUP"], [17, "Chicago, IL", "In transit to next facility", "TRANSIT"], [16, "Evanston, IL 60202", "Out for delivery", "OUT_FOR_DELIVERY"], [16, "Evanston, IL 60202", "Delivered, front door/porch", "DELIVERED"]],
    },
    thread: [{ daysAgo: 2, from: "customer", subject: "Handle stitching", body: "I've been using the tote for two weeks and the stitching on one handle has come undone where it joins the bag (photo attached). I love the bag; could you repair or replace it?" }],
    risk: { ...wallet, ip: { address: "67.175.88.102", city: "Evanston", region: "IL", country: "US" }, ip_to_shipping_km: 3, device: { id: "dv_2e47", seenBefore: false, firstSeenDaysAgo: 20 }, email_age_days: 2400, orders_last_24h: 1 },
  },

  // ---- Unauthorized -----------------------------------------------------------------------------
  {
    id: "unauth-01",
    title: "Card chargeback \"not authorized\" (10.4): AVS, CVV and 3-D Secure passed, a known device, and the buyer chatted about the bag after delivery",
    expected: "FIGHT",
    rationale: "Every checkout signal ties the cardholder to the purchase (AVS, CVV, 3-D Secure, a device seen for over a year, three earlier undisputed orders), UPS has his signature at his billing address, and he wrote to the store about the bag after it arrived.",
    dispute: { id: "PP-D-61337", reason: "UNAUTHORISED", stage: "CHARGEBACK", channel: "EXTERNAL", externalReasonCode: "10.4", createdDaysAgo: 3, dueInDays: 5, requested: ["PROOF_OF_FULFILLMENT", "OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } } },
    order: { no: "19101", txn: "6NL48820BW3361075", sku: "KA-DUF-CHS", funding: "CARD", shipTo: addr("Kevin Zhang", "3318 Wilshire Blvd, Unit 1204", "Los Angeles", "CA", "90010", "US"), billing: addr("Kevin Zhang", "3318 Wilshire Blvd, Unit 1204", "Los Angeles", "CA", "90010", "US") },
    buyer: { name: "Kevin Zhang", email: "kevin.zhang@example.com", country: "US", firstOrderDaysAgo: 380, priorOrders: 3, ltv: 1029 },
    outbound: {
      carrier: "UPS", service: "UPS Ground, signature required", tracking: "1Z84V6A90257731840", status: "DELIVERED", shippedDaysAgo: 22, deliveredDaysAgo: 18, signature: "K ZHANG",
      scans: [[22, "Brooklyn, NY", "Picked up", "PICKUP"], [20, "Albuquerque, NM", "Departed facility", "TRANSIT"], [18, "Los Angeles, CA 90010", "Out for delivery", "OUT_FOR_DELIVERY"], [18, "Los Angeles, CA 90010", "Delivered, signed by K ZHANG", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 16, from: "customer", channel: "chat", body: "The duffle is great. Will the shoe compartment fit size 12 sneakers?" },
      { daysAgo: 16, from: "merchant", channel: "chat", body: "It fits up to about a US 12, yes. Enjoy your trip!" },
    ],
    risk: { avs_result: "Y", cvv_result: "M", three_ds: "AUTHENTICATED", ip: { address: "47.144.18.70", city: "Los Angeles", region: "CA", country: "US" }, ip_to_shipping_km: 3, device: { id: "dv_91d5", seenBefore: true, firstSeenDaysAgo: 380 }, email_age_days: 3600, orders_last_24h: 1 },
  },
  {
    id: "unauth-02",
    title: "PayPal \"unauthorized\" claim: checkout from a new device in Romania, and the store re-routed the parcel to a freight forwarder on an emailed request",
    expected: "REFUND",
    rationale: "The parcel went to a freight forwarder the 'buyer' emailed after checkout, not to the transaction address, so Seller Protection is lost, and the checkout came from a new device in Romania 7,600 km from the account holder's address; the owner's claim is credible, so accept.",
    dispute: { id: "PP-D-61349", reason: "UNAUTHORISED", stage: "CHARGEBACK", createdDaysAgo: 2, dueInDays: 8, requested: ["PROOF_OF_FULFILLMENT", "OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[2, "I did not make this purchase. Someone got into my PayPal account."]] },
    order: { no: "19488", txn: "1XK75532PH9024488", sku: "KA-BRF-ESP", shipTo: addr("Margaret Holloway", "19 Chestnut Hill Rd", "Concord", "MA", "01742", "US") },
    buyer: { name: "Margaret Holloway", email: "margaret.holloway@example.com", country: "US", firstOrderDaysAgo: 13, ltv: 420 },
    outbound: {
      carrier: "UPS", service: "UPS Next Day Air (upgraded on request)", tracking: "1Z84V6A90263318876", status: "DELIVERED", shippedDaysAgo: 12, deliveredDaysAgo: 11,
      deliveredTo: addr("M Holloway c/o QuickShip Forwarding", "450 Industrial Pkwy, Unit 7", "New Castle", "DE", "19720", "US"), signature: "J. OSEI (RECEIVING)",
      scans: [[12, "Brooklyn, NY", "Picked up", "PICKUP"], [12, "Philadelphia, PA", "Departed facility", "TRANSIT"], [11, "New Castle, DE 19720", "Out for delivery", "OUT_FOR_DELIVERY"], [11, "New Castle, DE 19720", "Delivered, signed by J. OSEI (receiving dock)", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 13, from: "customer", subject: "Shipping address change", body: "Hi, please ship my briefcase to my office instead: M Holloway c/o QuickShip Forwarding, 450 Industrial Pkwy, Unit 7, New Castle DE 19720. I need it urgently, please send it overnight." },
      { daysAgo: 13, from: "merchant", subject: "Re: Shipping address change", body: "No problem, we've updated the address and upgraded you to Next Day Air." },
    ],
    risk: { ...wallet, ip: { address: "185.220.101.44", city: "Bucharest", country: "RO" }, ip_to_shipping_km: 7600, device: { id: "dv_f03b", seenBefore: false, firstSeenDaysAgo: 13 }, email_age_days: 4100, orders_last_24h: 1 },
  },
  {
    id: "unauth-03",
    title: "\"Unauthorized\" card chargeback with 3-D Secure passed, but USPS returned the parcel and it is back at the studio",
    expected: "REFUND",
    rationale: "Strong authentication (3-D Secure, AVS, CVV) cannot change that nothing was delivered: USPS returned the satchel and the store has it back, and keeping the payment for goods the store still holds is indefensible, whoever placed the order.",
    dispute: { id: "PP-D-61352", reason: "UNAUTHORISED", stage: "CHARGEBACK", channel: "EXTERNAL", externalReasonCode: "10.4", createdDaysAgo: 2, dueInDays: 6, requested: ["PROOF_OF_FULFILLMENT", "OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } } },
    order: { no: "18785", txn: "9DT16609MZ5578132", sku: "KA-MSG-OLV", funding: "CARD", shipTo: addr("Jason Whitfield", "1810 E Riverside Dr", "Austin", "TX", "78741", "US"), billing: addr("Jason Whitfield", "1810 E Riverside Dr", "Austin", "TX", "78741", "US") },
    buyer: { name: "Jason Whitfield", email: "jason.whitfield@example.com", country: "US", firstOrderDaysAgo: 31, ltv: 212 },
    outbound: {
      carrier: "USPS", service: "USPS Ground Advantage", tracking: "9400111899561240077315", status: "RETURNED_TO_SENDER", shippedDaysAgo: 30,
      scans: [[30, "Brooklyn, NY 11201", "Shipping label created", "LABEL"], [30, "Brooklyn, NY", "Accepted at USPS origin facility", "PICKUP"], [26, "Austin, TX 78741", "Undeliverable as addressed: insufficient address (no apartment or unit number)", "EXCEPTION"], [25, "Austin, TX", "Return to sender processed", "TRANSIT"], [20, "Brooklyn, NY 11201", "Delivered to sender (return)", "RETURNED"]],
    },
    thread: [],
    risk: { avs_result: "Y", cvv_result: "M", three_ds: "AUTHENTICATED", ip: { address: "70.112.63.25", city: "Austin", region: "TX", country: "US" }, ip_to_shipping_km: 2, device: { id: "dv_48a1", seenBefore: false, firstSeenDaysAgo: 31 }, email_age_days: 2000, orders_last_24h: 1 },
  },
  {
    id: "unauth-04",
    title: "PayPal \"unauthorized\" claim on a first order shipped, with tracking, to the account holder's own address: Seller Protection applies",
    expected: "FIGHT",
    rationale: "A PayPal-checkout payment shipped to the address on the transaction, with a verifiable USPS tracking number showing delivery, meets every published Seller Protection requirement for unauthorized claims, and the local IP and years-old email point to no fraud the store should concede.",
    dispute: { id: "PP-D-61366", reason: "UNAUTHORISED", stage: "CHARGEBACK", createdDaysAgo: 2, dueInDays: 8, requested: ["PROOF_OF_FULFILLMENT", "OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[2, "I don't recognize this transaction."]] },
    order: { no: "19372", txn: "2WG90043LR6615807", sku: "KA-BLT-COG", shipTo: addr("Brian Castillo", "742 Alder St", "Eugene", "OR", "97401", "US") },
    buyer: { name: "Brian Castillo", email: "brian.castillo@example.com", country: "US", firstOrderDaysAgo: 16, ltv: 96 },
    outbound: {
      carrier: "USPS", service: "USPS Ground Advantage", tracking: "9400111899561242210038", status: "DELIVERED", shippedDaysAgo: 15, deliveredDaysAgo: 11, deliveryPhoto: "Parcel in the mailbox at 742 Alder St",
      scans: [[15, "Brooklyn, NY 11201", "Shipping label created", "LABEL"], [15, "Brooklyn, NY", "Accepted at USPS origin facility", "PICKUP"], [13, "Salt Lake City, UT", "In transit to next facility", "TRANSIT"], [11, "Eugene, OR 97401", "Out for delivery", "OUT_FOR_DELIVERY"], [11, "Eugene, OR 97401", "Delivered, in/at mailbox", "DELIVERED"]],
    },
    thread: [],
    risk: { ...wallet, ip: { address: "73.96.222.15", city: "Eugene", region: "OR", country: "US" }, ip_to_shipping_km: 6, device: { id: "dv_7b2c", seenBefore: false, firstSeenDaysAgo: 16 }, email_age_days: 1100, orders_last_24h: 1 },
  },

  // ---- Duplicate charge -------------------------------------------------------------------------
  {
    id: "dup-01",
    title: "\"Charged twice\": two separate wallet orders three days apart, the second a gift for her father, both delivered",
    expected: "FIGHT",
    rationale: "The two charges are two orders placed three days apart and shipped to different people, and the buyer's own email asks for a gift note on the second; nothing was charged twice.",
    dispute: { id: "PP-D-61371", reason: "DUPLICATE_TRANSACTION", stage: "CHARGEBACK", createdDaysAgo: 3, dueInDays: 5, requested: ["OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[3, "I was charged twice for the same wallet ($68)."]] },
    order: { no: "19022", txn: "4BQ37718NJ0042961", sku: "KA-WAL-BLK", shipTo: addr("Robert Liu", "2816 J St", "Sacramento", "CA", "95816", "US") },
    buyer: { name: "Grace Liu", email: "grace.liu@example.com", country: "US", firstOrderDaysAgo: 28, otherOrders: ["KA-18897"], ltv: 136, notes: "Two wallet orders: KA-18897 (shipped to herself in San Jose) and KA-19022 (a gift shipped to her father, Robert Liu, in Sacramento), placed three days apart." },
    outbound: {
      carrier: "USPS", service: "USPS Ground Advantage", tracking: "9400111899561238814470", status: "DELIVERED", shippedDaysAgo: 24, deliveredDaysAgo: 20,
      scans: [[24, "Brooklyn, NY 11201", "Shipping label created", "LABEL"], [24, "Brooklyn, NY", "Accepted at USPS origin facility", "PICKUP"], [22, "Reno, NV", "In transit to next facility", "TRANSIT"], [20, "Sacramento, CA 95816", "Out for delivery", "OUT_FOR_DELIVERY"], [20, "Sacramento, CA 95816", "Delivered, in/at mailbox", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 25, from: "customer", subject: "Gift note for KA-19022", body: "Loved my wallet so much I just ordered a second one for my dad's birthday (KA-19022). Could you add a note: 'Happy birthday, Dad'?" },
      { daysAgo: 25, from: "merchant", subject: "Re: Gift note for KA-19022", body: "Done! Gift note added to KA-19022. Happy birthday to your dad." },
    ],
    risk: { ...wallet, ip: { address: "73.162.41.88", city: "San Jose", region: "CA", country: "US" }, ip_to_shipping_km: 150, device: { id: "dv_d6e0", seenBefore: true, firstSeenDaysAgo: 28 }, email_age_days: 2600, orders_last_24h: 1 },
  },
  {
    id: "dup-02",
    title: "A real double charge: the same cart paid twice 40 seconds apart, only one clutch shipped",
    expected: "REFUND",
    rationale: "Same cart, same address, paid twice 40 seconds apart and only one clutch shipped; the store flagged the duplicate itself and never refunded it, so the buyer is right.",
    dispute: { id: "PP-D-61385", reason: "DUPLICATE_TRANSACTION", stage: "CHARGEBACK", createdDaysAgo: 2, dueInDays: 8, requested: ["OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[2, "Charged twice for one clutch. I only received one."]] },
    order: { no: "19413", txn: "7YU22846CK3390514", sku: "KA-CLU-SND", placedDaysAgo: 15, shipTo: addr("Omar Haddad", "1520 Commonwealth Ave, Apt 4", "Boston", "MA", "02135", "US") },
    buyer: { name: "Omar Haddad", email: "omar.haddad@example.com", country: "US", firstOrderDaysAgo: 15, otherOrders: ["KA-19412"], ltv: 360, notes: "KA-19412 and KA-19413 are identical orders placed 40 seconds apart (same cart, same address). KA-19412 shipped; KA-19413 was flagged as a possible duplicate checkout and not shipped." },
    outbound: null,
    thread: [
      { daysAgo: 12, from: "customer", subject: "Charged twice?", body: "I think I was charged twice for the clutch: my PayPal shows two $180 payments a minute apart. I only want one." },
      { daysAgo: 12, from: "merchant", subject: "Re: Charged twice?", body: "Thanks Omar, we'll look into it." },
    ],
    risk: { ...wallet, ip: { address: "65.96.120.7", city: "Boston", region: "MA", country: "US" }, ip_to_shipping_km: 3, device: { id: "dv_0a93", seenBefore: false, firstSeenDaysAgo: 15 }, email_age_days: 1900, orders_last_24h: 2 },
  },
  {
    id: "dup-03",
    title: "Inquiry: \"billed twice for the belt\": two orders two days apart, both delivered to him; his own email calls the second a spare",
    expected: "MESSAGE_BUYER",
    rationale: "Inquiry stage, and the two charges are two orders he placed himself (his own email calls the second belt a spare), both delivered; he needs a reminder with both order numbers, not a refund or a formal fight.",
    dispute: { id: "PP-D-61394", reason: "DUPLICATE_TRANSACTION", stage: "INQUIRY", createdDaysAgo: 1, dueInDays: 9, requested: [], options: { make_offer: { offer_types: ["REFUND"] }, accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[1, "I see two charges of $96 for a belt. I think I was billed twice."]] },
    order: { no: "19334", txn: "3EP58017VA8826349", sku: "KA-BLT-COG", shipTo: addr("Samuel Adeyemi", "908 Heights Blvd", "Houston", "TX", "77008", "US") },
    buyer: { name: "Samuel Adeyemi", email: "samuel.adeyemi@example.com", country: "US", firstOrderDaysAgo: 19, otherOrders: ["KA-19251"], ltv: 192, notes: "Two Classic Belt orders: KA-19251 and KA-19334, placed two days apart, both shipped to his home address." },
    outbound: {
      carrier: "UPS", service: "UPS Ground", tracking: "1Z84V6A90335107762", status: "DELIVERED", shippedDaysAgo: 16, deliveredDaysAgo: 12,
      scans: [[16, "Brooklyn, NY", "Picked up", "PICKUP"], [14, "Memphis, TN", "Departed facility", "TRANSIT"], [12, "Houston, TX 77008", "Out for delivery", "OUT_FOR_DELIVERY"], [12, "Houston, TX 77008", "Delivered, front porch", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 17, from: "customer", subject: "Second belt", body: "The first belt fits perfectly. I've just ordered a second one in the same colour as a spare. Thanks!" },
      { daysAgo: 17, from: "merchant", subject: "Re: Second belt", body: "Thanks Samuel! It's made to order and ships in 2 business days." },
    ],
    risk: { ...wallet, ip: { address: "99.62.17.240", city: "Houston", region: "TX", country: "US" }, ip_to_shipping_km: 5, device: { id: "dv_5c71", seenBefore: true, firstSeenDaysAgo: 19 }, email_age_days: 2300, orders_last_24h: 1 },
  },

  // ---- Credit not processed ---------------------------------------------------------------------
  {
    id: "cnp-01",
    title: "Return delivered to the studio six days ago (signed for by staff); refund still not issued",
    expected: "REFUND",
    rationale: "The return reached the studio six days ago, signed for by staff and well inside the 30-day window, and the policy promises a refund within 3 business days of arrival; the refund is owed, so issue it now and file the proof.",
    dispute: { id: "PP-D-61402", reason: "CREDIT_NOT_PROCESSED", stage: "CHARGEBACK", createdDaysAgo: 1, dueInDays: 9, requested: ["PROOF_OF_REFUND", "OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[1, "I returned the duffle and the seller received it almost a week ago. Still no refund."]] },
    order: { no: "18747", txn: "5KS81139GT4407726", sku: "KA-DUF-CHS", shipTo: addr("Isabel Navarro", "3400 N Lake Shore Dr, Apt 9F", "Chicago", "IL", "60657", "US") },
    buyer: { name: "Isabel Navarro", email: "isabel.navarro@example.com", country: "US", firstOrderDaysAgo: 200, priorOrders: 2, ltv: 777 },
    outbound: {
      carrier: "UPS", service: "UPS Ground, signature required", tracking: "1Z84V6A90278841109", status: "DELIVERED", shippedDaysAgo: 31, deliveredDaysAgo: 28, signature: "I NAVARRO",
      scans: [[31, "Brooklyn, NY", "Picked up", "PICKUP"], [29, "Hodgkins, IL", "Departed facility", "TRANSIT"], [28, "Chicago, IL 60657", "Out for delivery", "OUT_FOR_DELIVERY"], [28, "Chicago, IL 60657", "Delivered, signed by I NAVARRO", "DELIVERED"]],
    },
    returned: {
      carrier: "UPS", service: "UPS Ground (prepaid return label)", tracking: "1Z84V6A99016652283", status: "DELIVERED", shippedDaysAgo: 10, deliveredDaysAgo: 6, signature: "K. NAIR",
      scans: [[10, "Chicago, IL", "Return picked up", "PICKUP"], [8, "Harrisburg, PA", "Departed facility", "TRANSIT"], [6, "Brooklyn, NY 11201", "Delivered to Kora Atelier, received by K. NAIR", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 14, from: "customer", subject: "Return", body: "I'd like to return the duffle. It's bigger than I expected. Unused, with the tags on." },
      { daysAgo: 14, from: "merchant", subject: "Re: Return", body: "Of course. Here's your prepaid UPS return label. We refund within 3 business days of the return reaching our studio." },
      { daysAgo: 3, from: "customer", subject: "Re: Return", body: "UPS shows you received it three days ago. Still no refund. Can you check?" },
    ],
    risk: { ...wallet, ip: { address: "73.247.103.66", city: "Chicago", region: "IL", country: "US" }, ip_to_shipping_km: 3, device: { id: "dv_8e15", seenBefore: true, firstSeenDaysAgo: 200 }, email_age_days: 3000, orders_last_24h: 1 },
  },
  {
    id: "cnp-02",
    title: "Credit-not-processed chargeback, but the full refund went out with a PayPal refund ID three days before the case opened",
    expected: "FIGHT",
    rationale: "The full $420 refund was issued four days ago with a PayPal refund ID, three days before the case opened, and the buyer's card statement just hasn't caught up; refunding again would pay twice, so file the proof of refund.",
    dispute: { id: "PP-D-61419", reason: "CREDIT_NOT_PROCESSED", stage: "CHARGEBACK", createdDaysAgo: 1, dueInDays: 9, requested: ["PROOF_OF_REFUND", "OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[1, "I returned the briefcase and never got my refund."]] },
    order: { no: "18668", txn: "8ZA06657HE1153390", sku: "KA-BRF-ESP", shipTo: addr("Thomas Reed", "88 Beacon St, Apt 3", "Boston", "MA", "02108", "US"), refunds: [{ id: "7HV41930LS2208415", amount: 420, daysAgo: 4 }] },
    buyer: { name: "Thomas Reed", email: "thomas.reed@example.com", country: "US", firstOrderDaysAgo: 150, priorOrders: 1, ltv: 68 },
    outbound: {
      carrier: "UPS", service: "UPS Ground, signature required", tracking: "1Z84V6A90281173356", status: "DELIVERED", shippedDaysAgo: 33, deliveredDaysAgo: 30, signature: "T REED",
      scans: [[33, "Brooklyn, NY", "Picked up", "PICKUP"], [31, "Hartford, CT", "Departed facility", "TRANSIT"], [30, "Boston, MA 02108", "Out for delivery", "OUT_FOR_DELIVERY"], [30, "Boston, MA 02108", "Delivered, signed by T REED", "DELIVERED"]],
    },
    returned: {
      carrier: "UPS", service: "UPS Ground (prepaid return label)", tracking: "1Z84V6A99017739914", status: "DELIVERED", shippedDaysAgo: 9, deliveredDaysAgo: 5, signature: "K. NAIR",
      scans: [[9, "Boston, MA", "Return picked up", "PICKUP"], [7, "Hartford, CT", "Departed facility", "TRANSIT"], [5, "Brooklyn, NY 11201", "Delivered to Kora Atelier, received by K. NAIR", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 12, from: "customer", subject: "Return", body: "I'm returning the briefcase; it's not quite right for my work." },
      { daysAgo: 12, from: "merchant", subject: "Re: Return", body: "Prepaid label attached. We refund within 3 business days of the return reaching us." },
      { daysAgo: 4, from: "merchant", subject: "Your refund", body: "Your return arrived and we've issued a full refund of $420.00 to your PayPal account (refund ID 7HV41930LS2208415). It can take a few days to show on your card statement." },
      { daysAgo: 2, from: "customer", subject: "Re: Your refund", body: "I don't see anything on my card statement yet." },
    ],
    risk: { ...wallet, ip: { address: "73.38.211.140", city: "Boston", region: "MA", country: "US" }, ip_to_shipping_km: 2, device: { id: "dv_4d6f", seenBefore: true, firstSeenDaysAgo: 150 }, email_age_days: 2800, orders_last_24h: 1 },
  },
  {
    id: "cnp-03",
    title: "\"I returned it\": no return was started and nothing arrived; she asked 42 days after delivery and was told the window had closed",
    expected: "FIGHT",
    rationale: "No return was authorised or received (there is no return shipment), the buyer asked 42 days after delivery and was told the 30-day window had closed, and the case shows no return tracking; no credit is due.",
    dispute: { id: "PP-D-61425", reason: "CREDIT_NOT_PROCESSED", stage: "CHARGEBACK", createdDaysAgo: 2, dueInDays: 8, requested: ["PROOF_OF_REFUND", "OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[2, "I returned the bag but never got my refund."]] },
    order: { no: "17230", txn: "0LC43398WB7768201", sku: "KA-WKD-COG", shipTo: addr("Nicole Dumont", "2290 Lake Ave", "Rochester", "NY", "14612", "US") },
    buyer: { name: "Nicole Dumont", email: "nicole.dumont@example.com", country: "US", firstOrderDaysAgo: 70, ltv: 284 },
    outbound: {
      carrier: "UPS", service: "UPS Ground, signature required", tracking: "1Z84V6A90296622418", status: "DELIVERED", shippedDaysAgo: 69, deliveredDaysAgo: 66, signature: "N DUMONT",
      scans: [[69, "Brooklyn, NY", "Picked up", "PICKUP"], [67, "Syracuse, NY", "Departed facility", "TRANSIT"], [66, "Rochester, NY 14612", "Out for delivery", "OUT_FOR_DELIVERY"], [66, "Rochester, NY 14612", "Delivered, signed by N DUMONT", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 24, from: "customer", subject: "Return?", body: "Can I still return the weekender? I haven't used it much." },
      { daysAgo: 23, from: "merchant", subject: "Re: Return?", body: "Hi Nicole, our return window is 30 days from delivery and yours closed almost two weeks ago, so we can't accept a return, sorry. If anything is wrong with the bag, let us know and we'll repair it." },
    ],
    risk: { ...wallet, ip: { address: "67.246.90.12", city: "Rochester", region: "NY", country: "US" }, ip_to_shipping_km: 4, device: { id: "dv_a1c8", seenBefore: false, firstSeenDaysAgo: 70 }, email_age_days: 1700, orders_last_24h: 1 },
  },
  {
    id: "cnp-04",
    title: "Inquiry: the return was posted two days ago on the store's prepaid label and is still in transit; the buyer wants the refund now",
    expected: "MESSAGE_BUYER",
    rationale: "Inquiry stage, and the return is moving on the store's prepaid label but has not arrived, while the policy refunds within 3 business days of arrival; a message with the tracking and the refund timing answers her, since nothing is owed yet and there is nothing to fight.",
    dispute: { id: "PP-D-61437", reason: "CREDIT_NOT_PROCESSED", stage: "INQUIRY", createdDaysAgo: 1, dueInDays: 9, requested: [], options: { make_offer: { offer_types: ["REFUND"] }, accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[1, "I returned the item and haven't been refunded."]] },
    order: { no: "19140", txn: "6TF29914QN5530684", sku: "KA-MSG-OLV", shipTo: addr("Chloe Anderson", "1650 Neil Ave", "Columbus", "OH", "43201", "US") },
    buyer: { name: "Chloe Anderson", email: "chloe.anderson@example.com", country: "US", firstOrderDaysAgo: 22, ltv: 212 },
    outbound: {
      carrier: "USPS", service: "USPS Ground Advantage", tracking: "9400111899561241156637", status: "DELIVERED", shippedDaysAgo: 21, deliveredDaysAgo: 18,
      scans: [[21, "Brooklyn, NY 11201", "Shipping label created", "LABEL"], [21, "Brooklyn, NY", "Accepted at USPS origin facility", "PICKUP"], [19, "Pittsburgh, PA", "In transit to next facility", "TRANSIT"], [18, "Columbus, OH 43201", "Out for delivery", "OUT_FOR_DELIVERY"], [18, "Columbus, OH 43201", "Delivered, front door/porch", "DELIVERED"]],
    },
    returned: {
      carrier: "USPS", service: "USPS Ground Advantage (prepaid return label)", tracking: "9202090111899561248830", status: "IN_TRANSIT", shippedDaysAgo: 2,
      scans: [[2, "Columbus, OH 43201", "Accepted at USPS origin facility", "PICKUP"], [1, "Pittsburgh, PA", "In transit to next facility", "TRANSIT"]],
    },
    thread: [
      { daysAgo: 5, from: "customer", subject: "Return", body: "I'd like to return the satchel; it's not quite my style." },
      { daysAgo: 5, from: "merchant", subject: "Re: Return", body: "No problem. Here's a prepaid USPS label. We refund within 3 business days of the parcel reaching our studio." },
      { daysAgo: 1, from: "customer", subject: "Re: Return", body: "I sent it back yesterday. When do I get my money?" },
    ],
    risk: { ...wallet, ip: { address: "74.140.22.91", city: "Columbus", region: "OH", country: "US" }, ip_to_shipping_km: 3, device: { id: "dv_67e2", seenBefore: false, firstSeenDaysAgo: 22 }, email_age_days: 1400, orders_last_24h: 1 },
  },
  {
    id: "cnp-05",
    title: "Inquiry: the return arrived visibly used (worn strap, scuffs, stained lining); the policy refunds unused items only",
    expected: "OFFER",
    rationale: "The return did arrive inside 30 days, but the inspection photo shows real wear and the policy refunds unused items in original condition, so neither a full refund nor a flat refusal is fair while the store holds the bag; a partial refund offer is the middle ground.",
    dispute: { id: "PP-D-61448", reason: "CREDIT_NOT_PROCESSED", stage: "INQUIRY", createdDaysAgo: 1, dueInDays: 9, requested: [], options: { make_offer: { offer_types: ["REFUND", "REFUND_WITH_RETURN"] }, accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[1, "I returned the bag and the seller refuses to refund the full amount."]] },
    order: { no: "18786", txn: "2HM77052DX9917436", sku: "KA-WKD-COG", shipTo: addr("Ryan Gallagher", "5530 Walnut St", "Pittsburgh", "PA", "15232", "US") },
    buyer: { name: "Ryan Gallagher", email: "ryan.gallagher@example.com", country: "US", firstOrderDaysAgo: 31, ltv: 284 },
    outbound: {
      carrier: "UPS", service: "UPS Ground, signature required", tracking: "1Z84V6A90299418805", status: "DELIVERED", shippedDaysAgo: 30, deliveredDaysAgo: 27, signature: "R GALLAGHER",
      scans: [[30, "Brooklyn, NY", "Picked up", "PICKUP"], [28, "Harrisburg, PA", "Departed facility", "TRANSIT"], [27, "Pittsburgh, PA 15232", "Out for delivery", "OUT_FOR_DELIVERY"], [27, "Pittsburgh, PA 15232", "Delivered, signed by R GALLAGHER", "DELIVERED"]],
    },
    returned: {
      carrier: "UPS", service: "UPS Ground (prepaid return label)", tracking: "1Z84V6A99018826631", status: "DELIVERED", shippedDaysAgo: 7, deliveredDaysAgo: 4, signature: "K. NAIR",
      qcPhoto: "Return inspection photo: shoulder strap creased and worn, two scuffs on the base, interior lining stained",
      scans: [[7, "Pittsburgh, PA", "Return picked up", "PICKUP"], [6, "Harrisburg, PA", "Departed facility", "TRANSIT"], [4, "Brooklyn, NY 11201", "Delivered to Kora Atelier, received by K. NAIR", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 9, from: "customer", subject: "Return", body: "I want to return the weekender." },
      { daysAgo: 9, from: "merchant", subject: "Re: Return", body: "Sure, prepaid label attached. Please send it back unused, in its original condition." },
      { daysAgo: 3, from: "merchant", subject: "Your return", body: "Hi Ryan, the bag arrived with a worn strap, scuffs on the base and a stained lining, so we can't resell it as new. Our policy refunds unused items, so we can refund 60% ($170.40) or send the bag back to you at no cost. Let us know which you prefer." },
      { daysAgo: 2, from: "customer", subject: "Re: Your return", body: "It was barely used. I want my full refund." },
    ],
    risk: { ...wallet, ip: { address: "71.206.140.33", city: "Pittsburgh", region: "PA", country: "US" }, ip_to_shipping_km: 4, device: { id: "dv_93b6", seenBefore: false, firstSeenDaysAgo: 31 }, email_age_days: 2600, orders_last_24h: 1 },
  },

  // ---- Incorrect amount -------------------------------------------------------------------------
  {
    id: "amt-01",
    title: "Charged for two belts, one made and shipped; the store promised in writing to refund the extra $96 and didn't",
    expected: "REFUND",
    rationale: "The store charged for two belts, made and shipped one, and promised in writing to refund the extra $96, and no refund exists on the order; the disputed $96 is owed.",
    dispute: { id: "PP-D-61453", reason: "INCORRECT_AMOUNT", stage: "CHARGEBACK", createdDaysAgo: 2, dueInDays: 8, amount: 96, requested: ["DETAILS_OF_PURCHASE", "OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[2, "I was charged $192 for one belt. The seller promised to refund $96 and never did."]] },
    order: { no: "19023", txn: "9PV15528JR4486013", sku: "KA-BLT-COG", qty: 2, shipTo: addr("Andre Mitchell", "2510 Belmont Blvd", "Nashville", "TN", "37212", "US") },
    buyer: { name: "Andre Mitchell", email: "andre.mitchell@example.com", country: "US", firstOrderDaysAgo: 25, ltv: 192 },
    outbound: {
      carrier: "UPS", service: "UPS Ground", tracking: "1Z84V6A90304458127", status: "DELIVERED", shippedDaysAgo: 24, deliveredDaysAgo: 20,
      scans: [[24, "Brooklyn, NY", "Picked up", "PICKUP"], [22, "Louisville, KY", "Departed facility", "TRANSIT"], [20, "Nashville, TN 37212", "Out for delivery", "OUT_FOR_DELIVERY"], [20, "Nashville, TN 37212", "Delivered, front door", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 25, from: "customer", subject: "Charged for two belts", body: "I ordered one Classic Belt but my PayPal shows $192 and the order says quantity 2. I only wanted one." },
      { daysAgo: 25, from: "merchant", subject: "Re: Charged for two belts", body: "Sorry Andre, our checkout doubled the line. We'll make and ship one belt and refund the extra $96 today." },
      { daysAgo: 9, from: "customer", subject: "Re: Charged for two belts", body: "The belt arrived and I love it. But I still don't see the $96 refund." },
    ],
    risk: { ...wallet, ip: { address: "69.137.48.200", city: "Nashville", region: "TN", country: "US" }, ip_to_shipping_km: 4, device: { id: "dv_1f5a", seenBefore: false, firstSeenDaysAgo: 25 }, email_age_days: 1200, orders_last_24h: 1 },
  },
  {
    id: "amt-02",
    title: "Inquiry from a UK buyer: her card statement in pounds (with a foreign-transaction fee) is higher than the dollar price she saw",
    expected: "MESSAGE_BUYER",
    rationale: "Inquiry stage, and the store charged exactly $166.00, the listed price plus international shipping; the gap in pounds is her card's conversion rate and foreign-transaction fee, which the store neither sets nor receives, so a clear message resolves it.",
    dispute: { id: "PP-D-61467", reason: "INCORRECT_AMOUNT", stage: "INQUIRY", createdDaysAgo: 1, dueInDays: 9, amount: 8.75, requested: [], options: { make_offer: { offer_types: ["REFUND"] }, accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[1, "My card was charged £134.71 but the tote was listed at $166 including shipping, which is about £128. I've been overcharged."]] },
    order: { no: "19566", txn: "4CW60381KM2234759", sku: "KA-TOT-TAN", funding: "CARD", shipTo: addr("Harriet Cole", "27 Elm Grove", "Bristol", undefined, "BS6 6AH", "GB"), billing: addr("Harriet Cole", "27 Elm Grove", "Bristol", undefined, "BS6 6AH", "GB") },
    buyer: { name: "Harriet Cole", email: "harriet.cole@example.co.uk", country: "GB", firstOrderDaysAgo: 11, ltv: 166 },
    outbound: {
      carrier: "DHL", service: "DHL Express Worldwide", tracking: "5521893374", status: "DELIVERED", shippedDaysAgo: 10, deliveredDaysAgo: 6,
      scans: [[10, "New York, NY", "Shipment picked up", "PICKUP"], [9, "Cincinnati Hub, OH", "Departed facility", "TRANSIT"], [7, "East Midlands, GB", "Customs cleared", "TRANSIT"], [6, "Bristol, GB BS6", "Delivered", "DELIVERED"]],
    },
    thread: [],
    risk: { avs_result: "Y", cvv_result: "M", three_ds: "AUTHENTICATED", ip: { address: "86.140.22.17", city: "Bristol", country: "GB" }, ip_to_shipping_km: 2, device: { id: "dv_be22", seenBefore: false, firstSeenDaysAgo: 11 }, email_age_days: 1800, orders_last_24h: 1 },
  },
  {
    id: "amt-03",
    title: "Chargeback claiming a 40% code should have applied; the code came from an account that isn't the store's, and the price was as listed",
    expected: "FIGHT",
    rationale: "She was charged exactly the listed $284 she saw and accepted at checkout, and the 40% code came from an account that isn't the store's, as the store told her in writing; nothing was charged in error.",
    dispute: { id: "PP-D-61472", reason: "INCORRECT_AMOUNT", stage: "CHARGEBACK", createdDaysAgo: 3, dueInDays: 7, amount: 113.6, requested: ["DETAILS_OF_PURCHASE", "OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[3, "I was charged full price. The advertised 40% discount was not applied."]] },
    order: { no: "19217", txn: "7SB98845FZ6650127", sku: "KA-WKD-COG", shipTo: addr("Jessica Park", "1201 Harmon Pl, Apt 803", "Minneapolis", "MN", "55403", "US") },
    buyer: { name: "Jessica Park", email: "jessica.park@example.com", country: "US", firstOrderDaysAgo: 20, ltv: 284 },
    outbound: {
      carrier: "UPS", service: "UPS Ground, signature required", tracking: "1Z84V6A90308816642", status: "DELIVERED", shippedDaysAgo: 19, deliveredDaysAgo: 15, signature: "J PARK",
      scans: [[19, "Brooklyn, NY", "Picked up", "PICKUP"], [17, "Hodgkins, IL", "Departed facility", "TRANSIT"], [15, "Minneapolis, MN 55403", "Out for delivery", "OUT_FOR_DELIVERY"], [15, "Minneapolis, MN 55403", "Delivered, signed by J PARK", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 20, from: "customer", subject: "Discount code", body: "Your code KORA40 from Instagram didn't work at checkout, so I paid full price. Can you refund the 40%?" },
      { daysAgo: 20, from: "merchant", subject: "Re: Discount code", body: "Hi Jessica, KORA40 isn't one of our codes. The account advertising it isn't ours (we've reported it), and we aren't running a sale. The Weekender is $284 as listed. Sorry for the confusion!" },
      { daysAgo: 19, from: "customer", subject: "Re: Discount code", body: "That's not fair. I'll take it up with PayPal." },
    ],
    risk: { ...wallet, ip: { address: "73.65.140.211", city: "Minneapolis", region: "MN", country: "US" }, ip_to_shipping_km: 3, device: { id: "dv_ce49", seenBefore: false, firstSeenDaysAgo: 20 }, email_age_days: 1500, orders_last_24h: 1 },
  },

  // ---- Paid by other means ----------------------------------------------------------------------
  {
    id: "pbom-01",
    title: "Paid twice for one order (PayPal, then card when checkout seemed to hang); the store agreed to refund the PayPal payment and never did",
    expected: "REFUND",
    rationale: "The store's own records show the order was paid through PayPal and again by card, and the store agreed in writing to refund the PayPal payment but never did; the buyer is owed it.",
    dispute: { id: "PP-D-61486", reason: "PAYMENT_BY_OTHER_MEANS", stage: "CHARGEBACK", createdDaysAgo: 2, dueInDays: 8, requested: ["DETAILS_OF_PURCHASE", "OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[2, "I paid for this order twice, once by card on the seller's website. The seller hasn't refunded the PayPal payment."]] },
    order: { no: "19335", txn: "1NR34419TC8807352", sku: "KA-WAL-BLK", shipTo: addr("Fatima Rahman", "411 Pine St, Apt 1407", "Seattle", "WA", "98101", "US") },
    buyer: { name: "Fatima Rahman", email: "fatima.rahman@example.com", country: "US", firstOrderDaysAgo: 17, ltv: 68, notes: "Order KA-19335 was paid twice: through PayPal and, three minutes later, by card on the website's card checkout." },
    outbound: {
      carrier: "USPS", service: "USPS Ground Advantage", tracking: "9400111899561243381196", status: "DELIVERED", shippedDaysAgo: 16, deliveredDaysAgo: 12,
      scans: [[16, "Brooklyn, NY 11201", "Shipping label created", "LABEL"], [16, "Brooklyn, NY", "Accepted at USPS origin facility", "PICKUP"], [14, "Spokane, WA", "In transit to next facility", "TRANSIT"], [12, "Seattle, WA 98101", "Out for delivery", "OUT_FOR_DELIVERY"], [12, "Seattle, WA 98101", "Delivered, parcel locker in lobby", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 17, from: "customer", subject: "Charged twice", body: "PayPal looked like it froze, so I paid again by card, and now I've been charged twice for the wallet. Could you refund one?" },
      { daysAgo: 17, from: "merchant", subject: "Re: Charged twice", body: "We can see both payments, sorry about that! We'll refund the PayPal one." },
      { daysAgo: 6, from: "customer", subject: "Re: Charged twice", body: "The wallet arrived, thanks. Still waiting on that refund though." },
    ],
    risk: { ...wallet, ip: { address: "24.18.77.150", city: "Seattle", region: "WA", country: "US" }, ip_to_shipping_km: 2, device: { id: "dv_2a8d", seenBefore: false, firstSeenDaysAgo: 17 }, email_age_days: 1300, orders_last_24h: 1 },
  },
  {
    id: "pbom-02",
    title: "\"Already paid another way\": the card payment was for a belt bought in person at a pop-up; this PayPal order is a tote, delivered",
    expected: "FIGHT",
    rationale: "The card payment was for a different item (a belt bought in person at the pop-up); this PayPal payment is for the tote she then ordered online, in her own words because the stall had sold out, and it was delivered, so each purchase was paid once.",
    dispute: { id: "PP-D-61491", reason: "PAYMENT_BY_OTHER_MEANS", stage: "CHARGEBACK", createdDaysAgo: 3, dueInDays: 7, requested: ["DETAILS_OF_PURCHASE", "OTHER"], options: { accept_claim: { accept_claim_types: ["REFUND"] } }, buyerMessages: [[3, "I already paid this seller by card. This PayPal charge is a second payment for the same thing."]] },
    order: { no: "18984", txn: "5GX02276WH3318640", sku: "KA-TOT-TAN", shipTo: addr("Leah Goldstein", "245 Eastern Pkwy, Apt 5D", "Brooklyn", "NY", "11238", "US") },
    buyer: { name: "Leah Goldstein", email: "leah.goldstein@example.com", country: "US", firstOrderDaysAgo: 30, ltv: 238, notes: "Also bought a Classic Belt in Cognac ($96, card) in person at the Brooklyn Flea pop-up, four days before placing online order KA-18984 (Market Tote in Tan)." },
    outbound: {
      carrier: "USPS", service: "USPS Ground Advantage", tracking: "9400111899561237725519", status: "DELIVERED", shippedDaysAgo: 25, deliveredDaysAgo: 22,
      scans: [[25, "Brooklyn, NY 11201", "Shipping label created", "LABEL"], [25, "Brooklyn, NY", "Accepted at USPS origin facility", "PICKUP"], [23, "Brooklyn, NY 11238", "Out for delivery", "OUT_FOR_DELIVERY"], [22, "Brooklyn, NY 11238", "Delivered, in/at mailbox", "DELIVERED"]],
    },
    thread: [
      { daysAgo: 26, from: "customer", subject: "Tote", body: "Loved meeting you at the Flea last weekend! I'm ordering the tote online now, since you'd sold out of the tan one at the stall." },
      { daysAgo: 26, from: "merchant", subject: "Re: Tote", body: "So glad you found us! Your tote ships within 2 business days." },
    ],
    risk: { ...wallet, ip: { address: "108.41.19.64", city: "Brooklyn", region: "NY", country: "US" }, ip_to_shipping_km: 3, device: { id: "dv_f5e3", seenBefore: false, firstSeenDaysAgo: 30 }, email_age_days: 2700, orders_last_24h: 1 },
  },
];

// ---- Builder: a case in the demo store's scenario format ---------------------------------------

const CARRIER_URL: Record<Shipment["carrier"], (n: string) => string> = {
  UPS: (n) => `https://www.ups.com/track?tracknum=${n}`,
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`,
  FEDEX: (n) => `https://www.fedex.com/fedextrack/?trknbr=${n}`,
  DHL: (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${n}`,
  DHL_DEUTSCHE_POST: (n) => `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${n}`,
  ROYAL_MAIL: (n) => `https://www.royalmail.com/track-your-item#/tracking-results/${n}`,
};

/** Visa reason codes, as the demo scenarios carry them for sandbox seeding (unused by the eval). */
const REASON_CODE: Partial<Record<DisputeReason, string>> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "1310",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "1330",
  UNAUTHORISED: "1040",
  DUPLICATE_TRANSACTION: "1261",
  CREDIT_NOT_PROCESSED: "1360",
  INCORRECT_AMOUNT: "1250",
  PAYMENT_BY_OTHER_MEANS: "1262",
};

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.1 Safari/605.1.15";

const money = (v: number) => ({ currency_code: "USD", value: v.toFixed(2) });

function clock(base: Date) {
  return (daysAgo: number, hour = 12, minute = 0) => {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - daysAgo);
    d.setUTCHours(hour, minute, 0, 0);
    return d.toISOString().replace(".000Z", "Z");
  };
}

export function buildEvalCase(c: EvalCase, base: Date): ScenarioRecords {
  const at = clock(base);
  const p = PRODUCTS.find((x) => x.sku === c.order.sku);
  if (!p) throw new Error(`${c.id}: unknown sku ${c.order.sku}`);
  const qty = c.order.qty ?? 1;
  const subtotal = p.price * qty;
  const shippingCost = c.order.shipTo.country === "US" ? 0 : 24;
  const total = subtotal + shippingCost;
  const orderId = `KA-${c.order.no}`;
  const placedAt = at(c.order.placedDaysAgo ?? (c.outbound ? c.outbound.shippedDaysAgo + 1 : 1), 8, 12);

  const shipment = (id: string, direction: Shipment["direction"], s: ShipmentSpec): Shipment => {
    // Scan times rise through the day; the delivery scan uses the carrier's recorded delivery time.
    const events = s.scans.map(([d, location, description, code], i) => ({
      at: code === "DELIVERED" && d === s.deliveredDaysAgo ? at(d, 16, 52) : at(d, Math.min(9 + i * 2, 15), (i * 17) % 60),
      location,
      description,
      code,
    }));
    const delivered = s.deliveredDaysAgo;
    return {
      id,
      order_id: orderId,
      direction,
      carrier: s.carrier,
      service: s.service,
      tracking_number: s.tracking,
      tracking_url: CARRIER_URL[s.carrier](s.tracking),
      shipped_at: (events.find((e) => e.code === "PICKUP") ?? events[0]).at,
      delivered_at: delivered !== undefined ? at(delivered, 16, 52) : undefined,
      status: s.status,
      delivered_to: delivered !== undefined ? (s.deliveredTo ?? (direction === "OUTBOUND" ? c.order.shipTo : { ...MERCHANT.address })) : undefined,
      signature: s.signature && delivered !== undefined ? { name: s.signature, at: at(delivered, 16, 52) } : undefined,
      delivery_photo: s.deliveryPhoto,
      qc_photo: s.qcPhoto,
      events,
      pushed_to_paypal: true,
    };
  };
  const shipments: Shipment[] = [];
  if (c.outbound) shipments.push(shipment(`SHP-${c.order.no}`, "OUTBOUND", c.outbound));
  if (c.returned) shipments.push(shipment(`RTN-${c.order.no}`, "RETURN", c.returned));

  const order: Order = {
    id: orderId,
    placed_at: placedAt,
    currency: "USD",
    customer_email: c.buyer.email,
    items: [{ sku: p.sku, name: p.name, qty, unit_price: p.price }],
    subtotal,
    shipping_cost: shippingCost,
    tax: 0,
    total,
    shipping_address: c.order.shipTo,
    billing_address: c.order.billing,
    shipping_method: c.outbound?.service ?? (c.order.shipTo.country === "US" ? "USPS Ground Advantage" : "DHL Express Worldwide"),
    paypal: { order_id: `5O${c.order.txn.slice(2, 16)}`, capture_id: c.order.txn, invoice_id: orderId, funding: c.order.funding ?? "PAYPAL" },
    checkout: { ip: c.risk.ip.address, user_agent: UA, accepted_terms_at: placedAt, policies_version: "2026-03" },
    shipment_ids: shipments.map((s) => s.id),
    refunds: c.order.refunds?.map((r) => ({ id: r.id, amount: r.amount, at: at(r.daysAgo, 11, 40) })),
  };

  const d = c.dispute;
  const dispute: Dispute = {
    dispute_id: d.id,
    create_time: at(d.createdDaysAgo, 9, 31),
    update_time: at(d.createdDaysAgo, 10, 31),
    disputed_transactions: [
      {
        buyer_transaction_id: `9B${c.order.txn.slice(2)}`,
        seller_transaction_id: c.order.txn,
        create_time: placedAt,
        transaction_status: "COMPLETED",
        gross_amount: money(total),
        invoice_number: orderId,
        buyer: { name: c.buyer.name, email: c.buyer.email },
        seller: { email: MERCHANT.email, merchant_id: "KORAATELIER01", name: MERCHANT.name },
        items: [{ item_id: p.sku, item_name: p.name, item_quantity: String(qty), reason: d.reason }],
      },
    ],
    reason: d.reason,
    status: d.status ?? "WAITING_FOR_SELLER_RESPONSE",
    dispute_amount: money(d.amount ?? total),
    external_reason_code: d.externalReasonCode,
    dispute_life_cycle_stage: d.stage,
    dispute_channel: d.channel ?? "INTERNAL",
    messages: (d.buyerMessages ?? []).map(([daysAgo, content]) => ({ posted_by: "BUYER" as const, time_posted: at(daysAgo, 9, 40), content })),
    extensions: {
      merchant_contacted: c.thread.some((m) => m.from === "customer"),
      ...(d.subReasons ? { merchandize_dispute_properties: { issue_type: "PRODUCT", product_details: { product_received: "YES", sub_reasons: d.subReasons } } } : {}),
    },
    evidences: d.requested.map((t) => ({ evidence_type: t, source: "REQUESTED_FROM_SELLER" as const })),
    seller_response_due_date: at(-d.dueInDays, 23, 59),
    allowed_response_options: d.options,
    links: [],
  };

  const prior = Array.from({ length: c.buyer.priorOrders ?? 0 }, (_, i) => `KA-${Number(c.order.no) - 1200 - i * 233}`);
  const customer: Customer = {
    email: c.buyer.email,
    name: c.buyer.name,
    country: c.buyer.country,
    first_order_at: at(c.buyer.firstOrderDaysAgo, 8, 12),
    order_ids: [orderId, ...(c.buyer.otherOrders ?? []), ...prior],
    lifetime_value: c.buyer.ltv,
    prior_disputes: c.buyer.priorDisputes ?? 0,
    notes: c.buyer.notes,
  };

  const conversation: Conversation = {
    order_id: orderId,
    messages: c.thread.map((m, i) => ({ id: `MSG-${c.order.no}-${i + 1}`, at: at(m.daysAgo, Math.min(10 + i * 2, 21), 5), from: m.from, channel: m.channel ?? "email", subject: m.subject, body: m.body, language: m.language ?? "en" })),
  };

  const { device, ...signals } = c.risk;
  const risk: RiskSignals = { order_id: orderId, ...signals, device: { id: device.id, seen_before: device.seenBefore, first_seen: at(device.firstSeenDaysAgo, 8, 0) } };

  return {
    key: c.id,
    title: c.title,
    dispute,
    order,
    shipments,
    customer,
    conversation,
    risk,
    chargebackReasonCode: REASON_CODE[d.reason] ?? "",
    // Required by the scenario type; the harness never writes scenario metadata to the store.
    expectedOutcome: c.expected === "FIGHT" || c.expected === "MESSAGE_BUYER" ? "SELLER_FAVOR" : "BUYER_FAVOR",
  };
}

/** SHA-256 of every (id, expected, rationale): recorded with each run, so a later label change shows. */
export function labelsDigest(cases: EvalCase[] = EVAL_CASES) {
  return createHash("sha256")
    .update(JSON.stringify(cases.map((c) => [c.id, c.expected, c.rationale])))
    .digest("hex");
}
