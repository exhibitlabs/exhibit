import "server-only";
import { kvGet, kvSet } from "./db";
import type { CaseBrief } from "./agent/brief";
import type { Dispute } from "./paypal/types";
import { AUTOPILOT_LIMITS, clampAutopilot, DEFAULT_AUTOPILOT, evaluateAutopilot as evaluateRules, type AutopilotSettings, type AutopilotVerdict, type SimCase } from "./autopilot-rules";
import { resolvedHistory } from "./store/history";

export { AUTOPILOT_LIMITS, DEFAULT_AUTOPILOT, type AutopilotSettings, type AutopilotVerdict };

export function getAutopilot(): AutopilotSettings {
  return clampAutopilot(kvGet<Partial<AutopilotSettings>>("autopilot", {}));
}

/** Saves rules, always inside AUTOPILOT_LIMITS. Returns what was stored. */
export function setAutopilot(s: Partial<AutopilotSettings>) {
  const clean = clampAutopilot(s);
  kvSet("autopilot", clean);
  return clean;
}

/** Decides whether Exhibit may act on its own. Anything outside an explicit rule goes to a human. */
export function evaluateAutopilot(brief: CaseBrief, d: Dispute, s = getAutopilot()): AutopilotVerdict {
  return evaluateRules(brief, Number(d.dispute_amount.value), s);
}

/** The demo merchant's resolved cases from the last 90 days, with the brief Exhibit filed on each, for the rules simulation. */
export function simulationCases(days = 90): SimCase[] {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  return resolvedHistory()
    .filter((c) => c.closed_at >= since && c.decision && c.likelihood !== undefined)
    .map((c) => ({
      id: c.dispute_id,
      reason: c.reason,
      amount: c.amount,
      decision: c.decision!,
      likelihood: c.likelihood!,
      confidence: c.confidence ?? "MEDIUM",
      offer: c.offer,
      recovered: c.recovered,
      refunded: c.refunded,
      lost: c.lost,
      closedAt: c.closed_at,
    }));
}
