// The Daniel Reyes response exactly as it was filed with PayPal on Nov 3, 2026, 02:39 UTC, and the AI agent's
// request that led to it. The call itself (time, HTTP status, latency, debug id), the run and the actor are in
// records/proof.json; this file adds what export.mjs does not export: the brief's full response letter and
// exhibit list (runs.run_00a4c818-1a0) and the approval row (approvals.apv_348c2c7423), copied read-only from
// .data/exhibit-sandbox.db on Nov 3, 2026. The customer ref is shortened to customer:history, as export.mjs
// does, so no buyer email is published. Text is verbatim apart from that.

import proof from "@/components/landing/records/proof.json";
import type { Letterhead, PdfFact } from "../packet";

const DISPUTE = "PP-R-EGO-10193744";
const RUN_ID = "run_00a4c818-1a0";

const run = proof.runs.find((r) => r.id === RUN_ID)!;
const filed = proof.writes.find((w) => w.disputeId === DISPUTE && w.at.startsWith("2026-11-03"))!;
const calls = proof.calls.filter((c) => c.disputeId === DISPUTE && c.at >= "2026-11-03T02:39" && c.at <= "2026-11-03T02:40");
const reread = calls.find((c) => c.method === "GET" && c.at < filed.at && c.at > "2026-11-03T02:39:10")!;
const after = calls.find((c) => c.method === "GET" && c.at > filed.at)!;
const action = proof.actions.find((a) => a.at.startsWith("2026-11-03"))!;

export const FILING = {
  disputeId: DISPUTE,
  run: { id: run.id, startedAt: run.startedAt, durationMs: run.durationMs!, decision: run.decision!, winLikelihood: run.winLikelihood!, exhibits: run.exhibits! },
  headline: "Signed for by D REYES, 3DS-authenticated, buyer thanked us: fight with supporting info",
  /** POST /v1/customer/disputes/{id}/provide-supporting-info: the letter goes as `notes`, the packet as a PDF file. */
  call: "provide-supporting-info",
  path: filed.path,
  at: filed.at,
  status: filed.status,
  ms: filed.ms,
  debugId: filed.debugId,
  actor: action.actor,
  /** The PDF: a cover page with the letter and the exhibit index, then each exhibit on its own page (src/lib/packet). */
  packet: { file: `exhibit-${DISPUTE}-evidence-packet.pdf`, kb: 47 },
  /** The dispute re-read from PayPal just before filing, and the status read just after. */
  reread: { at: reread.at, status: reread.status, ms: reread.ms, debugId: reread.debugId },
  after: { at: after.at, status: after.status, ms: after.ms, debugId: after.debugId },
  letter: `Kora Atelier contests this chargeback: the account holder authorized this purchase and received it.

1. Authentication: The order KA-10503 ($420.00, placed 2026-09-25) passed 3-D Secure (AUTHENTICATED), AVS (Y) and CVV (M). It was placed from a device this customer has used with us since 2026-02-02, from a Columbus, OH IP address 4 km from the shipping address (Exhibit A).

2. Order details: The billing and shipping addresses are the same, 481 Oak Park Ave, Columbus, OH 43215. The buyer accepted our store policies at checkout, and the order shipped UPS 2nd Day Air with signature required (Exhibit D).

3. Delivery: UPS tracking 1Z84V6A90298355102 shows the parcel picked up in Brooklyn on 2026-09-26 and delivered to the transaction address on 2026-09-28 at 16:52, signed by D REYES (Exhibit B). This tracking was synced to PayPal.

4. Buyer confirmed receipt: On 2026-09-29 the buyer messaged us: "Briefcase arrived, it's beautiful. Does the combination lock come set to 000?" We answered within the hour (Exhibit C).

5. History: Daniel Reyes is a returning customer with three orders since February 2026 and no prior disputes (Exhibit E).

6. Seller Protection: The payment is marked eligible for unauthorized transaction claims. We shipped to the address on the Transaction Details page with online, verifiable tracking and signature proof of delivery (Exhibit F).

The cardholder authenticated the payment, signed for the item and then wrote to us about using it. We ask that the chargeback be resolved in our favor.

Kora Atelier LLC, Brooklyn, NY. studio@koraatelier.example`,
  exhibits: [
    { label: "A", title: "Checkout authentication and risk signals", ref: "risk:KA-10503", kind: "Checkout signals", why: "3-D Secure authenticated, AVS Y, CVV M, known device since Feb 2026, IP in Columbus 4 km from the address." },
    { label: "B", title: "UPS tracking with signature", ref: "shipment:SHP-10503", kind: "Carrier scans", why: "Delivered 2026-09-28 to the transaction address and signed by D REYES." },
    { label: "C", title: "Buyer chat confirming receipt", ref: "msg:MSG-10503-1", kind: "Support inbox", why: "The buyer wrote 'Briefcase arrived, it's beautiful' the day after delivery." },
    { label: "D", title: "Order record", ref: "order:KA-10503", kind: "Store order", why: "Billing and shipping addresses match, policies accepted at checkout, signature-required shipping." },
    { label: "E", title: "Customer history", ref: "customer:history", kind: "Store customer", why: "Three orders since Feb 2026 and no prior disputes." },
    { label: "F", title: "Seller Protection check", ref: "paypal:seller-protection:PP-R-EGO-10193744", kind: "PayPal rulebook", why: "Every requirement passes and PayPal marks the payment eligible for unauthorized claims." },
  ],
  /** The UPS record behind Exhibit B, as the packet prints it (the store's shipment SHP-10503). */
  tracking: {
    carrier: "UPS",
    service: "UPS 2nd Day Air, signature required",
    number: "1Z84V6A90298355102",
    events: [
      { at: "2026-09-26T08:00:00Z", location: "Brooklyn, NY", description: "Picked up" },
      { at: "2026-09-27T10:17:00Z", location: "Louisville, KY", description: "Departed facility" },
      { at: "2026-09-28T16:52:00Z", location: "Columbus, OH 43215", description: "Delivered, signed by D REYES" },
    ],
    onPayPal: true,
  },
  approval: {
    id: "apv_348c2c7423",
    client: "Claude Code",
    title: "Send the evidence packet to PayPal's chargeback review",
    detail: "Exhibit sends the response letter and a 6-exhibit PDF packet to PayPal's chargeback review. Win likelihood 88%.",
    note: "Re-investigated brief (FIGHT, 88%): 3DS/AVS/CVV passed, UPS signed by D REYES at the billing address, buyer confirmed receipt in chat. Sends the updated packet to PayPal's chargeback review via provide_supporting_info.",
    movesMoney: false,
    requestedAt: "2026-11-03T02:38:15.257Z",
    approvedAt: "2026-11-03T02:39:14.027Z",
    result: "Response and a 47 KB evidence packet sent to PayPal's chargeback review.",
  },
};

