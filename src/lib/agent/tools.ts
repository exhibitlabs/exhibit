import "server-only";
import { z } from "zod";
import { REASON_LABEL } from "../paypal/types";
import { caseFile, refreshDispute } from "../disputes";
import { refs, resolveRef } from "../evidence";
import { addressesMatch, evaluateSellerProtection, PLAYBOOK } from "./playbook";
import { CaseBriefSchema, type CaseBrief } from "./brief";
import { store } from "../store/repo";
import { docPut } from "../db";
import { paypal } from "../paypal/client";
import type { Dispute } from "../paypal/types";

export type ToolKind = "paypal" | "store" | "carrier" | "risk" | "policy" | "brief";

export type AgentEvent =
  | { t: "start"; run_id: string; provider: string; model: string; at: string; dispute_id: string }
  | { t: "thinking"; text: string }
  | { t: "text"; text: string }
  | { t: "tool_call"; id: string; name: string; kind: ToolKind; label: string; input: unknown; at: string }
  | { t: "tool_result"; id: string; name: string; ok: boolean; summary: string; output: unknown; ms: number }
  | { t: "brief"; brief: CaseBrief }
  | { t: "done"; ms: number; usage?: { input_tokens?: number; output_tokens?: number } }
  | { t: "error"; message: string };

export type ToolContext = {
  disputeId: string;
  emit: (e: AgentEvent) => void;
  brief?: CaseBrief;
  dispute?: Dispute;
};

type ToolDef<S extends z.ZodObject> = {
  name: string;
  kind: ToolKind;
  label: string;
  description: string;
  schema: S;
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<{ output: unknown; summary: string; rejected?: boolean }>;
};

const def = <S extends z.ZodObject>(t: ToolDef<S>) => t;

function cf(ctx: ToolContext) {
  if (!ctx.dispute) throw new Error("Call get_paypal_dispute first.");
  return caseFile(ctx.dispute);
}

const fmtDate = (iso?: string) => (iso ? new Date(iso).toISOString().slice(0, 10) : "—");
const daysUntil = (iso?: string) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / 86400_000) : null);

