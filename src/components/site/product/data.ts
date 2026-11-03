// Facts for the product pages (/product/**). Every value comes from the exported records in
// src/components/landing/records/*.json (written by export.mjs from real runs), src/components/landing/data.ts,
// eval/RESULTS.md, docs/SANDBOX_E2E.md or the code named beside it. The one exception is ./filing.ts (the Nov 3
// letter and approval as filed), which documents its own source. Import this only from server components.

import ask from "@/components/landing/records/ask.json";
import heroRuns from "@/components/landing/records/hero-runs.json";
import prevention from "@/components/landing/records/prevention.json";
import proof from "@/components/landing/records/proof.json";

/** The site never prints an em dash: "Atelier Briefcase — Espresso" reads "Atelier Briefcase in Espresso", as the app shows it. */
export const itemName = (s: string) => s.replace(/\s+—\s+/g, " in ");
/** Other em dashes in recorded strings become a colon ("UPS tracking: delivered and signed by D REYES"). */
export const noDash = (s: string) => s.replace(/\s+—\s+(\w)/g, (_, c: string) => `: ${c}`).replace(/—/g, ":");
/** A headline whose last clause follows an em dash becomes two sentences ("… in chat. Fight the unauthorized chargeback"). */
export const headline = (s: string) => s.replace(/\s+—\s+(\w)/, (_, c: string) => `. ${c.toUpperCase()}`);

