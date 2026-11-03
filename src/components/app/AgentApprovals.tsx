"use client";

import { clsx } from "clsx";
import { ArrowRight, Bot, Check, Copy, Loader2, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { ActionResult } from "@/lib/actions";
import type { Approval } from "@/lib/approvals";
import { dateTime, relTime } from "@/lib/format";
import { Button, buttonClass } from "../ui/Button";
import { Chip, type Tone } from "../ui/Chip";
import { Segmented } from "../ui/Tabs";
import { toast } from "../ui/Toast";
import { PageHeader } from "./PageHeader";

type Row = Approval & { reviewPath?: string };

const money = (v: number, c: string | null) => `${c && c !== "USD" ? `${c} ` : "$"}${v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

async function decide(id: string, decision: "approve" | "reject") {
  const res = await fetch(`/api/approvals/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
  return (await res.json()) as { approval?: Row; error?: string };
}

function usePending(target?: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    const q = new URLSearchParams(target ? { target } : {});
    const r = (await fetch(`/api/approvals?${q}`, { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => ({ approvals: [] }))) as { approvals: Row[] };
    setRows(r.approvals ?? []);
    setLoaded(true);
  }, [target]);
  useEffect(() => {
    // Agents can file a request at any moment; poll lightly while the page is open.
    const first = setTimeout(load, 0);
    const t = setInterval(load, 4000);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);
  return { rows, load, loaded };
}

/** Decides one request, announces the result, and refreshes every badge that counts requests. */
async function decideAndTell(a: Row, decision: "approve" | "reject") {
  const r = await decide(a.id, decision);
  const result = (r.approval?.result ?? null) as ActionResult | null;
  if (decision === "reject") toast(r.error ? { title: "Couldn't reject", sub: r.error, tone: "error" } : { title: "Rejected", sub: `Nothing was sent to PayPal. ${a.client} will see it was declined.` });
  else if (r.approval?.status === "approved" && result?.ok) toast({ title: "Approved and sent to PayPal", sub: result.detail, tone: "success" });
  else toast({ title: "The action didn't run", sub: r.error ?? (result && !result.ok ? result.error : "PayPal refused it."), tone: "error" });
  window.dispatchEvent(new Event("exhibit:nav"));
  return { r, result };
}

/**
 * Case page banner: "An AI agent (Claude Desktop) requests: File evidence with PayPal".
 * Approving runs the brief's action exactly as the merchant's own File button would.
 */
