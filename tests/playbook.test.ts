// Guarantee: Exhibit checks a case against PayPal's published Seller Protection requirements
// deterministically, quotes PayPal's own text for each requirement, and never claims protection for
// claim types PayPal excludes. The playbook only recommends evidence PayPal can receive.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeTool } from "@/lib/agent/tools";
import { docGet, docPut } from "@/lib/db";
import { PayPalClient } from "@/lib/paypal/client";
import { EVIDENCE_TYPES, type DisputeReason } from "@/lib/paypal/types";
import { addressesMatch, evaluateSellerProtection, PAYPAL_POLICY, PLAYBOOK, type ProtectionReport } from "@/lib/agent/playbook";
import { ADDRESS, ago, caseFileOf, installCase, makeShipment, resetState, toolContext } from "./support/fixtures";
import { instantTimers } from "./support/timers";

beforeEach(() => {
  instantTimers();
  resetState();
});
afterEach(() => vi.restoreAllMocks());

const report = (opts: Parameters<typeof installCase>[0] = {}, merchantCountry?: string): ProtectionReport => evaluateSellerProtection(caseFileOf(installCase(opts)), merchantCountry);
const status = (r: ProtectionReport, id: string) => r.checks.find((c) => c.id === id)?.status;
const failing = (r: ProtectionReport) => r.checks.filter((c) => c.status === "fail").map((c) => c.id);
const undelivered = { status: "IN_TRANSIT" as const, delivered_at: undefined, delivered_to: undefined, signature: undefined };

describe("item not received", () => {
  it("is likely eligible when every published requirement checks out, with PayPal's own words for each", () => {
    const r = report();
    expect(r).toMatchObject({ applies: true, verdict: "LIKELY_ELIGIBLE", program: "PayPal Seller Protection (US)", source: PAYPAL_POLICY.source });
    expect(r.checks.map((c) => c.id)).toEqual(["coverage", "us", "physical", "address", "tracking", "delivered", "redirect", "ship-7", "respond"]);
    expect(r.checks.every((c) => c.status === "pass")).toBe(true);
    const published = Object.values(PAYPAL_POLICY.quotes) as string[];
    for (const c of r.checks) expect(published, `${c.id} must quote PayPal, not paraphrase`).toContain(c.quote);
  });

  it("is not eligible when the carrier delivered somewhere other than the transaction address", () => {
    const r = report({ shipments: [makeShipment({ delivered_to: { ...ADDRESS, line1: "99 Other Road", postal_code: "97209" } })] });
    expect(r.verdict).toBe("NOT_ELIGIBLE");
    expect(failing(r)).toEqual(["address", "redirect"]);
    expect(r.summary).toContain("Fails");
  });

  it("is not eligible when the parcel is not delivered yet", () => {
    const r = report({ shipments: [makeShipment(undelivered)] });
    expect(r.verdict).toBe("NOT_ELIGIBLE");
    expect(status(r, "delivered")).toBe("fail");
    expect(r.checks.find((c) => c.id === "delivered")?.detail).toContain("in transit");
  });

  it("is not eligible when the parcel went back to the sender", () => {
    const r = report({ shipments: [makeShipment({ ...undelivered, status: "RETURNED_TO_SENDER" })] });
    expect(r.verdict).toBe("NOT_ELIGIBLE");
    expect(status(r, "delivered")).toBe("fail");
    expect(status(r, "address")).toBe("info"); // it never reached the address, so the address is not what failed
  });

  it("is not eligible when nothing was shipped, or the tracking number is missing", () => {
    const none = report({ shipments: [] });
    expect(none.verdict).toBe("NOT_ELIGIBLE");
    expect(failing(none)).toEqual(["shipment"]);
    const untracked = report({ shipments: [makeShipment({ tracking_number: "" })] });
    expect(untracked.verdict).toBe("NOT_ELIGIBLE");
    expect(failing(untracked)).toContain("tracking");
  });

  it("is not eligible for a seller outside the US", () => {
    const r = report({}, "DE");
    expect(r.verdict).toBe("NOT_ELIGIBLE");
    expect(failing(r)).toEqual(["us"]);
  });

  it("is only at risk, not lost, when the response deadline has passed: a missed deadline is the one failure the merchant can still own", () => {
    const r = report({ dispute: { seller_response_due_date: ago(1) } });
    expect(r.verdict).toBe("AT_RISK");
    expect(failing(r)).toEqual(["respond"]);
    expect(r.summary).toContain("needs attention");
  });

  it("does not hold a slow shipper against the merchant: shipping after 7 days is noted, not failed", () => {
    const r = report({ order: { placed_at: ago(20) }, shipments: [makeShipment({ shipped_at: ago(7) })] });
    expect(status(r, "ship-7")).toBe("info");
    expect(r.verdict).toBe("LIKELY_ELIGIBLE");
  });

  it("is excluded for chargebacks filed with the card issuer, however good the delivery proof", () => {
    const r = report({ dispute: { dispute_channel: "EXTERNAL" } });
    expect(r).toMatchObject({ applies: false, verdict: "NOT_APPLICABLE" });
    expect(r.checks[0]).toMatchObject({ id: "coverage", status: "fail", quote: PAYPAL_POLICY.quotes.inrChargebackExcluded });
  });
});

