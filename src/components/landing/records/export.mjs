// Exports the real records the landing page and /proof render, so the public site needs no database,
// no credentials and no network. Everything is read-only.
//
//   node src/components/landing/records/export.mjs [--ask path/to/answer.sse] [--prevention http://localhost:3101/api/prevention]
//
// Sources:
//   .data/exhibit-sandbox.db  runs, API log, actions and disputes from Exhibit's live PayPal sandbox mode
//   .data/exhibit-demo.db     the demo merchant's prevention record for the order Exhibit saved
//   --prevention              the demo server's own Prevention report (GET /api/prevention, or a saved copy
//                             of it), for the radar. Note: a GET can trigger the demo's idle reseed.
//   --ask                     a captured Ask Exhibit answer (the SSE stream from POST /api/ask)
//
// Sanitising: no request or response bodies, no tokens, no request ids, no buyer emails or payer ids.
// Kept: method, path, HTTP status, latency, PayPal-Debug-Id, timestamps, dispute ids, and the
// agent's own words (summaries, exhibits, reasoning) exactly as it wrote them.

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "src/components/landing/records");
const arg = (name) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};

const sandbox = new DatabaseSync(path.join(ROOT, ".data/exhibit-sandbox.db"), { readOnly: true });
const demo = new DatabaseSync(path.join(ROOT, ".data/exhibit-demo.db"), { readOnly: true });

const write = (file, data) => {
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(data, null, 2) + "\n");
  console.log("wrote", file);
};

// ---- Hero: two real sandbox runs ----------------------------------------------------------------

const TOOL_NODE = {
  get_paypal_dispute: "paypal",
  lookup_order: "order",
  get_carrier_tracking: "carrier",
  get_customer_history: "customer",
  get_payment_risk_signals: "risk",
  get_support_conversation: "inbox",
  get_store_policies: "policies",
  check_seller_protection: "protection",
};

function refNode(ref) {
  const [ns, sub] = ref.split(":");
  if (ns === "paypal") return sub === "seller-protection" ? "protection" : "paypal";
  if (ns === "order" || ns === "listing") return "order";
  if (ns === "shipment") return "carrier";
  if (ns === "customer") return "customer";
  if (ns === "risk") return "risk";
  if (ns === "msg" || ns === "conversation") return "inbox";
  if (ns === "policy") return "policies";
  return null;
}

// Refs name a record. Customer refs carry the buyer's email, so show the namespace only.
const safeRef = (ref) => (ref.startsWith("customer:") ? "customer:history" : ref);

function heroRun(disputeId) {
  const r = sandbox.prepare("SELECT * FROM runs WHERE dispute_id = ? AND status = 'done' ORDER BY started_at DESC LIMIT 1").get(disputeId);
  if (!r) throw new Error(`no finished run for ${disputeId}`);
  const events = JSON.parse(r.events);
  const brief = JSON.parse(r.brief);
  const t0 = Date.parse(r.started_at);
  const results = new Map(events.filter((e) => e.t === "tool_result").map((e) => [e.id, e]));
  const calls = events.filter((e) => e.t === "tool_call");
  const done = events.find((e) => e.t === "done");
  const steps = calls
    .filter((c) => c.name !== "file_case_brief")
    .map((c) => {
      const res = results.get(c.id);
      const input = c.input ?? {};
      const shown = Object.entries(input).find(([k, v]) => typeof v === "string" && k !== "email");
      return { node: TOOL_NODE[c.name], tool: c.name, arg: shown ? `${shown[0]}: ${shown[1]}` : null, at: Date.parse(c.at) - t0, ms: res?.ms ?? null, ok: res?.ok ?? false, summary: res?.summary ?? "" };
    });
  const briefCall = calls.find((c) => c.name === "file_case_brief");
  const dispute = results.get(calls.find((c) => c.name === "get_paypal_dispute")?.id)?.output ?? {};
  const order = results.get(calls.find((c) => c.name === "lookup_order")?.id)?.output ?? {};
  return {
    disputeId,
    runId: r.id,
    provider: r.provider,
    model: r.model,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    durationMs: done?.ms ?? Date.parse(r.finished_at) - t0,
    briefAt: briefCall ? Date.parse(briefCall.at) - t0 : null,
    claim: {
      reason: dispute.reason ?? null,
      stage: dispute.stage ?? null,
      status: dispute.status ?? null,
      reasonCode: dispute.external_reason_code ?? null,
      amount: Number(dispute.amount?.value ?? 0),
      currency: dispute.amount?.currency_code ?? "USD",
      buyer: dispute.transaction?.buyer?.name ?? null,
      item: order.items?.[0]?.name ?? null,
      orderId: order.order_id ?? null,
      allowedActions: dispute.allowed_actions ?? [],
    },
    steps,
    brief: {
      decision: brief.decision,
      headline: brief.headline,
      summary: brief.summary,
      winLikelihood: brief.win_likelihood,
      confidence: brief.confidence,
      reasoning: brief.reasoning.map((x) => ({ point: x.point, refs: x.refs.map(safeRef) })),
      risks: brief.risks ?? [],
      exhibits: brief.exhibits.map((x) => ({ label: x.label, title: x.title, ref: safeRef(x.ref), node: refNode(x.ref), why: x.why })),
      action: brief.paypal_action,
      letterOpening: (brief.response_letter ?? "").split("\n")[0],
      buyerMessage: brief.buyer_message ? { language: brief.buyer_message.language, text: brief.buyer_message.text } : null,
    },
  };
}

