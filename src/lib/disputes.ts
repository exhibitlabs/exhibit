import "server-only";
import { db, docGet, docList, docPut } from "./db";
import { paypal, type PayPalCapture } from "./paypal/client";
import type { Dispute } from "./paypal/types";
import { ensureSeeded } from "./seed";
import { store } from "./store/repo";
import type { CaseBrief } from "./agent/brief";

export const DISPUTE_KIND = "dispute";

/** Pulls every dispute from PayPal and caches the full detail record. */
export async function syncDisputes(): Promise<Dispute[]> {
  ensureSeeded();
  const pp = paypal();
  const list = await pp.listDisputes();
  const items = list.items ?? [];
  const out: Dispute[] = [];
  // Small concurrency window: PayPal rate-limits detail calls.
  for (let i = 0; i < items.length; i += 4) {
    const batch = await Promise.all(items.slice(i, i + 4).map((s) => pp.getDispute(s.dispute_id)));
    for (const d of batch) {
      docPut(DISPUTE_KIND, d.dispute_id, d);
      out.push(d);
    }
  }
  return out;
}

export async function refreshDispute(id: string): Promise<Dispute> {
  const d = await paypal().getDispute(id);
  docPut(DISPUTE_KIND, id, d);
  return d;
}

export function cachedDispute(id: string) {
  return docGet<Dispute>(DISPUTE_KIND, id);
}

export function cachedDisputes() {
  return docList<Dispute>(DISPUTE_KIND).sort((a, b) => b.create_time.localeCompare(a.create_time));
}

export async function disputesForInbox(): Promise<Dispute[]> {
  ensureSeeded();
  const cached = cachedDisputes();
  if (cached.length) return cached;
  return syncDisputes();
}

export type RunRow = {
  id: string;
  dispute_id: string;
  provider: string;
  model: string | null;
  status: "running" | "done" | "error";
  started_at: string;
  finished_at: string | null;
  events: string;
  brief: string | null;
  error: string | null;
};

export function latestRun(disputeId: string): (Omit<RunRow, "brief" | "events"> & { brief: CaseBrief | null; events: unknown[] }) | undefined {
  // A failed re-run must not hide the last good brief, so errored runs only show when nothing else exists.
  const row = db().prepare("SELECT * FROM runs WHERE dispute_id = ? ORDER BY (status = 'error') ASC, started_at DESC LIMIT 1").get(disputeId) as RunRow | undefined;
  if (!row) return undefined;
  return { ...row, brief: row.brief ? (JSON.parse(row.brief) as CaseBrief) : null, events: JSON.parse(row.events) as unknown[] };
}

export function latestBriefs(): Map<string, CaseBrief> {
  const rows = db()
    .prepare("SELECT r.dispute_id, r.brief FROM runs r JOIN (SELECT dispute_id, MAX(started_at) m FROM runs WHERE status = 'done' GROUP BY dispute_id) x ON x.dispute_id = r.dispute_id AND x.m = r.started_at")
    .all() as { dispute_id: string; brief: string | null }[];
  const map = new Map<string, CaseBrief>();
  for (const r of rows) if (r.brief) map.set(r.dispute_id, JSON.parse(r.brief) as CaseBrief);
  return map;
}

export type ActionRow = { id: string; dispute_id: string; kind: string; actor: string; request: unknown; response: unknown; status: string; created_at: string };

export function actionsFor(disputeId: string): ActionRow[] {
  const rows = db().prepare("SELECT * FROM actions WHERE dispute_id = ? ORDER BY created_at DESC").all(disputeId) as (Omit<ActionRow, "request" | "response"> & { request: string | null; response: string | null })[];
  return rows.map((r) => ({ ...r, request: r.request ? JSON.parse(r.request) : null, response: r.response ? JSON.parse(r.response) : null }));
}

export function allActions(): ActionRow[] {
  const rows = db().prepare("SELECT * FROM actions ORDER BY created_at DESC").all() as (Omit<ActionRow, "request" | "response"> & { request: string | null; response: string | null })[];
  return rows.map((r) => ({ ...r, request: r.request ? JSON.parse(r.request) : null, response: r.response ? JSON.parse(r.response) : null }));
}

/** Everything the case page shows about one dispute, joined across PayPal and the store. */
export function caseFile(d: Dispute) {
  const order = store.orderForDispute(d);
  const shipments = order ? store.shipmentsFor(order.id) : [];
  return {
    dispute: d,
    order,
    shipments,
    customer: order ? store.customer(order.customer_email) : undefined,
    conversation: order ? store.conversation(order.id) : undefined,
    risk: order ? store.risk(order.id) : undefined,
    scenario: store.scenario(d.dispute_id),
    // PayPal's own Seller Protection flag for the payment, cached when the agent fetches the capture.
    capture: order ? docGet<PayPalCapture>("capture", order.paypal.capture_id) : undefined,
    products: order ? order.items.map((i) => store.product(i.sku)).filter(Boolean) : [],
  };
}

export type CaseFile = ReturnType<typeof caseFile>;
