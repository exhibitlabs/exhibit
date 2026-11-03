import type { Metadata } from "next";
import { Body, ButtonLink, Container, CTA, DotArt, Eyebrow, Heading, PageHeader, Plate, PlateCaption, Reveal, ROUTES, Section, SectionHead, TextLink } from "@/components/site";
import { AskReplay } from "@/components/site/product/AskReplay";
import { ProductCta } from "@/components/site/product/ProductCta";
import { ProductTour } from "@/components/site/product/ProductTour";
import { NextChapter } from "@/components/site/product/NextChapter";
import { ASK, seconds, utcDate } from "@/components/site/product/data";
import { productMetadata } from "@/components/site/product/meta";
import { GITHUB_URL } from "@/components/landing/data";

const DESCRIPTION =
  "Ask plain questions about your whole PayPal dispute book and get answers from your own records, with a chart when it helps. Read-only: an answer that names a case that does not exist, or charts a number no tool returned, is sent back.";

export const metadata: Metadata = productMetadata({ title: "Ask Exhibit", description: DESCRIPTION, path: ROUTES.product.askExhibit });

/** Ask Exhibit's read-only tools, with the labels the palette shows while each runs (src/lib/ask/tools.ts). */
const TOOLS = [
  { name: "list_disputes", label: "Querying disputes", what: "Every dispute with its deadline, amount, reason, stage, Exhibit's call and the next step a person owes." },
  { name: "dispute_stats", label: "Aggregating the dispute book", what: "Counts, amounts, money recovered, refunded or lost, fights won and win rate, grouped any way you ask." },
  { name: "get_case", label: "Opening the case file", what: "One dispute in full: the claim, the order, delivery, checkout signals, buyer history, messages and Exhibit's brief." },
  { name: "recovery_summary", label: "Totalling recoveries", what: "What Exhibit recovered over a period, fees avoided, the open exposure and a 13-week trend." },
  { name: "at_risk_orders", label: "Scanning orders for dispute risk", what: "The prevention radar: orders likely to become disputes, with risk, exposure and the fix." },
];

const CHECKS = [
  "Every case it names is a dispute in your book.",
  "Every order it names is one the radar watches.",
  "Every value in a chart appears in a tool result.",
  "Every chart series has one value per label.",
];

/** The palette's suggested questions (src/lib/ask/schema.ts) and the tool each one leans on. */
const QUESTIONS = [
  { q: "Which disputes need me today?", tool: "list_disputes" },
  { q: "Why are we losing item-not-received cases?", tool: "dispute_stats" },
  { q: "How much has Exhibit recovered this quarter?", tool: "recovery_summary" },
  { q: "Which orders are about to turn into disputes?", tool: "at_risk_orders" },
  { q: "Summarize the Daniel Reyes case for my accountant", tool: "get_case" },
  { q: "What's our win rate by dispute reason?", tool: "dispute_stats" },
];

const atStake = ASK.chart.series[0].values.reduce((a, v) => a + v, 0);

