#!/usr/bin/env node
/**
 * Exhibit MCP server (stdio).
 *
 * Lets any MCP client (Claude Desktop, Claude Code, ChatGPT connectors, an agent built on PayPal's
 * Agent Toolkit) investigate PayPal disputes with Exhibit and get them ready to file. It talks to a
 * running Exhibit app over HTTP and holds no PayPal credentials of its own.
 *
 * The guarantee: no tool here moves money or contacts a customer. `request_dispute_action` and
 * `request_prevention_fix` only queue a request; the merchant approves it in the Exhibit app, which
 * then executes it through the same code path as its own "File" button.
 *
 *   EXHIBIT_URL=http://localhost:3000 node mcp/server.ts
 *
 * Runs on Node 22.18+ / 24 with native type stripping; no build step.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE = (process.env.EXHIBIT_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const VERSION = "0.1.0";

// ---- HTTP -----------------------------------------------------------------------------------------

class ExhibitError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function call<T>(path: string, init: RequestInit & { timeoutMs?: number } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init.headers }, signal: AbortSignal.timeout(init.timeoutMs ?? 30_000) });
  } catch (e) {
    throw new ExhibitError(`Could not reach Exhibit at ${BASE} (${e instanceof Error ? e.message : String(e)}). Is the app running? Set EXHIBIT_URL to its address.`, 0);
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new ExhibitError(`Exhibit returned a non-JSON response for ${path} (HTTP ${res.status}).`, res.status);
  }
  if (!res.ok) throw new ExhibitError((body as { error?: string } | null)?.error ?? `HTTP ${res.status} from ${path}`, res.status);
  return body as T;
}

// ---- Shapes (the subset of Exhibit's API this server reads) --------------------------------------

type InboxRow = {
  id: string;
  buyer: string;
  item: string;
  reason: string;
  reasonCode: string;
  stage: string;
  status: string;
  statusCode: string;
  amount: number;
  currency: string;
  dueAt: string | null;
  hoursLeft: number | null;
  decision: string | null;
  likelihood: number | null;
  headline: string | null;
  expected: number | null;
  outcome: string | null;
};

type Brief = {
  decision: "FIGHT" | "OFFER" | "REFUND" | "MESSAGE_BUYER";
  headline: string;
  summary: string;
  win_likelihood: number;
  confidence: string;
  reasoning: { point: string; refs: string[] }[];
  risks: string[];
  missing_evidence: string[];
  exhibits: { label: string; title: string; ref: string; why: string }[];
  paypal_action: { type: string; evidence_types?: string[]; tracking_ref?: string; offer_type?: string; amount?: number };
  response_letter: string;
  buyer_message: { language: string; text: string; english?: string } | null;
};

type CaseState = {
  dispute: { dispute_id: string; status: string; reason: string; dispute_amount: { value: string; currency_code: string }; seller_response_due_date?: string; disputed_transactions: { buyer?: { name?: string } }[] } | null;
  run: { id: string; status: string; provider: string; model: string | null; finished_at: string | null; brief: Brief | null; events: { t: string; name?: string }[] } | null;
  running: boolean;
  actions: { kind: string; actor: string; status: string; created_at: string }[];
};

type Approval = {
  id: string;
  kind: string;
  target: string;
  action: string;
  title: string;
  detail: string;
  amount: number | null;
  currency: string | null;
  movesMoney: boolean;
  client: string;
  status: string;
  createdAt: string;
  decidedAt: string | null;
  result: unknown;
};

// ---- Formatting ------------------------------------------------------------------------------------

const DECISION: Record<Brief["decision"], string> = { FIGHT: "Fight (file evidence)", OFFER: "Offer a resolution", REFUND: "Refund / accept", MESSAGE_BUYER: "Message the buyer first" };
const ACTION: Record<string, string> = {
  provide_evidence: "File evidence with PayPal",
  provide_supporting_info: "Send the evidence packet to PayPal's chargeback review",
  make_offer: "Send the buyer an offer",
  accept_claim: "Accept the claim and refund the buyer",
  refund_then_prove: "Refund the buyer, then file proof of refund",
  send_message: "Message the buyer through PayPal",
};

const money = (v: number, c = "USD") => `${c === "USD" ? "$" : ""}${v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}${c === "USD" ? "" : ` ${c}`}`;
const caseUrl = (id: string) => `${BASE}/app/disputes/${id}`;
const packetUrl = (id: string) => `${BASE}/api/disputes/${id}/packet`;
const due = (h: number | null) => (h === null ? "no deadline" : h < 0 ? "past due" : h < 48 ? `${h}h left` : `${Math.round(h / 24)}d left`);

function briefData(id: string, s: CaseState) {
  const b = s.run?.brief;
  if (!b || !s.dispute) return null;
  const amount = Number(s.dispute.dispute_amount.value);
  return {
    dispute_id: id,
    buyer: s.dispute.disputed_transactions[0]?.buyer?.name ?? null,
    amount,
    currency: s.dispute.dispute_amount.currency_code,
    status: s.dispute.status,
    response_due: s.dispute.seller_response_due_date ?? null,
    decision: b.decision,
    headline: b.headline,
    summary: b.summary,
    win_likelihood: b.win_likelihood,
    confidence: b.confidence,
    reasoning: b.reasoning,
    risks: b.risks,
    missing_evidence: b.missing_evidence,
    exhibits: b.exhibits,
    proposed_paypal_action: { ...b.paypal_action, label: ACTION[b.paypal_action.type] ?? b.paypal_action.type },
    response_letter: b.response_letter,
    buyer_message: b.buyer_message,
    evidence_packet_url: packetUrl(id),
    case_url: caseUrl(id),
    run: { id: s.run!.id, model: s.run!.model, finished_at: s.run!.finished_at, tool_calls: s.run!.events.filter((e) => e.t === "tool_call").length },
    actions_taken: s.actions.map((a) => ({ kind: a.kind, actor: a.actor, status: a.status, at: a.created_at })),
  };
}

function briefText(d: NonNullable<ReturnType<typeof briefData>>) {
  const lines = [
    `# ${d.dispute_id} · ${d.buyer ?? "Buyer"} · ${money(d.amount, d.currency)}`,
    `**${d.headline}**`,
    ``,
    `Exhibit's call: **${DECISION[d.decision]}** · win likelihood **${d.win_likelihood}%** (${d.confidence.toLowerCase()} confidence)${d.response_due ? ` · response due ${d.response_due}` : ""}`,
    ``,
    d.summary,
    ``,
    `## Reasoning (cited evidence)`,
    ...d.reasoning.map((r) => `- ${r.point}${r.refs.length ? ` [${r.refs.join(", ")}]` : ""}`),
    ``,
    `## Exhibits`,
    ...d.exhibits.map((e) => `- Exhibit ${e.label}: ${e.title} (${e.ref}) — ${e.why}`),
  ];
  if (d.risks.length) lines.push(``, `## Risks`, ...d.risks.map((r) => `- ${r}`));
  if (d.missing_evidence.length) lines.push(``, `## Missing evidence`, ...d.missing_evidence.map((r) => `- ${r}`));
  const a = d.proposed_paypal_action;
  lines.push(
    ``,
    `## Proposed PayPal action`,
    `${a.label}${a.evidence_types?.length ? ` (${a.evidence_types.join(", ")})` : ""}${a.offer_type ? ` (${a.offer_type})` : ""}${a.amount !== undefined ? ` · ${money(a.amount, d.currency)}` : ""}`,
    `Not executed. To carry it out, call request_dispute_action; the merchant approves it in Exhibit.`,
    ``,
    `## Response letter (what PayPal's reviewer reads)`,
    d.response_letter,
  );
  if (d.buyer_message) lines.push(``, `## Message to the buyer (${d.buyer_message.language})`, d.buyer_message.text, ...(d.buyer_message.english ? [``, `English: ${d.buyer_message.english}`] : []));
  if (d.actions_taken.length) lines.push(``, `## Already done`, ...d.actions_taken.map((x) => `- ${x.kind} by ${x.actor} (${x.status}) at ${x.at}`));
  lines.push(``, `Evidence packet (PDF): ${d.evidence_packet_url}`, `Case in Exhibit: ${d.case_url}`);
  return lines.join("\n");
}

function approvalData(a: Approval, reviewPath?: string) {
  return {
    approval_id: a.id,
    status: a.status,
    kind: a.kind,
    target: a.target,
    action: a.action,
    title: a.title,
    detail: a.detail,
    amount: a.amount,
    currency: a.currency,
    moves_money: a.movesMoney,
    requested_by: a.client,
    created_at: a.createdAt,
    decided_at: a.decidedAt,
    result: a.result,
    approval_url: `${BASE}${reviewPath ?? (a.kind === "dispute_action" ? `/app/disputes/${a.target}?approval=${a.id}` : `/app/approvals?approval=${a.id}`)}`,
  };
}

// ---- Tool result helpers ---------------------------------------------------------------------------

type Out = { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
const ok = (text: string, data: Record<string, unknown>): Out => ({ content: [{ type: "text", text }], structuredContent: data });
const fail = (e: unknown): Out => ({ content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true });
const guard =
  <A>(fn: (args: A, extra: Extra) => Promise<Out>) =>
  async (args: A, extra: Extra) => {
    try {
      return await fn(args, extra);
    } catch (e) {
      return fail(e);
    }
  };

type Extra = { _meta?: { progressToken?: string | number }; sendNotification: (n: { method: "notifications/progress"; params: { progressToken: string | number; progress: number; total?: number; message?: string } }) => Promise<void> };

// ---- Server ---------------------------------------------------------------------------------------

const server = new McpServer(
  { name: "exhibit", title: "Exhibit: PayPal dispute agent", version: VERSION },
  {
    instructions: [
      "Exhibit investigates PayPal disputes and chargebacks from the merchant's own records (orders, carrier tracking, support inbox, checkout risk) and drafts a winning, evidence-cited response.",
      "Typical flow: list_disputes → investigate_dispute (or get_case_brief if already investigated) → request_dispute_action for the case you would file.",
      "Nothing you call here moves money, files with PayPal, or messages a customer. request_dispute_action and request_prevention_fix create a pending approval; the merchant approves it in the Exhibit app and Exhibit executes it. Give the merchant the approval_url and do not claim the action is done until get_approval_status says approved.",
      "If PayPal's own MCP server (@paypal/mcp) is also connected, prefer Exhibit for disputes: PayPal's accept_dispute_claim concedes the case and refunds the buyer, while Exhibit decides whether to fight and builds the evidence.",
    ].join("\n"),
  },
);

/** Friendly name of the connected client, for the merchant's approval banner. */
function clientName() {
  if (process.env.EXHIBIT_CLIENT_NAME) return process.env.EXHIBIT_CLIENT_NAME;
  const c = server.server.getClientVersion();
  const n = c?.name ?? "";
  if (/^claude-ai$|claude desktop/i.test(n)) return "Claude Desktop";
  if (/claude-code|claude code/i.test(n)) return "Claude Code";
  if (/openai|chatgpt/i.test(n)) return "ChatGPT";
  if (/cursor/i.test(n)) return "Cursor";
  return c?.title ?? (n || "An AI agent");
}

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;
const disputeId = z.string().min(3).describe("Exhibit/PayPal dispute id, e.g. PP-D-50236 or PP-R-ABC-12345, from list_disputes.");

