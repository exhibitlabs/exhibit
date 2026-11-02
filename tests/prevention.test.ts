// Guarantee: the Prevention radar scores recent orders from documented signals, and a fix that
// really addresses the signal takes the order off the radar (and only then counts as saved).
// Time is frozen so "4 days without a scan" and "24 hours unanswered" are exact.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PayPalClient, PayPalError } from "@/lib/paypal/client";
import { DISPUTE_FEE, draftPreventionMessage, preventionOrder, preventionReport, runPreventionFix, SIGNALS, type PreventionSignalKind } from "@/lib/prevention";
import { kvSet } from "@/lib/db";
import { store } from "@/lib/store/repo";
import type { Shipment } from "@/lib/store/types";
import { ADDRESS, ago, installCase, installWatchedOrder, makeMessage, makeShipment, paypalCalls, resetState } from "./support/fixtures";
import { instantTimers } from "./support/timers";

const NOW = new Date("2026-11-03T12:00:00.000Z");
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  instantTimers();
  resetState();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

let n = 10;
type Watch = Parameters<typeof installWatchedOrder>[0];
/** Installs an order that has no dispute. Unless overridden it is quiet: shipped, moving, tracking on PayPal. */
const watch = (o: Watch = {}) => installWatchedOrder({ n: ++n, ...o, outbound: o?.outbound === null ? null : { pushed_to_paypal: true, ...o?.outbound } }).order.id;
const kinds = (id: string): PreventionSignalKind[] => preventionOrder(id)!.signals.map((s) => s.kind);
const scanned = (shippedDaysAgo: number, lastScanDaysAgo: number, over: Partial<Shipment> = {}): Partial<Shipment> => ({
  status: "IN_TRANSIT",
  shipped_at: ago(shippedDaysAgo),
  events: [
    { at: ago(shippedDaysAgo), location: "Brooklyn, NY", description: "Picked up", code: "PICKUP" },
    { at: ago(lastScanDaysAgo), location: "Chicago, IL", description: "Departed facility", code: "TRANSIT" },
  ],
  ...over,
});
const delivered = (daysAgo: number, over: Partial<Shipment> = {}): Partial<Shipment> => ({
  status: "DELIVERED",
  shipped_at: ago(daysAgo + 3),
  delivered_at: ago(daysAgo),
  events: [
    { at: ago(daysAgo + 3), location: "Brooklyn, NY", description: "Picked up", code: "PICKUP" },
    { at: ago(daysAgo), location: "Portland, OR", description: "Delivered", code: "DELIVERED" },
  ],
  ...over,
});
const customerSays = (body: string, hoursAgo: number, language = "en") => [makeMessage({ from: "customer", at: new Date(NOW.getTime() - hoursAgo * 3600_000).toISOString(), body, language })];

describe("what the radar watches", () => {
  it("is every recent order that has no dispute, quiet ones included only if there is money still at stake", () => {
    const risky = watch({ outbound: { pushed_to_paypal: false } });
    const quiet = watch();
    const report = preventionReport();
    expect(report.atRisk.map((o) => o.orderId)).toEqual([risky]);
    expect(report.orders.map((o) => o.orderId).sort()).toEqual([quiet, risky].sort());
    expect(report.totals).toMatchObject({ watched: 2, atRisk: 1 });
  });

  it("skips orders older than 45 days", () => {
    const old = watch({ order: { placed_at: ago(46) }, outbound: { pushed_to_paypal: false } });
    expect(preventionReport().orders.map((o) => o.orderId)).not.toContain(old);
  });

  it("skips an order once it is a dispute: that is the agent's job, not the radar's", () => {
    const disputed = installCase({ n: 3, shipments: [makeShipment({ pushed_to_paypal: false, order_id: "KA-90003" }, 3)] });
    const same = watch({ outbound: { pushed_to_paypal: false } });
    expect(preventionOrder(disputed.order.id)).toBeUndefined();
    expect(preventionReport().orders.map((o) => o.orderId)).toEqual([same]);
  });
});

