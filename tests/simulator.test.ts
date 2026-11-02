// Guarantee: demo mode is a faithful stand-in for PayPal. The simulator speaks the Disputes v1 /
// Orders v2 / Payments v2 shapes and fails the way PayPal fails: wrong state, unrequested evidence,
// missing item ids, oversized files. Shapes and rules follow docs/sources/paypal-disputes-v1-openapi.json.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PayPalError, paypal } from "@/lib/paypal/client";
import { linksFor, simGet, simPut, simulatorFetch } from "@/lib/paypal/simulator";
import type { Dispute, DisputeStage, DisputeStatus } from "@/lib/paypal/types";
import { ago, makeDispute, paypalCalls, resetState } from "./support/fixtures";
import { instantTimers } from "./support/timers";

const BASE = "https://api-m.sandbox.paypal.com";
const AUTH = { Authorization: "Bearer test-token" };
const MiB = 1024 * 1024;

beforeEach(() => {
  instantTimers();
  resetState();
});
afterEach(() => vi.restoreAllMocks());

type Reply = { status: number; headers: Headers; body: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = AUTH): Promise<Reply> {
  const isForm = body instanceof FormData;
  const res = await simulatorFetch(`${BASE}${path}`, {
    method,
    headers: { ...headers, ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}) },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

let seq = 0;
/** A dispute in the simulator's store, under a fresh id. */
function put(over: Partial<Dispute> = {}): Dispute {
  const d = makeDispute({ dispute_id: `PP-D-SIM${++seq}`, ...over });
  simPut(d);
  return d;
}
const url = (d: Dispute, action = "") => `/v1/customer/disputes/${d.dispute_id}${action ? `/${action}` : ""}`;
const state = async (d: Dispute) => (await call("GET", url(d))).body as Dispute;
const rels = (d: Dispute) => d.links.map((l) => l.rel).filter((r) => r !== "self");

function evidenceForm(evidences: unknown[], files: { name?: string; type?: string; bytes?: number }[] = [{}], field = "evidence-file") {
  const form = new FormData();
  form.append("input", new Blob([JSON.stringify({ evidences })], { type: "application/json" }));
  for (const f of files) form.append(field, new File([new Uint8Array(f.bytes ?? 1024)], f.name ?? "packet.pdf", { type: f.type ?? "application/pdf" }));
  return form;
}
const fulfillment = { evidence_type: "PROOF_OF_FULFILLMENT", notes: "Delivered and signed for.", item_id: "ITEM-1" };

function expectPayPalError(r: Reply, status: number, name: string, issue: string) {
  expect(r.status).toBe(status);
  expect(r.body).toMatchObject({ name, message: expect.any(String), debug_id: expect.any(String), details: [{ issue, description: expect.any(String) }], links: [] });
  expect(r.headers.get("paypal-debug-id")).toBe(r.body.debug_id);
}

// PayPal's lifecycle written out by hand: which HATEOAS links a dispute carries in each state.
const LINKS: [DisputeStatus, DisputeStage, string[]][] = [
  ["WAITING_FOR_SELLER_RESPONSE", "CHARGEBACK", ["provide_evidence", "accept_claim"]],
  ["WAITING_FOR_SELLER_RESPONSE", "INQUIRY", ["provide_evidence", "accept_claim", "make_offer", "send_message"]],
  ["UNDER_REVIEW", "CHARGEBACK", ["provide_supporting_info", "adjudicate", "require_evidence"]],
  ["UNDER_REVIEW", "INQUIRY", ["adjudicate", "require_evidence"]],
  ["WAITING_FOR_BUYER_RESPONSE", "INQUIRY", ["send_message"]],
  ["WAITING_FOR_BUYER_RESPONSE", "CHARGEBACK", []],
  ["RESOLVED", "CHARGEBACK", []],
];

describe("authentication and error shape", () => {
  it("issues a bearer token from the OAuth endpoint", async () => {
    const r = await call("POST", "/v1/oauth2/token", undefined, { Authorization: "Basic ZGVtbzpkZW1v" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ token_type: "Bearer", access_token: expect.stringMatching(/^SIM\./), expires_in: expect.any(Number) });
    expect(r.body.scope).toContain("disputes/update-seller");
  });

  it("answers 401 in PayPal's error format when there is no bearer token", async () => {
    expectPayPalError(await call("GET", "/v1/customer/disputes", undefined, {}), 401, "AUTHENTICATION_FAILURE", "INVALID_TOKEN");
  });

  it("answers 404 RESOURCE_NOT_FOUND for an unknown dispute", async () => {
    const r = await call("GET", "/v1/customer/disputes/PP-D-NOPE");
    expectPayPalError(r, 404, "RESOURCE_NOT_FOUND", "INVALID_RESOURCE_ID");
    expect(r.body.details[0].description).toContain("PP-D-NOPE");
  });

  it("does not pretend to simulate endpoints it does not implement", async () => {
    expectPayPalError(await call("GET", "/v1/payments/payouts"), 404, "NOT_FOUND", "INVALID_URI");
    expectPayPalError(await call("DELETE", url(put())), 405, "METHOD_NOT_SUPPORTED", "METHOD_NOT_SUPPORTED");
  });
});

describe("listing and details", () => {
  it("lists disputes newest first with PayPal's list shape and dispute_state", async () => {
    const waiting = put({ create_time: ago(5) });
    const review = put({ create_time: ago(2), status: "UNDER_REVIEW" });
    const buyer = put({ create_time: ago(3), status: "WAITING_FOR_BUYER_RESPONSE", dispute_life_cycle_stage: "INQUIRY" });
    const done = put({ create_time: ago(4), status: "RESOLVED" });
    const r = await call("GET", "/v1/customer/disputes");
    expect(r.status).toBe(200);
    const items = r.body.items as { dispute_id: string; dispute_state: string; links: { rel: string }[] }[];
    expect(items.map((i) => i.dispute_id)).toEqual([review, buyer, done, waiting].map((d) => d.dispute_id));
    expect(Object.fromEntries(items.map((i) => [i.dispute_id, i.dispute_state]))).toEqual({
      [waiting.dispute_id]: "REQUIRED_ACTION",
      [review.dispute_id]: "UNDER_PAYPAL_REVIEW",
      [buyer.dispute_id]: "REQUIRED_OTHER_PARTY_ACTION",
      [done.dispute_id]: "RESOLVED",
    });
    for (const i of items) expect(i.links.map((l) => l.rel)).toEqual(["self"]);
  });

  it.each(LINKS)("%s / %s offers exactly the right actions", async (status, stage, expected) => {
    const d = put({ status, dispute_life_cycle_stage: stage, links: undefined });
    const got = await state(d);
    expect(rels(got)).toEqual(expected);
    expect(got.links[0]).toMatchObject({ rel: "self", method: "GET", href: `${BASE}/v1/customer/disputes/${d.dispute_id}` });
    for (const l of got.links.slice(1)) expect(l).toMatchObject({ method: "POST", href: `${BASE}/v1/customer/disputes/${d.dispute_id}/${l.rel.replace(/_/g, "-")}` });
  });
});

describe("an action works exactly when PayPal's link for it is on the dispute", () => {
  // PayPal: "In case the link is not present in the response, you can't provide evidence / send a message."
  const ACTIONS: Record<string, () => unknown> = {
    "provide-evidence": () => evidenceForm([fulfillment]),
    "provide-supporting-info": () => {
      const form = new FormData();
      form.append("input", new Blob([JSON.stringify({ notes: "Please see the tracking record." })], { type: "application/json" }));
      return form;
    },
    "make-offer": () => ({ note: "We would like to make this right.", offer_type: "REFUND", offer_amount: { currency_code: "USD", value: "20.00" } }),
    "accept-claim": () => ({ note: "Refund the buyer.", accept_claim_type: "REFUND" }),
    "send-message": () => ({ message: "Hello from the store." }),
    adjudicate: () => ({ adjudication_outcome: "SELLER_FAVOR" }),
    "require-evidence": () => ({ action: "SELLER_EVIDENCE" }),
  };
  const STATES = LINKS.map(([status, stage]) => ({ status, stage }));

  for (const [action, body] of Object.entries(ACTIONS)) {
    it(`${action}`, async () => {
      const rel = action.replace(/-/g, "_");
      for (const { status, stage } of STATES) {
        const d = put({ status, dispute_life_cycle_stage: stage, links: undefined });
        const offered = d.links.some((l) => l.rel === rel);
        const r = await call("POST", url(d, action), body());
        if (offered) expect(r.status, `${action} in ${status}/${stage}`).toBe(200);
        else expectPayPalError(r, 422, "UNPROCESSABLE_ENTITY", "INVALID_DISPUTE_STATUS");
        if (!offered) expect(await state(d), `${action} must not change a ${status}/${stage} dispute`).toEqual({ ...d, links: d.links });
      }
    });
  }
});

describe("provide-evidence", () => {
  const untouched = async (d: Dispute) => {
    const now = await state(d);
    expect(now.status).toBe("WAITING_FOR_SELLER_RESPONSE");
    expect(now.evidences?.some((e) => e.source === "SUBMITTED_BY_SELLER")).toBeFalsy();
  };
  const file = (d: Dispute, form: FormData) => call("POST", url(d, "provide-evidence"), form);
  const invalid = (r: Reply, issue: string) => expectPayPalError(r, 400, "INVALID_REQUEST", issue);

  it("files requested evidence, moves the case to PayPal's review, and keeps the case from being filed twice", async () => {
    const d = put({ evidences: [{ evidence_type: "PROOF_OF_FULFILLMENT", source: "REQUESTED_FROM_SELLER" }, { evidence_type: "OTHER", source: "REQUESTED_FROM_SELLER" }] });
    const r = await file(d, evidenceForm([{ ...fulfillment, evidence_info: { tracking_info: [{ carrier_name: "UPS", tracking_number: "1Z999" }] } }]));
    expect(r.status).toBe(200);
    expect(r.body.links[0]).toMatchObject({ rel: "self", method: "GET" });

    const now = await state(d);
    expect(now.status).toBe("UNDER_REVIEW");
    expect(now.evidences).toEqual([expect.objectContaining({ evidence_type: "PROOF_OF_FULFILLMENT", source: "SUBMITTED_BY_SELLER", documents: [{ name: "packet.pdf" }], evidence_info: { tracking_info: [{ carrier_name: "UPS", tracking_number: "1Z999" }] } })]);
    expect(rels(now)).not.toContain("provide_evidence");
    expectPayPalError(await file(d, evidenceForm([fulfillment])), 422, "UNPROCESSABLE_ENTITY", "INVALID_DISPUTE_STATUS");
  });

  it("rejects a request with no input part, or no evidence in it", async () => {
    const d = put();
    invalid(await file(d, new FormData()), "MISSING_REQUIRED_PARAMETER");
    invalid(await file(d, evidenceForm([])), "MISSING_REQUIRED_PARAMETER");
    await untouched(d);
  });

  it("rejects an evidence type PayPal does not define", async () => {
    const d = put({ evidences: [] });
    invalid(await file(d, evidenceForm([{ evidence_type: "TRUST_ME", notes: "x" }])), "INVALID_EVIDENCE_TYPE");
    await untouched(d);
  });

  it("rejects an evidence type PayPal did not request from the seller", async () => {
    const d = put({ evidences: [{ evidence_type: "PROOF_OF_FULFILLMENT", source: "REQUESTED_FROM_SELLER" }] });
    const r = await file(d, evidenceForm([{ evidence_type: "ITEM_DESCRIPTION", notes: "The item matched the listing.", item_id: "ITEM-1" }]));
    invalid(r, "INVALID_EVIDENCE_TYPE");
    expect(r.body.details[0].description).toBe("ITEM_DESCRIPTION was not requested for this dispute.");
    await untouched(d);
  });

  it("accepts any known evidence type when PayPal requested none in particular", async () => {
    const d = put({ evidences: [] });
    expect((await file(d, evidenceForm([{ evidence_type: "ITEM_DESCRIPTION", notes: "As listed." }]))).status).toBe(200);
  });

  it("requires an item_id on every evidence when the transaction has items and more than one evidence is filed", async () => {
    const requested = [
      { evidence_type: "PROOF_OF_FULFILLMENT", source: "REQUESTED_FROM_SELLER" as const },
      { evidence_type: "OTHER", source: "REQUESTED_FROM_SELLER" as const },
    ];
    const d = put({ evidences: requested });
    const missing = await file(d, evidenceForm([fulfillment, { evidence_type: "OTHER", notes: "Order record." }]));
    invalid(missing, "ITEM_ID_IS_MANDATORY_FOR_MULTIPLE_EVIDENCES");
    await untouched(d);
    expect((await file(d, evidenceForm([fulfillment, { evidence_type: "OTHER", notes: "Order record.", item_id: "ITEM-1" }]))).status).toBe(200);
  });

  it("does not need an item_id for a single evidence", async () => {
    const d = put();
    expect((await file(d, evidenceForm([{ evidence_type: "PROOF_OF_FULFILLMENT", notes: "Delivered." }]))).status).toBe(200);
  });

  it("limits notes to 2,000 characters", async () => {
    const d = put();
    invalid(await file(d, evidenceForm([{ ...fulfillment, notes: "x".repeat(2001) }])), "INVALID_STRING_LENGTH");
    await untouched(d);
    expect((await file(d, evidenceForm([{ ...fulfillment, notes: "x".repeat(2000) }]))).status).toBe(200);
  });

  it("accepts only PDF, PNG, JPEG and GIF documents", async () => {
    for (const type of ["application/pdf", "image/png", "image/jpeg", "image/gif"]) {
      const d = put();
      expect((await file(d, evidenceForm([fulfillment], [{ type, name: "doc" }]))).status, type).toBe(200);
    }
    for (const type of ["text/plain", "application/zip", "text/html"]) {
      const d = put();
      invalid(await file(d, evidenceForm([fulfillment], [{ type, name: "doc" }])), "INVALID_FILE_TYPE");
      await untouched(d);
    }
  });

  it("limits each document to 10 MB", async () => {
    const d = put();
    const big = await file(d, evidenceForm([fulfillment], [{ bytes: 10 * MiB + 1 }]));
    invalid(big, "FILE_SIZE_LIMIT_EXCEEDED");
    expect(big.body.details[0].description).toContain("10 MB");
    await untouched(d);
    expect((await file(d, evidenceForm([fulfillment], [{ bytes: 10 * MiB }]))).status).toBe(200);
  });

  it("limits a call to 50 MB of documents in total", async () => {
    const d = put();
    const six = await file(d, evidenceForm([fulfillment], Array.from({ length: 6 }, (_, i) => ({ bytes: 9 * MiB, name: `part-${i}.pdf` }))));
    invalid(six, "FILE_SIZE_LIMIT_EXCEEDED");
    expect(six.body.details[0].description).toContain("50 MB");
    await untouched(d);
  });
});

describe("provide-supporting-info", () => {
  const notes = (n: unknown) => {
    const form = new FormData();
    form.append("input", new Blob([JSON.stringify(n === undefined ? {} : { notes: n })], { type: "application/json" }));
    form.append("supporting-document", new File([new Uint8Array(512)], "tracking.pdf", { type: "application/pdf" }));
    return form;
  };

  it("is a chargeback-only action: an inquiry cannot use it", async () => {
    const d = put({ status: "UNDER_REVIEW", dispute_life_cycle_stage: "INQUIRY" });
    expectPayPalError(await call("POST", url(d, "provide-supporting-info"), notes("x")), 422, "UNPROCESSABLE_ENTITY", "INVALID_DISPUTE_STATUS");
  });

  it("needs notes of at most 2,000 characters", async () => {
    const d = put({ status: "UNDER_REVIEW" });
    expectPayPalError(await call("POST", url(d, "provide-supporting-info"), notes(undefined)), 400, "INVALID_REQUEST", "MISSING_REQUIRED_PARAMETER");
    expectPayPalError(await call("POST", url(d, "provide-supporting-info"), notes("x".repeat(2001))), 400, "INVALID_REQUEST", "INVALID_STRING_LENGTH");
    expect(simGet(d.dispute_id)).toEqual(d);
  });

  it("records the notes and documents without leaving review", async () => {
    const d = put({ status: "UNDER_REVIEW" });
    expect((await call("POST", url(d, "provide-supporting-info"), notes("Tracking shows delivery."))).status).toBe(200);
    const now = (await state(d)) as Dispute & { supporting_info: { notes: string; source: string; documents: { name: string }[] }[] };
    expect(now.status).toBe("UNDER_REVIEW");
    expect(now.supporting_info).toEqual([expect.objectContaining({ notes: "Tracking shows delivery.", source: "SUBMITTED_BY_SELLER", documents: [{ name: "tracking.pdf" }] })]);
  });
});

describe("offers, claims and messages", () => {
  it("make-offer: only an allowed offer type, with a note, moves the inquiry to the buyer", async () => {
    const d = put({ dispute_life_cycle_stage: "INQUIRY", allowed_response_options: { make_offer: { offer_types: ["REFUND"] } } });
    const body = { note: "A partial refund.", offer_type: "REFUND", offer_amount: { currency_code: "USD", value: "40.00" } };
    expectPayPalError(await call("POST", url(d, "make-offer"), { ...body, offer_type: "REFUND_WITH_RETURN" }), 422, "UNPROCESSABLE_ENTITY", "INVALID_OFFER_TYPE");
    expectPayPalError(await call("POST", url(d, "make-offer"), { ...body, note: undefined }), 400, "INVALID_REQUEST", "MISSING_REQUIRED_PARAMETER");
    expect((await state(d)).status).toBe("WAITING_FOR_SELLER_RESPONSE");

    expect((await call("POST", url(d, "make-offer"), body)).status).toBe(200);
    const now = await state(d);
    expect(now.status).toBe("WAITING_FOR_BUYER_RESPONSE");
    expect(now.offer).toMatchObject({ offer_type: "REFUND", seller_offered_amount: { value: "40.00" } });
    expect(now.messages?.at(-1)).toMatchObject({ posted_by: "SELLER", content: "A partial refund." });
    expect(rels(now)).toEqual(["send_message"]); // the seller can still write, but cannot offer twice
  });

  it("accept-claim: closes the case in the buyer's favour and refunds the whole disputed amount by default", async () => {
    const d = put();
    expect((await call("POST", url(d, "accept-claim"), { note: "Refunding." })).status).toBe(200);
    const now = await state(d);
    expect(now.status).toBe("RESOLVED");
    expect(now.dispute_outcome).toEqual({ outcome_code: "RESOLVED_BUYER_FAVOUR", amount_refunded: d.dispute_amount });
    expect(rels(now)).toEqual([]);
  });

  it("send-message: needs a message and appends it as the seller's", async () => {
    const d = put({ dispute_life_cycle_stage: "INQUIRY" });
    expectPayPalError(await call("POST", url(d, "send-message"), {}), 400, "INVALID_REQUEST", "MISSING_REQUIRED_PARAMETER");
    expect((await call("POST", url(d, "send-message"), { message: "Your parcel is at the pickup point." })).status).toBe(200);
    expect((await state(d)).messages?.at(-1)).toMatchObject({ posted_by: "SELLER", content: "Your parcel is at the pickup point." });
  });
});

describe("lifecycle", () => {
  it("chargeback: waiting on the seller -> under review -> resolved, and nothing works after that", async () => {
    const d = put();
    expect((await call("POST", url(d, "provide-evidence"), evidenceForm([fulfillment]))).status).toBe(200);
    expect((await state(d)).status).toBe("UNDER_REVIEW");

    // Sandbox-only: PayPal's agents rule in the seller's favour.
    expect((await call("POST", url(d, "adjudicate"), { adjudication_outcome: "SELLER_FAVOR" })).status).toBe(200);
    const done = await state(d);
    expect(done).toMatchObject({ status: "RESOLVED", dispute_outcome: { outcome_code: "RESOLVED_SELLER_FAVOUR" } });
    expect(done.dispute_outcome?.amount_refunded).toBeUndefined();
    expect(rels(done)).toEqual([]);
    for (const action of ["provide-evidence", "accept-claim", "adjudicate", "require-evidence", "make-offer"]) {
      expect((await call("POST", url(d, action), action === "provide-evidence" ? evidenceForm([fulfillment]) : { note: "x", action: "SELLER_EVIDENCE" })).status, action).toBe(422);
    }
  });

  it("a buyer-favour ruling refunds the buyer", async () => {
    const d = put({ status: "UNDER_REVIEW" });
    await call("POST", url(d, "adjudicate"), { adjudication_outcome: "BUYER_FAVOR" });
    expect(await state(d)).toMatchObject({ status: "RESOLVED", dispute_outcome: { outcome_code: "RESOLVED_BUYER_FAVOUR", amount_refunded: d.dispute_amount } });
  });

  it("require-evidence reopens a case under review, for the seller or the buyer", async () => {
    const seller = put({ status: "UNDER_REVIEW" });
    await call("POST", url(seller, "require-evidence"), { action: "SELLER_EVIDENCE" });
    expect(rels(await state(seller))).toContain("provide_evidence");
    const buyer = put({ status: "UNDER_REVIEW" });
    await call("POST", url(buyer, "require-evidence"), { action: "BUYER_EVIDENCE" });
    expect((await state(buyer)).status).toBe("WAITING_FOR_BUYER_RESPONSE");
  });

  it("inquiry: offer -> buyer accepts -> resolved with the offered refund", async () => {
    const d = put({ dispute_life_cycle_stage: "INQUIRY" });
    await call("POST", url(d, "make-offer"), { note: "Here is a refund.", offer_type: "REFUND", offer_amount: { currency_code: "USD", value: "50.00" } });
    expect((await call("POST", url(d, "make-offer"), { note: "again", offer_type: "REFUND" })).status).toBe(422);
    expect((await call("POST", url(d, "accept-offer"))).status).toBe(200);
    expect(await state(d)).toMatchObject({ status: "RESOLVED", dispute_outcome: { outcome_code: "RESOLVED_WITH_PAYOUT", amount_refunded: { value: "50.00" } } });
  });

  it("links always match the state the dispute is in", async () => {
    const d = put();
    await call("POST", url(d, "provide-evidence"), evidenceForm([fulfillment]));
    const now = await state(d);
    expect(now.links).toEqual(linksFor(now));
  });
});

describe("orders and payments endpoints", () => {
  it("tracking: needs capture id, tracking number and carrier", async () => {
    expectPayPalError(await call("POST", "/v2/checkout/orders/ORDER-1/track", { capture_id: "C1" }), 400, "INVALID_REQUEST", "MISSING_REQUIRED_PARAMETER");
    const ok = await call("POST", "/v2/checkout/orders/ORDER-1/track", { capture_id: "C1", tracking_number: "1Z999", carrier: "UPS" });
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ id: "ORDER-1", purchase_units: [{ shipping: { trackers: [{ id: "C1-1Z999", status: "SHIPPED" }] } }] });
  });

  it("capture: reports PayPal's Seller Protection status", async () => {
    const r = await call("GET", "/v2/payments/captures/CAP-1");
    expect(r.body).toMatchObject({ id: "CAP-1", status: "COMPLETED", seller_protection: { status: "ELIGIBLE" } });
  });

  it("refund: completes with a refund id and echoes the amount", async () => {
    const amount = { currency_code: "USD", value: "25.00" };
    const r = await call("POST", "/v2/payments/captures/CAP-1/refund", { amount });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ id: expect.stringMatching(/^RF[0-9A-F]{15}$/), status: "COMPLETED", amount });
  });

  it("process-chargeback: only for a transaction that exists", async () => {
    const d = put();
    expect((await call("POST", "/v2/customer-support/process-chargeback", { dispute_id: d.dispute_id })).body).toEqual({ dispute_id: d.dispute_id });
    expectPayPalError(await call("POST", "/v2/customer-support/process-chargeback", { dispute_id: "PP-D-NOPE" }), 422, "UNPROCESSABLE_ENTITY", "TRANSACTION_NOT_FOUND");
  });

  it("verify-webhook-signature: answers SUCCESS", async () => {
    expect((await call("POST", "/v1/notifications/verify-webhook-signature", {})).body).toEqual({ verification_status: "SUCCESS" });
  });
});

describe("PayPalClient in demo mode", () => {
  it("turns a simulator failure into a PayPalError that carries PayPal's issue and debug id", async () => {
    const d = put({ status: "UNDER_REVIEW" });
    const error = await paypal()
      .acceptClaim(d.dispute_id, { note: "x" })
      .then(
        () => null,
        (e: unknown) => e,
      );
    expect(error).toBeInstanceOf(PayPalError);
    expect(error).toMatchObject({ status: 422, issue: "INVALID_DISPUTE_STATUS", method: "POST", path: `/v1/customer/disputes/${d.dispute_id}/accept-claim` });
    expect((error as PayPalError).debugId).toEqual(expect.any(String));
  });

  it("logs every call it makes, so the UI's API log shows what was sent to PayPal", async () => {
    const d = put();
    await paypal().getDispute(d.dispute_id);
    const calls = paypalCalls().filter((c) => c.path !== "/v1/oauth2/token"); // the token is cached across calls
    expect(calls.map((c) => `${c.method} ${c.path} ${c.status}`)).toEqual([`GET /v1/customer/disputes/${d.dispute_id} 200`]);
  });
});