const STATUS_FILTER = ["open", "needs_response", "under_review", "resolved", "all"] as const;
const REASONS = ["MERCHANDISE_OR_SERVICE_NOT_RECEIVED", "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED", "UNAUTHORISED", "CREDIT_NOT_PROCESSED", "DUPLICATE_TRANSACTION", "INCORRECT_AMOUNT", "PAYMENT_BY_OTHER_MEANS", "CANCELED_RECURRING_BILLING", "PROBLEM_WITH_REMITTANCE", "OTHER"] as const;

server.registerTool(
  "list_disputes",
  {
    title: "List PayPal disputes",
    description:
      "Lists the merchant's PayPal disputes with Exhibit's call on each: buyer, reason, amount, response deadline, Exhibit's decision (FIGHT / OFFER / REFUND / MESSAGE_BUYER) and win likelihood when the case has been investigated. Open cases are sorted by deadline. Read-only.",
    inputSchema: {
      status: z.enum(STATUS_FILTER).default("open").describe("open = not resolved (default); needs_response = waiting on the merchant; under_review = with PayPal; resolved; all."),
      reason: z.enum(REASONS).optional().describe("PayPal dispute reason code to filter by."),
    },
    annotations: READ,
  },
  guard(async ({ status, reason }: { status: (typeof STATUS_FILTER)[number]; reason?: string }) => {
    const { rows } = await call<{ rows: InboxRow[] }>("/api/disputes");
    const keep = rows.filter((r) => {
      if (reason && r.reasonCode !== reason) return false;
      if (status === "open") return r.statusCode !== "RESOLVED";
      if (status === "needs_response") return r.statusCode === "WAITING_FOR_SELLER_RESPONSE";
      if (status === "under_review") return r.statusCode === "UNDER_REVIEW" || r.statusCode === "WAITING_FOR_BUYER_RESPONSE";
      if (status === "resolved") return r.statusCode === "RESOLVED";
      return true;
    });
    keep.sort((a, b) => (a.hoursLeft ?? 1e9) - (b.hoursLeft ?? 1e9));
    const disputes = keep.map((r) => ({
      id: r.id,
      buyer: r.buyer,
      item: r.item,
      reason: r.reason,
      reason_code: r.reasonCode,
      stage: r.stage,
      status: r.status,
      amount: r.amount,
      currency: r.currency,
      response_due: r.dueAt,
      hours_left: r.hoursLeft,
      exhibit_call: r.decision,
      win_likelihood: r.likelihood,
      headline: r.headline,
      outcome: r.outcome,
      investigated: r.decision !== null,
      case_url: caseUrl(r.id),
    }));
    const total = keep.reduce((a, r) => a + r.amount, 0);
    const text = disputes.length
      ? [
          `${disputes.length} ${status === "all" ? "" : status.replace("_", " ") + " "}dispute(s), ${money(total)} in total.`,
          ...disputes.map(
            (d) =>
              `- ${d.id} · ${d.buyer} · ${d.reason} · ${money(d.amount, d.currency)} · ${d.stage} · ${due(d.hours_left)} · ${d.exhibit_call ? `Exhibit: ${d.exhibit_call} ${d.win_likelihood}%${d.headline ? ` — ${d.headline}` : ""}` : "not investigated yet"}`,
          ),
        ].join("\n")
      : "No disputes match.";
    return ok(text, { count: disputes.length, total_amount: total, disputes });
  }),
);

