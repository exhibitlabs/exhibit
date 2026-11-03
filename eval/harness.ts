// The eval run: seeds the labelled cases into the isolated store, runs Exhibit's agent on each through
// the Claude CLI and records what it decided. Started by eval/run.ts, which pins the environment and
// the module hooks before anything here loads.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Decision } from "@/lib/agent/brief";
import { runAgent, type RunEvent } from "@/lib/agent/run";
import { executeTool, validateBrief, type ToolContext } from "@/lib/agent/tools";
import { AI_MODEL, aiProvider, dataDir, paypalMode } from "@/lib/config";
import { kvSet, resetDatabase } from "@/lib/db";
import { caseFile, latestRun } from "@/lib/disputes";
import { linksFor, simGet, simPut } from "@/lib/paypal/simulator";
import type { Dispute } from "@/lib/paypal/types";
import { store } from "@/lib/store/repo";
import { buildScenarios, type ScenarioRecords } from "@/lib/store/scenarios";
import { buildEvalCase, EVAL_CASES, labelsDigest, type EvalCase } from "./cases";
import { metrics, renderMarkdown, type CaseResult, type EvalResults, type RejectionKind } from "./report";
import { taps } from "./sdk-tap";

const EVAL_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(EVAL_DIR, "..");
const CASE_TIMEOUT_MS = 10 * 60_000;

/** The PayPal actions each decision may carry (Autopilot's consistency rule, src/lib/autopilot-rules.ts). */
const ACTIONS_FOR: Record<Decision, string[]> = { FIGHT: ["provide_evidence", "provide_supporting_info"], REFUND: ["accept_claim", "refund_then_prove"], OFFER: ["make_offer"], MESSAGE_BUYER: ["send_message"] };
/** The dispute links that make each decision possible (Rule 1 of eval/LABELING.md). */
const NEEDS: Record<Decision, string[]> = { FIGHT: ["provide_evidence", "provide_supporting_info"], REFUND: ["accept_claim", "provide_evidence"], OFFER: ["make_offer"], MESSAGE_BUYER: ["send_message"] };
/** Assistant-message errors that mean the API or the login failed, not the agent. */
const INFRA_ERRORS = ["authentication_failed", "oauth_org_not_allowed", "account_on_hold", "verification_required", "billing_error", "overloaded", "server_error", "model_not_found", "cloud_credential_error"];

type Spec = Pick<CaseResult, "id" | "title" | "expected" | "rationale" | "reason" | "stage" | "status"> & { disputeId: string };

function parseArgs(argv: string[]) {
  const value = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    check: argv.includes("--check") || argv.includes("--dump"),
    dump: argv.includes("--dump"),
    smoke: argv.includes("--smoke"),
    only: value("--only")?.split(",").map((s) => s.trim()).filter(Boolean),
    concurrency: Math.max(1, Number(value("--concurrency") ?? 2) || 2),
  };
}

/** Refuses to run anywhere but the simulator and a fresh temp dir. */
function assertIsolated() {
  const dir = dataDir();
  const temp = [os.tmpdir(), "/tmp", "/private/tmp"].map((d) => path.resolve(d));
  if (paypalMode() !== "demo") throw new Error("Refusing to run: PayPal is not on the in-process simulator.");
  if (!temp.some((t) => dir.startsWith(t + path.sep)) || dir.startsWith(path.join(ROOT, ".data"))) throw new Error(`Refusing to run: ${dir} is not an isolated temp dir.`);
  if (fs.existsSync(path.join(dir, "exhibit-demo.db"))) throw new Error(`Refusing to run: ${dir} already holds a database.`);
  if (process.env.EXHIBIT_RECORD_REPLAYS) throw new Error("Refusing to run: EXHIBIT_RECORD_REPLAYS would write recordings into replays/.");
}

/** A second net under the simulator: nothing in this process may reach PayPal or a local dev server. */
function guardNetwork() {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const host = URL.canParse(href) ? new URL(href).hostname : "";
    if (/(^|\.)paypal\.com$/.test(host) || ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) return Promise.reject(new Error(`eval: blocked fetch to ${href}`));
    return realFetch(input, init);
  }) as typeof fetch;
}

/** Writes the cases through the same store and simulator calls the demo seed uses. No scenario metadata: a CLI failure must be an error, never a replay. */
function seed(records: ScenarioRecords[], base: Date) {
  resetDatabase();
  // Marks the store as seeded, so nothing on the run path replaces these cases with the demo merchant.
  kvSet("seeded_at", base.toISOString());
  for (const r of records) {
    const d: Dispute = { ...r.dispute };
    d.links = linksFor(d);
    simPut(d);
    store.putOrder(r.order);
    for (const s of r.shipments) store.putShipment(s);
    store.putCustomer(r.customer);
    store.putConversation(r.conversation);
    store.putRisk(r.risk);
  }
}

