// Guarantee: a brief can only ask for a PayPal action the dispute's HATEOAS links offer right now,
// with offer types and amounts inside what PayPal allows. Anything else is bounced to the model.
import { beforeEach, describe, expect, it } from "vitest";
import { ACTION_TYPES, CaseBriefSchema, type ActionType, type CaseBrief } from "@/lib/agent/brief";
import { executeTool, validateBrief } from "@/lib/agent/tools";
import type { DisputeStage, DisputeStatus } from "@/lib/paypal/types";
import { caseFileOf, installCase, makeBrief, makeBriefFor, resetState, toolContext, type CaseKit } from "./support/fixtures";

beforeEach(resetState);

// PayPal's lifecycle, written out by hand (not derived from the code under test).
const STATES: { status: DisputeStatus; stage: DisputeStage; allowed: ActionType[] }[] = [
  { status: "WAITING_FOR_SELLER_RESPONSE", stage: "CHARGEBACK", allowed: ["provide_evidence", "refund_then_prove", "accept_claim"] },
  { status: "WAITING_FOR_SELLER_RESPONSE", stage: "INQUIRY", allowed: ["provide_evidence", "refund_then_prove", "accept_claim", "make_offer", "send_message"] },
  { status: "UNDER_REVIEW", stage: "CHARGEBACK", allowed: ["provide_supporting_info"] },
  { status: "UNDER_REVIEW", stage: "INQUIRY", allowed: [] },
  { status: "WAITING_FOR_BUYER_RESPONSE", stage: "INQUIRY", allowed: ["send_message"] },
  { status: "WAITING_FOR_BUYER_RESPONSE", stage: "CHARGEBACK", allowed: [] },
  { status: "RESOLVED", stage: "CHARGEBACK", allowed: [] },
];

describe("validateBrief: the PayPal action must be one the dispute allows right now", () => {
  it.each(STATES)("$status / $stage", ({ status, stage, allowed }) => {
    const kit = installCase({ dispute: { status, dispute_life_cycle_stage: stage } });
    const cf = caseFileOf(kit);
    for (const type of ACTION_TYPES) {
      const problems = validateBrief(makeBriefFor(kit, type), cf);
      if (allowed.includes(type)) expect(problems, `${type} should be allowed`).toEqual([]);
      else {
        expect(problems, `${type} should be rejected`).toHaveLength(1);
        expect(problems[0]).toMatch(new RegExp(`^${type} needs PayPal's "\\w+" link, which this dispute does not offer`));
      }
    }
  });

  it("tells the model which actions are open, so it can pick another", () => {
    const kit = installCase({ dispute: { status: "UNDER_REVIEW", dispute_life_cycle_stage: "CHARGEBACK" } });
    const [problem] = validateBrief(makeBriefFor(kit, "accept_claim"), caseFileOf(kit));
    expect(problem).toContain("provide_supporting_info");
  });

  it("rejects an action PayPal has withdrawn, even when the brief was valid when written", () => {
    const kit = installCase();
    const brief = makeBriefFor(kit, "provide_evidence");
    expect(validateBrief(brief, caseFileOf(kit))).toEqual([]);
    const after = installCase({ dispute: { status: "UNDER_REVIEW", dispute_life_cycle_stage: "CHARGEBACK" } }); // PayPal moved the case on
    expect(validateBrief(brief, caseFileOf(after))).toEqual([expect.stringContaining('"provide_evidence" link')]);
  });

  it("requires the evidence types for provide_evidence", () => {
    const kit = installCase();
    const brief = makeBriefFor(kit, "provide_evidence");
    brief.paypal_action = { type: "provide_evidence", evidence_types: [] };
    expect(validateBrief(brief, caseFileOf(kit))).toContain("provide_evidence needs evidence_types");
  });
});

