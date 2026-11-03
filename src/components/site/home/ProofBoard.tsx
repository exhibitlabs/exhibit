import type { ReactNode } from "react";
import { TextLink } from "../actions";
import { callKind, describe, EVAL, fmtDate, fmtDateTime, fmtDay, fmtMs, LESSONS, NOT_LIVE, RECORD, REYES, shortPath, type CallKind } from "../facts";
import { Container, Section, SectionHead } from "../layout";
import { ROUTES } from "../nav";
import { Stat, StatusCode } from "../records";
import { Reveal } from "../Reveal";
import { Body, Eyebrow, Heading } from "../type";

// The proof, as an evidence board: the sandbox record's totals, every logged call as one dot, every
// response filed with PayPal's debug id, the failures kept on the record, what is not tested live, and the
// evaluation with its caveat. All from records/proof.json, eval/results.json and docs/SANDBOX_E2E.md.

const KIND_ORDER: CallKind[] = ["read", "setup", "filing", "error"];

/** All logged calls, one dot each, in order. `cols` dots per row. */
export function CallStrip({ cols, className }: { cols: number; className?: string }) {
  const calls = RECORD.calls;
  const rows = Math.ceil(calls.length / cols);
  const runs: Record<CallKind, string> = { read: "", setup: "", filing: "", error: "" };
  calls.forEach((c, i) => {
    const x = (i % cols) + 0.5,
      y = Math.floor(i / cols) + 0.5;
    runs[callKind(c)] += `M${x} ${y}h0.01`;
  });
  return (
    <svg viewBox={`0 0 ${cols} ${rows}`} className={className} aria-hidden focusable="false">
      <path d={runs.read} fill="none" stroke="currentColor" strokeLinecap="round" strokeDasharray="0 1" strokeWidth={0.42} opacity={0.55} />
      <path d={runs.setup} fill="none" stroke="currentColor" strokeLinecap="round" strokeDasharray="0 1" strokeWidth={0.62} opacity={0.9} />
      <path d={runs.filing} fill="none" stroke="currentColor" strokeLinecap="round" strokeDasharray="0 1" strokeWidth={0.86} />
      <path d={runs.filing} fill="none" stroke="var(--s-gold)" strokeLinecap="round" strokeDasharray="0 1" strokeWidth={0.34} />
      <path d={runs.error} fill="none" stroke="var(--s-red)" strokeLinecap="round" strokeDasharray="0 1" strokeWidth={0.86} />
    </svg>
  );
}

function Tag({ letter, children, id }: { letter: string; children: ReactNode; id?: string }) {
  return (
    <h3 className="s-board__h" id={id}>
      <span className="s-board__tag" aria-hidden>
        {letter}
      </span>
      {children}
    </h3>
  );
}

