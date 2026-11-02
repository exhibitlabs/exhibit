// Guarantee: the model can choose and explain evidence, but it cannot invent it. A brief may only
// cite refs that resolve to a real record on this case, and the packet re-reads those records.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { executeTool, validateBrief } from "@/lib/agent/tools";
import { caseFile } from "@/lib/disputes";
import { refs, resolveRef } from "@/lib/evidence";
import { store } from "@/lib/store/repo";
import { caseFileOf, installCase, makeBrief, makeDispute, resetState, toolContext, type CaseKit } from "./support/fixtures";
import { instantTimers } from "./support/timers";

let kit: CaseKit;
beforeEach(() => {
  instantTimers();
  resetState();
  kit = installCase();
});
afterEach(() => vi.restoreAllMocks());

describe("resolveRef", () => {
  it("resolves each kind of ref to the stored source record, not a copy the model wrote", () => {
    const cf = caseFileOf(kit);
    const id = kit.dispute.dispute_id;
    const sku = kit.order.items[0].sku;
    const message = kit.conversation.messages[0];
    const table: [string, string][] = [
      [refs.dispute(id), "dispute"],
      [refs.protection(id), "protection"],
      [refs.paypalMessage(id, 0), "paypal_message"],
      [refs.order(kit.order.id), "order"],
      [refs.listing(sku), "listing"],
      [refs.shipment(kit.shipments[0].id), "shipment"],
      [refs.customer(kit.customer.email), "customer"],
      [refs.message(message.id), "message"],
      [refs.conversation(kit.order.id), "conversation"],
      [refs.risk(kit.order.id), "risk"],
      [refs.policy(store.policies()[0].id), "policy"],
    ];
    for (const [ref, kind] of table) expect(resolveRef(ref, cf)?.kind, ref).toBe(kind);

    expect(resolveRef(refs.order(kit.order.id), cf)?.data).toEqual(store.order(kit.order.id));
    expect(resolveRef(refs.shipment(kit.shipments[0].id), cf)?.data).toEqual(store.shipment(kit.shipments[0].id));
    expect(resolveRef(refs.message(message.id), cf)?.data).toEqual(message);
  });

  it("rejects refs that point at nothing on this case", () => {
    const cf = caseFileOf(kit);
    const id = kit.dispute.dispute_id;
    const otherSku = store.products().find((p) => p.sku !== kit.order.items[0].sku)!.sku;
    const bad = [
      "shipment:SHP-DOES-NOT-EXIST",
      "order:KA-OTHER",
      "customer:someone@else.example",
      "msg:MSG-NOPE",
      "conversation:KA-OTHER",
      "risk:KA-OTHER",
      "listing:NOT-A-SKU",
      `listing:${otherSku}`, // a real product, but not one this order contains
      "policy:refund-everything",
      "paypal:dispute:PP-D-OTHER",
      "paypal:seller-protection:PP-D-OTHER",
      "paypal:message:PP-D-OTHER:0",
      `paypal:message:${id}:7`,
      `paypal:message:${id}:-1`,
      `paypal:message:${id}:first`,
      `paypal:refund:${id}`,
      `ORDER:${kit.order.id}`, // namespaces are exact
      "https://evil.example/exhibit",
      "unknown:thing",
      "order",
      ":",
      "",
    ];
    for (const ref of bad) expect(resolveRef(ref, cf), JSON.stringify(ref)).toBeUndefined();
  });

  it("does not let one dispute cite another dispute's records", () => {
    const second = installCase({ n: 2 });
    const cf = caseFileOf(kit);
    expect(resolveRef(refs.shipment(second.shipments[0].id), cf)).toBeUndefined();
    expect(resolveRef(refs.order(second.order.id), cf)).toBeUndefined();
    expect(resolveRef(refs.customer(second.customer.email), cf)).toBeUndefined();
    expect(resolveRef(refs.dispute(second.dispute.dispute_id), cf)).toBeUndefined();
  });

  it("cannot cite store records when the dispute matches no order", () => {
    const orphan = makeDispute({ disputed_transactions: [{ seller_transaction_id: "NO-SUCH-CAPTURE", invoice_number: "NO-SUCH-INVOICE" }] }, 3);
    const cf = caseFile(orphan);
    expect(cf.order).toBeUndefined();
    expect(resolveRef(refs.order(kit.order.id), cf)).toBeUndefined();
    expect(resolveRef(refs.shipment(kit.shipments[0].id), cf)).toBeUndefined();
    expect(resolveRef(refs.dispute(orphan.dispute_id), cf)?.kind).toBe("dispute");
  });
});

