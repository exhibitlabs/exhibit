"use client";

import { clsx } from "clsx";
import { Bell, Bot, Check, Copy, ExternalLink, Loader2, Minus, Plug, RefreshCw, RotateCcw, Sprout, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { DemoStatus } from "@/lib/demo";
import { dateTime, relTime } from "@/lib/format";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { Tabs } from "../ui/Tabs";
import { toast } from "../ui/Toast";
import { AgentConnectCard } from "./AgentApprovals";
import { requestDemoReset } from "./AppShell";
import { PageHeader } from "./PageHeader";
import { AI_LABEL, type AiProviderKind } from "./Sidebar";

/** One settings area: a label column (what it is, its state) beside the panel that holds its values and actions. */
function Section({ title, sub, aside, children }: { title: string; sub?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-x-10 gap-y-3 border-b border-line py-7 last:border-0 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="min-w-0">
        <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
        {sub ? <p className="mt-1 text-[14px] leading-[22px] text-muted">{sub}</p> : null}
        {aside ? <div className="mt-3">{aside}</div> : null}
      </div>
      <div className="card min-w-0 border px-5 py-4">{children}</div>
    </section>
  );
}

function Line({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule py-2.5 text-[13px] last:border-0">
      <span className="shrink-0 text-muted">{k}</span>
      <span className="min-w-0 text-right text-ink">{v}</span>
    </div>
  );
}

function Check3({ state, children }: { state: "yes" | "no" | "skip"; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] leading-[20px]">
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center" aria-label={state === "yes" ? "Used" : state === "no" ? "Not available" : "Skipped"}>
        {state === "yes" ? <Check className="size-3.5 text-green" strokeWidth={2.6} /> : state === "no" ? <X className="size-3.5 text-ghost" strokeWidth={2.6} /> : <Minus className="size-3.5 text-ghost" />}
      </span>
      <span className={state === "yes" ? "text-ink" : "text-muted"}>{children}</span>
    </li>
  );
}

/** Every PayPal endpoint Exhibit's client calls (src/lib/paypal/client.ts), and what it is for. */
const ENDPOINTS: { method: "GET" | "POST"; path: string; use: string; sandbox?: boolean }[] = [
  { method: "POST", path: "/v1/oauth2/token", use: "Access token" },
  { method: "GET", path: "/v1/customer/disputes", use: "List disputes" },
  { method: "GET", path: "/v1/customer/disputes/{id}", use: "Read one dispute" },
  { method: "POST", path: "/v1/customer/disputes/{id}/provide-evidence", use: "File the evidence packet" },
  { method: "POST", path: "/v1/customer/disputes/{id}/provide-supporting-info", use: "Send to PayPal's review" },
  { method: "POST", path: "/v1/customer/disputes/{id}/make-offer", use: "Offer a refund or replacement" },
  { method: "POST", path: "/v1/customer/disputes/{id}/accept-claim", use: "Accept and refund" },
  { method: "POST", path: "/v1/customer/disputes/{id}/send-message", use: "Message the buyer" },
  { method: "GET", path: "/v2/checkout/orders/{id}", use: "Read the order" },
  { method: "POST", path: "/v2/checkout/orders/{id}/track", use: "Push tracking to PayPal" },
  { method: "GET", path: "/v2/payments/captures/{id}", use: "Read the capture" },
  { method: "POST", path: "/v2/payments/captures/{id}/refund", use: "Refund before filing proof" },
  { method: "POST", path: "/v1/notifications/verify-webhook-signature", use: "Verify webhooks" },
  { method: "POST", path: "/v1/customer/disputes/{id}/adjudicate", use: "Sandbox only: rule as PayPal's reviewer", sandbox: true },
  { method: "POST", path: "/v1/customer/disputes/{id}/require-evidence", use: "Sandbox only: ask for evidence", sandbox: true },
  { method: "POST", path: "/v2/checkout/orders", use: "Sandbox seeding: create orders", sandbox: true },
  { method: "POST", path: "/v2/checkout/orders/{id}/capture", use: "Sandbox seeding: capture", sandbox: true },
  { method: "POST", path: "/v2/customer-support/process-chargeback", use: "Sandbox seeding: open a chargeback", sandbox: true },
];

type Seed = { key: string; title: string; buyer: string; amount: string; order_id: string; approve_url?: string; status: "awaiting_buyer" | "disputed" | "error"; dispute_id?: string; error?: string };
const subscribe = () => () => {};