export function ProofBoard() {
  const t = RECORD.totals;
  const counts = KIND_ORDER.map((k) => ({ k, n: RECORD.calls.filter((c) => callKind(c) === k).length }));
  const label: Record<CallKind, string> = { read: "reads", setup: "sandbox setup", filing: "responses filed", error: "errors" };
  const days = [...new Set(RECORD.calls.map((c) => c.at.slice(0, 10)))];
  const fails = RECORD.errors;
  const lesson = LESSONS.find((l) => /one evidence per call/.test(l)) ?? "";
  const cardLesson = LESSONS.find((l) => /PAYEE_NOT_ENABLED/.test(l)) ?? "";
  return (
    <Section id="proof" labelledBy="proof-title">
      <Container>
        <SectionHead
          aside={
            <Body>
              Exhibit&apos;s own log of calls to <span className="s-mono" style={{ whiteSpace: "nowrap" }}>{RECORD.host}</span>, {fmtDay(RECORD.from)} to {fmtDate(RECORD.to)}. Dispute ids and debug ids are as PayPal returned them.
            </Body>
          }
        >
          <Eyebrow>Proof</Eyebrow>
          <Heading id="proof-title" title="Tested live on the PayPal sandbox." rest="Every call on the record." />
        </SectionHead>

        <div className="s-board">
          <dl className="s-board__stats">
            {[
              [t.calls, "API calls logged"],
              [t.ok, "returned 2xx"],
              [t.errors, "returned an error"],
              [t.endpoints, "endpoints"],
              [t.disputes, "sandbox chargebacks"],
              [RECORD.filed.length, "responses filed"],
              [t.runs, "agent runs"],
            ].map(([v, l]) => (
              <div key={l as string} className="s-board__stat">
                <dt className="s-sr-only">{l}</dt>
                <dd>
                  <Stat value={v} label={l} />
                </dd>
              </div>
            ))}
          </dl>

          <Reveal className="s-board__strip">
            <Tag letter="A" id="board-calls">
              Every call, in order
            </Tag>
            <div className="s-board__dots" role="img" aria-label={`${t.calls} logged calls, one dot each, in order: ${counts.map((c) => `${c.n} ${label[c.k]}`).join(", ")}.`}>
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
              <span className="s-num">
                {days.length} days with calls, {fmtDay(RECORD.from)} to {fmtDay(RECORD.to)}
              </span>
            </div>
          </Reveal>

          <div className="s-board__grid">
            <Reveal className="s-board__ledger">
              <Tag letter="B" id="board-filed">
                Every response filed
              </Tag>
              <div className="s-table-wrap">
                <table className="s-table">
                  <caption className="s-sr-only">Every dispute response Exhibit filed through PayPal&apos;s Disputes API, newest first</caption>
                  <thead>
                    <tr>
                      <th scope="col">Time (UTC)</th>
                      <th scope="col">Dispute</th>
                      <th scope="col">Call</th>
                      <th scope="col">HTTP</th>
                      <th scope="col">Debug id</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...RECORD.filed].reverse().map((w) => (
                      <tr key={w.debugId} className={w.at === REYES.lastFiling.at ? "is-key" : undefined}>
                        <td className="s-mono">{fmtDateTime(w.at).replace(" UTC", "")}</td>
                        <td className="s-mono">{w.disputeId}</td>
                        <td className="s-mono">{w.path.split("/").pop()}</td>
                        <td>
                          <StatusCode code={w.status} />
                        </td>
                        <td className="s-mono">{w.debugId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="s-small s-board__fine">
                The top row was requested by an AI agent through MCP and approved by the merchant. One sandbox case has resolved, after a sandbox-only adjudicate call that says nothing about how a real reviewer would rule.
              </p>
            </Reveal>

            <Reveal className="s-board__fails" delay={90}>
              <Tag letter="C" id="board-fails">
                The failures, kept on the record
              </Tag>
              <ul className="s-board__faillist">
                {fails.map((c, i) => (
                  <li key={`${c.at}${i}`}>
                    <StatusCode code={c.status} />
                    <span className="s-mono s-board__failpath">
                      {c.method} {shortPath(c.path)}
                    </span>
                    <span className="s-board__failmeta s-num">
                      {fmtDateTime(c.at).replace(" UTC", "")} · {fmtMs(c.ms)}
                      {c.debugId ? ` · ${c.debugId}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="s-board__lesson">
                <b>What the 400 and 500 taught Exhibit.</b> {lesson}
              </p>
              <p className="s-small">{cardLesson}</p>
            </Reveal>
          </div>

          <div className="s-board__grid s-board__grid--low">
            <Reveal className="s-board__gaps">
              <Tag letter="D" id="board-gaps">
                Not tested live yet
              </Tag>
              <ul className="s-board__gaplist">
                {NOT_LIVE.map((n) => (
                  <li key={n.what}>
                    <b>{n.what}.</b> {n.why}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal className="s-board__eval" delay={90}>
              <Tag letter="E" id="board-eval">
                The evaluation, with its caveat
              </Tag>
              <div className="s-board__evalbox">
                <dl className="s-board__evalgrid">
                  {[
                    [EVAL.matched, "decisions matched the labels"],
                    [EVAL.refunded, "buyer-right cases refunded"],
                    [EVAL.falseFights, "false fights"],
                    [`${EVAL.medianSeconds} s`, "median per case"],
                  ].map(([v, l]) => (
                    <div key={l}>
                      <dt className="s-sr-only">{l}</dt>
                      <dd>
                        <Stat value={v} label={l} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="s-board__caveat">
                  <b>Read this first.</b> {EVAL.caveat}
                </p>
              </div>
            </Reveal>
          </div>

          <div className="s-board__foot">
            <TextLink href={ROUTES.proof}>Open the full record: every call, endpoint and run</TextLink>
            <span className="s-small">
              {describe(REYES.lastFiling).label}, {fmtDateTime(REYES.lastFiling.at)}: the latest of {t.calls} calls.
            </span>
          </div>
        </div>
      </Container>
    </Section>
  );
}