export const TOOLS = [
  def({
    name: "get_paypal_dispute",
    kind: "paypal",
    label: "PayPal Disputes API",
    description:
      "Fetch the live dispute from the PayPal Disputes API: reason, lifecycle stage, status, channel, amount, response deadline, the buyer's messages, evidence PayPal requested from the seller, and which actions PayPal currently allows. Always call this first.",
    schema: z.object({ dispute_id: z.string().describe("PayPal dispute id, e.g. PP-D-50211") }),
    async run({ dispute_id }, ctx) {
      const d = await refreshDispute(dispute_id);
      ctx.dispute = d;
      const t = d.disputed_transactions[0];
      const allowed = d.links.filter((l) => l.rel !== "self").map((l) => l.rel);
      const output = {
        ref: refs.dispute(d.dispute_id),
        dispute_id: d.dispute_id,
        reason: d.reason,
        external_reason_code: d.external_reason_code ?? null,
        stage: d.dispute_life_cycle_stage,
        status: d.status,
        channel: d.dispute_channel ?? null,
        amount: d.dispute_amount,
        created: d.create_time,
        seller_response_due_date: d.seller_response_due_date ?? null,
        days_left: daysUntil(d.seller_response_due_date),
        buyer_messages: (d.messages ?? []).map((m, i) => ({ ref: refs.paypalMessage(d.dispute_id, i), posted_by: m.posted_by, at: m.time_posted, content: m.content })),
        sub_reasons: d.extensions?.merchandize_dispute_properties?.product_details?.sub_reasons ?? [],
        evidence_requested_from_seller: (d.evidences ?? []).filter((e) => e.source === "REQUESTED_FROM_SELLER").map((e) => e.evidence_type),
        evidence_already_submitted: (d.evidences ?? []).filter((e) => e.source === "SUBMITTED_BY_SELLER").map((e) => e.evidence_type),
        allowed_actions: allowed,
        allowed_offer_types: d.allowed_response_options?.make_offer?.offer_types ?? [],
        allowed_accept_claim_types: d.allowed_response_options?.accept_claim?.accept_claim_types ?? [],
        transaction: t
          ? { seller_transaction_id: t.seller_transaction_id, invoice_number: t.invoice_number ?? null, gross_amount: t.gross_amount, buyer: t.buyer, items: t.items, created: t.create_time }
          : null,
      };
      const due = daysUntil(d.seller_response_due_date);
      return { output, summary: `${(REASON_LABEL[d.reason] ?? d.reason.replace(/_/g, " ")).toLowerCase()} · ${d.dispute_life_cycle_stage.toLowerCase()} · $${d.dispute_amount.value}${due !== null ? ` · due in ${due}d` : ""}` };
    },
  }),
  def({
    name: "lookup_order",
    kind: "store",
    label: "Store orders",
    description:
      "Find the store order behind a PayPal transaction (by seller_transaction_id / capture id or invoice number). Returns line items with the exact product listing text, totals, the shipping address on the transaction, billing address, checkout IP and when the buyer accepted the store policies.",
    schema: z.object({ transaction_id: z.string().optional(), invoice_number: z.string().optional() }),
    async run({ transaction_id, invoice_number }, ctx) {
      const c = cf(ctx);
      const order =
        c.order && (!transaction_id || c.order.paypal.capture_id === transaction_id || !invoice_number || c.order.id === invoice_number)
          ? c.order
          : store.orders().find((o) => o.paypal.capture_id === transaction_id || o.id === invoice_number || o.paypal.invoice_id === invoice_number);
      if (!order) return { output: { found: false }, summary: "No matching order" };
      const output = {
        ref: refs.order(order.id),
        order_id: order.id,
        placed_at: order.placed_at,
        total: order.total,
        currency: order.currency,
        items: order.items.map((i) => {
          const p = store.product(i.sku);
          return { ...i, listing_ref: refs.listing(i.sku), listing: p ? { name: p.name, description: p.description, material: p.material, dimensions: p.dimensions, color: p.color, notes: p.listing_notes, photos: p.photos.map((x) => x.caption) } : null };
        }),
        shipping_address_on_transaction: order.shipping_address,
        billing_address: order.billing_address ?? null,
        shipping_method: order.shipping_method,
        paypal: order.paypal,
        checkout: { ip: order.checkout.ip, accepted_policies_at: order.checkout.accepted_terms_at, policies_version: order.checkout.policies_version },
        refunds: order.refunds ?? [],
        shipment_ids: order.shipment_ids,
        other_orders_same_customer: store.customer(order.customer_email)?.order_ids.filter((x) => x !== order.id) ?? [],
      };
      return { output, summary: `${order.id} · ${order.items.map((i) => i.name).join(", ")} · $${order.total.toFixed(2)}` };
    },
  }),
  def({
    name: "get_carrier_tracking",
    kind: "carrier",
    label: "Carrier tracking",
    description:
      "Carrier tracking for every shipment on an order (outbound and returns): carrier, tracking number and URL, scan history, delivered date, delivery address, signature, delivery and QC photos, whether the delivery address matches the PayPal transaction address, and whether the tracking was already synced to PayPal.",
    schema: z.object({ order_id: z.string() }),
    async run({ order_id }, ctx) {
      const c = cf(ctx);
      const order = c.order?.id === order_id ? c.order : store.order(order_id);
      const shipments = store.shipmentsFor(order_id);
      if (!shipments.length) return { output: { shipments: [] }, summary: "No shipments" };
      const output = {
        shipments: shipments.map((s) => ({
          ref: refs.shipment(s.id),
          shipment_id: s.id,
          direction: s.direction,
          carrier: s.carrier,
          service: s.service,
          tracking_number: s.tracking_number,
          tracking_url: s.tracking_url,
          status: s.status,
          shipped_at: s.shipped_at,
          delivered_at: s.delivered_at ?? null,
          delivered_to: s.delivered_to ?? null,
          delivery_address_matches_transaction: s.direction === "OUTBOUND" ? (s.delivered_to ? addressesMatch(order?.shipping_address, s.delivered_to) : null) : null,
          signature: s.signature ?? null,
          delivery_photo: s.delivery_photo ?? null,
          qc_photo: s.qc_photo ?? null,
          events: s.events,
          tracking_synced_to_paypal: s.pushed_to_paypal,
        })),
      };
      const o = shipments.find((s) => s.direction === "OUTBOUND") ?? shipments[0];
      return { output, summary: `${o.carrier} ${o.tracking_number} · ${o.status.replace(/_/g, " ").toLowerCase()}${o.delivered_at ? ` ${fmtDate(o.delivered_at)}` : ""}${o.signature ? ` · signed ${o.signature.name}` : ""}${shipments.length > 1 ? ` · +${shipments.length - 1} more` : ""}` };
    },
  }),
  def({
    name: "get_customer_history",
    kind: "store",
    label: "Customer history",
    description: "The buyer's history with the store: first order date, all order ids, lifetime value, prior disputes and account notes.",
    schema: z.object({ email: z.string() }),
    async run({ email }) {
      const cu = store.customer(email);
      if (!cu) return { output: { found: false }, summary: "Unknown customer" };
      return { output: { ref: refs.customer(cu.email), ...cu, orders_count: cu.order_ids.length }, summary: `${cu.order_ids.length} order(s) · LTV $${cu.lifetime_value} · ${cu.prior_disputes} prior dispute(s)` };
    },
  }),
  def({
    name: "get_support_conversation",
    kind: "store",
    label: "Support inbox",
    description: "Email and chat messages between the store and the buyer about this order, oldest first, with message refs and detected language.",
    schema: z.object({ order_id: z.string() }),
    async run({ order_id }) {
      const conv = store.conversation(order_id);
      const messages = conv?.messages ?? [];
      return {
        output: { ref: refs.conversation(order_id), messages: messages.map((m) => ({ ref: refs.message(m.id), ...m })) },
        summary: messages.length ? `${messages.length} message(s), last from ${messages[messages.length - 1].from}` : "No messages with the buyer",
      };
    },
  }),
  def({
    name: "get_payment_risk_signals",
    kind: "risk",
    label: "Risk signals",
    description: "Payment authentication and fraud signals captured at checkout: AVS and CVV results, 3-D Secure, IP geolocation and its distance to the shipping address, device history, email age and order velocity.",
    schema: z.object({ order_id: z.string() }),
    async run({ order_id }) {
      const r = store.risk(order_id);
      if (!r) return { output: { found: false }, summary: "No risk record" };
      return {
        output: { ref: refs.risk(order_id), ...r },
        summary: `AVS ${r.avs_result ?? "–"} · CVV ${r.cvv_result ?? "–"} · 3DS ${r.three_ds?.toLowerCase() ?? "–"} · IP ${r.ip.city} (${r.ip_to_shipping_km} km)`,
      };
    },
  }),
  def({
    name: "get_store_policies",
    kind: "policy",
    label: "Store policies",
    description: "The store's returns, shipping and terms-of-sale policies as shown at checkout, with versions and URLs.",
    schema: z.object({}),
    async run(_input, ctx) {
      const c = cf(ctx);
      return {
        output: { policies: store.policies().map((p) => ({ ref: refs.policy(p.id), ...p, accepted_by_buyer_at: c.order?.checkout.accepted_terms_at ?? null })) },
        summary: `${store.policies().length} policies · accepted at checkout ${fmtDate(c.order?.checkout.accepted_terms_at)}`,
      };
    },
  }),
  def({
    name: "check_seller_protection",
    kind: "policy",
    label: "PayPal Seller Protection",
    description:
      "Fetches PayPal's own Seller Protection flag for the payment (Payments API), then deterministically checks the case against PayPal's published US Seller Protection requirements (claim type, transaction address, proof of delivery/shipment, timing). Returns each requirement with its status and the policy text, plus Exhibit's playbook for this dispute reason.",
    schema: z.object({ dispute_id: z.string() }),
    async run(_input, ctx) {
      const before = cf(ctx);
      if (before.order) {
        // Ask PayPal for its own Seller Protection flag on this payment; the check uses it when present.
        try {
          const cap = await paypal().getCapture(before.order.paypal.capture_id, before.dispute.dispute_id);
          docPut("capture", cap.id, cap);
        } catch {
          // The capture may belong to another account or be unavailable; fall back to the published rules alone.
        }
      }
      const c = cf(ctx);
      const report = evaluateSellerProtection(c, store.merchant().address.country);
      const play = PLAYBOOK[c.dispute.reason] ?? PLAYBOOK.DEFAULT;
      return {
        output: { ref: refs.protection(c.dispute.dispute_id), ...report, playbook: play },
        summary: `${report.verdict.replace(/_/g, " ").toLowerCase()} · ${report.checks.filter((x) => x.status === "pass").length}/${report.checks.length} requirements met`,
      };
    },
  }),
  def({
    name: "file_case_brief",
    kind: "brief",
    label: "Case brief",
    description:
      "File your final case brief: the decision, the exhibits (each citing one ref returned by a tool), the PayPal action to take, the response letter to PayPal and any buyer message. Call this exactly once, last. If validation fails, fix the fields and call it again.",
    schema: CaseBriefSchema,
    async run(input, ctx) {
      const c = cf(ctx);
      const problems = validateBrief(input, c);
      // A rejection is returned as a normal result (not an error) so the model fixes it and refiles.
      if (problems.length)
        return {
          output: { ok: false, rejected: true, problems, allowed_actions: c.dispute.links.filter((l) => l.rel !== "self").map((l) => l.rel), instruction: "Fix every problem listed and call file_case_brief again now." },
          summary: `Brief rejected: ${problems[0]}`,
          rejected: true,
        };
      ctx.brief = input;
      return { output: { ok: true }, summary: `${input.decision} · ${input.win_likelihood}% · ${input.exhibits.length} exhibit(s)` };
    },
  }),
] as const;

