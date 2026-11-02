import "server-only";
import { randomUUID } from "node:crypto";
import type { CaseBrief } from "./agent/brief";
import { caseFile, latestRun, refreshDispute } from "./disputes";
import { db, logActivity, now } from "./db";
import { markDemoProgress } from "./demo-progress";
import { resolveRef } from "./evidence";
import { paypal, PayPalError } from "./paypal/client";
import type { Evidence, Money } from "./paypal/types";
import { packetFilename, renderPacket } from "./packet/render";
import { store } from "./store/repo";
import type { Shipment } from "./store/types";

export type ActionOverrides = { letter?: string; buyerMessage?: string; amount?: number };
export type ActionResult = { ok: true; kind: string; detail: string; response: unknown } | { ok: false; kind: string; error: string; issue?: string; debugId?: string; status?: number };

const PAYPAL_CARRIER: Record<Shipment["carrier"], string> = {
  UPS: "UPS",
  USPS: "USPS",
  FEDEX: "FEDEX",
  DHL: "DHL",
  DHL_DEUTSCHE_POST: "DHL_DEUTSCHE_POST",
  ROYAL_MAIL: "ROYAL_MAIL",
};

function record(disputeId: string, kind: string, actor: string, request: unknown, response: unknown, status: "ok" | "error") {
  db()
    .prepare("INSERT INTO actions (id, dispute_id, kind, actor, request, response, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(`act_${randomUUID().slice(0, 12)}`, disputeId, kind, actor, JSON.stringify(request), JSON.stringify(response), status, now());
}

const money = (value: number, currency: string): Money => ({ currency_code: currency, value: value.toFixed(2) });

/** Demo guide: a filing a person made (directly, or by approving an agent's request). */
const filed = (actor: string) => {
  if (actor === "merchant" || actor.endsWith("approved by merchant")) markDemoProgress("file");
};

/** Carries out the brief's PayPal action. Every call goes through the PayPal REST API (or the simulator in demo mode). */
export async function executeBriefAction(disputeId: string, overrides: ActionOverrides = {}, actor = "merchant"): Promise<ActionResult> {
  const run = latestRun(disputeId);
  const brief = run?.brief as CaseBrief | null | undefined;
  if (!brief) return { ok: false, kind: "none", error: "Run Exhibit on this dispute first." };
  const d = await refreshDispute(disputeId);
  const cf = caseFile(d);
  const pp = paypal();
  const a = brief.paypal_action;
  const currency = d.dispute_amount.currency_code;
  const letter = (overrides.letter ?? brief.response_letter).slice(0, 1990);
  const buyerText = (overrides.buyerMessage ?? brief.buyer_message?.text ?? "").slice(0, 1990);
  const amount = overrides.amount ?? a.amount;
  let request: unknown;

  try {
    if (a.type === "provide_evidence" || a.type === "refund_then_prove") {
      let refundIds: string[] = cf.order?.refunds?.map((r) => r.id) ?? [];
      if (a.type === "refund_then_prove") {
        if (!cf.order) throw new Error("No order on record to refund.");
        const refundAmount = amount ?? Number(d.dispute_amount.value);
        const refundReq = { amount: money(refundAmount, currency), note_to_payer: `Refund for order ${cf.order.id}` };
        const refund = await pp.refundCapture(cf.order.paypal.capture_id, refundReq, randomUUID(), disputeId);
        record(disputeId, "refund_capture", actor, refundReq, refund, "ok");
        refundIds = [refund.id];
        store.putOrder({ ...cf.order, refunds: [...(cf.order.refunds ?? []), { id: refund.id, amount: refundAmount, at: now() }] });
        logActivity("action", `Refunded ${refundAmount.toFixed(2)} ${currency} on capture ${cf.order.paypal.capture_id} (${refund.id})`, disputeId, { actor });
      }
      // PayPal accepts the evidence types it requested; anything else (a signature, say) rides in the packet.
      const requested = (d.evidences ?? []).filter((e) => e.source === "REQUESTED_FROM_SELLER").map((e) => e.evidence_type);
      let types: string[] = a.type === "refund_then_prove" ? ["PROOF_OF_REFUND"] : (a.evidence_types ?? ["OTHER"]);
      if (requested.length) {
        const kept = types.filter((t) => requested.includes(t));
        types = kept.length ? kept : [requested.includes("OTHER") ? "OTHER" : requested[0]];
      }
      // One evidence per call: the sandbox rejects some multi-evidence payloads with a 500, and the
      // packet already carries every exhibit. Proof of fulfillment (with tracking) wins when requested.
      types = [types.includes("PROOF_OF_FULFILLMENT") ? "PROOF_OF_FULFILLMENT" : types.includes("PROOF_OF_REFUND") ? "PROOF_OF_REFUND" : types[0]];
      const itemId = d.disputed_transactions[0]?.items?.find((i) => i.item_id)?.item_id;
      const tracking = a.tracking_ref ? resolveRef(a.tracking_ref, cf) : undefined;
      const evidences: Evidence[] = types.map((t, i) => {
        const e: Evidence = { evidence_type: t, notes: i === 0 ? letter : `See the attached evidence packet (Exhibits ${brief.exhibits.map((x) => x.label).join(", ")}).` };
        if (itemId && types.length > 1) e.item_id = itemId;
        if (t === "PROOF_OF_FULFILLMENT" && tracking?.kind === "shipment") {
          e.evidence_info = { tracking_info: [{ carrier_name: PAYPAL_CARRIER[tracking.data.carrier], tracking_number: tracking.data.tracking_number }] };
        }
        if (t === "PROOF_OF_REFUND" && refundIds.length) e.evidence_info = { refund_ids: refundIds };
        return e;
      });
      const pdf = await renderPacket(caseFile(d), brief, letter);
      request = { evidences, files: [{ name: packetFilename(disputeId), bytes: pdf.byteLength }] };
      const res = await pp.provideEvidence(disputeId, evidences, [{ name: packetFilename(disputeId), contentType: "application/pdf", data: new Uint8Array(pdf) }]);
      record(disputeId, "provide_evidence", actor, request, res, "ok");
      logActivity("action", `Filed ${types.join(" + ")} with a ${brief.exhibits.length}-exhibit packet`, disputeId, { actor });
      await refreshDispute(disputeId);
      filed(actor);
      return { ok: true, kind: a.type, detail: `Evidence filed with PayPal: ${types.join(", ")} and a ${Math.round(pdf.byteLength / 1024)} KB packet.`, response: res };
    }

    if (a.type === "provide_supporting_info") {
      const pdf = await renderPacket(caseFile(d), brief, letter);
      request = { notes: letter, files: [{ name: packetFilename(disputeId), bytes: pdf.byteLength }] };
      const res = await pp.provideSupportingInfo(disputeId, letter, [{ name: packetFilename(disputeId), contentType: "application/pdf", data: new Uint8Array(pdf) }]);
      record(disputeId, "provide_supporting_info", actor, request, res, "ok");
      logActivity("action", `Sent supporting info with a ${brief.exhibits.length}-exhibit packet`, disputeId, { actor });
      await refreshDispute(disputeId);
      filed(actor);
      return { ok: true, kind: a.type, detail: `Response and a ${Math.round(pdf.byteLength / 1024)} KB evidence packet sent to PayPal's chargeback review.`, response: res };
    }

    if (a.type === "make_offer") {
      const m = store.merchant().address;
      const body: Parameters<typeof pp.makeOffer>[1] = {
        note: buyerText || letter,
        offer_type: a.offer_type ?? "REFUND",
        ...(a.offer_type !== "REPLACEMENT_WITHOUT_REFUND" && amount !== undefined ? { offer_amount: money(amount, currency) } : {}),
        ...(a.offer_type === "REFUND_WITH_RETURN"
          ? { return_shipping_address: { address_line_1: m.line1, admin_area_2: m.city, admin_area_1: m.state, postal_code: m.postal_code, country_code: m.country } }
          : {}),
      };
      request = body;
      const res = await pp.makeOffer(disputeId, body);
      record(disputeId, "make_offer", actor, body, res, "ok");
      logActivity("action", `Offered ${body.offer_type.replace(/_/g, " ").toLowerCase()}${body.offer_amount ? ` ${body.offer_amount.value} ${currency}` : ""}`, disputeId, { actor });
      await refreshDispute(disputeId);
      filed(actor);
      return { ok: true, kind: a.type, detail: `Offer sent to the buyer through PayPal.`, response: res };
    }

    if (a.type === "accept_claim") {
      const body = { note: letter, accept_claim_type: "REFUND" as const };
      request = body;
      const res = await pp.acceptClaim(disputeId, body);
      record(disputeId, "accept_claim", actor, body, res, "ok");
      logActivity("action", `Accepted the claim; PayPal refunds the buyer`, disputeId, { actor });
      await refreshDispute(disputeId);
      filed(actor);
      return { ok: true, kind: a.type, detail: "Claim accepted. PayPal processes the refund to the buyer and closes the case.", response: res };
    }

    if (a.type === "send_message") {
      if (!buyerText) throw new Error("There is no buyer message to send.");
      request = { message: buyerText };
      const res = await pp.sendMessage(disputeId, buyerText);
      record(disputeId, "send_message", actor, request, res, "ok");
      logActivity("action", `Messaged the buyer through PayPal`, disputeId, { actor });
      await refreshDispute(disputeId);
      filed(actor);
      return { ok: true, kind: a.type, detail: "Message delivered to the buyer in the PayPal Resolution Center.", response: res };
    }
    return { ok: false, kind: a.type, error: `Unsupported action ${a.type}` };
  } catch (e) {
    const err = e instanceof PayPalError ? { error: e.message, issue: e.issue, debugId: e.debugId, status: e.status } : { error: e instanceof Error ? e.message : String(e) };
    record(disputeId, a.type, actor, request ?? null, err, "error");
    logActivity("action_error", `${a.type} failed: ${err.error}`, disputeId, { ...err, actor });
    return { ok: false, kind: a.type, ...err };
  }
}

/** Sandbox controls: ask PayPal to decide a case under review, or reopen it for more evidence. */
export async function sandboxDecide(disputeId: string, outcome: "SELLER_FAVOR" | "BUYER_FAVOR") {
  const res = await paypal().adjudicate(disputeId, outcome);
  record(disputeId, "adjudicate", "sandbox", { adjudication_outcome: outcome }, res, "ok");
  logActivity("sandbox", `PayPal ruled in ${outcome === "SELLER_FAVOR" ? "the merchant's" : "the buyer's"} favour (adjudicate)`, disputeId);
  return refreshDispute(disputeId);
}

export async function sandboxRequireEvidence(disputeId: string) {
  const res = await paypal().requireEvidence(disputeId, "SELLER_EVIDENCE");
  record(disputeId, "require_evidence", "sandbox", { action: "SELLER_EVIDENCE" }, res, "ok");
  return refreshDispute(disputeId);
}

/** Pushes every shipment PayPal does not know about to the Orders v2 tracking API. */
export async function syncTrackingToPayPal(shipmentIds?: string[]) {
  const pp = paypal();
  const results: { shipment_id: string; ok: boolean; error?: string }[] = [];
  for (const sh of store.shipments().filter((s) => s.direction === "OUTBOUND" && !s.pushed_to_paypal && (!shipmentIds || shipmentIds.includes(s.id)))) {
    const order = store.order(sh.order_id);
    if (!order) continue;
    try {
      await pp.addTracking(order.paypal.order_id, { capture_id: order.paypal.capture_id, tracking_number: sh.tracking_number, carrier: PAYPAL_CARRIER[sh.carrier], notify_payer: false });
      store.putShipment({ ...sh, pushed_to_paypal: true });
      results.push({ shipment_id: sh.id, ok: true });
    } catch (e) {
      results.push({ shipment_id: sh.id, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  const ok = results.filter((r) => r.ok).length;
  if (results.length) logActivity("action", `Synced tracking for ${ok}/${results.length} shipment(s) to PayPal`, null, { actor: "merchant" });
  return results;
}
