// Guarantee: an external AI agent can ask, never do. Requesting creates a pending approval and
// executes nothing; only the merchant's approval runs the action, and only if the brief it was
// made against is still the latest one.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionType, CaseBrief } from "@/lib/agent/brief";
import { approveRequest, BRIEF_ACTION_TITLE, getApproval, listApprovals, rejectRequest, requestDisputeAction, requestPreventionFix } from "@/lib/approvals";
import { db, listActivity } from "@/lib/db";
import { simGet, simPut } from "@/lib/paypal/simulator";
import { store } from "@/lib/store/repo";
import { ago, footprint, installCase, installWatchedOrder, insertRun, makeBriefFor, paypalCalls, recordedActions, resetState } from "./support/fixtures";
import { instantTimers } from "./support/timers";

beforeEach(() => {
  instantTimers();
  resetState();
});
afterEach(() => vi.restoreAllMocks());

/** Audit-log lines about one approval, newest first. */
const approvalLog = (approvalId: string) =>
  listActivity({ kind: "approval" })
    .filter((a) => (a.meta as { approval?: string } | null)?.approval === approvalId)
    .map((a) => a.message);

/** An investigated case with a brief for `type`, ready for an agent to ask about. */
function investigated(type: ActionType = "accept_claim", over: Parameters<typeof installCase>[0] = {}, n = 1) {
  const kit = installCase({ n, ...over });
  const brief = makeBriefFor(kit, type);
  const runId = insertRun(kit.dispute.dispute_id, brief);
  return { kit, brief, runId, id: kit.dispute.dispute_id };
}

describe("requesting an action", () => {
  it("creates a pending approval and executes nothing", () => {
    const { id, runId } = investigated("accept_claim");
    const before = footprint(id);

    const r = requestDisputeAction(id, "Claude Desktop", "Strongest case in the queue.");

    expect(r.ok && r.existing).toBe(false);
    const a = r.ok ? r.approval : undefined;
    expect(a).toMatchObject({
      kind: "dispute_action",
      target: id,
      action: "accept_claim",
      title: BRIEF_ACTION_TITLE.accept_claim,
      status: "pending",
      client: "Claude Desktop",
      note: "Strongest case in the queue.",
      runId,
      amount: 142,
      currency: "USD",
      movesMoney: true,
      decidedAt: null,
      decidedBy: null,
      result: null,
    });
    expect(footprint(id)).toEqual(before);
    expect(approvalLog(a!.id)).toEqual([expect.stringContaining("Claude Desktop")]); // the audit log says who asked
  });

  // [action, state the dispute must be in, brief tweak, expected movesMoney, expected amount (undefined: not pinned)]
  const MONEY: [ActionType, Parameters<typeof installCase>[0], Partial<CaseBrief["paypal_action"]> | undefined, boolean, number | null | undefined][] = [
    ["provide_evidence", {}, undefined, false, null],
    ["provide_supporting_info", { dispute: { status: "UNDER_REVIEW" } }, undefined, false, null],
    ["send_message", { dispute: { dispute_life_cycle_stage: "INQUIRY" } }, undefined, false, null],
    ["accept_claim", {}, undefined, true, 142],
    ["refund_then_prove", {}, { amount: 60 }, true, 60],
    ["make_offer", { dispute: { dispute_life_cycle_stage: "INQUIRY" } }, { offer_type: "REFUND", amount: 35 }, true, 35],
    ["make_offer", { dispute: { dispute_life_cycle_stage: "INQUIRY" } }, { offer_type: "REPLACEMENT_WITHOUT_REFUND", amount: undefined }, false, undefined],
  ];
  it.each(MONEY.map((m, i) => [`${m[0]}${m[3] ? " (moves money)" : ""} #${i}`, i, ...m] as const))("flags whether %s moves money", (_name, i, type, over, action, moves, amount) => {
    const kit = installCase({ n: i + 1, ...over });
    const brief = makeBriefFor(kit, type);
    if (action) brief.paypal_action = { ...brief.paypal_action, ...action };
    insertRun(kit.dispute.dispute_id, brief);
    const r = requestDisputeAction(kit.dispute.dispute_id, "Agent");
    expect(r.ok && r.approval).toMatchObject({ action: type, movesMoney: moves, ...(amount === undefined ? {} : { amount }) });
  });

  it("refuses an unknown dispute, a resolved one, and one Exhibit has not investigated", () => {
    expect(requestDisputeAction("PP-D-NOPE", "Agent")).toMatchObject({ ok: false, status: 404 });

    const resolved = investigated("accept_claim", { dispute: { status: "RESOLVED" } }, 2);
    expect(requestDisputeAction(resolved.id, "Agent")).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("already resolved") });

    const fresh = installCase({ n: 3 });
    expect(requestDisputeAction(fresh.dispute.dispute_id, "Agent")).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("investigate_dispute") });

    const failedRun = installCase({ n: 4 });
    insertRun(failedRun.dispute.dispute_id, null, { status: "error" });
    expect(requestDisputeAction(failedRun.dispute.dispute_id, "Agent")).toMatchObject({ ok: false, status: 409 });

    expect(listApprovals()).toEqual([]);
  });

  it("returns the same approval when the agent asks again for the same brief", () => {
    const { id } = investigated();
    const first = requestDisputeAction(id, "Agent A");
    const again = requestDisputeAction(id, "Agent B", "retrying");
    expect(first.ok && again.ok && again.existing).toBe(true);
    expect(again.ok && again.approval.id).toBe(first.ok && first.approval.id);
    expect(listApprovals({ target: id })).toHaveLength(1);
  });

  it("expires an older pending request when a newer brief arrives, and pins the new one to it", () => {
    const { kit, id } = investigated();
    const first = requestDisputeAction(id, "Agent");
    const newer = insertRun(id, makeBriefFor(kit, "accept_claim", { headline: "Re-investigated" }), { startedAt: new Date(Date.now() + 5_000).toISOString() });

    const second = requestDisputeAction(id, "Agent");

    expect(first.ok && second.ok && second.approval.id).not.toBe(first.ok && first.approval.id);
    expect(first.ok && getApproval(first.approval.id)?.status).toBe("stale");
    expect(second.ok && second.approval).toMatchObject({ status: "pending", runId: newer });
    expect(listApprovals({ status: "pending" })).toHaveLength(1);
  });

  it("keeps a client name and note from growing without bound", () => {
    const { id } = investigated();
    const r = requestDisputeAction(id, "Agent", "n".repeat(900));
    expect(r.ok && r.approval.note).toHaveLength(500);
  });
});

