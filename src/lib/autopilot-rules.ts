// Pure autopilot rules, shared by the server (to act) and the Autopilot page (to preview and simulate).
import type { CaseBrief } from "./agent/brief";

export type AutopilotSettings = {
  enabled: boolean;
  fight: { enabled: boolean; minLikelihood: number; maxAmount: number };
  refund: { enabled: boolean; maxAmount: number };
  offers: { enabled: boolean; maxAmount: number };
  messages: { enabled: boolean };
};

export const DEFAULT_AUTOPILOT: AutopilotSettings = {
  enabled: false,
  fight: { enabled: true, minLikelihood: 85, maxAmount: 300 },
  refund: { enabled: true, maxAmount: 75 },
  offers: { enabled: false, maxAmount: 60 },
  messages: { enabled: true },
};

/**
 * Hard limits no saved rule can cross. A rule can be stricter, never looser: evidence is never
 * auto-filed below 60% likelihood, and nothing above $1,000 is ever automatic.
 */
export const AUTOPILOT_LIMITS = { minLikelihood: { min: 60, max: 100 }, maxAmount: { min: 0, max: 1000 } } as const;

const clamp = (v: unknown, lo: number, hi: number, fallback: number) => {
  const n = typeof v === "number" && Number.isFinite(v) ? v : fallback;
  return Math.round(Math.min(hi, Math.max(lo, n)));
};

/** Coerces anything (a saved row, a request body) into settings inside the hard limits. */
export function clampAutopilot(input: Partial<AutopilotSettings> | null | undefined): AutopilotSettings {
  const s = input ?? {};
  const d = DEFAULT_AUTOPILOT;
  const L = AUTOPILOT_LIMITS;
  return {
    enabled: typeof s.enabled === "boolean" ? s.enabled : d.enabled,
    fight: {
      enabled: typeof s.fight?.enabled === "boolean" ? s.fight.enabled : d.fight.enabled,
      minLikelihood: clamp(s.fight?.minLikelihood, L.minLikelihood.min, L.minLikelihood.max, d.fight.minLikelihood),
      maxAmount: clamp(s.fight?.maxAmount, L.maxAmount.min, L.maxAmount.max, d.fight.maxAmount),
    },
    refund: { enabled: typeof s.refund?.enabled === "boolean" ? s.refund.enabled : d.refund.enabled, maxAmount: clamp(s.refund?.maxAmount, L.maxAmount.min, L.maxAmount.max, d.refund.maxAmount) },
    offers: { enabled: typeof s.offers?.enabled === "boolean" ? s.offers.enabled : d.offers.enabled, maxAmount: clamp(s.offers?.maxAmount, L.maxAmount.min, L.maxAmount.max, d.offers.maxAmount) },
    messages: { enabled: typeof s.messages?.enabled === "boolean" ? s.messages.enabled : d.messages.enabled },
  };
}

export type AutopilotVerdict = { verdict: "AUTO" | "REVIEW"; rule: string; reason: string };

/** The parts of a brief the rules read. */
export type RuleInput = { decision: CaseBrief["decision"]; confidence: CaseBrief["confidence"]; win_likelihood: number; offerAmount?: number };

/** Decides whether Exhibit may act on its own. Anything outside an explicit rule goes to a human. */
export function evaluateRules(b: RuleInput, amount: number, s: AutopilotSettings): AutopilotVerdict {
  const money = `$${amount.toFixed(2)}`;
  if (!s.enabled) return { verdict: "REVIEW", rule: "off", reason: "Autopilot is off: every response waits for your approval." };
  if (b.confidence === "LOW") return { verdict: "REVIEW", rule: "confidence", reason: "Low-confidence briefs always go to a person." };
  if (amount > AUTOPILOT_LIMITS.maxAmount.max) return { verdict: "REVIEW", rule: "limit", reason: `${money} is above the $${AUTOPILOT_LIMITS.maxAmount.max.toLocaleString("en-US")} ceiling: always yours to decide.` };
  switch (b.decision) {
    case "FIGHT":
      if (!s.fight.enabled) return { verdict: "REVIEW", rule: "fight", reason: "Auto-filing evidence is disabled." };
      if (b.win_likelihood < Math.max(s.fight.minLikelihood, AUTOPILOT_LIMITS.minLikelihood.min)) return { verdict: "REVIEW", rule: "fight", reason: `Win likelihood ${b.win_likelihood}% is under your ${s.fight.minLikelihood}% threshold.` };
      if (amount > s.fight.maxAmount) return { verdict: "REVIEW", rule: "fight", reason: `${money} is above your $${s.fight.maxAmount} auto-file limit.` };
      return { verdict: "AUTO", rule: "fight", reason: `Strong case (${b.win_likelihood}%) under $${s.fight.maxAmount}: evidence is filed automatically.` };
    case "REFUND":
      if (!s.refund.enabled) return { verdict: "REVIEW", rule: "refund", reason: "Auto-refunds are disabled." };
      if (amount > s.refund.maxAmount) return { verdict: "REVIEW", rule: "refund", reason: `${money} is above your $${s.refund.maxAmount} auto-refund limit.` };
      return { verdict: "AUTO", rule: "refund", reason: `The buyer is right and it's under $${s.refund.maxAmount}: refunded automatically, no fee to fight it.` };
    case "OFFER":
      if (!s.offers.enabled) return { verdict: "REVIEW", rule: "offers", reason: "Offers always need your approval." };
      if ((b.offerAmount ?? 0) > s.offers.maxAmount) return { verdict: "REVIEW", rule: "offers", reason: `Offer above your $${s.offers.maxAmount} limit.` };
      return { verdict: "AUTO", rule: "offers", reason: "Offer within your limit is sent automatically." };
    case "MESSAGE_BUYER":
      if (!s.messages.enabled) return { verdict: "REVIEW", rule: "messages", reason: "Buyer messages need your approval." };
      return { verdict: "AUTO", rule: "messages", reason: "Inquiry-stage messages are sent automatically." };
  }
}

