import heroRuns from "./records/hero-runs.json";
import prevention from "./records/prevention.json";
import type { ReplayCase, ReplayNode, ReplayStep } from "./replay-model";

// Builds the hero's three cases from exported records. Two are real agent runs on the PayPal
// sandbox; the third is the demo merchant's prevention save. Nothing here is written by hand
// except labels and the English translation of the German reply.

const MODEL_NAME: Record<string, string> = { "claude-opus-5-5": "Claude Opus 5.5" };

const INVESTIGATION_NODES: ReplayNode[] = [
  { id: "paypal", title: "The dispute", system: "PayPal Disputes API", icon: "dispute", side: "l" },
  { id: "order", title: "Order & listing", system: "Store", icon: "order", side: "l" },
  { id: "carrier", title: "Delivery", system: "Carrier scans", icon: "carrier", side: "l" },
  { id: "customer", title: "Buyer history", system: "Store", icon: "customer", side: "l" },
  { id: "risk", title: "Checkout signals", system: "Payments risk", icon: "risk", side: "r" },
  { id: "inbox", title: "Buyer messages", system: "Support inbox", icon: "inbox", side: "r" },
  { id: "policies", title: "Store policies", system: "Accepted at checkout", icon: "policies", side: "r" },
  { id: "protection", title: "Seller Protection", system: "PayPal's published rules", icon: "protection", side: "r" },
];

/** One exported agent run (see records/export.mjs). */
export type RunRecord = {
  disputeId: string;
  runId: string;
  provider: string;
  model: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  briefAt: number | null;
  claim: { reason: string | null; stage: string | null; status: string | null; reasonCode: string | null; amount: number; currency: string; buyer: string | null; item: string | null; orderId: string | null; allowedActions: string[] };
  steps: { node: string; tool: string; arg: string | null; at: number; ms: number | null; ok: boolean; summary: string }[];
  brief: {
    decision: string;
    headline: string;
    summary: string;
    winLikelihood: number;
    confidence: string;
    reasoning: { point: string; refs: string[] }[];
    risks: string[];
    exhibits: { label: string; title: string; ref: string; node: string | null; why: string }[];
    action: { type: string; amount?: number };
    letterOpening: string;
    buyerMessage: { language: string; text: string } | null;
  };
};

export const RUNS = heroRuns as unknown as Record<"fight" | "refund" | "refund2", RunRecord>;

type Run = RunRecord;

const REASON: Record<string, string> = {
  UNAUTHORISED: "Unauthorized",
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  CREDIT_NOT_PROCESSED: "Credit not processed",
};

const money = (n: number) => `$${n.toFixed(2)}`;