/** The letterhead every packet prints: the merchant's profile (the demo merchant, src/lib/store/scenarios.ts MERCHANT). */
export const LETTERHEAD: Letterhead = {
  name: "Kora Atelier",
  legalName: "Kora Atelier LLC",
  address: "68 Jay Street, Suite 402, Brooklyn, NY 11201, US",
  email: "studio@koraatelier.example",
  website: "koraatelier.example",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
/** The packet's own date and time formats (Packet.tsx date and dateTime, UTC): "Oct 20, 2026", "Sep 28, 2026, 04:52 PM UTC". */
export const pdfDate = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};
export const pdfDateTime = (iso: string) => {
  const d = new Date(iso);
  const h = d.getUTCHours();
  return `${pdfDate(iso)}, ${pad(h % 12 || 12)}:${pad(d.getUTCMinutes())} ${h < 12 ? "AM" : "PM"} UTC`;
};

const dispute = proof.disputes.find((d) => d.id === DISPUTE)!;
const delivered = FILING.tracking.events[FILING.tracking.events.length - 1];
/** The address the order shipped and billed to, as the letter and the brief state it, printed as Packet.tsx prints one. */
const REYES_ADDRESS = "Daniel Reyes\n481 Oak Park Ave\nColumbus, OH 43215\nUS";

/**
 * The cover page as the packet printed it on Nov 3 (Packet.tsx PacketDocument): the date it was rendered, and the eight
 * facts in the packet's order. The case was already under review, so PayPal set no seller response date and the packet
 * prints a dash there (an en dash on the site, whose copy has no em dashes).
 */
export const PACKET_COVER = {
  date: pdfDate(FILING.at),
  facts: [
    { k: "Reason", v: "Unauthorized" },
    { k: "Stage", v: "Chargeback · code 1040" },
    { k: "Amount", v: `$${dispute.amount.toFixed(2)}` },
    { k: "Response due", v: "–" },
    { k: "Transaction", v: dispute.captureId, mono: true },
    { k: "Order", v: "KA-10503", mono: true },
    { k: "Buyer", v: dispute.buyer },
    { k: "Opened", v: pdfDate(dispute.createdAt) },
  ] satisfies PdfFact[],
};

