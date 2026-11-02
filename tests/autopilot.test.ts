// Guarantee: Autopilot never acts outside the merchant's explicit limits (nor the hard limits no
// setting can raise), and a low-confidence brief always goes to a person. Anything not covered by an
// explicit rule is a REVIEW.
import { beforeEach, describe, expect, it } from "vitest";
import { GET as getSettings, PUT as putSettings } from "@/app/api/autopilot/route";
import type { ActionType, CaseBrief } from "@/lib/agent/brief";
import { getAutopilot, evaluateAutopilot as evaluateForDispute, setAutopilot } from "@/lib/autopilot";
import { AUTOPILOT_LIMITS, clampAutopilot, DEFAULT_AUTOPILOT, evaluateAutopilot, type AutopilotSettings } from "@/lib/autopilot-rules";
import { kvSet } from "@/lib/db";
import { makeDispute, resetState } from "./support/fixtures";

type Decision = CaseBrief["decision"];
const DECISIONS: Decision[] = ["FIGHT", "REFUND", "OFFER", "MESSAGE_BUYER"];
const ACTION_FOR: Record<Decision, CaseBrief["paypal_action"]> = {
  FIGHT: { type: "provide_evidence" },
  REFUND: { type: "accept_claim" },
  OFFER: { type: "make_offer", offer_type: "REFUND", amount: 20 },
  MESSAGE_BUYER: { type: "send_message" },
};

/** Only the fields Autopilot reads matter here; the rest is filler. */
const brief = (over: Partial<CaseBrief> = {}): CaseBrief => {
  const decision = over.decision ?? "FIGHT";
  return { decision, headline: "h", summary: "s", win_likelihood: 90, confidence: "HIGH", reasoning: [], risks: [], missing_evidence: [], exhibits: [], paypal_action: ACTION_FOR[decision], response_letter: "letter", buyer_message: null, ...over };
};

const ON: AutopilotSettings = {
  enabled: true,
  fight: { enabled: true, minLikelihood: 85, maxAmount: 300 },
  refund: { enabled: true, maxAmount: 75 },
  offers: { enabled: true, maxAmount: 60 },
  messages: { enabled: true },
};
/** As permissive as a merchant is allowed to be. */
const WIDE_OPEN: AutopilotSettings = {
  enabled: true,
  fight: { enabled: true, minLikelihood: AUTOPILOT_LIMITS.minLikelihood.min, maxAmount: AUTOPILOT_LIMITS.maxAmount.max },
  refund: { enabled: true, maxAmount: AUTOPILOT_LIMITS.maxAmount.max },
  offers: { enabled: true, maxAmount: AUTOPILOT_LIMITS.maxAmount.max },
  messages: { enabled: true },
};
const verdict = (b: CaseBrief, amount: number, s = ON) => evaluateAutopilot(b, amount, s);

describe("off by default", () => {
  it("ships switched off, with offers off even once it is on", () => {
    expect(DEFAULT_AUTOPILOT.enabled).toBe(false);
    expect(DEFAULT_AUTOPILOT.offers.enabled).toBe(false);
  });

  it("sends every brief to the merchant while it is off, however strong the case", () => {
    for (const settings of [DEFAULT_AUTOPILOT, { ...ON, enabled: false }, { ...WIDE_OPEN, enabled: false }]) {
      for (const decision of DECISIONS) {
        expect(verdict(brief({ decision, win_likelihood: 100 }), 1, settings), decision).toMatchObject({ verdict: "REVIEW", rule: "off" });
      }
    }
  });
});

describe("low confidence", () => {
  it("always goes to a person, for every kind of decision, even with every limit lifted", () => {
    for (const decision of DECISIONS) {
      expect(verdict(brief({ decision, confidence: "LOW", win_likelihood: 100 }), 1, WIDE_OPEN), decision).toMatchObject({ verdict: "REVIEW", rule: "confidence" });
    }
  });

  it("is the only thing that stops the same briefs at medium confidence", () => {
    for (const decision of DECISIONS) {
      expect(verdict(brief({ decision, confidence: "MEDIUM", win_likelihood: 100 }), 1, WIDE_OPEN).verdict, decision).toBe("AUTO");
    }
  });
});

