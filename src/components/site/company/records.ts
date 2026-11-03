// Facts the company pages show that are not already exported to src/components/landing/records.
// Every value below was read from a real source on Nov 3 or 4, 2026; the source is named next to it.
// Prefer importing from the landing records (data.ts, proof.json, hero-runs.json) where a fact lives there.

import { FOUNDERS, GITHUB_URL, PAYPAL_AGENT_TOOLS, PAYPAL_FEES } from "@/components/landing/data";
import proof from "@/components/landing/records/proof.json";

export const CONTACT_EMAIL = "contact@exhibit.9to5code.com";

// ------------------------------------------------------------------ Exhibit in 8 facts (the about page)

/** A big-world figure with its label and where it comes from. `spoken` is the figure for screen readers. */
export type CompanyFact = { figure: string; spoken?: string; label: string; source: { name: string; href: string } };

/**
 * PayPal's annual report for 2025 (Form 10-K, filed with the SEC). Quoted, read Nov 4, 2026: "In 2025, we processed
 * $1.79 trillion of total payment volume" and "As of December 31, 2025, we had 439 million active accounts".
 */
const PAYPAL_10K = { name: "PayPal, Form 10-K for 2025", href: "https://www.sec.gov/Archives/edgar/data/1633917/000163391726000024/pypl-20251231.htm" };

/**
 * Mastercard's 2025 State of Chargebacks, based on research from Datos Insights. Quoted, read Nov 4, 2026: global
 * chargeback volume "reaching 324 million transactions annually" by 2028, from "an estimated 261 million" in 2025;
 * "the financial impact of global chargebacks is expected to grow from $33.79 billion in 2025 to $41.69 billion in
 * 2028"; first-party and third-party fraud "accounting for approximately 45% of merchant chargeback volume globally".
 */
const MASTERCARD = { name: "Mastercard, 2025 State of Chargebacks", href: "https://www.mastercard.com/ie/en/news-and-trends/Insights/2025/what-s-the-true-cost-of-a-chargeback-in-2025.html" };

const usd = (n: number) => `$${n}`;
const feeOf = (label: string) => PAYPAL_FEES.fees.find((f) => f.label === label)!.amount;
const feeRange = PAYPAL_FEES.fees.map((f) => f.amount);
const readOn = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Facts 1 to 6: the market Exhibit works in. The chargeback figures are worldwide, not PayPal's own. */
export const MARKET_FACTS: CompanyFact[] = [
  { figure: "$1.79T", spoken: "$1.79 trillion", label: "paid through PayPal in 2025.", source: PAYPAL_10K },
  { figure: "439M", spoken: "439 million", label: "active PayPal accounts, consumers and merchants, at the end of 2025.", source: PAYPAL_10K },
  { figure: "324M", spoken: "324 million", label: "chargebacks a year worldwide by 2028, up from about 261 million in 2025.", source: MASTERCARD },
  { figure: "$41.7B", spoken: "$41.7 billion", label: "the yearly cost of chargebacks worldwide by 2028, up from $33.8 billion in 2025.", source: MASTERCARD },
  { figure: "45%", label: "of the chargebacks merchants see are fraudulent, first-party or third-party.", source: MASTERCARD },
  {
    figure: `${usd(Math.min(...feeRange))} to ${usd(Math.max(...feeRange))}`,
    label: `PayPal's fee when a buyer files a dispute claim or chargeback (${usd(feeOf("Card chargeback fee"))} for card chargebacks).`,
    source: { name: `PayPal business fees, read ${PAYPAL_FEES.retrieved}`, href: PAYPAL_FEES.url },
  },
];

/**
 * The twelve steps of a dispute, as the homepage's gap section draws them (src/components/site/home/Gap.tsx).
 * PayPal's three agent tools cover steps 1, 2 and 10: list_disputes, get_dispute and accept_dispute_claim.
 */
export const DISPUTE_STEPS = 12;
export const PAYPAL_TOOL_STEPS = [0, 1, 9];