const fight = heroRun("PP-R-EGO-10193744");
const refund = heroRun("PP-R-KHB-10193747");
// The second honest refund on the sandbox, shown in the "fair to buyers" section.
const refund2 = heroRun("PP-R-XTI-10193748");

// ---- Prevention: the demo merchant's saved order ------------------------------------------------

const doc = (db, kind, id) => {
  const row = db.prepare("SELECT json FROM docs WHERE kind = ? AND id = ?").get(kind, id);
  return row ? JSON.parse(row.json) : null;
};

const SAVED = "KA-10561";
const pv = doc(demo, "prevention", SAVED);
const previous = fs.existsSync(path.join(OUT, "prevention.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "prevention.json"), "utf8")) : null;
// The demo store reseeds itself when idle, which clears prevention history. Keep the recorded save then.
const keepSave = !pv && previous?.save;
if (keepSave) console.log(`demo store has no prevention record for ${SAVED} (reseeded); keeping the recorded save`);
const pvOrder = keepSave ? null : doc(demo, "order", SAVED);
const pvShip = keepSave ? null : doc(demo, "shipment", pvOrder.shipment_ids[0]);
const pvConv = keepSave ? null : doc(demo, "conversation", SAVED);
const pvRisk = keepSave ? null : doc(demo, "risk", SAVED);
const pvCustomer = keepSave ? null : doc(demo, "customer", pvOrder.customer_email);
const fix = keepSave ? null : pv.actions.find((a) => a.ok);
const buyerMsg = keepSave ? null : pvConv.messages.find((m) => m.from === "customer");
const lastScan = keepSave ? null : pvShip.events.at(-1);

let radar = null;
const prevUrl = arg("--prevention");
if (prevUrl) {
  const rep = /^https?:/.test(prevUrl) ? await (await fetch(prevUrl)).json() : JSON.parse(fs.readFileSync(prevUrl, "utf8"));
  radar = {
    capturedAt: rep.generatedAt,
    totals: rep.totals,
    bySignal: rep.bySignal.map((s) => ({ kind: s.kind, label: s.label, reason: s.reasonLabel, count: s.count, exposure: s.exposure })),
    orders: rep.orders.map((o) => ({
      id: o.orderId,
      buyer: o.buyer,
      country: o.country,
      item: o.item,
      amount: o.amount,
      funding: o.funding,
      fee: o.fee,
      exposure: o.exposure,
      status: o.status,
      band: o.band,
      score: o.score,
      signal: o.top ? { kind: o.top.kind, label: o.top.label, detail: o.top.detail, reason: o.top.reasonLabel } : null,
      fix: o.fixes?.find((f) => f.primary) ? { action: o.fixes.find((f) => f.primary).action, label: o.fixes.find((f) => f.primary).label, channel: o.fixes.find((f) => f.primary).channel, api: o.fixes.find((f) => f.primary).api ?? null } : null,
    })),
    fee: rep.fee,
  };
} else {
  const prev = path.join(OUT, "prevention.json");
  if (fs.existsSync(prev)) radar = JSON.parse(fs.readFileSync(prev, "utf8")).radar;
}

const prevention = {
  source: "Demo merchant (Kora Atelier), PayPal simulator",
  save: keepSave ? previous.save : {
    orderId: SAVED,
    buyer: pvCustomer.name,
    country: pvCustomer.country,
    item: pvOrder.items[0].name,
    amount: pvOrder.total,
    currency: pvOrder.currency,
    funding: pvOrder.paypal.funding,
    placedAt: pvOrder.placed_at,
    shipment: { carrier: "DHL Express", tracking: pvShip.tracking_number, shippedAt: pvShip.shipped_at, status: pvShip.status, onPayPal: pvShip.pushed_to_paypal, lastScan: { at: lastScan.at, location: lastScan.location, description: lastScan.description }, scans: pvShip.events.length },
    risk: { avs: pvRisk.avs_result, cvv: pvRisk.cvv_result, ipCity: pvRisk.ip.city, ipCountry: pvRisk.ip.country, ipToShippingKm: pvRisk.ip_to_shipping_km },
    history: { orders: pvCustomer.order_ids.length, priorDisputes: pvCustomer.prior_disputes },
    buyerMessage: { at: buyerMsg.at, language: buyerMsg.language, subject: buyerMsg.subject, body: buyerMsg.body },
    fix: { at: fix.at, action: fix.action, before: fix.before, after: fix.after, saved: fix.saved, message: { language: fix.message.language, subject: fix.message.subject, body: fix.message.body } },
  },
  radar,
};

// ---- Proof: the sandbox API log, actions, runs and dispute states -------------------------------

const apiRows = sandbox.prepare("SELECT id, at, dispute_id, meta FROM activity WHERE kind = 'api' ORDER BY id").all();
const seenDebug = new Set();
const calls = [];
let cacheHits = 0;
for (const row of apiRows) {
  const m = JSON.parse(row.meta ?? "{}");
  if (m.mode !== "sandbox") continue;
  // The client replays a fresh dispute read from memory for a few seconds; those rows reuse the
  // original PayPal-Debug-Id with ~0 ms latency. They are not separate calls to PayPal.
  if (m.debugId && seenDebug.has(m.debugId) && m.ms < 20) {
    cacheHits++;
    continue;
  }
  if (m.debugId) seenDebug.add(m.debugId);
  calls.push({ at: row.at, method: m.method, path: m.path, status: m.status, ms: m.ms, debugId: m.debugId ?? null, disputeId: row.dispute_id ?? null });
}

const endpointOf = (p) =>
  p
    .replace(/\?.*$/, "")
    .replace(/PP-[A-Z]-[A-Z0-9-]+/g, "{id}")
    .replace(/\/orders\/[^/]+/, "/orders/{id}")
    .replace(/\/captures\/[^/]+/, "/captures/{id}");

const surface = new Map();
for (const c of calls) {
  const key = `${c.method} ${endpointOf(c.path)}`;
  const s = surface.get(key) ?? { method: c.method, endpoint: endpointOf(c.path), calls: 0, ok: 0, errors: 0, latencies: [], statuses: {} };
  s.calls++;
  if (c.status < 400) s.ok++;
  else s.errors++;
  s.latencies.push(c.ms);
  s.statuses[c.status] = (s.statuses[c.status] ?? 0) + 1;
  surface.set(key, s);
}
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : Math.round((s[s.length / 2 - 1] + s[s.length / 2]) / 2);
};
const endpoints = [...surface.values()].map(({ latencies, ...s }) => ({ ...s, medianMs: median(latencies) })).sort((a, b) => b.calls - a.calls);

// Calls that change something at PayPal, newest last.
const WRITE = /provide-evidence|provide-supporting-info|accept-claim|adjudicate|process-chargeback|\/capture$|make-offer|send-message|\/refund$|\/track$/;
const writes = calls.filter((c) => c.method === "POST" && WRITE.test(c.path));

const runs = sandbox
  .prepare("SELECT id, dispute_id, provider, model, status, started_at, finished_at, brief, error FROM runs ORDER BY started_at")
  .all()
  .map((r) => {
    const b = r.brief ? JSON.parse(r.brief) : null;
    return {
      id: r.id,
      disputeId: r.dispute_id,
      provider: r.provider,
      model: r.model,
      status: r.status,
      startedAt: r.started_at,
      durationMs: r.finished_at ? Date.parse(r.finished_at) - Date.parse(r.started_at) : null,
      decision: b?.decision ?? null,
      winLikelihood: b?.win_likelihood ?? null,
      exhibits: b?.exhibits?.length ?? null,
      error: r.error ?? null,
    };
  });

const disputes = sandbox
  .prepare("SELECT id, json, updated_at FROM docs WHERE kind = 'dispute' ORDER BY id")
  .all()
  .map((row) => {
    const d = JSON.parse(row.json);
    return {
      id: d.dispute_id,
      reason: d.reason,
      stage: d.dispute_life_cycle_stage,
      channel: d.dispute_channel,
      status: d.status,
      amount: Number(d.dispute_amount?.value ?? 0),
      currency: d.dispute_amount?.currency_code ?? "USD",
      buyer: d.disputed_transactions?.[0]?.buyer?.name ?? null,
      captureId: d.disputed_transactions?.[0]?.seller_transaction_id ?? null,
      outcome: d.dispute_outcome ? { code: d.dispute_outcome.outcome_code, reason: d.dispute_outcome.outcome_reason ?? null } : null,
      createdAt: d.create_time,
      updatedAt: d.update_time,
      checkedAt: row.updated_at,
    };
  });

const actions = sandbox
  .prepare("SELECT dispute_id, kind, actor, status, created_at FROM actions ORDER BY created_at")
  .all()
  .map((a) => ({ disputeId: a.dispute_id, kind: a.kind, actor: a.actor, status: a.status, at: a.created_at }));

write("proof.json", {
  host: "api-m.sandbox.paypal.com",
  exportedFrom: ".data/exhibit-sandbox.db (activity, runs, actions, docs)",
  firstCall: calls[0]?.at ?? null,
  lastCall: calls.at(-1)?.at ?? null,
  cacheRowsDropped: cacheHits,
  totals: { calls: calls.length, ok: calls.filter((c) => c.status < 400).length, errors: calls.filter((c) => c.status >= 400).length, endpoints: endpoints.length, disputes: disputes.length, runs: runs.length },
  disputes,
  runs,
  actions,
  writes,
  endpoints,
  calls,
});

write("hero-runs.json", { fight, refund, refund2 });

// ---- Demo merchant: the decision on each recorded case (replays/*.json) --------------------------

const replayDir = path.join(ROOT, "replays");
write("demo-briefs.json", {
  source: "replays/*.json: recorded Claude runs on the demo merchant's eight open cases",
  cases: fs
    .readdirSync(replayDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const r = JSON.parse(fs.readFileSync(path.join(replayDir, f), "utf8"));
      return { scenario: f.replace(/\.json$/, ""), decision: r.brief.decision, winLikelihood: r.brief.win_likelihood, headline: r.brief.headline };
    }),
});
write("prevention.json", prevention);

