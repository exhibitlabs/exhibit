import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ButtonLink, Container, DotArt, PageHeader, ROUTES, Stat, StatusCode, TextLink, UiPill } from "@/components/site";
import { callKind, describe, fmtDate, fmtDateTime, fmtMs, fmtSeconds, LESSONS, MODEL_NAME, NOT_LIVE, OUTCOME_TEXT, PROOF, RECORD, shortPath, usd, type CallKind } from "@/components/site/facts";
import { CallStrip } from "@/components/site/home/ProofBoard";
import { GITHUB_URL } from "@/components/landing/data";

const TITLE = "Proof: what Exhibit did on the live PayPal sandbox";
const DESCRIPTION = `${RECORD.totals.calls} logged PayPal sandbox API calls from Exhibit: real dispute ids, endpoints, HTTP status, latency and PayPal debug ids. Plus a plain list of what has not been tested live.`;

export const metadata: Metadata = {
  title: { absolute: `${TITLE} · Exhibit` },
  description: DESCRIPTION,
  alternates: { canonical: "/proof" },
  // Nested metadata objects replace the parent's, so these repeat the shared fields.
  openGraph: { type: "website", siteName: "Exhibit", locale: "en_US", url: "/proof", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const PROVIDER: Record<string, string> = { "claude-code": "Claude CLI", anthropic: "Claude API", replay: "Recorded" };
const SECTIONS = [
  { id: "glance", label: "The record at a glance" },
  { id: "disputes", label: "The four chargebacks" },
  { id: "writes", label: "Every call that changed something" },
  { id: "endpoints", label: "Endpoints exercised live" },
  { id: "runs", label: "Agent runs" },
  { id: "lessons", label: "What the real API taught us" },
  { id: "not-live", label: "Not tested live yet" },
  { id: "log", label: "Every call" },
];

function Block({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="s-rec__block">
      <h2 id={`${id}-title`} className="s-h s-h--h3 s-rec__title">
        {title}
      </h2>
      {intro ? <div className="s-rec__intro">{intro}</div> : null}
      <div className="s-rec__body">{children}</div>
    </section>
  );
}

function Table({ caption, head, children, wide }: { caption: string; head: string[]; children: ReactNode; wide?: boolean }) {
  return (
    <div className="s-table-wrap s-rec__table" tabIndex={0} role="region" aria-label={caption}>
      <table className="s-table" style={{ minWidth: wide ? 860 : 620 }}>
        <caption className="s-sr-only">{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export default function ProofPage() {
  const t = RECORD.totals;
  const runsOk = RECORD.runs.filter((r) => r.status === "done").length;
  const runsNoBrief = RECORD.runs.filter((r) => r.status === "error").length;
  const runsUnfinished = RECORD.runs.filter((r) => r.status === "running").length;
  const label: Record<CallKind, string> = { read: "reads", setup: "sandbox setup", filing: "responses filed", error: "errors" };
  const counts = (["read", "setup", "filing", "error"] as CallKind[]).map((k) => ({ k, n: RECORD.calls.filter((c) => callKind(c) === k).length }));
  const maxCalls = Math.max(...RECORD.endpoints.map((e) => e.calls));
  return (
    <>
      <PageHeader
        eyebrow="Proof"
        title="The sandbox record."
        rest="Every call Exhibit made to PayPal."
        lede={
          <>
            Every row below comes from Exhibit&apos;s own log of calls to <span className="s-mono" style={{ whiteSpace: "nowrap" }}>{RECORD.host}</span>, exported to this page. Dispute ids and PayPal debug ids are as PayPal returned them. No credentials, request bodies or buyer emails are stored here. The buyers and store records behind these cases belong to Kora Atelier, a demo merchant.
          </>
        }
        actions={
          <>
            <ButtonLink href={ROUTES.app} arrow>
              Try the live demo
            </ButtonLink>
            <ButtonLink href={`${GITHUB_URL}/blob/main/docs/SANDBOX_E2E.md`} variant="ghost">
              Read the write-up
            </ButtonLink>
          </>
        }
        aside={<DotArt name="receipt" frame className="s-rec__art" title="Dot drawing of a long receipt" />}
      />

      <Container className="s-rec">
        <nav className="s-rec__toc" aria-label="On this page">
          <p className="s-rec__toch">On this page</p>
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.label}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="s-rec__main">
          <Block
            id="glance"
            title="The record at a glance"
            intro={
              <>
                Calls from {fmtDateTime(RECORD.from)} to {fmtDateTime(RECORD.to)}. {RECORD.cacheRowsDropped} log rows that replayed a cached dispute read within seconds, with the same debug id and about 0 ms, are left out: they were not separate calls to PayPal.
              </>
            }
          >
            <dl className="s-rec__stats">
              {[
                [t.calls, "API calls logged"],
                [t.ok, "returned 2xx"],
                [t.errors, "returned an error"],
                [t.endpoints, "endpoints"],
                [t.disputes, "sandbox chargebacks"],
                [RECORD.filed.length, "responses filed"],
                [t.runs, "agent runs"],
              ].map(([v, l]) => (
                <div key={l as string}>
                  <dt className="s-sr-only">{l}</dt>
                  <dd>
                    <Stat value={v} label={l} />
                  </dd>
                </div>
              ))}
            </dl>
            <div className="s-board__dots s-rec__dots" role="img" aria-label={`${t.calls} logged calls, one dot each, in order: ${counts.map((c) => `${c.n} ${label[c.k]}`).join(", ")}.`}>
              <CallStrip cols={61} className="s-board__dots-wide" />
              <CallStrip cols={22} className="s-board__dots-narrow" />
            </div>
            <div className="s-board__legend">
              <ul>
                {counts.map((c) => (
                  <li key={c.k}>
                    <i className={`s-board__key s-board__key--${c.k}`} aria-hidden />
                    <span className="s-num">{c.n}</span> {label[c.k]}
                  </li>
                ))}
              </ul>
              <span>One dot per call, oldest first.</span>
            </div>
          </Block>

          <Block id="disputes" title="The four chargebacks" intro="Opened on sandbox captures with PayPal's sandbox-only process-chargeback endpoint, then investigated by Exhibit's agent and answered through the Disputes API. Exhibit's call is the latest finished brief on the case.">
            <ul className="s-rec__cases">
              {RECORD.disputes.map((d) => (
                <li key={d.id} className="s-rec__case">
                  <div className="s-rec__casehead">
                    <span className="s-mono">{d.id}</span>
                    <span className={`s-rec__status${d.status === "RESOLVED" ? " is-resolved" : ""}`}>{d.status}</span>
                  </div>
                  <p className="s-rec__claim">
                    {d.reasonLabel}, {usd(d.amount, 0)}
                  </p>
                  <p className="s-small">
                    {d.buyer}, demo buyer · capture <span className="s-mono">{d.captureId}</span>
                  </p>
                  <div className="s-rec__call">
                    {d.decision ? <UiPill decision={d.decision as "FIGHT" | "REFUND"} /> : null}
                    <span className="s-num">{d.winLikelihood}%</span>
                    <span className="s-small">
                      {d.runs} run{d.runs === 1 ? "" : "s"}
                    </span>
                  </div>
                  <ul className="s-rec__filed">
                    {d.filed.map((f) => (
                      <li key={f.debugId}>
                        <span className="s-mono">{f.path.split("/").pop()}</span>
                        <StatusCode code={f.status} />
                        <span className="s-mono s-rec__dbg">{f.debugId}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="s-small s-rec__casefoot">
                    {d.outcome ? (
                      <>
                        <span className="s-mono">
                          {d.outcome.code} · {d.outcome.reason}
                        </span>
                        . PayPal&apos;s definition: &ldquo;{OUTCOME_TEXT[d.outcome.code]}&rdquo; It followed a sandbox-only adjudicate call.
                      </>
                    ) : (
                      <>PayPal status checked {fmtDate(d.checkedAt)}.</>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </Block>

          <Block id="writes" title="Every call that changed something" intro="Filings, refunds and the sandbox setup behind them, oldest first. The two failed filings are why Exhibit now sends one evidence per call.">
            <Table caption="PayPal API calls that changed state" head={["Time (UTC)", "What it did", "Call", "HTTP", "Latency", "PayPal-Debug-Id"]} wide>
              {PROOF.writes.map((w, i) => {
                  const d = describe(w);
                  return (
                    <tr key={`${w.at}${i}`} className={w.status >= 400 ? "is-err" : undefined}>
                      <td className="s-mono">{fmtDateTime(w.at).replace(" UTC", "")}</td>
                      <td>
                        {w.status >= 400 ? "Failed: " : ""}
                        {d.label}
                        {w.disputeId ? <span className="s-mono s-rec__sub">{w.disputeId}</span> : null}
                      </td>
                      <td className="s-mono">
                        {w.method} {shortPath(w.path)}
                      </td>
                      <td>
                        <StatusCode code={w.status} />
                      </td>
                      <td className="s-mono">{fmtMs(w.ms)}</td>
                      <td className="s-mono">{w.debugId}</td>
                    </tr>
                );
              })}
            </Table>
          </Block>

          <Block id="endpoints" title="Endpoints exercised live" intro={`${RECORD.endpoints.length} PayPal endpoints across OAuth, Orders v2, Payments v2 and Disputes v1. Latency is the median of logged calls.`}>
            <Table caption="PayPal endpoints called on the sandbox" head={["Endpoint", "Calls", "2xx", "Errors", "Median"]}>
              {RECORD.endpoints.map((e) => (
                <tr key={`${e.method} ${e.endpoint}`}>
                  <td className="s-mono">
                    <b className="s-rec__method">{e.method}</b> {e.endpoint}
                  </td>
                  <td>
                    <span className="s-rec__bar">
                      <i style={{ width: `${Math.max(3, (e.calls / maxCalls) * 100)}%` }} aria-hidden />
                      <span className="s-mono">{e.calls}</span>
                    </span>
                  </td>
                  <td className="s-mono">{e.ok}</td>
                  <td className="s-mono">
                    {e.errors
                      ? Object.entries(e.statuses)
                          .filter(([k]) => Number(k) >= 400)
                          .map(([k, v]) => `${v}× ${k}`)
                          .join(", ")
                      : 0}
                  </td>
                  <td className="s-mono">{fmtMs(e.medianMs)}</td>
                </tr>
              ))}
            </Table>
          </Block>

          <Block
            id="runs"
            title="Agent runs"
            intro={
              <>
                {RECORD.runs.length} runs, all {MODEL_NAME["claude-opus-5-5"]} on the Claude CLI. {runsOk} filed a brief, {runsNoBrief} ended without one and filed nothing{runsUnfinished ? `, and ${runsUnfinished} never finished` : ""}. Every brief is validated before it is saved: citations must resolve and the action must be one PayPal allows.
              </>
            }
          >
            <Table caption="Exhibit agent runs on the sandbox" head={["Started (UTC)", "Dispute", "Model", "Result", "Duration"]}>
              {RECORD.runs.map((r) => (
                <tr key={r.id}>
                  <td className="s-mono">{fmtDateTime(r.startedAt).replace(" UTC", "")}</td>
                  <td className="s-mono">{r.disputeId}</td>
                  <td>
                    {MODEL_NAME[r.model] ?? r.model} <span className="s-rec__muted">· {PROVIDER[r.provider] ?? r.provider}</span>
                  </td>
                  <td>
                    {r.status === "done" && r.decision ? (
                      <span className="s-rec__result">
                        <UiPill decision={r.decision as "FIGHT" | "REFUND"} />
                        <span className="s-mono">
                          {r.winLikelihood}% · {r.exhibits} exhibits
                        </span>
                      </span>
                    ) : r.status === "error" ? (
                      <span className="s-rec__muted">No brief: {r.error?.replace(/\.$/, "").toLowerCase()}</span>
                    ) : (
                      <span className="s-rec__muted">Did not finish</span>
                    )}
                  </td>
                  <td className="s-mono">{r.durationMs != null ? fmtSeconds(r.durationMs) : ""}</td>
                </tr>
              ))}
            </Table>
          </Block>

          <Block id="lessons" title="What the real API taught us" intro="Each of these is now enforced by Exhibit's PayPal client and by the simulator the demo runs on.">
            <ol className="s-rec__lessons">
              {LESSONS.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ol>
          </Block>

          <Block id="not-live" title="Not tested live yet" intro="Honest gaps. Each one is implemented and runs against the simulator, which follows PayPal's documented request and response shapes.">
            <ul className="s-rec__gaps">
              {NOT_LIVE.map((n) => (
                <li key={n.what}>
                  <h3>{n.what}</h3>
                  <p>{n.why}</p>
                </li>
              ))}
            </ul>
          </Block>

          <Block id="log" title="Every call" intro={`All ${RECORD.calls.length} calls, oldest first.`}>
            <div className="s-rec__log" tabIndex={0} role="region" aria-label="Every logged PayPal sandbox API call">
              <table className="s-table">
                <caption className="s-sr-only">Every logged PayPal sandbox API call</caption>
                <thead>
                  <tr>
                    {["Time (UTC)", "Method", "Path", "HTTP", "Latency", "PayPal-Debug-Id"].map((h) => (
                      <th key={h} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RECORD.calls.map((c, i) => (
                    <tr key={`${c.at}-${i}`}>
                      <td className="s-mono">{c.at.replace("T", " ").slice(0, 19)}</td>
                      <td className="s-mono">{c.method}</td>
                      <td className="s-mono s-rec__path">{c.path}</td>
                      <td>
                        <StatusCode code={c.status} />
                      </td>
                      <td className="s-mono">{fmtMs(c.ms)}</td>
                      <td className="s-mono">{c.debugId ?? "OAuth, no debug id"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="s-small s-rec__export">
              Exported read-only from <span className="s-mono">.data/exhibit-sandbox.db</span> by <TextLink href={`${GITHUB_URL}/blob/main/src/components/landing/records/export.mjs`}>records/export.mjs</TextLink>
            </p>
          </Block>
        </div>
      </Container>
    </>
  );
}