export default function AskPage() {
  return (
    <>
      <ProductTour current="ask" />
      <PageHeader
        eyebrow="Ask Exhibit"
        eyebrowIndex="04"
        title="Ask the whole dispute book."
        rest="Answered from your records."
        lede="Press ⌘K and ask in plain words: what is at stake, what is due, why a reason keeps losing, which orders may turn into disputes. Ask Exhibit answers from read-only tools over your own data, and a check rejects any case it names that is not in your book and any chart value no tool returned."
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
        aside={<DotArt name="bubble" frame className="w-[210px] sm:w-[260px] lg:w-[300px]" />}
      />

      {/* 1. A recorded answer, on Peto's Old Souvenirs */}
      <Section id="answer" labelledBy="answer-title">
        <Container>
          <SectionHead aside={<Body>Asked over the PayPal sandbox dispute book on {utcDate(ASK.capturedAt)}: two read-only tool calls, then the answer, a chart and the three cases behind it. Exhibit recommends; PayPal makes the final call on all three.</Body>}>
            <Heading id="answer-title" title="One question, the whole book." rest={`Answered in ${seconds(ASK.ms)}.`} />
          </SectionHead>
        </Container>
        <Container size="wide">
          <Reveal>
            <figure className="s-figure">
              <Plate painting="petoOldSouvenirs" focus={[30, 42]} zoom={1.25} preload className="s-pr-flow" sizes="(max-width: 768px) 100vw, 1376px">
                <div className="s-pr-flow__in s-pr-askplate" style={{ ["--pad-t" as string]: "84px", ["--pad-x" as string]: "clamp(24px, 5vw, 88px)", ["--pad-b" as string]: "84px", ["--pad-t-m" as string]: "150px" }}>
                  <AskReplay question={ASK.question} steps={ASK.steps} text={ASK.text} chart={ASK.chart} cases={ASK.cases} followups={ASK.followups} provider={`${ASK.model} · ${ASK.provider}`} />
                </div>
              </Plate>
              <PlateCaption painting="petoOldSouvenirs">
                <b>Ask Exhibit, rebuilt from the app.</b> A recorded answer over the PayPal sandbox dispute book, {utcDate(ASK.capturedAt)}: {ASK.model} on the Claude CLI, {seconds(ASK.ms)}. ${atStake} at stake across three chargebacks under PayPal review.
              </PlateCaption>
            </figure>
          </Reveal>
        </Container>
      </Section>

      {/* 2. Grounded, or sent back */}
      <Section id="grounded" tone="band" labelledBy="grounded-title">
        <Container>
          <SectionHead aside={<Body>Ask Exhibit can only read. It gathers facts with five data tools, files its answer through a sixth, and a check sends the answer back if it names a case that isn&apos;t in your book or charts a number no tool returned.</Body>}>
            <Eyebrow>Grounding</Eyebrow>
            <Heading id="grounded-title" title="Charts from tool results." rest="Cases from your book." />
          </SectionHead>
          <ol className="s-pr-flowchart">
            <Reveal as="li" className="s-pr-flowchart__step">
              <span className="s-pr-flowchart__n">Your question</span>
              <p className="s-pr-flowchart__big">&ldquo;{ASK.question}&rdquo;</p>
              <p className="s-small">Typed into the palette, which opens with ⌘K in the app.</p>
            </Reveal>
            <Reveal as="li" delay={60} className="s-pr-flowchart__step">
              <span className="s-pr-flowchart__n">Read-only tools</span>
              <ul className="s-pr-tools">
                {TOOLS.map((t) => (
                  <li key={t.name}>
                    <span className="s-mono">{t.name}</span>
                    <span className="s-pr-tools__what">{t.what}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal as="li" delay={120} className="s-pr-flowchart__step">
              <span className="s-pr-flowchart__n">The check</span>
              <ul className="s-pr-checks">
                {CHECKS.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="s-small">An answer that fails goes back to the model to fix, twice at most. After that, what still fails is dropped: an unchecked chart is removed and unknown cases are left out.</p>
            </Reveal>
            <Reveal as="li" delay={180} className="s-pr-flowchart__step">
              <span className="s-pr-flowchart__n">The answer</span>
              <p className="s-body">Text, one chart when it helps, and cards for the cases and orders it mentions. The cards are rebuilt on the server from the records, so they show what the data says, not what the model wrote.</p>
            </Reveal>
          </ol>
          <div className="s-pr-grounded__foot">
            <p className="s-body">
              <b className="font-medium text-[var(--s-ink)]">Where it runs.</b> On the Claude API with an API key, or on your Claude CLI login. With neither, common questions get offline answers, labelled as offline. If the live model fails mid-question, it answers offline when the question allows and says so.
            </p>
            <TextLink href={`${GITHUB_URL}/blob/main/src/lib/ask/tools.ts`}>Read the tools and the check</TextLink>
          </div>
        </Container>
      </Section>

      {/* 3. Questions it answers */}
      <Section id="questions" labelledBy="questions-title">
        <Container>
          <SectionHead aside={<Body>The palette suggests these when it opens. Beside each one is the tool it leans on; the answer comes back with the cases or orders to open next.</Body>}>
            <Eyebrow>Questions</Eyebrow>
            <Heading id="questions-title" title="Questions merchants ask." rest="In their own words." />
          </SectionHead>
          <ul className="s-pr-questions">
            {QUESTIONS.map((x, i) => (
              <Reveal as="li" key={x.q} delay={i * 40}>
                <span className="s-pr-questions__q">{x.q}</span>
                <span className="s-mono s-pr-questions__tool">{x.tool}</span>
              </Reveal>
            ))}
          </ul>
          <p className="s-small s-pr-questions__note">
            Follow-ups the recorded answer offered:{" "}
            {ASK.followups.map((f, i) => (
              <span key={f}>
                {i ? " · " : ""}&ldquo;{f}&rdquo;
              </span>
            ))}
          </p>
        </Container>
      </Section>

      <NextChapter current="ask" />
      <ProductCta
        id="ask-cta"
        title="Ask your own question."
        rest="Press ⌘K in the live demo."
        lede="The live demo runs Ask Exhibit over a demo store's dispute book. Sign in to the Claude CLI on your own machine and it answers open questions live."
        art="receipt"
      />
    </>
  );
}
