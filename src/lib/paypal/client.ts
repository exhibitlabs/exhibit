import "server-only";
import { PAYPAL_BASE_URL, paypalCredentials, paypalMode } from "../config";
import { logApiCall } from "../db";
import { fitForLog, redact, SHOWN_HEADERS } from "./redact";
import { simulatorFetch } from "./simulator";
import type { AcceptClaimType, Dispute, DisputeSummary, Evidence, Money, OfferType, PayPalErrorBody } from "./types";

export class PayPalError extends Error {
  constructor(
    readonly status: number,
    readonly body: PayPalErrorBody,
    readonly method: string,
    readonly path: string,
  ) {
    super(body.message ?? body.error_description ?? `PayPal ${method} ${path} failed with ${status}`);
    this.name = "PayPalError";
  }
  get debugId() {
    return this.body.debug_id;
  }
  get issue() {
    return this.body.details?.[0]?.issue ?? this.body.name ?? this.body.error;
  }
}

export type EvidenceFile = { name: string; contentType: string; data: Uint8Array };

type RequestOptions = {
  json?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  query?: Record<string, string | number | undefined>;
  disputeId?: string;
};

export type ApiCallMeta = {
  method: string;
  path: string;
  status: number;
  ms: number;
  debugId?: string;
  mode: string;
  requestId?: string;
};

type TokenCache = { token: string; expiresAt: number; key: string };
const g = globalThis as unknown as { __exhibitPayPalToken?: TokenCache };

export class PayPalClient {
  readonly mode = paypalMode();
  private readonly base = PAYPAL_BASE_URL[this.mode];
  private readonly fetchImpl: typeof fetch = this.mode === "demo" ? simulatorFetch : fetch;

  private async token(): Promise<string> {
    const { clientId, clientSecret } = paypalCredentials();
    const key = `${this.mode}:${clientId}`;
    const cached = g.__exhibitPayPalToken;
    if (cached && cached.key === key && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const basic = Buffer.from(`${clientId || "demo-client"}:${clientSecret || "demo-secret"}`).toString("base64");
    const started = Date.now();
    const res = await this.fetchImpl(`${this.base}/v1/oauth2/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=client_credentials",
    });
    const body = (await res.json()) as { access_token?: string; expires_in?: number } & PayPalErrorBody;
    this.log(
      { method: "POST", path: "/v1/oauth2/token", status: res.status, ms: Date.now() - started, mode: this.mode, debugId: res.headers.get("paypal-debug-id") ?? body.debug_id },
      undefined,
      // The client id and secret travel in the Basic Authorization header, which is never stored.
      { request: { headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: { grant_type: "client_credentials" } }, response: fitForLog(redact(body)) },
    );
    if (!res.ok || !body.access_token) throw new PayPalError(res.status, body, "POST", "/v1/oauth2/token");
    g.__exhibitPayPalToken = { token: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3000) * 1000, key };
    return body.access_token;
  }

  private log(meta: ApiCallMeta, disputeId: string | undefined, bodies: { request: unknown; response: unknown }) {
    logApiCall(`${meta.method} ${meta.path} → ${meta.status}`, meta, disputeId, bodies);
  }

  async request<T>(method: string, path: string, opts: RequestOptions = {}): Promise<T> {
    const token = await this.token();
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: "application/json", ...opts.headers };
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.json !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.json);
    }
    const started = Date.now();
    const res = await this.fetchImpl(url, { method, headers, body });
    const text = await res.text();
    const parsed = text ? safeJson(text) : {};
    const debugId = res.headers.get("paypal-debug-id") ?? (parsed as PayPalErrorBody).debug_id;
    const shownHeaders = Object.fromEntries(SHOWN_HEADERS.filter((h) => headers[h]).map((h) => [h, headers[h]]));
    if (opts.form) shownHeaders["Content-Type"] = "multipart/form-data";
    this.log(
      { method, path: url.pathname + url.search, status: res.status, ms: Date.now() - started, debugId: debugId ?? undefined, mode: this.mode, requestId: headers["PayPal-Request-Id"] },
      opts.disputeId,
      {
        request: { headers: shownHeaders, body: opts.form ? await describeForm(opts.form) : opts.json === undefined ? undefined : fitForLog(redact(opts.json)) },
        response: text ? fitForLog(redact(parsed)) : null,
      },
    );
    if (!res.ok) throw new PayPalError(res.status, parsed as PayPalErrorBody, method, path);
    return parsed as T;
  }

  // ---- Disputes v1 -------------------------------------------------------------------------

  listDisputes(query: { page_size?: number; next_page_token?: string; dispute_state?: string; start_time?: string } = {}) {
    return this.request<{ items?: DisputeSummary[]; links?: { href: string; rel: string }[] }>("GET", "/v1/customer/disputes", {
      query: { page_size: 50, ...query },
    });
  }

  getDispute(id: string) {
    return this.request<Dispute>("GET", `/v1/customer/disputes/${encodeURIComponent(id)}`, { disputeId: id });
  }

  /** multipart/form-data: an `input` JSON part with the evidences, plus up to 10 MB per file (50 MB per call). */
  provideEvidence(id: string, evidences: Evidence[], files: EvidenceFile[]) {
    const form = new FormData();
    form.append("input", new Blob([JSON.stringify({ evidences })], { type: "application/json" }));
    for (const f of files) form.append("evidence-file", new Blob([Buffer.from(f.data)], { type: f.contentType }), f.name);
    return this.request<{ links: unknown[] }>("POST", `/v1/customer/disputes/${encodeURIComponent(id)}/provide-evidence`, { form, disputeId: id });
  }

  /** Chargebacks under PayPal review: notes (2,000 chars max) plus supporting documents, multipart. */
  provideSupportingInfo(id: string, notes: string, files: EvidenceFile[]) {
    const form = new FormData();
    form.append("input", new Blob([JSON.stringify({ notes })], { type: "application/json" }));
    for (const f of files) form.append("supporting-document", new Blob([Buffer.from(f.data)], { type: f.contentType }), f.name);
    return this.request<{ links: unknown[] }>("POST", `/v1/customer/disputes/${encodeURIComponent(id)}/provide-supporting-info`, { form, disputeId: id });
  }

  makeOffer(id: string, body: { note: string; offer_amount?: Money; offer_type: OfferType; return_shipping_address?: unknown }) {
    return this.request<{ links: unknown[] }>("POST", `/v1/customer/disputes/${encodeURIComponent(id)}/make-offer`, { json: body, disputeId: id });
  }

  acceptClaim(id: string, body: { note: string; accept_claim_type?: AcceptClaimType; refund_amount?: Money }) {
    return this.request<{ links: unknown[] }>("POST", `/v1/customer/disputes/${encodeURIComponent(id)}/accept-claim`, { json: body, disputeId: id });
  }

  sendMessage(id: string, message: string) {
    return this.request<{ links: unknown[] }>("POST", `/v1/customer/disputes/${encodeURIComponent(id)}/send-message`, { json: { message }, disputeId: id });
  }

  /** Sandbox only: settle a dispute in either party's favour. */
  adjudicate(id: string, adjudication_outcome: "BUYER_FAVOR" | "SELLER_FAVOR") {
    return this.request<{ links: unknown[] }>("POST", `/v1/customer/disputes/${encodeURIComponent(id)}/adjudicate`, {
      json: { adjudication_outcome },
      disputeId: id,
    });
  }

  /** Sandbox only: move a dispute to WAITING_FOR_SELLER_RESPONSE so evidence can be filed. */
  requireEvidence(id: string, action: "SELLER_EVIDENCE" | "BUYER_EVIDENCE" = "SELLER_EVIDENCE") {
    return this.request<{ links: unknown[] }>("POST", `/v1/customer/disputes/${encodeURIComponent(id)}/require-evidence`, {
      json: { action },
      disputeId: id,
    });
  }

  // ---- Orders v2, Payments v2 ----------------------------------------------------------------

  createOrder(body: unknown, requestId: string) {
    return this.request<PayPalOrder>("POST", "/v2/checkout/orders", { json: body, headers: { "PayPal-Request-Id": requestId, Prefer: "return=representation" } });
  }

  captureOrder(orderId: string, requestId: string) {
    return this.request<PayPalOrder>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      json: {},
      headers: { "PayPal-Request-Id": requestId, Prefer: "return=representation" },
    });
  }

  getOrder(orderId: string) {
    return this.request<PayPalOrder>("GET", `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  }

  /** Orders v2 tracking: attaches carrier tracking to a captured order (shown to the buyer, used in disputes). */
  addTracking(orderId: string, body: { capture_id: string; tracking_number: string; carrier: string; carrier_name_other?: string; notify_payer?: boolean }) {
    return this.request<PayPalOrder>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/track`, { json: body });
  }

  /** Payments v2 capture, including PayPal's own seller_protection status for the payment. */
  getCapture(captureId: string, disputeId?: string) {
    return this.request<PayPalCapture>("GET", `/v2/payments/captures/${encodeURIComponent(captureId)}`, { disputeId });
  }

  refundCapture(captureId: string, body: { amount?: Money; note_to_payer?: string }, requestId: string, disputeId?: string) {
    return this.request<{ id: string; status: string; amount?: Money }>("POST", `/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
      json: body,
      headers: { "PayPal-Request-Id": requestId },
      disputeId,
    });
  }

