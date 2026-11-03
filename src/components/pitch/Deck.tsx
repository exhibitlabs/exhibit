"use client";

import { clsx } from "clsx";
import { ArrowLeft, ArrowRight, Check, Minus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { HeroReplay } from "../landing/HeroReplay";
import type { ReplayCase } from "../landing/replay-model";
import { LogoMark } from "../ui/Logo";

// The /pitch deck. Every fact on it comes from the landing page's data (src/components/landing/data.ts and
// ./records), assembled in src/app/pitch/page.tsx, so the deck and the site always say the same thing.

export type DeckFiling = { label: string; path: string; disputeId: string | null; status: number; ms: number; debugId: string | null; at: string };

export type DeckData = {
  githubUrl: string;
  founderGithubUrl: string;
  fees: { url: string; updated: string; retrieved: string; quote: string; fees: { amount: number; label: string; note: string }[] };
  agentTools: { url: string; retrieved: string; tools: { name: string; description: string }[] };
  mcpQuote: { text: string; title: string; author: string; date: string; url: string };
  pricing: { label: string; line: string; note: string };
  founder: { name: string; role: string; city: string; firstCommit: string };
  evaluation: { cases: number; agreementRate: number; minutesPerCase: number; correctlyRefunded?: number; method: string; url?: string } | null;
  /** The evaluation's headline counts, from eval/results.json. */
  evalRun: { n: number; exact: number; refundTotal: number; refundedNotFought: number; notFightTotal: number; falseFights: number; guardrailsPassed: number; medianSeconds: number; reasons: number; model: string; date: string } | null;
  cases: ReplayCase[];
  fight: { disputeId: string; buyer: string; amount: number; model: string; seconds: string; toolCalls: number; exhibits: number; date: string };
  proof: { host: string; totals: { calls: number; ok: number; errors: number; endpoints: number; disputes: number; runs: number }; from: string; to: string; filings: DeckFiling[]; failed: number[]; notLive: { what: string; why: string }[] };
  refunds: { buyer: string; reason: string; amount: number; ifFought: number; headline: string; note: string[]; call: DeckFiling | null }[];
  decisions: { label: string; n: number }[];
  prevention: {
    capturedAt: string;
    totals: { watched: number; atRisk: number; exposure: number; prevented: number; saved: number };
    signals: { label: string; reason: string }[];
    save: { orderId: string; buyer: string; before: number; after: number; saved: number; at: string };
    reply: { german: string; english: string; germanPromise: string; englishPromise: string };
  };
};

const W = 1600;
const H = 900;

const pad = (n: number) => String(n).padStart(2, "0");
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

function Frame({ n, total, children }: { n: number; total: number; children: ReactNode }) {
  return (
    <div className="relative flex h-full w-full flex-col bg-white px-[104px] pb-[100px] pt-[76px] text-ink">
      {children}
      {/* The number sits on the left: the deck's own controls float over the bottom-right corner. */}
      <div className="absolute inset-x-[104px] bottom-[38px] flex items-center gap-5 text-[15px] text-muted">
        <span className="flex items-center gap-2.5 text-ink">
          <LogoMark size={18} />
          <span className="font-semibold tracking-[-0.04em]">Exhibit</span>
        </span>
        <span className="num">
          {pad(n)} / {pad(total)}
        </span>
      </div>
    </div>
  );
}

/** The landing page's heading: a mono kicker, then the claim in ink and the explanation in grey. */
function Head({ kicker, title, rest, size = 56, className }: { kicker: string; title: ReactNode; rest?: ReactNode; size?: number; className?: string }) {
  return (
    <div className={clsx("max-w-[1220px] shrink-0", className)}>
      <p className="num text-[15px] uppercase tracking-[0.12em] text-muted">{kicker}</p>
      <h2 className="mt-5 text-balance font-semibold tracking-[-0.035em]" style={{ fontSize: size, lineHeight: 1.07 }}>
        {title}
        {rest ? <span className="text-[#8a8a8a]"> {rest}</span> : null}
      </h2>
    </div>
  );
}

/** Where an artifact on the slide comes from. Green: the live PayPal sandbox. Grey: the demo merchant or a published source. */
function Source({ children, tone = "sandbox", className }: { children: ReactNode; tone?: "sandbox" | "demo"; className?: string }) {
  return (
    <p className={clsx("flex items-start gap-2.5 text-[15px] leading-relaxed text-muted", className)}>
      <span className={clsx("mt-[8px] size-2 shrink-0 rounded-full", tone === "sandbox" ? "bg-green" : "bg-faint")} aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("overflow-hidden rounded-2xl border border-line bg-white", className)}>{children}</div>;
}

function Pill({ children, tone }: { children: ReactNode; tone: "fight" | "refund" | "green" }) {
  return (
    <span
      className={clsx(
        "inline-flex h-7 items-center rounded-md px-2.5 text-[15px] font-semibold leading-none",
        tone === "fight" && "bg-ink text-white",
        tone === "refund" && "bg-white text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]",
        tone === "green" && "bg-green-soft text-green",
      )}
    >
      {children}
    </span>
  );
}

function CallLine({ f }: { f: DeckFiling }) {
  return (
    <div className="num flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted">
      <span className="text-ink-2">POST {f.path}</span>
      <span className="rounded bg-green-soft px-1.5 py-0.5 font-medium text-green">{f.status}</span>
      <span>{f.ms.toLocaleString("en-US")} ms</span>
      <span>debug id {f.debugId}</span>
    </div>
  );
}

// The rows of the landing page's "PayPal's agent tools, completed" table (src/components/landing/Gap.tsx).
const GAP: { step: string; paypal?: string; exhibit: string; notLive?: boolean }[] = [
  { step: "List open disputes", paypal: "list_disputes", exhibit: "Inbox sync, and list_disputes for agents" },
  { step: "Read a dispute", paypal: "get_dispute", exhibit: "Live case facts, deadline and allowed actions" },
  { step: "Accept the claim", paypal: "accept_dispute_claim", exhibit: "accept-claim, when the records say the buyer is right" },
  { step: "Investigate the order, delivery, messages and checkout", exhibit: "Eight sources, every claim cited to a record" },
  { step: "Submit evidence", exhibit: "provide-evidence, with a lettered PDF packet" },
  { step: "Add supporting info while PayPal reviews", exhibit: "provide-supporting-info" },
  { step: "Offer a refund, return or replacement", exhibit: "make-offer", notLive: true },
  { step: "Message the buyer", exhibit: "send-message, in the buyer's language", notLive: true },
  { step: "Stop a dispute before it is filed", exhibit: "Prevention radar and fixes" },
];

// Excerpts of the recorded MCP run (docs/MCP_DEMO.md), as on the landing page.
const TRANSCRIPT: { who: "Merchant" | "→ tool" | "← Exhibit" | "Claude"; text: string }[] = [
  { who: "Merchant", text: "Triage my open PayPal disputes and get the strongest one ready to file." },
  { who: "→ tool", text: "list_disputes" },
  { who: "← Exhibit", text: `{ "count": 8, "total_amount": 1805, … }` },
  { who: "→ tool", text: "get_case_brief · investigate_dispute ×7" },
  { who: "→ tool", text: `request_dispute_action { "dispute_id": "PP-D-50211" }` },
  { who: "← Exhibit", text: `{ "approval_id": "apv_4e8074d6db", "status": "pending", "action": "provide_evidence", "moves_money": false, "requested_by": "Claude Code" }` },
  { who: "Claude", text: "I've triaged all 8 open disputes ($1,805 total) and set up the strongest one for filing. Nothing has been filed yet. It goes to PayPal only once you approve it." },
];

const STEPS = [
  ["PayPal opens a chargeback", "Exhibit pulls the case from the Disputes API, including the actions PayPal allows on it right now."],
  ["It checks every claim against a record", "A brief that cites anything its tools never returned is rejected, and the agent has to fix it."],
  ["It builds the evidence packet", "A letter for PayPal's reviewer and a PDF of lettered exhibits, rendered from your records."],
  ["You approve. It files.", "Nothing reaches PayPal until you approve. Every call keeps its status, latency and debug id."],
];

/** The hero's replay of real runs, at a fixed width and scaled to the space it is given. */
function Replay({ cases, width }: { cases: ReplayCase[]; width: number }) {
  const natural = 1136;
  const s = width / natural;
  return (
    <div style={{ width, height: 780 * s }} className="relative overflow-visible">
      <div style={{ width: natural, transform: `scale(${s})`, transformOrigin: "top left" }} className="absolute left-0 top-0">
        <HeroReplay cases={cases} />
      </div>
    </div>
  );
}

function buildSlides(d: DeckData): { label: string; render: (n: number, total: number) => ReactNode }[] {
  const t = d.proof.totals;
  const decisionsTotal = d.decisions.reduce((a, c) => a + c.n, 0);
  const slides: { label: string; render: (n: number, total: number) => ReactNode }[] = [
    {
      label: "Title",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <div className="flex flex-1 flex-col justify-center">
            <LogoMark size={72} />
            <p className="mt-12 inline-flex w-fit items-center gap-2.5 rounded-full border border-line px-4 py-1.5 text-[17px] text-ink-2">
              <span className="size-2 rounded-full bg-green" aria-hidden />
              Tested live on the PayPal sandbox, every call on the record
            </p>
            <h1 className="mt-8 max-w-[1180px] text-[104px] font-semibold leading-[1] tracking-[-0.045em]">The dispute agent for PayPal merchants.</h1>
            <p className="mt-9 max-w-[1020px] text-[26px] leading-[1.5] text-muted">
              Exhibit reads each dispute from PayPal&apos;s Disputes API, investigates it with Claude, cites every claim to a real record and files the response through PayPal. When the buyer is right, it refunds.
            </p>
            <p className="mt-14 text-[17px] text-muted">
              PayPal AI Hackathon 2026 · {d.founder.name}, {d.founder.role.replace("Founder, ", "")}
            </p>
          </div>
        </Frame>
      ),
    },
    {
      label: "The problem",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <Head kicker="The problem" title="Every dispute can carry a PayPal fee." rest="And the proof is split across four systems." />
          <div className="mt-12 grid grid-cols-3 gap-6">
            {d.fees.fees.map((f) => (
              <Card key={f.label} className="px-8 py-8">
                <div className="num text-[76px] leading-none tracking-[-0.03em]">${f.amount}</div>
                <div className="mt-6 text-[22px] font-medium">{f.label}</div>
                <div className="mt-1.5 text-[18px] leading-snug text-muted">{f.note}</div>
              </Card>
            ))}
          </div>
          <p className="mt-10 max-w-[1250px] text-[25px] leading-[1.5] text-ink-2">
            The records that settle a case sit in PayPal, the store, the carrier and the inbox. The response deadline comes first, and an unanswered case closes for the buyer.
          </p>
          <div className="mt-auto pt-8">
            <Source tone="demo">
              “{d.fees.quote}” PayPal US business fees, updated {d.fees.updated}, checked {d.fees.retrieved}. PayPal&apos;s page does not say whether the fee is returned when the seller wins.
            </Source>
          </div>
        </Frame>
      ),
    },
    {
      label: "The gap",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <Head kicker="Built on PayPal's toolkit" title="PayPal's agent tools can list, read and accept a dispute." rest="Exhibit handles the rest of the case." size={46} />
          <Card className="mt-8 shrink-0">
            <table className="w-full border-collapse text-left text-[17px]">
              <thead>
                <tr className="border-b border-line bg-[#fafafa] text-[13px] uppercase tracking-[0.08em] text-muted">
                  <th className="w-[42%] px-7 py-3 font-medium">Dispute lifecycle</th>
                  <th className="px-7 py-3 font-medium">PayPal agent tools</th>
                  <th className="px-7 py-3 font-medium">Exhibit</th>
                </tr>
              </thead>
              <tbody>
                {GAP.map((r) => (
                  <tr key={r.step} className="border-b border-line last:border-0">
                    <td className="px-7 py-[9px] font-medium">{r.step}</td>
                    <td className="px-7 py-[9px]">
                      {r.paypal ? (
                        <span className="num flex items-center gap-2.5 text-[16px] text-ink-2">
                          <Check className="size-4 text-muted" strokeWidth={2.5} aria-hidden /> {r.paypal}
                        </span>
                      ) : (
                        <Minus className="size-4 text-faint" aria-label="Not in the toolkit" />
                      )}
                    </td>
                    <td className="px-7 py-[9px]">
                      <span className="flex items-center gap-2.5 text-ink-2">
                        <Check className="size-4 shrink-0 text-green" strokeWidth={2.75} aria-hidden />
                        <span>
                          {r.exhibit}
                          {r.notLive ? <sup className="ml-0.5 text-muted">*</sup> : null}
                        </span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="mt-auto flex items-end justify-between gap-10 pt-6">
            <Source tone="demo">
              PayPal agent tools reference, retrieved {d.agentTools.retrieved}: {d.agentTools.tools.map((x) => x.name).join(", ")}. * Implemented and tested against the simulator. PayPal only allows offers and buyer messages at the inquiry stage, which sandbox chargebacks skip.
            </Source>
          </div>
        </Frame>
      ),
    },
    {
      label: "The product",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <Head kicker="The product" title="One real case, start to finish." rest="On the PayPal sandbox." size={48} />
          <div className="mt-8 grid grid-cols-[380px_minmax(0,1fr)] gap-12">
            <ol className="space-y-6 pt-2">
              {STEPS.map(([title, body], i) => (
                <li key={title}>
                  <div className="flex items-baseline gap-3">
                    <span className="num text-[14px] text-muted">{pad(i + 1)}</span>
                    <span className="text-[20px] font-semibold tracking-[-0.015em]">{title}</span>
                  </div>
                  <p className="mt-1.5 pl-[30px] text-[16px] leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ol>
            <Replay cases={d.cases} width={880} />
          </div>
        </Frame>
      ),
    },
    {
      label: "Fair to buyers",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <Head kicker="Fair to buyers" title="When the buyer is right, Exhibit refunds." rest="PayPal puts buyers first. So does Exhibit." size={52} />
          <div className="mt-10 grid grid-cols-2 gap-6">
            {d.refunds.map((r) => (
              <Card key={r.buyer} className="flex flex-col">
                <div className="flex items-start justify-between gap-4 border-b border-line px-7 py-4">
                  <div>
                    <div className="text-[19px] font-semibold">{r.buyer}</div>
                    <div className="text-[15px] text-muted">
                      {r.reason} · <span className="num">${r.amount}</span> chargeback
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Pill tone="refund">Refund</Pill>
                    <span className="num text-[13px] text-muted">{r.ifFought}% if fought</span>
                  </div>
                </div>
                <div className="flex-1 px-7 py-5">
                  <p className="text-[19px] font-semibold leading-snug tracking-[-0.01em]">{r.headline}</p>
                  <blockquote className="mt-4 space-y-1.5 rounded-xl bg-[#fafafa] px-5 py-4 text-[15.5px] leading-relaxed text-ink-2">
                    {r.note.map((line) => (
                      <p key={line}>{line}</p>
                    ))}
                  </blockquote>
                </div>
                {r.call ? (
                  <div className="border-t border-line px-7 py-3">
                    <CallLine f={r.call} />
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
          <div className="mt-8 grid grid-cols-[360px_minmax(0,1fr)] items-center gap-10">
            <p className="text-[18px] leading-snug text-ink-2">
              <span className="font-semibold text-ink">Fight is one of four answers.</span> On the demo merchant&apos;s {decisionsTotal} open cases:
            </p>
            <div className="flex h-11 overflow-hidden rounded-lg">
              {d.decisions.map((c, i) => (
                <div
                  key={c.label}
                  className="flex items-center justify-center gap-2 text-[15px] font-medium"
                  style={{ width: `${(c.n / decisionsTotal) * 100}%`, background: ["#0a0a0a", "#5c5c5c", "#a3a3a3", "#e5e5e5"][i], color: i < 2 ? "#fff" : "#0a0a0a" }}
                >
                  {c.label} <span className="num">{c.n}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-auto pt-5">
            <Source>Two sandbox chargebacks. Exhibit refused to fight both, and the merchant accepted the claims through PayPal&apos;s API. Buyer names and store records are demo data.</Source>
          </div>
        </Frame>
      ),
    },
    {
      label: "Prevention",
      render: (n, total) => {
        const p = d.prevention;
        return (
          <Frame n={n} total={total}>
            <Head kicker="Prevention" title="Stop the dispute before it is filed." rest="Each warning sign comes with a fix." size={52} />
            <div className="mt-10 grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-6">
              <Card className="flex flex-col px-8 py-7">
                <div className="flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.08em] text-green">
                  <Check className="size-4" strokeWidth={3} aria-hidden /> Prevented · {p.save.orderId}
                </div>
                <p className="mt-3 text-[25px] font-semibold leading-snug tracking-[-0.015em]">{p.save.buyer} said she would open a PayPal dispute. Exhibit replied in German first.</p>
                <p className="num mt-3 text-[15px] text-muted">
                  Risk {p.save.before} → {p.save.after} · {usd(p.save.saved)} exposure removed · {p.save.at}
                </p>
                <figure className="mt-6 rounded-xl border border-line px-5 py-4">
                  <blockquote lang="de" className="text-[16px] leading-relaxed text-ink">
                    {p.reply.german} {p.reply.germanPromise}
                  </blockquote>
                  <figcaption className="mt-3 border-t border-line pt-3 text-[15px] leading-relaxed text-muted">
                    Translation: {p.reply.english} {p.reply.englishPromise}
                  </figcaption>
                </figure>
              </Card>
              <div className="flex flex-col gap-6">
                <Card>
                  <dl className="grid grid-cols-2">
                    {[
                      [p.totals.watched, "orders watched"],
                      [p.totals.atRisk, "at risk"],
                      [usd(p.totals.exposure), "exposure, with PayPal fees"],
                      [`${p.totals.prevented} · ${usd(p.totals.saved)}`, "prevented so far"],
                    ].map(([v, k], i) => (
                      <div key={k as string} className={clsx("flex flex-col gap-1.5 px-6 py-5", i % 2 === 1 && "border-l border-line", i > 1 && "border-t border-line")}>
                        <dt className="order-2 text-[15px] text-muted">{k}</dt>
                        <dd className="num order-1 text-[32px] leading-none tracking-[-0.02em]">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
                <Card className="flex-1 px-6 py-5">
                  <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted">Warning signs the radar watches</p>
                  <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5 text-[16px]">
                    {p.signals.map((s) => (
                      <li key={s.label}>
                        <span className="text-ink">{s.label}</span>
                        <span className="block text-[13.5px] text-muted">Leads to: {s.reason}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
            </div>
            <div className="mt-auto pt-5">
              <Source tone="demo">
                Demo merchant snapshot from Exhibit&apos;s prevention radar, {p.capturedAt}. Exposure is the order total plus PayPal&apos;s dispute fee: $15 for PayPal checkout, $20 for card.
              </Source>
            </div>
          </Frame>
        );
      },
    },
    {
      label: "For AI agents",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <Head kicker="For AI agents" title="Agents request. Merchants approve." rest="Money never moves without the merchant." size={52} />
          <div className="mt-9 grid grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] gap-6">
            <Card>
              <div className="flex items-center justify-between border-b border-line px-6 py-3 text-[15px]">
                <span className="font-medium">Claude, with only Exhibit&apos;s MCP server attached</span>
                <span className="num text-[13px] text-muted">57 s · 10 tool calls</span>
              </div>
              <ol className="divide-y divide-line/70 px-6">
                {TRANSCRIPT.map((l, i) => (
                  <li key={i} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 py-2.5">
                    <span className={clsx("num pt-px text-[13px]", l.who === "Merchant" || l.who === "Claude" ? "text-ink" : "text-muted")}>{l.who}</span>
                    <span className={clsx("min-w-0 break-words", l.who === "→ tool" || l.who === "← Exhibit" ? "num text-[13.5px]" : "text-[16px] leading-relaxed", l.who === "→ tool" ? "text-ink" : l.who === "← Exhibit" ? "text-muted" : "text-ink-2")}>{l.text}</span>
                  </li>
                ))}
              </ol>
            </Card>
            <div className="flex flex-col gap-6">
              <Card className="px-6 py-5">
                <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted">What the merchant sees in Exhibit</p>
                <p className="mt-3 text-[16px] text-muted">An AI agent (Claude Code) requests:</p>
                <p className="mt-1 text-[22px] font-semibold tracking-[-0.01em]">File evidence with PayPal</p>
                <p className="num mt-1 text-[14px] text-muted">PP-D-50211 · Megan Hale · $284 · item not received</p>
                <div className="mt-4 flex gap-2.5" aria-hidden>
                  <span className="inline-flex h-10 items-center rounded-lg border border-line-strong px-4 text-[15px] font-medium">Reject</span>
                  <span className="inline-flex h-10 items-center rounded-lg bg-ink px-4 text-[15px] font-medium text-white">Approve and file</span>
                </div>
              </Card>
              <figure className="flex-1 rounded-2xl border border-line bg-[#fafafa] px-6 py-5">
                <blockquote className="text-[21px] font-medium leading-snug tracking-[-0.01em]">“{d.mcpQuote.text}”</blockquote>
                <figcaption className="mt-2 text-[14.5px] text-muted">
                  PayPal Developer Blog, {d.mcpQuote.title}, {d.mcpQuote.date}
                </figcaption>
                <p className="mt-4 border-t border-line pt-4 text-[16px] leading-relaxed text-ink-2">
                  Exhibit holds money to the same rule. When the merchant approves, it re-reads the dispute from PayPal and checks the request still matches the latest brief. If the brief has changed, the request expires.
                </p>
              </figure>
            </div>
          </div>
          <div className="mt-auto pt-5">
            <Source tone="demo">Excerpts of a real run recorded Oct 20, 2026: Claude Opus 5.5 with only Exhibit&apos;s MCP server attached, on the demo merchant. Full transcript in docs/MCP_DEMO.md.</Source>
          </div>
        </Frame>
      ),
    },
    {
      label: "Proof",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <Head kicker="Proof" title="Verified on the live PayPal sandbox." rest="Every call is on the record." size={52} />
          <div className="mt-10 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6">
            <Card>
              <div className="flex items-center justify-between border-b border-line px-6 py-3 text-[15px]">
                <span className="font-medium">Dispute responses filed through the API</span>
                <span className="num text-[13px] text-muted">{d.proof.host}</span>
              </div>
              <ul className="divide-y divide-line">
                {d.proof.filings.map((f) => (
                  <li key={f.debugId ?? f.at} className="flex items-center justify-between gap-4 px-6 py-[11px]">
                    <div className="min-w-0">
                      <div className="text-[16px] font-medium">{f.label}</div>
                      <div className="num mt-0.5 truncate text-[13px] text-muted">
                        POST {f.path} · {f.disputeId}
                      </div>
                    </div>
                    <div className="num flex shrink-0 items-center gap-3 text-[13px] text-muted">
                      <span>{f.debugId}</span>
                      <span className="rounded bg-green-soft px-1.5 py-0.5 font-medium text-green">{f.status}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line bg-[#fafafa] px-6 py-3 text-[14.5px] text-muted">
                {d.proof.failed.length} filing attempts failed along the way (HTTP {d.proof.failed.join(" and ")}). They are why Exhibit now sends one evidence per call.
              </div>
            </Card>
            <div className="flex flex-col gap-6">
              <Card>
                <dl className="grid grid-cols-2">
                  {[
                    [t.calls, "API calls logged"],
                    [t.ok, "returned 2xx"],
                    [t.endpoints, "endpoints"],
                    [t.disputes, "sandbox chargebacks"],
                  ].map(([v, k], i) => (
                    <div key={k as string} className={clsx("flex flex-col gap-1.5 px-6 py-5", i % 2 === 1 && "border-l border-line", i > 1 && "border-t border-line")}>
                      <dt className="order-2 text-[15px] text-muted">{k}</dt>
                      <dd className="num order-1 text-[40px] leading-none tracking-[-0.03em]">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <Card className="flex-1 px-6 py-4">
                <p className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted">Not tested live yet</p>
                <ul className="mt-2 space-y-1.5 text-[16px] text-ink-2">
                  {d.proof.notLive.map((x) => (
                    <li key={x.what}>{x.what}</li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
          <div className="mt-auto pt-5">
            <Source>
              From Exhibit&apos;s own log of calls to {d.proof.host}, {d.proof.from} to {d.proof.to}, with HTTP status, latency and PayPal debug ids. The full list is on /proof.
            </Source>
          </div>
        </Frame>
      ),
    },
  ];

  if (d.evaluation && d.evalRun) {
    const e = d.evaluation;
    const r = d.evalRun;
    const stats: [string, string][] = [
      [`${r.exact}/${r.n}`, "decisions matched the label"],
      [`${r.refundedNotFought}/${r.refundTotal}`, "buyer-right cases refunded, not fought"],
      [`${r.falseFights}/${r.notFightTotal}`, "false fights"],
      [`${r.guardrailsPassed}/${r.n}`, "briefs passed the citation and action checks"],
      [`${r.medianSeconds} s`, "median time to a validated brief"],
    ];
    slides.push({
      label: "Evaluation",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <Head kicker="Evaluation" title={`${r.exact} of ${r.n} decisions matched the label.`} rest="On synthetic cases the builder wrote." size={52} />
          <Card className="mt-12">
            <dl className="grid grid-cols-5">
              {stats.map(([v, k], i) => (
                <div key={k} className={clsx("flex flex-col gap-2.5 px-7 py-8", i > 0 && "border-l border-line")}>
                  <dt className="order-2 text-[17px] leading-snug text-muted">{k}</dt>
                  <dd className="num order-1 text-[56px] leading-none tracking-[-0.03em]">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <p className="mt-9 max-w-[1220px] text-[22px] leading-[1.5] text-ink-2">
            {r.n} synthetic disputes across {r.reasons} dispute reasons, labelled and hashed before one live run of {r.model} on the Claude CLI against the simulator, on {r.date}. The builder wrote the cases and labels, with Claude, so this shows Exhibit applies its rules consistently, not how accurate it is on real disputes.
          </p>
          {e.url ? (
            <div className="mt-auto pt-6">
              <Source tone="demo">Method, every case and the limitations: {e.url.replace("https://", "")}</Source>
            </div>
          ) : null}
        </Frame>
      ),
    });
  }

  slides.push(
    {
      label: "Who it's for",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <Head kicker="Who it's for" title="Independent stores that sell with PayPal." rest="Too small for a payments team, big enough that every dispute hurts." size={52} />
          <div className="mt-14 grid grid-cols-3 gap-6">
            {[
              ["The merchant", "Sees where every claim comes from, approves before anything reaches PayPal, and gets told plainly when a case can't be won."],
              ["The merchant's AI agents", "Investigate and prepare disputes over MCP, next to PayPal's own agent tools. They can ask; only the merchant approves."],
              ["PayPal and the buyer", "A response PayPal's reviewer can check line by line against its records, and a refund when the buyer is right."],
            ].map(([a, b]) => (
              <Card key={a} className="px-8 py-8">
                <div className="text-[24px] font-semibold tracking-[-0.015em]">{a}</div>
                <p className="mt-3 text-[19px] leading-[1.55] text-muted">{b}</p>
              </Card>
            ))}
          </div>
          <p className="mt-10 max-w-[1200px] text-[22px] leading-[1.5] text-ink-2">
            Every dispute can carry a ${d.fees.fees[0].amount} to ${d.fees.fees[1].amount} PayPal dispute fee, or ${d.fees.fees[2].amount} per card chargeback, on top of the amount in dispute.
          </p>
          <div className="mt-auto pt-6">
            <Source tone="demo">
              PayPal US business fees, updated {d.fees.updated}, checked {d.fees.retrieved}. We have not sized the market yet, so this deck shows no market numbers.
            </Source>
          </div>
        </Frame>
      ),
    },
    {
      label: "Business model",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <div className="flex flex-1 flex-col justify-center">
            <p className="num text-[15px] uppercase tracking-[0.12em] text-muted">{d.pricing.label}</p>
            <p className="mt-8 max-w-[1250px] text-[64px] font-semibold leading-[1.1] tracking-[-0.035em]">{d.pricing.line}</p>
            <p className="mt-8 text-[22px] text-muted">{d.pricing.note}</p>
            <div className="mt-14 grid max-w-[1250px] grid-cols-2 gap-6">
              <Card className="px-8 py-7">
                <div className="text-[21px] font-semibold">Paid when it wins</div>
                <p className="mt-2 text-[18px] leading-relaxed text-muted">Exhibit earns only on money it recovers for the merchant.</p>
              </Card>
              <Card className="px-8 py-7">
                <div className="text-[21px] font-semibold">Free when it says refund</div>
                <p className="mt-2 text-[18px] leading-relaxed text-muted">A case Exhibit tells the merchant not to fight costs them nothing extra.</p>
              </Card>
            </div>
          </div>
        </Frame>
      ),
    },
    {
      label: "Why now",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <Head kicker="Why now" title="PayPal is building for agents." rest="Its tools stop at conceding a dispute." size={52} />
          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              ["The write side is open", `PayPal's agent tools reference (retrieved ${d.agentTools.retrieved}) has ${d.agentTools.tools.map((x) => x.name).join(", ")}. Nothing submits evidence, makes an offer or messages a buyer.`],
              ["Authorization at every step", `PayPal's own MCP gateway: “${d.mcpQuote.text}” (${d.mcpQuote.date}). Exhibit's approvals work the same way.`],
              ["A model can work the case", `On the live sandbox, ${d.fight.model} investigated a $${d.fight.amount} chargeback in ${d.fight.seconds} s with ${d.fight.toolCalls} tool calls, and every one of its ${d.fight.exhibits} exhibits was checked against a real record.`],
            ].map(([a, b]) => (
              <Card key={a} className="px-8 py-8">
                <div className="text-[23px] font-semibold tracking-[-0.015em]">{a}</div>
                <p className="mt-3 text-[18px] leading-[1.55] text-muted">{b}</p>
              </Card>
            ))}
          </div>
          <figure className="mt-10 max-w-[1250px] border-l-2 border-ink pl-6">
            <blockquote className="text-[25px] font-medium leading-snug tracking-[-0.01em]">“It is really all about trust and about the security that we will be providing both to merchants and to consumers.”</blockquote>
            <figcaption className="mt-2 text-[16px] text-muted">Enrique Lores, PayPal CEO, on agentic commerce. Q3 2026 earnings call, Oct 27, 2026.</figcaption>
          </figure>
        </Frame>
      ),
    },
    {
      label: "Founder",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <div className="grid flex-1 grid-cols-[300px_minmax(0,1fr)] items-center gap-16">
            <p className="num self-start pt-3 text-[15px] uppercase tracking-[0.12em] text-muted">From the founder</p>
            <div className="max-w-[1000px]">
              <div className="space-y-6 text-[28px] leading-[1.55] text-ink-2">
                <p>
                  I&apos;m {d.founder.name}. I run KaDeep AI from {d.founder.city}, and I built Exhibit on my own for the PayPal AI Hackathon, starting with the first commit on {d.founder.firstCommit}.
                </p>
                <p>I wanted a dispute agent a merchant could actually trust. That means it shows where every claim comes from, never moves money without the merchant, and says so plainly when the buyer is right. The code is open, so you can check all of it.</p>
              </div>
              <div className="mt-12 flex items-end justify-between gap-10 border-t border-line pt-6">
                <div>
                  <div className="text-[20px] font-semibold">{d.founder.name}</div>
                  <div className="text-[17px] text-muted">
                    {d.founder.role} · {d.founder.city} · <span className="num text-[15px]">{d.founderGithubUrl.replace("https://", "")}</span>
                  </div>
                </div>
                <p className="max-w-[520px] text-right text-[16px] leading-relaxed text-muted">KaDeep AI also builds KaDeep Studio, for AI test-case generation and browser QA, and the releasegate CLI.</p>
              </div>
            </div>
          </div>
        </Frame>
      ),
    },
    {
      label: "Close",
      render: (n, total) => (
        <Frame n={n} total={total}>
          <div className="flex flex-1 flex-col justify-center">
            <LogoMark size={72} />
            <h2 className="mt-12 max-w-[1200px] text-[100px] font-semibold leading-[1] tracking-[-0.045em]">Every dispute, answered with evidence.</h2>
            <div className="mt-14 grid max-w-[1200px] grid-cols-3 gap-6 text-[18px]">
              <div>
                <div className="text-muted">Run it</div>
                <div className="num mt-1.5 text-ink">npm install && npm run dev</div>
              </div>
              <div>
                <div className="text-muted">Source</div>
                <div className="num mt-1.5 text-ink">{d.githubUrl.replace("https://", "")}</div>
              </div>
              <div>
                <div className="text-muted">Proof</div>
                <div className="num mt-1.5 text-ink">
                  {t.calls} sandbox calls at /proof
                </div>
              </div>
            </div>
            <p className="mt-16 text-[15px] text-muted">Exhibit is an independent project. It is not affiliated with or endorsed by PayPal.</p>
          </div>
        </Frame>
      ),
    },
  );
  return slides;
}

export function Deck({ data }: { data: DeckData }) {
  const slides = useMemo(() => buildSlides(data), [data]);
  const total = slides.length;
  const [i, setI] = useState(0);
  const [scale, setScale] = useState(1);

  const go = useCallback((dir: number) => setI((x) => Math.min(total - 1, Math.max(0, x + dir))), [total]);
  // The slide asked for in the URL (#5), read once: the effect below rewrites the hash as you move.
  const linked = useRef<number | null>(null);

  useEffect(() => {
    linked.current ??= Number(window.location.hash.replace("#", "")) || 1;
    const fromHash = linked.current;
    if (fromHash >= 1 && fromHash <= total) requestAnimationFrame(() => setI(fromHash - 1));
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      // Arrow keys inside the replay's tabs move between its cases; Space and Enter press a focused control.
      if (el?.closest?.('[role="tablist"]') && ["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
      if (el?.closest?.("button, a, input, textarea, select") && [" ", "Enter"].includes(e.key)) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(total - 1);
    };
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", fit);
    };
  }, [go, total]);

  useEffect(() => {
    history.replaceState(null, "", `#${i + 1}`);
  }, [i]);

  return (
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-[#f4f4f4]">
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "center" }} className="shrink-0 overflow-hidden bg-white shadow-[0_30px_80px_-40px_rgb(10_10_10/0.35)]">
        <section key={i} className="rise h-full w-full" role="group" aria-roledescription="slide" aria-label={`${i + 1} of ${total}: ${slides[i].label}`}>
          {slides[i].render(i + 1, total)}
        </section>
      </div>
      <div className="fixed bottom-4 right-4 flex items-center gap-1 rounded-lg bg-white/90 p-1 text-[12px] shadow-[0_1px_3px_rgb(0_0_0/0.12)] backdrop-blur print:hidden">
        <Link href="/" className="px-2 text-muted hover:text-ink">
          Exit
        </Link>
        <button type="button" onClick={() => go(-1)} className="rounded p-1.5 hover:bg-sunken" aria-label="Previous slide">
          <ArrowLeft className="size-4" />
        </button>
        <button type="button" onClick={() => go(1)} className="rounded p-1.5 hover:bg-sunken" aria-label="Next slide">
          <ArrowRight className="size-4" />
        </button>
      </div>
      <div className="fixed inset-x-0 top-0 h-[3px] print:hidden">
        <div className="h-full bg-ink transition-all" style={{ width: `${((i + 1) / total) * 100}%` }} />
      </div>
    </div>
  );
}