const NAV = [
  ["paypal", "PayPal"],
  ["ai", "AI"],
  ["webhooks", "Webhooks"],
  ["mcp", "AI agents"],
  ["demo", "Demo"],
] as const;
type Area = (typeof NAV)[number][0];

const hashSubscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};
const readArea = (): Area => {
  const h = window.location.hash.slice(1);
  return (NAV.some(([id]) => id === h) ? h : "paypal") as Area;
};

export function SettingsView({
  mode,
  provider,
  model,
  askLabel,
  ai,
  clientId,
  configuredAppUrl,
  webhookIdSet,
  mcpLocalPath,
  pendingApprovals,
  demo,
}: {
  mode: string;
  provider: AiProviderKind;
  model: string;
  askLabel: string;
  ai: { forced: string | null; apiKey: boolean; cliLogin: boolean; cliDisabled: boolean };
  clientId: string;
  configuredAppUrl: string | null;
  webhookIdSet: boolean;
  mcpLocalPath: string;
  pendingApprovals: number;
  demo: (DemoStatus & { resetReason: string | null }) | null;
}) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "");
  const webhookUrl = `${origin}/api/webhooks/paypal`;
  const [check, setCheck] = useState<{ ok: boolean | null; error?: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [seeds, setSeeds] = useState<Seed[]>([]);
  const [seedError, setSeedError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const hashArea = useSyncExternalStore(hashSubscribe, readArea, () => "paypal" as Area);
  const area: Area = hashArea === "demo" && !demo ? "paypal" : hashArea;
  const go = (id: Area) => {
    window.history.replaceState(null, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  const test = async () => {
    setBusy("test");
    const r = await fetch("/api/status?check=1").then((x) => x.json());
    setCheck({ ok: r.paypalOk, error: r.paypalError });
    setBusy(null);
  };
  useEffect(() => {
    if (mode !== "sandbox") return;
    void fetch("/api/sandbox/seed")
      .then((r) => r.json())
      .then((d) => setSeeds(d.seeds ?? []));
  }, [mode]);

  const seedOp = async (op: "start" | "finalize") => {
    setBusy(op);
    setSeedError(null);
    const r = await fetch("/api/sandbox/seed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op }) }).then((x) => x.json());
    if (r.error) setSeedError(r.error);
    else setSeeds(r.seeds ?? []);
    setBusy(null);
  };

  const incoming = async () => {
    setBusy("incoming");
    const r = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "incoming" }) }).then((x) => x.json());
    toast({ title: "Webhook: CUSTOMER.DISPUTE.CREATED", sub: `${r.dispute_id ?? "New dispute"} · Exhibit is investigating it now` });
    setBusy(null);
  };
  const agentRequest = async () => {
    setBusy("agent");
    const r = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "agent_request" }) }).then((x) => x.json());
    if (r.error) toast({ title: "No request sent", sub: r.error, tone: "error" });
    else toast({ title: "A demo agent asked to act", sub: `${r.approval.title} · see Agent requests` });
    window.dispatchEvent(new Event("exhibit:nav"));
    setBusy(null);
  };

  const order: { state: "yes" | "no" | "skip"; text: React.ReactNode }[] = ai.forced
    ? [{ state: "yes", text: <>Forced by <span className="mono text-[12px]">EXHIBIT_AI_PROVIDER={ai.forced}</span>, so the order below is skipped.</> }]
    : [
        { state: ai.apiKey ? "yes" : "no", text: <><span className="mono text-[12px]">ANTHROPIC_API_KEY</span> set: run on the Claude API.</> },
        { state: ai.apiKey ? "skip" : ai.cliDisabled ? "no" : ai.cliLogin ? "yes" : "no", text: <>Claude CLI login on this machine (<span className="mono text-[12px]">~/.claude</span>){ai.cliDisabled ? ", turned off by EXHIBIT_ALLOW_CLAUDE_CODE=0" : ""}: run through the Claude Agent SDK, no key needed.</> },
        { state: provider === "replay" ? "yes" : "skip", text: <>Otherwise: replay the recorded run for the case.</> },
      ];

  const statusChip = (on: boolean, label: string) => <Chip tone={on ? "green" : "neutral"} dot>{label}</Chip>;
  return (
    <>
      <PageHeader title="Settings" subtitle={`${mode === "sandbox" ? "Connected to your PayPal sandbox" : "Demo merchant on the built-in PayPal simulator"}; the case agent ${provider === "replay" ? "replays recorded Claude runs" : provider === "claude-code" ? "runs live on this machine's Claude CLI" : "runs live on the Claude API"}.`} />
      <div className="px-4 pt-5 sm:px-6">
        <div className="border-b border-line">
          <Tabs value={area} onChange={go} tabs={NAV.filter(([id]) => id !== "demo" || demo).map(([id, label]) => ({ key: id, label }))} />
        </div>
        <div>
          {area === "paypal" ? (
            <>
              <Section title="PayPal connection" sub={mode === "sandbox" ? "A live sandbox REST app: every call goes to api-m.sandbox.paypal.com." : "No PayPal credentials are set, so Exhibit talks to its built-in simulator, with the real API's request and response shapes."} aside={statusChip(mode === "sandbox", mode === "sandbox" ? "Sandbox · live API" : "Demo · simulator")}>
                <Line k="Environment" v={mode === "sandbox" ? <span className="mono text-[12px]">api-m.sandbox.paypal.com</span> : "Built-in simulator (Disputes v1, Orders v2, Payments v2)"} />
                <Line k="Client ID" v={mode === "sandbox" ? <span className="mono text-[12px]">{clientId || "not set"}</span> : <span className="text-muted">Not used in demo mode</span>} />
                <Line k="APIs used" v="Disputes, Orders, Payments, Webhooks, OAuth" />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button size="sm" onClick={test} disabled={!!busy}>
                    {busy === "test" ? <Loader2 className="size-3.5 animate-spin" /> : <Plug className="size-3.5" />} Test connection
                  </Button>
                  {check ? (
                    check.ok ? (
                      <span role="status" className="inline-flex items-center gap-1 text-[13px] text-green">
                        <Check className="size-3.5" /> {mode === "sandbox" ? "OAuth and the Disputes API answered" : "Simulator OAuth and Disputes API answered"}
                      </span>
                    ) : (
                      <span role="alert" className="inline-flex items-center gap-1 text-[13px] text-red">
                        <X className="size-3.5" /> {check.error}
                      </span>
                    )
                  ) : null}
                </div>
                {mode !== "sandbox" ? (
                  <p className="mt-4 rounded-[8px] bg-sunken px-3.5 py-3 text-[13px] leading-[20px] text-ink-2">
                    To use your PayPal sandbox, set <code className="mono text-[12px]">PAYPAL_CLIENT_ID</code> and <code className="mono text-[12px]">PAYPAL_CLIENT_SECRET</code> from a sandbox REST app (developer.paypal.com, Apps &amp; Credentials) and restart. The same client code then calls the real API; the demo data is never mixed in.
                  </p>
                ) : null}
              </Section>
              <Section title="What Exhibit calls" sub="The PayPal REST endpoints behind every screen. Each call is logged in PayPal activity with its request, response and debug id." aside={<span className="num text-[13px] text-muted">{ENDPOINTS.length} endpoints</span>}>
                <ul>
                  {ENDPOINTS.map((e) => (
                    <li key={`${e.method} ${e.path}`} className="flex items-baseline gap-3 border-b border-rule py-2 text-[13px] last:border-0">
                      <span className={clsx("mono w-12 shrink-0 font-medium", e.method === "GET" ? "text-muted" : "text-ink")}>{e.method}</span>
                      <span className="mono min-w-0 flex-1 truncate text-ink" title={e.path}>
                        {e.path}
                      </span>
                      <span className={clsx("hidden shrink-0 text-right sm:block", e.sandbox ? "text-muted" : "text-ink-2")}>{e.use}</span>
                    </li>
                  ))}
                </ul>
              </Section>
              {mode === "sandbox" ? (
                <Section title="Seed the sandbox" sub="Create real Orders v2 orders, pay them as a sandbox buyer, then open chargebacks Exhibit can work." aside={<span className="num text-[13px] text-muted">{seeds.filter((x) => x.status === "disputed").length} of {seeds.length} disputed</span>}>
                  <ol className="grid gap-4 text-[13px] leading-[20px] text-ink-2 md:grid-cols-3">
                    <li>
                      <div className="mb-0.5 font-medium text-ink">1. Create orders</div>
                      One real Orders v2 order per demo scenario. Card-enabled accounts capture at once; otherwise each order waits for a buyer.
                    </li>
                    <li>
                      <div className="mb-0.5 font-medium text-ink">2. Approve as the buyer</div>
                      Open each checkout in a private window and pay with a sandbox test card (sign out of PayPal between buyers).
                    </li>
                    <li>
                      <div className="mb-0.5 font-medium text-ink">3. Capture and open chargebacks</div>
                      Captures approved orders, opens a chargeback with process-chargeback, and writes the store records.
                    </li>
                  </ol>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="primary" onClick={() => seedOp("start")} disabled={!!busy}>
                      {busy === "start" ? <Loader2 className="size-3.5 animate-spin" /> : <Sprout className="size-3.5" />} Create sandbox orders
                    </Button>
                    <Button size="sm" onClick={() => seedOp("finalize")} disabled={!!busy || !seeds.some((x) => x.status === "awaiting_buyer")}>
                      {busy === "finalize" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Capture approved and open chargebacks
                    </Button>
                  </div>
                  {seedError ? (
                    <p role="alert" className="mt-3 text-[13px] text-red">
                      {seedError}
                    </p>
                  ) : null}
                  {seeds.length ? (
                    <div className="scroll-thin mt-4 overflow-x-auto">
                      <table className="w-full min-w-[560px] text-[13px]">
                        <thead>
                          <tr className="border-b border-line text-left text-[12px] text-muted">
                            <th className="h-9 font-normal">Scenario</th>
                            <th className="h-9 font-normal">Buyer</th>
                            <th className="h-9 font-normal">PayPal order</th>
                            <th className="h-9 font-normal">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {seeds.map((x) => (
                            <tr key={`${x.key}-${x.order_id}`} className="border-b border-rule align-top last:border-0">
                              <td className="py-2 pr-3 text-ink">{x.title}</td>
                              <td className="py-2 pr-3 text-ink-2">
                                {x.buyer} · <span className="mono text-[12px]">${x.amount}</span>
                              </td>
                              <td className="mono py-2 pr-3 text-[12px] text-muted">{x.order_id || "none"}</td>
                              <td className="py-2">
                                {x.status === "disputed" ? (
                                  <a href={`/app/disputes/${x.dispute_id}`} className="mono rounded-[4px] text-[12px] text-ink underline decoration-line-strong underline-offset-2">
                                    {x.dispute_id}
                                  </a>
                                ) : x.status === "awaiting_buyer" && x.approve_url ? (
                                  <a href={x.approve_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-[4px] text-ink underline decoration-line-strong underline-offset-2">
                                    Open PayPal checkout as the buyer <ExternalLink className="size-3" />
                                  </a>
                                ) : (
                                  <span className="text-red">{x.error ?? x.status}</span>
                                )}
                                {x.error && x.status !== "error" ? <div className="mt-1 text-[12px] text-red">{x.error}</div> : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </Section>
              ) : null}
            </>
          ) : null}

          {area === "ai" ? (
            <Section title="AI" sub="The case agent and Ask Exhibit run on Claude. Exhibit uses the first option that works, in this order." aside={statusChip(provider !== "replay", AI_LABEL[provider])}>
              <ol className="space-y-2 border-b border-line pb-4">
                {order.map((o, i) => (
                  <Check3 key={i} state={o.state}>
                    {o.text}
                  </Check3>
                ))}
              </ol>
              <div className="pt-1">
                <Line k="Case agent" v={<span className="mono text-[12px]">{provider === "replay" ? "recorded runs (Claude, 20 Oct 2026)" : model}</span>} />
                <Line k="Ask Exhibit" v={askLabel} />
                <Line k="Thinking" v="Adaptive, summarized into the trace" />
                <Line k="Tools" v="9: PayPal, store, carrier, risk, policy, brief" />
                <Line k="Guardrails" v="Cited records only · only an action the dispute allows when the brief is written" />
              </div>
              <p className="mt-4 rounded-[8px] bg-sunken px-3.5 py-3 text-[13px] leading-[20px] text-ink-2">
                {provider === "claude-code"
                  ? "Runs use this machine's Claude CLI login through the Claude Agent SDK, with only Exhibit's nine tools attached. If the CLI can't start (signed out, say), a run falls back to the recorded run for that case and the trace says so. A case with no recording then needs the CLI or an API key."
                  : provider === "anthropic"
                    ? "Runs call the Claude API directly with streaming tool use. Set a spending cap on the key for a public deployment."
                    : "No live model here, so each investigation replays a recorded Claude run. The reasoning text is the recording; every tool call, citation check and PayPal request runs live against the case, and the brief must pass the same validation as a live one. Sign in to the Claude CLI (claude login) or set ANTHROPIC_API_KEY to run it live."}
              </p>
            </Section>
          ) : null}

          {area === "webhooks" ? (
            <Section title="Webhooks" sub="PayPal reports new and updated disputes here; Exhibit starts the investigation the moment one arrives." aside={statusChip(mode === "sandbox" && webhookIdSet, mode === "sandbox" ? (webhookIdSet ? "Signatures verified" : "Webhook id not set") : "Simulated in demo")}>
              <p className="text-[13px] leading-[20px] text-ink-2">
                Add this listener to your PayPal app and subscribe to <span className="mono text-[12px]">CUSTOMER.DISPUTE.CREATED</span>, <span className="mono text-[12px]">CUSTOMER.DISPUTE.UPDATED</span> and <span className="mono text-[12px]">CUSTOMER.DISPUTE.RESOLVED</span>.
              </p>
              <div className="mt-3 flex items-center">
                <code className="mono h-8 min-w-0 flex-1 truncate rounded-l-[8px] border border-r-0 border-line-strong bg-sunken px-3 text-[12px] leading-[30px] text-ink">{origin ? webhookUrl : "…"}</code>
                <Button
                  aria-label="Copy webhook URL"
                  className="rounded-l-none"
                  onClick={() => {
                    void navigator.clipboard?.writeText(webhookUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <p className="mt-2 text-[12px] leading-[18px] text-muted">
                The address this app is open on. PayPal needs a public URL: deploy it, or expose this machine with a tunnel.
                {configuredAppUrl && configuredAppUrl !== origin ? (
                  <>
                    {" "}
                    EXHIBIT_APP_URL is set to <span className="mono">{configuredAppUrl}</span> for PayPal checkout return links.
                  </>
                ) : null}
              </p>
              <div className="mt-3 border-t border-line pt-1">
                <Line k="Signature verification" v={mode === "sandbox" ? (webhookIdSet ? "PayPal verify-webhook-signature, on" : <span className="text-red">Set PAYPAL_WEBHOOK_ID</span>) : "Simulated in demo"} />
              </div>
            </Section>
          ) : null}

          {area === "mcp" ? (
            <Section title="Connect an AI agent" sub="Exhibit is an MCP server: nine tools over stdio, two of which only ask. Anything that reaches PayPal or a buyer waits for you in Agent requests." aside={<Chip tone="outline">MCP · stdio</Chip>}>
              <AgentConnectCard serverPath={mcpLocalPath} pendingCount={pendingApprovals} />
            </Section>
          ) : null}

          {area === "demo" && demo ? (
            <Section title="Demo merchant" sub="A shared demo that heals itself, so every visitor gets a fresh start." aside={<Chip dot>Demo data</Chip>}>
              <Line k="Last reset" v={demo.seededAt ? <span suppressHydrationWarning>{`${relTime(demo.seededAt)} · ${demo.resetReason === "idle" ? "after a quiet spell" : demo.resetReason === "manual" ? "reset from the app" : "first visit"}`}</span> : "never"} />
              <Line k="Resets on its own" v={<span suppressHydrationWarning>{demo.resetsAfter ? `after ${demo.idleMinutes} quiet minutes (next: ${dateTime(demo.resetsAfter)} if nobody is using it)` : `after ${demo.idleMinutes} quiet minutes`}</span>} />
              <Line k="Deadlines" v="Counted from the moment of each reset, so they never go stale" />
              <Line k="Data" v="Kora Atelier, its buyers, orders and carrier scans are fictional" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={requestDemoReset}>
                  <RotateCcw className="size-3.5" /> Reset demo
                </Button>
                <Button size="sm" onClick={incoming} disabled={!!busy}>
                  {busy === "incoming" ? <Loader2 className="size-3.5 animate-spin" /> : <Bell className="size-3.5" />} Simulate new dispute
                </Button>
                <Button size="sm" onClick={agentRequest} disabled={!!busy}>
                  {busy === "agent" ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />} Send a demo agent request
                </Button>
              </div>
              <p className="mt-3 text-[12px] leading-[18px] text-muted">A reset prepares briefs on six cases from recorded runs (every tool call executes live) and leaves two for you to run. Sandbox mode is never reset.</p>
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}