export type ToolName = (typeof TOOLS)[number]["name"];

/** Checks the brief against the case: every ref must resolve, and the action must be one PayPal allows right now. */
export function validateBrief(b: CaseBrief, c: ReturnType<typeof caseFile>): string[] {
  const problems: string[] = [];
  const rels = new Set(c.dispute.links.map((l) => l.rel));
  for (const e of b.exhibits) if (!resolveRef(e.ref, c)) problems.push(`Exhibit ${e.label} cites unknown ref "${e.ref}"`);
  for (const r of b.reasoning) for (const ref of r.refs) if (!resolveRef(ref, c)) problems.push(`reasoning cites unknown ref "${ref}"`);
  const labels = b.exhibits.map((e) => e.label);
  if (new Set(labels).size !== labels.length) problems.push("exhibit labels must be unique");
  const a = b.paypal_action;
  const need = (rel: string) => {
    if (!rels.has(rel)) problems.push(`${a.type} needs PayPal's "${rel}" link, which this dispute does not offer (allowed: ${[...rels].filter((x) => x !== "self").join(", ") || "none"})`);
  };
  if (a.type === "provide_evidence") {
    need("provide_evidence");
    if (!a.evidence_types?.length) problems.push("provide_evidence needs evidence_types");
    if (a.evidence_types?.includes("PROOF_OF_FULFILLMENT") && !(a.tracking_ref && resolveRef(a.tracking_ref, c)?.kind === "shipment")) problems.push("PROOF_OF_FULFILLMENT needs tracking_ref pointing at a shipment ref");
  }
  if (a.type === "refund_then_prove") need("provide_evidence");
  if (a.type === "provide_supporting_info") need("provide_supporting_info");
  if (a.type === "make_offer") {
    need("make_offer");
    const allowed = c.dispute.allowed_response_options?.make_offer?.offer_types;
    if (!a.offer_type) problems.push("make_offer needs offer_type");
    else if (allowed && !allowed.includes(a.offer_type)) problems.push(`offer_type must be one of ${allowed.join(", ")}`);
    if (a.offer_type !== "REPLACEMENT_WITHOUT_REFUND" && a.amount === undefined) problems.push("make_offer needs amount");
    if (!b.buyer_message) problems.push("make_offer needs buyer_message");
  }
  if (a.type === "accept_claim") need("accept_claim");
  if (a.type === "send_message") {
    need("send_message");
    if (!b.buyer_message) problems.push("send_message needs buyer_message");
  }
  const amount = Number(c.dispute.dispute_amount.value);
  if (a.amount !== undefined && a.amount > amount) problems.push(`amount ${a.amount} exceeds the disputed amount ${amount}`);
  return problems;
}