/** Facts 7 and 8: what Exhibit adds, and what it never does. */
export const EXHIBIT_FACTS = {
  steps: {
    figure: `${PAYPAL_AGENT_TOOLS.tools.length} of ${DISPUTE_STEPS}`,
    label: "steps of a dispute that PayPal's own agent tools cover: list, read and accept. Exhibit covers all twelve.",
    source: { name: `PayPal agent tools reference, read ${readOn(PAYPAL_AGENT_TOOLS.retrieved)}`, href: PAYPAL_AGENT_TOOLS.url },
  },
  filings: {
    figure: "0",
    label: "filings sent without the merchant's say-so: their approval, or Autopilot rules they set.",
  },
};

// ------------------------------------------------------------------ the founders' photos

/**
 * The founders' photos (public/team, 640 x 640 WebP), with where each face sits so both crop the same way:
 * `face` is the centre of the face and `head` the height from hair to chin, as fractions of the photo.
 */
export const FOUNDER_PHOTOS: Record<(typeof FOUNDERS)[number]["name"], { src: string; face: [number, number]; head: number; tone: string }> = {
  "Shivansh Dwivedi": { src: "/team/shivansh-dwivedi.webp", face: [0.508, 0.41], head: 0.275, tone: "brightness(1.07) contrast(0.98)" },
  "Someet Shende": { src: "/team/someet-shende.webp", face: [0.47, 0.335], head: 0.425, tone: "brightness(0.98) contrast(1.06)" },
};

/** GitHub places people can reach the project. Discussions are not enabled on the repository (checked Nov 3, 2026). */
export const GITHUB = {
  repo: GITHUB_URL,
  issues: `${GITHUB_URL}/issues`,
  newIssue: `${GITHUB_URL}/issues/new/choose`,
  /** Private vulnerability reporting is enabled on the repository (GitHub API, Nov 3, 2026). */
  reportVulnerability: `${GITHUB_URL}/security/advisories/new`,
  securityPolicy: `${GITHUB_URL}/security/policy`,
  securityMd: `${GITHUB_URL}/blob/main/SECURITY.md`,
  license: `${GITHUB_URL}/blob/main/LICENSE`,
  contributing: `${GITHUB_URL}/blob/main/CONTRIBUTING.md`,
  ci: `${GITHUB_URL}/blob/main/.github/workflows/ci.yml`,
  tests: `${GITHUB_URL}/tree/main/tests`,
  file: (path: string) => `${GITHUB_URL}/blob/main/${path}`,
};

/** The suite as `npx vitest run --reporter=json` reported it on Nov 4, 2026: 359 tests in 20 files, all passing. */
export const TEST_FILES: { file: string; tests: number }[] = [
  { file: "simulator.test.ts", tests: 48 },
  { file: "prevention.test.ts", tests: 27 },
  { file: "approvals.test.ts", tests: 26 },
  { file: "autopilot.test.ts", tests: 26 },
  { file: "playbook.test.ts", tests: 26 },
  { file: "action-guardrail.test.ts", tests: 22 },
  { file: "contact-validation.test.ts", tests: 21 },
  { file: "approvals-api.test.ts", tests: 19 },
  { file: "contact-mime.test.ts", tests: 18 },
  { file: "filing.test.ts", tests: 18 },
  { file: "ask-grounding.test.ts", tests: 17 },
  { file: "citation-guardrail.test.ts", tests: 15 },
  { file: "contact-worker.test.ts", tests: 15 },
  { file: "api-bad-input.test.ts", tests: 13 },
  { file: "agent-run.test.ts", tests: 12 },
  { file: "config.test.ts", tests: 12 },
  { file: "mcp-server.test.ts", tests: 9 },
  { file: "agent-tools.test.ts", tests: 7 },
  { file: "product-tour.test.ts", tests: 5 },
  { file: "replays.test.ts", tests: 3 },
];
export const TEST_TOTAL = TEST_FILES.reduce((a, f) => a + f.tests, 0);