describe("the merchant approves", () => {
  it("runs the action through the merchant path and records who asked and who decided", async () => {
    const { id } = investigated("accept_claim");
    const requested = requestDisputeAction(id, "Claude Desktop");
    if (!requested.ok) throw new Error(requested.error);

    const r = await approveRequest(requested.approval.id);

    expect(r.ok).toBe(true);
    expect(getApproval(requested.approval.id)).toMatchObject({ status: "approved", decidedBy: "merchant", result: { ok: true, kind: "accept_claim" } });
    expect(simGet(id)).toMatchObject({ status: "RESOLVED", dispute_outcome: { outcome_code: "RESOLVED_BUYER_FAVOUR" } });
    expect(recordedActions(id)).toEqual([expect.objectContaining({ kind: "accept_claim", actor: "agent:Claude Desktop approved by merchant", status: "ok" })]);
    expect(approvalLog(requested.approval.id)).toEqual(expect.arrayContaining([expect.stringMatching(/approved.*Claude Desktop/i)]));
  });

  it("files an evidence packet with the tracking number copied from the shipment", async () => {
    const { kit, id } = investigated("provide_evidence");
    const requested = requestDisputeAction(id, "Claude Desktop");
    if (!requested.ok) throw new Error(requested.error);

    expect((await approveRequest(requested.approval.id)).ok).toBe(true);

    const [action] = recordedActions(id);
    const request = JSON.parse(action.request!);
    expect(request.evidences).toEqual([
      expect.objectContaining({ evidence_type: "PROOF_OF_FULFILLMENT", evidence_info: { tracking_info: [{ carrier_name: "UPS", tracking_number: kit.shipments[0].tracking_number }] } }),
    ]);
    expect(request.files).toEqual([{ name: `exhibit-${id}-evidence-packet.pdf`, bytes: expect.any(Number) }]);
    expect(request.files[0].bytes).toBeGreaterThan(2_000);
    expect(simGet(id)).toMatchObject({ status: "UNDER_REVIEW", evidences: [expect.objectContaining({ source: "SUBMITTED_BY_SELLER", documents: [{ name: `exhibit-${id}-evidence-packet.pdf` }] })] });
  });

  it("expires instead of filing when the brief changed after the agent asked", async () => {
    const { kit, id } = investigated("accept_claim");
    const requested = requestDisputeAction(id, "Claude Desktop");
    if (!requested.ok) throw new Error(requested.error);
    insertRun(id, makeBriefFor(kit, "accept_claim", { headline: "Re-investigated" }), { startedAt: new Date(Date.now() + 5_000).toISOString() });
    const before = footprint(id);

    const r = await approveRequest(requested.approval.id);

    expect(r).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("brief changed") });
    expect(getApproval(requested.approval.id)).toMatchObject({ status: "stale", decidedBy: "merchant" });
    expect(footprint(id)).toEqual(before);
    expect(approvalLog(requested.approval.id).at(0)).toMatch(/expired/i);
  });

  it("expires when a newer brief proposes a different action", async () => {
    const { kit, id } = investigated("accept_claim");
    const requested = requestDisputeAction(id, "Agent");
    if (!requested.ok) throw new Error(requested.error);
    insertRun(id, makeBriefFor(kit, "provide_evidence"), { startedAt: new Date(Date.now() + 5_000).toISOString() });
    const before = footprint(id);

    expect(await approveRequest(requested.approval.id)).toMatchObject({ ok: false, status: 409 });
    expect(getApproval(requested.approval.id)?.status).toBe("stale");
    expect(footprint(id)).toEqual(before);
  });

  it("expires when the stored brief is edited in place, even though it is the same run", async () => {
    const { kit, id, runId } = investigated("accept_claim");
    const requested = requestDisputeAction(id, "Agent");
    if (!requested.ok) throw new Error(requested.error);
    db().prepare("UPDATE runs SET brief = ? WHERE id = ?").run(JSON.stringify(makeBriefFor(kit, "provide_evidence")), runId);
    const before = footprint(id);

    expect(await approveRequest(requested.approval.id)).toMatchObject({ ok: false, status: 409 });
    expect(getApproval(requested.approval.id)?.status).toBe("stale");
    expect(footprint(id)).toEqual(before);
  });

  it("marks the approval failed, and changes nothing, when PayPal refuses at execution time", async () => {
    const { kit, id } = investigated("accept_claim");
    const requested = requestDisputeAction(id, "Agent");
    if (!requested.ok) throw new Error(requested.error);
    simPut({ ...kit.dispute, status: "UNDER_REVIEW", links: [] }); // PayPal moved the case on while the request waited

    const r = await approveRequest(requested.approval.id);

    expect(r).toMatchObject({ ok: false, status: 422 });
    expect(getApproval(requested.approval.id)).toMatchObject({ status: "failed", result: { ok: false, issue: "INVALID_DISPUTE_STATUS" } });
    expect(simGet(id)?.status).toBe("UNDER_REVIEW");
    expect(recordedActions(id)).toEqual([expect.objectContaining({ kind: "accept_claim", status: "error" })]);
    expect(await approveRequest(requested.approval.id)).toMatchObject({ ok: false, status: 409 }); // no retry of a failed request
  });

  it("decides each request once: a second approval, or an approval after a rejection, does nothing", async () => {
    const { id } = investigated("accept_claim");
    const a = requestDisputeAction(id, "Agent");
    if (!a.ok) throw new Error(a.error);
    expect((await approveRequest(a.approval.id)).ok).toBe(true);
    expect(await approveRequest(a.approval.id)).toMatchObject({ ok: false, status: 409, error: "This request is already approved." });
    expect(rejectRequest(a.approval.id)).toMatchObject({ ok: false, status: 409 });
    expect(recordedActions(id)).toHaveLength(1);

    const second = investigated("accept_claim", {}, 2);
    const b = requestDisputeAction(second.id, "Agent");
    if (!b.ok) throw new Error(b.error);
    expect(rejectRequest(b.approval.id, "Not today")).toMatchObject({ ok: true });
    expect(await approveRequest(b.approval.id)).toMatchObject({ ok: false, status: 409 });
    expect(simGet(second.id)?.status).toBe("WAITING_FOR_SELLER_RESPONSE");
  });

  it("runs once when the merchant double-clicks", async () => {
    const { id } = investigated("accept_claim");
    const requested = requestDisputeAction(id, "Agent");
    if (!requested.ok) throw new Error(requested.error);

    const results = await Promise.all([approveRequest(requested.approval.id), approveRequest(requested.approval.id)]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ status: 409, error: "Already executing." });
    expect(recordedActions(id)).toHaveLength(1);
  });

  it("answers 404 for an approval that does not exist", async () => {
    expect(await approveRequest("apv_nope")).toMatchObject({ ok: false, status: 404 });
    expect(rejectRequest("apv_nope")).toMatchObject({ ok: false, status: 404 });
  });
});

