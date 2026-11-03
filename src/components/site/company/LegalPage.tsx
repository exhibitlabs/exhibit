import "./company.css";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Container, Section } from "../layout";
import { PageHeader } from "../PageHeader";
import { Prose } from "../Prose";
import { DotArt, type DotArtName } from "../dots/DotArt";

export type LegalSection = { id: string; title: string; body: ReactNode };

/**
 * A plain-language legal page: the header with the last-updated date, a four-point "short version", then
 * the full text as prose with a sticky list of sections on desktop. Sections are h2s with ids, so each can
 * be linked to directly.
 */
export function LegalPage({
  eyebrow = "Legal",
  title,
  rest,
  lede,
  updated,
  art,
  short,
  sections,
  footnote,
}: {
  eyebrow?: string;
  title: string;
  rest?: string;
  lede: ReactNode;
  /** e.g. "November 3, 2026" */
  updated: string;
  art: DotArtName;
  short: { icon: LucideIcon; text: ReactNode }[];
  sections: LegalSection[];
  footnote?: ReactNode;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} rest={rest} lede={lede} aside={<DotArt name={art} frame className="w-[180px] sm:w-[200px] lg:w-full lg:max-w-[260px]" />}>
        <p className="s-co-legal__meta">
          <span>
            Last updated <b>{updated}</b>
          </span>
          <span>Plain language, not legal advice</span>
        </p>
      </PageHeader>

      <Section spacing="tight" labelledBy="short-h">
        <Container>
          <h2 id="short-h" className="s-small mb-4">
            The short version
          </h2>
          <ul className="s-co-short">
            {short.map((s, i) => (
              <li key={i}>
                <s.icon className="s-icon" aria-hidden />
                <span>{s.text}</span>
              </li>
            ))}
          </ul>
        </Container>
      </Section>

      <Section spacing="tight" label="Full text">
        <Container>
          <div className="s-co-legal">
            <nav className="s-co-legal__nav" aria-label="Sections">
              <p>On this page</p>
              <ol>
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`}>{s.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
            <Prose as="article" className="s-co-legal__body">
              {sections.map((s) => (
                <section key={s.id} aria-labelledby={s.id}>
                  <h2 id={s.id}>{s.title}</h2>
                  {s.body}
                </section>
              ))}
              {footnote ? <hr /> : null}
              {footnote}
            </Prose>
          </div>
        </Container>
      </Section>
    </>
  );
}