/** Structural checks that need no tools and leave the store untouched. */
function lint(cases: EvalCase[], records: ScenarioRecords[], base: Date): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const now = base.getTime();
  cases.forEach((c, i) => {
    const r = records[i];
    for (const key of [c.id, c.dispute.id, r.order.id, r.order.paypal.capture_id, r.customer.email]) {
      if (seen.has(key)) problems.push(`${c.id}: duplicate id ${key}`);
      seen.add(key);
    }
    const rels = linksFor(r.dispute).map((l) => l.rel);
    if (!NEEDS[c.expected].some((rel) => rels.includes(rel))) problems.push(`${c.id}: label ${c.expected} needs ${NEEDS[c.expected].join(" or ")}; PayPal allows ${rels.filter((x) => x !== "self").join(", ")}`);
    const past = [r.order.placed_at, r.dispute.create_time, r.customer.first_order_at, ...r.shipments.flatMap((s) => [s.shipped_at, s.delivered_at, ...s.events.map((e) => e.at)]), ...r.conversation.messages.map((m) => m.at), ...(r.dispute.messages ?? []).map((m) => m.time_posted), ...(r.order.refunds ?? []).map((x) => x.at)];
    for (const t of past) if (t && Date.parse(t) > now) problems.push(`${c.id}: ${t} is in the future`);
    if (!r.dispute.seller_response_due_date || Date.parse(r.dispute.seller_response_due_date) <= now) problems.push(`${c.id}: the response deadline has passed`);
    for (const s of r.shipments) {
      if (Date.parse(s.shipped_at) < Date.parse(r.order.placed_at)) problems.push(`${c.id}: ${s.id} shipped before the order was placed`);
      if (s.delivered_at && Date.parse(s.delivered_at) < Date.parse(s.shipped_at)) problems.push(`${c.id}: ${s.id} delivered before it shipped`);
    }
    const times = r.conversation.messages.map((m) => Date.parse(m.at));
    if (times.some((t, j) => j > 0 && t < times[j - 1])) problems.push(`${c.id}: support messages out of order`);
    if (Date.parse(r.customer.first_order_at) > Date.parse(r.order.placed_at)) problems.push(`${c.id}: first order after this order`);
  });
  return problems;
}

