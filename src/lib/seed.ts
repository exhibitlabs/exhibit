import "server-only";
import { randomUUID } from "node:crypto";
import { appUrl, paypalMode } from "./config";
import { docDeleteKind, kvGet, kvSet, logActivity, now, resetDatabase } from "./db";
import { paypal, PayPalError } from "./paypal/client";
import { linksFor, simGet, simPut } from "./paypal/simulator";
import type { Dispute } from "./paypal/types";
import { seedResolvedHistory } from "./store/history";
import { store } from "./store/repo";
import { buildHistory, buildRecentOrders, buildScenarios, MERCHANT, type ScenarioRecords } from "./store/scenarios";
import { seedPreventionScenarios } from "./store/prevention-scenarios";

function putScenarioStore(s: ScenarioRecords, disputeId: string) {
  store.putOrder(s.order);
  for (const sh of s.shipments) store.putShipment(sh);
  store.putCustomer(s.customer);
  store.putConversation(s.conversation);
  store.putRisk(s.risk);
  store.putScenario({ dispute_id: disputeId, key: s.key, title: s.title, order_id: s.order.id, expectedOutcome: s.expectedOutcome });
}

/** Resets the demo merchant: simulator disputes, store records, 90-day history and recent orders. */
export function seedDemo() {
  resetDatabase();
  const base = new Date();
  for (const s of buildScenarios(base)) {
    const d: Dispute = { ...s.dispute };
    d.links = linksFor(d);
    simPut(d);
    putScenarioStore(s, d.dispute_id);
  }
  for (const h of buildHistory(base)) store.putHistory(h);
  for (const { order, shipment } of buildRecentOrders(base)) {
    store.putOrder(order);
    store.putShipment(shipment);
  }
  seedPreventionScenarios(base);
  kvSet("seeded_at", base.toISOString());
  seedResolvedHistory(base);
  logActivity("system", `Demo merchant ${MERCHANT.name} seeded with ${buildScenarios(base).length} open disputes`);
}

export function ensureSeeded() {
  if (paypalMode() !== "demo") return;
  if (!kvGet<string | null>("seeded_at", null)) seedDemo();
}

/** Demo only: a new dispute "arrives" — the same path a CUSTOMER.DISPUTE.CREATED webhook takes. */
export function simulateIncomingDispute(): Dispute | undefined {
  const base = new Date();
  const template = buildScenarios(base).find((s) => s.key === "inr-delivered-signed");
  if (!template) return undefined;
  const n = 50300 + Math.floor(Math.random() * 600);
  const id = `PP-D-${n}`;
  const orderNo = String(10600 + (n % 300));
  const s: ScenarioRecords = structuredClone(template);
  s.order.id = `KA-${orderNo}`;
  s.order.paypal.invoice_id = s.order.id;
  s.order.paypal.capture_id = `${randomUUID().replace(/-/g, "").slice(0, 17).toUpperCase()}`;
  s.order.shipment_ids = [`SHP-${orderNo}`];
  s.shipments = s.shipments.map((sh) => ({ ...sh, id: `SHP-${orderNo}`, order_id: s.order.id }));
  s.conversation.order_id = s.order.id;
  s.risk.order_id = s.order.id;
  s.customer.order_ids = [s.order.id, ...s.customer.order_ids.slice(1)];
  const d: Dispute = {
    ...s.dispute,
    dispute_id: id,
    create_time: base.toISOString(),
    update_time: base.toISOString(),
    disputed_transactions: s.dispute.disputed_transactions.map((t) => ({ ...t, seller_transaction_id: s.order.paypal.capture_id, invoice_number: s.order.id })),
  };
  d.links = linksFor(d);
  if (simGet(id)) return simulateIncomingDispute();
  simPut(d);
  putScenarioStore({ ...s, dispute: d }, id);
  logActivity("webhook", `CUSTOMER.DISPUTE.CREATED ${id}`, id);
  return d;
}

// ---- Sandbox seeding -------------------------------------------------------------------------
//
// PayPal's sandbox needs a real, captured transaction before a dispute can exist. Business
// accounts with advanced card processing capture a card order in one call; other accounts need a
// buyer to approve a PayPal checkout first. Either way the transaction then gets a chargeback from
// the sandbox-only process-chargeback endpoint, and the matching store records are written so the
// agent investigates it exactly like a demo case.

