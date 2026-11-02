// Guarantee: when the merchant (or an approved request) files, Exhibit calls PayPal's Disputes and
// Payments APIs the way PayPal expects: only evidence types PayPal asked for, the tracking number
// copied from the carrier record, a refund before the proof of refund, and a PDF packet built from
// source records. The simulator enforces PayPal's rules on every call, so a wrong call fails here.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeBriefAction } from "@/lib/actions";
import { refs } from "@/lib/evidence";
import { packetExhibits, packetFilename, renderPacket } from "@/lib/packet/render";
import { simGet } from "@/lib/paypal/simulator";
import { store } from "@/lib/store/repo";
import { caseFileOf, installCase, insertRun, makeBriefFor, paypalCalls, recordedActions, resetState, type CaseKit } from "./support/fixtures";
import { instantTimers } from "./support/timers";

beforeEach(() => {
  instantTimers();
  resetState();
});
afterEach(() => vi.restoreAllMocks());

function filing(type: Parameters<typeof makeBriefFor>[1], opts: Parameters<typeof installCase>[0] = {}, over: Parameters<typeof makeBriefFor>[2] = {}) {
  const kit = installCase(opts);
  const brief = makeBriefFor(kit, type, over);
  insertRun(kit.dispute.dispute_id, brief);
  return { kit, brief, id: kit.dispute.dispute_id };
}
const request = (id: string, i = 0) => JSON.parse(recordedActions(id)[i].request!);
const requested = (...types: string[]) => ({ dispute: { evidences: types.map((evidence_type) => ({ evidence_type, source: "REQUESTED_FROM_SELLER" as const })) } });

describe("filing evidence", () => {
  it("sends the one evidence type PayPal asked for, with the tracking number from the carrier record", async () => {
    const { kit, id } = filing("provide_evidence", requested("PROOF_OF_FULFILLMENT"), {
      paypal_action: { type: "provide_evidence", evidence_types: ["PROOF_OF_DELIVERY_SIGNATURE", "PROOF_OF_FULFILLMENT"], tracking_ref: refs.shipment("SHP-90001") },
    });

    const r = await executeBriefAction(id, {}, "merchant");

    expect(r).toMatchObject({ ok: true, kind: "provide_evidence" });
    const body = request(id);
    expect(body.evidences).toEqual([
      { evidence_type: "PROOF_OF_FULFILLMENT", notes: expect.stringContaining(kit.order.id), evidence_info: { tracking_info: [{ carrier_name: "UPS", tracking_number: kit.shipments[0].tracking_number }] } },
    ]);
    expect(body.files).toEqual([{ name: packetFilename(id), bytes: expect.any(Number) }]);
    expect(simGet(id)).toMatchObject({ status: "UNDER_REVIEW" });
    expect(recordedActions(id)).toEqual([expect.objectContaining({ kind: "provide_evidence", actor: "merchant", status: "ok" })]);
  });

  it("falls back to a type PayPal did ask for when the brief names another", async () => {
    const { id } = filing("provide_evidence", requested("OTHER"));
    expect((await executeBriefAction(id, {}, "merchant")).ok).toBe(true);
    expect(request(id).evidences.map((e: { evidence_type: string }) => e.evidence_type)).toEqual(["OTHER"]);
  });

  it("uses the brief's own type when PayPal did not name any", async () => {
    const { id } = filing("provide_evidence", requested());
    expect((await executeBriefAction(id, {}, "merchant")).ok).toBe(true);
    expect(request(id).evidences.map((e: { evidence_type: string }) => e.evidence_type)).toEqual(["PROOF_OF_FULFILLMENT"]);
  });

  it("files the merchant's edited letter instead of the brief's, cut to PayPal's 2,000-character limit", async () => {
    const { id } = filing("provide_evidence");
    await executeBriefAction(id, { letter: "Edited by the merchant. ".repeat(200) }, "merchant");
    const [evidence] = request(id).evidences;
    expect(evidence.notes.startsWith("Edited by the merchant.")).toBe(true);
    expect(evidence.notes.length).toBeLessThanOrEqual(2000);
    expect(simGet(id)?.status).toBe("UNDER_REVIEW"); // PayPal accepted it
  });

  it("sends supporting info, not evidence, to a chargeback already under review", async () => {
    const { id } = filing("provide_supporting_info", { dispute: { status: "UNDER_REVIEW" } });
    const r = await executeBriefAction(id, {}, "merchant");
    expect(r).toMatchObject({ ok: true, kind: "provide_supporting_info" });
    expect(request(id)).toMatchObject({ notes: expect.any(String), files: [{ name: packetFilename(id) }] });
    expect(simGet(id)?.status).toBe("UNDER_REVIEW");
  });
});