describe("validateBrief: citations", () => {
  it("accepts a brief whose every ref resolves", () => {
    expect(validateBrief(makeBrief(kit), caseFileOf(kit))).toEqual([]);
  });

  it("rejects an exhibit that cites a record that does not exist, and names the exhibit", () => {
    const brief = makeBrief(kit);
    brief.exhibits[0].ref = "shipment:SHP-INVENTED";
    const problems = validateBrief(brief, caseFileOf(kit));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("Exhibit A");
    expect(problems[0]).toContain("shipment:SHP-INVENTED");
  });

  it("rejects reasoning that cites a record that does not exist", () => {
    const brief = makeBrief(kit);
    brief.reasoning[1].refs.push("msg:MSG-INVENTED");
    expect(validateBrief(brief, caseFileOf(kit)).join("\n")).toContain("msg:MSG-INVENTED");
  });

  it("rejects a real record that belongs to a different dispute", () => {
    const second = installCase({ n: 2 });
    const brief = makeBrief(kit);
    brief.exhibits[1].ref = refs.shipment(second.shipments[0].id);
    expect(validateBrief(brief, caseFileOf(kit))).toEqual([expect.stringContaining(second.shipments[0].id)]);
  });

  it("reports every bad ref at once, so the model can fix them in one pass", () => {
    const brief = makeBrief(kit);
    brief.exhibits[0].ref = "shipment:NOPE-1";
    brief.exhibits[1].ref = "order:NOPE-2";
    brief.reasoning[0].refs = ["risk:NOPE-3"];
    expect(validateBrief(brief, caseFileOf(kit))).toHaveLength(3);
  });

  it("rejects duplicate exhibit letters", () => {
    const brief = makeBrief(kit);
    brief.exhibits[1].label = "A";
    expect(validateBrief(brief, caseFileOf(kit))).toContain("exhibit labels must be unique");
  });

  it("requires proof of fulfillment to point at a shipment, because the tracking number is copied from it", () => {
    const cf = caseFileOf(kit);
    const withTracking = (tracking_ref?: string) => {
      const brief = makeBrief(kit);
      brief.paypal_action = { type: "provide_evidence", evidence_types: ["PROOF_OF_FULFILLMENT"], tracking_ref };
      return validateBrief(brief, cf);
    };
    expect(withTracking(refs.shipment(kit.shipments[0].id))).toEqual([]);
    expect(withTracking(undefined)).toEqual([expect.stringContaining("PROOF_OF_FULFILLMENT needs tracking_ref")]);
    expect(withTracking(refs.order(kit.order.id))).toEqual([expect.stringContaining("PROOF_OF_FULFILLMENT needs tracking_ref")]);
    expect(withTracking("shipment:SHP-INVENTED")).toEqual([expect.stringContaining("PROOF_OF_FULFILLMENT needs tracking_ref")]);

    const other = makeBrief(kit);
    other.paypal_action = { type: "provide_evidence", evidence_types: ["ITEM_DESCRIPTION"] };
    expect(validateBrief(other, cf)).toEqual([]);
  });
});

describe("file_case_brief", () => {
  async function agentOnCase() {
    const run = toolContext(kit.dispute.dispute_id);
    await executeTool("get_paypal_dispute", { dispute_id: kit.dispute.dispute_id }, run.ctx);
    return run;
  }

  it("bounces a brief with an invented ref back to the model and files nothing", async () => {
    const { ctx, events } = await agentOnCase();
    const brief = makeBrief(kit);
    brief.exhibits[0].ref = "shipment:SHP-INVENTED";

    const result = await executeTool("file_case_brief", brief, ctx);

    expect(ctx.brief).toBeUndefined();
    expect(result.isError).toBe(false); // a normal result the model can act on, not a crash
    const reply = JSON.parse(result.text);
    expect(reply).toMatchObject({ ok: false, rejected: true });
    expect(reply.problems[0]).toContain("shipment:SHP-INVENTED");
    expect(reply.allowed_actions).toContain("provide_evidence");
    expect(events.findLast((e) => e.t === "tool_result")).toMatchObject({ name: "file_case_brief", ok: false });
  });

  it("files the brief once the model fixes the ref", async () => {
    const { ctx } = await agentOnCase();
    const bad = makeBrief(kit);
    bad.exhibits[0].ref = "shipment:SHP-INVENTED";
    await executeTool("file_case_brief", bad, ctx);
    expect(ctx.brief).toBeUndefined();

    const good = makeBrief(kit);
    const result = await executeTool("file_case_brief", good, ctx);
    expect(JSON.parse(result.text)).toEqual({ ok: true });
    expect(ctx.brief).toEqual(good);
  });

  it("refuses to run any tool before the dispute has been fetched from PayPal", async () => {
    const { ctx } = toolContext(kit.dispute.dispute_id);
    const result = await executeTool("lookup_order", { transaction_id: kit.order.paypal.capture_id }, ctx);
    expect(result.isError).toBe(true);
    expect(result.text).toContain("get_paypal_dispute");
  });
});

describe("refs returned by the investigation tools", () => {
  it("all resolve, so a model that cites only what tools returned can never be rejected for citing", async () => {
    const id = kit.dispute.dispute_id;
    const { ctx } = toolContext(id);
    const calls: [string, unknown][] = [
      ["get_paypal_dispute", { dispute_id: id }],
      ["lookup_order", { transaction_id: kit.order.paypal.capture_id }],
      ["get_carrier_tracking", { order_id: kit.order.id }],
      ["get_customer_history", { email: kit.customer.email }],
      ["get_support_conversation", { order_id: kit.order.id }],
      ["get_payment_risk_signals", { order_id: kit.order.id }],
      ["get_store_policies", {}],
      ["check_seller_protection", { dispute_id: id }],
    ];
    const found = new Set<string>();
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) {
          if ((k === "ref" || k === "listing_ref") && typeof x === "string") found.add(x);
          else walk(x);
        }
      }
    };
    for (const [name, input] of calls) {
      const r = await executeTool(name, input, ctx);
      expect(r.isError, `${name}: ${r.text.slice(0, 200)}`).toBe(false);
      walk(JSON.parse(r.text));
    }

    expect(found.size).toBeGreaterThanOrEqual(8);
    const cf = caseFile(ctx.dispute!);
    for (const ref of found) expect(resolveRef(ref, cf), ref).toBeDefined();
  });
});
