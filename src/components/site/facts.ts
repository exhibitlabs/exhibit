// Every fact the site states, derived from the checked-in records. Nothing here is typed by hand except
// labels. Sources: src/components/landing/records/*.json (exported from Exhibit's own database by
// records/export.mjs), src/components/landing/data.ts, eval/RESULTS.md and docs/SANDBOX_E2E.md.
// Import from server components only (it pulls in the records).

import { EVALUATION, PAYPAL_AGENT_TOOLS, PAYPAL_FEES, PAYPAL_MCP_QUOTE, PRICING } from "@/components/landing/data";
import { RUNS } from "@/components/landing/hero-data";
import { describe, disputeActions, disputeRows, failedWrites, LESSONS, NOT_LIVE, OUTCOME_TEXT, PROOF, reasonLabel, shortPath } from "@/components/landing/proof-data";
import ask from "@/components/landing/records/ask.json";
import prevention from "@/components/landing/records/prevention.json";
import evalResults from "../../../eval/results.json";

export { ask as ASK, EVALUATION, LESSONS, NOT_LIVE, OUTCOME_TEXT, PAYPAL_AGENT_TOOLS, PAYPAL_FEES, PAYPAL_MCP_QUOTE, PRICING, PROOF, describe, disputeRows, reasonLabel, shortPath };
export const PREVENTION = prevention;


// ------------------------------------------------------------------ formatting (UTC, so server and browser agree)
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
/** "Oct 20, 2026" */
export const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
};
/** "Oct 20" */
export const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
};
/** "13:17" or "13:17:18" (UTC) */
export const fmtTime = (iso: string, seconds = false) => {
  const d = new Date(iso);
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}${seconds ? `:${pad(d.getUTCSeconds())}` : ""}`;
};
/** "Oct 20, 13:17 UTC" */
export const fmtDateTime = (iso: string, seconds = false) => `${fmtDay(iso)}, ${fmtTime(iso, seconds)} UTC`;
/** "Oct 20, 1:17 PM": the app's own date and time format (src/lib/format.ts, dateTime), in UTC. Captions say so. */
export const fmtApp = (iso: string) => {
  const d = new Date(iso);
  const h = d.getUTCHours();
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${h % 12 || 12}:${pad(d.getUTCMinutes())} ${h < 12 ? "AM" : "PM"}`;
};
/** "2,614 ms" */
export const fmtMs = (ms: number) => `${ms.toLocaleString("en-US")} ms`;
/** "35.6 s" */
export const fmtSeconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
/** "$420.00" (digits 2) or "$420" (digits 0) */
export const usd = (n: number, digits = 2) => `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
/** House style has no em dashes: "UPS tracking — delivered" becomes "UPS tracking: delivered". */
export const plain = (s: string, sep = ": ") => s.replace(/\s+—\s+/g, sep).replace(/—/g, ", ");
/** A brief headline as a sentence: "…in chat — fight the…" becomes "…in chat. Fight the…". */
export const sentence = (s: string) => {
  const t = s.replace(/\s+—\s+(\w)/g, (_, c: string) => `. ${c.toUpperCase()}`).replace(/:\s+(\w)/g, (_, c: string) => `. ${c.toUpperCase()}`);
  return /[.!?]$/.test(t) ? t : `${t}.`;
};

export const MODEL_NAME: Record<string, string> = { "claude-opus-5-5": "Claude Opus 5.5" };

// ------------------------------------------------------------------ Lena Hoffmann's order, as the drawer showed it
// The app's prevention drawer lists each signal with a sentence, a quote and a weight. records/prevention.json keeps
// the order, the scans, her message and the scores (84 before the fix, 0 after); the drawer's rows are the app's own
// rules (src/lib/prevention.ts: tracking_stalled and buyer_waiting) applied to that record at the moment of the fix.
// Their weights combine to the recorded 84, which the build checks.
const DAY = 86_400_000;
const save = prevention.save;
const fixAt = Date.parse(save.fix.at);
const quiet = (fixAt - Date.parse(save.shipment.lastScan.at)) / DAY;
const promised = Date.parse(save.shipment.shippedAt) + (save.country === "US" ? 7 : 6) * DAY;
const waited = (fixAt - Date.parse(save.buyerMessage.at)) / DAY;
const days = (d: number) => `${Math.round(d)} day${Math.round(d) === 1 ? "" : "s"}`;
const sentences = save.buyerMessage.body.split(/(?<=[.!?])\s+/);
const threat = sentences.find((s) => /Konflikt/.test(s)) ?? sentences[0];
const LENA_SIGNALS = [
  {
    kind: "buyer_waiting" as const,
    label: "Buyer waiting",
    reason: "Item not received",
    detail: `${save.buyer.split(" ")[0]} mentions opening a dispute; unanswered for ${days(waited)} (written in German).`,
    quote: threat,
    // 20, plus 8 per full day past the 24-hour reply window, plus 45 for a dispute threat.
    weight: Math.min(85, 20 + Math.max(0, Math.floor((waited * 24 - 24) / 24)) * 8 + 45),
  },
  {
    kind: "tracking_stalled" as const,
    label: "Tracking stalled",
    reason: "Item not received",
    detail: `No ${save.shipment.carrier} scan for ${days(quiet)}${fixAt > promised ? `, and the promised delivery date (${MONTHS[new Date(promised).getUTCMonth()]} ${new Date(promised).getUTCDate()}) has passed` : ""}.`,
    quote: `${save.shipment.lastScan.description} · ${save.shipment.lastScan.location}`,
    // 30, plus 6 per day past four quiet days, plus 15 once the promised date has passed (at most 70).
    weight: Math.round(Math.min(70, 30 + Math.max(0, quiet - 4) * 6 + (fixAt > promised ? 15 : 0))),
  },
].sort((a, b) => b.weight - a.weight);
const combined = Math.round(100 * (1 - LENA_SIGNALS.reduce((acc, s) => acc * (1 - Math.min(95, s.weight) / 100), 1)));
if (combined !== save.fix.before.score) throw new Error(`Lena Hoffmann's signals combine to ${combined}, the record says ${save.fix.before.score}`);
const FEE = save.fix.saved - save.amount;

