import { Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { DotArt } from "../dots/DotArt";
import { fmtDate, fmtDateTime, fmtDay, fmtMs, fmtTime, OUTCOME_TEXT, RECORD, REYES, usd } from "../facts";
import { RunTimeline } from "../fragments";
import { Container, Section, SectionHead } from "../layout";
import { ROUTES } from "../nav";
import { PaintingCredit, Plate } from "../Plate";
import { Reveal } from "../Reveal";
import { TextLink } from "../actions";
import { Body, Eyebrow, Heading } from "../type";
import { UiCard, UiExhibit, UiStatus } from "../ui";
import { LifecycleSpy } from "./LifecycleSpy";

// The showpiece: one real sandbox chargeback told through PayPal's five stages, with the case file pinned
// in Harnett's rack on the left and the record of each stage on the right.

type State = "done" | "now" | "next";
const STAGES: { name: string; short: string; state: State }[] = [
  { name: "Opened", short: fmtDateTime(REYES.openedAt), state: "done" },
  { name: "Investigated", short: fmtDateTime(REYES.run.startedAt), state: "done" },
  { name: "Filed", short: fmtDateTime(REYES.lastFiling.at), state: "done" },
  { name: "PayPal reviewing", short: `since ${fmtDay(REYES.lastFiling.at)}`, state: "now" },
  { name: "Resolved", short: "PayPal decides", state: "next" },
];
const STATE_LABEL: Record<State, string> = { done: "Done", now: "Now", next: "Next" };
const ids = STAGES.map((_, i) => `lc-${i + 1}`);

function Row({ k, children }: { k: ReactNode; children: ReactNode }) {
  return (
    <div className="s-f-rec__row">
      <span className="s-f-rec__k">{k}</span>
      <span className="s-f-rec__v">{children}</span>
    </div>
  );
}

function Chapter({ i, time, children }: { i: number; time: ReactNode; children: ReactNode }) {
  const s = STAGES[i];
  return (
    <article id={ids[i]} className={`s-lc__ch s-lc__ch--${s.state}`} aria-labelledby={`${ids[i]}-t`}>
      <header className="s-lc__chhead">
        <span className={`s-lc__dot s-lc__dot--${s.state}`} aria-hidden>
          {s.state === "done" ? <Check /> : null}
        </span>
        <span className="s-lc__chn s-num">{String(i + 1).padStart(2, "0")}</span>
        <h3 id={`${ids[i]}-t`}>{s.name}</h3>
        <span className={`s-lc__state s-lc__state--${s.state}`}>{STATE_LABEL[s.state]}</span>
        <span className="s-lc__chtime s-num">{time}</span>
      </header>
      {children}
    </article>
  );
}

function Opened() {
  const o = REYES.opening;
  return (
    <Chapter i={0} time={<time dateTime={REYES.openedAt}>{fmtDate(REYES.openedAt)} · {fmtTime(REYES.openedAt, true)} UTC</time>}>
      <p className="s-lc__text">
        The cardholder&apos;s bank opens a chargeback: unauthorized, {usd(REYES.amount)}, reason code {REYES.reasonCode}. Exhibit reads the case from PayPal&apos;s Disputes API: who, how much, which payment, and what PayPal lets the seller do next.
      </p>
      <Reveal className="s-lc__fig s-lc__fig--split">
        <DotArt name="letter" className="s-lc__art" title="Dot drawing of a letter half out of its envelope" />
        <UiCard title="The dispute, from PayPal" meta="Disputes API" label={`Dispute ${REYES.id} as PayPal returned it`}>
          <div className="s-f-rec">
            <Row k="Dispute">
              <span className="s-ui-mono">{REYES.id}</span>
            </Row>
            <Row k="Reason">
              {REYES.reason} · code <span className="s-ui-mono">{REYES.reasonCode}</span>
            </Row>
            <Row k="Stage">Chargeback · card issuer</Row>
            <Row k="Amount">
              <span className="s-ui-mono">
                {usd(REYES.amount)} {REYES.currency}
              </span>
            </Row>
            <Row k="Buyer">{REYES.buyer} (demo buyer)</Row>
            <Row k="Capture">
              <span className="s-ui-mono">{REYES.captureId}</span>
            </Row>
            <Row k="Opened">
              <span className="s-ui-mono">{fmtDateTime(REYES.openedAt, true)}</span>
            </Row>
          </div>
        </UiCard>
      </Reveal>
      {o ? (
        <p className="s-lc__note">
          Opened on a sandbox capture with PayPal&apos;s sandbox-only <span className="s-mono">process-chargeback</span> call: <UiStatus code={o.status} /> <span className="s-mono">{fmtMs(o.ms)}</span> · debug id <span className="s-mono">{o.debugId}</span>.
        </p>
      ) : null}
    </Chapter>
  );
}

function Investigated() {
  const b = REYES.brief;
  return (
    <Chapter
      i={1}
      time={
        <time dateTime={REYES.run.startedAt}>
          {fmtDate(REYES.run.startedAt)} · {fmtTime(REYES.run.startedAt, true)} UTC
        </time>
      }
    >
      <p className="s-lc__text">
        Claude works the case with the dispute, the order, the UPS scans, the checkout signals, the buyer&apos;s messages and PayPal Seller Protection. {REYES.run.toolCalls} lookups, then a brief where every claim cites a record. The call: fight, {b.winLikelihood}% likely to win, in {(REYES.run.durationMs / 1000).toFixed(1)} s.
      </p>
      <Reveal className="s-lc__fig s-lc__fig--wide">
        <UiCard label={`Tool calls of run ${REYES.run.id} on a time axis`}>
          <RunTimeline />
        </UiCard>
        <div className="s-lc__evidence">
          <DotArt name="slip" className="s-lc__art s-lc__art--sm" title="Dot drawing of a delivery slip signed D Reyes" />
          <ul className="s-lc__exhibits" aria-label="The six exhibits">
            {b.exhibits.map((x) => (
              <li key={x.label}>
                <UiExhibit letter={x.label} />
                <span>{x.title}</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
      <p className="s-lc__note">
        The recorded run, {REYES.run.model}. The case has {REYES.runsOnCase} runs on the record; every one that finished made the same call.
      </p>
    </Chapter>
  );
}

function Filed() {
  const f = REYES.lastFiling;
  const earlier = REYES.filings.slice(0, -1);
  return (
    <Chapter
      i={2}
      time={
        <time dateTime={f.at}>
          {fmtDate(f.at)} · {fmtTime(f.at, true)} UTC
        </time>
      }
    >
      <p className="s-lc__text">
        {REYES.approvedByAgent ?? "An AI agent"} asked, through Exhibit&apos;s MCP server, to send the response. Nothing moved until the merchant approved. Then Exhibit filed the letter and the {REYES.brief.exhibits.length}-exhibit packet through PayPal&apos;s own endpoint, and PayPal answered {f.status}.
      </p>
      <Reveal className="s-lc__fig s-lc__fig--stamped">
        <UiCard className="s-lc__receipt" label={`Filing: provide-supporting-info, HTTP ${f.status}, debug id ${f.debugId}`}>
          <div className="s-f-apr">
            <span className="s-f-apr__ok">
              <Check aria-hidden />
            </span>
            <span>
              <b>Approved by the merchant</b> · {fmtDateTime(f.at)}
              <br />
              <span className="s-ui-muted">Requested by {REYES.approvedByAgent ?? "an AI agent"} through MCP: request_dispute_action</span>
            </span>
          </div>
          <div className="s-f-call">
            <span className="s-ui-mono s-f-call__m">POST</span>
            <span className="s-ui-mono s-f-call__p">/v1/customer/disputes/{REYES.id}/provide-supporting-info</span>
          </div>
          <div className="s-f-big">
            <span className="s-f-big__code">{f.status}</span>
            <span className="s-f-big__meta">
              <span className="s-ui-muted">PayPal-Debug-Id</span>
              <span className="s-ui-mono s-f-big__id">{f.debugId}</span>
            </span>
            <span className="s-f-big__meta">
              <span className="s-ui-muted">Latency</span>
              <span className="s-ui-mono">{fmtMs(f.ms)}</span>
            </span>
          </div>
          <div className="s-f-rec">
            <Row k="Sent">The response letter and the PDF packet, exhibits A to F</Row>
            {earlier.map((w) => (
              <Row key={w.debugId} k={fmtDateTime(w.at).replace(" UTC", "")}>
                <span className="s-ui-mono">{w.path.split("/").pop()}</span> <UiStatus code={w.status} /> <span className="s-ui-mono s-ui-muted">{w.debugId}</span>
              </Row>
            ))}
          </div>
        </UiCard>
        <DotArt name="stamp" className="s-lc__stamp" title="Dot drawing of a rubber stamp reading EXHIBIT A" />
      </Reveal>
      <p className="s-lc__note">The {["first", "second", "third", "fourth", "fifth"][REYES.filings.length - 1] ?? `${REYES.filings.length}th`} filing on this case. The earlier three were filed by the merchant on {fmtDate(earlier[0]?.at ?? f.at)}.</p>
    </Chapter>
  );
}

function Reviewing() {
  const reads = RECORD.statusReads;
  return (
    <Chapter i={3} time={<>checked {fmtDateTime(REYES.checkedAt, true)}</>}>
      <p className="s-lc__text">Now PayPal&apos;s reviewer has the case. While it is under review the seller can only add supporting information, and Exhibit keeps reading the status so nothing changes unseen.</p>
      <Reveal className="s-lc__fig s-lc__fig--split s-lc__fig--rev">
        <UiCard title="Status, from PayPal" meta="read only" label={`Dispute status ${REYES.status}`}>
          <div className="s-f-rec">
            <Row k="Status">
              <span className="s-f-chipstat">{REYES.status}</span>
            </Row>
            <Row k="Who has it">PayPal&apos;s reviewer</Row>
            <Row k="Seller can">
              <span className="s-ui-mono">provide-supporting-info</span>
            </Row>
            <Row k="Last checked">
              <span className="s-ui-mono">{fmtDateTime(REYES.checkedAt, true)}</span>
            </Row>
            {reads ? (
              <Row k="Status reads">
                <span className="s-ui-mono">
                  GET {reads.endpoint}: {reads.calls} calls, all {Object.keys(reads.statuses).join(", ")}, median {fmtMs(reads.medianMs)}
                </span>
              </Row>
            ) : null}
          </div>
        </UiCard>
        <DotArt name="scales" className="s-lc__art" title="Dot drawing of a balance" />
      </Reveal>
      <p className="s-lc__note">Status reads are counted across all four sandbox cases. Chargebacks move from OPEN to UNDER_REVIEW, where only provide-supporting-info is open.</p>
    </Chapter>
  );
}

function Resolved() {
  const r = RECORD.resolved;
  return (
    <Chapter i={4} time={<>not yet</>}>
      <p className="s-lc__text">PayPal decides, not Exhibit. When the decision comes, it joins the record beside every call that led to it. For this case it hasn&apos;t come yet, so the stamp is still drawn in outline.</p>
      <Reveal className="s-lc__fig s-lc__fig--split">
        <DotArt name="verdict" ghost className="s-lc__art" title="Dot drawing of a RESOLVED stamp, in outline only: not yet decided" />
        {r ? (
          <UiCard title="The one sandbox case that has resolved" label={`Resolved sandbox case ${r.id}`}>
            <div className="s-f-rec">
              <Row k="Dispute">
                <span className="s-ui-mono">{r.id}</span>
              </Row>
              <Row k="Claim">
                {r.buyer} (demo) · {usd(r.amount, 0)} · item not received
              </Row>
              <Row k="Outcome">
                <span className="s-ui-mono">{r.outcome?.code}</span>
              </Row>
              <Row k="Reason">
                <span className="s-ui-mono">{r.outcome?.reason}</span>
              </Row>
              <Row k="PayPal says">&ldquo;{OUTCOME_TEXT[r.outcome?.code ?? ""]}&rdquo;</Row>
            </div>
          </UiCard>
        ) : null}
      </Reveal>
      <p className="s-lc__note">That case closed after a sandbox-only adjudicate call, so it says nothing about how a real PayPal reviewer would rule.</p>
    </Chapter>
  );
}

export function Lifecycle() {
  return (
    <Section id="how-it-works" labelledBy="lifecycle-title" className="s-lcsec">
      <Container>
        <SectionHead
          aside={
            <Body>
              The five stages PayPal uses, told with one real sandbox chargeback: {REYES.buyer}, {usd(REYES.amount, 0)}, unauthorized. Every time, id and status code below comes from Exhibit&apos;s own log.
            </Body>
          }
        >
          <Eyebrow>How it works</Eyebrow>
          <Heading id="lifecycle-title" title="From opened to resolved," rest="with every step on the record." />
        </SectionHead>
        <div className="s-lc">
          <aside className="s-lc__aside" aria-label="The case file">
            <div className="s-lc__frame">
              <Plate
                painting="harnett"
                focus={[51, 33]}
                zoom={1.55}
                decorative
                sizes="(max-width: 1023px) 100vw, 640px"
                className="s-lc__plate"
                mobile={{ height: 170, focus: [50, 23], zoom: 2.4 }}
                style={{ "--s-plate-h": "min(660px, calc(100svh - 150px))" } as CSSProperties}
              />
              <div id="lc-docket" className="s-lc__docket" data-active="-1">
                <p className="s-lc__k">Case file</p>
                <p className="s-lc__id s-mono">{REYES.id}</p>
                <p className="s-lc__who">
                  {REYES.buyer} · {REYES.reason}
                </p>
                <p className="s-lc__sub">{usd(REYES.amount)} chargeback · Kora Atelier, demo merchant</p>
                <ol className="s-lc__rail">
                  {STAGES.map((s, i) => (
                    <li key={s.name} data-i={i} className={`s-lc__st s-lc__st--${s.state}`}>
                      <a href={`#${ids[i]}`}>
                        <span className={`s-lc__dot s-lc__dot--${s.state}`} aria-hidden>
                          {s.state === "done" ? <Check /> : null}
                        </span>
                        <span className="s-lc__nm">{s.name}</span>
                        <span className="s-lc__tm s-num">{s.short}</span>
                      </a>
                    </li>
                  ))}
                </ol>
                <p className="s-lc__foot">
                  {REYES.runsOnCase} agent runs · {REYES.filings.length} filings, {REYES.filings.every((f) => f.status === 200) ? "all answered 200" : "all logged"}
                </p>
              </div>
            </div>
            <p className="s-lc__credit">
              <PaintingCredit painting="harnett" detail />
            </p>
          </aside>
          <div className="s-lc__chapters">
            <Opened />
            <Investigated />
            <Filed />
            <Reviewing />
            <Resolved />
            <div className="s-lc__end">
              <TextLink href={ROUTES.proof}>Every call on this case, in the full record</TextLink>
            </div>
          </div>
        </div>
      </Container>
      <LifecycleSpy docketId="lc-docket" chapterIds={ids} />
    </Section>
  );
}