/**
 * The agent-approved filing of Nov 3, 2026, as Exhibit's own sandbox log holds it
 * (.data/exhibit-sandbox.db: approvals apv_348c2c7423, activity rows 287 to 292, api_calls 291).
 * The filing itself is also in proof.json (debug id f4652162f684d).
 */
export const NOV3 = {
  disputeId: "PP-R-EGO-10193744",
  client: "Claude Code",
  title: "Send the evidence packet to PayPal's chargeback review",
  detail: "Exhibit sends the response letter and a 6-exhibit PDF packet to PayPal's chargeback review. Win likelihood 88%.",
  note: "Re-investigated brief (FIGHT, 88%): 3DS/AVS/CVV passed, UPS signed by D REYES at the billing address, buyer confirmed receipt in chat.",
  requestedAt: "02:38 UTC",
  decidedAt: "02:39 UTC",
  call: {
    method: "POST",
    path: "/v1/customer/disputes/PP-R-EGO-10193744/provide-supporting-info",
    status: 200,
    ms: 2614,
    debugId: "f4652162f684d",
    when: "Nov 3, 2026, 02:39:18 UTC",
    // The stored request, exactly as logged: no Authorization header, the packet by name and size.
    headers: { Accept: "application/json", "Content-Type": "multipart/form-data" },
    notesStart: "Kora Atelier contests this chargeback: the account holder authorized this purchase and received it.",
    file: "exhibit-PP-R-EGO-10193744-evidence-packet.pdf",
    bytes: 47741,
    response: { href: "https://api-m.sandbox.paypal.com/v1/customer/disputes/PP-R-EGO-10193744", rel: "detail", method: "GET" },
  },
  /** Activity rows 287 to 292, oldest first. Times are UTC. */
  trail: [
    { at: "02:38:15", lane: "agent", title: "Claude Code requested approval: Send the evidence packet to PayPal's chargeback review", actor: "Claude Code, over MCP" },
    { at: "02:39:14", lane: "merchant", title: "Merchant approved Claude Code's request", actor: "Merchant, in the Exhibit app" },
    { at: "02:39:15", lane: "api", method: "GET", path: "/v1/customer/disputes/PP-R-EGO-10193744", status: 200, ms: 1377, debugId: "f482123aa7dc5", actor: "Exhibit re-reads the dispute before acting" },
    { at: "02:39:18", lane: "api", method: "POST", path: "/v1/customer/disputes/PP-R-EGO-10193744/provide-supporting-info", status: 200, ms: 2614, debugId: "f4652162f684d", actor: "agent:Claude Code approved by merchant" },
    { at: "02:39:18", lane: "action", title: "Sent supporting info with a 6-exhibit packet", actor: "agent:Claude Code approved by merchant" },
  ] as const,
};

/** The SQLite tables of a self-hosted Exhibit, from `sqlite3 .data/exhibit-sandbox.db .tables` (schema in src/lib/db.ts). */
export const SQLITE_TABLES = ["actions", "activity", "api_calls", "approvals", "docs", "kv", "runs"] as const;

/**
 * The four sandbox chargebacks with the latest brief on each (proof.json; every one of those briefs was HIGH
 * confidence in the sandbox log). Used to show what Autopilot's default rules would have done.
 */
const LATEST: Record<string, { decision: "FIGHT" | "REFUND"; likelihood: number }> = Object.fromEntries(
  proof.disputes.map((d) => {
    const done = proof.runs.filter((r) => r.disputeId === d.id && r.status === "done");
    const last = done[done.length - 1];
    return [d.id, { decision: last.decision as "FIGHT" | "REFUND", likelihood: last.winLikelihood as number }];
  }),
);
export const SANDBOX_CASES = proof.disputes.map((d) => ({
  id: d.id,
  buyer: d.buyer,
  amount: d.amount,
  reason: d.reason,
  status: d.status,
  decision: LATEST[d.id].decision,
  likelihood: LATEST[d.id].likelihood,
  confidence: "HIGH" as const,
}));
