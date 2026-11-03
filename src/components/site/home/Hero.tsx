import Link from "next/link";
import { ButtonLink } from "../actions";
import { fmtDay, RECORD, REYES } from "../facts";
import { FitBox } from "../FitBox";
import { CasePage } from "../fragments";
import { Container } from "../layout";
import { CTA, ROUTES } from "../nav";
import { Plate, PlateCaption } from "../Plate";
import { Eyebrow, Heading, Lede } from "../type";
import { UiWindow } from "../ui";

/** First screen: the claim, the action, and Exhibit's real case page tucked into Harnett's letter rack. */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="s-hero">
      <Container>
        <div className="s-hero__top">
          <div className="s-hero__l">
            <Eyebrow>The AI dispute agent for PayPal merchants</Eyebrow>
            <Heading as="h1" id="hero-title" title="Disputes, answered with evidence." rest="Refunds when the buyer is right." />
          </div>
          <div className="s-hero__r">
            <Lede>Exhibit reads each case from PayPal&apos;s Disputes API, investigates it with Claude, cites every claim to a real record and files through PayPal once you approve.</Lede>
            <div className="s-actions s-hero__actions">
              <ButtonLink href={CTA.primary.href} arrow>
                {CTA.primary.label}
              </ButtonLink>
              <ButtonLink href={CTA.secondary.href} variant="ghost">
                {CTA.secondary.label}
              </ButtonLink>
            </div>
          </div>
        </div>
      </Container>
      <figure className="s-figure">
        <Container size="wide">
          <Plate
            painting="harnett"
            image="/art/harnett-hero.webp"
            focus={[50, 32.5]}
            zoom={1}
            mobile={{ focus: [28.1, 12.7], zoom: 1.49, height: 452 }}
            preload
            sizes="(max-width: 767px) 230vw, (max-width: 1440px) 96vw, 1376px"
            className="s-hero__plate"
          >
            <UiWindow className="s-hero__win" label={`Exhibit's case page for dispute ${REYES.id}, ${REYES.buyer}, ${REYES.reason}, $${REYES.amount}: Fight, ${REYES.brief.winLikelihood}% likely to win, six exhibits`}>
              <FitBox width={1386} height={1013} min={0.52} max={0.75} className="s-hero__fit">
                <CasePage />
              </FitBox>
            </UiWindow>
          </Plate>
        </Container>
        <Container>
          <PlateCaption painting="harnett">
            <b>Exhibit&apos;s case page.</b> {REYES.buyer}, a ${REYES.amount} unauthorized chargeback on the PayPal sandbox, with the brief from a recorded Claude run on {fmtDay(REYES.run.startedAt)}: six exhibits, every claim cited, filed through PayPal. Kora Atelier is a demo merchant. Times in UTC.
          </PlateCaption>
        </Container>
      </figure>
      <Container>
        <ul className="s-trust" aria-label="What Exhibit is built on">
          <li>
            <span className="s-trust__k">API</span>
            <span className="s-trust__v">Built on PayPal&apos;s Disputes API</span>
          </li>
          <li>
            <span className="s-trust__k">Model</span>
            <span className="s-trust__v">Runs on Claude</span>
          </li>
          <li>
            <span className="s-trust__k">Agents</span>
            <span className="s-trust__v">MCP server, 9 tools</span>
          </li>
          <li>
            <span className="s-trust__k">Code</span>
            <span className="s-trust__v">Open source, MIT</span>
          </li>
          <li>
            <span className="s-trust__k">Record</span>
            <Link href={ROUTES.proof} className="s-trust__v s-trust__link">
              Tested live on the PayPal sandbox: <span className="s-num">{RECORD.totals.calls}</span> calls on the record
            </Link>
          </li>
        </ul>
      </Container>
    </section>
  );
}
