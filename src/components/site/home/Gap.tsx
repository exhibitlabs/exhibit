import { Fragment } from "react";
import { DotTrack } from "../dots/DotArt";
import { fmtDate, PAYPAL_AGENT_TOOLS } from "../facts";
import { Container, Section, SectionHead } from "../layout";
import { Body, Eyebrow, Heading } from "../type";

// Exhibit's twelve steps on a dispute. PayPal's three agent tools cover steps 1, 2 and 10.
const STEPS: { name: string; api: string; paypal?: string }[] = [
  { name: "Find open disputes", api: "GET /disputes", paypal: "list_disputes" },
  { name: "Read the case", api: "GET /disputes/{id}", paypal: "get_dispute" },
  { name: "Investigate the records", api: "order, carrier, chat, checkout" },
  { name: "Check Seller Protection", api: "PayPal's published rules" },
  { name: "Decide", api: "fight, offer, refund, message" },
  { name: "Cite every claim", api: "every ref resolves" },
  { name: "Build the packet", api: "Exhibit A to F, one PDF" },
  { name: "File the response", api: "provide-evidence, supporting-info" },
  { name: "Offer or message", api: "make-offer, send-message" },
  { name: "Accept or refund", api: "accept-claim", paypal: "accept_dispute_claim" },
  { name: "Prevent the next one", api: "orders/{id}/track" },
  { name: "Wait for your approval", api: "nothing moves before you" },
];
/** Lets long ids and paths break after "_", "/" and "," instead of mid-word. */
const breakable = (s: string) =>
  s.split(/(?<=[_/,])/).map((part, i) => (
    <Fragment key={i}>
      {part}
      <wbr />
    </Fragment>
  ));
const PAYPAL_CELLS = STEPS.map((s, i) => (s.paypal ? i : -1)).filter((i) => i >= 0);

export function Gap() {
  return (
    <Section id="the-gap" labelledBy="gap-title">
      <Container>
        <SectionHead aside={<Body>PayPal publishes three dispute tools for AI agents. None of them investigates, gathers evidence or files a response. Today that work lands on the merchant, one case at a time.</Body>}>
          <Eyebrow>The gap</Eyebrow>
          <Heading id="gap-title" title="PayPal's agent tools can read a dispute or concede it." rest="Exhibit does everything in between." />
        </SectionHead>
        <div className="s-gap">
          <div className="s-gap__row">
            <p className="s-gap__cap">
              <b>PayPal&apos;s agent tools</b>
              <span className="s-num">
                {PAYPAL_CELLS.length} of {STEPS.length} steps
              </span>
            </p>
            <DotTrack filled={PAYPAL_CELLS} label={`PayPal's agent tools cover ${PAYPAL_CELLS.length} of the ${STEPS.length} steps: finding disputes, reading one, and accepting the claim.`} />
          </div>
          <div className="s-gap__row">
            <p className="s-gap__cap">
              <b>Exhibit</b>
              <span className="s-num">
                {STEPS.length} of {STEPS.length} steps
              </span>
            </p>
            <DotTrack filled="all" label={`Exhibit covers all ${STEPS.length} steps.`} />
          </div>
          <ol className="s-gap__steps">
            {STEPS.map((s, i) => (
              <li key={s.name} className={s.paypal ? "is-paypal" : undefined}>
                <span className="s-gap__n s-num">{String(i + 1).padStart(2, "0")}</span>
                <span className="s-gap__name">{s.name}</span>
                <span className="s-gap__api s-mono">{breakable(s.api)}</span>
                {s.paypal ? (
                  <span className="s-gap__pp">
                    PayPal tool <code>{breakable(s.paypal)}</code>
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          <div className="s-gap__quotes">
            <p className="s-gap__src">
              PayPal&apos;s dispute tools for AI agents, quoted from the{" "}
              <a href={PAYPAL_AGENT_TOOLS.url} target="_blank" rel="noopener noreferrer">
                agent tools reference<span className="s-sr-only"> (opens in a new tab)</span>
              </a>
              , retrieved {fmtDate(PAYPAL_AGENT_TOOLS.retrieved)}.
            </p>
            <ul>
              {PAYPAL_AGENT_TOOLS.tools.map((t) => (
                <li key={t.name}>
                  <code className="s-gap__tool">{t.name}</code>
                  <q>{t.description}</q>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </Section>
  );
}