export const money = (v: number, digits?: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: digits ?? (v % 1 ? 2 : 0), maximumFractionDigits: 2 })}`;
export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "Oct 21, 00:35" in UTC. */
export const utc = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
/** "00:35" in UTC. */
export const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
/** "Oct 21, 2026" in UTC. */
export const utcDate = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};

// ---- The Daniel Reyes run (records/hero-runs.json "fight": run_0c8cd432-b18, Oct 21, 2026) -------------------

const fight = heroRuns.fight;

export const REYES = {
  disputeId: fight.disputeId,
  runId: fight.runId,
  model: "Claude Opus 5.5",
  provider: "Claude CLI",
  startedAt: fight.startedAt,
  durationMs: fight.durationMs,
  briefAt: fight.briefAt,
  reason: "Unauthorized",
  reasonCode: fight.claim.reasonCode,
  stage: "Chargeback",
  status: fight.claim.status,
  amount: fight.claim.amount,
  buyer: fight.claim.buyer,
  item: itemName(fight.claim.item),
  orderId: fight.claim.orderId,
  allowedActions: fight.claim.allowedActions,
  decision: fight.brief.decision as "FIGHT",
  winLikelihood: fight.brief.winLikelihood,
  confidence: fight.brief.confidence,
  headline: headline(fight.brief.headline),
  summary: fight.brief.summary,
  reasoning: fight.brief.reasoning,
  risks: fight.brief.risks,
  exhibits: fight.brief.exhibits.map((e) => ({ ...e, title: noDash(e.title) })),
  letterOpening: fight.brief.letterOpening,
  expectedBack: (fight.brief.winLikelihood / 100) * fight.claim.amount,
  /** Opened on the sandbox with process-chargeback (proof.json disputes). */
  openedAt: proof.disputes.find((d) => d.id === fight.disputeId)!.createdAt,
  captureId: proof.disputes.find((d) => d.id === fight.disputeId)!.captureId,
};

export type SourceId = "paypal" | "order" | "carrier" | "customer" | "inbox" | "risk" | "policies" | "protection";

/**
 * The eight sources the agent can read (src/lib/agent/tools.ts), in the order the app's evidence graph lays them
 * out: four on the left, four on the right. `reads` condenses each tool's own description.
 */
export const SOURCE_DEFS: { id: SourceId; label: string; sub: string; tool: string; reads: string; side: "l" | "r" }[] = [
  { id: "paypal", label: "The dispute", sub: "PayPal Disputes API", tool: "get_paypal_dispute", side: "l", reads: "The live case from PayPal: reason, stage, amount, deadline, the buyer's messages, the evidence PayPal asked for and the actions PayPal allows right now." },
  { id: "order", label: "Order & listing", sub: "Store", tool: "lookup_order", side: "l", reads: "The order behind the payment: items with the exact listing text, totals, the shipping address on the transaction, the billing address, checkout IP and when the buyer accepted the store policies." },
  { id: "carrier", label: "Delivery", sub: "Carrier scans", tool: "get_carrier_tracking", side: "l", reads: "Every shipment on the order: scans, delivery date and address, signature, delivery and packing photos, and whether the tracking already reached PayPal." },
  { id: "customer", label: "Buyer history", sub: "Store", tool: "get_customer_history", side: "l", reads: "The buyer's history with the store: first order, every order id, lifetime value and prior disputes." },
  { id: "risk", label: "Checkout signals", sub: "Payments risk", tool: "get_payment_risk_signals", side: "r", reads: "What checkout captured: AVS and CVV results, 3-D Secure, the IP's distance from the shipping address, device history, email age and order velocity." },
  { id: "inbox", label: "Buyer messages", sub: "Support inbox", tool: "get_support_conversation", side: "r", reads: "Email and chat between the store and the buyer about this order, oldest first, with the language each one is written in." },
  { id: "policies", label: "Store policies", sub: "Accepted at checkout", tool: "get_store_policies", side: "r", reads: "The returns, shipping and terms-of-sale policies as the buyer saw them at checkout, with versions." },
  { id: "protection", label: "Seller Protection", sub: "PayPal rulebook", tool: "check_seller_protection", side: "r", reads: "PayPal's own Seller Protection flag on the payment, then each of PayPal's published US requirements, checked one by one with PayPal's wording." },
];

export type SourceState = {
  id: SourceId;
  label: string;
  sub: string;
  tool: string;
  reads: string;
  side: "l" | "r";
  /** What the tool returned in the Reyes run, or null when the agent did not query it. */
  step: { at: number; ms: number; summary: string; arg: string | null } | null;
  exhibit: { label: string; title: string; ref: string; why: string } | null;
  /** Reasoning points in the brief that cite a record from this source. */
  points: string[];
};

/** Which source an evidence ref came from (the app's sourceOf, src/components/app/case/EvidenceGraph.tsx). */
export function sourceOf(ref: string): SourceId | null {
  const [ns, sub] = ref.split(":");
  if (ns === "paypal") return sub === "seller-protection" ? "protection" : "paypal";
  if (ns === "order" || ns === "listing") return "order";
  if (ns === "shipment") return "carrier";
  if (ns === "customer") return "customer";
  if (ns === "risk") return "risk";
  if (ns === "msg" || ns === "conversation") return "inbox";
  if (ns === "policy") return "policies";
  return null;
}

export const SOURCES: SourceState[] = SOURCE_DEFS.map((s) => {
  const step = fight.steps.find((x) => x.node === s.id);
  const ex = REYES.exhibits.find((e) => e.node === s.id);
  return {
    ...s,
    step: step ? { at: step.at, ms: step.ms, summary: itemName(step.summary), arg: step.arg } : null,
    exhibit: ex ? { label: ex.label, title: ex.title, ref: ex.ref, why: ex.why } : null,
    points: REYES.reasoning.filter((r) => r.refs.some((ref) => sourceOf(ref) === s.id)).map((r) => r.point),
  };
});

/** The exhibit letter a ref is filed under in the Reyes brief, if any. */
export const exhibitFor = (ref: string) => REYES.exhibits.find((e) => e.ref === ref)?.label ?? null;

/** The run on a time axis: when each tool was called, then the brief, then done (records/hero-runs.json). */
export const REYES_TIMELINE = {
  total: fight.durationMs,
  firstCall: fight.steps[0].at,
  lastRead: Math.max(...fight.steps.map((s) => s.at + s.ms)),
  briefAt: fight.briefAt,
  steps: fight.steps.map((s) => ({ tool: s.tool, node: s.node as SourceId, at: s.at, ms: s.ms })),
};

/** Every run on the Reyes case on the live sandbox (proof.json runs), for the "same call, run again" record. */
export const REYES_RUNS = proof.runs
  .filter((r) => r.disputeId === fight.disputeId)
  .map((r) => ({ id: r.id, startedAt: r.startedAt, status: r.status, decision: r.decision, winLikelihood: r.winLikelihood, exhibits: r.exhibits, durationMs: r.durationMs, error: r.error }));

/** All 13 live runs (docs/SANDBOX_E2E.md "Agent runs"). */
export const RUNS = {
  total: proof.runs.length,
  briefs: proof.runs.filter((r) => r.status === "done").length,
  noBrief: proof.runs.filter((r) => r.status === "error").length,
  unfinished: proof.runs.filter((r) => r.status === "running").length,
};

// ---- Refunds on the live sandbox (records/hero-runs.json "refund", "refund2"; docs/SANDBOX_E2E.md) ------------

const write = (disputeId: string, kind: string) => proof.writes.find((w) => w.disputeId === disputeId && w.path.endsWith(kind))!;

export const REFUNDS = [heroRuns.refund, heroRuns.refund2].map((r) => {
  const w = write(r.disputeId, "/accept-claim");
  const d = proof.disputes.find((x) => x.id === r.disputeId)!;
  return {
    disputeId: r.disputeId,
    buyer: r.claim.buyer,
    item: itemName(r.claim.item),
    amount: r.claim.amount,
    reason: r.claim.reason === "CREDIT_NOT_PROCESSED" ? "Credit not processed" : "Item not received",
    headline: noDash(r.brief.headline),
    letter: r.brief.letterOpening,
    winLikelihood: r.brief.winLikelihood,
    exhibits: r.brief.exhibits.length,
    /** What the packet's cover prints for this case (src/lib/packet/Packet.tsx). */
    reasonCode: r.claim.reasonCode,
    orderId: r.claim.orderId,
    captureId: d.captureId,
    openedAt: d.createdAt,
    exhibitList: r.brief.exhibits.map((e) => ({ label: e.label, title: noDash(e.title), why: noDash(e.why) })),
    filedAt: w.at,
    status: w.status,
    debugId: w.debugId,
    ms: w.ms,
  };
});

// ---- The live sandbox record (proof.json, docs/SANDBOX_E2E.md) --------------------------------------------------

export const LIVE = {
  host: proof.host,
  calls: proof.totals.calls,
  ok: proof.totals.ok,
  errors: proof.totals.errors,
  endpoints: proof.totals.endpoints,
  chargebacks: proof.totals.disputes,
  runs: proof.totals.runs,
  firstCall: proof.firstCall,
  lastCall: proof.lastCall,
};

/** Every response filed through the Disputes API, oldest first (the seven 200s and the two failed attempts). */
export const FILINGS = proof.writes
  .filter((w) => /provide-evidence|provide-supporting-info|accept-claim/.test(w.path))
  .map((w) => ({ at: w.at, disputeId: w.disputeId!, call: w.path.split("/").pop()!, status: w.status, ms: w.ms, debugId: w.debugId }));

// ---- Prevention (records/prevention.json: demo merchant Kora Atelier, PayPal simulator) ------------------------

const save = prevention.save;
export const LENA = {
  source: prevention.source,
  orderId: save.orderId,
  buyer: save.buyer,
  country: save.country,
  city: "Berlin",
  item: itemName(save.item),
  amount: save.amount,
  carrier: save.shipment.carrier,
  tracking: save.shipment.tracking,
  shippedAt: save.shipment.shippedAt,
  lastScan: save.shipment.lastScan,
  message: save.buyerMessage,
  fix: {
    at: save.fix.at,
    before: save.fix.before,
    after: save.fix.after,
    saved: save.fix.saved,
    subject: save.fix.message.subject,
    /** The reply as sent, in German. The store's product name keeps a comma where the record has an em dash. */
    body: save.fix.message.body.replace(/\s+—\s+/g, ", "),
  },
  /**
   * The English the merchant sees beside it: the app renders the same situation ("stalled") from its English
   * template (src/lib/prevention-messages.ts, EN.stalled) with this order's facts.
   */
  english: {
    subject: `An update on your order ${save.orderId}`,
    body: [
      "Hi Lena,",
      "Thanks for your message, and I'm sorry for the wait. Your Travel Duffle in Chestnut left our Brooklyn studio on October 12 with DHL Express (tracking 4518230917). The last scan was in Leipzig Hub, DE on October 15 and it hasn't moved since, so we opened a trace with DHL Express today. The parcel is in customs clearance, which sometimes takes a few extra days.",
      "We'll write again within 48 hours with what they find. If it isn't moving by October 26, we'll send a replacement by express or refund you in full, whichever you prefer. You don't need to do anything.",
      "Thank you for your patience,\nKora Atelier · studio@koraatelier.example",
    ].join("\n\n"),
  },
  /** Lena's message, in German as sent, and in English. The translation is ours. */
  quote: {
    de: "Wenn ich bis Ende der Woche nichts höre, eröffne ich einen Konflikt bei PayPal.",
    en: "If I hear nothing by the end of the week, I will open a dispute with PayPal.",
  },
};

export const RADAR = prevention.radar;

// ---- Ask Exhibit (records/ask.json: a recorded answer over the sandbox dispute book) ----------------------------

export const ASK = {
  question: ask.question,
  capturedAt: ask.capturedAt,
  model: "Claude Opus 5.5",
  provider: "Claude CLI",
  mode: ask.mode,
  ms: ask.ms,
  steps: ask.steps,
  text: ask.answer.text,
  chart: ask.answer.chart,
  cases: ask.answer.cases,
  followups: ask.answer.followups,
};