describe("claim types PayPal does not cover", () => {
  it("not as described is excluded", () => {
    const r = report({ dispute: { reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED" } });
    expect(r).toMatchObject({ applies: false, verdict: "NOT_APPLICABLE" });
    expect(r.checks[0].quote).toBe(PAYPAL_POLICY.quotes.snadExcluded);
    expect(r.summary).toContain("decided on the evidence");
  });

  it.each<DisputeReason>(["DUPLICATE_TRANSACTION", "CREDIT_NOT_PROCESSED", "INCORRECT_AMOUNT", "OTHER"])("%s is not claimed as protected", (reason) => {
    const r = report({ dispute: { reason } });
    expect(r).toMatchObject({ applies: false, verdict: "NOT_APPLICABLE" });
    expect(r.checks[0].quote).toBe(PAYPAL_POLICY.quotes.covered);
  });
});

describe("unauthorized transactions", () => {
  const unauthorised = { reason: "UNAUTHORISED" as const };

  it("need proof of shipment no later than two days after PayPal's notice", () => {
    expect(report({ dispute: unauthorised }).verdict).toBe("LIKELY_ELIGIBLE");
    const late = report({ dispute: unauthorised, shipments: [makeShipment({ shipped_at: ago(0.5) })] }); // notice was 3 days ago
    expect(late.verdict).toBe("AT_RISK");
    expect(failing(late)).toEqual(["ship-timing"]);
    expect(late.checks.find((c) => c.id === "ship-timing")?.quote).toBe(PAYPAL_POLICY.quotes.unauthorizedTiming);
  });

  it("do not need delivery to be proven, only shipment", () => {
    const r = report({ dispute: unauthorised, shipments: [makeShipment(undelivered)] });
    expect(r.checks.map((c) => c.id)).not.toContain("delivered");
    expect(r.verdict).toBe("LIKELY_ELIGIBLE");
  });

  it("must be marked eligible by PayPal itself: its flag decides, and a missing flag falls back to the published rules", () => {
    const flagged = (flag: string) => {
      const kit = installCase({ dispute: unauthorised });
      docPut("capture", kit.order.paypal.capture_id, { id: kit.order.paypal.capture_id, status: "COMPLETED", seller_protection: { status: flag, dispute_categories: ["UNAUTHORIZED_TRANSACTION"] } });
      return evaluateSellerProtection(caseFileOf(kit));
    };
    expect(flagged("NOT_ELIGIBLE")).toMatchObject({ verdict: "NOT_ELIGIBLE" });
    expect(failing(flagged("NOT_ELIGIBLE"))).toEqual(["paypal-flag"]);
    for (const ok of ["ELIGIBLE", "PARTIALLY_ELIGIBLE"]) {
      const r = flagged(ok);
      expect(r.verdict, ok).toBe("LIKELY_ELIGIBLE");
      expect(r.checks.find((c) => c.id === "paypal-flag")).toMatchObject({ status: "pass", quote: PAYPAL_POLICY.quotes.unauthorizedEligible });
    }
    resetState(); // no capture on file: nothing from PayPal to go on
    expect(report({ dispute: unauthorised }).checks.map((c) => c.id)).not.toContain("paypal-flag");
  });

  it("show PayPal's flag for an item-not-received claim for information only", () => {
    const kit = installCase();
    docPut("capture", kit.order.paypal.capture_id, { id: kit.order.paypal.capture_id, status: "COMPLETED", seller_protection: { status: "NOT_ELIGIBLE" } });
    const r = evaluateSellerProtection(caseFileOf(kit));
    expect(status(r, "paypal-flag")).toBe("info");
    expect(r.verdict).toBe("LIKELY_ELIGIBLE");
  });
});

describe("addressesMatch", () => {
  it("ignores case, spacing and punctuation in the street, postal code and country", () => {
    expect(addressesMatch(ADDRESS, { ...ADDRESS, line1: "12 QUAY  street.", postal_code: "97-201", country: "us" })).toBe(true);
  });

  it("is false for a different street, postal code or country, and when either address is missing", () => {
    expect(addressesMatch(ADDRESS, { ...ADDRESS, line1: "14 Quay Street" })).toBe(false);
    expect(addressesMatch(ADDRESS, { ...ADDRESS, postal_code: "97202" })).toBe(false);
    expect(addressesMatch(ADDRESS, { ...ADDRESS, country: "CA" })).toBe(false);
    expect(addressesMatch(undefined, ADDRESS)).toBe(false);
    expect(addressesMatch(ADDRESS, undefined)).toBe(false);
  });
});

describe("check_seller_protection", () => {
  async function run(type: DisputeReason = "MERCHANDISE_OR_SERVICE_NOT_RECEIVED") {
    const kit = installCase({ dispute: { reason: type } });
    const { ctx } = toolContext(kit.dispute.dispute_id);
    await executeTool("get_paypal_dispute", { dispute_id: kit.dispute.dispute_id }, ctx);
    const r = await executeTool("check_seller_protection", { dispute_id: kit.dispute.dispute_id }, ctx);
    return { kit, r, out: JSON.parse(r.text) };
  }

  it("asks PayPal for its own flag on the payment and keeps it with the case", async () => {
    const { kit, out } = await run("UNAUTHORISED");
    expect(docGet("capture", kit.order.paypal.capture_id)).toMatchObject({ seller_protection: { status: "ELIGIBLE" } });
    expect(out.checks.find((c: { id: string }) => c.id === "paypal-flag")).toMatchObject({ status: "pass" });
    expect(out.ref).toBe(`paypal:seller-protection:${kit.dispute.dispute_id}`);
  });

  it("carries the playbook for the dispute's reason", async () => {
    const { out } = await run();
    expect(out.playbook).toEqual(PLAYBOOK.MERCHANDISE_OR_SERVICE_NOT_RECEIVED);
  });

  it("still answers from the published rules when PayPal cannot be reached", async () => {
    vi.spyOn(PayPalClient.prototype, "getCapture").mockRejectedValue(new Error("PayPal is down"));
    const { r, out } = await run("UNAUTHORISED");
    expect(r.isError).toBe(false);
    expect(out.verdict).toBe("LIKELY_ELIGIBLE");
    expect(out.checks.map((c: { id: string }) => c.id)).not.toContain("paypal-flag");
  });
});

describe("the playbook", () => {
  it("recommends only evidence types PayPal accepts", () => {
    for (const [reason, play] of Object.entries(PLAYBOOK)) {
      expect(play.evidence.length, reason).toBeGreaterThan(0);
      for (const t of play.evidence) expect(EVIDENCE_TYPES as readonly string[], `${reason}: ${t}`).toContain(t);
      expect(play.goal.length, reason).toBeGreaterThan(10);
      expect(play.strategy.length, reason).toBeGreaterThan(0);
    }
  });

  it("asks for proof of fulfillment on item-not-received, proof of refund on credit-not-processed, and has a default", () => {
    expect(PLAYBOOK.MERCHANDISE_OR_SERVICE_NOT_RECEIVED?.evidence).toContain("PROOF_OF_FULFILLMENT");
    expect(PLAYBOOK.CREDIT_NOT_PROCESSED?.evidence).toContain("PROOF_OF_REFUND");
    expect(PLAYBOOK.DEFAULT.evidence).toEqual(["OTHER"]);
  });

  it("tells the agent not to fight what it cannot win", () => {
    const inr = PLAYBOOK.MERCHANDISE_OR_SERVICE_NOT_RECEIVED!.strategy.join(" ");
    expect(inr).toMatch(/do not fight/i);
    expect(PLAYBOOK.CREDIT_NOT_PROCESSED!.strategy.join(" ")).toMatch(/refund/i);
  });
});
