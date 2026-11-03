import type { Metadata } from "next";
import { companyMetadata } from "@/components/site/company/meta";
import { Bot, Check, FileStack, Gauge, MessageCircleQuestion, ScrollText, Search, ShieldCheck } from "lucide-react";
import { DEMO_URL, PAYPAL_FEES, PRICING } from "@/components/landing/data";
import { Actions, Body, ButtonLink, Container, DotArt, Eyebrow, Facts, Faq, Heading, Lede, PageHeader, PlateCaption, PlateOverlay, PlateStage, ROUTES, Section, SectionHead, Small, Tag } from "@/components/site";
import { BriefCard, PreventionSave } from "@/components/site/company/cases";
import { GITHUB } from "@/components/site/company/records";

const DESCRIPTION = "Planned pricing for Exhibit: free to try, then a share of what Exhibit recovers. If it recovers nothing, you pay nothing. Not on sale yet. With PayPal's own dispute fees for context.";

export const metadata: Metadata = companyMetadata({ title: "Pricing", description: DESCRIPTION, path: "/pricing" });

const INCLUDED = [
  { icon: Search, title: "Investigation", body: "Eight sources read on every case, and one decision with each claim cited.", href: ROUTES.product.investigate },
  { icon: FileStack, title: "Evidence packets", body: "The response letter and lettered exhibits, filed through PayPal's Disputes API.", href: ROUTES.product.evidencePackets },
  { icon: Check, title: "Honest refunds", body: "When the buyer is right, Exhibit says so and refunds instead of fighting.", href: ROUTES.product.investigate },
  { icon: ShieldCheck, title: "Prevention", body: "Seven warning signs watched on recent orders, and fixes before a buyer files.", href: ROUTES.product.prevention },
  { icon: MessageCircleQuestion, title: "Ask Exhibit", body: "Questions about your dispute book, answered from your own records.", href: ROUTES.product.askExhibit },
  { icon: Bot, title: "For AI agents", body: "An MCP server with nine tools. Agents request, and you approve.", href: ROUTES.product.aiAgents },
  { icon: Gauge, title: "Autopilot", body: "Optional and off by default, inside limits no setting can loosen.", href: `${ROUTES.security}#autopilot` },
  { icon: ScrollText, title: "Audit log", body: "Every PayPal call and every decision, with PayPal's debug id.", href: `${ROUTES.security}#audit-log` },
];

const FAQ = [
  {
    q: "Can I buy Exhibit today?",
    a: "No. Exhibit isn't on sale yet. You can try the live demo with no sign-up, or run the open-source code on your own PayPal sandbox for free.",
  },
  {
    q: "What counts as recovered?",
    a: "The idea is simple: money you keep because Exhibit won the case. A refund to a buyer who is right, or a lost case, recovers nothing, so there is nothing to share. The share itself isn't set yet. We'll publish the exact terms before Exhibit goes on sale.",
  },
  {
    q: "What if Exhibit tells me to refund?",
    a: "Then that case costs you nothing. Exhibit refunds when the buyer is right, by design. On the sandbox it accepted two claims instead of fighting them, including Jordan Kim's $68 wallet that came back undeliverable.",
  },
  {
    q: "How will prevention be priced?",
    a: "We haven't decided. When Exhibit stops a dispute before it is filed, there is no case and no PayPal dispute fee. We'll say how that is priced before launch.",
  },
  {
    q: "Do I pay for the AI?",
    a: "If you run Exhibit yourself, the agent runs on your own Anthropic API key or Claude login, so any model usage is between you and Anthropic. With neither, it replays recorded runs at no cost.",
  },
  {
    q: "Does Exhibit touch PayPal's fees?",
    a: "No. PayPal's dispute fees are PayPal's. Exhibit doesn't set them, collect them or take a cut of them.",
  },
  {
    q: "Is the open-source version limited?",
    a: "No. The code on GitHub is MIT licensed, and you can run and change it for free. The planned pricing is for Exhibit as a product, once it goes on sale.",
  },
];

