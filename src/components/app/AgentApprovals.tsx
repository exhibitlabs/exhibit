"use client";

import { clsx } from "clsx";
import { ArrowRight, Bot, Check, Copy, Loader2, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { ActionResult } from "@/lib/actions";
import type { Approval } from "@/lib/approvals";
import { dateTime, relTime } from "@/lib/format";
import { Button } from "../ui/Button";
import { Chip, type Tone } from "../ui/Chip";
import { toast } from "../ui/Toast";

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
export function ApprovalBanner({ disputeId, onDecided }: { disputeId: string; onDecided?: (result: ActionResult | null) => void }) {
  const { rows, load } = usePending(disputeId);
  const [busy, setBusy] = useState<string | null>(null);
  const pending = rows.filter((r) => r.status === "pending" && r.kind === "dispute_action");

  const act = async (a: Row, decision: "approve" | "reject") => {
    setBusy(`${a.id}:${decision}`);
    const { result } = await decideAndTell(a, decision);
    setBusy(null);
    await load();
    onDecided?.(decision === "approve" ? result : null);
  };

  if (!pending.length) return null;
  return (
    <div className="space-y-2 px-4 pt-5 sm:px-6 lg:px-8">
      {pending.map((a) => (
        <section key={a.id} className="card rise relative overflow-hidden" aria-label="Agent request">
          <span className="absolute inset-y-0 left-0 w-[3px] bg-ink" />
          <div className="flex flex-col gap-4 py-4 pl-6 pr-5 md:flex-row md:items-center md:gap-5">
            <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-white md:flex">
              <Bot className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-2 text-[11.5px] text-muted">
                <span className="font-medium uppercase tracking-[0.08em] text-ink-2">Agent request</span>
                <span className="text-faint">·</span>
                <span suppressHydrationWarning>via MCP · {relTime(a.createdAt)}</span>
              </div>
              <p className="text-[14.5px] leading-snug text-ink">
                An AI agent <span className="text-muted">({a.client})</span> requests: <span className="font-semibold">{a.title}</span>
                {a.amount !== null ? <span className="num ml-1.5 text-[13px] text-ink-2">· {money(a.amount, a.currency)}</span> : null}
              </p>
              <p className="mt-1 line-clamp-2 text-[12.5px] text-ink-2" title={a.detail}>
                {a.detail}
              </p>
              {a.note ? (
                <p className="mt-0.5 truncate text-[12px] text-muted" title={a.note}>
                  {a.client}: “{a.note}”
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button size="md" onClick={() => act(a, "reject")} disabled={!!busy}>
                {busy === `${a.id}:reject` ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />} Reject
              </Button>
              <Button size="md" variant="primary" onClick={() => act(a, "approve")} disabled={!!busy}>
                {busy === `${a.id}:approve` ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-1.5 border-t border-line bg-[#fafafa] py-2 pl-6 pr-5 text-[11.5px] text-muted">
            <ShieldCheck className="size-3.5 shrink-0 text-ink-2" />
            Nothing reaches PayPal until you approve. Exhibit then files the brief below as written{a.movesMoney ? ", including the money movement shown" : ""}, and logs it under {a.client}.
          </div>
        </section>
      ))}
    </div>
  );
}

const STATUS: Record<Approval["status"], { label: string; tone: Tone }> = {
  pending: { label: "Waiting for you", tone: "ink" },
  approved: { label: "Approved · done", tone: "green" },
  rejected: { label: "Rejected", tone: "neutral" },
  failed: { label: "Failed", tone: "red" },
  stale: { label: "Expired", tone: "outline" },
};

/** The approval queue: what outside agents asked for, and what the merchant decided. */
export function ApprovalsView({ mode }: { mode: string }) {
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
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <span className="text-[13.5px] font-medium">Waiting for you</span>
            <span className="text-[12px] text-muted">{pending.length ? `${pending.length} request${pending.length === 1 ? "" : "s"}` : "None"}</span>
          </div>
          {pending.length ? (
            <ul className="divide-y divide-line">
              {pending.map((a) => (
                <li key={a.id} className={clsx("flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center", focus === a.id && "bg-[#fafafa]")}>
                  <span className="hidden size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-white sm:flex">
                    <Bot className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] leading-snug">
                      <span className="text-muted">{a.client} requests:</span> <span className="font-medium">{a.title}</span>
                      {a.amount !== null ? <span className="num ml-1.5 text-[12.5px] text-ink-2">· {money(a.amount, a.currency)}</span> : null}
                      {a.movesMoney ? <Chip className="ml-2 align-middle">moves money</Chip> : null}
                    </div>
                    <div className="mt-1 text-[12.5px] leading-snug text-muted">{a.detail}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11.5px] text-faint">
                      {a.kind === "dispute_action" ? (
                        <Link href={`/app/disputes/${a.target}`} className="num text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
                          {a.target}
                        </Link>
                      ) : (
                        <Link href={`/app/protection?order=${encodeURIComponent(a.target)}`} className="num text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
                          {a.target}
                        </Link>
                      )}
                      <span suppressHydrationWarning>· {relTime(a.createdAt)}</span>
                      {a.note ? <span className="truncate">· “{a.note}”</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {a.kind === "dispute_action" ? (
                      <Link href={`/app/disputes/${a.target}?approval=${a.id}`} className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[12.5px] font-medium text-ink-2 hover:bg-sunken">
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
            <div className="px-5 py-10 text-center">
              <div className="text-[13.5px] font-medium text-ink-2">{loaded ? "Nothing is waiting for you" : "Loading requests…"}</div>
              <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-muted">When a connected agent asks to file evidence, send an offer, refund or message a buyer, the request waits here and on the case until you decide.</p>
              {mode === "demo" ? (
                <Button size="sm" className="mt-4" onClick={demoRequest} disabled={!!busy}>
                  {busy === "demo" ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />} Send a request as a demo agent
                </Button>
              ) : null}
            </div>
          )}
        </section>
        <aside className="card px-5 py-4 text-[12.5px] leading-relaxed text-ink-2">
          <div className="mb-2 flex items-center gap-2 text-[13.5px] font-medium text-ink">
            <ShieldCheck className="size-4" /> Agents ask. You decide.
          </div>
          <p>Exhibit runs as an MCP server. Agents like Claude Desktop or an agent built on PayPal&apos;s Agent Toolkit can triage, investigate and pull evidence packets on their own.</p>
          <p className="mt-2">Anything that reaches PayPal or a buyer arrives here as a request. Approving runs the same code as your own File button, checked again against what PayPal allows at that moment, and logged under the agent&apos;s name. A request made against an older brief expires instead of running.</p>
          <Link href="/app/settings#mcp" className="mt-3 inline-flex items-center gap-1 font-medium text-ink underline decoration-line-strong underline-offset-2">
            Connect an agent <ArrowRight className="size-3" />
          </Link>
        </aside>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <span className="text-[13.5px] font-medium">Decided</span>
          <span className="text-[12px] text-muted">{done.length ? `${done.length} recent` : "None yet"}</span>
        </div>
        {done.length ? (
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-[12.5px]">
              <tbody>
                {done.slice(0, 30).map((a) => (
                  <tr key={a.id} className={clsx("border-b border-line/70 align-middle last:border-0", focus === a.id && "bg-[#fafafa]")}>
                    <td className="w-40 py-2.5 pl-5">
                      <Chip tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Chip>
                    </td>
                    <td className="max-w-0 py-2.5 pr-3">
                      <div className="truncate text-ink">{a.title}</div>
                      <div className="truncate text-[11.5px] text-muted" title={a.detail}>
                        {a.detail}
                      </div>
                    </td>
                    <td className="num w-32 py-2.5 pr-3 text-[11.5px]">
                      {a.kind === "dispute_action" ? (
                        <Link href={`/app/disputes/${a.target}`} className="text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink">
                          {a.target}
                        </Link>
                      ) : (
                        <span className="text-ink-2">{a.target}</span>
                      )}
                    </td>
                    <td className="w-44 py-2.5 pr-3 text-[11.5px] text-muted">{a.client}</td>
                    <td suppressHydrationWarning className="w-40 py-2.5 pr-5 text-right text-[11.5px] text-faint">
                      {a.decidedAt ? dateTime(a.decidedAt) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-5 text-[12.5px] text-muted">Approved, rejected and expired requests show up here, with the PayPal result.</p>
        )}
      </section>
    </div>
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
      <pre className="num scroll-thin overflow-x-auto rounded-lg bg-sunken px-4 py-3.5 pr-12 text-[11.5px] leading-[1.65] text-ink-2">{code}</pre>
      <button type="button" aria-label="Copy" onClick={() => copy("main", code)} className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md border border-line bg-surface text-ink-2 hover:border-line-strong">
        {copied === "main" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      {extra ? (
        <button type="button" onClick={() => copy("extra", extra.code)} className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-muted underline decoration-line-strong underline-offset-2 hover:text-ink">
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
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="min-w-0">
        <p className="text-[13px] leading-relaxed text-ink-2">
          Exhibit runs as an MCP server, so Claude Desktop, Claude Code or an agent built on PayPal&apos;s Agent Toolkit can triage disputes, run investigations and pull evidence packets. PayPal&apos;s toolkit can accept a dispute; with Exhibit an agent can resolve one, with evidence.
        </p>
        <div className="mt-4 flex gap-3 rounded-lg border border-line-strong px-4 py-3.5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" />
          <div className="text-[12.5px] leading-relaxed text-ink-2">
            <div className="mb-0.5 font-medium text-ink">Agents never move money without you</div>
            Filing evidence, offers, refunds and buyer messages arrive as requests in{" "}
            <Link href="/app/approvals" className="font-medium text-ink underline decoration-line-strong underline-offset-2">
              Agent requests
            </Link>{" "}
            and on the case. Nothing reaches PayPal or a buyer until you approve.
            {pendingCount ? <span className="font-medium text-ink"> {pendingCount} waiting now.</span> : null}
          </div>
        </div>
        <ul className="mt-4 text-[12px]">
          {TOOLS.map((t) => (
            <li key={t.name} className="grid grid-cols-[176px_minmax(0,1fr)] items-baseline gap-3 border-b border-line/70 py-[6px] last:border-0">
              <span className="num text-[11.5px] text-ink">{t.name}</span>
              <span className="flex min-w-0 items-baseline gap-1.5 text-muted">
                <span className="truncate">{t.desc}</span>
                {t.asks ? <span className="shrink-0 rounded bg-ink px-1.5 py-px text-[10px] font-medium text-white">you approve</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0">
        <div className="mb-2.5 inline-flex rounded-lg bg-sunken p-0.5 text-[12px]">
          {(
            [
              ["desktop", "Claude Desktop"],
              ["code", "Claude Code"],
              ["paypal", "With PayPal's MCP"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setTab(k)} className={clsx("rounded-md px-3 py-1.5 font-medium transition-colors", tab === k ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)]" : "text-muted hover:text-ink")}>
              {label}
            </button>
          ))}
        </div>
        <CopyBlock code={shown[tab]} extra={mine ? { label: "Copy with this machine's path instead", code: mine[tab] } : undefined} />
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
          Clone the repo and replace <span className="num text-ink-2">/path/to/exhibit</span> with where it lives. Needs Node 22.18+ on your PATH.{" "}
          {tab === "desktop" ? (
            <>
              Add it to <code className="num">claude_desktop_config.json</code> (Settings → Developer → Edit config) and restart Claude.
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