// ---- Ask Exhibit: one captured live answer -------------------------------------------------------

const askPath = arg("--ask");
if (askPath) {
  const events = fs
    .readFileSync(askPath, "utf8")
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => JSON.parse(l.slice(5)));
  const start = events.find((e) => e.t === "start");
  const answer = events.find((e) => e.t === "answer")?.answer;
  const doneEvt = events.find((e) => e.t === "done");
  const steps = events.filter((e) => e.t === "step").map((e) => {
    const d = events.find((x) => x.t === "step_done" && x.id === e.step.id);
    return { name: e.step.name, label: e.step.label, summary: d?.summary ?? "", ms: d?.ms ?? null };
  });
  write("ask.json", {
    question: arg("--question") ?? null,
    capturedAt: arg("--captured-at") ?? fs.statSync(askPath).mtime.toISOString(),
    provider: start?.provider,
    model: start?.model,
    mode: "sandbox",
    ms: doneEvt?.ms ?? null,
    steps,
    answer: {
      text: answer.text,
      chart: answer.chart,
      cases: answer.cases.map((c) => ({ id: c.id, buyer: c.buyer, reason: c.reason, amount: c.amount, currency: c.currency, status: c.status, decision: c.decision, note: c.note ?? null })),
      followups: answer.followups,
    },
  });
}
