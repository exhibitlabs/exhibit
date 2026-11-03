// Metrics and the RESULTS.md report, computed from eval/results.json. Pure functions: the harness calls
// renderMarkdown after a run, and `node eval/run.ts --report` rebuilds the file from saved results.

import fs from "node:fs";
import type { CaseBrief, Decision } from "@/lib/agent/brief";
import type { DisputeReason, DisputeStage, DisputeStatus } from "@/lib/paypal/types";
import { LABEL_CHANGES, NOTES, READINGS } from "./readings";

export const DECISION_ORDER: Decision[] = ["FIGHT", "OFFER", "REFUND", "MESSAGE_BUYER"];

export type RejectionKind = "citation" | "action" | "schema";

export type CaseResult = {
  id: string;
  title: string;
  reason: DisputeReason;
  stage: DisputeStage;
  status: DisputeStatus;
  expected: Decision;
  rationale: string;
  /** brief: a validated brief was filed. agent_error: the agent ran but filed none (counts against it). infra_error / not_run: excluded from n. */
  outcome: "brief" | "agent_error" | "infra_error" | "not_run";
  error: string | null;
  infra: "rate_limit" | "cli" | "timeout" | null;
  decision: Decision | null;
  headline: string | null;
  win_likelihood: number | null;
  confidence: CaseBrief["confidence"] | null;
  action: CaseBrief["paypal_action"] | null;
  exhibits: number | null;
  buyer_message_language: string | null;
  guardrails: {
    /** The filed brief re-checked after the run with Exhibit's validateBrief (citations resolve, action allowed). */
    final_valid: boolean | null;
    revalidation_problems: string[];
    /** The PayPal action is one the decision may carry (FIGHT: evidence/supporting info, REFUND: accept/refund, ...). */
    action_matches_decision: boolean | null;
    /** file_case_brief calls Exhibit's handler received. */
    file_attempts: number;
    /** file_case_brief calls the model made, from the SDK tap (includes inputs rejected before Exhibit saw them). */
    file_attempts_model: number | null;
    rejections: { kind: RejectionKind; detail: string }[];
  };
  tools: string[];
  tool_failures: number;
  minutes: number | null;
  tokens: {
    /** From the SDK tap: one entry per API call, deduplicated by message id. */
    measured: { api_calls: number; input: number; cache_read: number; cache_creation: number; output: number } | null;
    /** What Exhibit's provider put on its "done" event. */
    provider_reported: { input_tokens?: number; output_tokens?: number } | null;
  };
  models: string[];
  provider: string | null;
  /** Whether any PayPal action executed (must stay false: the eval never files, offers or refunds). */
  acted: boolean;
  /** The last rate-limit event the CLI sent during the run, with plan-window utilization (0 to 1) when reported. */
  rate_limit: { status: string; type?: string; five_hour?: number; seven_day?: number } | null;
  brief: CaseBrief | null;
};

export type EvalMeta = {
  started_at: string;
  finished_at: string;
  cases_in_set: number;
  provider: string;
  model_requested: string;
  models_reported: string[];
  concurrency: number;
  node: string;
  sdk_version: string;
  commit: string;
  worktree_dirty: boolean;
  /** Uncommitted changes under src/lib (the agent's prompt, tools, providers, guardrails). Not recorded before 2026-11-03's run. */
  agent_code_changed?: boolean;
  data_dir: string;
  labels_sha256: string;
  stopped_early: string | null;
  wall_minutes_total: number;
};

export type EvalResults = { meta: EvalMeta; cases: CaseResult[] };

// ---- Metrics ------------------------------------------------------------------------------------

export type Rate = { k: number; n: number; pct: number | null; lo: number | null; hi: number | null };

