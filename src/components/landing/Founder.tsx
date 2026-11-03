import { FOUNDER_GITHUB_URL, FOUNDERS, GITHUB_URL, TEAM } from "./data";
import { ArrowLink, Container, Section } from "./Primitives";

export function Founder() {
  return (
    <Section id="founder" label="A note from the founders" className="border-t border-line">
      <Container>
        <div className="grid gap-8 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
          <p className="num text-[11.5px] uppercase tracking-[0.12em] text-muted">From the founders</p>
          <div className="max-w-[680px]">
            <div className="space-y-4 text-[18px] leading-[1.65] text-ink-2">
              <p>
                We&apos;re {TEAM.names}, Exhibit&apos;s co-founders. We built it together for the PayPal AI Hackathon, starting with the first commit on {TEAM.firstCommit}.
              </p>
              <p>
                We wanted a dispute agent a merchant could actually trust. That means it shows where every claim comes from, never moves money without the merchant, and says so plainly when the buyer is right. The code is open, so you can check all of it.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              {FOUNDERS.map((f) => (
                <div key={f.name}>
                  <div className="text-[14px] font-semibold text-ink">{f.name}</div>
                  <div className="text-[13px] text-muted">{f.role}</div>
                </div>
              ))}
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