describe("the merchant rejects", () => {
  it("records the reason and sends nothing to PayPal", () => {
    const { id } = investigated("accept_claim");
    const requested = requestDisputeAction(id, "Agent");
    if (!requested.ok) throw new Error(requested.error);
    const before = footprint(id);

    expect(rejectRequest(requested.approval.id, "We are refunding this one by hand.").ok).toBe(true);

    expect(getApproval(requested.approval.id)).toMatchObject({ status: "rejected", decidedBy: "merchant", result: { reason: "We are refunding this one by hand." } });
    expect(footprint(id)).toEqual(before);
  });
});

describe("prevention fixes asked for by an agent", () => {
  it("queues the recommended fix and runs nothing until the merchant approves", async () => {
    const { order, outbound } = installWatchedOrder();
    const before = paypalCalls().length;

    const r = requestPreventionFix(order.id, "Claude Desktop", undefined, "Tracking is missing.");

    expect(r.ok && r.approval).toMatchObject({ kind: "prevention_fix", target: order.id, action: "push_tracking", status: "pending", runId: null, movesMoney: false, amount: null });
    expect(store.shipment(outbound!.id)?.pushed_to_paypal).toBe(false);
    expect(paypalCalls()).toHaveLength(before);
    expect(requestPreventionFix(order.id, "Other agent")).toMatchObject({ ok: true, existing: true }); // same fix, same approval

    const approved = await approveRequest(r.ok ? r.approval.id : "");
    expect(approved.ok).toBe(true);
    expect(store.shipment(outbound!.id)?.pushed_to_paypal).toBe(true);
    expect(paypalCalls().filter((c) => c.path === `/v2/checkout/orders/${order.paypal.order_id}/track`)).toHaveLength(1);
  });

  it("flags a refund as moving money, with the amount", () => {
    const { order } = installWatchedOrder({ n: 6, order: { placed_at: ago(20) }, outbound: { status: "DELIVERED", pushed_to_paypal: true, delivered_at: ago(10), signature: { name: "A", at: ago(10) } }, returned: { status: "DELIVERED", shipped_at: ago(9), delivered_at: ago(6) } });
    const r = requestPreventionFix(order.id, "Agent", "refund");
    expect(r.ok && r.approval).toMatchObject({ action: "refund", movesMoney: true, amount: order.total });
  });

  it("refuses orders that are unknown or not at risk, and fixes that do not apply", () => {
    expect(requestPreventionFix("KA-NOPE", "Agent")).toMatchObject({ ok: false, status: 404 });
    const { order } = installWatchedOrder();
    expect(requestPreventionFix(order.id, "Agent", "refund")).toMatchObject({ ok: false, status: 422 });
    const clear = installWatchedOrder({ n: 7, outbound: { pushed_to_paypal: true } });
    expect(requestPreventionFix(clear.order.id, "Agent")).toMatchObject({ ok: false, status: 409, error: expect.stringContaining("no longer at risk") });
    expect(listApprovals()).toEqual([]);
  });

  it("fails the approval, and does nothing twice, if the merchant already fixed the order", async () => {
    const { order } = installWatchedOrder();
    const r = requestPreventionFix(order.id, "Agent");
    if (!r.ok) throw new Error(r.error);
    const { runPreventionFix } = await import("@/lib/prevention");
    expect((await runPreventionFix(order.id, "push_tracking")).ok).toBe(true);
    const calls = paypalCalls().length;

    expect(await approveRequest(r.approval.id)).toMatchObject({ ok: false, status: 422 });
    expect(getApproval(r.approval.id)?.status).toBe("failed");
    expect(paypalCalls()).toHaveLength(calls);
  });
});