/** Share with a Wilson 95% score interval (sensible at small n and at 0% or 100%). */
export function rate(k: number, n: number): Rate {
  if (!n) return { k, n, pct: null, lo: null, hi: null };
  const z = 1.96;
  const p = k / n;
  const den = 1 + (z * z) / n;
  const center = (p + (z * z) / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
  return { k, n, pct: 100 * p, lo: 100 * Math.max(0, center - half), hi: 100 * Math.min(1, center + half) };
}

const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const fights = (d: Decision | null) => d === "FIGHT";

/**
 * Exhibit's provider closes the stream as soon as a brief is accepted, which can come before the API's
 * final output count for that last call arrives. A complete count can never be smaller than the brief
 * the run wrote (JSON text runs about 4 characters a token), so a smaller count is a lower bound. In the
 * 2026-11-03 run the two groups sat far apart: complete runs had at most 2 brief characters per output
 * token, cut-off runs at least 5.
 */
export const outputComplete = (c: CaseResult) => !!c.tokens.measured && !!c.brief && c.tokens.measured.output * 4 >= JSON.stringify(c.brief).length;

export function metrics(r: EvalResults) {
  // Scored: every case the agent actually ran on. A run that ended without a brief counts as a miss.
  const scored = r.cases.filter((c) => c.outcome === "brief" || c.outcome === "agent_error");
  const briefs = scored.filter((c) => c.outcome === "brief");
  const buyerRight = scored.filter((c) => c.expected === "REFUND");
  const shouldNotFight = scored.filter((c) => c.expected !== "FIGHT");
  const shouldFight = scored.filter((c) => c.expected === "FIGHT");
  const minutes = briefs.map((c) => c.minutes).filter((x): x is number => x !== null);
  const measured = briefs.map((c) => c.tokens.measured).filter((x): x is NonNullable<CaseResult["tokens"]["measured"]> => !!x);
  const completeOutput = briefs.filter(outputComplete).map((c) => c.tokens.measured!.output);
  const reported = briefs.map((c) => c.tokens.provider_reported).filter((x): x is NonNullable<CaseResult["tokens"]["provider_reported"]> => !!x);
  const confusion = Object.fromEntries(DECISION_ORDER.map((e) => [e, Object.fromEntries([...DECISION_ORDER, "NONE"].map((a) => [a, 0]))])) as Record<Decision, Record<Decision | "NONE", number>>;
  for (const c of scored) confusion[c.expected][c.decision ?? "NONE"]++;
  const groupBy = <K extends string>(key: (c: CaseResult) => K) => {
    const out = new Map<K, Rate>();
    for (const k of [...new Set(scored.map(key))]) {
      const g = scored.filter((c) => key(c) === k);
      out.set(k, rate(g.filter((c) => c.decision === c.expected).length, g.length));
    }
    return out;
  };
  return {
    n: scored.length,
    filed: briefs.length,
    excluded: r.cases.filter((c) => c.outcome === "infra_error" || c.outcome === "not_run"),
    agentErrors: scored.filter((c) => c.outcome === "agent_error"),
    exact: rate(scored.filter((c) => c.decision === c.expected).length, scored.length),
    fightAgreement: rate(scored.filter((c) => c.decision !== null && fights(c.decision) === fights(c.expected)).length, scored.length),
    honestRefund: rate(buyerRight.filter((c) => c.decision !== null && !fights(c.decision)).length, buyerRight.length),
    refundedWhenRight: rate(buyerRight.filter((c) => c.decision === "REFUND").length, buyerRight.length),
    falseFight: rate(shouldNotFight.filter((c) => fights(c.decision)).length, shouldNotFight.length),
    missedFight: rate(shouldFight.filter((c) => !fights(c.decision)).length, shouldFight.length),
    guardrailsPassed: rate(briefs.filter((c) => c.guardrails.final_valid).length, scored.length),
    firstFilingAccepted: rate(briefs.filter((c) => c.guardrails.rejections.length === 0 && c.guardrails.file_attempts === 1 && (c.guardrails.file_attempts_model ?? 1) === 1).length, briefs.length),
    actionMatchesDecision: rate(briefs.filter((c) => c.guardrails.action_matches_decision).length, briefs.length),
    minutes: { median: median(minutes), mean: mean(minutes), min: minutes.length ? Math.min(...minutes) : null, max: minutes.length ? Math.max(...minutes) : null },
    tokens: {
      cases: measured.length,
      apiCalls: { median: median(measured.map((t) => t.api_calls)), mean: mean(measured.map((t) => t.api_calls)) },
      input: { median: median(measured.map((t) => t.input + t.cache_read + t.cache_creation)), mean: mean(measured.map((t) => t.input + t.cache_read + t.cache_creation)), total: measured.reduce((a, t) => a + t.input + t.cache_read + t.cache_creation, 0) },
      cacheRead: measured.reduce((a, t) => a + t.cache_read, 0),
      // Output statistics use only the runs whose final output count arrived; the total is a lower bound.
      output: { median: median(completeOutput), mean: mean(completeOutput), complete: completeOutput.length, total: measured.reduce((a, t) => a + t.output, 0) },
      reportedInput: reported.reduce((a, t) => a + (t.input_tokens ?? 0), 0),
      reportedOutput: reported.reduce((a, t) => a + (t.output_tokens ?? 0), 0),
    },
    planWindow: (() => {
      const u = r.cases.map((c) => c.rate_limit?.five_hour).filter((x): x is number => typeof x === "number");
      return u.length ? { min: Math.min(...u), max: Math.max(...u) } : null;
    })(),
    confusion,
    byReason: groupBy((c) => c.reason),
    byStage: groupBy((c) => (c.status === "UNDER_REVIEW" ? "UNDER_REVIEW" : c.stage)),
    disagreements: scored.filter((c) => c.decision !== c.expected),
    rejections: briefs.flatMap((c) => c.guardrails.rejections.map((x) => ({ id: c.id, ...x }))),
    acted: r.cases.filter((c) => c.acted),
    wrongProvider: r.cases.filter((c) => c.provider && c.provider !== "claude-code"),
  };
}

// ---- Markdown -----------------------------------------------------------------------------------

const REASON: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Not as described",
  UNAUTHORISED: "Unauthorized",
  DUPLICATE_TRANSACTION: "Duplicate charge",
  CREDIT_NOT_PROCESSED: "Credit not processed",
  INCORRECT_AMOUNT: "Incorrect amount",
  PAYMENT_BY_OTHER_MEANS: "Paid by other means",
};
const STAGE: Record<string, string> = { INQUIRY: "Inquiry", CHARGEBACK: "Chargeback", UNDER_REVIEW: "Chargeback, under PayPal review" };