describe("filing evidence (FIGHT)", () => {
  it("is automatic only for a strong case under the dollar limit, both limits inclusive", () => {
    expect(verdict(brief({ win_likelihood: 85 }), 300)).toMatchObject({ verdict: "AUTO", rule: "fight" });
    expect(verdict(brief({ win_likelihood: 84 }), 300)).toMatchObject({ verdict: "REVIEW", rule: "fight", reason: expect.stringContaining("85%") });
    expect(verdict(brief({ win_likelihood: 100 }), 300.01)).toMatchObject({ verdict: "REVIEW", rule: "fight", reason: expect.stringContaining("$300") });
  });

  it("can be switched off on its own", () => {
    expect(verdict(brief(), 10, { ...ON, fight: { ...ON.fight, enabled: false } })).toMatchObject({ verdict: "REVIEW", rule: "fight" });
  });
});

describe("refunds (REFUND)", () => {
  it("are automatic only up to the refund limit, inclusive", () => {
    expect(verdict(brief({ decision: "REFUND" }), 75)).toMatchObject({ verdict: "AUTO", rule: "refund" });
    expect(verdict(brief({ decision: "REFUND" }), 75.01)).toMatchObject({ verdict: "REVIEW", rule: "refund" });
  });

  it("do not depend on the win likelihood (an unwinnable case is the reason to refund)", () => {
    expect(verdict(brief({ decision: "REFUND", win_likelihood: 3 }), 40).verdict).toBe("AUTO");
  });

  it("can be switched off on its own", () => {
    expect(verdict(brief({ decision: "REFUND" }), 10, { ...ON, refund: { enabled: false, maxAmount: 75 } })).toMatchObject({ verdict: "REVIEW", rule: "refund" });
  });
});

describe("offers (OFFER)", () => {
  const offer = (amount?: number) => brief({ decision: "OFFER", paypal_action: { type: "make_offer", offer_type: amount === undefined ? "REPLACEMENT_WITHOUT_REFUND" : "REFUND", amount } });

  it("always need approval until the merchant turns them on", () => {
    expect(verdict(offer(10), 150, { ...ON, offers: { enabled: false, maxAmount: 60 } })).toMatchObject({ verdict: "REVIEW", rule: "offers" });
  });

  it("are limited by the amount offered, not by the disputed amount", () => {
    expect(verdict(offer(60), 400).verdict).toBe("AUTO");
    expect(verdict(offer(60.01), 50)).toMatchObject({ verdict: "REVIEW", rule: "offers" });
    expect(verdict(offer(undefined), 400).verdict).toBe("AUTO"); // a replacement moves no money
  });
});

describe("buyer messages (MESSAGE_BUYER)", () => {
  it("go out on their own only when messages are enabled", () => {
    expect(verdict(brief({ decision: "MESSAGE_BUYER" }), 400)).toMatchObject({ verdict: "AUTO", rule: "messages" });
    expect(verdict(brief({ decision: "MESSAGE_BUYER" }), 400, { ...ON, messages: { enabled: false } })).toMatchObject({ verdict: "REVIEW", rule: "messages" });
  });
});