export type SandboxSeed = {
  key: string;
  title: string;
  buyer: string;
  amount: string;
  order_id: string;
  approve_url?: string;
  status: "awaiting_buyer" | "disputed" | "error";
  capture_id?: string;
  dispute_id?: string;
  error?: string;
  created_at: string;
};

const SEEDS_KV = "sandbox_seeds";

export function sandboxSeeds(): SandboxSeed[] {
  return kvGet<SandboxSeed[]>(SEEDS_KV, []);
}

function saveSeeds(list: SandboxSeed[]) {
  kvSet(SEEDS_KV, list);
}

function scenarioFor(key: string) {
  const s = buildScenarios(new Date()).find((x) => x.key === key);
  if (!s) throw new Error(`Unknown scenario ${key}`);
  return s;
}

function purchaseUnit(s: ScenarioRecords) {
  const amount = s.order.total.toFixed(2);
  const sa = s.order.shipping_address;
  return {
    reference_id: s.order.id,
    invoice_id: `${s.order.id}-${Date.now().toString(36).slice(-5)}`,
    custom_id: s.key,
    description: s.order.items[0].name,
    amount: { currency_code: "USD", value: amount, breakdown: { item_total: { currency_code: "USD", value: amount } } },
    items: s.order.items.map((i) => ({ name: i.name, sku: i.sku, quantity: String(i.qty), unit_amount: { currency_code: "USD", value: (s.order.total / i.qty).toFixed(2) }, category: "PHYSICAL_GOODS" })),
    shipping: {
      name: { full_name: sa.name },
      address: { address_line_1: sa.line1, address_line_2: sa.line2, admin_area_2: sa.city, admin_area_1: sa.state, postal_code: sa.postal_code, country_code: sa.country },
    },
  };
}

async function openChargeback(s: ScenarioRecords, captureId: string, merchantId: string | undefined, amount: string) {
  const at = new Date();
  const due = new Date(at.getTime() + 10 * 86400_000);
  const cb = await paypal().processChargeback({
    adjacency: "PAYPAL",
    file_layout: "ATCK_CB",
    merchant_id: merchantId,
    financial_institution: { processor: "FDMS" },
    transaction: { id_enc: captureId, amount: { currency_code: "USD", value: amount } },
    instrument: { instrument_type: "CARD", card_brand: "VISA", credit_card_transaction_id: String(Date.now()).slice(-16).padStart(16, "4"), external: false },
    dispute: {
      id: null,
      stage: "CHARGEBACK",
      response_date: due.toISOString(),
      status: "2",
      amount: { currency_code: "USD", value: amount },
      receive_date: at.toISOString(),
      event_code: "CHARGEBACK_INITIATED",
      money_movement_date: at.toISOString(),
      event_type: "DEBIT",
      chargeback_type: "REPORTED_TO_PROCESSOR",
      processor_info: { reference_number: String(Date.now()).padEnd(23, "7"), reason_code: s.chargebackReasonCode, notes: `exhibit-seed:${s.key}` },
    },
  });
  return cb.dispute_id;
}

/** Writes the scenario's store records under the real PayPal ids, so the agent can join them. */
function adoptIntoStore(key: string, ids: { order_id: string; capture_id: string; invoice_id: string }, payer: { email?: string }, disputeId: string) {
  const s = scenarioFor(key);
  s.order.paypal = { ...ids, funding: "CARD" };
  if (payer.email) {
    s.customer.email = payer.email;
    s.order.customer_email = payer.email;
  }
  putScenarioStore(s, disputeId);
  logActivity("seed", `Sandbox chargeback ${disputeId} opened on capture ${ids.capture_id} (${key})`, disputeId);
}

