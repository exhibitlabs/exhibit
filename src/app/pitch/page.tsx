import type { Metadata } from "next";
import { EVALUATION, FOUNDERS, GITHUB_URL, PAYPAL_AGENT_TOOLS, PAYPAL_FEES, PAYPAL_MCP_QUOTE, PRICING, TEAM } from "@/components/landing/data";
import { HERO_CASES, PREVENTION_REPLY, RUNS, type RunRecord } from "@/components/landing/hero-data";
import { sentences, utcDate, utcDateTime } from "@/components/landing/Primitives";
import { describe, disputeActions, failedWrites, NOT_LIVE, PROOF, reasonLabel, shortPath } from "@/components/landing/proof-data";
import demo from "@/components/landing/records/demo-briefs.json";
import prevention from "@/components/landing/records/prevention.json";
import { Deck, type DeckData, type DeckFiling } from "@/components/pitch/Deck";
import evalResults from "../../../eval/results.json";

export const metadata: Metadata = {
  title: "Pitch",
  description: "Exhibit, the dispute agent for PayPal merchants, as a short deck. Arrow keys to move.",
};

const MODEL_NAME: Record<string, string> = { "claude-opus-5-5": "Claude Opus 5.5" };

type Write = (typeof PROOF.writes)[number];

const filing = (w: Write): DeckFiling => ({ label: describe(w).label, path: shortPath(w.path), disputeId: w.disputeId, status: w.status, ms: w.ms, debugId: w.debugId, at: utcDateTime(w.at) });

/** Greeting, first sentence and the line about the money from the agent's note to the buyer, as on the landing page. */
function noteLines(text: string) {
  const paras = text
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  const all = sentences(paras.slice(1, 3).join(" "));
  const money = all.find((s) => /coming back|refund/i.test(s) && s !== all[0]);
  return [paras[0], all[0], money].filter((s): s is string => !!s);
}

function refund(run: RunRecord): DeckData["refunds"][number] {
  const call = PROOF.writes.find((w) => w.disputeId === run.disputeId && w.path.endsWith("/accept-claim"));
  return {
    buyer: run.claim.buyer ?? "Buyer",
    reason: reasonLabel(run.claim.reason ?? ""),
    amount: run.claim.amount,
    ifFought: run.brief.winLikelihood,
    headline: run.brief.headline,
    note: run.brief.buyerMessage ? noteLines(run.brief.buyerMessage.text) : [],
    call: call ? filing(call) : null,
  };
}

type EvalCase = { reason: string; expected: string; decision: string | null; minutes: number | null; guardrails: { final_valid?: boolean; revalidation_problems?: unknown[] } | null };

/** The evaluation's headline, counted from eval/results.json the way eval/RESULTS.md counts it. */
function evalRun(): DeckData["evalRun"] {
  const run = evalResults as unknown as { meta: { started_at: string; model_requested: string }; cases: EvalCase[] };
  const cases = run.cases ?? [];
  if (!cases.length) return null;
  const refund = cases.filter((c) => c.expected === "REFUND");
  const notFight = cases.filter((c) => c.expected !== "FIGHT");
  const minutes = cases
    .map((c) => c.minutes)
    .filter((m): m is number => m != null)
    .sort((a, b) => a - b);
  const mid = Math.floor(minutes.length / 2);
  const median = minutes.length % 2 ? minutes[mid] : (minutes[mid - 1] + minutes[mid]) / 2;
  return {
    n: cases.length,
    exact: cases.filter((c) => c.decision === c.expected).length,
    refundTotal: refund.length,
    refundedNotFought: refund.filter((c) => c.decision && c.decision !== "FIGHT").length,
    notFightTotal: notFight.length,
    falseFights: notFight.filter((c) => c.decision === "FIGHT").length,
    guardrailsPassed: cases.filter((c) => c.guardrails?.final_valid && !c.guardrails.revalidation_problems?.length).length,
    medianSeconds: Math.round(median * 60),
    reasons: new Set(cases.map((c) => c.reason)).size,
    model: MODEL_NAME[run.meta.model_requested] ?? run.meta.model_requested,
    date: utcDate(run.meta.started_at),
  };
}

const ORDER = ["FIGHT", "OFFER", "MESSAGE_BUYER", "REFUND"] as const;
const DECISION_LABEL: Record<(typeof ORDER)[number], string> = { FIGHT: "Fight", OFFER: "Offer", MESSAGE_BUYER: "Message", REFUND: "Refund" };

export default function PitchPage() {
  const fight = RUNS.fight;
  const radar = prevention.radar;
  const save = prevention.save;
  const data: DeckData = {
    githubUrl: GITHUB_URL,
    fees: PAYPAL_FEES,
    agentTools: PAYPAL_AGENT_TOOLS,
    mcpQuote: PAYPAL_MCP_QUOTE,
    pricing: PRICING,
    founders: FOUNDERS,
    team: TEAM,
    evaluation: EVALUATION,
    evalRun: EVALUATION ? evalRun() : null,
    cases: HERO_CASES,
    fight: {
      disputeId: fight.disputeId,
      buyer: fight.claim.buyer ?? "",
      amount: fight.claim.amount,
      model: MODEL_NAME[fight.model] ?? fight.model,
      seconds: (fight.durationMs / 1000).toFixed(1),
      toolCalls: fight.steps.length + 1,
      exhibits: fight.brief.exhibits.length,
      date: utcDate(fight.startedAt),
    },
    proof: {
      host: PROOF.host,
      totals: PROOF.totals,
      from: utcDate(PROOF.firstCall!),
      to: utcDate(PROOF.lastCall!),
      filings: disputeActions.map(filing),
      failed: failedWrites.map((f) => f.status),
      notLive: NOT_LIVE,
    },
    refunds: [refund(RUNS.refund), refund(RUNS.refund2)],
    decisions: ORDER.map((d) => ({ label: DECISION_LABEL[d], n: demo.cases.filter((c) => c.decision === d).length })),
    prevention: {
      capturedAt: utcDate(radar.capturedAt),
      totals: radar.totals,
      signals: radar.bySignal.map((s) => ({ label: s.label, reason: s.reason })),
      save: { orderId: save.orderId, buyer: save.buyer, before: save.fix.before.score, after: save.fix.after.score, saved: save.fix.saved, at: utcDate(save.fix.at) },
      reply: PREVENTION_REPLY,
    },
  };
  return <Deck data={data} />;
}
