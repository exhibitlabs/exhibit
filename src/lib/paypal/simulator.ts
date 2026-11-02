import "server-only";
// A faithful stand-in for the PayPal REST endpoints Exhibit uses, so the product runs end to end
// with no credentials. Request and response shapes follow the Disputes v1 / Orders v2 specs, and
// the PayPalClient talks to it through the same fetch() code path it uses for the real sandbox.

import { randomUUID } from "node:crypto";
import { docGet, docList, docPut, now } from "../db";
import type { Dispute, DisputeStatus, Evidence, Link } from "./types";
import { EVIDENCE_TYPES } from "./types";

const BASE = "https://api-m.sandbox.paypal.com";
const ALLOWED_FILE_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/gif"];
const MAX_FILE = 10 * 1024 * 1024;
const MAX_CALL = 50 * 1024 * 1024;

export const SIM_KIND = "sim_dispute";

export function simGet(id: string) {
  return docGet<Dispute>(SIM_KIND, id);
}

export function simPut(d: Dispute) {
  docPut(SIM_KIND, d.dispute_id, d);
}

function disputeState(status: DisputeStatus) {
  switch (status) {
    case "WAITING_FOR_SELLER_RESPONSE":
      return "REQUIRED_ACTION";
    case "WAITING_FOR_BUYER_RESPONSE":
      return "REQUIRED_OTHER_PARTY_ACTION";
    case "UNDER_REVIEW":
      return "UNDER_PAYPAL_REVIEW";
    case "RESOLVED":
      return "RESOLVED";
    default:
      return "OPEN_INQUIRIES";
  }
}

export function linksFor(d: Dispute): Link[] {
  const self = `${BASE}/v1/customer/disputes/${d.dispute_id}`;
  const links: Link[] = [{ href: self, rel: "self", method: "GET" }];
  const add = (rel: string, path: string) => links.push({ href: `${self}/${path}`, rel, method: "POST" });
  if (d.status === "WAITING_FOR_SELLER_RESPONSE") {
    add("provide_evidence", "provide-evidence");
    add("accept_claim", "accept-claim");
    if (d.dispute_life_cycle_stage === "INQUIRY") {
      add("make_offer", "make-offer");
      add("send_message", "send-message");
    }
  }
  if (d.status === "UNDER_REVIEW") {
    if (d.dispute_life_cycle_stage !== "INQUIRY") add("provide_supporting_info", "provide-supporting-info");
    add("adjudicate", "adjudicate");
    add("require_evidence", "require-evidence");
  }
  if (d.status === "WAITING_FOR_BUYER_RESPONSE" && d.dispute_life_cycle_stage === "INQUIRY") add("send_message", "send-message");
  return links;
}

function json(status: number, body: unknown, debugId = randomUUID().slice(0, 13).replace(/-/g, "")) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "paypal-debug-id": debugId },
  });
}

function error(status: number, name: string, message: string, issue: string, description: string) {
  const debug_id = randomUUID().slice(0, 13).replace(/-/g, "");
  return json(status, { name, message, debug_id, details: [{ issue, description }], links: [] }, debug_id);
}

function notFound(id: string) {
  return error(404, "RESOURCE_NOT_FOUND", "The specified resource does not exist.", "INVALID_RESOURCE_ID", `Dispute ${id} was not found.`);
}

function wrongStatus(d: Dispute, action: string) {
  return error(422, "UNPROCESSABLE_ENTITY", "The requested action could not be performed.", "INVALID_DISPUTE_STATUS", `Cannot ${action} while dispute status is ${d.status}.`);
}

