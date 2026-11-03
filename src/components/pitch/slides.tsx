import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { BriefCard } from "@/components/site/company/cases";
import { DotArt, DotSvg, DotTrack, DotWordmark, type DotArtName } from "@/components/site/dots/DotArt";
import { callKind, fmtDate, fmtDateTime, fmtDay, fmtMs, LESSONS, MCP_TOOLS, NOT_LIVE, PAYPAL_AGENT_TOOLS, PAYPAL_FEES, PAYPAL_MCP_QUOTE, PREVENTION, PRICING, reasonLabel, RECORD, REFUND_RUN, REFUND_RUN_2, refundCall, REYES, shortPath, usd } from "@/components/site/facts";
import { FitBox } from "@/components/site/FitBox";
import { ApprovalCard, AtRiskCard, BuyerReply, CasePage, McpLines, RunTimeline } from "@/components/site/fragments";
import { CallStrip } from "@/components/site/home/ProofBoard";
import { PaintingCredit, Plate, PlateCaption } from "@/components/site/Plate";
import { Stat, StatusCode, Tag } from "@/components/site/records";
import { Eyebrow, Heading } from "@/components/site/type";
import { Terminal, UiCard, UiSheet, UiWindow } from "@/components/site/ui";
import type { DeckSlide } from "./Deck";

// The fourteen slides, drawn with the website's kit: its headings and eyebrows, the paintings, the ink dot art and
// the product pictures rebuilt from the app. Facts come from the site's facts.ts (which reads the checked-in
// records) and from DeckFacts, assembled in src/app/pitch/page.tsx. Nothing below is a fact typed by hand; the
// strings are labels and plain sentences about what the records show.

export type EvalGroup = { decision: string; label: string; matched: boolean[] };

export type DeckFacts = {
  team: { founders: readonly { name: string; role: string; github: string }[]; names: string; firstCommit: string };
  links: { github: string; contact: string; run: string };
  /** The test suite as company/records.ts counts it. */
  tests: number;
  /** The evaluation (eval/results.json), counted the way eval/RESULTS.md counts it, always shown with its caveat. */
  evaluation: {
    cases: number;
    matched: string;
    refunded: string;
    falseFights: string;
    guardrails: string;
    medianSeconds: number;
    reasons: number;
    model: string;
    date: string;
    caveat: string;
    url?: string;
    groups: EvalGroup[];
  } | null;
  /** The demo merchant's open cases by Exhibit's call (records/demo-briefs.json). */
  decisions: { label: string; n: number }[];
};