async function readState(id: string) {
  return call<CaseState>(`/api/disputes/${encodeURIComponent(id)}/state`);
}

server.registerTool(
  "investigate_dispute",
  {
    title: "Investigate a dispute with Exhibit",
    description:
      "Runs the Exhibit agent on one dispute: it pulls the PayPal case, the order, carrier tracking, the support conversation and checkout risk signals, then returns a case brief: decision, win likelihood, reasoning with cited evidence refs, the exhibits for the evidence packet, the proposed PayPal action, and the response letter. Takes roughly 10 to 90 seconds. Files nothing: use request_dispute_action afterwards to ask the merchant to approve filing.",
    inputSchema: { dispute_id: disputeId },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  guard(async ({ dispute_id }: { dispute_id: string }, extra) => {
    const id = dispute_id.trim();
    const before = await readState(id);
    if (!before.dispute) throw new ExhibitError(`Dispute ${id} not found. Call list_disputes for valid ids.`, 404);
    const token = extra._meta?.progressToken;
    let progress = 0;
    const notify = (message: string) => (token === undefined ? undefined : extra.sendNotification({ method: "notifications/progress", params: { progressToken: token, progress: ++progress, message } }).catch(() => {}));

    let runError: string | null = null;
    if (!before.running) {
      let res: Response;
      try {
        res = await fetch(`${BASE}/api/disputes/${encodeURIComponent(id)}/run?trigger=agent`, { method: "POST", signal: AbortSignal.timeout(300_000) });
      } catch (e) {
        throw new ExhibitError(`Could not reach Exhibit at ${BASE}: ${e instanceof Error ? e.message : String(e)}`, 0);
      }
      if (!res.ok || !res.body) throw new ExhibitError(`Exhibit could not start a run (HTTP ${res.status}).`, res.status);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const line = p.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const e = JSON.parse(line.slice(6)) as { t: string; label?: string; message?: string };
          if (e.t === "tool_call" && e.label) void notify(e.label);
          else if (e.t === "brief") void notify("Case brief filed");
          else if (e.t === "error") runError = e.message ?? "The run failed.";
        }
      }
    }
    // A run already in flight (webhook, batch, the merchant) finishes on its own; wait for it.
    let s = await readState(id);
    for (let i = 0; s.running && i < 150; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      s = await readState(id);
    }
    if (runError && runError !== "Exhibit is already working on this dispute.") throw new ExhibitError(`Investigation failed: ${runError}`, 500);
    const d = briefData(id, s);
    if (!d) throw new ExhibitError(`Exhibit finished without a brief for ${id}.`, 500);
    return ok(briefText(d), d);
  }),
);