/** --check: runs every lookup tool on every case, with no model, and checks nothing leaks the label. --dump also prints what the tools return. */
async function checkTools(cases: EvalCase[], records: ScenarioRecords[], dump: boolean) {
  let failed = 0;
  for (const [i, c] of cases.entries()) {
    const r = records[i];
    const ctx: ToolContext = { disputeId: c.dispute.id, emit: () => {} };
    const problems: string[] = [];
    const texts: string[] = [];
    const call = async (name: string, input: unknown) => {
      const res = await executeTool(name, input, ctx);
      texts.push(res.text);
      if (res.isError) problems.push(`${name}: ${res.text.slice(0, 200)}`);
      if (dump) console.log(`\n--- ${c.id} · ${name}\n${JSON.stringify(JSON.parse(res.text), null, 1)}`);
      return JSON.parse(res.text) as Record<string, unknown>;
    };
    const d = await call("get_paypal_dispute", { dispute_id: c.dispute.id });
    const o = await call("lookup_order", { transaction_id: r.order.paypal.capture_id });
    if (o.order_id !== r.order.id) problems.push(`lookup_order returned ${String(o.order_id)}`);
    const t = await call("get_carrier_tracking", { order_id: r.order.id });
    await call("get_customer_history", { email: r.customer.email });
    await call("get_support_conversation", { order_id: r.order.id });
    await call("get_payment_risk_signals", { order_id: r.order.id });
    await call("get_store_policies", {});
    const sp = await call("check_seller_protection", { dispute_id: c.dispute.id });
    const all = texts.join("\n");
    for (const secret of [c.title, c.rationale, `"${c.id}"`]) if (all.includes(secret)) problems.push(`a tool output contains the case's ${secret === c.title ? "title" : secret === c.rationale ? "rationale" : "id"}`);
    const shipments = (t.shipments as { direction: string; status: string; delivery_address_matches_transaction: boolean | null }[] | undefined) ?? [];
    const ship = shipments.map((s) => `${s.direction[0]}:${s.status}${s.delivery_address_matches_transaction === false ? "(addr≠txn)" : ""}`).join(" ") || "none";
    if (problems.length) failed++;
    console.log(`${problems.length ? "FAIL" : "ok  "} ${c.id.padEnd(9)} ${c.expected.padEnd(13)} ${String(d.stage).padEnd(10)} ${String(d.status).padEnd(27)} allows ${(d.allowed_actions as string[]).join(",").padEnd(52)} protection ${String(sp.verdict).padEnd(15)} ${ship}`);
    for (const p of problems) console.log(`       ${p}`);
  }
  console.log(`\n${cases.length - failed}/${cases.length} cases seed cleanly and answer every lookup tool.`);
  if (cases.length === EVAL_CASES.length) {
    // Anyone can confirm the labels are the ones the published run used.
    const digest = labelsDigest();
    const published = path.join(EVAL_DIR, "results.json");
    const ran = fs.existsSync(published) ? (JSON.parse(fs.readFileSync(published, "utf8")) as EvalResults).meta.labels_sha256 : null;
    console.log(`Labels SHA-256: ${digest}${ran ? (ran === digest ? " (matches eval/results.json)" : ` (DIFFERS from eval/results.json: ${ran})`) : ""}`);
  }
  return failed ? 1 : 0;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

async function runOne(s: Spec): Promise<CaseResult> {
  const events: RunEvent[] = [];
  const before = simGet(s.disputeId)?.status;
  const started = Date.now();
  let timedOut = false;
  await Promise.race([
    runAgent(s.disputeId, (e) => events.push(e), { trigger: "batch" }),
    new Promise<void>((resolve) =>
      setTimeout(() => {
        timedOut = true;
        resolve();
      }, CASE_TIMEOUT_MS).unref(),
    ),
  ]);
  const minutes = (Date.now() - started) / 60_000;
  const run = latestRun(s.disputeId);
  const tap = taps.get(s.disputeId);
  const brief = timedOut ? null : (run?.brief ?? null);
  const error = brief ? null : timedOut ? `no brief after ${CASE_TIMEOUT_MS / 60_000} minutes` : (run?.error ?? "no brief filed");

  const toolCalls = events.filter((e): e is Extract<RunEvent, { t: "tool_call" }> => e.t === "tool_call");
  const toolResults = events.filter((e): e is Extract<RunEvent, { t: "tool_result" }> => e.t === "tool_result");
  const filings = toolResults.filter((e) => e.name === "file_case_brief");
  const rejections = filings
    .filter((e) => !e.ok)
    .flatMap((e) => {
      const out = e.output as { problems?: string[]; issues?: string[] } | null;
      if (out?.issues) return out.issues.map((detail) => ({ kind: "schema" as RejectionKind, detail }));
      return (out?.problems ?? [e.summary]).map((detail) => ({ kind: (/unknown ref|labels must be unique/.test(detail) ? "citation" : "action") as RejectionKind, detail }));
    });

  const rateLimited = !brief && (tap?.rateLimits.some((x) => x.status === "rejected") || tap?.assistantErrors.includes("rate_limit") || /rate.?limit|usage limit|limit reached|\b429\b/i.test(error ?? ""));
  const infraFailure = !brief && !rateLimited && (toolCalls.length === 0 || !!tap?.assistantErrors.some((x) => INFRA_ERRORS.includes(x)));
  const infra: CaseResult["infra"] = brief ? null : timedOut ? "timeout" : rateLimited ? "rate_limit" : infraFailure ? "cli" : null;

  const calls = Object.values(tap?.calls ?? {});
  const done = events.find((e): e is Extract<RunEvent, { t: "done" }> => e.t === "done");
  // The CLI also reports utilization of the plan's windows (not in the SDK's types).
  const lastLimit = tap?.rateLimits.at(-1) as (NonNullable<typeof tap>["rateLimits"][number] & { unifiedWindows?: Record<string, { utilization?: number }> }) | undefined;
  const after = simGet(s.disputeId);
  const problems = brief && after ? validateBrief(brief, caseFile(after)) : [];

  return {
    id: s.id,
    title: s.title,
    reason: s.reason,
    stage: s.stage,
    status: s.status,
    expected: s.expected,
    rationale: s.rationale,
    outcome: brief ? "brief" : infra ? "infra_error" : "agent_error",
    error,
    infra,
    decision: brief?.decision ?? null,
    headline: brief?.headline ?? null,
    win_likelihood: brief?.win_likelihood ?? null,
    confidence: brief?.confidence ?? null,
    action: brief?.paypal_action ?? null,
    exhibits: brief ? brief.exhibits.length : null,
    buyer_message_language: brief?.buyer_message?.language ?? null,
    guardrails: {
      final_valid: brief ? problems.length === 0 : null,
      revalidation_problems: problems,
      action_matches_decision: brief ? ACTIONS_FOR[brief.decision].includes(brief.paypal_action.type) : null,
      file_attempts: filings.length,
      file_attempts_model: tap ? tap.toolUses.filter((u) => u.name.endsWith("file_case_brief")).length : null,
      rejections,
    },
    tools: toolCalls.map((e) => e.name),
    tool_failures: toolResults.filter((e) => !e.ok && e.name !== "file_case_brief").length,
    minutes,
    tokens: {
      measured: tap
        ? { api_calls: calls.length, input: sum(calls.map((u) => u.input_tokens)), cache_read: sum(calls.map((u) => u.cache_read_input_tokens)), cache_creation: sum(calls.map((u) => u.cache_creation_input_tokens)), output: sum(calls.map((u) => u.output_tokens)) }
        : null,
      provider_reported: done?.usage ?? null,
    },
    models: tap?.models ?? [],
    provider: run?.provider ?? null,
    acted: events.some((e) => e.t === "action") || (after?.status ?? before) !== before,
    rate_limit: lastLimit
      ? { status: lastLimit.status, type: lastLimit.rateLimitType, five_hour: lastLimit.unifiedWindows?.five_hour?.utilization ?? lastLimit.utilization, seven_day: lastLimit.unifiedWindows?.seven_day?.utilization }
      : null,
    brief,
  };
}

function notRun(s: Spec): CaseResult {
  return {
    ...s,
    outcome: "not_run",
    error: null,
    infra: null,
    decision: null,
    headline: null,
    win_likelihood: null,
    confidence: null,
    action: null,
    exhibits: null,
    buyer_message_language: null,
    guardrails: { final_valid: null, revalidation_problems: [], action_matches_decision: null, file_attempts: 0, file_attempts_model: null, rejections: [] },
    tools: [],
    tool_failures: 0,
    minutes: null,
    tokens: { measured: null, provider_reported: null },
    models: [],
    provider: null,
    acted: false,
    rate_limit: null,
    brief: null,
  };
}

/** Runs the cases `concurrency` at a time. Stops starting new ones at the first rate limit, or if the CLI fails twice at the start. */
async function runAll(specs: Spec[], concurrency: number, onDone: (r: CaseResult, done: number) => void) {
  const results: (CaseResult | undefined)[] = new Array(specs.length);
  let next = 0;
  let done = 0;
  let stop: string | null = null;
  const worker = async () => {
    while (!stop && next < specs.length) {
      const i = next++;
      const r = await runOne(specs[i]);
      results[i] = r;
      onDone(r, ++done);
      if (r.infra === "rate_limit") stop ??= `rate limit on ${r.id} (${r.error}); later cases were not started`;
      else if (results.filter((x) => x?.infra === "cli").length >= 2 && !results.some((x) => x?.outcome === "brief")) stop ??= `the Claude CLI failed on the first runs (${r.error})`;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, specs.length) }, worker));
  return { results: results.map((r, i) => r ?? notRun(specs[i])), stop };
}

