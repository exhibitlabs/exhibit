"use client";

import { Check, Copy, ExternalLink, Loader2, Plug, RefreshCw, Sprout, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AgentConnectCard } from "./AgentApprovals";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";

function Card({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h3 className="text-[14px] font-medium">{title}</h3>
        {aside}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Line({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/70 py-2.5 text-[13px] last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

type Seed = { key: string; title: string; buyer: string; amount: string; order_id: string; approve_url?: string; status: "awaiting_buyer" | "disputed" | "error"; dispute_id?: string; error?: string };

export function SettingsView({ mode, provider, model, clientId, webhookUrl, webhookIdSet, mcpServerPath }: { mode: string; provider: string; model: string; clientId: string; webhookUrl: string; webhookIdSet: boolean; mcpServerPath?: string }) {
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
    void fetch("/api/sandbox/seed").then((r) => r.json()).then((d) => setSeeds(d.seeds ?? []));
  }, [mode]);

  const seedOp = async (op: "start" | "finalize") => {
    setBusy(op);
    setSeedError(null);
    const r = await fetch("/api/sandbox/seed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op }) }).then((x) => x.json());
    if (r.error) setSeedError(r.error);
    else setSeeds(r.seeds ?? []);
    setBusy(null);
  };

  return (
    <div className="grid max-w-5xl grid-cols-2 gap-5 px-8 py-6">
      <Card title="PayPal" aside={<Chip tone={mode === "sandbox" ? "green" : "amber"} dot>{mode === "sandbox" ? "Sandbox" : "Demo simulator"}</Chip>}>
        <Line k="Environment" v={mode === "sandbox" ? "api-m.sandbox.paypal.com" : "Built-in simulator (same API shapes)"} />
        <Line k="Client ID" v={<span className="num text-[12px]">{clientId || "not set"}</span>} />
        <Line k="Scopes used" v="Disputes, Orders, Payments, Webhooks" />
        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" onClick={test} disabled={!!busy}>
            {busy === "test" ? <Loader2 className="size-3.5 animate-spin" /> : <Plug className="size-3.5" />} Test connection
          </Button>
          {check ? (
            check.ok ? (
              <span className="inline-flex items-center gap-1 text-[12.5px] text-green">
                <Check className="size-3.5" /> OAuth + Disputes API OK
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
            To use your PayPal sandbox, set <code className="num">PAYPAL_CLIENT_ID</code> and <code className="num">PAYPAL_CLIENT_SECRET</code> from a sandbox REST app (developer.paypal.com → Apps &amp; Credentials) and restart.
          </p>
        ) : null}
      </Card>

      <Card title="AI agent" aside={<Chip tone={provider === "replay" ? "neutral" : "green"} dot>{provider === "anthropic" ? "Claude API" : provider === "claude-code" ? "Local Claude login" : "Recorded runs"}</Chip>}>
        <Line k="Model" v={<span className="num text-[12px]">{provider === "replay" ? "recorded" : model}</span>} />
        <Line k="Thinking" v="Adaptive, summarized to the trace" />
        <Line k="Tools" v="9 (PayPal, store, carrier, risk, policy, brief)" />
        <Line k="Guardrails" v="Cited refs only · PayPal-allowed actions only" />
        {provider === "replay" ? (
          <p className="mt-4 rounded-lg bg-sunken p-3 text-[12.5px] leading-relaxed text-ink-2">
            Set <code className="num">ANTHROPIC_API_KEY</code> to run the agent live. Without it, Exhibit replays recorded runs and still executes every tool call against live data.
          </p>
        ) : null}
      </Card>

      <Card title="Webhooks">
        <p className="text-[12.5px] text-muted">Add this listener to your PayPal app and subscribe to CUSTOMER.DISPUTE.CREATED, CUSTOMER.DISPUTE.UPDATED and CUSTOMER.DISPUTE.RESOLVED. New disputes are investigated the moment they arrive.</p>
        <div className="mt-3 flex items-center gap-2">
          <code className="num flex-1 truncate rounded-md bg-sunken px-3 py-2 text-[12px]">{webhookUrl}</code>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              void navigator.clipboard.writeText(webhookUrl);
              setCopied(true);
            }}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          </Button>
        </div>
        <div className="mt-3">
          <Line k="Signature verification" v={webhookIdSet ? "PAYPAL_WEBHOOK_ID set" : mode === "sandbox" ? <span className="text-red">Set PAYPAL_WEBHOOK_ID</span> : "Simulated in demo"} />
        </div>
      </Card>

      <Card title="Store data">
        <Line k="Orders & customers" v="Kora Atelier demo store" />
        <Line k="Carrier tracking" v="Recorded carrier events" />
        <Line k="Checkout signals" v="AVS, CVV, 3-D Secure, IP, device" />
        <p className="mt-3 text-[12.5px] text-muted">Connectors for Shopify, WooCommerce and carrier APIs plug in behind the same tools the agent already uses.</p>
      </Card>

      {mcpServerPath ? <AgentConnectCard serverPath={mcpServerPath} /> : null}

      {mode === "sandbox" ? (
        <div className="col-span-2">
          <Card title="Seed the sandbox" aside={<span className="text-[12px] text-muted">{seeds.filter((x) => x.status === "disputed").length} of {seeds.length} disputed</span>}>
            <ol className="mb-4 grid gap-3 text-[12.5px] text-ink-2 md:grid-cols-3">
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
              <table className="mt-4 w-full text-[12.5px]">
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
                      <td className="num py-2 pr-3 text-[11.5px] text-muted">{x.order_id || "—"}</td>
                      <td className="py-2">
                        {x.status === "disputed" ? (
                          <a href={`/app/disputes/${x.dispute_id}`} className="num text-[11.5px] text-blue hover:underline">
                            {x.dispute_id}
                          </a>
                        ) : x.status === "awaiting_buyer" && x.approve_url ? (
                          <a href={x.approve_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue hover:underline">
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
            ) : null}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
