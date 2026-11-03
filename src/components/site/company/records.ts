// Facts the company pages show that are not already exported to src/components/landing/records.
// Every value below was read from a real source on Nov 3, 2026; the source is named next to it.
// Prefer importing from the landing records (data.ts, proof.json, hero-runs.json) where a fact lives there.

import { GITHUB_URL } from "@/components/landing/data";
import proof from "@/components/landing/records/proof.json";

export const CONTACT_EMAIL = "contact@exhibit.9to5code.com";

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

/** The suite as `npx vitest run --reporter=json` reported it on Nov 3, 2026: 300 tests in 16 files, all passing. */
export const TEST_FILES: { file: string; tests: number }[] = [
  { file: "simulator.test.ts", tests: 48 },
  { file: "prevention.test.ts", tests: 27 },
  { file: "approvals.test.ts", tests: 26 },
  { file: "autopilot.test.ts", tests: 26 },
  { file: "playbook.test.ts", tests: 26 },
  { file: "action-guardrail.test.ts", tests: 22 },
  { file: "approvals-api.test.ts", tests: 19 },
  { file: "filing.test.ts", tests: 18 },
  { file: "ask-grounding.test.ts", tests: 17 },
  { file: "citation-guardrail.test.ts", tests: 15 },
  { file: "api-bad-input.test.ts", tests: 13 },
  { file: "agent-run.test.ts", tests: 12 },
  { file: "config.test.ts", tests: 12 },
  { file: "mcp-server.test.ts", tests: 9 },
  { file: "agent-tools.test.ts", tests: 7 },
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
