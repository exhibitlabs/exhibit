"use client";

import { clsx } from "clsx";
import { Bell, Bot, Check, Copy, ExternalLink, Loader2, Minus, Plug, RefreshCw, RotateCcw, Sprout, X } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { DemoStatus } from "@/lib/demo";
import { dateTime, relTime } from "@/lib/format";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { toast } from "../ui/Toast";
import { AgentConnectCard } from "./AgentApprovals";
import { requestDemoReset } from "./AppShell";
import { PageHeader } from "./PageHeader";
import { AI_LABEL, type AiProviderKind } from "./Sidebar";

function Section({ id, title, sub, aside, children }: { id: string; title: string; sub?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="card scroll-mt-24">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-[14.5px] font-medium">{title}</h2>
          {sub ? <p className="mt-0.5 text-[12.5px] text-muted">{sub}</p> : null}
        </div>
        {aside}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Line({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/70 py-2.5 text-[13px] last:border-0">
      <span className="shrink-0 text-muted">{k}</span>
      <span className="min-w-0 text-right">{v}</span>
    </div>
  );
}

function Check3({ state, children }: { state: "yes" | "no" | "skip"; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[12.5px] leading-snug">
      <span className={clsx("mt-px flex size-4 shrink-0 items-center justify-center rounded-full", state === "yes" ? "bg-green-soft text-green" : state === "no" ? "bg-sunken text-faint" : "bg-sunken text-faint")}>
        {state === "yes" ? <Check className="size-2.5" strokeWidth={3.5} /> : state === "no" ? <X className="size-2.5" strokeWidth={3} /> : <Minus className="size-2.5" />}
      </span>
      <span className={state === "yes" ? "text-ink" : "text-muted"}>{children}</span>
    </li>
  );
}

type Seed = { key: string; title: string; buyer: string; amount: string; order_id: string; approve_url?: string; status: "awaiting_buyer" | "disputed" | "error"; dispute_id?: string; error?: string };
const subscribe = () => () => {};

const NAV = [
  ["paypal", "PayPal connection"],
  ["ai", "AI"],
  ["webhooks", "Webhooks"],
  ["mcp", "Connect an AI agent"],
  ["demo", "Demo"],
] as const;

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
    ? [{ state: "yes", text: <>Forced by <span className="num">EXHIBIT_AI_PROVIDER={ai.forced}</span>, so the order below is skipped.</> }]
    : [
        { state: ai.apiKey ? "yes" : "no", text: <><span className="num">ANTHROPIC_API_KEY</span> set: run on the Claude API.</> },
        { state: ai.apiKey ? "skip" : ai.cliDisabled ? "no" : ai.cliLogin ? "yes" : "no", text: <>Claude CLI login on this machine (<span className="num">~/.claude</span>){ai.cliDisabled ? ", turned off by EXHIBIT_ALLOW_CLAUDE_CODE=0" : ""}: run through the Claude Agent SDK, no key needed.</> },
        { state: provider === "replay" ? "yes" : "skip", text: <>Otherwise: replay the recorded run for the case.</> },
      ];

  return (
    <>
      <PageHeader eyebrow="Connections" title="Settings" subtitle="Where Exhibit gets its facts, how it reaches PayPal, which AI runs the agent, and how other agents connect." />
      <div className="grid items-start gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:px-8">
        <nav className="sticky top-6 hidden flex-col gap-0.5 text-[13px] lg:flex" aria-label="Settings sections">
          {NAV.filter(([id]) => id !== "demo" || demo).map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-md px-2.5 py-1.5 text-ink-2 transition-colors hover:bg-sunken hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <div className="min-w-0 max-w-[880px] space-y-5">
          <Section id="paypal" title="PayPal connection" sub={mode === "sandbox" ? "Live sandbox REST app: every call goes to api-m.sandbox.paypal.com." : "No PayPal credentials here, so Exhibit talks to its built-in simulator."} aside={<Chip tone={mode === "sandbox" ? "green" : "neutral"} dot>{mode === "sandbox" ? "Sandbox · live API" : "Demo · simulator"}</Chip>}>
            <Line k="Environment" v={mode === "sandbox" ? <span className="num text-[12.5px]">api-m.sandbox.paypal.com</span> : "Built-in simulator (Disputes v1, Orders v2, Payments v2)"} />
            <Line k="Client ID" v={mode === "sandbox" ? <span className="num text-[12px]">{clientId || "not set"}</span> : <span className="text-muted">Not used in demo mode</span>} />
            <Line k="APIs used" v="Disputes, Orders, Payments, Webhooks, OAuth" />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={test} disabled={!!busy}>
                {busy === "test" ? <Loader2 className="size-3.5 animate-spin" /> : <Plug className="size-3.5" />} Test connection
              </Button>
              {check ? (
                check.ok ? (
                  <span className="inline-flex items-center gap-1 text-[12.5px] text-green">
                    <Check className="size-3.5" /> {mode === "sandbox" ? "OAuth and the Disputes API answered" : "Simulator OAuth and Disputes API answered"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[12.5px] text-red">
                    <X className="size-3.5" /> {check.error}
                  </span>
                )
              ) : null}
            </div>
            {mode !== "sandbox" ? (
              <p className="mt-4 rounded-lg bg-sunken p-3 text-[12.5px] leading-relaxed text-ink-2">
                To use your PayPal sandbox, set <code className="num">PAYPAL_CLIENT_ID</code> and <code className="num">PAYPAL_CLIENT_SECRET</code> from a sandbox REST app (developer.paypal.com → Apps &amp; Credentials) and restart. The same client code then calls the real API; the demo data is never mixed in.
              </p>
            ) : null}
            {mode === "sandbox" ? (
              <div className="mt-5 border-t border-line pt-4">
                <div className="mb-1 flex items-center justify-between">
                  <h3 className="text-[13.5px] font-medium">Seed the sandbox</h3>
                  <span className="text-[12px] text-muted">
                    {seeds.filter((x) => x.status === "disputed").length} of {seeds.length} disputed
                  </span>
                </div>
                <ol className="mb-4 mt-3 grid gap-3 text-[12.5px] text-ink-2 md:grid-cols-3">
                  <li className="rounded-lg bg-sunken p-3">
                    <div className="mb-1 font-medium text-ink">1 · Create orders</div>
                    One real Orders v2 order per demo scenario. Card-enabled accounts capture at once; otherwise each order waits for a buyer.
                  </li>
                  <li className="rounded-lg bg-sunken p-3">
                    <div className="mb-1 font-medium text-ink">2 · Approve as the buyer</div>
                    Open each checkout in a private window and pay with a sandbox test card (sign out of PayPal between buyers).
                  </li>
                  <li className="rounded-lg bg-sunken p-3">
                    <div className="mb-1 font-medium text-ink">3 · Capture &amp; open chargebacks</div>
                    Captures approved orders, opens a chargeback with process-chargeback, and writes the store records.
                  </li>
                </ol>
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="primary" onClick={() => seedOp("start")} disabled={!!busy}>
                    {busy === "start" ? <Loader2 className="size-3.5 animate-spin" /> : <Sprout className="size-3.5" />} Create sandbox orders
                  </Button>
                  <Button size="sm" onClick={() => seedOp("finalize")} disabled={!!busy || !seeds.some((x) => x.status === "awaiting_buyer")}>
                    {busy === "finalize" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />} Capture approved &amp; open chargebacks
                  </Button>
                </div>
                {seedError ? <p className="mt-3 text-[12.5px] text-red">{seedError}</p> : null}
                {seeds.length ? (
                  <div className="scroll-thin mt-4 overflow-x-auto">
                    <table className="w-full min-w-[560px] text-[12.5px]">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-faint">
                          <th className="py-1.5 font-medium">Scenario</th>
                          <th className="py-1.5 font-medium">Buyer</th>
                          <th className="py-1.5 font-medium">PayPal order</th>
                          <th className="py-1.5 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seeds.map((x) => (
                          <tr key={`${x.key}-${x.order_id}`} className="border-t border-line/70 align-top">
                            <td className="py-2 pr-3">{x.title}</td>
                            <td className="py-2 pr-3 text-ink-2">
                              {x.buyer} · <span className="num">${x.amount}</span>
                            </td>
                            <td className="num py-2 pr-3 text-[11.5px] text-muted">{x.order_id || "none"}</td>
                            <td className="py-2">
                              {x.status === "disputed" ? (
                                <a href={`/app/disputes/${x.dispute_id}`} className="num text-[11.5px] text-ink underline decoration-line-strong underline-offset-2">
                                  {x.dispute_id}
                                </a>
                              ) : x.status === "awaiting_buyer" && x.approve_url ? (
                                <a href={x.approve_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ink underline decoration-line-strong underline-offset-2">
                                  Open PayPal checkout as the buyer <ExternalLink className="size-3" />
                                </a>
                              ) : (
                                <span className="text-red">{x.error ?? x.status}</span>
                              )}
                              {x.error && x.status !== "error" ? <div className="mt-1 text-[11.5px] text-red">{x.error}</div> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Section>

          <Section id="ai" title="AI" sub="The case agent and Ask Exhibit run on Claude. Exhibit picks the first option that works." aside={<Chip tone={provider === "replay" ? "neutral" : "green"} dot>{AI_LABEL[provider]}</Chip>}>
            <ol className="mb-4 space-y-2">
              {order.map((o, i) => (
                <Check3 key={i} state={o.state}>
                  {o.text}
                </Check3>
              ))}
            </ol>
            <Line k="Case agent" v={<span className="num text-[12px]">{provider === "replay" ? "recorded runs (Claude, 20 Oct 2026)" : model}</span>} />
            <Line k="Ask Exhibit" v={<span className="text-[12.5px]">{askLabel}</span>} />
            <Line k="Thinking" v="Adaptive, summarized into the trace" />
            <Line k="Tools" v="9: PayPal, store, carrier, risk, policy, brief" />
            <Line k="Guardrails" v="Cited records only · actions PayPal allows only" />
            <p className="mt-4 rounded-lg bg-sunken p-3 text-[12.5px] leading-relaxed text-ink-2">
              {provider === "claude-code"
                ? "Runs use this machine's Claude CLI login through the Claude Agent SDK, with only Exhibit's nine tools attached. If the CLI can't start (signed out, say), a run falls back to the recorded run for that case and the trace says so. A case with no recording then needs the CLI or an API key."
                : provider === "anthropic"
                  ? "Runs call the Claude API directly with streaming tool use. Set a spending cap on the key for a public deployment."
                  : "No live model here, so each investigation replays a recorded Claude run. The reasoning text is the recording; every tool call, citation check and PayPal request runs live against the case, and the brief must pass the same validation as a live one. Sign in to the Claude CLI (claude login) or set ANTHROPIC_API_KEY to run it live."}
            </p>
          </Section>

          <Section id="webhooks" title="Webhooks" sub="New disputes are investigated the moment PayPal reports them.">
            <p className="text-[12.5px] text-muted">Add this listener to your PayPal app and subscribe to CUSTOMER.DISPUTE.CREATED, CUSTOMER.DISPUTE.UPDATED and CUSTOMER.DISPUTE.RESOLVED.</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="num flex-1 truncate rounded-md bg-sunken px-3 py-2 text-[12px]">{origin ? webhookUrl : "…"}</code>
              <Button
                size="sm"
                variant="ghost"
                aria-label="Copy webhook URL"
                onClick={() => {
                  void navigator.clipboard?.writeText(webhookUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
            <p className="mt-2 text-[11.5px] text-faint">
              The address this app is open on. PayPal needs a public URL: deploy it, or expose this machine with a tunnel.
              {configuredAppUrl && configuredAppUrl !== origin ? (
                <>
                  {" "}
                  EXHIBIT_APP_URL is set to <span className="num">{configuredAppUrl}</span> for PayPal checkout return links.
                </>
              ) : null}
            </p>
            <div className="mt-3">
              <Line k="Signature verification" v={mode === "sandbox" ? (webhookIdSet ? "PayPal verify-webhook-signature · on" : <span className="text-red">Set PAYPAL_WEBHOOK_ID</span>) : "Simulated in demo"} />
            </div>
          </Section>

          <Section id="mcp" title="Connect an AI agent" sub="Exhibit is an MCP server: nine tools over stdio, two of which only ask." aside={<Chip tone="outline">MCP · stdio</Chip>}>
            <AgentConnectCard serverPath={mcpLocalPath} pendingCount={pendingApprovals} />
          </Section>

          {demo ? (
            <Section id="demo" title="Demo" sub="A shared demo merchant. It heals itself so every visitor gets a fresh start." aside={<Chip dot>Demo merchant</Chip>}>
              <Line k="Last reset" v={demo.seededAt ? <span suppressHydrationWarning>{`${relTime(demo.seededAt)} · ${demo.resetReason === "idle" ? "after a quiet spell" : demo.resetReason === "manual" ? "reset from the app" : "first visit"}`}</span> : "never"} />
              <Line k="Resets on its own" v={<span suppressHydrationWarning>{demo.resetsAfter ? `after ${demo.idleMinutes} quiet minutes (next: ${dateTime(demo.resetsAfter)} if nobody is using it)` : `after ${demo.idleMinutes} quiet minutes`}</span>} />
              <Line k="Deadlines" v="Counted from the moment of each reset, so they never go stale" />
              <Line k="Data" v="Kora Atelier, its buyers, orders and carrier scans are fictional" />
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" onClick={requestDemoReset}>
                  <RotateCcw className="size-3.5" /> Reset demo
                </Button>
                <Button size="sm" variant="secondary" onClick={incoming} disabled={!!busy}>
                  {busy === "incoming" ? <Loader2 className="size-3.5 animate-spin" /> : <Bell className="size-3.5" />} Simulate new dispute
                </Button>
                <Button size="sm" variant="secondary" onClick={agentRequest} disabled={!!busy}>
                  {busy === "agent" ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />} Send a demo agent request
                </Button>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-faint">A reset prepares briefs on six cases from recorded runs (every tool call executes live) and leaves two for you to run. Sandbox mode is never reset.</p>
            </Section>
          ) : null}
        </div>
      </div>
    </>
  );
}