/** The PayPal actions each decision may carry. */
const ACTIONS_FOR: Record<CaseBrief["decision"], CaseBrief["paypal_action"]["type"][]> = {
  FIGHT: ["provide_evidence", "provide_supporting_info"],
  REFUND: ["accept_claim", "refund_then_prove"],
  OFFER: ["make_offer"],
  MESSAGE_BUYER: ["send_message"],
};

/** Decides whether Exhibit may act on its own on a filed brief. */
export function evaluateAutopilot(brief: CaseBrief, amount: number, s: AutopilotSettings): AutopilotVerdict {
  const verdict = evaluateRules({ decision: brief.decision, confidence: brief.confidence, win_likelihood: brief.win_likelihood, offerAmount: brief.paypal_action.amount }, amount, s);
  // Exhibit runs brief.paypal_action, but the rules judged brief.decision. When they disagree (a "message" that
  // refunds, a "fight" that accepts the claim) the limits that were checked are not the ones that apply.
  if (verdict.verdict === "AUTO" && !ACTIONS_FOR[brief.decision].includes(brief.paypal_action.type)) {
    return { verdict: "REVIEW", rule: "consistency", reason: `The brief says ${brief.decision.toLowerCase().replace(/_/g, " ")} but its PayPal action is ${brief.paypal_action.type.replace(/_/g, " ")}: a person decides.` };
  }
  return verdict;
}

// ---- Simulation over past cases ------------------------------------------------------------------

/** A resolved case with the brief Exhibit filed on it and how PayPal settled it. */
export type SimCase = {
  id: string;
  reason: string;
  amount: number;
  decision: CaseBrief["decision"];
  likelihood: number;
  confidence: CaseBrief["confidence"];
  offer?: number;
  recovered: number;
  refunded: number;
  lost: number;
  closedAt: string;
};

export type SimResult = {
  total: number;
  auto: number;
  review: number;
  /** Money kept on the cases Exhibit would have handled alone. */
  recovered: number;
  /** Money returned to buyers by automatic refunds and offers (honest refunds, by design). */
  refunded: number;
  /** Fights the rules would have filed automatically that PayPal then decided for the buyer. */
  lostCount: number;
  lost: number;
  byRule: Record<"fight" | "refund" | "offers" | "messages", { auto: number; review: number }>;
  verdicts: Record<string, AutopilotVerdict["verdict"]>;
};

/** Replays the rules over past cases: what Exhibit would have done alone, and what it would have asked you. */
export function simulateAutopilot(cases: SimCase[], s: AutopilotSettings): SimResult {
  const on = { ...s, enabled: true };
  const res: SimResult = { total: cases.length, auto: 0, review: 0, recovered: 0, refunded: 0, lostCount: 0, lost: 0, byRule: { fight: { auto: 0, review: 0 }, refund: { auto: 0, review: 0 }, offers: { auto: 0, review: 0 }, messages: { auto: 0, review: 0 } }, verdicts: {} };
  const ruleOf = { FIGHT: "fight", REFUND: "refund", OFFER: "offers", MESSAGE_BUYER: "messages" } as const;
  for (const c of cases) {
    const v = evaluateRules({ decision: c.decision, confidence: c.confidence, win_likelihood: c.likelihood, offerAmount: c.offer }, c.amount, on);
    res.verdicts[c.id] = v.verdict;
    const bucket = res.byRule[ruleOf[c.decision]];
    if (v.verdict === "AUTO") {
      res.auto++;
      bucket.auto++;
      res.recovered += c.recovered;
      res.refunded += c.refunded;
      if (c.lost > 0) {
        res.lostCount++;
        res.lost += c.lost;
      }
    } else {
      res.review++;
      bucket.review++;
    }
  }
  return res;
}