describe("validateBrief: offers", () => {
  const inquiry = () =>
    installCase({
      dispute: {
        reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
        dispute_life_cycle_stage: "INQUIRY",
        allowed_response_options: { make_offer: { offer_types: ["REFUND", "REPLACEMENT_WITHOUT_REFUND"] } },
      },
    });
  const offer = (kit: CaseKit, action: CaseBrief["paypal_action"], message = true): CaseBrief => ({
    ...makeBriefFor(kit, "make_offer"),
    paypal_action: action,
    buyer_message: message ? { language: "en", text: "We would like to make this right." } : null,
  });

  it("accepts an allowed offer type with an amount up to the disputed amount, inclusive", () => {
    const kit = inquiry();
    const cf = caseFileOf(kit);
    expect(validateBrief(offer(kit, { type: "make_offer", offer_type: "REFUND", amount: 40 }), cf)).toEqual([]);
    expect(validateBrief(offer(kit, { type: "make_offer", offer_type: "REFUND", amount: 142 }), cf)).toEqual([]);
  });

  it("rejects an offer type this dispute does not allow, and lists the ones it does", () => {
    const kit = inquiry();
    const problems = validateBrief(offer(kit, { type: "make_offer", offer_type: "REFUND_WITH_RETURN", amount: 40 }), caseFileOf(kit));
    expect(problems).toEqual(["offer_type must be one of REFUND, REPLACEMENT_WITHOUT_REFUND"]);
  });

  it("rejects an offer with no type, and a refund offer with no amount", () => {
    const kit = inquiry();
    const cf = caseFileOf(kit);
    expect(validateBrief(offer(kit, { type: "make_offer", amount: 40 }), cf)).toContain("make_offer needs offer_type");
    expect(validateBrief(offer(kit, { type: "make_offer", offer_type: "REFUND" }), cf)).toContain("make_offer needs amount");
  });

  it("does not ask for an amount on a replacement that refunds nothing", () => {
    const kit = inquiry();
    expect(validateBrief(offer(kit, { type: "make_offer", offer_type: "REPLACEMENT_WITHOUT_REFUND" }), caseFileOf(kit))).toEqual([]);
  });

  it("rejects an amount above the disputed amount, for offers and refunds alike", () => {
    const kit = inquiry();
    const cf = caseFileOf(kit);
    expect(validateBrief(offer(kit, { type: "make_offer", offer_type: "REFUND", amount: 142.01 }), cf)).toEqual(["amount 142.01 exceeds the disputed amount 142"]);
    const refund = { ...makeBriefFor(kit, "refund_then_prove"), paypal_action: { type: "refund_then_prove" as const, amount: 500 } };
    expect(validateBrief(refund, cf)).toEqual(["amount 500 exceeds the disputed amount 142"]);
  });

  it("needs a message to the buyer for an offer or a message action", () => {
    const kit = inquiry();
    const cf = caseFileOf(kit);
    expect(validateBrief(offer(kit, { type: "make_offer", offer_type: "REFUND", amount: 40 }, false), cf)).toEqual(["make_offer needs buyer_message"]);
    const msg = { ...makeBriefFor(kit, "send_message"), buyer_message: null };
    expect(validateBrief(msg, cf)).toEqual(["send_message needs buyer_message"]);
  });
});

describe("CaseBriefSchema: values the model can never emit", () => {
  const valid = () => makeBrief(installCase());
  const rejects = (patch: Record<string, unknown>) => expect(CaseBriefSchema.safeParse({ ...valid(), ...patch }).success).toBe(false);

  it("accepts the well-formed brief", () => {
    expect(CaseBriefSchema.safeParse(valid()).success).toBe(true);
  });

  it("limits the PayPal actions to the six Exhibit knows how to run", () => {
    expect([...ACTION_TYPES].sort()).toEqual(["accept_claim", "make_offer", "provide_evidence", "provide_supporting_info", "refund_then_prove", "send_message"]);
    rejects({ paypal_action: { type: "issue_payout", amount: 100 } });
    rejects({ paypal_action: { type: "refund", amount: 100 } });
  });

  it("rejects negative amounts, unknown offer types and unknown evidence types", () => {
    rejects({ paypal_action: { type: "make_offer", offer_type: "REFUND", amount: -1 } });
    rejects({ paypal_action: { type: "make_offer", offer_type: "FULL_REFUND_PLUS_GIFT", amount: 10 } });
    rejects({ paypal_action: { type: "provide_evidence", evidence_types: ["TRUST_ME"] } });
  });

  it("rejects out-of-range likelihoods, unknown decisions and confidence levels", () => {
    rejects({ win_likelihood: 101 });
    rejects({ win_likelihood: -1 });
    rejects({ win_likelihood: 50.5 });
    rejects({ decision: "APPROVE_EVERYTHING" });
    rejects({ confidence: "CERTAIN" });
  });

  it("rejects exhibit letters outside A-H, more than eight exhibits and an over-long letter to PayPal", () => {
    const brief = valid();
    rejects({ exhibits: [{ ...brief.exhibits[0], label: "I" }] });
    rejects({ exhibits: [{ ...brief.exhibits[0], label: "a" }] });
    rejects({ exhibits: Array.from({ length: 9 }, (_, i) => ({ ...brief.exhibits[0], label: "ABCDEFGHI"[i] })) });
    rejects({ response_letter: "x".repeat(1901) });
  });

  it("is enforced on the tool call: a malformed brief is refused with the reasons and nothing is filed", async () => {
    const kit = installCase();
    const { ctx, events } = toolContext(kit.dispute.dispute_id);
    await executeTool("get_paypal_dispute", { dispute_id: kit.dispute.dispute_id }, ctx);
    const result = await executeTool("file_case_brief", { ...makeBrief(kit), paypal_action: { type: "issue_payout", amount: 100 } }, ctx);
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.text).error).toBe("INVALID_INPUT");
    expect(ctx.brief).toBeUndefined();
    expect(events.findLast((e) => e.t === "tool_result")).toMatchObject({ ok: false });
  });
});