describe("hard limits no setting can raise", () => {
  it("never automate a dispute above the ceiling, whatever the saved rule says", () => {
    const over = AUTOPILOT_LIMITS.maxAmount.max + 0.01;
    const unclamped: AutopilotSettings = { ...WIDE_OPEN, fight: { ...WIDE_OPEN.fight, maxAmount: 1e9 }, refund: { enabled: true, maxAmount: 1e9 }, offers: { enabled: true, maxAmount: 1e9 } };
    for (const decision of DECISIONS) expect(verdict(brief({ decision, win_likelihood: 100 }), over, unclamped), decision).toMatchObject({ verdict: "REVIEW" });
  });

  it("never file evidence below the likelihood floor, whatever the saved rule says", () => {
    const floor = AUTOPILOT_LIMITS.minLikelihood.min;
    const lax: AutopilotSettings = { ...ON, fight: { enabled: true, minLikelihood: 0, maxAmount: 300 } };
    expect(verdict(brief({ win_likelihood: floor - 1 }), 50, lax)).toMatchObject({ verdict: "REVIEW", rule: "fight" });
    expect(verdict(brief({ win_likelihood: floor }), 50, lax).verdict).toBe("AUTO");
  });

  it("are applied to saved settings: out-of-range and malformed values are pulled inside, never trusted", () => {
    const { minLikelihood, maxAmount } = AUTOPILOT_LIMITS;
    const wild = clampAutopilot({
      enabled: true,
      fight: { enabled: true, minLikelihood: -50, maxAmount: 1e9 },
      refund: { enabled: true, maxAmount: Number.POSITIVE_INFINITY },
      offers: { enabled: true, maxAmount: "lots" as unknown as number },
      messages: { enabled: "yes" as unknown as boolean },
    });
    expect(wild.fight).toEqual({ enabled: true, minLikelihood: minLikelihood.min, maxAmount: maxAmount.max });
    expect(wild.refund.maxAmount).toBeLessThanOrEqual(maxAmount.max);
    expect(wild.offers.maxAmount).toBe(DEFAULT_AUTOPILOT.offers.maxAmount); // not a number: back to the default
    expect(wild.messages.enabled).toBe(DEFAULT_AUTOPILOT.messages.enabled);
    expect(clampAutopilot({ enabled: "true" as unknown as boolean }).enabled).toBe(false); // a string never switches it on
    expect(clampAutopilot(null)).toEqual(DEFAULT_AUTOPILOT);
    expect(clampAutopilot({ fight: { enabled: true, minLikelihood: 250, maxAmount: -5 } }).fight).toMatchObject({ minLikelihood: minLikelihood.max, maxAmount: maxAmount.min });
  });
});

describe("the action that will run must be the one the rule judged", () => {
  // Exhibit executes brief.paypal_action, but Autopilot judges brief.decision. If they disagree, the
  // limits for the decision would be applied to a different action (a "message" that refunds).
  const VALID: Record<Decision, ActionType[]> = {
    FIGHT: ["provide_evidence", "provide_supporting_info"],
    REFUND: ["accept_claim", "refund_then_prove"],
    OFFER: ["make_offer"],
    MESSAGE_BUYER: ["send_message"],
  };
  const ACTIONS = Object.values(VALID).flat();

  it("lets only matching decision and action pairs through", () => {
    for (const decision of DECISIONS) {
      for (const type of ACTIONS) {
        const v = verdict(brief({ decision, paypal_action: { type, offer_type: "REFUND", amount: 10 } }), 40, WIDE_OPEN);
        const matches = VALID[decision].includes(type);
        expect(v.verdict, `${decision} + ${type}`).toBe(matches ? "AUTO" : "REVIEW");
        if (!matches) expect(v.rule).toBe("consistency");
      }
    }
  });

  it("stops a buyer message that would refund, which no dollar limit applies to", () => {
    const sneaky = brief({ decision: "MESSAGE_BUYER", paypal_action: { type: "accept_claim" } });
    expect(verdict(sneaky, 500)).toMatchObject({ verdict: "REVIEW", rule: "consistency" });
  });

  it("keeps the more basic reason when Autopilot is off or the brief is low confidence", () => {
    const mismatch = brief({ decision: "MESSAGE_BUYER", paypal_action: { type: "accept_claim" } });
    expect(verdict(mismatch, 50, DEFAULT_AUTOPILOT).rule).toBe("off");
    expect(verdict({ ...mismatch, confidence: "LOW" }, 50).rule).toBe("confidence");
  });
});