function touch(d: Dispute, patch: Partial<Dispute>) {
  const next = { ...d, ...patch, update_time: now() };
  next.links = linksFor(next);
  simPut(next);
  return next;
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  const type = req.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const input = form.get("input");
    if (!input) return {};
    const text = typeof input === "string" ? input : await input.text();
    return JSON.parse(text);
  }
  const text = await req.text();
  return text ? JSON.parse(text) : {};
}

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  if (path === "/v1/oauth2/token" && method === "POST") {
    return json(200, { scope: "https://uri.paypal.com/services/disputes/read-seller https://uri.paypal.com/services/disputes/update-seller", access_token: `SIM.${randomUUID()}`, token_type: "Bearer", app_id: "APP-EXHIBITSIM", expires_in: 32400, nonce: randomUUID() });
  }
  if (!req.headers.get("authorization")?.startsWith("Bearer ")) {
    return error(401, "AUTHENTICATION_FAILURE", "Authentication failed due to invalid authentication credentials or a missing Authorization header.", "INVALID_TOKEN", "Missing bearer token.");
  }

  if (path === "/v1/customer/disputes" && method === "GET") {
    const items = docList<Dispute>(SIM_KIND)
      .sort((a, b) => b.create_time.localeCompare(a.create_time))
      .map((d) => ({
        dispute_id: d.dispute_id,
        create_time: d.create_time,
        update_time: d.update_time,
        reason: d.reason,
        status: d.status,
        dispute_state: disputeState(d.status),
        dispute_amount: d.dispute_amount,
        dispute_life_cycle_stage: d.dispute_life_cycle_stage,
        dispute_channel: d.dispute_channel,
        seller_response_due_date: d.seller_response_due_date,
        links: [{ href: `${BASE}/v1/customer/disputes/${d.dispute_id}`, rel: "self", method: "GET" }],
      }));
    return json(200, { items, links: [{ href: `${BASE}/v1/customer/disputes`, rel: "self", method: "GET" }] });
  }

  const m = path.match(/^\/v1\/customer\/disputes\/([^/]+)(?:\/([a-z-]+))?$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const action = m[2];
    const d = simGet(id);
    if (!d) return notFound(id);

    if (!action && method === "GET") return json(200, { ...d, links: linksFor(d) });

    if (action === "provide-evidence" && method === "POST") {
      if (d.status !== "WAITING_FOR_SELLER_RESPONSE") return wrongStatus(d, "provide evidence");
      const form = await req.formData();
      const inputPart = form.get("input");
      if (!inputPart) return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "MISSING_REQUIRED_PARAMETER", "The `input` part with evidences is required.");
      const input = JSON.parse(typeof inputPart === "string" ? inputPart : await inputPart.text()) as { evidences?: Evidence[] };
      const evidences = input.evidences ?? [];
      if (!evidences.length) return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "MISSING_REQUIRED_PARAMETER", "At least one evidence is required.");
      for (const e of evidences) {
        if (!(EVIDENCE_TYPES as readonly string[]).includes(e.evidence_type))
          return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "INVALID_EVIDENCE_TYPE", `Unsupported evidence_type ${e.evidence_type}.`);
        if (e.notes && e.notes.length > 2000) return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "INVALID_STRING_LENGTH", "notes must be 2000 characters or fewer.");
      }
      if (evidences.length > 1 && d.disputed_transactions[0]?.items?.some((i) => i.item_id) && evidences.some((e) => !e.item_id))
        return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "ITEM_ID_IS_MANDATORY_FOR_MULTIPLE_EVIDENCES", "item_id is required on each evidence when more than one is provided.");
      const requested = (d.evidences ?? []).filter((e) => e.source === "REQUESTED_FROM_SELLER").map((e) => e.evidence_type);
      const unrequested = evidences.find((e) => requested.length && !requested.includes(e.evidence_type));
      if (unrequested) return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "INVALID_EVIDENCE_TYPE", `${unrequested.evidence_type} was not requested for this dispute.`);
      const files = form.getAll("evidence-file").filter((f): f is File => typeof f !== "string");
      let total = 0;
      for (const f of files) {
        total += f.size;
        if (!ALLOWED_FILE_TYPES.includes(f.type)) return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "INVALID_FILE_TYPE", `${f.name}: only PDF, PNG, JPEG and GIF are accepted.`);
        if (f.size > MAX_FILE) return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "FILE_SIZE_LIMIT_EXCEEDED", `${f.name} is larger than 10 MB.`);
      }
      if (total > MAX_CALL) return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "FILE_SIZE_LIMIT_EXCEEDED", "Files exceed 50 MB per call.");
      const submitted: Evidence[] = evidences.map((e) => ({ ...e, source: "SUBMITTED_BY_SELLER", date: now(), documents: files.map((f) => ({ name: f.name })) }));
      const kept = (d.evidences ?? []).filter((e) => e.source !== "REQUESTED_FROM_SELLER");
      touch(d, { status: "UNDER_REVIEW", evidences: [...kept, ...submitted] });
      return json(200, { links: [{ href: `${BASE}/v1/customer/disputes/${id}`, rel: "self", method: "GET" }] });
    }

    // PayPal: when the action's HATEOAS link is not on the dispute, the action is not available.
    if (action === "provide-supporting-info" && method === "POST") {
      if (!linksFor(d).some((l) => l.rel === "provide_supporting_info")) return wrongStatus(d, "provide supporting info");
      const form = await req.formData();
      const inputPart = form.get("input");
      const input = inputPart ? (JSON.parse(typeof inputPart === "string" ? inputPart : await inputPart.text()) as { notes?: string }) : {};
      if (!input.notes) return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "MISSING_REQUIRED_PARAMETER", "notes is required.");
      if (input.notes.length > 2000) return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "INVALID_STRING_LENGTH", "notes must be 2000 characters or fewer.");
      const files = form.getAll("supporting-document").filter((f): f is File => typeof f !== "string");
      const prior = (d as Dispute & { supporting_info?: unknown[] }).supporting_info ?? [];
      touch(d, { supporting_info: [...prior, { notes: input.notes, source: "SUBMITTED_BY_SELLER", provided_time: now(), documents: files.map((f) => ({ name: f.name })) }] } as Partial<Dispute>);
      return json(200, { links: [{ href: `${BASE}/v1/customer/disputes/${id}`, rel: "self", method: "GET" }] });
    }

    if (action === "make-offer" && method === "POST") {
      if (d.dispute_life_cycle_stage !== "INQUIRY" || d.status !== "WAITING_FOR_SELLER_RESPONSE") return wrongStatus(d, "make an offer");
      const body = (await readJson(req)) as { note?: string; offer_amount?: { currency_code: string; value: string }; offer_type?: string };
      const types = d.allowed_response_options?.make_offer?.offer_types;
      if (types && body.offer_type && !types.includes(body.offer_type as never))
        return error(422, "UNPROCESSABLE_ENTITY", "The requested action could not be performed.", "INVALID_OFFER_TYPE", `offer_type must be one of ${types.join(", ")}.`);
      if (!body.note) return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "MISSING_REQUIRED_PARAMETER", "note is required.");
      touch(d, {
        status: "WAITING_FOR_BUYER_RESPONSE",
        offer: { ...d.offer, seller_offered_amount: body.offer_amount, offer_type: body.offer_type as never },
        messages: [...(d.messages ?? []), { posted_by: "SELLER", time_posted: now(), content: body.note }],
      });
      return json(200, { links: [{ href: `${BASE}/v1/customer/disputes/${id}`, rel: "self", method: "GET" }] });
    }

    if (action === "accept-claim" && method === "POST") {
      if (d.status !== "WAITING_FOR_SELLER_RESPONSE") return wrongStatus(d, "accept the claim");
      const body = (await readJson(req)) as { note?: string; refund_amount?: { currency_code: string; value: string } };
      touch(d, {
        status: "RESOLVED",
        dispute_outcome: { outcome_code: "RESOLVED_BUYER_FAVOUR", amount_refunded: body.refund_amount ?? d.dispute_amount },
        messages: body.note ? [...(d.messages ?? []), { posted_by: "SELLER", time_posted: now(), content: body.note }] : d.messages,
      });
      return json(200, { links: [{ href: `${BASE}/v1/customer/disputes/${id}`, rel: "self", method: "GET" }] });
    }

    if (action === "send-message" && method === "POST") {
      if (!linksFor(d).some((l) => l.rel === "send_message")) return wrongStatus(d, "send a message");
      const body = (await readJson(req)) as { message?: string };
      if (!body.message) return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "MISSING_REQUIRED_PARAMETER", "message is required.");
      touch(d, { messages: [...(d.messages ?? []), { posted_by: "SELLER", time_posted: now(), content: body.message }] });
      return json(200, { links: [{ href: `${BASE}/v1/customer/disputes/${id}`, rel: "self", method: "GET" }] });
    }

    if (action === "adjudicate" && method === "POST") {
      if (d.status !== "UNDER_REVIEW") return wrongStatus(d, "adjudicate");
      const body = (await readJson(req)) as { adjudication_outcome?: "BUYER_FAVOR" | "SELLER_FAVOR" };
      const seller = body.adjudication_outcome === "SELLER_FAVOR";
      touch(d, {
        status: "RESOLVED",
        dispute_outcome: seller ? { outcome_code: "RESOLVED_SELLER_FAVOUR" } : { outcome_code: "RESOLVED_BUYER_FAVOUR", amount_refunded: d.dispute_amount },
      });
      return json(200, { links: [{ href: `${BASE}/v1/customer/disputes/${id}`, rel: "self", method: "GET" }] });
    }

    if (action === "require-evidence" && method === "POST") {
      if (d.status !== "UNDER_REVIEW") return wrongStatus(d, "require evidence");
      const body = (await readJson(req)) as { action?: string };
      touch(d, { status: body.action === "BUYER_EVIDENCE" ? "WAITING_FOR_BUYER_RESPONSE" : "WAITING_FOR_SELLER_RESPONSE" });
      return json(200, { links: [{ href: `${BASE}/v1/customer/disputes/${id}`, rel: "self", method: "GET" }] });
    }

    // Buyer side of an offer. Real sandbox needs buyer credentials; the simulator lets the demo show it.
    if (action === "accept-offer" && method === "POST") {
      if (d.status !== "WAITING_FOR_BUYER_RESPONSE") return wrongStatus(d, "accept the offer");
      touch(d, { status: "RESOLVED", dispute_outcome: { outcome_code: "RESOLVED_WITH_PAYOUT", amount_refunded: d.offer?.seller_offered_amount } });
      return json(200, { links: [] });
    }

    return error(405, "METHOD_NOT_SUPPORTED", "The server does not implement the requested HTTP method.", "METHOD_NOT_SUPPORTED", `${method} ${path}`);
  }

  if (path === "/v2/customer-support/process-chargeback" && method === "POST") {
    // New disputes are minted by the seed module, which owns the scenario templates.
    const body = (await readJson(req)) as { dispute_id?: string };
    if (body.dispute_id && simGet(body.dispute_id)) return json(201, { dispute_id: body.dispute_id });
    return error(422, "UNPROCESSABLE_ENTITY", "The requested action could not be performed.", "TRANSACTION_NOT_FOUND", "No captured transaction matches transaction.id_enc.");
  }

  const track = path.match(/^\/v2\/checkout\/orders\/([^/]+)\/track$/);
  if (track && method === "POST") {
    const body = (await readJson(req)) as { capture_id?: string; tracking_number?: string; carrier?: string };
    if (!body.capture_id || !body.tracking_number || !body.carrier)
      return error(400, "INVALID_REQUEST", "Request is not well-formed, syntactically incorrect, or violates schema.", "MISSING_REQUIRED_PARAMETER", "capture_id, tracking_number and carrier are required.");
    return json(201, { id: track[1], status: "COMPLETED", purchase_units: [{ shipping: { trackers: [{ id: `${body.capture_id}-${body.tracking_number}`, status: "SHIPPED", create_time: now() }] } }] });
  }

  const cap = path.match(/^\/v2\/payments\/captures\/([^/]+)$/);
  if (cap && method === "GET") {
    // Demo payments are PayPal-funded and shipped to the transaction address, so PayPal would mark them eligible.
    return json(200, { id: cap[1], status: "COMPLETED", seller_protection: { status: "ELIGIBLE", dispute_categories: ["ITEM_NOT_RECEIVED", "UNAUTHORIZED_TRANSACTION"] } });
  }

  const refund = path.match(/^\/v2\/payments\/captures\/([^/]+)\/refund$/);
  if (refund && method === "POST") {
    const body = (await readJson(req)) as { amount?: { currency_code: string; value: string } };
    return json(201, { id: `RF${randomUUID().replace(/-/g, "").slice(0, 15).toUpperCase()}`, status: "COMPLETED", amount: body.amount });
  }

  if (path === "/v1/notifications/verify-webhook-signature" && method === "POST") return json(200, { verification_status: "SUCCESS" });

  return error(404, "NOT_FOUND", "The specified resource does not exist.", "INVALID_URI", `${method} ${path} is not simulated.`);
}

/** Drop-in fetch for PayPalClient in demo mode. */
export const simulatorFetch: typeof fetch = async (input, init) => {
  const req = input instanceof Request ? input : new Request(input, init);
  // Small, realistic latency so the UI's API log reads like the real thing.
  await new Promise((r) => setTimeout(r, 60 + Math.random() * 140));
  try {
    return await handle(req);
  } catch (e) {
    return error(500, "INTERNAL_SERVER_ERROR", "An internal server error occurred.", "INTERNAL_SERVICE_ERROR", e instanceof Error ? e.message : String(e));
  }
};
