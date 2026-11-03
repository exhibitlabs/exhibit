import type { Metadata } from "next";
import { FOUNDERS } from "@/components/landing/data";
import { Actions, Body, ButtonLink, Container, CTA, DotArt, Eyebrow, HAS_APP, Heading, Lede, PageHeader, Reveal, ROUTES, Section, SectionHead, Small, TextLink } from "@/components/site";
import { EightFacts, FounderCard, FoundersQuote } from "@/components/site/company/about";
import { FactStrip } from "@/components/site/company/FactStrip";
import { companyMetadata } from "@/components/site/company/meta";
import { CONTACT_EMAIL } from "@/components/site/company/records";
import { EVAL } from "@/components/site/facts";

const DESCRIPTION = "Exhibit Labs builds Exhibit, the AI agent that answers PayPal disputes for merchants. Meet co-founders Shivansh Dwivedi and Someet Shende, and see Exhibit in 8 facts.";

export const metadata: Metadata = companyMetadata({ title: "About Exhibit Labs", description: DESCRIPTION, path: "/about" });

/** "9/9" as the page says it: "9 of 9". */
const of = (fraction: string) => fraction.replace("/", " of ");

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="Exhibit Labs"
        title="Let the evidence decide."
        rest="Whichever way it points."
        lede="Exhibit Labs is the team behind Exhibit, the AI agent that answers PayPal disputes for merchants. Our mission is a fair answer to every dispute: evidence when the merchant is right, a refund when the buyer is."
        actions={
          <>
            <ButtonLink href={CTA.primary.href} arrow>
              {CTA.primary.label}
            </ButtonLink>
            <ButtonLink href={`${ROUTES.about}#founders`} variant="ghost">
              Meet the founders
            </ButtonLink>
          </>
        }
        aside={<DotArt name="scales" frame className="w-[180px] sm:w-[220px] lg:w-full lg:max-w-[292px]" />}
      />

      {/* Why Exhibit exists: the stance, a standfirst, then the trade-off and the answer */}
      <Section id="why" labelledBy="why-h">
        <Container>
          <Reveal>
            <Eyebrow>Why Exhibit exists</Eyebrow>
            <Heading id="why-h" title="Disputes should be settled by the record," rest="not by who had time to answer." />
          </Reveal>
          <div className="mt-8 grid grid-cols-1 gap-5 lg:mt-12 lg:grid-cols-12 lg:gap-6">
            <Reveal delay={70} className="lg:col-span-6">
              <p className="s-co-standfirst">Every PayPal dispute comes with a deadline. The proof that settles it already exists: the order, the carrier&apos;s scans, the buyer&apos;s messages, the checkout record, the store&apos;s policies and PayPal&apos;s own Seller Protection rules.</p>
            </Reveal>
            <Reveal delay={140} className="max-w-[640px] space-y-5 lg:col-span-5 lg:col-start-8 lg:max-w-none">
              <Body>Gathering it by hand, case after case, makes it tempting to concede everything or to fight everything. Conceding gives up disputes the merchant could win. Fighting everything is unfair to the buyers who are right.</Body>
              <Body>We build Exhibit to do that work. It reads each case through PayPal&apos;s Disputes API, investigates it with Claude across eight sources, cites every claim to a record and files nothing until the merchant says so.</Body>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* Exhibit in 8 facts: the market sets up Exhibit's wedge */}
      <Section id="facts" labelledBy="facts-h">
        <Container>
          <SectionHead aside={<Lede>Six facts about the market Exhibit works in, and two about Exhibit itself. Each one links to its source.</Lede>}>
            <Eyebrow>The short version</Eyebrow>
            <Heading id="facts-h" title="Exhibit in 8 facts." rest="Every figure cited." />
          </SectionHead>
          <EightFacts />
        </Container>
      </Section>

      {/* The stance: four principles, and the line in the code that holds them */}
      <Section id="stance" tone="band" labelledBy="stance-h">
        <Container>
          <SectionHead aside={<Lede>Exhibit works for merchants, and we hold it to a standard their buyers can trust. That standard is written into the instructions the agent runs on, and checked in code before anything is filed.</Lede>}>
            <Eyebrow>How we build it</Eyebrow>
            <Heading id="stance-h" title="Fair to buyers," rest="on purpose." />
          </SectionHead>
          <ol className="s-co-promises">
            <Reveal as="li" delay={0}>
              <span className="s-co-promises__n">01</span>
              <h3>Refund when the buyer is right.</h3>
              <p>On PayPal&apos;s sandbox, Exhibit accepted two chargebacks instead of fighting them: a $68 wallet that came back undeliverable, and a $180 return that was never refunded.</p>
            </Reveal>
            <Reveal as="li" delay={70}>
              <span className="s-co-promises__n">02</span>
              <h3>Never invent evidence.</h3>
              <p>Every claim cites a record a tool returned. A brief that cites anything else is rejected before it can be filed.</p>
            </Reveal>
            <Reveal as="li" delay={140}>
              <span className="s-co-promises__n">03</span>
              <h3>Never act without the merchant.</h3>
              <p>Nothing reaches PayPal until the merchant approves, unless they switch on Autopilot inside limits no setting can loosen.</p>
            </Reveal>
            <Reveal as="li" delay={210}>
              <span className="s-co-promises__n">04</span>
              <h3>Show the work.</h3>
              <p>
                Exhibit is open source under the MIT licence, and every PayPal call it makes is logged with PayPal&apos;s debug id. <TextLink href={ROUTES.proof}>The sandbox record</TextLink>
              </p>
            </Reveal>
          </ol>
          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-6">
            <div data-ui className="s-ui s-ui-card lg:col-span-7" role="group" aria-label="From Exhibit's instructions to Claude">
              <div className="s-co-ui-head">
                <span className="s-ui-mono !text-[12px] !text-[#0a0a0a]">src/lib/agent/prompt.ts</span>
                <span>the instructions Claude runs on</span>
              </div>
              <div className="s-ui-mono space-y-3 px-[18px] py-4 text-[12.5px] leading-[1.7] text-[#2f2f2f]">
                <p className="m-0">- Decide on the merits. Fight when the records show the merchant did what they promised. Refund or offer when the merchant is at fault or the case is unwinnable.</p>
                <p className="m-0">- Use only facts returned by tools. Never invent tracking events, signatures, messages, policies or numbers.</p>
              </div>
            </div>
            <div className="lg:col-span-5">
              <FactStrip
                label="The evaluation"
                items={[
                  { k: "Buyer right", v: of(EVAL.refunded), note: "refunded" },
                  { k: "False fights", v: of(EVAL.falseFights), note: "on cases not to fight" },
                  { k: "Decisions", v: of(EVAL.matched), note: "matched the labels" },
                ]}
              />
              <Small className="mt-4">
                {EVAL.caveat}
                {EVAL.url ? (
                  <>
                    {" "}
                    <a href={EVAL.url} target="_blank" rel="noopener noreferrer" className="underline decoration-[color:var(--s-line-2)] underline-offset-4 hover:decoration-[color:var(--s-ink)]">
                      The full results
                      <span className="s-sr-only"> (opens in a new tab)</span>
                    </a>
                  </>
                ) : null}
              </Small>
            </div>
          </div>
        </Container>
      </Section>

      {/* The people behind Exhibit: their words beside their faces */}
      <Section id="founders" labelledBy="founders-h">
        <Container>
          <SectionHead
            aside={
              <>
                <Lede>Exhibit Labs is two co-founders. Write to us and you reach us directly, not a sales team.</Lede>
                <div className="mt-4">
                  <TextLink href={ROUTES.contact}>Write to the founders</TextLink>
                </div>
              </>
            }
          >
            <Eyebrow>Founders</Eyebrow>
            <Heading id="founders-h" title="The people behind Exhibit." />
          </SectionHead>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-6">
            <Reveal className="lg:col-span-6">
              <FoundersQuote />
            </Reveal>
            <div className="lg:col-span-6">
              <div className="s-co-founders">
                {FOUNDERS.map((f, i) => (
                  <Reveal key={f.name} delay={70 + i * 90}>
                    <FounderCard founder={f} />
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Close */}
      <Section tone="band" labelledBy="about-close-h">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end lg:gap-6">
            <Reveal className="lg:col-span-7">
              <Heading id="about-close-h" title="See it work a case," rest="or tell us about yours." />
            </Reveal>
            <Reveal delay={70} className="lg:col-span-5">
              <Body>
                Write to{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="underline decoration-[color:var(--s-line-2)] underline-offset-4 hover:decoration-[color:var(--s-ink)]">
                  {CONTACT_EMAIL}
                </a>
                {HAS_APP ? ", or run a case end to end in the live demo." : ", or book a demo and we'll walk through a case with you."}
              </Body>
              <Actions>
                <ButtonLink href={CTA.primary.href} arrow>
                  {CTA.primary.label}
                </ButtonLink>
                <ButtonLink href={HAS_APP ? ROUTES.contact : CTA.secondary.href} variant="ghost">
                  {HAS_APP ? "Contact us" : CTA.secondary.label}
                </ButtonLink>
              </Actions>
            </Reveal>
          </div>
        </Container>
      </Section>
    </>
  );
}
