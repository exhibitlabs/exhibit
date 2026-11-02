import proof from "./records/proof.json";

// Derived views over records/proof.json for the landing summary and /proof.

export const PROOF = proof;

export type Call = (typeof proof.calls)[number];

const REASON: Record<string, string> = {
  UNAUTHORISED: "Unauthorized",
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  CREDIT_NOT_PROCESSED: "Credit not processed",
};
export const reasonLabel = (r: string) => REASON[r] ?? r;

/** What a write call did, in plain words. */
export function describe(c: Pick<Call, "path" | "method">): { label: string; kind: "dispute" | "setup" | "sandbox" } {
  const p = c.path;
  if (p.endsWith("/provide-evidence")) return { label: "Filed evidence (letter, tracking, PDF packet)", kind: "dispute" };
  if (p.endsWith("/provide-supporting-info")) return { label: "Filed supporting info (letter, PDF packet)", kind: "dispute" };
  if (p.endsWith("/accept-claim")) return { label: "Accepted the claim: refund to the buyer", kind: "dispute" };
  if (p.endsWith("/make-offer")) return { label: "Made an offer", kind: "dispute" };
  if (p.endsWith("/send-message")) return { label: "Messaged the buyer", kind: "dispute" };
  if (p.endsWith("/adjudicate")) return { label: "Asked the sandbox to rule (sandbox-only call)", kind: "sandbox" };
  if (p.endsWith("/process-chargeback")) return { label: "Opened a chargeback (sandbox-only call)", kind: "setup" };
  if (p.endsWith("/capture")) return { label: "Captured a buyer's payment", kind: "setup" };
  return { label: `${c.method} ${p}`, kind: "setup" };
}

export const shortPath = (p: string) => p.replace(/^\/v\d\/customer\/disputes\/PP-[A-Z]-[A-Z0-9-]+/, "…/disputes/{id}").replace(/^\/v2\/checkout\/orders\/[A-Z0-9]+/, "/v2/checkout/orders/{id}");

/** Successful dispute responses Exhibit filed through the API. */
export const disputeActions = proof.writes.filter((w) => describe(w).kind === "dispute" && w.status < 400);
/** Failed attempts, kept because they are why Exhibit files the way it does. */
export const failedWrites = proof.writes.filter((w) => w.status >= 400);

export const LESSONS = [
  "Chargebacks move from OPEN to UNDER_REVIEW, where only provide-supporting-info is open, then to WAITING_FOR_SELLER_RESPONSE about five minutes later.",
  "PayPal accepts only the evidence types it requested, and several evidences in one call need an item_id. A multi-evidence payload with a tracking URL returned a sandbox 500, so Exhibit now sends one evidence per call, with tracking and the PDF packet.",
  "This sandbox business account is not enabled for direct card processing (PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING, the two 422s on order create), so seeding uses PayPal checkout with buyer approval.",
  "On the credit-not-processed chargeback the agent chose accept-claim over refunding the capture: the issuer had already pulled the funds back, so a second refund would have paid the buyer twice.",
];

export const NOT_LIVE = [
  { what: "Webhooks", why: "PayPal only delivers to a public HTTPS URL, and nothing is deployed yet. Signature checks use PayPal's verify-webhook-signature API and run in the simulator." },
  { what: "make-offer and send-message", why: "PayPal allows them only at the inquiry stage. Sandbox chargebacks from process-chargeback skip that stage, and opening a buyer-side inquiry needs PayPal partner consent." },
  { what: "Tracking push and capture refunds", why: "POST /v2/checkout/orders/{id}/track and POST /v2/payments/captures/{id}/refund are implemented and run against the simulator, but have not been called on the live sandbox." },
  { what: "A PayPal decision on the merits", why: "The one resolved case closed after a sandbox-only adjudicate call. Sandbox outcomes don't show how a real PayPal reviewer would rule." },
];

/** Per dispute: the latest finished brief and what was filed. */
export function disputeRows() {
  return proof.disputes.map((d) => {
    const runs = proof.runs.filter((r) => r.disputeId === d.id);
    const latest = [...runs].reverse().find((r) => r.status === "done");
    const filed = proof.writes.filter((w) => w.disputeId === d.id && w.status < 400 && describe(w).kind !== "setup");
    return { ...d, reasonLabel: reasonLabel(d.reason), decision: latest?.decision ?? null, winLikelihood: latest?.winLikelihood ?? null, runs: runs.length, filed };
  });
}

/** PayPal's own definitions (Disputes API reference) for the outcome codes we have seen. */
export const OUTCOME_TEXT: Record<string, string> = {
  RESOLVED_WITH_PAYOUT: "PayPal provided the merchant or customer with protection and the case is resolved.",
  REPRESENTED_BY_PAYPAL: "Paypal covered the cost of the case as decided by policy.",
};