/** The drawer's view of Lena Hoffmann's order (demo merchant, PayPal simulator) just before Exhibit's reply. */
export const LENA_DRAWER = {
  orderId: save.orderId,
  buyer: save.buyer,
  country: save.country,
  item: plainItem(save.item),
  amount: save.amount,
  fee: FEE,
  exposure: save.amount + FEE,
  score: save.fix.before.score,
  signals: LENA_SIGNALS,
  /** The app's fix for this order (src/lib/prevention.ts, FIX.message_buyer) and the reply it sent, as the app renders the item. */
  fix: { detail: "Sends a status update in the buyer's language from the support inbox.", subject: save.fix.message.subject, body: save.fix.message.body.replace(/\s+—\s+/g, " in ") },
  saved: save.fix.saved,
  after: save.fix.after.score,
  at: save.fix.at,
};
function plainItem(s: string) {
  return s.replace(/\s+—\s+/g, " in ");
}

// ------------------------------------------------------------------ the Reyes case, start to finish
const fight = RUNS.fight;
const dispute = PROOF.disputes.find((d) => d.id === fight.disputeId)!;
const filings = PROOF.writes.filter((w) => w.disputeId === fight.disputeId && w.status < 400);
const lastFiling = filings[filings.length - 1];
const opening = PROOF.writes.find((w) => w.path.endsWith("/process-chargeback") && Math.abs(Date.parse(w.at) - Date.parse(dispute.createdAt)) < 10_000) ?? null;
const approval = PROOF.actions.find((a) => a.disputeId === fight.disputeId && a.actor.startsWith("agent:")) ?? null;
const lastStep = fight.steps[fight.steps.length - 1];

export const REYES = {
  id: dispute.id,
  buyer: dispute.buyer,
  amount: dispute.amount,
  currency: dispute.currency,
  reason: reasonLabel(dispute.reason),
  reasonCode: fight.claim.reasonCode,
  stage: dispute.stage,
  channel: dispute.channel,
  status: dispute.status,
  captureId: dispute.captureId,
  item: plain(fight.claim.item ?? "", " in "),
  orderId: fight.claim.orderId,
  openedAt: dispute.createdAt,
  checkedAt: dispute.checkedAt,
  opening,
  /** The recorded run shown everywhere (Oct 21): steps, timings, brief. */
  run: {
    id: fight.runId,
    startedAt: fight.startedAt,
    durationMs: fight.durationMs,
    briefAt: fight.briefAt ?? fight.durationMs,
    lastResultAt: lastStep.at + (lastStep.ms ?? 0),
    model: MODEL_NAME[fight.model] ?? fight.model,
    steps: fight.steps,
    toolCalls: fight.steps.length,
  },
  brief: {
    decision: fight.brief.decision as "FIGHT",
    headline: sentence(fight.brief.headline),
    /** The headline as the app prints it, with its dash set as a colon (the app's own style for later briefs). */
    headlinePlain: plain(fight.brief.headline),
    summary: fight.brief.summary,
    winLikelihood: fight.brief.winLikelihood,
    confidence: fight.brief.confidence.toLowerCase(),
    reasoning: fight.brief.reasoning.map((r) => ({ point: plain(r.point), refs: r.refs })),
    risks: fight.brief.risks,
    exhibits: fight.brief.exhibits.map((x) => ({ ...x, title: plain(x.title) })),
    letterOpening: fight.brief.letterOpening,
    expectedBack: Math.round(dispute.amount * fight.brief.winLikelihood) / 100,
  },
  /** Every filing on the case, oldest first; the last is the agent-requested, merchant-approved one. */
  filings,
  lastFiling,
  approval,
  approvedByAgent: approval ? approval.actor.replace(/^agent:/, "").replace(/ approved by merchant$/, "") : null,
  runsOnCase: PROOF.runs.filter((r) => r.disputeId === fight.disputeId).length,
};

