import { FOUNDER, FOUNDER_GITHUB_URL, GITHUB_URL } from "./data";
import { ArrowLink, Container, Section } from "./Primitives";

export function Founder() {
  return (
    <Section id="founder" label="A note from the founder" className="border-t border-line">
      <Container>
        <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
          <p className="num text-[11.5px] uppercase tracking-[0.12em] text-muted">From the founder</p>
          <div className="max-w-[680px]">
            <div className="space-y-4 text-[18px] leading-[1.65] text-ink-2">
              <p>
                I&apos;m {FOUNDER.name}. I run KaDeep AI from {FOUNDER.city}, and I built Exhibit on my own for the PayPal AI Hackathon, starting with the first commit on {FOUNDER.firstCommit}.
              </p>
              <p>
                I wanted a dispute agent a merchant could actually trust. That means it shows where every claim comes from, never moves money without the merchant, and says so plainly when the buyer is right. The code is open, so you can check all of it.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div>
                <div className="text-[14px] font-semibold text-ink">{FOUNDER.name}</div>
                <div className="text-[13px] text-muted">
                  {FOUNDER.role} · {FOUNDER.city}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13.5px]">
                <ArrowLink href={GITHUB_URL} external>
                  Source on GitHub
                </ArrowLink>
                <ArrowLink href={FOUNDER_GITHUB_URL} external>
                  @shvuuuu
                </ArrowLink>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