const host = (url: string) => url.replace(/^https?:\/\//, "");
const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const say = (n: number) => words[n] ?? String(n);

/** The opening of every content slide: the gold-square eyebrow and the two-tone heading. */
function Head({ eyebrow, title, rest, aside, tag, className }: { eyebrow: string; title: ReactNode; rest?: ReactNode; aside?: ReactNode; tag?: ReactNode; className?: string }) {
  return (
    <header className={`pd-head${aside ? " pd-head--aside" : ""}${className ? ` ${className}` : ""}`}>
      <div className="pd-head__main">
        <div className="pd-head__eyebrow">
          <Eyebrow as="div">{eyebrow}</Eyebrow>
          {tag}
        </div>
        <Heading as="h2" title={title} rest={rest} />
      </div>
      {aside ? <div className="pd-head__aside">{aside}</div> : null}
    </header>
  );
}

/** A line of provenance at the foot of a slide: where its facts come from. */
function Source({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={`pd-source${className ? ` ${className}` : ""}`}>{children}</p>;
}

// ------------------------------------------------------------------------------------------------ 01 Title
function Title({ facts }: { facts: DeckFacts }) {
  return (
    <div className="pd-s pd-title">
      <div className="pd-title__top">
        <div className="pd-title__row">
          <Eyebrow as="div">The AI dispute agent for PayPal merchants</Eyebrow>
          <p className="pd-title__meta">PayPal AI Hackathon 2026 · {facts.team.names}</p>
        </div>
        <Heading as="h1" title="Disputes, answered with evidence." rest="Refunds when the buyer is right." />
      </div>
      <figure className="pd-title__fig">
        <Plate painting="harnett" image="/art/harnett-hero.webp" focus={[50, 30]} zoom={1} height={470} mobile={{ focus: [28, 13], zoom: 1.5, height: 340 }} preload sizes="100vw" className="pd-title__plate">
          <UiWindow className="pd-title__win" label={`Exhibit's case page for dispute ${REYES.id}, ${REYES.buyer}, ${REYES.reason}, $${REYES.amount}: Fight, ${REYES.brief.winLikelihood}% likely to win, ${REYES.brief.exhibits.length} exhibits`}>
            <FitBox width={1386} height={1013} min={0.4} max={1} fallback={0.82} className="pd-title__fit">
              <CasePage />
            </FitBox>
          </UiWindow>
        </Plate>
        <PlateCaption painting="harnett" className="pd-cap">
          <b>Exhibit&apos;s case page.</b> {REYES.buyer}, a {usd(REYES.amount, 0)} unauthorized chargeback on the PayPal sandbox, with the brief from a recorded Claude run on {fmtDay(REYES.run.startedAt)}. Kora Atelier is a demo merchant.
        </PlateCaption>
      </figure>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 02 The problem
const PLACES: { art: DotArtName; where: string; what: string }[] = [
  { art: "letter", where: "PayPal", what: "The claim and its deadline" },
  { art: "parcel", where: "The store", what: "The order and what shipped" },
  { art: "slip", where: "The carrier", what: "The scans and the signature" },
  { art: "bubble", where: "The inbox", what: "What the buyer wrote" },
];

function Problem() {
  const f = PAYPAL_FEES;
  return (
    <div className="pd-s pd-problem">
      <Head
        eyebrow="The problem"
        title="Every dispute can carry a PayPal fee."
        rest="And the proof is in four places."
        aside={<p className="s-lede">To answer one, the merchant pulls the records from each place by hand and writes a response PayPal&apos;s reviewer can check, before PayPal&apos;s deadline.</p>}
      />
      <ol className="pd-places" aria-label="Where the proof for one dispute lives">
        {PLACES.map((p) => (
          <li key={p.where}>
            <DotArt name={p.art} className="pd-places__art" />
            <b>{p.where}</b>
            <span>{p.what}</span>
          </li>
        ))}
      </ol>
      <div className="pd-fees">
        {f.fees.map((x) => (
          <div key={x.label} className="pd-fees__item">
            <span className="pd-fees__n s-num">${x.amount}</span>
            <span className="pd-fees__t">
              <b>{x.label}</b>
              <span>{x.note}</span>
            </span>
          </div>
        ))}
      </div>
      <Source>
        &ldquo;{f.quote}&rdquo; PayPal US business fees, updated {f.updated}, checked {f.retrieved}. The fee comes on top of the amount in dispute.
      </Source>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 03 The gap
// Exhibit's twelve steps on a dispute, as the homepage's gap section lists them. PayPal's three dispute tools for
// agents (PAYPAL_AGENT_TOOLS) cover steps 1, 2 and 10.
const STEPS: { name: string; paypal?: string; simulator?: boolean }[] = [
  { name: "Find open disputes", paypal: "list_disputes" },
  { name: "Read the case", paypal: "get_dispute" },
  { name: "Investigate the records" },
  { name: "Check Seller Protection" },
  { name: "Decide" },
  { name: "Cite every claim" },
  { name: "Build the packet" },
  { name: "File the response" },
  { name: "Offer or message", simulator: true },
  { name: "Accept or refund", paypal: "accept_dispute_claim" },
  { name: "Prevent the next one" },
  { name: "Wait for approval" },
];

function Gap() {
  const tools = PAYPAL_AGENT_TOOLS.tools;
  const covered = STEPS.map((s, i) => (s.paypal && tools.some((t) => t.name === s.paypal) ? i : -1)).filter((i) => i >= 0);
  // Why offers and buyer messages are not tested live, as the sandbox record explains it (NOT_LIVE).
  const offers = NOT_LIVE.find((n) => /make-offer/.test(n.what));
  return (
    <div className="pd-s pd-gap">
      <Head eyebrow="The insight" title="PayPal's agent tools can list, read and accept a dispute." rest="Exhibit does the rest, and the merchant approves." />
      <div className="pd-gap__board">
        <div className="pd-gap__row">
          <p className="pd-gap__cap">
            <b>PayPal&apos;s agent tools</b>
            <span className="s-num">
              {covered.length} of {STEPS.length} steps
            </span>
          </p>
          <DotTrack12 filled={covered} label={`PayPal's agent tools cover ${covered.length} of the ${STEPS.length} steps: finding disputes, reading one, and accepting the claim.`} />
        </div>
        <div className="pd-gap__row">
          <p className="pd-gap__cap">
            <b>Exhibit</b>
            <span className="s-num">
              {STEPS.length} of {STEPS.length} steps
            </span>
          </p>
          <DotTrack12 filled="all" label={`Exhibit covers all ${STEPS.length} steps.`} />
        </div>
        <ol className="pd-gap__steps">
          {STEPS.map((s, i) => (
            <li key={s.name} className={s.paypal ? "is-paypal" : undefined}>
              <span className="s-num">{String(i + 1).padStart(2, "0")}</span>
              {s.name}
              {s.simulator ? <sup>*</sup> : null}
            </li>
          ))}
        </ol>
      </div>
      <ul className="pd-gap__tools">
        {tools.map((t) => (
          <li key={t.name}>
            <code>{t.name}</code>
            <q>{t.description}</q>
          </li>
        ))}
      </ul>
      <Source>
        PayPal&apos;s dispute tools for AI agents, quoted from its agent tools reference, retrieved {fmtDate(PAYPAL_AGENT_TOOLS.retrieved)}.
        {offers ? <> * Offers and buyer messages run on the simulator, not yet on the live sandbox: {offers.why.split(/(?<=\.)\s+/)[0]}</> : null}
      </Source>
    </div>
  );
}

/** The site's dotted comparison track, twelve boxes across. */
function DotTrack12({ filled, label }: { filled: number[] | "all"; label: string }) {
  return <DotTrack filled={filled} label={label} className="pd-track" columnsMobile={6} />;
}

// ------------------------------------------------------------------------------------------------ 04 The product
type StageState = "done" | "now" | "next";
function Lifecycle() {
  const b = REYES.brief;
  const f = REYES.lastFiling;
  const stages: { name: string; at: string; state: StageState; text: string; rec: ReactNode }[] = [
    {
      name: "Opened",
      at: fmtDateTime(REYES.openedAt),
      state: "done",
      text: "The cardholder's bank files a chargeback. Exhibit reads it from PayPal's Disputes API.",
      rec: (
        <>
          {REYES.reason} · <span className="s-mono">{usd(REYES.amount)}</span> · code <span className="s-mono">{REYES.reasonCode}</span>
        </>
      ),
    },
    {
      name: "Investigated",
      at: fmtDateTime(REYES.run.startedAt),
      state: "done",
      text: `Claude makes ${REYES.run.toolCalls} lookups, then writes a brief where every claim cites a record.`,
      rec: (
        <>
          Fight · {b.winLikelihood}% likely to win · {b.exhibits.length} exhibits · <span className="s-mono">{(REYES.run.durationMs / 1000).toFixed(1)} s</span>
        </>
      ),
    },
    {
      name: "Filed",
      at: fmtDateTime(f.at),
      state: "done",
      text: `${REYES.approvedByAgent ?? "An AI agent"} asked through MCP. The merchant approved. Exhibit filed the letter and the packet.`,
      rec: (
        <>
          <span className="s-mono">{f.path.split("/").pop()}</span> <StatusCode code={f.status} /> <span className="s-mono">{f.debugId}</span>
        </>
      ),
    },
    {
      name: "PayPal reviewing",
      at: `since ${fmtDay(f.at)}`,
      state: "now",
      text: "PayPal's reviewer has the case. Exhibit keeps reading the status.",
      rec: <span className="s-mono">{REYES.status}</span>,
    },
    { name: "Resolved", at: "PayPal decides", state: "next", text: "PayPal decides, not Exhibit. When the decision comes, it joins the record.", rec: <>Not decided yet</> },
  ];
  return (
    <div className="pd-s pd-lc">
      <Head eyebrow="The product" title="One real chargeback, opened to resolved." rest="Every step on the record." />
      <div className="pd-lc__grid">
        <figure className="pd-lc__file">
          <Plate painting="harnett" focus={[51, 30]} zoom={1.5} height={560} decorative sizes="(max-width: 767px) 150vw, 70vw" mobile={{ height: 200, focus: [50, 23], zoom: 2.2 }} className="pd-lc__plate" />
          <div className="s-lc__docket pd-lc__docket">
            <p className="s-lc__k">Case file</p>
            <p className="s-lc__id s-mono">{REYES.id}</p>
            <p className="s-lc__who">
              {REYES.buyer} · {REYES.reason}
            </p>
            <p className="s-lc__sub">{usd(REYES.amount)} chargeback · Kora Atelier, demo merchant</p>
            <ol className="s-lc__rail">
              {stages.map((s) => (
                <li key={s.name} className={`s-lc__st s-lc__st--${s.state}`}>
                  <span className="pd-lc__railrow">
                    <span className={`s-lc__dot s-lc__dot--${s.state}`} aria-hidden>
                      {s.state === "done" ? <Check /> : null}
                    </span>
                    <span className="s-lc__nm">{s.name}</span>
                    <span className="s-lc__tm s-num">{s.at}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="s-lc__foot">
              {REYES.runsOnCase} agent runs · {REYES.filings.length} filings, {REYES.filings.every((x) => x.status === 200) ? "all answered 200" : "all logged"}
            </p>
          </div>
          <figcaption className="pd-credit">
            <PaintingCredit painting="harnett" detail />
          </figcaption>
        </figure>
        <ol className="pd-lc__stages">
          {stages.map((s, i) => (
            <li key={s.name} className={`pd-lc__stage pd-lc__stage--${s.state}`}>
              <span className={`s-lc__dot s-lc__dot--${s.state}`} aria-hidden>
                {s.state === "done" ? <Check /> : null}
              </span>
              <div className="pd-lc__body">
                <p className="pd-lc__name">
                  <span className="s-num">{String(i + 1).padStart(2, "0")}</span> {s.name}
                  <span className="pd-lc__at s-num">{s.at}</span>
                </p>
                <p className="pd-lc__text">{s.text}</p>
                <p className="pd-lc__rec">{s.rec}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 05 Fair to buyers
function Fair({ facts }: { facts: DeckFacts }) {
  const runs = [
    { key: "refund" as const, run: REFUND_RUN },
    { key: "refund2" as const, run: REFUND_RUN_2 },
  ];
  const total = facts.decisions.reduce((a, d) => a + d.n, 0);
  return (
    <div className="pd-s pd-fair">
      <Head eyebrow="Fair to buyers" title="When the buyer is right, Exhibit refunds." rest="It tells the merchant not to fight." />
      <div className="pd-fair__cards">
        {runs.map(({ key, run }) => {
          const call = refundCall(run.disputeId);
          return (
            <figure key={key} className="pd-fair__case">
              <BriefCard run={key} />
              {call ? (
                <figcaption className="pd-fair__filed">
                  <span className="s-mono">accept-claim</span> <StatusCode code={call.status} /> <span className="s-mono">{call.debugId}</span>
                  <span>
                    {run.claim.buyer}, {fmtDateTime(call.at)}
                  </span>
                </figcaption>
              ) : null}
            </figure>
          );
        })}
      </div>
      <div className="pd-fair__foot">
        <p className="pd-fair__lede">
          On the live sandbox, Exhibit told the merchant not to fight {say(runs.length)} chargebacks where the buyer was right. Both claims were accepted through PayPal&apos;s API, with a letter that says why.
        </p>
        <div className="pd-mix">
          <p className="pd-mix__t">Fight is one of four calls. The demo merchant&apos;s {say(total)} open cases, one dot each:</p>
          <ul className="pd-mix__groups">
            {facts.decisions.map((d) => (
              <li key={d.label}>
                <DotSvg grid={["#".repeat(d.n)]} className="s-dots pd-mix__dots" title={`${d.label}: ${d.n}`} />
                <span>
                  {d.label} <span className="s-num">{d.n}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Source>Two sandbox chargebacks and their recorded Claude runs. Buyer names and store records are demo data, as is the demo merchant&apos;s case mix.</Source>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 06 Prevention
function Prevention() {
  const s = PREVENTION.save;
  return (
    <div className="pd-s pd-prev">
      <Head
        eyebrow="Prevention"
        title="Stops disputes before they are filed."
        rest="In the buyer's own language."
        aside={<p className="s-lede">Exhibit scores recent orders for the signs that come before a PayPal case: stalled tracking, a waiting buyer, an overdue refund. Then it fixes them.</p>}
      />
      <figure className="pd-prev__fig">
        <div className="pd-prev__stage">
          <Plate painting="sommar" focus={[50, 30]} zoom={1} height={540} sizes="100vw" mobile={{ height: 220, focus: [40, 40], zoom: 1.4 }} className="pd-prev__plate" />
          <UiSheet className="pd-prev__risk" label={`At-risk order ${s.orderId}, ${s.buyer}, risk ${s.fix.before.score} of 100: buyer waiting, tracking stalled.`}>
            <AtRiskCard />
          </UiSheet>
          <UiSheet className="pd-prev__reply" label={`Exhibit's reply to ${s.buyer}, in German`}>
            <BuyerReply />
          </UiSheet>
        </div>
        <PlateCaption painting="sommar" className="pd-cap">
          <b>Prevention.</b> A German buyer about to open a case. Exhibit answered in German with the DHL scan history and a plan, and the case was never opened: risk {s.fix.before.score} to {s.fix.after.score}, {usd(s.fix.saved, 0)} kept. Demo merchant, PayPal simulator.
        </PlateCaption>
      </figure>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 07 For AI agents
function Agents() {
  const f = REYES.lastFiling;
  return (
    <div className="pd-s pd-agents">
      <div className="pd-agents__l">
        <Head eyebrow="For AI agents" title="Agents request." rest="Merchants approve." />
        <p className="s-lede">
          Exhibit is an MCP server with {MCP_TOOLS.length} tools. An agent can investigate a case and prepare the response. Anything that files, refunds or messages a buyer waits for the merchant.
        </p>
        <blockquote className="s-quote pd-quote">
          <p>&ldquo;{PAYPAL_MCP_QUOTE.text}&rdquo;</p>
          <footer>
            PayPal Developer Blog, {PAYPAL_MCP_QUOTE.title}, {PAYPAL_MCP_QUOTE.date}. Exhibit holds money to the same rule: on approval it re-reads the dispute, and a request against an older brief expires.
          </footer>
        </blockquote>
        <p className="pd-agents__fact">
          <span className="pd-agents__tick" aria-hidden>
            <Check />
          </span>
          <span>
            <b>
              {fmtDate(f.at)}: {REYES.approvedByAgent ?? "An AI agent"} asked, the merchant approved, PayPal answered {f.status}.
            </b>{" "}
            <span className="s-mono">{f.debugId}</span>
          </span>
        </p>
      </div>
      <div className="pd-agents__ui">
        <ApprovalCard decided={false} />
        <Terminal title="exhibit · mcp" label={`The MCP tool flow behind the ${fmtDate(f.at)} filing`} className="pd-agents__term">
          <McpLines />
        </Terminal>
        <p className="pd-agents__cap">The request as the merchant saw it in Exhibit, and the tool flow behind the {fmtDate(f.at)} filing. None of the {MCP_TOOLS.length} tools files, refunds or messages a buyer on its own.</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 08 Proof
function Proof() {
  const t = RECORD.totals;
  const kinds = [
    { k: "read", label: "reads" },
    { k: "setup", label: "sandbox setup" },
    { k: "filing", label: "responses filed" },
    { k: "error", label: "errors" },
  ] as const;
  const counts = Object.fromEntries(kinds.map((x) => [x.k, RECORD.calls.filter((c) => callKind(c) === x.k).length])) as Record<(typeof kinds)[number]["k"], number>;
  const lesson = LESSONS.find((l) => /one evidence per call/.test(l)) ?? "";
  return (
    <div className="pd-s pd-proof">
      <Head
        eyebrow="Proof"
        title="Tested live on the PayPal sandbox."
        rest="Every call on the record."
        aside={
          <p className="s-lede">
            Exhibit&apos;s own log of calls to <span className="s-mono pd-nowrap">{RECORD.host}</span>, {fmtDay(RECORD.from)} to {fmtDate(RECORD.to)}. Ids are as PayPal returned them.
          </p>
        }
      />
      <div className="pd-proof__board">
        <dl className="pd-proof__stats">
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
        <div className="pd-proof__strip">
          <div className="pd-proof__dots" role="img" aria-label={`${t.calls} logged calls, one dot each, in order: ${kinds.map((x) => `${counts[x.k]} ${x.label}`).join(", ")}.`}>
            <CallStrip cols={61} className="pd-proof__wide" />
            <CallStrip cols={22} className="pd-proof__narrow" />
          </div>
          <div className="pd-proof__legend">
            <p className="pd-proof__h">
              <span className="s-board__tag">A</span>Every call, in order
            </p>
            <ul>
              {kinds.map((x) => (
                <li key={x.k}>
                  <i className={`s-board__key s-board__key--${x.k}`} aria-hidden />
                  <span className="s-num">{counts[x.k]}</span> {x.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="pd-proof__grid">
          <div className="pd-proof__filed">
            <p className="pd-proof__h">
              <span className="s-board__tag">B</span>Every response filed
            </p>
            <table className="s-table pd-table">
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
          <div className="pd-proof__fails">
            <p className="pd-proof__h">
              <span className="s-board__tag">C</span>The failures, kept on the record
            </p>
            <ul>
              {RECORD.errors.map((c, k) => (
                <li key={`${c.at}${k}`}>
                  <StatusCode code={c.status} />
                  <span className="s-mono">
                    {c.method} {shortPath(c.path)}
                  </span>
                  <span className="s-num">{fmtMs(c.ms)}</span>
                </li>
              ))}
            </ul>
            <p className="pd-proof__lesson">{lesson}</p>
          </div>
        </div>
      </div>
      <Source>Not tested live yet: {NOT_LIVE.map((n) => n.what.replace(/\.$/, "")).map((w) => w.charAt(0).toLowerCase() + w.slice(1)).join("; ")}. Why each one is still open is on /proof.</Source>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 09 Evaluation
/** One dot per evaluation case, a row per expected call: full ink when Exhibit's decision matched the label, a pale
 *  ring when it did not. Printed with the site's dot renderer. */
function EvalDots({ groups }: { groups: EvalGroup[] }) {
  const width = Math.max(...groups.map((g) => g.matched.length));
  return (
    <ul className="pd-eval__rows">
      {groups.map((g) => {
        const ok = g.matched.filter(Boolean).length;
        const grid = [g.matched.map((m) => (m ? "#" : "o")).join("").padEnd(width, ".")];
        return (
          <li key={g.decision}>
            <span className="pd-eval__lab">
              <b>{g.label}</b>
              <span className="s-num">
                {ok}/{g.matched.length}
              </span>
            </span>
            <DotSvg grid={grid} className="s-dots pd-eval__dots" title={`${g.label}: ${ok} of ${g.matched.length} matched`} />
          </li>
        );
      })}
    </ul>
  );
}

function Evaluation({ facts }: { facts: DeckFacts }) {
  const e = facts.evaluation;
  if (!e) return null;
  return (
    <div className="pd-s pd-eval">
      <Head eyebrow="Evaluation" title={`${e.matched.replace("/", " of ")} decisions matched the label.`} rest="On synthetic cases the builders wrote." />
      <div className="pd-eval__grid">
        <figure className="pd-eval__fig">
          <figcaption className="pd-eval__figcap">One dot per case, by the call its label expects</figcaption>
          <EvalDots groups={e.groups} />
          <p className="pd-eval__note">
            {e.cases} disputes across {e.reasons} reasons, labelled and hashed before one live run of {e.model} on the Claude CLI, {e.date}.
          </p>
        </figure>
        <div className="pd-eval__side">
          <dl className="pd-eval__stats">
            {[
              [e.refunded, "buyer-right cases refunded"],
              [e.falseFights, "false fights"],
              [e.guardrails, "briefs passed the citation and action checks"],
              [`${e.medianSeconds} s`, "median per case"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="s-sr-only">{l}</dt>
                <dd>
                  <Stat value={v} label={l} />
                </dd>
              </div>
            ))}
          </dl>
          <p className="pd-eval__caveat">
            <b>Read this first.</b> {e.caveat}
          </p>
        </div>
      </div>
      {e.url ? <Source>Method, every case and the limitations: {host(e.url)}</Source> : null}
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 10 Who it's for
const WHO: { art: DotArtName; who: string; gets: string }[] = [
  { art: "shield", who: "The merchant", gets: "Sees where every claim comes from, approves before anything reaches PayPal, and hears plainly when a case can't be won." },
  { art: "terminal", who: "The merchant's AI agents", gets: "Investigate and prepare cases over MCP, next to PayPal's own agent tools. They can ask; only the merchant decides." },
  { art: "scales", who: "PayPal and the buyer", gets: "A response PayPal's reviewer can check line by line against the record, and a refund when the buyer is right." },
];

function Who() {
  const f = PAYPAL_FEES.fees;
  return (
    <div className="pd-s pd-who">
      <Head eyebrow="Who it's for" title="Independent stores that sell with PayPal." rest="Too small for a payments team." />
      <ul className="pd-who__cols">
        {WHO.map((w) => (
          <li key={w.who}>
            <span className="pd-who__panel">
              <DotArt name={w.art} className="pd-who__art" />
            </span>
            <b>{w.who}</b>
            <p>{w.gets}</p>
          </li>
        ))}
      </ul>
      <Source>
        Each dispute can cost ${f[0].amount} to ${f[1].amount} in PayPal fees, or ${f[2].amount} per card chargeback, on top of the amount in dispute (PayPal US business fees, updated {PAYPAL_FEES.updated}). We have not sized the market yet, so this deck shows no market numbers.
      </Source>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 11 Why now
function WhyNow() {
  const r = REYES.run;
  const reasons: { title: string; what: ReactNode; src: string }[] = [
    {
      title: "PayPal gives agents dispute tools.",
      what: (
        <>
          <span className="s-mono">{PAYPAL_AGENT_TOOLS.tools.map((t) => t.name).join(", ")}</span>. None of them investigates or files a response.
        </>
      ),
      src: `PayPal agent tools reference, retrieved ${fmtDate(PAYPAL_AGENT_TOOLS.retrieved)}`,
    },
    {
      title: "PayPal gates what agents may do.",
      what: <>&ldquo;{PAYPAL_MCP_QUOTE.text}&rdquo; Agents in a merchant&apos;s back office need approvals.</>,
      src: `PayPal Developer Blog, ${PAYPAL_MCP_QUOTE.date}`,
    },
    {
      title: "A model can work the case.",
      what: (
        <>
          {r.model} worked a {usd(REYES.amount, 0)} sandbox chargeback in {(r.durationMs / 1000).toFixed(1)} s. All {REYES.brief.exhibits.length} of its exhibits resolved to a record.
        </>
      ),
      src: `Recorded run, ${fmtDate(r.startedAt)}`,
    },
  ];
  return (
    <div className="pd-s pd-why">
      <Head eyebrow="Why now" title="PayPal is building for AI agents." rest={`And a model can work a case in ${Math.round(r.durationMs / 1000)} seconds.`} />
      <div className="pd-why__grid">
        <ol className="pd-why__list">
          {reasons.map((x) => (
            <li key={x.title}>
              <b>{x.title}</b>
              <p>{x.what}</p>
              <span className="pd-why__src">{x.src}</span>
            </li>
          ))}
        </ol>
        <figure className="pd-why__fig">
          <UiCard className="pd-why__card" label={`Tool calls of run ${r.id} on a time axis`}>
            <RunTimeline />
          </UiCard>
          <figcaption className="pd-why__cap">
            The recorded run on {REYES.buyer}&apos;s chargeback, {fmtDate(r.startedAt)}: PayPal&apos;s answers, the store&apos;s and Claude writing the cited brief, on one time axis.
          </figcaption>
          <dl className="pd-why__stats">
            {[
              [`${(r.durationMs / 1000).toFixed(1)} s`, "the whole run, start to finish"],
              [r.toolCalls, "lookups, at PayPal and in the store"],
              [`${REYES.brief.exhibits.length} of ${REYES.brief.exhibits.length}`, "exhibits resolved to a record"],
            ].map(([v, l]) => (
              <div key={l as string}>
                <dt className="s-sr-only">{l}</dt>
                <dd>
                  <Stat value={v} label={l} />
                </dd>
              </div>
            ))}
          </dl>
        </figure>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 12 Business model
function Model() {
  const [first, ...rest] = PRICING.line.split(/(?<=\.)\s+/);
  const last = rest.pop() ?? "";
  // The three recorded runs (records/hero-runs.json) as their briefs priced them. Expected back is win likelihood
  // times the amount for a fight, and nothing for a refund, as the app's brief card computes it.
  const ledger = [
    { who: REYES.buyer, reason: REYES.reason, call: `Fight, ${REYES.brief.winLikelihood}% likely`, amount: REYES.amount, back: REYES.brief.expectedBack },
    ...[REFUND_RUN_2, REFUND_RUN].map((r) => ({ who: r.claim.buyer ?? "Buyer", reason: reasonLabel(r.claim.reason ?? ""), call: "Refund", amount: r.claim.amount, back: 0 })),
  ];
  return (
    <div className="pd-s pd-model">
      <Head
        eyebrow="Business model"
        tag={
          <Tag dot className="pd-model__tag">
            Planned
          </Tag>
        }
        title={[first, ...rest].join(" ")}
        rest={last}
      />
      <div className="pd-model__row">
        <div className="pd-model__terms">
          <div className="pd-model__term">
            <b>Paid when it wins.</b>
            <p>Exhibit earns a share only of money it recovers for the merchant.</p>
          </div>
          <div className="pd-model__term">
            <b>Free when it says refund.</b>
            <p>A case Exhibit tells the merchant not to fight costs nothing extra.</p>
          </div>
        </div>
        <figure className="pd-ledger">
          <figcaption className="pd-ledger__cap">The model on the three recorded sandbox runs, with the figures from Exhibit&apos;s briefs</figcaption>
          <table>
            <thead>
              <tr>
                <th scope="col">Case</th>
                <th scope="col">Exhibit&apos;s call</th>
                <th scope="col" className="pd-ledger__n">At stake</th>
                <th scope="col" className="pd-ledger__n">Expected back</th>
                <th scope="col">Exhibit earns</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((x) => (
                <tr key={x.who}>
                  <td>
                    <b>{x.who}</b>
                    <span>{x.reason}</span>
                  </td>
                  <td>{x.call}</td>
                  <td className="pd-ledger__n s-mono">{usd(x.amount)}</td>
                  <td className="pd-ledger__n s-mono">{usd(x.back)}</td>
                  <td className={x.back ? undefined : "pd-ledger__none"}>{x.back ? `A share of ${usd(x.amount, 0)}, only if PayPal rules for the merchant` : "Nothing"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pd-ledger__fine">Expected back is the brief&apos;s win likelihood times the amount. PayPal has not ruled on the {REYES.buyer.split(" ").pop()} case yet.</p>
        </figure>
      </div>
      <p className="pd-model__note">{PRICING.note}</p>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 13 Founders
function Founders({ facts }: { facts: DeckFacts }) {
  const initials = (n: string) =>
    n
      .split(/\s+/)
      .map((w) => w[0])
      .join("");
  return (
    <div className="pd-s pd-team">
      <Head eyebrow="Founders" title="Two co-founders." rest="Exhibit is open source, under MIT." />
      <figure className="pd-team__fig">
        <Plate painting="mitchell" focus={[50, 50]} zoom={1.1} height={330} decorative sizes="100vw" mobile={{ height: 150, focus: [50, 45], zoom: 1.4 }} className="pd-team__plate" />
        <ul className="pd-team__people">
          {facts.team.founders.map((p) => (
            <li key={p.name}>
              <span className="pd-team__mono" aria-hidden>
                {initials(p.name)}
              </span>
              <span>
                <b>{p.name}</b>
                <span>{p.role}</span>
                <span className="s-mono pd-team__gh">{host(p.github)}</span>
              </span>
            </li>
          ))}
        </ul>
        <figcaption className="pd-credit pd-team__credit">
          <PaintingCredit painting="mitchell" detail />
        </figcaption>
      </figure>
      <dl className="pd-team__facts">
        {[
          ["Built for", "PayPal AI Hackathon 2026"],
          ["First commit", facts.team.firstCommit],
          ["Agent-requested filing, approved", fmtDate(REYES.lastFiling.at)],
          ["Automated tests", `${facts.tests}`],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <Source>The code, the tests, the prompts and the sandbox record: {host(facts.links.github)}</Source>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ 14 Close
function Close({ facts }: { facts: DeckFacts }) {
  return (
    <div className="pd-s pd-close">
      <Heading as="h2" title="Disputes, answered with evidence." rest="Refunds when the buyer is right." className="pd-close__h" />
      <DotWordmark className="pd-close__mark" />
      <dl className="pd-close__links">
        {[
          ["Run it", facts.links.run],
          ["Source", host(facts.links.github)],
          ["The record", `${RECORD.totals.calls} sandbox calls at /proof`],
          ["Contact", facts.links.contact],
        ].map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd className={k === "Contact" || k === "The record" ? undefined : "s-mono"}>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="pd-close__fine">Exhibit is an independent project. It is not affiliated with or endorsed by PayPal.</p>
    </div>
  );
}

/** The deck, in order. The Evaluation slide is left out if the evaluation has not been run. */
export function buildSlides(facts: DeckFacts): DeckSlide[] {
  const slides: (DeckSlide | null)[] = [
    { label: "Title", bare: true, content: <Title facts={facts} /> },
    { label: "The problem", content: <Problem /> },
    { label: "The gap", content: <Gap /> },
    { label: "The product", content: <Lifecycle /> },
    { label: "Prevention", content: <Prevention /> },
    { label: "For AI agents", tone: "night", content: <Agents /> },
    { label: "Proof", tone: "band", content: <Proof /> },
    facts.evaluation ? { label: "Evaluation", content: <Evaluation facts={facts} /> } : null,
    { label: "Fair to buyers", tone: "band", content: <Fair facts={facts} /> },
    { label: "Who it's for", content: <Who /> },
    { label: "Why now", content: <WhyNow /> },
    { label: "Business model", content: <Model /> },
    { label: "Founders", content: <Founders facts={facts} /> },
    { label: "Close", tone: "night", bare: true, content: <Close facts={facts} /> },
  ];
  return slides.filter((s): s is DeckSlide => !!s);
}
