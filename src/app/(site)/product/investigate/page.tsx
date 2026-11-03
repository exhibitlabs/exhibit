import type { Metadata } from "next";
import { Body, ButtonLink, Container, CTA, DotArt, Eyebrow, Heading, PageHeader, Plate, PlateCaption, Reveal, ROUTES, Section, SectionHead, TextLink, UiCard, UiPill, UiSheet, UiWindow } from "@/components/site";
import { ProductCta } from "@/components/site/product/ProductCta";
import { ProductTour } from "@/components/site/product/ProductTour";
import { NextChapter } from "@/components/site/product/NextChapter";
import { BriefCardView, RunTimeline } from "@/components/site/fragments";
import { SourceGraph } from "@/components/site/product/SourceGraph";
import { REFUNDS, REYES, REYES_RUNS, REYES_TIMELINE, RUNS, SOURCES, hhmm, money, seconds, utc, utcDate } from "@/components/site/product/data";
import { productMetadata } from "@/components/site/product/meta";
import { EVALUATION, GITHUB_URL } from "@/components/landing/data";

const DESCRIPTION =
  "For each PayPal dispute, Exhibit's agent reads eight sources, from the Disputes API to carrier scans and checkout signals, decides whether to fight, offer, refund or message the buyer, and cites every reason to a record.";

export const metadata: Metadata = productMetadata({ title: "Investigate", description: DESCRIPTION, path: ROUTES.product.investigate });

const readMs = REYES_TIMELINE.lastRead - REYES_TIMELINE.firstCall;
const cited = SOURCES.filter((s) => s.exhibit).length;
const queried = SOURCES.filter((s) => s.step).length;
const kim = REFUNDS.find((r) => r.buyer === "Jordan Kim")!;

const DECISIONS = [
  {
    decision: "FIGHT" as const,
    when: "The records show the merchant did what they promised.",
    action: ["provide_evidence", "provide_supporting_info"],
    example: (
      <>
        <b>Daniel Reyes, $420, unauthorized.</b> Signed for at the transaction address, 3-D Secure passed, and he praised the briefcase in chat. Fight, 88%.
      </>
    ),
    source: "Sandbox chargeback",
  },
  {
    decision: "REFUND" as const,
    when: "The buyer is right, or the case cannot be won.",
    action: ["accept_claim", "refund_then_prove"],
    example: (
      <>
        <b>Jordan Kim, $68, item not received.</b> USPS returned the wallet as undeliverable and it was never refunded. Accepted: <span className="s-mono">accept-claim</span> 200, <span className="s-mono">{kim.debugId}</span>.
      </>
    ),
    source: "Sandbox chargeback",
  },
  {
    decision: "OFFER" as const,
    when: "A fair offer costs less than an escalated claim.",
    action: ["make_offer"],
    example: (
      <>
        <b>Sam Ortiz, $355.</b> A strap ring cracked in transit and the store&apos;s own returns policy covers damage. Offer a replacement, 20%.
      </>
    ),
    source: "Demo merchant, recorded run",
  },
  {
    decision: "MESSAGE_BUYER" as const,
    when: "A clear message will close the case before it escalates.",
    action: ["send_message"],
    example: (
      <>
        <b>Lena Vogel, $236.</b> The parcel is waiting in a DHL Packstation in Berlin. Tell her in German before the 7-day hold runs out, 80%.
      </>
    ),
    source: "Demo merchant, recorded run",
  },
];