function fromRun(run: Run, key: "fight" | "refund"): ReplayCase {
  const b = run.brief;
  const model = MODEL_NAME[run.model] ?? run.model;
  const steps: ReplayStep[] = run.steps.map((s) => ({ node: s.node, tool: s.tool, arg: s.arg, summary: s.summary, ms: s.ms, at: s.at }));
  const last = run.steps.at(-1)!;
  const reason = REASON[run.claim.reason ?? ""] ?? run.claim.reason ?? "Dispute";
  const date = new Date(run.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const fight = b.decision === "FIGHT";
  const action = b.action;
  return {
    key,
    decision: fight ? "FIGHT" : "REFUND",
    tab: { verb: fight ? "Fight" : "Refund", who: run.claim.buyer ?? "Buyer", amount: `$${run.claim.amount}`, reason: fight ? `${reason} chargeback` : reason },
    provenance: {
      tone: "sandbox",
      short: "Real run · PayPal sandbox",
      long: `Replay of a real run on the PayPal sandbox. On ${date}, ${model} investigated dispute ${run.disputeId}, reading it live through PayPal's Disputes API. Store, carrier and buyer records belong to Kora Atelier, a demo merchant.`,
    },
    claim: { kicker: "The claim", title: reason, amount: money(run.claim.amount), who: `${run.claim.buyer} · chargeback` },
    nodes: INVESTIGATION_NODES,
    steps,
    timing: { briefAt: run.briefAt ?? run.durationMs, durationMs: run.durationMs, lastResultAt: last.at + (last.ms ?? 0) },
    verdict: {
      tone: fight ? "green" : "ink",
      ring: { value: b.winLikelihood, label: fight ? "likely to win" : "chance if fought" },
      headlineLabel: "Exhibit's brief",
      headline: b.headline,
      stats: [model, `${run.steps.length + 1} tool calls`, `${(run.durationMs / 1000).toFixed(1)} s`],
      marksLabel: `Evidence packet · ${b.exhibits.length} exhibits`,
      marks: b.exhibits.map((x) => ({ node: x.node ?? "paypal", label: x.label, title: x.title })),
      action:
        action.type === "accept_claim"
          ? { label: `Accept the claim, refund ${money(action.amount ?? run.claim.amount)}`, endpoint: "POST /v1/customer/disputes/{id}/accept-claim", detail: "With an apology to the buyer. Waits for your approval." }
          : { label: "File supporting info with PayPal", endpoint: "POST /v1/customer/disputes/{id}/provide-supporting-info", detail: "Letter plus a PDF of the exhibits. Waits for your approval." },
      quote: b.buyerMessage ? { label: "Note to the buyer", text: excerptBuyerNote(b.buyerMessage.text) } : undefined,
    },
  };
}

/** First line of the agent's note plus the sentence that tells the buyer what happens. */
function excerptBuyerNote(text: string) {
  const paras = text.split("\n").map((p) => p.trim()).filter(Boolean);
  // Split on sentence ends followed by a space, so "$68.00" stays whole.
  const all = paras
    .slice(1)
    .join(" ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const first = all[0] ?? "";
  const refund = all.find((s) => /coming back|accepted/i.test(s) && s !== first);
  return [first, refund].filter(Boolean).join(" … ");
}

function preventionCase(): ReplayCase {
  const s = prevention.save;
  const hoursWaiting = Math.round((Date.parse(s.fix.at) - Date.parse(s.buyerMessage.at)) / 3_600_000);
  const lastScan = new Date(s.shipment.lastScan.at).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  const city = s.shipment.lastScan.location.replace(/ Hub.*$/, "");
  const nodes: ReplayNode[] = [
    { id: "order", title: "Order & payment", system: "Store · PayPal checkout", icon: "order", side: "l" },
    { id: "tracking", title: "Tracking on PayPal", system: "Orders v2", icon: "tracking", side: "l" },
    { id: "carrier", title: "Delivery", system: "Carrier scans", icon: "carrier", side: "l" },
    { id: "inbox", title: "Buyer messages", system: "Support inbox", icon: "inbox", side: "l" },
    { id: "risk", title: "Checkout signals", system: "Payments risk", icon: "risk", side: "r" },
    { id: "customer", title: "Buyer history", system: "Store", icon: "customer", side: "r" },
    { id: "policies", title: "Store policies", system: "Accepted at checkout", icon: "policies", side: "r" },
    { id: "disputes", title: "PayPal disputes", system: "Disputes API", icon: "scale", side: "r" },
  ];
  const steps: ReplayStep[] = [
    { node: "order", summary: `${s.orderId} · ${s.item} · ${money(s.amount)}` },
    { node: "tracking", summary: `${s.shipment.carrier} ${s.shipment.tracking} is on PayPal` },
    { node: "carrier", summary: `No scan since ${lastScan} · customs, ${city}`, flag: "Tracking stalled" },
    { node: "inbox", summary: `“Wo ist meine Bestellung?” · no reply in ${hoursWaiting} h`, flag: "Buyer waiting" },
    { node: "risk", summary: `AVS ${s.risk.avs} · CVV ${s.risk.cvv} · IP ${s.risk.ipCity}, ${s.risk.ipToShippingKm} km` },
    { node: "customer", summary: `First order · ${s.history.priorDisputes} disputes` },
    { node: "policies", summary: "Shipping and returns, as accepted" },
    { node: "disputes", summary: "No dispute filed yet" },
  ];
  return {
    key: "prevent",
    decision: "PREVENT",
    tab: { verb: "Prevent", who: s.buyer, amount: `$${s.amount}`, reason: "No dispute yet" },
    provenance: {
      tone: "demo",
      short: "Demo merchant · PayPal simulator",
      long: `Demo merchant on the PayPal simulator. Exhibit's prevention radar scored order ${s.orderId} at ${s.fix.before.score} out of 100 before the reply and ${s.fix.after.score} after it. Exposure is the order plus PayPal's $15 dispute fee. The German reply is the one Exhibit sent; the English lines are our translation.`,
    },
    claim: { kicker: "The order", title: "No dispute yet", amount: money(s.amount), who: `${s.buyer} · Berlin` },
    nodes,
    steps,
    timing: null,
    verdict: {
      tone: "green",
      score: { before: s.fix.before.score, after: s.fix.after.score },
      headlineLabel: "Exhibit's fix",
      headline: "Reply in German, before she files: where the parcel is, a DHL trace, and a date.",
      stats: [`Risk ${s.fix.before.score} → ${s.fix.after.score}`, `$${s.fix.saved} exposure removed`],
      marksLabel: "Why it was flagged",
      marks: [
        { node: "carrier", label: "!", title: "Tracking stalled" },
        { node: "inbox", label: "!", title: "Buyer waiting" },
      ],
      action: { label: "Reply sent to the buyer, in German", detail: "PayPal has no messaging API before a dispute exists, so this goes through the store's inbox." },
      quote: {
        label: "She wrote",
        text: "Wenn ich bis Ende der Woche nichts höre, eröffne ich einen Konflikt bei PayPal.",
        translation: "If I hear nothing by the end of the week, I'll open a dispute with PayPal.",
      },
    },
  };
}

export const HERO_CASES: ReplayCase[] = [fromRun(RUNS.fight, "fight"), fromRun(RUNS.refund, "refund"), preventionCase()];

/** The German reply Exhibit sent, trimmed to the facts, with our English translation. */
export const PREVENTION_REPLY = {
  german: "Der letzte Scan stammt vom 15. Oktober aus Leipzig Hub, DE, seitdem gibt es keine Bewegung. Wir haben deshalb heute einen Nachforschungsauftrag bei DHL Express eröffnet.",
  english: "The last scan is from October 15 in Leipzig, with no movement since. So today we opened a trace request with DHL Express.",
  germanPromise: "Ist das Paket bis zum 26. Oktober nicht unterwegs, schicken wir Ihnen sofort Ersatz per Express oder erstatten den vollen Betrag, ganz wie Sie möchten.",
  englishPromise: "If the parcel isn't moving by October 26, we'll send a replacement by express straight away or refund the full amount, whichever you prefer.",
};