export function ApprovalBanner({ disputeId, onDecided, onPendingChange }: { disputeId: string; onDecided?: (result: ActionResult | null) => void; onPendingChange?: (pending: number) => void }) {
  const { rows, load } = usePending(disputeId);
  const [busy, setBusy] = useState<string | null>(null);
  const pending = rows.filter((r) => r.status === "pending" && r.kind === "dispute_action");

  // The case page steps its own File button down to secondary while an agent's request is the call to answer.
  const count = pending.length;
  useEffect(() => {
    onPendingChange?.(count);
  }, [count, onPendingChange]);

  const act = async (a: Row, decision: "approve" | "reject") => {
    setBusy(`${a.id}:${decision}`);
    const { result } = await decideAndTell(a, decision);
    setBusy(null);
    await load();
    onDecided?.(decision === "approve" ? result : null);
  };

  if (!pending.length) return null;
  return (
    <div className="space-y-2 px-4 pt-5 sm:px-6">
      {pending.map((a) => (
        <section key={a.id} className="card relative overflow-hidden border border-ink/25" aria-label="Agent request">
          <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-ink" />
          <div className="flex flex-col gap-4 py-4 pl-6 pr-5 md:flex-row md:items-center md:gap-6">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-1.5 text-[12px] text-muted">
                <Bot className="size-3.5 text-ink-2" strokeWidth={1.8} />
                <span className="font-medium text-ink-2">Agent request</span>
                <span aria-hidden>·</span>
                <span suppressHydrationWarning>
                  {a.client} via MCP · {relTime(a.createdAt)}
                </span>
              </div>
              <p className="text-[16px] leading-6 text-ink">
                {a.client} asks to <span className="font-semibold">{a.title.charAt(0).toLowerCase() + a.title.slice(1)}</span>
                {a.amount !== null ? <span className="mono ml-1.5 text-[13px] text-ink-2">{money(a.amount, a.currency)}</span> : null}
              </p>
              <p className="mt-1 line-clamp-2 text-[13px] leading-[20px] text-ink-2" title={a.detail}>
                {a.detail}
              </p>
              {a.note ? (
                <p className="mt-0.5 line-clamp-2 text-[13px] leading-[20px] text-muted" title={a.note}>
                  {a.client}: “{a.note}”
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button onClick={() => act(a, "reject")} disabled={!!busy}>
                {busy === `${a.id}:reject` ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Reject
              </Button>
              <Button variant="primary" onClick={() => act(a, "approve")} disabled={!!busy}>
                {busy === `${a.id}:approve` ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 border-t border-line bg-frame py-2 pl-6 pr-5 text-[12px] text-muted">
            <ShieldCheck className="size-3.5 shrink-0 text-ink-2" />
            Nothing reaches PayPal until you approve. Exhibit then files the brief below as written{a.movesMoney ? ", including the money movement shown" : ""}, and logs it under {a.client}.
          </div>
        </section>
      ))}
    </div>
  );
}

const STATUS: Record<Approval["status"], { label: string; tone: Tone }> = {
  pending: { label: "Waiting for you", tone: "outline" },
  approved: { label: "Approved, sent", tone: "green" },
  rejected: { label: "Rejected", tone: "neutral" },
  failed: { label: "Failed", tone: "red" },
  stale: { label: "Expired", tone: "neutral" },
};

/** The approval queue: what outside agents asked for, and what the merchant decided. */
export function ApprovalsView({ mode, emptyArt }: { mode: string; /** Dot art for the empty list, rendered by the page (a server component). */ emptyArt?: React.ReactNode }) {
  const { rows, load, loaded } = usePending();
  const [busy, setBusy] = useState<string | null>(null);
  const [focus] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("approval")));
  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");

  const act = async (a: Row, decision: "approve" | "reject") => {
    setBusy(`${a.id}:${decision}`);
    await decideAndTell(a, decision);
    setBusy(null);
    await load();
  };

  const demoRequest = async () => {
    setBusy("demo");
    try {
      const r = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "agent_request" }) }).then((x) => x.json());
      if (r.error) toast({ title: "No request sent", sub: r.error, tone: "error" });
      else toast({ title: "A demo agent asked to act", sub: `${r.approval.title} · approve or reject it below` });
      await load();
      window.dispatchEvent(new Event("exhibit:nav"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
    <PageHeader
      title="Agent requests"
      subtitle={
        pending.length
          ? `${pending.length} request${pending.length === 1 ? " is" : "s are"} waiting for you. Approving runs the same code as your own button: Exhibit re-reads the dispute and checks the brief hasn't changed; PayPal rejects any action it no longer allows.`
          : "Nothing is waiting. Outside agents can investigate on their own; anything that would reach PayPal or a buyer waits here for you."
      }
    />
    <div className="space-y-4 px-4 pt-6 sm:px-6">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card border" aria-label="Waiting for you">
          <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="text-[14px] font-semibold text-ink">Waiting for you</h2>
            <span className="num text-[13px] text-muted">{pending.length ? `${pending.length} request${pending.length === 1 ? "" : "s"}` : "None"}</span>
          </div>
          {pending.length ? (
            <ul>
              {pending.map((a) => (
                <li key={a.id} className={clsx("flex flex-col gap-3 border-b border-rule px-5 py-4 last:border-0 sm:flex-row sm:items-center", focus === a.id && "bg-hover")}>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] leading-[21px] text-ink">
                      <span className="text-muted">{a.client} asks to</span> <span className="font-medium">{a.title.charAt(0).toLowerCase() + a.title.slice(1)}</span>
                      {a.amount !== null ? <span className="mono ml-1.5 text-[13px] text-ink-2">{money(a.amount, a.currency)}</span> : null}
                      {a.movesMoney ? <Chip className="ml-2 align-[1px]">Moves money</Chip> : null}
                    </div>
                    <div className="mt-1 text-[13px] leading-[20px] text-ink-2">{a.detail}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[12px] text-muted">
                      {a.kind === "dispute_action" ? (
                        <Link href={`/app/disputes/${a.target}`} className="mono rounded-[4px] text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
                          {a.target}
                        </Link>
                      ) : (
                        <Link href={`/app/protection?order=${encodeURIComponent(a.target)}`} className="mono rounded-[4px] text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
                          {a.target}
                        </Link>
                      )}
                      <span suppressHydrationWarning>· {relTime(a.createdAt)}</span>
                      {a.note ? <span className="truncate">· “{a.note}”</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {a.kind === "dispute_action" ? (
                      <Link href={`/app/disputes/${a.target}?approval=${a.id}`} className={buttonClass("ghost", "sm")}>
                        Review <ArrowRight className="size-3" />
                      </Link>
                    ) : null}
                    <Button size="sm" onClick={() => act(a, "reject")} disabled={!!busy}>
                      {busy === `${a.id}:reject` ? <Loader2 className="size-3 animate-spin" /> : null} Reject
                    </Button>
                    <Button size="sm" variant="primary" onClick={() => act(a, "approve")} disabled={!!busy}>
                      {busy === `${a.id}:approve` ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Approve
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              {emptyArt}
              <div className="mt-4 text-[14px] font-medium text-ink">{loaded ? "Nothing is waiting for you" : "Loading requests…"}</div>
              <p className="mt-1 max-w-md text-[13px] leading-[20px] text-muted">When a connected agent asks to file evidence, send an offer, refund or message a buyer, the request waits here and on the case until you decide.</p>
              {mode === "demo" ? (
                <Button size="sm" className="mt-4" onClick={demoRequest} disabled={!!busy}>
                  {busy === "demo" ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />} Send a request as a demo agent
                </Button>
              ) : null}
            </div>
          )}
        </section>
        <aside className="card border px-5 py-4 text-[13px] leading-[20px] text-ink-2">
          <h2 className="mb-2 text-[14px] font-semibold text-ink">Agents ask. You decide.</h2>
          <p>Exhibit runs as an MCP server. Claude Desktop, or an agent built on PayPal&apos;s Agent Toolkit, can triage, investigate and pull evidence packets on its own.</p>
          <p className="mt-2">Anything that reaches PayPal or a buyer arrives here as a request. Approving runs the same code as your own File button and logs it under the agent&apos;s name. Exhibit re-reads the dispute and checks the brief hasn&apos;t changed since the agent asked (a request against an older brief expires instead of running); PayPal rejects any action it no longer allows.</p>
          <Link href="/app/settings#mcp" className="mt-3 inline-flex items-center gap-1 rounded-[4px] font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
            Connect an agent <ArrowRight className="size-3" />
          </Link>
        </aside>
      </div>

      <section className="card overflow-hidden border" aria-label="Decided">
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="text-[14px] font-semibold text-ink">Decided</h2>
          <span className="num text-[13px] text-muted">{done.length ? `${done.length} recent` : "None yet"}</span>
        </div>
        {done.length ? (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-muted">
                  <th className="h-9 w-40 pl-5 font-normal">Decision</th>
                  <th className="h-9 font-normal">Request</th>
                  <th className="h-9 w-36 font-normal">Case or order</th>
                  <th className="h-9 w-44 font-normal">Agent</th>
                  <th className="h-9 w-40 pr-5 text-right font-normal">Decided</th>
                </tr>
              </thead>
              <tbody>
                {done.slice(0, 30).map((a) => (
                  <tr key={a.id} className={clsx("border-b border-rule align-middle last:border-0", focus === a.id && "bg-hover")}>
                    <td className="py-2.5 pl-5">
                      <Chip tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Chip>
                    </td>
                    <td className="max-w-0 py-2.5 pr-3">
                      <div className="truncate text-ink">{a.title}</div>
                      <div className="truncate text-[12px] text-muted" title={a.detail}>
                        {a.detail}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-[12px]">
                      {a.kind === "dispute_action" ? (
                        <Link href={`/app/disputes/${a.target}`} className="mono rounded-[4px] text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
                          {a.target}
                        </Link>
                      ) : (
                        <span className="mono text-ink-2">{a.target}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-[13px] text-muted">{a.client}</td>
                    <td suppressHydrationWarning className="py-2.5 pr-5 text-right text-[13px] text-muted">
                      {a.decidedAt ? dateTime(a.decidedAt) : "–"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-4 text-[13px] text-muted">Approved, rejected and expired requests show up here, with the PayPal result.</p>
        )}
      </section>
    </div>
    </>
  );
}

const TOOLS: { name: string; desc: string; asks?: boolean }[] = [
  { name: "list_disputes", desc: "Open cases with Exhibit's call and win likelihood" },
  { name: "investigate_dispute", desc: "Runs Exhibit; returns the cited case brief" },
  { name: "get_case_brief", desc: "Latest brief without re-running" },
  { name: "get_evidence_packet", desc: "The PDF packet Exhibit would file" },
  { name: "get_prevention_report", desc: "Orders likely to become disputes" },
  { name: "get_overview", desc: "Recovered, at risk, win rate, dispute rate" },
  { name: "request_dispute_action", desc: "Asks you to approve the brief's PayPal action", asks: true },
  { name: "request_prevention_fix", desc: "Asks you to approve a prevention fix", asks: true },
  { name: "get_approval_status", desc: "Whether you approved, and the PayPal result" },
];

function CopyBlock({ code, extra }: { code: string; extra?: { label: string; code: string } }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (key: string, text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <div className="relative">
      <pre className="mono scroll-thin overflow-x-auto rounded-[8px] bg-sunken px-4 py-3.5 pr-12 text-[12px] leading-[19px] text-ink-2">{code}</pre>
      <button type="button" aria-label={copied === "main" ? "Copied" : "Copy"} onClick={() => copy("main", code)} className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-[6px] border border-line-strong bg-surface text-ink-2 hover:bg-hover">
        {copied === "main" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      {extra ? (
        <button type="button" onClick={() => copy("extra", extra.code)} className="mt-2 inline-flex items-center gap-1 rounded-[4px] text-[12px] text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
          {copied === "extra" ? <Check className="size-3" /> : <Copy className="size-3" />} {extra.label}
        </button>
      ) : null}
    </div>
  );
}

const subscribe = () => () => {};
const GENERIC = "/path/to/exhibit/mcp/server.ts";

/** How to connect Claude Desktop, Claude Code or PayPal's MCP side by side; the tools; the guarantee. */
export function AgentConnectCard({ serverPath, pendingCount = 0 }: { serverPath?: string; pendingCount?: number }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "http://localhost:3000");
  const local = useSyncExternalStore(subscribe, () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname), () => false);
  const [tab, setTab] = useState<"desktop" | "code" | "paypal">("desktop");

  const configsFor = (p: string) => {
    const exhibit = { command: "node", args: [p], env: { EXHIBIT_URL: origin } };
    return {
      desktop: JSON.stringify({ mcpServers: { exhibit } }, null, 2),
      code: `claude mcp add exhibit -e EXHIBIT_URL=${origin} -- node ${p}`,
      paypal: JSON.stringify({ mcpServers: { paypal: { command: "npx", args: ["-y", "@paypal/mcp", "--tools=all"], env: { PAYPAL_ACCESS_TOKEN: "<sandbox access token>", PAYPAL_ENVIRONMENT: "SANDBOX" } }, exhibit } }, null, 2),
    };
  };
  const shown = configsFor(GENERIC);
  const mine = serverPath && local ? configsFor(serverPath) : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="min-w-0">
        <p className="text-[13px] leading-[20px] text-ink-2">
          Claude Desktop, Claude Code or an agent built on PayPal&apos;s Agent Toolkit can triage disputes, run investigations and pull evidence packets. PayPal&apos;s toolkit can accept a dispute; with Exhibit an agent can resolve one, with evidence.
        </p>
        <p className="mt-3 border-l-2 border-ink pl-3 text-[13px] leading-[20px] text-ink-2">
          <span className="font-medium text-ink">Agents never move money without you.</span> Filing evidence, offers, refunds and buyer messages arrive as requests in{" "}
          <Link href="/app/approvals" className="rounded-[4px] font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">
            Agent requests
          </Link>{" "}
          and on the case. Nothing reaches PayPal or a buyer until you approve.
          {pendingCount ? <span className="font-medium text-ink"> {pendingCount} waiting now.</span> : null}
        </p>
        <ul className="mt-4 text-[13px]">
          {TOOLS.map((t) => (
            <li key={t.name} className="grid grid-cols-[minmax(0,180px)_minmax(0,1fr)] items-baseline gap-3 border-b border-rule py-2 last:border-0">
              <span className="mono truncate text-[12px] text-ink">{t.name}</span>
              <span className="flex min-w-0 items-baseline justify-between gap-2 text-muted">
                <span className="truncate">{t.desc}</span>
                {t.asks ? <Chip tone="outline">You approve</Chip> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0">
        <Segmented
          className="mb-2.5"
          value={tab}
          onChange={setTab}
          items={[
            { key: "desktop", label: "Claude Desktop" },
            { key: "code", label: "Claude Code" },
            { key: "paypal", label: "With PayPal's MCP" },
          ]}
        />
        <CopyBlock code={shown[tab]} extra={mine ? { label: "Copy with this machine's path instead", code: mine[tab] } : undefined} />
        <p className="mt-2.5 text-[12px] leading-[18px] text-muted">
          Clone the repo and replace <span className="mono text-ink-2">/path/to/exhibit</span> with where it lives. Needs Node 22.18+ on your PATH.{" "}
          {tab === "desktop" ? (
            <>
              Add it to <code className="mono">claude_desktop_config.json</code> (Settings, Developer, Edit config) and restart Claude.
            </>
          ) : tab === "code" ? (
            <>Run once in a terminal; new Claude Code sessions pick it up. Try: “Triage my open PayPal disputes and get the strongest one ready to file.”</>
          ) : (
            <>Both servers side by side: PayPal&apos;s for payments, invoices and tracking, Exhibit&apos;s for disputes. Agents are told to prefer Exhibit over accept_dispute_claim, which concedes the case.</>
          )}
        </p>
      </div>
    </div>
  );
}
