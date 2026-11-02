import "server-only";
// Thin adapter between Ask Exhibit's tools and the rest of the app. Every figure Ask Exhibit shows is
// read through here: the Command center (overview.ts) for the open queue and its assumptions, the
// resolved-case history (store/history.ts), and the Prevention radar (prevention.ts). If those modules
// change shape, this is the only file that needs to follow.

import { paypalMode } from "../config";
import { caseFile, cachedDispute, disputesForInbox, latestBriefs, latestRun } from "../disputes";
import { inboxRows, type InboxRow } from "../inbox";
import { ASSUMPTIONS, buildOverview, type QueueRow } from "../overview";
import { DISPUTE_FEE, preventionReport, type PreventionReport } from "../prevention";
import type { DisputeReason } from "../paypal/types";
import { REASON_LABEL } from "../paypal/types";
import { resolvedFromPayPal, resolvedHistory, type ResolvedCase } from "../store/history";
import { store } from "../store/repo";

export { ASSUMPTIONS, DISPUTE_FEE, REASON_LABEL };

export type Book = {
  mode: "demo" | "sandbox";
  merchant: string;
  /** Every dispute PayPal returned, with Exhibit's brief joined in. */
  rows: InboxRow[];
  /** Open cases, closest deadline first, with the next step a person owes. */
  queue: QueueRow[];
  /** Resolved cases: the demo merchant's labelled history plus anything PayPal resolved. */
  resolved: ResolvedCase[];
  demoHistory: boolean;
};

export async function loadBook(): Promise<Book> {
  const [overview, disputes] = await Promise.all([buildOverview(), disputesForInbox()]);
  const rows = inboxRows(disputes, latestBriefs());
  const history = resolvedHistory();
  const resolvedNow = rows
    .filter((r) => r.statusCode === "RESOLVED")
    .map((r) =>
      resolvedFromPayPal({ id: r.id, reasonCode: r.reasonCode, stage: r.stageCode, amount: r.amount, decision: r.decision, outcome: r.outcome, createdAt: r.createdAt, closedAt: r.closedAt, refundedAmount: r.refunded }),
    );
  return { mode: paypalMode(), merchant: overview.merchant, rows, queue: overview.queue, resolved: [...history, ...resolvedNow], demoHistory: history.length > 0 };
}

export function loadPrevention(): PreventionReport {
  return preventionReport();
}

/** Everything known about one dispute: PayPal record, store records, latest brief, actions. */
export function loadCase(id: string) {
  const d = cachedDispute(id);
  if (!d) return undefined;
  const file = caseFile(d);
  const run = latestRun(id);
  return { file, brief: run?.brief ?? null, scenario: store.scenario(id) };
}

const REASON_ALIASES: [RegExp, DisputeReason][] = [
  [/not.?received|never (arrived|came)|\binr\b|didn.?t (arrive|get)|delivery|lost (parcel|package)/i, "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"],
  [/not.?as.?described|\bsnad\b|damaged|wrong item|quality|described/i, "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED"],
  [/unauthori[sz]ed|fraud|stolen card|didn.?t (make|authori)/i, "UNAUTHORISED"],
  [/credit.?not.?processed|refund not|never refunded|return.*refund/i, "CREDIT_NOT_PROCESSED"],
  [/duplicate|charged twice|double/i, "DUPLICATE_TRANSACTION"],
  [/incorrect amount|wrong amount|overcharg/i, "INCORRECT_AMOUNT"],
];

/** Accepts a PayPal reason code or a plain-words reason ("item not received", "fraud"). */
export function matchReason(input?: string | null): DisputeReason | undefined {
  if (!input) return undefined;
  const up = input.trim().toUpperCase();
  if (up in REASON_LABEL) return up as DisputeReason;
  for (const [re, code] of REASON_ALIASES) if (re.test(input)) return code;
  return undefined;
}

export const reasonLabel = (code: string) => REASON_LABEL[code as DisputeReason] ?? code;