server.registerTool(
  "get_case_brief",
  {
    title: "Get Exhibit's case brief",
    description: "Returns the latest Exhibit case brief for a dispute without re-running the investigation: decision, win likelihood, cited reasoning, exhibits, proposed PayPal action, response letter, buyer message and any actions already taken. Read-only.",
    inputSchema: { dispute_id: disputeId },
    annotations: READ,
  },
  guard(async ({ dispute_id }: { dispute_id: string }) => {
    const s = await readState(dispute_id.trim());
    if (!s.dispute) throw new ExhibitError(`Dispute ${dispute_id} not found. Call list_disputes for valid ids.`, 404);
    const d = briefData(dispute_id.trim(), s);
    if (!d) return ok(`${dispute_id} has not been investigated yet${s.running ? " (a run is in progress now)" : ""}. Call investigate_dispute.`, { dispute_id, investigated: false, running: s.running });
    return ok(briefText(d), d);
  }),
);

server.registerTool(
  "get_evidence_packet",
  {
    title: "Get the evidence packet PDF",
    description: "Returns the URL of the evidence packet Exhibit would file for a dispute: a PDF with the response letter and every exhibit (tracking, delivery proof, order, conversation, risk signals). Requires an investigated dispute. Read-only.",
    inputSchema: { dispute_id: disputeId },
    annotations: READ,
  },
  guard(async ({ dispute_id }: { dispute_id: string }) => {
    const id = dispute_id.trim();
    const s = await readState(id);
    const b = s.run?.brief;
    if (!b) throw new ExhibitError(`${id} has not been investigated yet. Call investigate_dispute first.`, 409);
    let bytes: number | null = null;
    try {
      const res = await fetch(packetUrl(id), { signal: AbortSignal.timeout(60_000) });
      if (res.ok) bytes = (await res.arrayBuffer()).byteLength;
    } catch {
      // The URL is still valid; size is a nicety.
    }
    const data = { dispute_id: id, url: packetUrl(id), download_url: `${packetUrl(id)}?download=1`, content_type: "application/pdf", bytes, exhibits: b.exhibits.map((e) => ({ label: e.label, title: e.title, ref: e.ref })) };
    return ok(
      [`Evidence packet for ${id}${bytes ? ` (${Math.round(bytes / 1024)} KB PDF)` : ""}: ${data.url}`, `Download: ${data.download_url}`, ...b.exhibits.map((e) => `- Exhibit ${e.label}: ${e.title}`)].join("\n"),
      data,
    );
  }),
);

