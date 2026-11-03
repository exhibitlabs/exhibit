import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { DotArt } from "../dots/DotArt";
import { Container } from "../layout";
import { CTA, HAS_APP } from "../nav";
import { Reveal } from "../Reveal";
import { CHAPTERS, PLATFORM, chapterAt, type CapabilityKey } from "./capabilities";

/** The last chapter's card points at the site's primary call to action: the live demo, or booking one. */
const END = HAS_APP
  ? { title: "Run a dispute yourself.", description: "The live demo runs end to end on the PayPal simulator. No sign-up." }
  : { title: "See it on your own disputes.", description: "Book a walkthrough on your own PayPal sandbox." };

/**
 * The end of a capability page, above its closing band: the next chapter as one card (its dot drawing, "Next
 * chapter · 02 of 05", its name and line, Continue; the whole card is the link), then smaller links to the previous
 * chapter and back to the platform. On the last chapter the card points at `CTA.primary` instead.
 */
export function NextChapter({ current }: { current: CapabilityKey }) {
  const at = chapterAt(current);
  const next = CHAPTERS[at + 1];
  const prev = CHAPTERS[at - 1];
  const last = CHAPTERS[CHAPTERS.length - 1];
  return (
    <nav aria-label="Next chapter" className="s-pr-next">
      <Container>
        <Reveal className="s-pr-next__card">
          <div className="s-pr-next__art" aria-hidden>
            <DotArt name={next ? next.art : "verdict"} />
          </div>
          <div className="s-pr-next__text">
            <p className="s-pr-next__kicker">
              {next ? (
                <>
                  Next chapter · <span className="s-mono">{next.index}</span> of {last.index}
                </>
              ) : (
                "End of the tour"
              )}
            </p>
            <p className="s-pr-next__title">{next ? next.label : END.title}</p>
            <p className="s-pr-next__desc">{next ? next.description : END.description}</p>
          </div>
          <Link href={next ? next.href : CTA.primary.href} className="s-pr-next__go">
            <span className="s-btn s-btn--ink s-btn--lg">
              {next ? (
                <span>
                  Continue<span className="s-sr-only">: {`${next.index} ${next.label}`}</span>
                </span>
              ) : (
                CTA.primary.label
              )}
              <ArrowRight className="s-icon s-btn__arrow" aria-hidden />
            </span>
          </Link>
        </Reveal>
        <div className="s-pr-next__more">
          <Link href={prev.href} className="s-pr-next__link">
            <ArrowLeft className="s-icon s-pr-next__back" aria-hidden />
            Previous chapter: <span className="s-mono">{prev.index}</span> {prev.label}
          </Link>
          {prev.key !== PLATFORM.key ? (
            <Link href={PLATFORM.href} className="s-pr-next__link">
              Back to the platform
            </Link>
          ) : null}
        </div>
      </Container>
    </nav>
  );
}
