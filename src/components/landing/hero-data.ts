import heroRuns from "./records/hero-runs.json";

// The three recorded agent runs the site shows (two on the PayPal sandbox, exported by records/export.mjs).
// Nothing here is written by hand.

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
