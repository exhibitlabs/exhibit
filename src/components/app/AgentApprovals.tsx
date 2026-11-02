"use client";

import { clsx } from "clsx";
import { Bot, Check, Copy, Loader2, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { ActionResult } from "@/lib/actions";
import type { Approval } from "@/lib/approvals";
import { relTime } from "@/lib/format";
import { Button } from "../ui/Button";
import { Chip, type Tone } from "../ui/Chip";

type Row = Approval & { reviewPath?: string };

const money = (v: number, c: string | null) => `${c && c !== "USD" ? `${c} ` : "$"}${v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

async function decide(id: string, decision: "approve" | "reject") {
  const res = await fetch(`/api/approvals/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
  return (await res.json()) as { approval?: Row; error?: string };
}

function usePending(target?: string) {
  const [rows, setRows] = useState<Row[]>([]);
  const load = useCallback(async () => {
    const q = new URLSearchParams(target ? { target } : {});
    const r = (await fetch(`/api/approvals?${q}`, { cache: "no-store" }).then((x) => x.json())) as { approvals: Row[] };
    setRows(r.approvals ?? []);
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
  return { rows, setRows, load };
}

/**
 * Case page banner: "An AI agent (Claude Desktop) requests: File evidence with PayPal".
 * Approving runs the brief's action exactly as the merchant's own File button would.
 */
export function ApprovalBanner({ disputeId, onDecided }: { disputeId: string; onDecided?: (result: ActionResult | null) => void }) {
  const { rows, load } = usePending(disputeId);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<{ ok: boolean; text: string } | null>(null);
  const pending = rows.filter((r) => r.status === "pending" && r.kind === "dispute_action");

  const act = async (a: Row, decision: "approve" | "reject") => {
    setBusy(`${a.id}:${decision}`);
    const r = await decide(a.id, decision);
    const result = (r.approval?.result ?? null) as ActionResult | null;
    if (decision === "reject") setDone(r.error ? { ok: false, text: r.error } : { ok: true, text: `Rejected. Nothing was sent to PayPal; ${a.client} will see the request was declined.` });
    else if (r.approval?.status === "approved" && result?.ok) setDone({ ok: true, text: `Approved. ${result.detail}` });
    else setDone({ ok: false, text: r.error ?? (result && !result.ok ? result.error : "The action did not run.") });
    setBusy(null);
    await load();
    onDecided?.(decision === "approve" ? result : null);
  };

  if (!pending.length && !done) return null;
  return (
    <div className="space-y-2 px-8 pt-5">
      {pending.map((a) => (
        <section key={a.id} className="card relative overflow-hidden" aria-label="Agent request">
          <span className="absolute inset-y-0 left-0 w-[3px] bg-ink" />
          <div className="flex items-center gap-5 py-4 pl-6 pr-5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ink text-white">
              <Bot className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 flex items-center gap-2 text-[11.5px] text-muted">
                <span className="font-medium uppercase tracking-[0.08em] text-ink-2">Agent request</span>
                <span className="text-faint">·</span>
                <span>via MCP · {relTime(a.createdAt)}</span>
              </div>
              <p className="text-[14.5px] leading-snug text-ink">
                An AI agent <span className="text-muted">({a.client})</span> requests: <span className="font-semibold">{a.title}</span>
                {a.amount !== null ? <span className="num ml-1.5 text-[13px] text-ink-2">· {money(a.amount, a.currency)}</span> : null}
              </p>
              <p className="mt-1 truncate text-[12.5px] text-ink-2" title={a.detail}>
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
            <ShieldCheck className="size-3.5 text-ink-2" />
            Nothing reaches PayPal until you approve. Exhibit then files the brief below as written{a.movesMoney ? ", including the money movement shown" : ""}, and logs it under {a.client}.
          </div>
        </section>
      ))}
      {done && !pending.length ? (
        <div className={clsx("flex items-center gap-2 rounded-lg px-4 py-2.5 text-[12.5px]", done.ok ? "bg-green-soft text-green" : "bg-red-soft text-red")}>
          {done.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
          {done.text}
          <button type="button" className="ml-auto text-[11.5px] opacity-70 hover:opacity-100" onClick={() => setDone(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
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

const TOOLS: { name: string; desc: string; asks?: boolean }[] = [
  { name: "list_disputes", desc: "Open cases with Exhibit's call and win likelihood" },
  { name: "investigate_dispute", desc: "Runs Exhibit; returns the cited case brief" },
  { name: "get_case_brief", desc: "Latest brief without re-running" },
  { name: "get_evidence_packet", desc: "The PDF packet Exhibit would file" },
  { name: "get_prevention_report", desc: "Orders likely to become disputes" },
  { name: "get_overview", desc: "Recovered, at risk, win rate, dispute rate" },
  { name: "request_dispute_action", desc: "Queues the brief's PayPal action", asks: true },
  { name: "request_prevention_fix", desc: "Queues a prevention fix", asks: true },
  { name: "get_approval_status", desc: "Whether you approved, and the PayPal result" },
];

function CopyBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="num scroll-thin overflow-x-auto rounded-lg bg-sunken px-4 py-3.5 pr-12 text-[11.5px] leading-[1.65] text-ink-2">{code}</pre>
      <button
        type="button"
        aria-label="Copy"
        onClick={() => {
          void navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-md border border-line bg-surface text-ink-2 hover:border-line-strong"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}

const subscribe = () => () => {};

/** Settings card: how to connect Claude Desktop / Claude Code, the tools, the guarantee, and the request log. */
export function AgentConnectCard({ serverPath }: { serverPath: string }) {
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => "http://localhost:3000");
  const [tab, setTab] = useState<"desktop" | "code" | "paypal">("desktop");
  const { rows, load } = usePending();
  const [busy, setBusy] = useState<string | null>(null);
  const [focus] = useState(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("approval")));

  const exhibit = { command: "node", args: [serverPath], env: { EXHIBIT_URL: origin } };
  const configs = {
    desktop: JSON.stringify({ mcpServers: { exhibit } }, null, 2),
    code: `claude mcp add exhibit -e EXHIBIT_URL=${origin} -- node ${serverPath}`,
    paypal: JSON.stringify({ mcpServers: { paypal: { command: "npx", args: ["-y", "@paypal/mcp", "--tools=all"], env: { PAYPAL_ACCESS_TOKEN: "<sandbox access token>", PAYPAL_ENVIRONMENT: "SANDBOX" } }, exhibit } }, null, 2),
  };
  const pendingCount = rows.filter((r) => r.status === "pending").length;

  const act = async (id: string, decision: "approve" | "reject") => {
    setBusy(`${id}:${decision}`);
    await decide(id, decision);
    setBusy(null);
    await load();
  };

  return (
    <section className="card col-span-2" id="agent-approvals">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <h3 className="text-[14px] font-medium">Connect an AI agent</h3>
        <span className="flex items-center gap-2">
          {pendingCount ? <Chip tone="ink">{pendingCount} waiting for you</Chip> : null}
          <Chip tone="outline">MCP · stdio · 9 tools</Chip>
        </span>
      </div>

      <div className="grid gap-6 px-5 py-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <p className="text-[13px] leading-relaxed text-ink-2">
            Exhibit runs as an MCP server, so Claude Desktop, Claude Code, ChatGPT or an agent built on PayPal&apos;s Agent Toolkit can triage your disputes, run investigations and pull evidence packets. PayPal&apos;s toolkit lets an agent act on a dispute; Exhibit lets it win one, with evidence.
          </p>
          <div className="mt-4 flex gap-3 rounded-lg border border-line-strong px-4 py-3.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink" />
            <div className="text-[12.5px] leading-relaxed text-ink-2">
              <div className="mb-0.5 font-medium text-ink">Agents never move money without you</div>
              Filing evidence, offers, refunds and buyer messages arrive here, and on the case page, as a request. Nothing reaches PayPal or a customer until you approve; Exhibit then runs the same PayPal calls as its own File button and logs them in Activity under the agent&apos;s name.
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
          <CopyBlock code={configs[tab]} />
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted">
            {tab === "desktop" ? (
              <>
                Add to <code className="num">claude_desktop_config.json</code> (Settings → Developer → Edit config) and restart Claude. Needs Node 22.18+ on your PATH.
              </>
            ) : tab === "code" ? (
              <>Run once in a terminal; Claude Code picks the server up in new sessions. Try: “Triage my open PayPal disputes and get the strongest one ready to file.”</>
            ) : (
              <>Both servers side by side: PayPal&apos;s for payments, invoices and tracking; Exhibit for disputes. Agents are told to prefer Exhibit over <code className="num">accept_dispute_claim</code>, which concedes the case.</>
            )}
          </p>
        </div>
      </div>

      <div className="border-t border-line">
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-[13px] font-medium">Agent requests</span>
          <span className="text-[12px] text-muted">{rows.length ? `${rows.length} recent` : "None yet"}</span>
        </div>
        {rows.length ? (
          <table className="w-full text-[12.5px]">
            <tbody>
              {rows.slice(0, 12).map((a) => (
                <tr key={a.id} className={clsx("border-t border-line/70 align-middle", focus === a.id && "bg-[#fafafa]")}>
                  <td className="w-36 py-2.5 pl-5">
                    <Chip tone={STATUS[a.status].tone} dot={a.status === "pending"}>
                      {STATUS[a.status].label}
                    </Chip>
                  </td>
                  <td className="max-w-0 py-2.5 pr-3">
                    <div className="truncate text-ink">{a.title}</div>
                    <div className="truncate text-[11.5px] text-muted" title={a.detail}>
                      {a.note ? `“${a.note}” · ` : ""}
                      {a.detail}
                    </div>
                  </td>
                  <td className="w-32 py-2.5 pr-3">
                    {a.kind === "dispute_action" ? (
                      <Link href={`/app/disputes/${a.target}`} className="num text-[11.5px] text-blue hover:underline">
                        {a.target}
                      </Link>
                    ) : (
                      <span className="num text-[11.5px] text-ink-2">{a.target}</span>
                    )}
                  </td>
                  <td className="w-44 py-2.5 pr-3 text-[11.5px] text-muted">
                    {a.client} · {relTime(a.createdAt)}
                  </td>
                  <td className="w-44 py-2.5 pr-5 text-right">
                    {a.status === "pending" ? (
                      <span className="inline-flex gap-1.5">
                        <Button size="sm" onClick={() => act(a.id, "reject")} disabled={!!busy}>
                          {busy === `${a.id}:reject` ? <Loader2 className="size-3 animate-spin" /> : null} Reject
                        </Button>
                        <Button size="sm" variant="primary" onClick={() => act(a.id, "approve")} disabled={!!busy}>
                          {busy === `${a.id}:approve` ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Approve
                        </Button>
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-faint">{a.decidedAt ? relTime(a.decidedAt) : ""}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="border-t border-line/70 px-5 py-4 text-[12.5px] text-muted">When a connected agent asks to file, offer, refund or message a buyer, the request waits here for you.</p>
        )}
      </div>
    </section>
  );
}