/** Step 1: one real PayPal order per scenario. Card orders capture at once; otherwise the buyer approves a checkout. */
export async function startSandboxSeeds(keys?: string[]): Promise<SandboxSeed[]> {
  if (paypalMode() !== "sandbox") throw new Error("Sandbox seeding needs PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.");
  const pp = paypal();
  const seeds = sandboxSeeds();
  let cardEnabled = true;
  for (const s of buildScenarios(new Date()).filter((x) => !keys || keys.includes(x.key))) {
    const base = { key: s.key, title: s.title, buyer: s.customer.name, amount: s.order.total.toFixed(2), created_at: now() };
    try {
      if (cardEnabled) {
        try {
          // A Visa test card from developer.paypal.com/tools/sandbox/card-testing (any future expiry, any CVV).
          const sa = s.order.shipping_address;
          const order = await pp.createOrder(
            {
              intent: "CAPTURE",
              purchase_units: [purchaseUnit(s)],
              payment_source: { card: { number: "4012000033330026", expiry: "2030-12", security_code: "123", name: s.customer.name, billing_address: { address_line_1: sa.line1, admin_area_2: sa.city, admin_area_1: sa.state, postal_code: sa.postal_code, country_code: sa.country } } },
            },
            randomUUID(),
          );
          const done = order.status === "COMPLETED" ? order : await pp.captureOrder(order.id, randomUUID());
          const pu = done.purchase_units?.[0];
          const capture = pu?.payments?.captures?.[0];
          if (!capture) throw new Error(`Order ${order.id} has no capture (${done.status}).`);
          const disputeId = await openChargeback(s, capture.id, pu?.payee?.merchant_id, base.amount);
          adoptIntoStore(s.key, { order_id: order.id, capture_id: capture.id, invoice_id: pu?.invoice_id ?? s.order.id }, {}, disputeId);
          seeds.push({ ...base, order_id: order.id, status: "disputed", capture_id: capture.id, dispute_id: disputeId });
          continue;
        } catch (e) {
          if (!(e instanceof PayPalError && e.issue === "PAYEE_NOT_ENABLED_FOR_CARD_PROCESSING")) throw e;
          cardEnabled = false;
        }
      }
      const order = await pp.createOrder(
        {
          intent: "CAPTURE",
          purchase_units: [purchaseUnit(s)],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: MERCHANT.name,
                shipping_preference: "SET_PROVIDED_ADDRESS",
                user_action: "PAY_NOW",
                landing_page: "GUEST_CHECKOUT",
                return_url: `${appUrl()}/app/settings?seed=approved`,
                cancel_url: `${appUrl()}/app/settings?seed=cancelled`,
              },
            },
          },
        },
        randomUUID(),
      );
      const approve = (order as { links?: { rel: string; href: string }[] }).links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
      seeds.push({ ...base, order_id: order.id, approve_url: approve, status: "awaiting_buyer" });
    } catch (e) {
      seeds.push({ ...base, order_id: "", status: "error", error: e instanceof Error ? e.message : String(e) });
    }
  }
  saveSeeds(seeds);
  return seeds;
}

/** Step 2: capture every checkout the buyer approved and open its chargeback. */
export async function finalizeSandboxSeeds(): Promise<SandboxSeed[]> {
  const pp = paypal();
  const seeds = sandboxSeeds();
  for (const seed of seeds) {
    if (seed.status !== "awaiting_buyer" || !seed.order_id) continue;
    try {
      let order = await pp.getOrder(seed.order_id);
      if (order.status === "APPROVED") order = await pp.captureOrder(seed.order_id, randomUUID());
      if (order.status !== "COMPLETED") continue;
      const pu = order.purchase_units?.[0];
      const capture = pu?.payments?.captures?.[0];
      if (!capture) continue;
      const s = scenarioFor(seed.key);
      const disputeId = seed.dispute_id ?? (await openChargeback(s, capture.id, pu?.payee?.merchant_id, seed.amount));
      const payer = (order as { payer?: { email_address?: string } }).payer;
      adoptIntoStore(seed.key, { order_id: seed.order_id, capture_id: capture.id, invoice_id: pu?.invoice_id ?? s.order.id }, { email: payer?.email_address }, disputeId);
      Object.assign(seed, { status: "disputed", capture_id: capture.id, dispute_id: disputeId, error: undefined });
    } catch (e) {
      seed.error = e instanceof Error ? e.message : String(e);
    }
  }
  saveSeeds(seeds);
  return seeds;
}

/** Registers an order created outside Exhibit (for example by hand in the sandbox) as a seed. */
export function adoptSandboxOrder(key: string, orderId: string, disputeId?: string) {
  const s = scenarioFor(key);
  const seeds = sandboxSeeds().filter((x) => x.order_id !== orderId);
  seeds.push({ key, title: s.title, buyer: s.customer.name, amount: s.order.total.toFixed(2), order_id: orderId, status: "awaiting_buyer", dispute_id: disputeId, created_at: now() });
  saveSeeds(seeds);
}

export function clearDisputeCache() {
  docDeleteKind("dispute");
}
