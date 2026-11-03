import type { ReactNode } from "react";
import { Actions, ButtonLink } from "../actions";
import { DotArt, type DotArtName } from "../dots/DotArt";
import { Container, Section } from "../layout";
import { ROUTES } from "../nav";
import { Heading, Lede } from "../type";

/**
 * The closing call to action of a product page, on the grey band: a two-tone heading, one sentence, the site's
 * two actions (Try the live demo, Book a demo) and one ink dot drawing that names what the page was about.
 */
export function ProductCta({ id, title, rest, lede, art, note }: { id: string; title: ReactNode; rest?: ReactNode; lede: ReactNode; art: DotArtName; note?: ReactNode }) {
  return (
    <Section tone="band" labelledBy={`${id}-title`} className="s-pr-cta">
      <Container>
        <div className="s-pr-cta__grid">
          <div className="s-pr-cta__main">
            <Heading id={`${id}-title`} title={title} rest={rest} />
            <Lede className="s-pr-cta__lede">{lede}</Lede>
            <Actions>
              <ButtonLink href={ROUTES.app} arrow size="lg">
                Try the live demo
              </ButtonLink>
              <ButtonLink href={ROUTES.contact} variant="ghost" size="lg">
                Book a demo
              </ButtonLink>
            </Actions>
            {note ? <p className="s-small s-pr-cta__note">{note}</p> : null}
          </div>
          <div className="s-pr-cta__art">
            <DotArt name={art} frame />
          </div>
        </div>
      </Container>
    </Section>
  );
}
