import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { DotArt } from "../dots/DotArt";
import { Container, Section } from "../layout";
import { Reveal } from "../Reveal";
import { CAPABILITIES } from "./capabilities";

/**
 * The platform page's map of the tour, under its header: chapters 01 to 05 as cards in product order (the dot
 * drawing, the number, the name and its one line), joined by arrows, each opening its chapter, then "Start the
 * tour" to chapter 01. The drawings print on the 60 x 45 grid where a card is wide enough (1280 px up) and on the
 * 32 x 24 grid below, so every cell stays at least 3 px.
 */
export function TourMap() {
  const first = CAPABILITIES[0];
  return (
    <Section spacing="tight" labelledBy="tour-map-title" className="s-pr-map">
      <Container>
        <h2 id="tour-map-title" className="s-sr-only">
          The product tour, chapter by chapter
        </h2>
        <ol className="s-pr-map__list">
          {CAPABILITIES.map((c, i) => (
            <Reveal as="li" key={c.key} delay={i * 60} className="s-pr-map__item">
              <Link href={c.href} className="s-pr-map__card">
                <span className="s-pr-map__art" aria-hidden>
                  <DotArt name={c.art} className="s-pr-map__lg" />
                  <DotArt name={c.art} small className="s-pr-map__sm" />
                </span>
                <span className="s-pr-map__text">
                  <span className="s-pr-map__num">{c.index}</span>
                  <span className="s-pr-map__name">{c.label}</span>
                  <span className="s-pr-map__desc">{c.description}</span>
                </span>
              </Link>
              {i < CAPABILITIES.length - 1 ? <ArrowRight className="s-pr-map__arrow" aria-hidden /> : null}
            </Reveal>
          ))}
        </ol>
        <div className="s-pr-map__foot">
          <p className="s-small">Each card opens its chapter. The tour bar follows you through all six.</p>
          <Link href={first.href} className="s-btn s-btn--ink s-pr-map__start">
            Start the tour
            <ArrowRight className="s-icon s-btn__arrow" aria-hidden />
            <span className="s-sr-only">: </span>
            <span className="s-mono">{first.index}</span> {first.label}
          </Link>
        </div>
      </Container>
    </Section>
  );
}