describe("signals fire as documented", () => {
  it("documents all seven, each tied to the PayPal dispute reason it tends to cause", () => {
    expect(Object.keys(SIGNALS).sort()).toEqual(["address_mismatch", "buyer_waiting", "refund_overdue", "tracking_not_on_paypal", "tracking_stalled", "unsigned_high_value", "weak_checkout"]);
    expect(SIGNALS.refund_overdue.reason).toBe("CREDIT_NOT_PROCESSED");
    expect(SIGNALS.weak_checkout.reason).toBe("UNAUTHORISED");
    expect(SIGNALS.tracking_not_on_paypal.reason).toBe("MERCHANDISE_OR_SERVICE_NOT_RECEIVED");
  });

  it("tracking_not_on_paypal: shipped, but PayPal has never seen the tracking number", () => {
    const moving = watch({ outbound: scanned(2, 1, { pushed_to_paypal: false }) });
    const done = watch({ outbound: delivered(1, { pushed_to_paypal: false }) });
    const sent = watch({ outbound: scanned(2, 1) });
    const unshipped = watch({ outbound: null });
    expect(preventionOrder(moving)!.signals[0]).toMatchObject({ kind: "tracking_not_on_paypal", weight: 40, fixes: ["push_tracking"] });
    expect(preventionOrder(done)!.signals[0]).toMatchObject({ kind: "tracking_not_on_paypal", weight: 30 });
    expect(kinds(sent)).toEqual([]);
    expect(kinds(unshipped)).toEqual([]);
  });

  it("tracking_stalled: no scan for 4+ days, a delivery exception, or past the promised date", () => {
    expect(kinds(watch({ outbound: scanned(5, 3.9) }))).toEqual([]);
    expect(kinds(watch({ outbound: scanned(6, 4) }))).toEqual(["tracking_stalled"]);
    expect(kinds(watch({ outbound: scanned(3, 1, { status: "EXCEPTION" }) }))).toEqual(["tracking_stalled"]);
    expect(kinds(watch({ outbound: scanned(8, 1) }))).toEqual(["tracking_stalled"]); // US parcels are promised within 7 days of shipping
    expect(kinds(watch({ outbound: scanned(6, 5, { status: "DELIVERED", delivered_at: ago(5) }) }))).not.toContain("tracking_stalled");
    expect(preventionOrder(watch({ outbound: scanned(6, 4) }))!.signals[0]).toMatchObject({ reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED", fixes: ["message_buyer"] });
  });

  it("unsigned_high_value: delivered over the signature threshold without a signature", () => {
    const threshold = preventionReport().rules.signatureThreshold;
    expect(threshold).toBe(250); // the shipping policy: "Orders over $250 ship with signature confirmation"
    const total = (t: number) => ({ order: { total: t, subtotal: t } });
    expect(kinds(watch({ ...total(threshold + 1), outbound: delivered(1, { signature: undefined }) }))).toEqual(["unsigned_high_value"]);
    expect(kinds(watch({ ...total(threshold), outbound: delivered(1, { signature: undefined }) }))).toEqual([]);
    expect(kinds(watch({ ...total(threshold + 1), outbound: delivered(1, { signature: { name: "A. Buyer", at: ago(1) } }) }))).toEqual([]);
  });

  it("unsigned_high_value: stops offering the store-rule fix once the rule is on", () => {
    const id = watch({ order: { total: 400, subtotal: 400 }, outbound: delivered(1, { signature: undefined }) });
    expect(preventionOrder(id)!.fixes.map((f) => f.action)).toContain("require_signature");
    kvSet("prevention_rules", { signatureThreshold: 250, enforced: true });
    expect(preventionOrder(id)!.fixes.map((f) => f.action)).not.toContain("require_signature");
  });

  it("address_mismatch: delivered somewhere other than the PayPal transaction address", () => {
    const elsewhere = { ...ADDRESS, line1: "99 Other Road", postal_code: "97209" };
    expect(preventionOrder(watch({ outbound: delivered(1, { delivered_to: elsewhere }) }))!.signals[0]).toMatchObject({ kind: "address_mismatch", weight: 45 });
    const sameButFormatted = { ...ADDRESS, line1: "  12 quay street ", postal_code: "97 201" };
    expect(kinds(watch({ outbound: delivered(1, { delivered_to: sameButFormatted }) }))).toEqual([]);
  });

  it("refund_overdue: the return arrived and no refund went out within 3 days", () => {
    const returned = (daysAgo: number) => ({ status: "DELIVERED" as const, shipped_at: ago(daysAgo + 3), delivered_at: ago(daysAgo) });
    const base = { order: { placed_at: ago(20), shipping_cost: 10, total: 152, subtotal: 142 }, outbound: delivered(10) };
    expect(kinds(watch({ ...base, returned: returned(2.9) }))).toEqual([]);
    expect(preventionOrder(watch({ ...base, returned: returned(3) }))!.signals[0]).toMatchObject({ kind: "refund_overdue", reason: "CREDIT_NOT_PROCESSED", weight: 60, fixes: ["refund"] });
    expect(preventionOrder(watch({ ...base, returned: returned(8) }))!.signals[0].weight).toBe(80); // waiting longer is worse
    const refunded = { ...base.order, refunds: [{ id: "RF1", amount: 142, at: ago(1) }] }; // everything but shipping
    expect(kinds(watch({ ...base, order: refunded, returned: returned(8) }))).toEqual([]);
  });

  it("buyer_waiting: a message unanswered for 24 hours, or one that mentions a dispute or a missing order", () => {
    expect(kinds(watch({ messages: customerSays("Thanks, lovely packaging.", 23) }))).toEqual([]);
    expect(kinds(watch({ messages: customerSays("Any update on my order?", 24) }))).toEqual(["buyer_waiting"]);
    expect(kinds(watch({ messages: customerSays("I will file a PayPal claim if I do not hear back.", 1) }))).toEqual(["buyer_waiting"]);
    expect(kinds(watch({ messages: customerSays("Where is my order? Nothing at my door.", 1) }))).toEqual(["buyer_waiting"]);
    expect(kinds(watch({ messages: customerSays("Ich werde den Käuferschutz einschalten.", 2, "de") }))).toEqual(["buyer_waiting"]);
    const answered = [...customerSays("Where is my order?", 30), makeMessage({ from: "merchant", at: ago(0.5), body: "It ships today." })];
    expect(kinds(watch({ messages: answered }))).toEqual([]);
    expect(preventionOrder(watch({ messages: customerSays("I will dispute this charge", 1) }))!.signals[0].weight).toBe(65); // 20 base + 45 for the threat
  });

  it("weak_checkout: a high-value first order with at least two checkout red flags", () => {
    const first = { order: { total: 320, subtotal: 320 }, customer: { order_ids: ["KA-ONLY"] } };
    const flags = { avs_result: "N" as const, cvv_result: "N" as const };
    expect(preventionOrder(watch({ ...first, outbound: null, risk: flags }))!.signals[0]).toMatchObject({ kind: "weak_checkout", reason: "UNAUTHORISED", weight: 39, fixes: ["hold_and_verify", "refund"] });
    expect(kinds(watch({ ...first, outbound: null, risk: { avs_result: "N" } }))).toEqual([]); // one flag is not enough
    expect(kinds(watch({ ...first, order: { total: 199, subtotal: 199 }, outbound: null, risk: flags }))).toEqual([]); // below $200
    expect(kinds(watch({ ...first, customer: { order_ids: ["KA-ONLY", "KA-EARLIER"] }, outbound: null, risk: flags }))).toEqual([]); // a returning buyer
  });
});

describe("scoring", () => {
  it("combines signals as independent chances: 1 - (1 - a)(1 - b), banded at 15, 40 and 65", () => {
    const lone = watch({ outbound: scanned(2, 1, { pushed_to_paypal: false }) }); // 40
    const both = watch({ outbound: scanned(3, 1, { pushed_to_paypal: false, status: "EXCEPTION" }) }); // 40 and an exception at 55
    expect(preventionOrder(lone)).toMatchObject({ score: 40, band: "elevated" });
    expect(preventionOrder(both)).toMatchObject({ score: 73, band: "high" });
    expect(preventionOrder(watch({ outbound: delivered(1, { pushed_to_paypal: false }) }))).toMatchObject({ score: 30, band: "watch" });
    const elsewhere = { ...ADDRESS, line1: "99 Other Road", postal_code: "97209" };
    expect(preventionOrder(watch({ outbound: delivered(1, { pushed_to_paypal: false, delivered_to: elsewhere }) }))).toMatchObject({ score: 62, band: "elevated" }); // 30 and 45
    expect(preventionOrder(watch({ order: { total: 400, subtotal: 400 }, outbound: delivered(1, { signature: undefined, delivered_to: elsewhere }) }))).toMatchObject({ score: 67, band: "high" }); // 40 and 45
    expect(preventionOrder(watch({ outbound: scanned(2, 1) }))).toMatchObject({ score: 0, band: "clear", status: "clear", signals: [], fixes: [] });
  });

  it("ranks the order's top signal first, and the fix that leaves proof on PayPal ahead of a message", () => {
    const id = watch({ outbound: scanned(3, 1, { pushed_to_paypal: false, status: "EXCEPTION" }) });
    const o = preventionOrder(id)!;
    expect(o.top?.kind).toBe("tracking_stalled");
    expect(o.fixes.map((f) => f.action)).toEqual(["push_tracking", "message_buyer", "dismiss"]);
    expect(o.fixes.filter((f) => f.primary).map((f) => f.action)).toEqual(["push_tracking"]);
  });

  it("prices the exposure as the order plus PayPal's dispute fee, less anything already refunded", () => {
    expect(DISPUTE_FEE).toMatchObject({ PAYPAL: 15, CARD: 20 });
    const paypal = watch({ outbound: { pushed_to_paypal: false } });
    const card = watch({ order: { paypal: { order_id: "PPO", capture_id: "CAP-CARD", invoice_id: "INV", funding: "CARD" } }, outbound: { pushed_to_paypal: false } });
    const partlyRefunded = watch({ order: { refunds: [{ id: "RF1", amount: 40, at: ago(1) }] }, outbound: { pushed_to_paypal: false } });
    expect(preventionOrder(paypal)).toMatchObject({ fee: 15, exposure: 157 });
    expect(preventionOrder(card)).toMatchObject({ fee: 20, exposure: 162 });
    expect(preventionOrder(partlyRefunded)).toMatchObject({ exposure: 117 });
  });

  it("totals the radar: orders at risk, exposure, and the disputes expected if nothing changes", () => {
    watch({ outbound: scanned(2, 1, { pushed_to_paypal: false }) }); // 40
    watch({ outbound: delivered(1, { pushed_to_paypal: false }) }); // 30
    watch(); // quiet
    const { totals, bySignal } = preventionReport();
    expect(totals).toMatchObject({ watched: 3, atRisk: 2, exposure: 314, expectedDisputes: 0.7, elevated: 1, watch: 1, high: 0, prevented: 0, saved: 0 });
    expect(bySignal).toEqual([expect.objectContaining({ kind: "tracking_not_on_paypal", count: 2, exposure: 314 })]);
  });
});

describe("a fix takes the order off the radar", () => {
  it("push_tracking: PayPal gets the tracking number, the order is prevented, and the saving is counted", async () => {
    const id = watch({ outbound: scanned(2, 1, { pushed_to_paypal: false }) });

    const r = await runPreventionFix(id, "push_tracking", { actor: "merchant" });

    expect(r).toMatchObject({ ok: true, prevented: true, saved: 157 });
    expect(r.ok && r.order).toMatchObject({ status: "prevented", score: 0, signals: [] });
    expect(store.shipmentsFor(id)[0].pushed_to_paypal).toBe(true);
    expect(paypalCalls().filter((c) => c.method === "POST" && c.path.endsWith("/track"))).toHaveLength(1);
    const report = preventionReport();
    expect(report.atRisk).toEqual([]);
    expect(report.resolved.map((o) => o.orderId)).toEqual([id]);
    expect(report.totals).toMatchObject({ atRisk: 0, prevented: 1, saved: 157, feesAvoided: 15 });
  });

  it("does the same fix only once: it no longer applies", async () => {
    const id = watch({ outbound: scanned(2, 1, { pushed_to_paypal: false }) });
    await runPreventionFix(id, "push_tracking");
    const calls = paypalCalls().length;
    expect(await runPreventionFix(id, "push_tracking")).toMatchObject({ ok: false, error: expect.stringContaining("does not apply") });
    expect(paypalCalls()).toHaveLength(calls);
  });

  it("message_buyer: writes to the buyer in their language, and the unanswered message stops counting", async () => {
    const german = { ...ADDRESS, name: "Jonas Weber", line1: "Torstrasse 1", city: "Berlin", postal_code: "10115", country: "DE" };
    const id = watch({ order: { shipping_address: german }, outbound: scanned(6, 4), messages: customerSays("Wo ist meine Bestellung? Sonst Käuferschutz.", 30, "de") });
    expect(preventionOrder(id)!.language).toBe("de");
    expect(kinds(id).sort()).toEqual(["buyer_waiting", "tracking_stalled"]);

    const r = await runPreventionFix(id, "message_buyer");

    expect(r).toMatchObject({ ok: true, prevented: true });
    const sent = store.conversation(id)!.messages.at(-1)!;
    expect(sent).toMatchObject({ from: "merchant", language: "de" });
    expect(sent.body.length).toBeGreaterThan(40);
    expect(r.ok && r.record.message).toMatchObject({ language: "de", body: sent.body });
  });

  it("message_buyer: says which language the draft is really in when there is no template in the buyer's", () => {
    // Italian has no templates, so the draft is English and says so rather than claiming to be Italian.
    const italian = { ...ADDRESS, name: "Giulia Conti", line1: "Via Torino 21", city: "Milano", state: undefined, postal_code: "20123", country: "IT" };
    const id = watch({ order: { shipping_address: italian }, outbound: scanned(2, 1), messages: customerSays("Dov'è il mio ordine?", 30, "it") });
    const draft = draftPreventionMessage(id)!;
    expect(preventionOrder(id)!.language).toBe("it");
    expect(draft).toMatchObject({ language: "en", languageName: "English" });
    expect(draft.translation).toBeUndefined();
    // German and French cover every situation: a moving parcel and a stalled one both get a German draft, with an English copy for the merchant.
    const german = { ...ADDRESS, name: "Jonas Weber", line1: "Torstrasse 1", city: "Berlin", postal_code: "10115", country: "DE" };
    for (const outbound of [scanned(2, 1), scanned(6, 4)]) {
      const de = watch({ order: { shipping_address: german }, outbound, messages: customerSays("Wo ist meine Bestellung?", 30, "de") });
      expect(draftPreventionMessage(de)).toMatchObject({ language: "de", languageName: "German", translation: { subject: expect.any(String), body: expect.any(String) } });
    }
  });

  it("message_buyer: sends the merchant's own wording when they edited the draft", async () => {
    const id = watch({ messages: customerSays("Where is my order?", 30) });
    await runPreventionFix(id, "message_buyer", { message: { subject: "Your parcel", body: "It is on its way, Ada." } });
    expect(store.conversation(id)!.messages.at(-1)).toMatchObject({ subject: "Your parcel", body: "It is on its way, Ada." });
  });

  it("refund: refunds what the returns policy owes (not the shipping), through PayPal, and saves the dispute fee", async () => {
    const id = watch({ order: { placed_at: ago(20), shipping_cost: 10, total: 152, subtotal: 142 }, outbound: delivered(10), returned: { status: "DELIVERED", shipped_at: ago(11), delivered_at: ago(5) } });
    expect(kinds(id)).toEqual(["refund_overdue"]);

    const r = await runPreventionFix(id, "refund");

    expect(r).toMatchObject({ ok: true, prevented: true, saved: 15 });
    expect(store.order(id)!.refunds).toEqual([expect.objectContaining({ amount: 142 })]);
    expect(paypalCalls().filter((c) => c.method === "POST" && c.path.endsWith("/refund"))).toHaveLength(1);
    expect(await runPreventionFix(id, "refund")).toMatchObject({ ok: false });
  });

  it("hold_and_verify: holds an unshipped risky order and asks the buyer to confirm", async () => {
    const id = watch({ order: { total: 320, subtotal: 320 }, customer: { order_ids: ["KA-ONLY"] }, outbound: null, risk: { avs_result: "N", cvv_result: "N" } });
    const r = await runPreventionFix(id, "hold_and_verify");
    expect(r).toMatchObject({ ok: true, prevented: true });
    expect(r.ok && r.order).toMatchObject({ hold: true, status: "prevented" });
    expect(store.conversation(id)!.messages.at(-1)).toMatchObject({ from: "merchant" });
  });

  it("dismiss: takes it off the radar without claiming a saving, until something new happens", async () => {
    const id = watch({ outbound: scanned(2, 1, { pushed_to_paypal: false }) });
    const r = await runPreventionFix(id, "dismiss");
    expect(r).toMatchObject({ ok: true, prevented: false, saved: 0 });
    expect(preventionOrder(id)).toMatchObject({ status: "dismissed", signals: [] });
    expect(preventionReport().totals).toMatchObject({ prevented: 0, saved: 0 });

    vi.setSystemTime(new Date(NOW.getTime() + 3600_000));
    store.putConversation({ order_id: id, messages: [makeMessage({ from: "customer", at: new Date(NOW.getTime() + 1800_000).toISOString(), body: "I will open a dispute." })] });
    expect(kinds(id)).toEqual(["buyer_waiting"]); // only the new signal; the dismissed one stays dismissed
  });

  it("a fix that fixes only one of two signals leaves the order at risk, and counts the saving once, at the end", async () => {
    const id = watch({ outbound: scanned(2, 1, { pushed_to_paypal: false }), messages: customerSays("I will dispute this charge.", 2) });
    expect(kinds(id).sort()).toEqual(["buyer_waiting", "tracking_not_on_paypal"]);

    const first = await runPreventionFix(id, "push_tracking");
    expect(first).toMatchObject({ ok: true, prevented: false, saved: 0 });
    expect(kinds(id)).toEqual(["buyer_waiting"]);
    expect(preventionReport().totals).toMatchObject({ atRisk: 1, prevented: 0, saved: 0 });

    const second = await runPreventionFix(id, "message_buyer");
    expect(second).toMatchObject({ ok: true, prevented: true, saved: 157 });
    expect(preventionReport().totals).toMatchObject({ atRisk: 0, prevented: 1, saved: 157 });
  });

  it("a fix PayPal rejects leaves the order at risk, and is recorded as a failure", async () => {
    const id = watch({ outbound: scanned(2, 1, { pushed_to_paypal: false }) });
    vi.spyOn(PayPalClient.prototype, "addTracking").mockRejectedValue(new PayPalError(422, { name: "UNPROCESSABLE_ENTITY", message: "Tracking could not be added.", details: [{ issue: "INVALID_CAPTURE" }] }, "POST", "/v2/checkout/orders/x/track"));

    const r = await runPreventionFix(id, "push_tracking");

    expect(r.ok).toBe(false);
    expect(store.shipmentsFor(id)[0].pushed_to_paypal).toBe(false);
    expect(preventionOrder(id)).toMatchObject({ status: "at_risk", history: [expect.objectContaining({ ok: false, action: "push_tracking" })] });
    expect(preventionReport().totals).toMatchObject({ prevented: 0, saved: 0 });
  });

  it("refuses an unknown order and an order that is already a dispute", async () => {
    expect(await runPreventionFix("KA-NOPE", "dismiss")).toMatchObject({ ok: false });
    const disputed = installCase({ n: 4 });
    expect(await runPreventionFix(disputed.order.id, "dismiss")).toMatchObject({ ok: false, error: expect.stringContaining("already disputed") });
  });
});