describe("refunding", () => {
  it("accept_claim: PayPal refunds the buyer and closes the case", async () => {
    const { id } = filing("accept_claim");
    expect(await executeBriefAction(id, {}, "merchant")).toMatchObject({ ok: true });
    expect(simGet(id)).toMatchObject({ status: "RESOLVED", dispute_outcome: { outcome_code: "RESOLVED_BUYER_FAVOUR" } });
    expect(request(id)).toMatchObject({ accept_claim_type: "REFUND" });
  });

  it("refund_then_prove: refunds the capture first, records it on the order, then files the refund ID as proof", async () => {
    const { kit, id } = filing("refund_then_prove", requested("PROOF_OF_REFUND"));

    const r = await executeBriefAction(id, {}, "merchant");

    expect(r).toMatchObject({ ok: true, kind: "refund_then_prove" });
    const [refund, proof] = recordedActions(id);
    expect([refund.kind, proof.kind]).toEqual(["refund_capture", "provide_evidence"]);
    expect(JSON.parse(refund.request!)).toMatchObject({ amount: { currency_code: "USD", value: "142.00" } });
    const refundId = JSON.parse(refund.response!).id as string;
    expect(refundId).toMatch(/^RF/);
    expect(store.order(kit.order.id)?.refunds).toEqual([expect.objectContaining({ id: refundId, amount: 142 })]);
    expect(JSON.parse(proof.request!).evidences).toEqual([expect.objectContaining({ evidence_type: "PROOF_OF_REFUND", evidence_info: { refund_ids: [refundId] } })]);
    const refundCall = paypalCalls().findIndex((c) => c.path.endsWith("/refund"));
    const proofCall = paypalCalls().findIndex((c) => c.path.endsWith("/provide-evidence"));
    expect(refundCall).toBeGreaterThanOrEqual(0);
    expect(refundCall).toBeLessThan(proofCall); // the refund is made before it is proven
  });

  it("refund_then_prove: refunds the amount in the brief, or the merchant's edit, not more than that", async () => {
    const partial = filing("refund_then_prove", requested("PROOF_OF_REFUND"), { paypal_action: { type: "refund_then_prove", amount: 60 } });
    await executeBriefAction(partial.id, {}, "merchant");
    expect(JSON.parse(recordedActions(partial.id)[0].request!).amount.value).toBe("60.00");

    resetState();
    const edited = filing("refund_then_prove", requested("PROOF_OF_REFUND"), { paypal_action: { type: "refund_then_prove", amount: 60 } });
    await executeBriefAction(edited.id, { amount: 45.5 }, "merchant");
    expect(JSON.parse(recordedActions(edited.id)[0].request!).amount.value).toBe("45.50");
  });

  it("refund_then_prove: stops before any proof if the refund itself fails", async () => {
    const { id } = filing("refund_then_prove", requested("PROOF_OF_REFUND"));
    const { PayPalClient, PayPalError } = await import("@/lib/paypal/client");
    vi.spyOn(PayPalClient.prototype, "refundCapture").mockRejectedValue(new PayPalError(422, { name: "UNPROCESSABLE_ENTITY", message: "Refund not allowed", details: [{ issue: "REFUND_NOT_ALLOWED" }] }, "POST", "/v2/payments/captures/x/refund"));

    const r = await executeBriefAction(id, {}, "merchant");

    expect(r).toMatchObject({ ok: false, kind: "refund_then_prove", issue: "REFUND_NOT_ALLOWED" });
    expect(recordedActions(id).map((a) => [a.kind, a.status])).toEqual([["refund_then_prove", "error"]]);
    expect(simGet(id)?.status).toBe("WAITING_FOR_SELLER_RESPONSE");
  });
});