const pct = (x: number | null) => (x === null ? "n/a" : `${Math.round(x)}%`);
const frac = (r: Rate) => (r.n ? `${r.k}/${r.n} (${pct(r.pct)})` : "n/a");
const ci = (r: Rate) => (r.n ? `${Math.round(r.lo ?? 0)}–${Math.round(r.hi ?? 0)}%` : "");
const num = (x: number | null, d = 1) => (x === null ? "n/a" : x.toFixed(d));
const secs = (minutes: number | null) => (minutes === null ? "n/a" : `${Math.round(minutes * 60)} s`);
const k = (x: number | null) => (x === null ? "n/a" : x >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : x >= 1000 ? `${(x / 1000).toFixed(1)}k` : String(Math.round(x)));
const cell = (s: string | null | undefined) => (s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const code = (s: string | null | undefined) => (s ? `\`${s}\`` : "none");

function actionLabel(a: CaseBrief["paypal_action"] | null) {
  if (!a) return "none";
  const bits: string[] = [a.type];
  if (a.offer_type) bits.push(a.offer_type);
  if (a.amount !== undefined) bits.push(`$${a.amount}`);
  if (a.evidence_types?.length) bits.push(a.evidence_types.join("+"));
  return bits.join(" · ");
}

export type Readings = { readings: Record<string, string>; labelChanges: typeof LABEL_CHANGES; notes: string[] };

export function renderMarkdown(r: EvalResults, x: Readings = { readings: READINGS, labelChanges: LABEL_CHANGES, notes: NOTES }): string {
  const m = metrics(r);
  const meta = r.meta;
  const date = meta.started_at.slice(0, 10);
  const models = meta.models_reported.length ? meta.models_reported.map(code).join(", ") : "not reported";
  const out: string[] = [];
  const p = (...lines: string[]) => out.push(...lines);

  p(
    "# Exhibit evaluation results",
    "",
    "<!-- Generated by `node eval/run.ts` from eval/results.json. Readings, label changes and notes come from eval/readings.ts; rebuild with `node eval/run.ts --report`. -->",
    "",
    `**What this is.** ${meta.cases_in_set} synthetic PayPal disputes. The builder wrote every case and label: Claude Opus 5.5, an AI coding agent working for Exhibit's founders. Each label is the decision a careful merchant should take, and every label was set before Exhibit ran on anything (rules: [LABELING.md](LABELING.md); cases: [cases.ts](cases.ts)). Exhibit then ran once on each case, live, on the Claude CLI, with its production prompt, tools and guardrails unchanged, against Exhibit's built-in PayPal simulator. The cases are synthetic, the labels are the builder's, n is small and there is one model. Read these numbers as a disclosed sanity check of the agent's judgement, not as a measured production accuracy.`,
    "",
    "## Run",
    "",
    "| | |",
    "| --- | --- |",
    `| Cases | ${meta.cases_in_set} in the set, **n = ${m.n} scored**${m.excluded.length ? `, ${m.excluded.length} not scored (${m.excluded.map((c) => `${c.id}: ${c.infra ?? c.outcome}`).join("; ")})` : ""} |`,
    `| Date | ${date} (${meta.started_at.slice(11, 16)}–${meta.finished_at.slice(11, 16)} UTC, ${num(meta.wall_minutes_total)} min wall clock) |`,
    `| Model | ${code(meta.model_requested)} requested; the CLI reported ${models} |`,
    `| Provider | Claude CLI through the Claude Agent SDK (\`EXHIBIT_AI_PROVIDER=claude-code\`), on the machine's Claude login (a founder's Claude plan) |`,
    `| Code path | \`runAgent\` (the Run button's code path): the same system prompt, nine tools, brief schema and \`validateBrief\` guardrail as the product. Autopilot off, so no PayPal action executed |`,
    `| PayPal | The in-process simulator (\`EXHIBIT_PAYPAL_MODE=demo\`) in an isolated data dir. No sandbox or live PayPal call. |`,
    `| Concurrency | ${meta.concurrency} |`,
    `| Labels | Written before the run. SHA-256 of every (id, label, rationale): \`${meta.labels_sha256.slice(0, 16)}…\` |`,
    `| Code | \`${meta.commit.slice(0, 7)}\`${meta.agent_code_changed ? ", **with uncommitted changes in src/lib**" : meta.agent_code_changed === false ? (meta.worktree_dirty ? ", src/lib unchanged (uncommitted edits elsewhere)" : "") : meta.worktree_dirty ? " with uncommitted edits outside the agent's code (see the findings)" : ""}; Node ${meta.node}; Claude Agent SDK ${meta.sdk_version} |`,
    ...(meta.stopped_early ? [`| Stopped early | ${meta.stopped_early} |`] : []),
    "",
    "## Headline numbers",
    "",
    "| Measure | Result | 95% CI | What it counts |",
    "| --- | --- | --- | --- |",
    `| Exact decision agreement | **${frac(m.exact)}** | ${ci(m.exact)} | Exhibit's decision equals the label |`,
    `| Fight vs. don't-fight agreement | **${frac(m.fightAgreement)}** | ${ci(m.fightAgreement)} | \`FIGHT\` vs. any of \`OFFER\`, \`REFUND\`, \`MESSAGE_BUYER\` |`,
    `| Honest-refund rate | **${frac(m.honestRefund)}** | ${ci(m.honestRefund)} | label \`REFUND\` (the buyer is right) and Exhibit did not fight |`,
    `| Refunded when the buyer was right | ${frac(m.refundedWhenRight)} | ${ci(m.refundedWhenRight)} | label \`REFUND\` and Exhibit chose \`REFUND\` |`,
    `| False-fight rate | **${frac(m.falseFight)}** | ${ci(m.falseFight)} | label is not \`FIGHT\`, and Exhibit chose \`FIGHT\` |`,
    `| Missed fights | ${frac(m.missedFight)} | ${ci(m.missedFight)} | label \`FIGHT\`, and Exhibit did not fight |`,
    `| Briefs that passed the citation and action guardrails | **${frac(m.guardrailsPassed)}** | | every cited evidence ref resolves to a real record and the PayPal action is one the dispute allows (re-checked after the run) |`,
    `| …accepted on the first filing | ${frac(m.firstFilingAccepted)} | | no rejected \`file_case_brief\` call before the accepted one |`,
    `| Minutes per case | **median ${num(m.minutes.median)}, mean ${num(m.minutes.mean)}** | | wall time from start to a filed, validated brief (median ${secs(m.minutes.median)}, range ${secs(m.minutes.min)} to ${secs(m.minutes.max)}) |`,
    "",
    `A run that ended without a brief counts as a miss in every rate (${m.agentErrors.length ? m.agentErrors.map((c) => c.id).join(", ") : "there were none"}).`,
    ...(m.exact.n && m.exact.k === m.exact.n
      ? [
          "",
          `**Every label matched. On a set the builder wrote, that is a ceiling result.** It shows the agent applies its rules consistently, including on every trap case. It says little about accuracy on real disputes: the lower end of the 95% interval is ${Math.round(m.exact.lo ?? 0)}%, and the set has no headroom to separate a good agent from a better one. See the findings and limitations below.`,
        ]
      : []),
    "",
    "## Confusion matrix",
    "",
    "Rows are the label; columns are Exhibit's decision.",
    "",
    "| Label \\ Exhibit | `FIGHT` | `OFFER` | `REFUND` | `MESSAGE_BUYER` | no brief | total |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...DECISION_ORDER.map((e) => {
      const row = m.confusion[e];
      const total = Object.values(row).reduce((a, b) => a + b, 0);
      return `| \`${e}\` | ${[...DECISION_ORDER, "NONE" as const].map((a) => (a === e ? `**${row[a]}**` : String(row[a]))).join(" | ")} | ${total} |`;
    }),
    "",
    "## Every disagreement",
    "",
  );
  if (!m.disagreements.length) p("None.", "");
  else
    p(
      "| Case | Reason, stage | Label | Exhibit | Exhibit's headline | Reading |",
      "| --- | --- | --- | --- | --- | --- |",
      ...m.disagreements.map(
        (c) =>
          `| \`${c.id}\` | ${REASON[c.reason] ?? c.reason}, ${STAGE[c.status === "UNDER_REVIEW" ? "UNDER_REVIEW" : c.stage]} | \`${c.expected}\` | ${c.decision ? `\`${c.decision}\` (${c.win_likelihood}%)` : `no brief: ${cell(c.error)}`} | ${cell(c.headline)} | ${cell(x.readings[c.id] ?? "(reading pending)")} |`,
      ),
      "",
      "The case texts and labels are in [cases.ts](cases.ts). Each brief Exhibit filed, with its reasoning, exhibits and letter, is in [results.json](results.json).",
      "",
    );

  p(
    "## Guardrails",
    "",
    `- **Filed briefs:** ${m.filed} of ${m.n} runs ended with a filed brief${m.n - m.filed ? ` (${m.n - m.filed} without one)` : ""}. Re-checked after the run with \`validateBrief\`, ${m.guardrailsPassed.k} of ${m.filed} pass: every exhibit and reasoning point cites a ref a tool returned, and every PayPal action is one the dispute's links and offer types allow.`,
    `- **Refiled after a rejection:** ${m.firstFilingAccepted.n - m.firstFilingAccepted.k} of ${m.firstFilingAccepted.n} briefs. ${m.rejections.length ? `Rejections: ${m.rejections.map((r0) => `\`${r0.id}\` ${r0.kind} (${cell(r0.detail)})`).join("; ")}.` : "No rejections."}`,
    `- **Decision and action agree:** ${frac(m.actionMatchesDecision)}. A \`FIGHT\` files evidence or supporting info, a \`REFUND\` accepts or refunds, an \`OFFER\` makes an offer, and a \`MESSAGE_BUYER\` sends a message.`,
    `- **Nothing executed:** ${m.acted.length ? `**${m.acted.length} runs executed a PayPal action**` : "no run executed a PayPal action"} (Autopilot was off).`,
    `- **Every run used the live CLI:** ${m.wrongProvider.length ? `**no: ${m.wrongProvider.map((c) => `${c.id} ran on ${c.provider}`).join(", ")}**` : "yes. No run fell back to a recorded replay; the harness writes no scenario metadata, so a CLI failure is an error, never a replay."}`,
    "",
    "## Time and tokens",
    "",
    `- **Time:** median ${num(m.minutes.median)} min, mean ${num(m.minutes.mean)} min per case, from start to a validated brief. The whole set took ${num(meta.wall_minutes_total)} min at concurrency ${meta.concurrency}.`,
    `- **Tokens per case, measured from the CLI's API stream** (one count per model call, ${m.tokens.cases} cases): median ${k(m.tokens.input.median)} input (including cache reads) over a median of ${num(m.tokens.apiCalls.median, 0)} model calls, and median ${k(m.tokens.output.median)} output. Totals: ${k(m.tokens.input.total)} input, of which ${k(m.tokens.cacheRead)} were cache reads, and at least ${k(m.tokens.output.total)} output.`,
    ...(m.tokens.output.complete < m.tokens.cases
      ? [`- **Output counts:** the output median covers the ${m.tokens.output.complete} runs whose final output count arrived. On ${m.tokens.cases - m.tokens.output.complete} runs, Exhibit's provider closed the stream as soon as the brief was accepted, before the API sent its final count for that call, so their output is a lower bound (marked ≥ below). Input counts are complete for every run.`]
      : []),
    `- **Exhibit's own count:** for comparison, the provider's \`done\` event reported ${k(m.tokens.reportedInput)} input and ${k(m.tokens.reportedOutput)} output in total for the same runs.`,
    ...(m.planWindow
      ? [`- **Plan usage:** across the runs, the CLI reported the Claude plan's 5-hour window at ${pct(100 * m.planWindow.min)} to ${pct(100 * m.planWindow.max)} used. That includes any other use of the same plan at the time, such as the session that started the harness.`]
      : []),
    "",
    "## By reason and stage",
    "",
    "| Reason | Exact agreement |",
    "| --- | --- |",
    ...[...m.byReason.entries()].map(([key, v]) => `| ${REASON[key] ?? key} | ${frac(v)} |`),
    "",
    "| Stage | Exact agreement |",
    "| --- | --- |",
    ...[...m.byStage.entries()].map(([key, v]) => `| ${STAGE[key] ?? key} | ${frac(v)} |`),
    "",
    "## All cases",
    "",
    "| Case | Situation | Label | Exhibit | Match | Likelihood | PayPal action | Exhibits | Refiles | Minutes | Tokens in / out |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...r.cases.map((c) => {
      const t = c.tokens.measured;
      const decided = c.decision ? `\`${c.decision}\`` : c.outcome === "not_run" ? "not run" : `no brief (${c.infra ?? "agent"})`;
      return `| \`${c.id}\` | ${cell(c.title)} | \`${c.expected}\` | ${decided} | ${c.decision === c.expected ? "yes" : "**no**"} | ${c.win_likelihood ?? ""}${c.win_likelihood !== null ? "%" : ""} | ${cell(actionLabel(c.action))} | ${c.exhibits ?? ""} | ${c.guardrails.rejections.length} | ${num(c.minutes)} | ${t ? `${k(t.input + t.cache_read + t.cache_creation)} / ${outputComplete(c) ? "" : "≥"}${k(t.output)}` : ""} |`;
    }),
    "",
    "## Label changes",
    "",
    ...(x.labelChanges.length ? x.labelChanges.map((l) => `- \`${l.id}\`: \`${l.from}\` → \`${l.to}\`. ${l.reason}`) : ["None. Every label is as written before the run."]),
    "",
    "## Findings outside the score",
    "",
    ...(x.notes.length ? x.notes.map((n) => `- ${n}`) : ["None recorded."]),
    "",
    "## Limitations",
    "",
    `- **Small n.** With ${m.n} cases, one case moves exact agreement by ${num(m.n ? 100 / m.n : null)} points, and its 95% interval is ${ci(m.exact)}. Several cells of the confusion matrix hold one or two cases.`,
    "- **Synthetic cases, written by the builder.** The cases cover situations the builder thought of, in one merchant's catalogue and policies (Kora Atelier). Exhibit's prompt and playbook come from the same team (the founder, working with Claude), so agreement partly measures whether the agent applies its own playbook. Real disputes are messier: missing tracking, contradictory records, buyers who say little.",
    "- **The labeller is the same model family as the agent.** Claude wrote the labels and Claude is the agent, so shared blind spots would inflate agreement. No independent human reviewed the labels before the run.",
    "- **Labels are decisions, not outcomes.** \"Correct\" means the decision the labelling rules call for, not what PayPal would rule. Win likelihoods are the agent's estimates and are not scored.",
    "- **One model, one run per case.** The agent uses adaptive thinking, and a rerun can flip a close call. Run-to-run variance is not measured.",
    "- **Close calls by design.** At the inquiry stage, `OFFER`, `MESSAGE_BUYER` and `REFUND` can sit close together, and the labelling rules pick one. The fight vs. don't-fight figure is the more robust number.",
    "- **Simulator limits.** The simulator always reports PayPal's Seller Protection flag as eligible, and offers and messages are never sent to a real buyer.",
    "",
    "## Reproduce",
    "",
    "```bash",
    "npm install",
    "node eval/run.ts --check   # free: seeds the cases into /tmp and runs every lookup tool on them, no model calls",
    "node eval/run.ts           # live: one agent run per case on your Claude CLI login; rewrites eval/results.json and eval/RESULTS.md",
    "```",
    "",
    "Needs Node 24+ and a signed-in Claude CLI (`claude`). Each run spends your Claude plan, roughly 30 to 60 seconds per case. The harness stops at the first rate limit and reports the real n.",
    "",
  );
  return out.join("\n");
}

/** Rebuilds eval/RESULTS.md from eval/results.json and eval/readings.ts. */
export function rebuildReport() {
  const results = JSON.parse(fs.readFileSync(new URL("./results.json", import.meta.url), "utf8")) as EvalResults;
  fs.writeFileSync(new URL("./RESULTS.md", import.meta.url), renderMarkdown(results));
  const m = metrics(results);
  return `RESULTS.md rebuilt: n=${m.n}, exact ${frac(m.exact)}, fight/don't ${frac(m.fightAgreement)}, ${m.disagreements.length} disagreements, ${m.disagreements.filter((c) => !READINGS[c.id]).length} without a reading`;
}