type PreventionOrder = { orderId: string; buyer: string; item: string; amount: number; currency: string; exposure: number; score: number; band: string; top: { label: string; detail: string; reasonLabel: string; quote?: string } | null; signals: { label: string; detail: string }[]; fixes: { action: string; label: string; detail: string; primary?: boolean }[] };
type PreventionReport = { atRisk: PreventionOrder[]; totals: { watched: number; atRisk: number; exposure: number; expectedDisputes: number; high: number; elevated: number; watch: number; prevented: number; saved: number; feesAvoided: number } };

server.registerTool(
  "get_prevention_report",
  {
    title: "Orders at risk of becoming disputes",
    description:
      "Returns orders that are likely to turn into PayPal disputes before they do (tracking not on PayPal, stalled shipments, an unanswered buyer threatening a claim, an overdue refund, a risky checkout), each with a risk score, the exposure (order + dispute fee) and the fixes Exhibit can run. Read-only; to run a fix, call request_prevention_fix.",
    inputSchema: { limit: z.number().int().min(1).max(50).default(10).describe("How many at-risk orders to return, highest risk first.") },
    annotations: READ,
  },
  guard(async ({ limit }: { limit: number }) => {
    let r: PreventionReport;
    try {
      r = await call<PreventionReport>("/api/prevention");
    } catch (e) {
      if (e instanceof ExhibitError && (e.status === 404 || e.status === 405)) return ok("Dispute prevention is not available on this Exhibit instance yet.", { available: false });
      throw e;
    }
    const orders = r.atRisk.slice(0, limit).map((o) => ({
      order_id: o.orderId,
      buyer: o.buyer,
      item: o.item,
      amount: o.amount,
      currency: o.currency,
      exposure: o.exposure,
      risk_score: o.score,
      band: o.band,
      likely_reason: o.top?.reasonLabel ?? null,
      top_signal: o.top ? { label: o.top.label, detail: o.top.detail, quote: o.top.quote ?? null } : null,
      signals: o.signals.map((s) => s.label),
      fixes: o.fixes.map((f) => ({ action: f.action, label: f.label, detail: f.detail, recommended: !!f.primary })),
    }));
    const t = r.totals;
    const text = [
      `${t.atRisk} of ${t.watched} watched orders are at risk: ${money(t.exposure)} exposed, ~${t.expectedDisputes} disputes expected if nothing changes (${t.high} high, ${t.elevated} elevated). Prevented so far: ${t.prevented} (${money(t.saved)} saved).`,
      ...orders.map((o) => `- ${o.order_id} · ${o.buyer} · ${o.item} · ${money(o.amount, o.currency)} · risk ${o.risk_score} (${o.band}) · ${o.top_signal?.label ?? ""}: ${o.top_signal?.detail ?? ""} · fix: ${o.fixes.find((f) => f.recommended)?.label ?? o.fixes[0]?.label ?? "none"}`),
    ].join("\n");
    return ok(text, { available: true, totals: t, orders });
  }),
);

