// Guarantee: only the merchant's own browser session, on Exhibit's own origin, can decide an
// approval. The routes an agent can reach only create or read requests.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as listApprovals, POST as createApproval } from "@/app/api/approvals/route";
import { GET as readApproval, POST as decideApproval } from "@/app/api/approvals/[id]/route";
import { getApproval, requestDisputeAction } from "@/lib/approvals";
import { simGet } from "@/lib/paypal/simulator";
import { footprint, installCase, installWatchedOrder, insertRun, makeBriefFor, resetState } from "./support/fixtures";
import { instantTimers } from "./support/timers";

beforeEach(() => {
  instantTimers();
  resetState();
});
afterEach(() => vi.restoreAllMocks());

const APP = "http://localhost:3101";
const json = (path: string, method: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`${APP}${path}`, { method, headers: { "content-type": "application/json", host: "localhost:3101", ...headers }, body: JSON.stringify(body) });
const decide = (id: string, body: unknown, headers?: Record<string, string>) => decideApproval(json(`/api/approvals/${id}`, "POST", body, headers), { params: Promise.resolve({ id }) });

function pending() {
  const kit = installCase();
  insertRun(kit.dispute.dispute_id, makeBriefFor(kit, "accept_claim"));
  const r = requestDisputeAction(kit.dispute.dispute_id, "Claude Desktop");
  if (!r.ok) throw new Error(r.error);
  return { id: r.approval.id, disputeId: kit.dispute.dispute_id };
}