const PLAYBOOK = [
  { reason: "Item not received", goal: "Prove delivery to the address on the PayPal transaction.", play: "Delivered to the matching address with verifiable tracking: fight, with any signature or delivery photo as its own exhibit. Returned to sender, lost or stuck: refund and offer to reship." },
  { reason: "Unauthorized", goal: "Show the cardholder made or benefited from the purchase.", play: "AVS and CVV matches, 3-D Secure, a known device, earlier undisputed orders and a message about the item: fight. Real fraud signals and weak proof: accept and flag the customer." },
  { reason: "Not as described", goal: "Show the item matched the listing, or settle it early.", play: "Seller Protection does not cover it, so it is decided on the merits. The listing disclosed what the buyer complains about: fight. At the inquiry stage an offer is usually cheaper." },
  { reason: "Duplicate charge", goal: "Show each charge is its own order.", play: "Both orders side by side, with their times, addresses and deliveries, and any message where the buyer asked for the second." },
  { reason: "Credit not processed", goal: "If a refund is owed, issue it now and prove it.", play: "Return received and refund owed: refund, then file the refund as proof. Fighting a refund you owe loses the case and the customer." },
];

const CHECKS = [
  { t: "Every citation resolves.", d: "Each tool result carries refs such as shipment:SHP-10503. A brief is rejected unless every ref it cites resolves to a record on this case. The model chooses the evidence; it cannot write it." },
  { t: "Only what PayPal allows right now.", d: "The action must be one of the dispute's current links from PayPal. An offer must be a type the dispute allows, and no amount may exceed the disputed amount." },
  { t: "The evidence PayPal asked for.", d: "Filing evidence needs the evidence types PayPal requested. Proof of fulfillment needs a shipment ref, so the tracking number comes from the carrier record." },
  { t: "Read-only tools, nothing else.", d: "On the Claude CLI the agent gets Exhibit's tools and no others: no shell, no files, no other MCP servers, no user settings." },
  { t: "Messages are data.", d: "Buyer messages and every tool result are treated as data, never as instructions. A line in a chat cannot change what the agent does." },
];