export function toolByName(name: string) {
  return TOOLS.find((t) => t.name === name || `mcp__exhibit__${t.name}` === name);
}

let seq = 0;

/** Validates input, runs the tool, emits call/result events and returns the text sent back to the model. */
export async function executeTool(name: string, rawInput: unknown, ctx: ToolContext, callId?: string, dwellMs = 0): Promise<{ text: string; isError: boolean }> {
  const tool = toolByName(name);
  const id = callId ?? `call_${Date.now().toString(36)}_${seq++}`;
  if (!tool) return { text: JSON.stringify({ error: `Unknown tool ${name}` }), isError: true };
  ctx.emit({ t: "tool_call", id, name: tool.name, kind: tool.kind, label: tool.label, input: rawInput, at: new Date().toISOString() });
  // Replay only: a pause so the UI can show the source being queried. Not counted in the tool's ms.
  if (dwellMs) await new Promise((r) => setTimeout(r, dwellMs));
  const started = Date.now();
  const parsed = tool.schema.safeParse(rawInput);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    ctx.emit({ t: "tool_result", id, name: tool.name, ok: false, summary: `Invalid input: ${issues[0]}`, output: { issues }, ms: Date.now() - started });
    return { text: JSON.stringify({ error: "INVALID_INPUT", issues }), isError: true };
  }
  try {
    // The schema union erases per-tool input types; each run() re-validates via its own schema above.
    const { output, summary, rejected } = await (tool.run as (i: unknown, c: ToolContext) => Promise<{ output: unknown; summary: string; rejected?: boolean }>)(parsed.data, ctx);
    ctx.emit({ t: "tool_result", id, name: tool.name, ok: !rejected, summary, output, ms: Date.now() - started });
    return { text: JSON.stringify(output), isError: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    ctx.emit({ t: "tool_result", id, name: tool.name, ok: false, summary: message, output: { error: message }, ms: Date.now() - started });
    return { text: JSON.stringify({ error: message }), isError: true };
  }
}