type Overview = {
  merchant: string;
  headline: { recovered: number; atRisk: number; openCount: number; needsYou: number; dueSoon: number; expected: number };
  kpis: Record<string, { value: number; hint?: string }>;
  reasons: { label: string; won: number; lost: number; total: number; winRate: number | null }[];
  rate: { current: { disputes: number; orders: number; rate: number }; thresholds: { network: string; label: string; value: number }[] };
};

server.registerTool(
  "get_overview",
  {
    title: "Dispute command center",
    description: "Returns the merchant's dispute health: money recovered, money at risk, win rate, fees avoided, open cases and deadlines, win rate by dispute reason, and the dispute rate against card-network thresholds. Read-only.",
    inputSchema: {},
    annotations: READ,
  },
  guard(async () => {
    const o = await call<Overview>("/api/overview");
    const k = o.kpis;
    const lowest = Math.min(...o.rate.thresholds.map((x) => x.value));
    const data = {
      merchant: o.merchant,
      recovered: o.headline.recovered,
      at_risk: o.headline.atRisk,
      open_disputes: o.headline.openCount,
      need_merchant: o.headline.needsYou,
      due_within_72h: o.headline.dueSoon,
      win_rate: k.winRate?.value ?? null,
      fees_avoided: k.feesAvoided?.value ?? null,
      hours_saved: k.hoursSaved?.value ?? null,
      by_reason: o.reasons.map((r) => ({ reason: r.label, won: r.won, lost: r.lost, total: r.total, win_rate: r.winRate })),
      dispute_rate: { percent: o.rate.current.rate, disputes: o.rate.current.disputes, orders: o.rate.current.orders, thresholds: o.rate.thresholds },
    };
    const text = [
      `${o.merchant}: ${money(data.recovered)} recovered, ${money(data.at_risk)} at risk across ${data.open_disputes} open disputes (${data.due_within_72h} due within 72h).`,
      `Win rate ${data.win_rate === null ? "n/a" : `${data.win_rate}%`} (${k.winRate?.hint ?? ""}) · fees avoided ${money(data.fees_avoided ?? 0)} · ~${data.hours_saved ?? 0}h saved.`,
      `Dispute rate ${o.rate.current.rate}% (${o.rate.current.disputes} disputes / ${o.rate.current.orders} orders); lowest network threshold ${lowest}%.`,
      `By reason: ${o.reasons.map((r) => `${r.label} ${r.winRate === null ? "n/a" : `${r.winRate}%`} (${r.won}W/${r.lost}L)`).join("; ")}`,
    ].join("\n");
    return ok(text, data);
  }),
);