export default function InvestigatePage() {
  return (
    <>
      <ProductTour current="investigate" />
      <PageHeader
        eyebrow="Investigate"
        eyebrowIndex="01"
        title="Eight sources."
        rest="One cited decision."
        lede="For each dispute, Exhibit's agent pulls the case from PayPal and reads the records around it: the order, the carrier scans, the buyer's history and messages, the checkout signals, the store policies and PayPal's Seller Protection rules. Then it decides, and every reason points to the record it came from."
        actions={
          <>
            <ButtonLink href={CTA.primary.href} arrow>
              {CTA.primary.label}
            </ButtonLink>
            <ButtonLink href={CTA.secondary.href} variant="ghost">
              {CTA.secondary.label}
            </ButtonLink>
          </>
        }
        aside={<DotArt name="magnifier" frame className="w-[210px] sm:w-[260px] lg:w-[300px]" />}
      />

      {/* 1. The evidence graph of a real run, on Peto's Office Board */}
      <Section id="graph" labelledBy="graph-title">
        <Container>
          <SectionHead
            aside={
              <Body>
                A sandbox chargeback claims a {money(REYES.amount)} briefcase order from a demo store was unauthorized (code {REYES.reasonCode}). Exhibit read {queried} of the 8 sources in {seconds(readMs)}, cited {cited} of them as exhibits and filed its brief at {seconds(REYES.briefAt)}.
              </Body>
            }
          >
            <Heading id="graph-title" title="One real chargeback," rest="read source by source." />
          </SectionHead>
        </Container>
        <Container size="wide">
          <Reveal>
            <figure className="s-figure">
              <Plate painting="petoOfficeBoard" focus={[50, 38]} zoom={1.05} preload className="s-pr-flow" sizes="(max-width: 768px) 100vw, 1376px">
                <div className="s-pr-flow__in" style={{ ["--pad-t" as string]: "120px", ["--pad-x" as string]: "clamp(28px, 6vw, 96px)", ["--pad-b" as string]: "88px", ["--pad-t-m" as string]: "150px" }}>
                  <UiWindow label="Evidence graph, rebuilt from the app" className="mx-auto max-w-[1140px]">
                    <SourceGraph sources={SOURCES} win={REYES.winLikelihood} head={`${REYES.exhibits.length} exhibits from ${cited} sources`} initial="carrier" />
                  </UiWindow>
                </div>
              </Plate>
              <PlateCaption painting="petoOfficeBoard">
                <b>The evidence graph, rebuilt from the app.</b> Exhibit&apos;s recorded run on the PayPal sandbox chargeback <span className="s-mono">{REYES.disputeId}</span>, {utcDate(REYES.startedAt)} at {hhmm(REYES.startedAt)} UTC: {REYES.model} on the Claude CLI. Kora Atelier and its buyers are demo records.
              </PlateCaption>
            </figure>
          </Reveal>
        </Container>
      </Section>

      {/* 2. The brief itself */}
      <Section id="brief" tone="band" labelledBy="brief-title">
        <Container>
          <SectionHead aside={<Body>One brief per run: the decision, a win likelihood, the reasoning with a citation on every point, the risks and the exhibits for the packet. This is the brief from the run above, word for word.</Body>}>
            <Eyebrow>The brief</Eyebrow>
            <Heading id="brief-title" title="Every point cites a record." rest="And the risks are stated." />
          </SectionHead>
          <div className="s-pr-brief">
            <Reveal className="s-pr-brief__sheet">
              <UiSheet className="s-pr-briefcard" label={`Exhibit's brief for ${REYES.disputeId}, as the case page shows it`}>
                <BriefCardView risks={false} />
              </UiSheet>
            </Reveal>
            <div className="s-pr-brief__side">
              <Reveal delay={70}>
                <h3 className="s-h s-h--h3">Risks, stated in the brief</h3>
                <ol className="s-pr-risks">
                  {REYES.risks.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ol>
              </Reveal>
              <Reveal delay={140} className="s-pr-brief__action">
                <h3 className="s-h s-h--h4">The PayPal action it chose</h3>
                <p className="s-body">
                  <span className="s-mono">provide_supporting_info</span>. PayPal was already reviewing the chargeback, and supporting info was the one response open to the seller. The brief&apos;s last point says so and cites the dispute itself.
                </p>
                <p className="s-small">When a brief is filed, its exhibits become the evidence packet. A later run on this case, with the same call, is the one that was filed.</p>
                <TextLink href={ROUTES.product.evidencePackets}>See the packet filed on this case</TextLink>
              </Reveal>
            </div>
          </div>
        </Container>
      </Section>

      {/* 3. The run on a time axis, and every run on this case */}
      <Section id="time" labelledBy="time-title">
        <Container>
          <SectionHead aside={<Body>Reading the records took {seconds(readMs)}. Writing the cited brief took {seconds(REYES_TIMELINE.briefAt - REYES_TIMELINE.lastRead)}. The times come from Exhibit&apos;s own log of the run.</Body>}>
            <Eyebrow>The run</Eyebrow>
            <Heading id="time-title" title={`${seconds(REYES.durationMs)}, start to brief.`} rest="Most of it is writing." />
          </SectionHead>
          <Reveal>
            <UiCard>
              <RunTimeline />
            </UiCard>
          </Reveal>
          <div className="s-pr-runs">
            <Reveal className="s-pr-runs__intro">
              <h3 className="s-h s-h--h3">Every run on this case</h3>
              <p className="s-body">
                The Reyes chargeback was investigated {REYES_RUNS.length} times on the live sandbox. Every run that finished made the same call. {RUNS.total} runs in all: {RUNS.briefs} filed a brief, {RUNS.noBrief} ended without one and filed nothing, {RUNS.unfinished} never finished.
              </p>
              <TextLink href={ROUTES.proof}>See every call on the record</TextLink>
            </Reveal>
            <Reveal delay={70} className="s-table-wrap">
              <table className="s-table">
                <caption className="s-sr-only">Every Exhibit run on {REYES.disputeId}</caption>
                <thead>
                  <tr>
                    <th scope="col">Started (UTC)</th>
                    <th scope="col">Result</th>
                    <th scope="col">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {REYES_RUNS.map((r) => (
                    <tr key={r.id} className={r.id === REYES.runId ? "s-pr-runs__hl" : undefined}>
                      <td className="s-mono">{utc(r.startedAt)}</td>
                      <td>
                        {r.status === "done" ? (
                          <>
                            Fight, {r.winLikelihood}%, {r.exhibits} exhibits
                          </>
                        ) : r.status === "running" ? (
                          <span className="text-[var(--s-muted)]">Did not finish</span>
                        ) : (
                          <span className="text-[var(--s-muted)]">No brief: the agent finished without filing one</span>
                        )}
                      </td>
                      <td className="s-mono">{r.durationMs ? seconds(r.durationMs) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* 4. How it decides */}
      <Section id="decisions" labelledBy="decisions-title">
        <Container>
          <SectionHead aside={<Body>It fights when the records show the merchant did what they promised. It refunds or offers when the merchant is at fault or the case cannot be won: a lost fight costs the amount, the fee and the customer.</Body>}>
            <Eyebrow>How it decides</Eyebrow>
            <Heading id="decisions-title" title="Four possible calls." rest="Each decided on the merits." />
          </SectionHead>
          <div className="s-pr-decisions">
            {DECISIONS.map((d, i) => (
              <Reveal key={d.decision} delay={i * 60} className="s-pr-decision">
                <UiPill decision={d.decision} className="s-pr-decision__pill" />
                <p className="s-pr-decision__when">{d.when}</p>
                <p className="s-pr-decision__action">
                  {d.action.map((a) => (
                    <span key={a} className="s-mono">
                      {a}
                    </span>
                  ))}
                </p>
                <p className="s-pr-decision__ex">{d.example}</p>
                <p className="s-pr-decision__src">{d.source}</p>
              </Reveal>
            ))}
          </div>
          <p className="s-small s-pr-decisions__note">Offers and messages reach PayPal only at the inquiry stage. They are tested against the PayPal simulator, not yet on the live sandbox, whose test chargebacks skip that stage.</p>

          <div className="s-pr-play">
            <Reveal className="s-pr-play__head">
              <h3 className="s-h s-h--h3">The playbook, by dispute reason</h3>
              <p className="s-body">Exhibit&apos;s own strategy for each reason. It is guidance for the agent, kept apart from the PayPal Seller Protection requirements it quotes word for word.</p>
              <TextLink href={`${GITHUB_URL}/blob/main/src/lib/agent/playbook.ts`}>Read the playbook</TextLink>
            </Reveal>
            <Reveal delay={70} className="s-table-wrap">
              <table className="s-table s-pr-play__table s-pr-stack">
                <caption className="s-sr-only">Exhibit&apos;s playbook by dispute reason</caption>
                <thead>
                  <tr>
                    <th scope="col">Reason</th>
                    <th scope="col">Goal</th>
                    <th scope="col">When it fights, and when it doesn&apos;t</th>
                  </tr>
                </thead>
                <tbody>
                  {PLAYBOOK.map((p) => (
                    <tr key={p.reason}>
                      <th scope="row">{p.reason}</th>
                      <td>{p.goal}</td>
                      <td>{p.play}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </div>

          {EVALUATION ? (
            <Reveal className="s-pr-eval">
              <div className="s-pr-eval__nums">
                <div>
                  <span className="s-pr-eval__n">30/30</span>
                  <span className="s-pr-eval__l">decisions matched the label</span>
                </div>
                <div>
                  <span className="s-pr-eval__n">9/9</span>
                  <span className="s-pr-eval__l">buyer-right cases refunded</span>
                </div>
                <div>
                  <span className="s-pr-eval__n">0/18</span>
                  <span className="s-pr-eval__l">false fights</span>
                </div>
                <div>
                  <span className="s-pr-eval__n">29 s</span>
                  <span className="s-pr-eval__l">median per case</span>
                </div>
              </div>
              <div className="s-pr-eval__caveat">
                <p>
                  <b>Read this first.</b> 30 synthetic disputes, written and labelled by Exhibit&apos;s builders with Claude before one live run on Claude Opus 5.5, Nov 3, 2026. It shows Exhibit applies its rules consistently. It does not measure accuracy on real disputes.
                </p>
                {EVALUATION.url ? <TextLink href={EVALUATION.url}>Method, results and limits</TextLink> : null}
              </div>
            </Reveal>
          ) : null}
        </Container>
      </Section>

      {/* 5. Guardrails */}
      <Section id="guardrails" tone="night" labelledBy="guardrails-title">
        <Container>
          <SectionHead aside={<Body>Its eight tools only read. A brief is checked before it is saved, and nothing reaches PayPal until you approve it or an Autopilot rule you set allows it.</Body>}>
            <Eyebrow>Guardrails</Eyebrow>
            <Heading id="guardrails-title" title="The agent can look." rest="It cannot touch." />
          </SectionHead>
          <div className="s-pr-guard">
            <dl className="s-pr-guard__list">
              {CHECKS.map((c, i) => (
                <Reveal key={c.t} delay={i * 50}>
                  <dt>{c.t}</dt>
                  <dd>{c.d}</dd>
                </Reveal>
              ))}
            </dl>
            <div className="s-pr-guard__side">
              <Reveal>
                <div data-ui className="s-term s-pr-guard__term" role="group" aria-label="A brief sent back by the check, from the evaluation">
                  <div className="s-term__bar" aria-hidden>
                    <i />
                    <i />
                    <i />
                    <span>evaluation · case inr-07</span>
                  </div>
                  <div>
                    <span className="p">→ </span>
                    <span className="c">file_case_brief</span>
                  </div>
                  <div>
                    <span className="y">rejected</span> <span className="p">provide_evidence needs evidence_types</span>
                  </div>
                  <div>
                    <span className="p">→ </span>
                    <span className="c">file_case_brief</span> <span className="p">refiled</span>
                  </div>
                  <div>
                    <span className="g">accepted</span> <span className="p">FIGHT · 90% · provide_evidence · 5 exhibits</span>
                  </div>
                </div>
                <p className="s-small s-pr-guard__cap">The one brief of 30 the check sent back during the evaluation, a synthetic case on Nov 3, 2026. The agent added the evidence types, proof of fulfillment and the delivery signature, and refiled.</p>
              </Reveal>
              <Reveal delay={90} className="s-pr-auto">
                <h3 className="s-h s-h--h4">Autopilot, inside hard limits</h3>
                <p>Off by default. When you turn it on, Exhibit acts on its own only inside the rules you set, and never past limits no setting can raise.</p>
                <table className="s-pr-auto__table">
                  <caption className="s-sr-only">Autopilot rules and limits</caption>
                  <tbody>
                    <tr>
                      <th scope="row">Fight</th>
                      <td>at 85% or more, up to $300 by default</td>
                    </tr>
                    <tr>
                      <th scope="row">Refund</th>
                      <td>up to $75 by default</td>
                    </tr>
                    <tr>
                      <th scope="row">Offers</th>
                      <td>off by default</td>
                    </tr>
                    <tr>
                      <th scope="row">Never</th>
                      <td>below 60%, above $1,000, on a low-confidence brief, or on a run an outside agent started</td>
                    </tr>
                  </tbody>
                </table>
              </Reveal>
            </div>
          </div>
          <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3">
            <TextLink href={ROUTES.security}>How Exhibit handles security</TextLink>
            <TextLink href={`${GITHUB_URL}/blob/main/src/lib/agent/tools.ts`}>Read the eight tools</TextLink>
          </div>
        </Container>
      </Section>

      <NextChapter current="investigate" />
      <ProductCta
        id="investigate-cta"
        title="Each dispute has a record."
        rest="Exhibit reads all of it."
        lede="Run a case in the live demo and watch the graph light up as each source is read. No sign-up: it runs on a demo store with recorded Claude runs, and every tool call executes live."
        art="slip"
      />
    </>
  );
}