/** The other recorded runs, for the refund side of the story. */
export const REFUND_RUN = RUNS.refund;
export const REFUND_RUN_2 = RUNS.refund2;
export const refundCall = (disputeId: string) => PROOF.writes.find((w) => w.disputeId === disputeId && w.path.endsWith("/accept-claim")) ?? null;

// ------------------------------------------------------------------ the sandbox record
export const RECORD = {
  host: PROOF.host,
  totals: PROOF.totals,
  from: PROOF.firstCall!,
  to: PROOF.lastCall!,
  cacheRowsDropped: PROOF.cacheRowsDropped,
  /** The successful dispute responses filed through the API (7). */
  filed: disputeActions,
  /** Write calls that failed (400, 500). */
  failedWrites,
  /** Every call that returned an error (the two 422s on order create included). */
  errors: PROOF.calls.filter((c) => c.status >= 400),
  endpoints: PROOF.endpoints,
  runs: PROOF.runs,
  calls: PROOF.calls,
  disputes: disputeRows(),
  resolved: PROOF.disputes.find((d) => d.status === "RESOLVED") ?? null,
  statusReads: PROOF.endpoints.find((e) => e.endpoint === "/v1/customer/disputes/{id}" && e.method === "GET") ?? null,
};

/** What kind of call each logged call was, for the 244-dot strip. */
export type CallKind = "read" | "filing" | "setup" | "error";
export function callKind(c: (typeof PROOF.calls)[number]): CallKind {
  if (c.status >= 400) return "error";
  if (c.method === "GET" || c.path.endsWith("/oauth2/token")) return "read";
  const d = describe(c);
  return d.kind === "dispute" ? "filing" : "setup";
}

// ------------------------------------------------------------------ evaluation (always with its caveat)
// Counted from eval/results.json the way eval/RESULTS.md counts it.
type EvalCase = { expected: string; decision: string | null; minutes: number | null };
const evalRun = evalResults as unknown as { meta: { started_at: string; model_requested: string }; cases: EvalCase[] };
const evalCases = evalRun.cases ?? [];
const evalMinutes = evalCases
  .map((c) => c.minutes)
  .filter((m): m is number => m != null)
  .sort((a, b) => a - b);
const evalMid = Math.floor(evalMinutes.length / 2);
const evalMedian = evalMinutes.length % 2 ? evalMinutes[evalMid] : (evalMinutes[evalMid - 1] + evalMinutes[evalMid]) / 2;
const evalRefund = evalCases.filter((c) => c.expected === "REFUND");
const evalNotFight = evalCases.filter((c) => c.expected !== "FIGHT");
const evalModel = MODEL_NAME[evalRun.meta.model_requested] ?? evalRun.meta.model_requested;

export const EVAL = {
  cases: evalCases.length,
  matched: `${evalCases.filter((c) => c.decision === c.expected).length}/${evalCases.length}`,
  refunded: `${evalRefund.filter((c) => c.decision && c.decision !== "FIGHT").length}/${evalRefund.length}`,
  falseFights: `${evalNotFight.filter((c) => c.decision === "FIGHT").length}/${evalNotFight.length}`,
  medianSeconds: Math.round(evalMedian * 60),
  model: evalModel,
  date: fmtDate(evalRun.meta.started_at),
  caveat: `${evalCases.length} synthetic cases, written and labelled by the builders before one live run on ${evalModel}. It shows Exhibit applies its rules consistently. It does not measure accuracy on real disputes.`,
  url: EVALUATION?.url,
};

// ------------------------------------------------------------------ MCP
export const MCP_TOOLS = ["list_disputes", "investigate_dispute", "get_case_brief", "get_evidence_packet", "get_prevention_report", "get_overview", "request_dispute_action", "request_prevention_fix", "get_approval_status"] as const;
export const MCP_SETUP = "claude mcp add exhibit -e EXHIBIT_URL=http://localhost:3000 -- node /path/to/exhibit/mcp/server.ts";