describe("who can decide", () => {
  // [description, headers, may decide]
  const WHO: [string, Record<string, string>, boolean][] = [
    ["no browser headers at all (a script, curl, an agent)", {}, false],
    ["another site's page", { origin: "https://evil.example" }, false],
    ["another site that spoofs nothing but Sec-Fetch-Site", { "sec-fetch-site": "cross-site" }, false],
    ["a sibling subdomain", { "sec-fetch-site": "same-site" }, false],
    ["an opaque origin (sandboxed iframe, redirect)", { origin: "null" }, false],
    ["an origin that only shares a prefix with Exhibit's host", { origin: "http://localhost:31010" }, false],
    ["a forwarded request for another host", { origin: "https://exhibit.example", "x-forwarded-host": "evil.example" }, false],
    ["the browser on Exhibit's own origin (Origin header)", { origin: APP }, true],
    ["the browser on Exhibit's own origin (Sec-Fetch-Site)", { "sec-fetch-site": "same-origin" }, true],
    ["the browser behind a proxy that forwards the host", { origin: "https://exhibit.example", "x-forwarded-host": "exhibit.example", host: "internal:3000" }, true],
  ];

  it.each(WHO)("%s", async (_who, headers, allowed) => {
    const { id, disputeId } = pending();
    const before = footprint(disputeId);

    const res = await decide(id, { decision: "approve" }, headers).catch(() => null);

    if (allowed) {
      expect(res?.status).toBe(200);
      expect(getApproval(id)?.status).toBe("approved");
      expect(simGet(disputeId)?.status).toBe("RESOLVED");
    } else {
      // A refusal, or an error before anything ran: either way the request stays pending and nothing is filed.
      expect([403, undefined, 500]).toContain(res?.status);
      expect(getApproval(id)?.status).toBe("pending");
      expect(footprint(disputeId)).toEqual(before);
    }
  });

  it("answers a refusal with a plain 403, never a stack trace", async () => {
    const { id } = pending();
    const res = await decide(id, { decision: "approve" });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Approvals are decided by the merchant in the Exhibit app." });
  });

  it("rejects when the merchant says reject, and sends nothing", async () => {
    const { id, disputeId } = pending();
    const before = footprint(disputeId);
    const res = await decide(id, { decision: "reject", reason: "Not this one" }, { origin: APP });
    expect(res.status).toBe(200);
    expect(getApproval(id)).toMatchObject({ status: "rejected", result: { reason: "Not this one" } });
    expect(footprint(disputeId)).toEqual(before);
  });

  it("does nothing for a decision it does not understand", async () => {
    const { id, disputeId } = pending();
    const before = footprint(disputeId);
    for (const body of [{ decision: "maybe" }, { decision: "APPROVE" }, {}, { approve: true }]) {
      const res = await decide(id, body, { origin: APP });
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(getApproval(id)?.status).toBe("pending");
    expect(footprint(disputeId)).toEqual(before);
  });

  it("tells the caller when a request was already decided", async () => {
    const { id } = pending();
    expect((await decide(id, { decision: "approve" }, { origin: APP })).status).toBe(200);
    const again = await decide(id, { decision: "approve" }, { origin: APP });
    expect(again.status).toBe(409);
    expect(await again.json()).toMatchObject({ error: "This request is already approved." });
    expect((await decide("apv_nope", { decision: "approve" }, { origin: APP })).status).toBe(404);
  });
});

describe("what an agent can reach", () => {
  it("lets it ask: a new request is 201 and a repeat is 200 with the same approval", async () => {
    const kit = installCase();
    insertRun(kit.dispute.dispute_id, makeBriefFor(kit, "accept_claim"));
    const ask = () => createApproval(json("/api/approvals", "POST", { kind: "dispute_action", disputeId: kit.dispute.dispute_id, client: "  Cursor  " }));

    const first = await ask();
    const second = await ask();

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    const [a, b] = [await first.json(), await second.json()];
    expect(b.approval.id).toBe(a.approval.id);
    expect(a.approval).toMatchObject({ status: "pending", client: "Cursor" });
    expect(a.reviewPath).toBe(`/app/disputes/${kit.dispute.dispute_id}?approval=${a.approval.id}`);
    expect(simGet(kit.dispute.dispute_id)?.status).toBe("WAITING_FOR_SELLER_RESPONSE");
  });

  it("names an anonymous agent, and cuts a long name down", async () => {
    const kit = installCase();
    insertRun(kit.dispute.dispute_id, makeBriefFor(kit, "accept_claim"));
    const r = await createApproval(json("/api/approvals", "POST", { kind: "dispute_action", disputeId: kit.dispute.dispute_id, client: "x".repeat(200) }));
    expect((await r.json()).approval.client).toHaveLength(60);
    resetState();
    const kit2 = installCase();
    insertRun(kit2.dispute.dispute_id, makeBriefFor(kit2, "accept_claim"));
    expect((await (await createApproval(json("/api/approvals", "POST", { kind: "dispute_action", disputeId: kit2.dispute.dispute_id }))).json()).approval.client).toBe("An AI agent");
  });

  it("asks for a prevention fix by order id", async () => {
    const { order } = installWatchedOrder();
    const res = await createApproval(json("/api/approvals", "POST", { kind: "prevention_fix", orderId: order.id, client: "Claude Code" }));
    expect(res.status).toBe(201);
    expect((await res.json()).approval).toMatchObject({ kind: "prevention_fix", target: order.id, action: "push_tracking", status: "pending" });
  });

  it("refuses anything that is not one of the two request kinds, and unknown cases", async () => {
    for (const body of [{}, { kind: "approve" }, { kind: "dispute_action" }, { kind: "execute", disputeId: "PP-D-1" }, { kind: "prevention_fix" }]) {
      expect((await createApproval(json("/api/approvals", "POST", body))).status, JSON.stringify(body)).toBe(400);
    }
    expect((await createApproval(json("/api/approvals", "POST", { kind: "dispute_action", disputeId: "PP-D-NOPE" }))).status).toBe(404);
  });

  it("lets it read requests, filtered, with where the merchant reviews each", async () => {
    const { id, disputeId } = pending();
    const all = await (await listApprovals(new Request(`${APP}/api/approvals?status=pending&target=${disputeId}`))).json();
    expect(all.approvals).toEqual([expect.objectContaining({ id, reviewPath: `/app/disputes/${disputeId}?approval=${id}` })]);
    expect((await (await listApprovals(new Request(`${APP}/api/approvals?status=approved`))).json()).approvals).toEqual([]);
    const one = await readApproval(new Request(`${APP}/api/approvals/${id}`), { params: Promise.resolve({ id }) });
    expect((await one.json()).approval).toMatchObject({ id, status: "pending" });
    expect((await readApproval(new Request(`${APP}/api/approvals/apv_nope`), { params: Promise.resolve({ id: "apv_nope" }) })).status).toBe(404);
  });
});
