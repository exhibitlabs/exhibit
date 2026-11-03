import { Activity, FileSearch, Lock, Scale } from "lucide-react";
import Image from "next/image";
import { ButtonLink, TextLink } from "../actions";
import { EVAL, MCP_TOOLS, PAYPAL_FEES, PRICING } from "../facts";
import { Faq } from "../Faq";
import { FitBox } from "../FitBox";
import { AuditLog } from "../fragments";
import { Container, Section } from "../layout";
import { CTA, ROUTES } from "../nav";
import { PAINTINGS } from "../paintings";
import { PlateCaption, PlateOverlay, PlateStage } from "../Plate";
import { Tag } from "../records";
import { Reveal } from "../Reveal";
import { Body, Eyebrow, Heading, Small } from "../type";
import { UiSheet } from "../ui";

const TESTS = 300; // README: "npm test  # 300 tests"

export function Security() {
  const guards = [
    { icon: Lock, title: "Approval gates", text: "AI agents can only ask. Autopilot is off until you switch it on, then acts only inside the rules you set, and every case above $1,000 is always yours. Each action is checked again against what PayPal allows at that moment." },
    { icon: Activity, title: "Audit log", text: "Every PayPal call with its response and debug id, beside every decision by the agent, the merchant and PayPal." },
    { icon: FileSearch, title: "Citations", text: "Every claim must resolve to a real record. A brief that cites anything else is rejected before it can be filed." },
    { icon: Scale, title: "Open source", text: `MIT licensed. Read every prompt, tool and guardrail, and the ${TESTS} tests that hold them.` },
  ];
  return (
    <Section id="security" tone="night" labelledBy="security-title">
      <Container>
        <div className="s-sec">
          <div className="s-sec__l">
            <Eyebrow>Security</Eyebrow>
            <Heading id="security-title" title="Nothing reaches PayPal" rest="until you say so." />
            <ul className="s-guards">
              {guards.map((g) => (
                <li key={g.title}>
                  <span className="s-guards__ic" aria-hidden>
                    <g.icon className="s-icon" />
                  </span>
                  <h3>{g.title}</h3>
                  <p>{g.text}</p>
                </li>
              ))}
            </ul>
            <TextLink href={ROUTES.security} className="s-sec__link">
              Read the security page
            </TextLink>
          </div>
          <Reveal className="s-sec__r" delay={140}>
            <figure className="s-figure">
              <PlateStage painting="hoogstraten" focus={[38, 20]} zoom={1.3} height={600} mobile={{ height: 260, focus: [40, 22], zoom: 1.5 }} sizes="(max-width: 767px) 150vw, (max-width: 1440px) 64vw, 1020px">
                <PlateOverlay left="3.5%" top="262px" width="93%">
                  <UiSheet label="PayPal activity: the audit trail of real sandbox calls, a failure included" className="s-f-actsheet">
                    <div className="s-f-act--desk">
                      <FitBox width={813} height={252} ratio max={1} fallback={0.68}>
                        <AuditLog />
                      </FitBox>
                    </div>
                    <div className="s-f-act--phone">
                      <AuditLog />
                    </div>
                  </UiSheet>
                </PlateOverlay>
              </PlateStage>
              <PlateCaption painting="hoogstraten" even>
                <b>The audit trail.</b> Real sandbox calls in Exhibit&apos;s PayPal activity, the failures included. Times in UTC.
              </PlateCaption>
            </figure>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

export function Pricing() {
  const [first, second] = PRICING.line.split(/(?<=\.)\s+/);
  const third = PRICING.line.split(/(?<=\.)\s+/).slice(2).join(" ");
  return (
    <Section id="pricing" labelledBy="pricing-title">
      <Container>
        <div className="s-price">
          <div className="s-price__l">
            <div className="s-price__eyebrow">
              <Eyebrow as="div">Pricing</Eyebrow>
              <Tag dot>Planned</Tag>
            </div>
            <Heading
              id="pricing-title"
              title={
                <>
                  {first}
                  <br />
                  {second}
                </>
              }
              rest={third}
            />
            <Small className="s-price__note">{PRICING.note}</Small>
            <TextLink href={ROUTES.pricing} className="s-split__link">
              See pricing
            </TextLink>
          </div>
          <Reveal className="s-price__r" delay={90}>
            <div className="s-fees">
              <div className="s-fees__head">
                <p>What a dispute costs a merchant today</p>
              </div>
              <ul>
                {PAYPAL_FEES.fees.map((f) => (
                  <li key={f.label}>
                    <span className="s-fees__n s-num">${f.amount}</span>
                    <span>
                      <b>{f.label}</b>
                      <span>{f.note}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="s-fees__src">
                PayPal&apos;s{" "}
                <a href={PAYPAL_FEES.url} target="_blank" rel="noopener noreferrer">
                  business fees page<span className="s-sr-only"> (opens in a new tab)</span>
                </a>
                , updated {PAYPAL_FEES.updated}, retrieved {PAYPAL_FEES.retrieved}.
              </p>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

export function Questions() {
  return (
    <Section id="questions" labelledBy="faq-title">
      <Container>
        <div className="s-faqgrid">
          <div className="s-faqgrid__l">
            <Eyebrow>Questions</Eyebrow>
            <Heading id="faq-title" title="Asked before" rest="every demo." />
          </div>
          <Faq
            className="s-faqgrid__r"
            items={[
              {
                q: "Does Exhibit fight every dispute?",
                a: `No. It fights when the record supports the merchant and refunds when the buyer is right. On ${EVAL.cases} synthetic test cases written by its builders, it refunded all ${EVAL.refunded.split("/")[1]} where the buyer was right. That shows consistency, not accuracy on real disputes.`,
              },
              {
                q: "Can anything reach PayPal without me?",
                a: "Not unless you set a rule for it. AI agents can only ask, and their requests wait for you. Autopilot is off until you switch it on, then acts only inside the limits you choose, and every case above $1,000 is always yours. Each action is checked again against what PayPal allows at that moment and logged with PayPal's debug id.",
              },
              {
                q: "Which disputes does it handle?",
                a: "PayPal disputes and card chargebacks on PayPal payments: item not received, not as described, unauthorized, duplicate charge, credit not processed, incorrect amount and paid by other means. It reads them through PayPal's Disputes API and answers through the same API.",
              },
              {
                q: "How do AI agents connect to it?",
                a: `Through Exhibit's MCP server: ${MCP_TOOLS.length} tools, from list_disputes to request_dispute_action. Claude Code connects with one command. Agents can read and investigate; anything that would reach PayPal or a buyer is queued for your approval.`,
              },
              {
                q: "What does the live demo run on?",
                a: "A demo store, Kora Atelier, on Exhibit's PayPal simulator, which follows PayPal's documented request and response shapes, with recorded Claude runs. No sign-up. The sandbox record on this page is separate: real calls to PayPal's sandbox.",
              },
              {
                q: "Is Exhibit affiliated with PayPal?",
                a: "No. Exhibit Labs, founded by Shivansh Dwivedi and Someet Shende, built Exhibit on PayPal's public APIs for the PayPal AI Hackathon 2026. It is not affiliated with or endorsed by PayPal.",
              },
            ]}
          />
        </div>
      </Container>
    </Section>
  );
}

// The closing plate. In Harnett's painting a card has been torn off the rack: four torn corners and tacks are
// left around a paler rectangle. The call to action is a card pinned exactly there, and the painting's own
// corners and tacks are laid back over it (clip paths traced from the canvas, from the Letter Rack mock).
const PIECES = {
  tl: "polygon(53.51% 69.36%,60.76% 69.32%,60.52% 69.81%,60.20% 70.35%,59.98% 70.80%,59.72% 71.25%,59.61% 71.70%,59.55% 72.15%,59.13% 72.60%,58.69% 72.87%,58.26% 73.23%,57.94% 73.50%,57.62% 73.85%,57.35% 74.30%,56.87% 74.75%,56.43% 75.20%,56.00% 75.65%,55.57% 76.10%,55.14% 76.55%,54.71% 76.91%,54.28% 77.27%,53.85% 77.54%,53.58% 77.67%,53.51% 77.67%)",
  tr: "polygon(80.11% 69.34%,83.22% 69.32%,83.28% 72.96%,82.96% 72.60%,82.63% 72.06%,82.31% 71.52%,82.04% 70.98%,81.83% 70.53%,81.45% 70.17%,80.91% 69.86%,80.37% 69.59%)",
  bl: "polygon(55.20% 81.45%,55.74% 81.54%,56.17% 82.03%,56.54% 82.48%,56.81% 82.80%,56.81% 83.29%,56.76% 83.83%,56.92% 84.37%,57.19% 84.82%,57.37% 85.22%,56.81% 85.09%,55.52% 84.64%,54.23% 84.19%,53.85% 83.83%,54.23% 83.11%,54.77% 82.12%,55.09% 81.54%)",
  br: "polygon(83.22% 81.72%,83.35% 84.37%,79.46% 84.32%,79.89% 84.01%,80.43% 83.74%,80.97% 83.47%,81.40% 83.20%,81.93% 82.88%,82.37% 82.57%,82.69% 82.21%,82.96% 81.89%)",
};

function CtaCard({ headingId }: { headingId: string }) {
  return (
    <div className="s-cta__card">
      <Eyebrow>Your next dispute</Eyebrow>
      <Heading id={headingId} title="Answer it" rest="with the record." />
      <Body className="s-cta__body">Run a case end to end in the live demo, or book a walkthrough on your own PayPal sandbox.</Body>
      <div className="s-actions s-cta__actions">
        <ButtonLink href={CTA.primary.href} arrow>
          {CTA.primary.label}
        </ButtonLink>
        <ButtonLink href={CTA.secondary.href} variant="ghost">
          {CTA.secondary.label}
        </ButtonLink>
      </div>
    </div>
  );
}

export function ClosingPlate() {
  const p = PAINTINGS.harnett;
  const art = (clip?: string) => (
    <Image src={p.src} alt={clip ? "" : "Detail of William Michael Harnett, The Artist's Letter Rack, 1879: the torn corners of a card pulled from the board"} width={p.width} height={p.height} sizes="147vw" className="s-cta__img" style={clip ? { clipPath: clip } : undefined} draggable={false} />
  );
  return (
    <Section id="start" labelledBy="cta-title" className="s-cta">
      <figure className="s-figure">
        <Container size="wide">
          {/* Desktop: the card pinned into Harnett's torn-card rectangle. */}
          <div className="s-cta__plate">
            {art()}
            <CtaCard headingId="cta-title" />
            {(Object.keys(PIECES) as (keyof typeof PIECES)[]).map((k) => (
              <div key={k} className="s-cta__piece" aria-hidden>
                {art(PIECES[k])}
              </div>
            ))}
          </div>
          {/* Phones and tablets: a detail of the rack with the card tucked under it. */}
          <div className="s-cta__stack">
            <PlateStage painting="harnett" focus={[68, 77]} zoom={3} height={300} mobile={{ height: 220, focus: [68, 77], zoom: 3.4 }} sizes="300vw" decorative>
              <PlateOverlay left="8%" top="40px" width="84%">
                <CtaCard headingId="cta-title-stack" />
              </PlateOverlay>
            </PlateStage>
          </div>
        </Container>
        <Container>
          <PlateCaption painting="harnett" detail>
            <b>A detail of Plate 1.</b> Harnett painted the torn corners of a card someone pulled from the rack. Ours is pinned in its place.
          </PlateCaption>
        </Container>
      </figure>
    </Section>
  );
}