function progress(r: CaseResult, done: number, total: number) {
  const t = r.tokens.measured;
  const verdict = r.decision ? `${r.decision.padEnd(13)} ${r.decision === r.expected ? "match" : "MISS "}` : `no brief [${r.infra ?? "agent"}] ${r.error}`;
  const tokens = t ? ` ${Math.round((t.input + t.cache_read + t.cache_creation) / 1000)}k in / ${(t.output / 1000).toFixed(1)}k out` : "";
  const refiled = r.guardrails.rejections.length ? ` (${r.guardrails.rejections.length} rejection${r.guardrails.rejections.length > 1 ? "s" : ""})` : "";
  return `[${String(done).padStart(2)}/${total}] ${r.id.padEnd(9)} label ${r.expected.padEnd(13)} exhibit ${verdict} ${(r.minutes ?? 0).toFixed(1)} min${tokens}${refiled}`;
}

const git = (...args: string[]) => {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

function sdkVersion() {
  try {
    return (JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules/@anthropic-ai/claude-agent-sdk/package.json"), "utf8")) as { version: string }).version;
  } catch {
    return "unknown";
  }
}

/** --smoke: one demo-merchant case that is not in the eval set, to prove the plumbing before the real run. */
async function smoke(base: Date) {
  const s = buildScenarios(base).find((x) => x.key === "inr-delivered-signed");
  if (!s) throw new Error("demo scenario inr-delivered-signed not found");
  seed([s], base);
  const r = await runOne({ id: "smoke", title: s.title, expected: "FIGHT", rationale: "Smoke test, not scored.", reason: s.dispute.reason, stage: s.dispute.dispute_life_cycle_stage, status: s.dispute.status, disputeId: s.dispute.dispute_id });
  fs.writeFileSync(path.join(dataDir(), "smoke.json"), JSON.stringify({ result: r, tap: taps.get(s.dispute.dispute_id) }, null, 2));
  console.log(progress(r, 1, 1));
  console.log(JSON.stringify({ outcome: r.outcome, error: r.error, provider: r.provider, models: r.models, decision: r.decision, action: r.action, guardrails: r.guardrails, tools: r.tools, tokens: r.tokens, rate_limit: r.rate_limit, acted: r.acted }, null, 2));
  console.log(`Full record: ${path.join(dataDir(), "smoke.json")}`);
  return r.outcome === "brief" ? 0 : 1;
}

export async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  assertIsolated();
  guardNetwork();
  const base = new Date();
  if (args.smoke) return smoke(base);

  const cases = args.only ? EVAL_CASES.filter((c) => args.only?.includes(c.id)) : EVAL_CASES;
  const unknown = (args.only ?? []).filter((id) => !EVAL_CASES.some((c) => c.id === id));
  if (unknown.length) throw new Error(`Unknown case ids: ${unknown.join(", ")}`);
  const records = cases.map((c) => buildEvalCase(c, base));
  const problems = lint(cases, records, base);
  if (problems.length) {
    console.error(`The case set has problems:\n${problems.join("\n")}`);
    return 1;
  }
  seed(records, base);
  console.error(`Seeded ${cases.length} cases into ${dataDir()} (PayPal: in-process simulator).`);
  if (args.check) return checkTools(cases, records, args.dump);

  if (aiProvider() !== "claude-code") throw new Error(`Refusing to run: the AI provider is ${aiProvider()}, not the Claude CLI.`);
  console.error(`Running Exhibit on ${cases.length} cases, ${args.concurrency} at a time, model ${AI_MODEL} via the Claude CLI.`);
  const started = new Date();
  const partial = path.join(dataDir(), "results.partial.jsonl");
  const specs: Spec[] = cases.map((c) => ({ id: c.id, title: c.title, expected: c.expected, rationale: c.rationale, reason: c.dispute.reason, stage: c.dispute.stage, status: c.dispute.status ?? "WAITING_FOR_SELLER_RESPONSE", disputeId: c.dispute.id }));
  const { results, stop } = await runAll(specs, args.concurrency, (r, done) => {
    fs.appendFileSync(partial, `${JSON.stringify(r)}\n`);
    console.error(progress(r, done, specs.length));
  });
  const finished = new Date();

  const out: EvalResults = {
    meta: {
      started_at: started.toISOString(),
      finished_at: finished.toISOString(),
      cases_in_set: cases.length,
      provider: aiProvider(),
      model_requested: AI_MODEL,
      models_reported: [...new Set(results.flatMap((r) => r.models))],
      concurrency: args.concurrency,
      node: process.version,
      sdk_version: sdkVersion(),
      commit: git("rev-parse", "HEAD"),
      worktree_dirty: git("status", "--porcelain").length > 0,
      agent_code_changed: git("status", "--porcelain", "--", "src/lib").length > 0,
      data_dir: dataDir(),
      labels_sha256: labelsDigest(cases),
      stopped_early: stop,
      wall_minutes_total: (finished.getTime() - started.getTime()) / 60_000,
    },
    cases: results,
  };
  // A subset run never overwrites the published results.
  const dir = args.only ? dataDir() : EVAL_DIR;
  fs.writeFileSync(path.join(dir, "results.json"), `${JSON.stringify(out, null, 2)}\n`);
  fs.writeFileSync(path.join(dir, "RESULTS.md"), renderMarkdown(out));
  const m = metrics(out);
  console.log(
    `\nn=${m.n}: exact agreement ${m.exact.k}/${m.exact.n}, fight vs don't ${m.fightAgreement.k}/${m.fightAgreement.n}, honest refunds ${m.honestRefund.k}/${m.honestRefund.n}, false fights ${m.falseFight.k}/${m.falseFight.n}, guardrails ${m.guardrailsPassed.k}/${m.guardrailsPassed.n}, median ${m.minutes.median?.toFixed(1)} min.${stop ? `\nStopped early: ${stop}` : ""}\nWrote ${path.join(dir, "results.json")} and RESULTS.md.`,
  );
  return 0;
}