/**
 * What each exhibit page of the packet prints, laid out as Packet.tsx lays out that kind of record, as far as the
 * filed letter, the UPS record above and the Reyes brief's reasoning (records/hero-runs.json, same store records)
 * state it. Nothing here goes beyond those, so a few of the packet's fields are left out (the IP address, the
 * device id, the SKU, times the records don't give).
 */
export type ExhibitPage = {
  label: string;
  /** The facts grid, under the packet's labels for this kind of record. */
  facts?: PdfFact[];
  /** Shipments: the carrier scan history. */
  scans?: { at: string; location: string; event: string; delivered?: boolean }[];
  /** Orders: the line items and the total charged. */
  items?: { name: string; qty: number; amount: string }[];
  total?: string;
  /** Messages, as the packet prints each one. */
  messages?: { meta: string; body: string }[];
  /** Seller Protection: each requirement it checks, with PayPal's own wording. */
  checks?: { label: string; quote: string }[];
};

export const EXHIBIT_PAGES: Record<string, ExhibitPage> = {
  A: {
    label: "A",
    // A risk record; email age 3,400 days prints as 9 yr.
    facts: [
      { k: "AVS (address check)", v: "Y" },
      { k: "CVV", v: "M" },
      { k: "3-D Secure", v: "AUTHENTICATED" },
      { k: "Checkout IP", v: "Columbus, OH, US" },
      { k: "IP to ship-to distance", v: "4 km" },
      { k: "Device", v: "Seen since Feb 2, 2026" },
      { k: "Email age", v: "9 yr" },
      { k: "Orders in 24h", v: "1" },
    ],
  },
  B: {
    label: "B",
    facts: [
      { k: "Carrier", v: `${FILING.tracking.carrier} · ${FILING.tracking.service}` },
      { k: "Tracking number", v: FILING.tracking.number, mono: true },
      { k: "Status", v: "DELIVERED" },
      { k: "Delivered", v: pdfDateTime(delivered.at) },
      { k: "Signature", v: "D REYES" },
      { k: "Delivered to", v: REYES_ADDRESS },
    ],
    scans: FILING.tracking.events.map((e) => ({ at: pdfDateTime(e.at), location: e.location, event: e.description, delivered: e === delivered })),
  },
  C: {
    label: "C",
    messages: [{ meta: "Buyer · chat · Sep 29, 2026", body: "Briefcase arrived, it's beautiful. Does the combination lock come set to 000?" }],
  },
  D: {
    label: "D",
    facts: [
      { k: "Order", v: "KA-10503", mono: true },
      { k: "Placed", v: "Sep 25, 2026" },
      { k: "PayPal capture", v: dispute.captureId, mono: true },
      { k: "Shipping method", v: "UPS 2nd Day Air, signature required" },
      { k: "Ship to (transaction address)", v: REYES_ADDRESS },
      { k: "Bill to", v: REYES_ADDRESS },
      { k: "Policies accepted", v: "At checkout" },
    ],
    items: [{ name: "Atelier Briefcase in Espresso", qty: 1, amount: "$420.00" }],
    total: "$420.00",
  },
  E: {
    label: "E",
    facts: [
      { k: "Customer", v: "Daniel Reyes" },
      { k: "Customer since", v: "Feb 2026" },
      { k: "Orders", v: "3" },
      { k: "Lifetime value", v: "$664.00" },
      { k: "Prior disputes", v: "0" },
      { k: "Order ids", v: "KA-9466, KA-9603, KA-10503", mono: true },
    ],
  },
  F: {
    label: "F",
    checks: [
      { label: "Payment marked eligible for unauthorized claims", quote: "In the case of Unauthorized Transaction claims, the payment must be marked “eligible” or “partially eligible” for PayPal’s Seller Protection program on the Transaction Details page." },
      { label: "Shipped to the address on the transaction", quote: "You must ship the item to the shipping address on the Transaction Details page in your PayPal account for the transaction." },
      { label: "Online, verifiable tracking and proof of delivery", quote: "Proof of delivery: online or physical documentation from a shipping company that includes an online and verifiable tracking number, date of delivery and ‘delivered’ status…" },
    ],
  },
};