describe("never outside the explicit limits", () => {
  it("holds across a sweep of amounts, likelihoods, confidence levels and switches", () => {
    const amounts = [0, 1, 59.99, 60, 60.01, 74.99, 75, 75.01, 299.99, 300, 300.01, 999.99, 1000, 1000.01, 5000];
    let autos = 0;
    for (const decision of DECISIONS) {
      for (const amount of amounts) {
        for (const win_likelihood of [0, 50, 59, 60, 84, 85, 100]) {
          for (const confidence of ["LOW", "MEDIUM", "HIGH"] as const) {
            for (const enabled of [false, true]) {
              const s: AutopilotSettings = { ...ON, enabled };
              const b = brief({ decision, win_likelihood, confidence, paypal_action: decision === "OFFER" ? { type: "make_offer", offer_type: "REFUND", amount } : ACTION_FOR[decision] });
              if (verdict(b, amount, s).verdict !== "AUTO") continue;
              autos++;
              const label = `${decision} $${amount} ${win_likelihood}% ${confidence}`;
              expect(enabled, label).toBe(true);
              expect(confidence, label).not.toBe("LOW");
              expect(amount, label).toBeLessThanOrEqual(AUTOPILOT_LIMITS.maxAmount.max);
              if (decision === "FIGHT") {
                expect(amount, label).toBeLessThanOrEqual(s.fight.maxAmount);
                expect(win_likelihood, label).toBeGreaterThanOrEqual(Math.max(s.fight.minLikelihood, AUTOPILOT_LIMITS.minLikelihood.min));
              }
              if (decision === "REFUND") expect(amount, label).toBeLessThanOrEqual(s.refund.maxAmount);
              if (decision === "OFFER") expect(amount, label).toBeLessThanOrEqual(s.offers.maxAmount);
            }
          }
        }
      }
    }
    expect(autos).toBeGreaterThan(50); // the sweep must actually reach the automatic cases
  });
});

describe("saved settings", () => {
  beforeEach(resetState);

  it("start from the defaults", () => {
    expect(getAutopilot()).toEqual(DEFAULT_AUTOPILOT);
  });

  it("keep the default limits for anything the stored settings leave out", () => {
    kvSet("autopilot", { enabled: true, fight: { enabled: true } });
    expect(getAutopilot()).toEqual({ ...DEFAULT_AUTOPILOT, enabled: true });
  });

  it("round-trip what the merchant saved", () => {
    setAutopilot(ON);
    expect(getAutopilot()).toEqual(ON);
  });

  it("cannot be talked out of the hard limits through the store either", () => {
    kvSet("autopilot", { enabled: true, fight: { enabled: true, minLikelihood: 0, maxAmount: 1e9 }, refund: { enabled: true, maxAmount: 1e9 } });
    const s = getAutopilot();
    expect(s.fight.minLikelihood).toBeGreaterThanOrEqual(AUTOPILOT_LIMITS.minLikelihood.min);
    expect(s.fight.maxAmount).toBeLessThanOrEqual(AUTOPILOT_LIMITS.maxAmount.max);
    expect(s.refund.maxAmount).toBeLessThanOrEqual(AUTOPILOT_LIMITS.maxAmount.max);
  });

  it("judge a dispute by its own amount", () => {
    setAutopilot(ON);
    const small = makeDispute({ dispute_amount: { currency_code: "USD", value: "74.50" } });
    const large = makeDispute({ dispute_amount: { currency_code: "USD", value: "75.50" } });
    const refund = brief({ decision: "REFUND" });
    expect(evaluateForDispute(refund, small).verdict).toBe("AUTO");
    expect(evaluateForDispute(refund, large).verdict).toBe("REVIEW");
  });
});

describe("the settings endpoint", () => {
  beforeEach(resetState);
  const put = (body: unknown) => putSettings(new Request("http://localhost/api/autopilot", { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) }));

  it("clamps what a request tries to save, and what it saved is what Autopilot will use", async () => {
    const res = await put({ enabled: true, fight: { enabled: true, minLikelihood: 0, maxAmount: 1e9 }, refund: { enabled: true, maxAmount: 99_999 } });
    const saved = await res.json();
    expect(res.status).toBe(200);
    expect(saved.fight).toMatchObject({ minLikelihood: AUTOPILOT_LIMITS.minLikelihood.min, maxAmount: AUTOPILOT_LIMITS.maxAmount.max });
    expect(saved.refund.maxAmount).toBe(AUTOPILOT_LIMITS.maxAmount.max);
    expect(await (await getSettings()).json()).toEqual(saved);
    expect(getAutopilot()).toEqual(saved);
  });

  it("refuses a body that is not JSON, and keeps the settings it had", async () => {
    setAutopilot(ON);
    expect((await put("not json")).status).toBe(400);
    expect((await put("null")).status).toBe(400);
    expect(getAutopilot()).toEqual(ON);
  });
});