  // ---- Sandbox simulations & webhooks --------------------------------------------------------

  /** Sandbox only: creates a chargeback (and therefore a dispute) against a captured transaction. */
  processChargeback(body: unknown) {
    return this.request<{ dispute_id: string }>("POST", "/v2/customer-support/process-chargeback", { json: body });
  }

  verifyWebhookSignature(body: unknown) {
    return this.request<{ verification_status: "SUCCESS" | "FAILURE" }>("POST", "/v1/notifications/verify-webhook-signature", { json: body });
  }
}

export type PayPalCapture = {
  id: string;
  status: string;
  amount?: Money;
  seller_protection?: { status: "ELIGIBLE" | "PARTIALLY_ELIGIBLE" | "NOT_ELIGIBLE" | string; dispute_categories?: string[] };
  create_time?: string;
};

export type PayPalOrder = {
  id: string;
  status: string;
  purchase_units?: {
    reference_id?: string;
    invoice_id?: string;
    custom_id?: string;
    amount?: Money;
    shipping?: { name?: { full_name?: string }; address?: Record<string, string> };
    payee?: { merchant_id?: string; email_address?: string };
    payments?: { captures?: { id: string; status: string; amount: Money; create_time?: string }[] };
  }[];
  payment_source?: Record<string, unknown>;
};

/** Multipart bodies are logged as their parts: the JSON input in full (redacted), files by name and size. */
async function describeForm(form: FormData) {
  const parts: Record<string, unknown>[] = [];
  for (const [name, value] of form.entries()) {
    if (typeof value === "string") parts.push({ name, value: redact(value, name) });
    else if (value.type === "application/json") parts.push({ name, contentType: value.type, json: fitForLog(redact(safeJson(await value.text()))) });
    else parts.push({ name, file: (value as File).name ?? "blob", contentType: value.type, bytes: value.size });
  }
  return { multipart: parts };
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

export function paypal() {
  return new PayPalClient();
}