const APPROVAL_NOTE = "Shown to the merchant on the approval banner: why you recommend this, in one or two sentences.";

server.registerTool(
  "request_dispute_action",
  {
    title: "Ask the merchant to approve filing",
    description: [
      "Asks the merchant to approve the PayPal action in Exhibit's latest brief for this dispute (file evidence, send the packet to chargeback review, make an offer, accept, refund, or message the buyer).",
      "This does NOT file anything and moves no money. It creates a pending approval and returns an approval_url. The merchant reviews the brief, letter and packet in Exhibit and clicks Approve; only then does Exhibit call PayPal, through the same code path as its own File button. The request is pinned to the current brief: if the case is re-investigated before approval, the request expires and nothing is filed.",
      "Call investigate_dispute (or get_case_brief) first. Share the approval_url with the user and check get_approval_status later; never tell the user it is filed until status is approved.",
    ].join(" "),
    inputSchema: { dispute_id: disputeId, note: z.string().max(500).optional().describe(APPROVAL_NOTE) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  guard(async ({ dispute_id, note }: { dispute_id: string; note?: string }) => {
    const r = await call<{ approval: Approval; existing: boolean; reviewPath: string }>("/api/approvals", { method: "POST", body: JSON.stringify({ kind: "dispute_action", disputeId: dispute_id.trim(), note, client: clientName() }) });
    const d = approvalData(r.approval, r.reviewPath);
    return ok(
      [
        `${r.existing ? "Already waiting for" : "Requested"} merchant approval: ${d.title} on ${d.target}.`,
        d.detail,
        `Nothing has been sent to PayPal. The merchant approves or rejects here: ${d.approval_url}`,
        `Approval id ${d.approval_id} (status: ${d.status}). Check it with get_approval_status.`,
      ].join("\n"),
      { ...d, existing: r.existing },
    );
  }),
);

const PREVENTION_ACTIONS = ["push_tracking", "refund", "message_buyer", "hold_and_verify", "require_signature", "dismiss"] as const;

server.registerTool(
  "request_prevention_fix",
  {
    title: "Ask the merchant to approve a prevention fix",
    description:
      "Asks the merchant to approve a fix on an order that is at risk of becoming a dispute (push tracking to PayPal, refund, message the buyer in their language, hold fulfilment and verify, require signature). Like request_dispute_action it executes nothing: it creates a pending approval and returns an approval_url; Exhibit runs the fix only after the merchant approves. Use get_prevention_report to see orders and their available fixes.",
    inputSchema: {
      order_id: z.string().min(3).describe("Order id from get_prevention_report, e.g. KA-10561."),
      action: z.enum(PREVENTION_ACTIONS).optional().describe("Which fix; defaults to the recommended one for the order."),
      note: z.string().max(500).optional().describe(APPROVAL_NOTE),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  guard(async ({ order_id, action, note }: { order_id: string; action?: string; note?: string }) => {
    const r = await call<{ approval: Approval; existing: boolean; reviewPath: string }>("/api/approvals", { method: "POST", body: JSON.stringify({ kind: "prevention_fix", orderId: order_id.trim(), action, note, client: clientName() }) });
    const d = approvalData(r.approval, r.reviewPath);
    return ok([`${r.existing ? "Already waiting for" : "Requested"} merchant approval: ${d.title}.`, d.detail, `Nothing has run yet. The merchant approves or rejects here: ${d.approval_url}`, `Approval id ${d.approval_id} (status: ${d.status}).`].join("\n"), { ...d, existing: r.existing });
  }),
);

server.registerTool(
  "get_approval_status",
  {
    title: "Check an approval",
    description: "Returns the status of a request made with request_dispute_action or request_prevention_fix: pending, approved (executed, with the PayPal result), rejected, failed, or stale (the brief changed before approval). Read-only.",
    inputSchema: { approval_id: z.string().min(4).describe("approval_id returned by a request_* tool, e.g. apv_1a2b3c4d5e.") },
    annotations: READ,
  },
  guard(async ({ approval_id }: { approval_id: string }) => {
    const { approval } = await call<{ approval: Approval }>(`/api/approvals/${encodeURIComponent(approval_id.trim())}`);
    const d = approvalData(approval);
    const res = d.result as { detail?: string; error?: string; reason?: string } | null;
    const outcome =
      d.status === "approved"
        ? `Approved by the merchant and executed: ${(res?.detail ?? "done").replace(/\.$/, "")}.`
        : d.status === "pending"
          ? `Waiting for the merchant: ${d.approval_url}`
          : d.status === "rejected"
            ? `Rejected by the merchant${res?.reason ? `: ${res.reason}` : ""}. Nothing was sent.`
            : d.status === "stale"
              ? "Expired: the brief changed before approval. Nothing was sent; request again if still wanted."
              : `Approved, but execution failed: ${res?.error ?? "unknown error"}.`;
    return ok(`${d.title} (${d.target}) · ${d.status}\n${outcome}`, d);
  }),
);

// ---- Resource and prompt ---------------------------------------------------------------------------

server.registerResource(
  "open-disputes",
  "exhibit://disputes/open",
  { title: "Open PayPal disputes", description: "The merchant's open disputes with Exhibit's call on each, as JSON.", mimeType: "application/json" },
  async (uri) => {
    const { rows } = await call<{ rows: InboxRow[] }>("/api/disputes");
    const open = rows.filter((r) => r.statusCode !== "RESOLVED").map((r) => ({ id: r.id, buyer: r.buyer, reason: r.reason, amount: r.amount, currency: r.currency, response_due: r.dueAt, exhibit_call: r.decision, win_likelihood: r.likelihood }));
    return { contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(open, null, 2) }] };
  },
);

server.registerPrompt(
  "triage_disputes",
  { title: "Triage my disputes", description: "Review every open PayPal dispute, investigate the urgent ones, and queue the strongest for the merchant's approval." },
  () => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: "Triage my open PayPal disputes with Exhibit. List them, investigate any that have no brief yet (most urgent deadline first, at most four), then rank them by expected recovery (amount × win likelihood). For the strongest case, request approval to file and give me the approval link. Summarize each case in one line with Exhibit's call and win likelihood. Do not claim anything is filed: filing happens only when I approve it in Exhibit.",
        },
      },
    ],
  }),
);

await server.connect(new StdioServerTransport());
process.stderr.write(`exhibit-mcp ${VERSION} ready (EXHIBIT_URL=${BASE})\n`);
