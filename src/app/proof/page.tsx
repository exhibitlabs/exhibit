import { clsx } from "clsx";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { GITHUB_URL } from "@/components/landing/data";
import { Footer } from "@/components/landing/Footer";
import { Nav } from "@/components/landing/Nav";
import { ArrowLink, Container, DecisionPill, Kicker, Panel, utcDate, utcDateTime } from "@/components/landing/Primitives";
import { describe, disputeRows, LESSONS, NOT_LIVE, OUTCOME_TEXT, PROOF, shortPath } from "@/components/landing/proof-data";

const TITLE = "Proof: what Exhibit did on the live PayPal sandbox";
const DESCRIPTION = `${PROOF.totals.calls} logged PayPal sandbox API calls from Exhibit: real dispute ids, endpoints, HTTP status, latency and PayPal debug ids. Plus a plain list of what has not been tested live.`;

export const metadata: Metadata = {
  title: { absolute: `${TITLE} · Exhibit` },
  description: DESCRIPTION,
  alternates: { canonical: "/proof" },
  // Nested metadata objects replace the parent's, so these repeat the shared fields.
  openGraph: { type: "website", siteName: "Exhibit", locale: "en_US", url: "/proof", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const MODEL_NAME: Record<string, string> = { "claude-opus-5-5": "Claude Opus 5.5" };
const PROVIDER: Record<string, string> = { "claude-code": "Claude CLI", anthropic: "Claude API", replay: "Recorded" };

function Block({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 border-t border-line py-14 md:py-16">
      <Container>
        <div className="max-w-[720px]">
          <h2 id={`${id}-title`} className="text-[22px] font-semibold tracking-[-0.022em] text-ink">
            {title}
          </h2>
          {intro ? <div className="mt-2 text-[14.5px] leading-relaxed text-muted">{intro}</div> : null}
        </div>
        <div className="mt-7 min-w-0">{children}</div>
      </Container>
    </section>
  );
}

function Status({ code }: { code: number }) {
  return <span className={clsx("num inline-flex rounded px-1.5 py-0.5 text-[11.5px] font-medium", code < 300 ? "bg-green-soft text-green" : "bg-red-soft text-red")}>{code}</span>;
}

function Table({ head, children, minWidth = 720, caption }: { head: ReactNode[]; children: ReactNode; minWidth?: number; caption: string }) {
  return (
    <>
    <p className="mb-2 text-[12px] text-muted md:hidden" aria-hidden>
      Swipe the table sideways to see every column.
    </p>
    <Panel>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[12.5px]" style={{ minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line bg-[#fafafa] text-[11px] uppercase tracking-[0.08em] text-muted">
              {head.map((h, i) => (
                <th key={i} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">{children}</tbody>
        </table>
      </div>
    </Panel>
    </>
  );
}

export default function ProofPage() {
  const t = PROOF.totals;
  const rows = disputeRows();
  const runsOk = PROOF.runs.filter((r) => r.status === "done").length;
  const runsNoBrief = PROOF.runs.filter((r) => r.status === "error").length;
  const runsUnfinished = PROOF.runs.filter((r) => r.status === "running").length;
  return (
    <div className="lp-page bg-white text-ink">
      <Nav />
      <main id="main">
        <Container className="pb-14 pt-14 md:pb-16 md:pt-20">
          <Kicker>Proof</Kicker>
          <h1 className="mt-5 max-w-[860px] text-balance text-[36px] font-semibold leading-[1.06] tracking-[-0.04em] text-ink sm:text-[48px]">What Exhibit has done on the live PayPal sandbox.</h1>
          <p className="mt-6 max-w-[700px] text-pretty text-[17px] leading-relaxed text-muted">
            Every row below comes from Exhibit&apos;s own log of calls to <span className="num text-[15px] text-ink-2">{PROOF.host}</span>, exported to this page. Dispute ids and PayPal debug ids are as PayPal returned them. No credentials, request bodies or buyer emails are stored here. The
            buyers and store records behind these cases belong to Kora Atelier, a demo merchant.
          </p>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line py-7 sm:grid-cols-3 lg:grid-cols-6">
            {[
              [t.calls, "API calls logged"],
              [t.ok, "returned 2xx"],
              [t.errors, "returned an error"],
              [t.endpoints, "endpoints"],
              [t.disputes, "sandbox chargebacks"],
              [t.runs, "agent runs"],
            ].map(([v, k]) => (
              <div key={k as string} className="flex flex-col gap-1.5">
                <dt className="order-2 text-[13px] text-muted">{k}</dt>
                <dd className="num order-1 text-[26px] leading-none tracking-[-0.03em] text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[13px] text-muted">
            Calls from {utcDateTime(PROOF.firstCall!)} to {utcDateTime(PROOF.lastCall!)}. {PROOF.cacheRowsDropped} log rows that replayed a cached dispute read within seconds, with the same debug id and about 0 ms, are left out: they were not separate calls to PayPal.
          </p>
        </Container>

        <Block id="disputes" title="The four chargebacks" intro="Opened on sandbox captures with PayPal's sandbox-only process-chargeback endpoint, then investigated by Exhibit's agent and answered through the Disputes API.">
          <Table caption="The four sandbox chargebacks" head={["Dispute", "Claim", "Exhibit's call", "Filed through the API", "PayPal status now"]} minWidth={860}>
            {rows.map((d) => (
              <tr key={d.id} className="align-top">
                <td className="px-4 py-3.5">
                  <div className="num whitespace-nowrap text-ink">{d.id}</div>
                  <div className="mt-0.5 text-[12px] text-muted">{d.buyer} · demo buyer</div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="text-ink">{d.reasonLabel}</div>
                  <div className="num mt-0.5 text-[12px] text-muted">
                    ${d.amount.toFixed(2)} · {d.stage?.toLowerCase()}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  {d.decision ? (
                    <div className="flex items-center gap-2">
                      <DecisionPill decision={d.decision as "FIGHT" | "REFUND"} />
                      <span className="num text-[12px] text-muted">{d.winLikelihood}%</span>
                    </div>
                  ) : null}
                  <div className="mt-1 text-[12px] text-muted">
                    {d.runs} run{d.runs === 1 ? "" : "s"}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <ul className="space-y-1">
                    {d.filed.map((f) => (
                      <li key={f.debugId} className="num text-[12px] text-ink-2">
                        {f.path.split("/").at(-1)} <Status code={f.status} />
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-3.5">
                  <div className="num text-ink">{d.status}</div>
                  {d.outcome ? (
                    <div className="mt-1 max-w-[260px] text-[12px] leading-relaxed text-muted">
                      <span className="num text-ink-2">
                        {d.outcome.code} · {d.outcome.reason}
                      </span>
                      <br />
                      PayPal&apos;s definition: “{OUTCOME_TEXT[d.outcome.code]}” {d.outcome.reason && OUTCOME_TEXT[d.outcome.reason] ? `“${OUTCOME_TEXT[d.outcome.reason]}”` : null} It followed a sandbox-only adjudicate call.
                    </div>
                  ) : (
                    <div className="mt-1 text-[12px] text-muted">checked {utcDate(d.checkedAt)}</div>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </Block>

        <Block id="writes" title="Every call that changed something" intro="Filings, refunds and the sandbox setup behind them, newest last. The two failed filings are why Exhibit now sends one evidence per call.">
          <Table caption="PayPal API calls that changed state" head={["Time (UTC)", "What it did", "Call", "Status", "Latency", "PayPal-Debug-Id"]} minWidth={900}>
            {PROOF.writes.map((w) => {
              const d = describe(w);
              return (
                <tr key={w.debugId ?? w.at} className={clsx("align-top", w.status >= 400 && "bg-red-soft/40")}>
                  <td className="num whitespace-nowrap px-4 py-3 text-muted">{utcDateTime(w.at).replace(" UTC", "")}</td>
                  <td className="px-4 py-3 text-ink">
                    {w.status >= 400 ? "Failed: " : ""}
                    {d.label}
                    {w.disputeId ? <div className="num mt-0.5 whitespace-nowrap text-[11.5px] text-muted">{w.disputeId}</div> : null}
                  </td>
                  <td className="num px-4 py-3 text-ink-2">
                    {w.method} {shortPath(w.path)}
                  </td>
                  <td className="px-4 py-3">
                    <Status code={w.status} />
                  </td>
                  <td className="num whitespace-nowrap px-4 py-3 text-muted">{w.ms.toLocaleString("en-US")} ms</td>
                  <td className="num px-4 py-3 text-ink-2">{w.debugId}</td>
                </tr>
              );
            })}
          </Table>
        </Block>

        <Block id="endpoints" title="Endpoints exercised live" intro={`${PROOF.endpoints.length} PayPal endpoints across OAuth, Orders v2, Payments v2 and Disputes v1. Latency is the median of logged calls.`}>
          <Table caption="PayPal endpoints called on the sandbox" head={["Endpoint", "Calls", "OK", "Errors", "Median"]} minWidth={620}>
            {PROOF.endpoints.map((e) => (
              <tr key={`${e.method} ${e.endpoint}`}>
                <td className="num px-4 py-2.5 text-ink-2">
                  <span className="mr-2 font-medium text-ink">{e.method}</span>
                  {e.endpoint}
                </td>
                <td className="num px-4 py-2.5 text-ink">{e.calls}</td>
                <td className="num px-4 py-2.5 text-green">{e.ok}</td>
                <td className={clsx("num px-4 py-2.5", e.errors ? "text-red" : "text-muted")}>{e.errors ? Object.entries(e.statuses).filter(([k]) => Number(k) >= 400).map(([k, v]) => `${v}× ${k}`).join(", ") : 0}</td>
                <td className="num px-4 py-2.5 text-muted">{e.medianMs.toLocaleString("en-US")} ms</td>
              </tr>
            ))}
          </Table>
        </Block>

        <Block
          id="runs"
          title="Agent runs"
          intro={
            <>
              {runsOk} runs filed a brief. {runsNoBrief} ended without one and filed nothing{runsUnfinished ? `, and ${runsUnfinished} never finished` : ""}. Every brief is validated before it is saved: citations must resolve and the action must be one PayPal allows.
            </>
          }
        >
          <Table caption="Exhibit agent runs on the sandbox" head={["Started (UTC)", "Dispute", "Model", "Result", "Duration"]} minWidth={720}>
            {PROOF.runs.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="num whitespace-nowrap px-4 py-2.5 text-muted">{utcDateTime(r.startedAt).replace(" UTC", "")}</td>
                <td className="num whitespace-nowrap px-4 py-2.5 text-ink-2">{r.disputeId}</td>
                <td className="px-4 py-2.5 text-ink-2">
                  {MODEL_NAME[r.model] ?? r.model} <span className="text-muted">· {PROVIDER[r.provider] ?? r.provider}</span>
                </td>
                <td className="px-4 py-2.5">
                  {r.status === "done" && r.decision ? (
                    <span className="flex items-center gap-2">
                      <DecisionPill decision={r.decision as "FIGHT" | "REFUND"} />
                      <span className="num text-[12px] text-muted">
                        {r.winLikelihood}% · {r.exhibits} exhibits
                      </span>
                    </span>
                  ) : r.status === "error" ? (
                    <span className="text-[12px] text-muted">No brief: {r.error?.replace(/\.$/, "").toLowerCase()}</span>
                  ) : (
                    <span className="text-[12px] text-muted">Did not finish</span>
                  )}
                </td>
                <td className="num whitespace-nowrap px-4 py-2.5 text-muted">{r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)} s` : ""}</td>
              </tr>
            ))}
          </Table>
        </Block>

        <Block id="lessons" title="What the real API taught us" intro="Each of these is now enforced by Exhibit's PayPal client and by the simulator the demo runs on.">
          <ul className="space-y-3">
            {LESSONS.map((l) => (
              <li key={l} className="flex gap-3 text-[14.5px] leading-relaxed text-ink-2">
                <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-line-strong" aria-hidden />
                <span className="min-w-0 [overflow-wrap:anywhere]">{l}</span>
              </li>
            ))}
          </ul>
        </Block>

        <Block id="not-live" title="Not tested live yet" intro="Honest gaps. Each one is implemented and runs against the simulator, which follows PayPal's documented request and response shapes.">
          <Panel>
            <ul className="divide-y divide-line">
              {NOT_LIVE.map((n) => (
                <li key={n.what} className="px-5 py-4">
                  <div className="text-[14px] font-medium text-ink">{n.what}</div>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{n.why}</p>
                </li>
              ))}
            </ul>
          </Panel>
        </Block>

        <Block id="log" title="Every call" intro={`All ${PROOF.calls.length} calls, oldest first.`}>
          <Panel>
            <div className="max-h-[640px] overflow-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-[12px]">
                <caption className="sr-only">Every logged PayPal sandbox API call</caption>
                <thead className="sticky top-0 z-10 bg-[#fafafa]">
                  <tr className="border-b border-line text-[11px] uppercase tracking-[0.08em] text-muted">
                    {["Time (UTC)", "Method", "Path", "Status", "Latency", "PayPal-Debug-Id"].map((h) => (
                      <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="num divide-y divide-line/70">
                  {PROOF.calls.map((c, i) => (
                    <tr key={`${c.at}-${i}`}>
                      <td className="whitespace-nowrap px-4 py-1.5 text-muted">{c.at.replace("T", " ").slice(0, 19)}</td>
                      <td className="px-4 py-1.5 text-ink">{c.method}</td>
                      <td className="max-w-[420px] truncate px-4 py-1.5 text-ink-2">{c.path}</td>
                      <td className={clsx("px-4 py-1.5", c.status < 300 ? "text-green" : "text-red")}>{c.status}</td>
                      <td className="whitespace-nowrap px-4 py-1.5 text-muted">{c.ms} ms</td>
                      <td className="px-4 py-1.5 text-muted">{c.debugId ?? "OAuth, no debug id"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            Exported read-only from <span className="num text-[12px] text-ink-2">.data/exhibit-sandbox.db</span> by{" "}
            <ArrowLink href={`${GITHUB_URL}/blob/main/src/components/landing/records/export.mjs`} external className="text-[13px]">
              records/export.mjs
            </ArrowLink>
          </p>
        </Block>
      </main>
      <Footer />
    </div>
  );
}