describe("offers and messages", () => {
  const inquiry = { dispute: { dispute_life_cycle_stage: "INQUIRY" as const } };

  it("make_offer: sends the amount, and for a return the merchant's return address", async () => {
    const { id } = filing("make_offer", inquiry, { paypal_action: { type: "make_offer", offer_type: "REFUND_WITH_RETURN", amount: 50 } });
    expect((await executeBriefAction(id, {}, "merchant")).ok).toBe(true);
    const merchant = store.merchant().address;
    expect(request(id)).toMatchObject({
      offer_type: "REFUND_WITH_RETURN",
      offer_amount: { currency_code: "USD", value: "50.00" },
      return_shipping_address: { address_line_1: merchant.line1, admin_area_2: merchant.city, postal_code: merchant.postal_code, country_code: merchant.country },
    });
    expect(simGet(id)).toMatchObject({ status: "WAITING_FOR_BUYER_RESPONSE", offer: { offer_type: "REFUND_WITH_RETURN", seller_offered_amount: { value: "50.00" } } });
  });

  it("make_offer: a replacement carries no amount (even a stray 0 in the brief) and no return address", async () => {
    const { id } = filing("make_offer", inquiry, { paypal_action: { type: "make_offer", offer_type: "REPLACEMENT_WITHOUT_REFUND", amount: 0 } });
    expect((await executeBriefAction(id, {}, "merchant")).ok).toBe(true);
    expect(Object.keys(request(id)).sort()).toEqual(["note", "offer_type"]);
  });

  it("make_offer: tells the buyer in the merchant's edited words", async () => {
    const { id } = filing("make_offer", inquiry);
    await executeBriefAction(id, { buyerMessage: "Hi Ada, I am sorry about this.", amount: 35 }, "merchant");
    expect(request(id)).toMatchObject({ note: "Hi Ada, I am sorry about this.", offer_amount: { value: "35.00" } });
    expect(simGet(id)?.messages?.at(-1)).toMatchObject({ posted_by: "SELLER", content: "Hi Ada, I am sorry about this." });
  });

  it("send_message: delivers the buyer message, and refuses to send nothing", async () => {
    const { id } = filing("send_message", inquiry);
    expect(await executeBriefAction(id, {}, "merchant")).toMatchObject({ ok: true, kind: "send_message" });
    expect(simGet(id)?.messages?.at(-1)).toMatchObject({ posted_by: "SELLER", content: "Hi Ada, here is an update on your order." });

    resetState();
    const empty = filing("send_message", inquiry, { buyer_message: null });
    expect(await executeBriefAction(empty.id, {}, "merchant")).toMatchObject({ ok: false, error: "There is no buyer message to send." });
    expect(paypalCalls().filter((c) => c.method === "POST" && c.path !== "/v1/oauth2/token")).toEqual([]); // nothing was sent to PayPal
  });
});

describe("when PayPal refuses", () => {
  it("reports PayPal's reason, records the failed attempt, and changes nothing", async () => {
    const { id } = filing("accept_claim", { dispute: { status: "UNDER_REVIEW" } });
    const r = await executeBriefAction(id, {}, "autopilot");
    expect(r).toMatchObject({ ok: false, kind: "accept_claim", issue: "INVALID_DISPUTE_STATUS", status: 422, debugId: expect.any(String) });
    expect(recordedActions(id)).toEqual([expect.objectContaining({ kind: "accept_claim", actor: "autopilot", status: "error" })]);
    expect(simGet(id)?.status).toBe("UNDER_REVIEW");
  });

  it("does nothing, and says so, when there is no brief to file", async () => {
    const kit = installCase();
    expect(await executeBriefAction(kit.dispute.dispute_id, {}, "merchant")).toMatchObject({ ok: false, error: "Run Exhibit on this dispute first." });
    expect(recordedActions()).toEqual([]);
  });
});

describe("the evidence packet", () => {
  async function packetCase() {
    const kit: CaseKit = installCase();
    const brief = makeBriefFor(kit, "provide_evidence");
    return { kit, brief, cf: caseFileOf(kit) };
  }

  it("is built from the source records behind each ref, not from what the model wrote about them", async () => {
    const { kit, brief, cf } = await packetCase();
    brief.exhibits[0] = { ...brief.exhibits[0], title: "Photo of the parcel at the door", why: "The courier photographed the parcel." }; // the model's words
    const exhibits = packetExhibits(cf, brief);
    expect(exhibits[0].resolved).toMatchObject({ kind: "shipment", data: store.shipment(kit.shipments[0].id) });
    expect(exhibits[1].resolved).toMatchObject({ kind: "order", data: store.order(kit.order.id) });
  });

  it("leaves out an exhibit whose ref does not resolve, and orders the rest by letter", async () => {
    const { brief, cf } = await packetCase();
    brief.exhibits = [
      { label: "C", title: "Order", ref: refs.order("KA-90001"), why: "x" },
      { label: "B", title: "Invented", ref: "shipment:SHP-INVENTED", why: "x" },
      { label: "A", title: "Dispute", ref: refs.dispute("PP-D-90001"), why: "x" },
    ];
    expect(packetExhibits(cf, brief).map((e) => e.label)).toEqual(["A", "C"]);
  });

  it("renders as a PDF PayPal will accept", async () => {
    const { brief, cf } = await packetCase();
    const pdf = await renderPacket(cf, brief);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(5_000);
    expect(pdf.byteLength).toBeLessThan(10 * 1024 * 1024); // PayPal's per-file limit
    expect(packetFilename("PP-D-90001")).toBe("exhibit-PP-D-90001-evidence-packet.pdf");
  });
});