export default function PricingPage() {
  return (
    <>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-2.5">
            Pricing{" "}
            <Tag dot className="!h-[20px] !text-[11.5px]">
              Planned
            </Tag>
          </span>
        }
        title="Free to try. Then a share of what Exhibit recovers."
        rest="If it recovers nothing, you pay nothing."
        lede={`${PRICING.note} Today the code is open source, and you can run it on your own PayPal sandbox for free.`}
        actions={
          <>
            <ButtonLink href={DEMO_URL} arrow>
              Try the live demo
            </ButtonLink>
            <ButtonLink href={ROUTES.contact} variant="ghost">
              Book a demo
            </ButtonLink>
          </>
        }
        aside={<DotArt name="receipt" frame className="w-[180px] sm:w-[220px] lg:w-full lg:max-w-[292px]" />}
      />

      {/* How the planned model works: a three-step track */}
      <Section spacing="tight" labelledBy="how-h">
        <Container>
          <h2 id="how-h" className="s-sr-only">
            How the planned model works
          </h2>
          <ol className="s-co-track">
            <li>
              <span className="s-co-track__node" aria-hidden>
                <Check className="s-icon" strokeWidth={3} />
              </span>
              <h3>Try it free</h3>
              <p>Run a case end to end in the live demo, or run the open-source code on your own PayPal sandbox. No card, no sign-up.</p>
              <span className="s-co-track__k">Available now</span>
            </li>
            <li>
              <span className="s-co-track__node s-co-track__node--ring" aria-hidden />
              <h3>Exhibit works your disputes</h3>
              <p>It investigates each case, writes the cited response and files with your approval. When the buyer is right, it refunds.</p>
              <span className="s-co-track__k">The product, when it goes on sale</span>
            </li>
            <li>
              <span className="s-co-track__node s-co-track__node--ring" aria-hidden />
              <h3>Pay only on what it recovers</h3>
              <p>A share of the money Exhibit wins back for you. Refunds, lost cases and cases it never touched cost nothing.</p>
              <span className="s-co-track__k">Share not set yet</span>
            </li>
          </ol>
        </Container>
      </Section>

      {/* On real cases: two briefs, read against the planned model */}
      <Section labelledBy="cases-h">
        <Container>
          <SectionHead aside={<Lede>Two of the four sandbox chargebacks Exhibit answered through PayPal&apos;s Disputes API, read against the planned model. The briefs are real; the pricing is not live.</Lede>}>
            <Eyebrow>On real cases</Eyebrow>
            <Heading id="cases-h" title="A fight you might pay on." rest="A refund you never would." />
          </SectionHead>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-6">
            <div>
              <BriefCard run="fight" />
              <Facts
                items={[
                  { k: "Exhibit's call", v: "Fight, with six exhibits. Sent to PayPal's chargeback review after the merchant approved." },
                  { k: "Recovered", v: "Nothing yet. PayPal is still reviewing the case (checked Nov 3, 2026)." },
                  { k: "Planned fee", v: "A share of what it recovers, only if PayPal rules for the merchant." },
                ]}
              />
            </div>
            <div>
              <BriefCard run="refund" />
              <Facts
                items={[
                  { k: "Exhibit's call", v: "Refund. The wallet came back undeliverable and was never refunded, so the buyer was right." },
                  { k: "Recovered", v: "$0, by design. Exhibit accepted the claim instead of fighting it." },
                  { k: "Planned fee", v: "Nothing." },
                ]}
              />
            </div>
          </div>
        </Container>
      </Section>

      {/* What a dispute costs today: PayPal's fees and a prevented dispute, set into a plate */}
      <Section labelledBy="fees-h">
        <Container>
          <SectionHead aside={<Lede>PayPal may charge the merchant a fee on every dispute, on top of the money in question. A dispute that is never filed carries no dispute fee.</Lede>}>
            <Eyebrow>For context</Eyebrow>
            <Heading id="fees-h" title="What a dispute costs" rest="before anyone fights it." />
          </SectionHead>
        </Container>
        <Container size="wide">
          <figure className="s-figure">
            <PlateStage painting="sommar" focus={[50, 46]} height={640} mobile={{ height: 300, focus: [45, 40], zoom: 1.3 }}>
              <PlateOverlay left="5.5%" top="13%" width="min(380px, 40%)">
                <section className="s-co-fees" aria-labelledby="fees-sheet-h">
                    <div className="s-co-fees__k">
                      <span>PayPal business fees, US</span>
                      <span>Dispute fees</span>
                    </div>
                    <h3 id="fees-sheet-h">What PayPal may charge per dispute</h3>
                    <dl>
                      {PAYPAL_FEES.fees.map((f) => (
                        <div key={f.label}>
                          <dt>${f.amount}</dt>
                          <dd>
                            <b>{f.label}</b>
                            <span>{f.note}</span>
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <blockquote>&ldquo;{PAYPAL_FEES.quote}&rdquo;</blockquote>
                    <cite>
                      <a href={PAYPAL_FEES.url} target="_blank" rel="noopener noreferrer">
                        PayPal business fees
                        <span className="s-sr-only"> (opens in a new tab)</span>
                      </a>
                      , updated {PAYPAL_FEES.updated}, checked {PAYPAL_FEES.retrieved}
                    </cite>
                  </section>
              </PlateOverlay>
              <PlateOverlay right="5.5%" top="30%" width="min(420px, 44%)">
                <PreventionSave />
              </PlateOverlay>
            </PlateStage>
            <PlateCaption painting="sommar">
              <b>PayPal&apos;s published fees, and a dispute that never opened.</b> A German buyer was about to file. Exhibit answered her in German with the DHL scans and a plan, and no case was opened. Demo merchant, PayPal simulator.
            </PlateCaption>
          </figure>
        </Container>
        <Container>
          <Small className="mt-6 max-w-[760px]">PayPal&apos;s page doesn&apos;t say whether the fee is returned when the seller wins. Exhibit models the $15 and $20 fees in its prevention numbers; the $30 high-volume fee depends on an account threshold, so it isn&apos;t modelled.</Small>
        </Container>
      </Section>

      {/* What's included: a ruled grid of everything Exhibit does */}
      <Section labelledBy="included-h">
        <Container>
          <SectionHead even aside={<Lede>Trying Exhibit includes everything it does, today, in the live demo and in the code.</Lede>}>
            <Eyebrow>What&apos;s included</Eyebrow>
            <Heading id="included-h" title="One product," rest="all of it." />
          </SectionHead>
          <ul className="s-co-included">
            {INCLUDED.map((it) => (
              <li key={it.title}>
                <a href={it.href}>
                  <it.icon className="s-icon" aria-hidden />
                  <h3>{it.title}</h3>
                  <p>{it.body}</p>
                </a>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      {/* Questions: heading left, answers right */}
      <Section labelledBy="faq-h">
        <Container>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-4">
              <Eyebrow>Questions</Eyebrow>
              <Heading id="faq-h" title="About the money." />
              <Body className="mt-5 max-w-[360px]">Anything else about pricing, ask us directly.</Body>
              <Actions>
                <ButtonLink href={ROUTES.contact} variant="ghost">
                  Contact us
                </ButtonLink>
              </Actions>
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              <Faq items={FAQ} />
            </div>
          </div>
        </Container>
      </Section>

      {/* Close: the grey band */}
      <Section tone="band" labelledBy="close-h">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end lg:gap-6">
            <div className="lg:col-span-7">
              <Heading id="close-h" title="Run a case end to end." rest="Trying it is free." />
            </div>
            <div className="lg:col-span-5">
              <Body>The live demo runs on a fictional store and a PayPal simulator. Your own sandbox takes a REST app and two keys.</Body>
              <Actions>
                <ButtonLink href={DEMO_URL} arrow>
                  Try the live demo
                </ButtonLink>
                <ButtonLink href={GITHUB.repo} variant="ghost">
                  Get the code
                </ButtonLink>
              </Actions>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
