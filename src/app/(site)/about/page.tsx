import type { Metadata } from "next";
import { companyMetadata } from "@/components/site/company/meta";
import type { ReactNode } from "react";
import { DEMO_URL, EVALUATION, FOUNDER_GITHUB_URL, PAYPAL_AGENT_TOOLS, TEAM } from "@/components/landing/data";
import { Actions, Body, ButtonLink, Container, DotArt, Eyebrow, Heading, Lede, Mono, PageHeader, PlateCaption, PlateOverlay, PlateStage, ROUTES, Section, SectionHead, Small, Terminal, TextLink } from "@/components/site";
import { FactStrip } from "@/components/site/company/FactStrip";
import { CONTACT_EMAIL, GITHUB } from "@/components/site/company/records";

const DESCRIPTION = "Exhibit is built by co-founders Shivansh Dwivedi and Someet Shende. Why it exists, how it treats buyers, and an honest timeline from the first commit on Oct 20, 2026.";

export const metadata: Metadata = companyMetadata({ title: "About", description: DESCRIPTION, path: "/about" });

/** `git log --reverse --format='%h %ad %s' --date=short`, a selection. Dates are the commits' own (India Standard Time). */
const GIT_LOG = [
  ["1891d7a", "2026-10-20", "Initial commit from Create Next App"],
  ["8655300", "2026-10-20", "Ship Exhibit for the PayPal AI Hackathon."],
  ["e084003", "2026-11-03", "feat(prevention): score orders and fix disputes before they are filed"],
  ["0291179", "2026-11-03", "feat(mcp): expose Exhibit to AI agents behind merchant approval"],
  ["33e17d1", "2026-11-03", "test: add a guardrail test suite, CI and repo hygiene"],
  ["8a8c0ed", "2026-11-03", "feat(eval): measure decisions on 30 labelled disputes"],
  ["83bd074", "2026-11-03", "chore(release): v1.0.0"],
];

/** From the git log and Exhibit's own PayPal call log (records/proof.json). Dates in India Standard Time. */
const TIMELINE: { date: string; title: string; body?: ReactNode; gold?: boolean }[] = [
  { date: "Oct 20, 2026", title: "The first commit.", gold: true },
  {
    date: "Oct 20",
    title: "First calls to PayPal's sandbox, and the first filing.",
    body: (
      <>
        Evidence for a $420 unauthorized chargeback went through the Disputes API: <code>provide-evidence</code>, 200.
      </>
    ),
  },
  { date: "Oct 20", title: "Four sandbox chargebacks answered.", body: "Two fought with evidence. Two refunded, because the records said the buyer was right." },
  { date: "Oct 20", title: "“Ship Exhibit for the PayPal AI Hackathon.”", body: "The first version lands on main." },
  { date: "Oct 21", title: "The recorded Daniel Reyes run.", body: "Fight, 88%, six exhibits, in 35.6 seconds. It is the case shown across this site." },
  { date: "Nov 3", title: "Command center, Prevention, Ask Exhibit and the MCP server land on main.", body: "With the live evidence graph on every case." },
  { date: "Nov 3", title: "A guardrail test suite, CI, and an evaluation.", body: "Tests that need no keys or network. An evaluation on 30 labelled disputes, written with Claude: it shows consistency, not accuracy on real disputes." },
  {
    date: "Nov 3",
    title: "An AI agent asks. The merchant approves. Exhibit files.",
    body: (
      <>
        Claude Code requested it over MCP, and the filing went to PayPal: <code>provide-supporting-info</code>, 200, <code>f4652162f684d</code>.
      </>
    ),
  },
  { date: "Nov 3", title: "Version 1.0.0.", gold: true },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="A fair answer to every dispute."
        rest="Evidence when the merchant is right. A refund when the buyer is."
        lede={`Exhibit is an AI agent that answers PayPal disputes for merchants. ${TEAM.names} started it for the PayPal AI Hackathon 2026, with the first commit on ${TEAM.firstCommit}. The code is open source.`}
        actions={
          <>
            <ButtonLink href={DEMO_URL} arrow>
              Try the live demo
            </ButtonLink>
            <ButtonLink href={`${ROUTES.about}#founders`} variant="ghost">
              Meet the founders
            </ButtonLink>
          </>
        }
        aside={<DotArt name="scales" frame className="w-[180px] sm:w-[220px] lg:w-full lg:max-w-[292px]" />}
      />

      {/* Why it exists: an editorial split, with PayPal's own tool list quoted */}
      <Section id="why" labelledBy="why-h">
        <Container>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-5">
              <Eyebrow>Why it exists</Eyebrow>
              <Heading id="why-h" title="The answer is already in the records." rest="Pulling it together is the work." />
            </div>
            <div className="space-y-5 lg:col-span-6 lg:col-start-7 lg:pt-10">
              <Lede>When a buyer opens a PayPal dispute, the merchant has a deadline to answer. The answer is usually scattered across the order, the carrier&apos;s scans, the inbox, the checkout record, the store&apos;s policies and PayPal&apos;s own Seller Protection rules.</Lede>
              <Body>PayPal&apos;s agent tools can list a dispute, read it or accept it. None of them investigates, gathers evidence or writes a response. That work still lands on the merchant, one case at a time, and doing it by hand makes it tempting to concede everything, or to fight everything.</Body>
              <Body>Exhibit does that work. It reads each case through PayPal&apos;s Disputes API, investigates it with Claude across eight sources, cites every claim to a record and files the response once the merchant approves.</Body>
            </div>
          </div>
          <figure className="mt-14 grid grid-cols-1 gap-6 border-t border-[color:var(--s-ink)] pt-6 lg:grid-cols-12" aria-labelledby="tools-cap">
            <figcaption id="tools-cap" className="lg:col-span-3">
              <span className="s-small block">PayPal&apos;s dispute tools for AI agents, quoted</span>
            </figcaption>
            <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-3 lg:col-span-9">
              {PAYPAL_AGENT_TOOLS.tools.map((t) => (
                <li key={t.name}>
                  <Mono className="inline-block rounded-[5px] bg-[color:var(--s-band)] px-2 py-1 text-[12.5px] text-[color:var(--s-ink)]">{t.name}</Mono>
                  <p className="s-body mt-3">&ldquo;{t.description}&rdquo;</p>
                </li>
              ))}
            </ul>
            <p className="s-small lg:col-span-9 lg:col-start-4">
              <a href={PAYPAL_AGENT_TOOLS.url} target="_blank" rel="noopener noreferrer" className="underline decoration-[color:var(--s-line-2)] underline-offset-4 hover:decoration-[color:var(--s-ink)]">
                developer.paypal.com/ai-tools/agent-tools
                <span className="s-sr-only"> (opens in a new tab)</span>
              </a>
              , retrieved Nov 3, 2026. Everything between reading a case and conceding it is the part Exhibit does.
            </p>
          </figure>
        </Container>
      </Section>

      {/* The stance: four principles, and the line in the code that holds them */}
      <Section id="stance" tone="band" labelledBy="stance-h">
        <Container>
          <SectionHead aside={<Lede>Exhibit works for merchants, and it is fair to their buyers. That isn&apos;t a slogan: it is written into the instructions the agent runs on, and checked in code before anything is filed.</Lede>}>
            <Eyebrow>How we build it</Eyebrow>
            <Heading id="stance-h" title="Fair to buyers," rest="on purpose." />
          </SectionHead>
          <ol className="s-co-promises">
            <li>
              <span className="s-co-promises__n">01</span>
              <h3>Refund when the buyer is right.</h3>
              <p>On the sandbox, Exhibit accepted two chargebacks instead of fighting them: a $68 wallet that came back undeliverable, and a $180 return that was never refunded.</p>
            </li>
            <li>
              <span className="s-co-promises__n">02</span>
              <h3>Never invent evidence.</h3>
              <p>Every claim cites a record a tool returned. A brief that cites anything else is rejected before it can be filed.</p>
            </li>
            <li>
              <span className="s-co-promises__n">03</span>
              <h3>Never act without the merchant.</h3>
              <p>Nothing reaches PayPal until the merchant approves, unless they switch on Autopilot inside limits no setting can loosen.</p>
            </li>
            <li>
              <span className="s-co-promises__n">04</span>
              <h3>Show the work.</h3>
              <p>
                The code is open, and every PayPal call is logged with PayPal&apos;s debug id. <TextLink href={ROUTES.proof}>The sandbox record</TextLink>
              </p>
            </li>
          </ol>
          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-6">
            <div data-ui className="s-ui s-ui-card lg:col-span-7" role="group" aria-label="From Exhibit's instructions to Claude">
              <div className="s-co-ui-head">
                <span className="s-ui-mono !text-[12px] !text-[#0a0a0a]">src/lib/agent/prompt.ts</span>
                <span>the instructions Claude runs on</span>
              </div>
              <div className="s-ui-mono space-y-3 px-[18px] py-4 text-[12.5px] leading-[1.7] text-[#2f2f2f]">
                <p className="m-0">- Decide on the merits. Fight when the records show the merchant did what they promised. Refund or offer when the merchant is at fault or the case is unwinnable.</p>
                <p className="m-0">- Use only facts returned by tools. Never invent tracking events, signatures, messages, policies or numbers.</p>
              </div>
            </div>
            <div className="lg:col-span-5">
              {EVALUATION ? (
                <>
                  <FactStrip
                    items={[
                      { k: "Buyer right", v: "9 of 9", note: "refunded" },
                      { k: "Fights", v: "0 of 18", note: "false fights" },
                      { k: "Decisions", v: "30 of 30", note: "matched" },
                    ]}
                  />
                  <Small className="mt-4">{EVALUATION.method}</Small>
                </>
              ) : null}
            </div>
          </div>
        </Container>
      </Section>

      {/* Founders: two cards and their note */}
      <Section id="founders" labelledBy="founders-h">
        <Container>
          <SectionHead even aside={<Lede>Exhibit is built by its two co-founders. There is no sales team: write to us and it reaches them.</Lede>}>
            <Eyebrow>Founders</Eyebrow>
            <Heading id="founders-h" title="The people behind Exhibit." />
          </SectionHead>
          <div className="s-co-people">
            <div className="s-co-person">
              <span className="s-co-person__mono" aria-hidden>
                SD
              </span>
              <div>
                <h3>Shivansh Dwivedi</h3>
                <p>Co-founder. Runs KaDeep AI in Mumbai.</p>
                <TextLink href={FOUNDER_GITHUB_URL}>github.com/shvuuuu</TextLink>
              </div>
            </div>
            <div className="s-co-person">
              <span className="s-co-person__mono" aria-hidden>
                SS
              </span>
              <div>
                <h3>Someet Shende</h3>
                <p>Co-founder.</p>
                <TextLink href="https://github.com/someetshende">github.com/someetshende</TextLink>
              </div>
            </div>
          </div>
          <figure className="mx-0 mb-0 mt-12 max-w-[860px] border-l-2 border-[color:var(--s-ink)] pl-6">
            <blockquote className="m-0">
              <p className="m-0 text-[clamp(19px,15px+0.7vw,24px)] font-medium leading-[1.45] tracking-[-0.02em] text-[color:var(--s-ink)] [text-wrap:pretty]">
                &ldquo;We wanted a dispute agent a merchant could actually trust. That means it shows where every claim comes from, never moves money without the merchant, and says so plainly when the buyer is right. The code is open, so you can check all of it.&rdquo;
              </p>
            </blockquote>
            <figcaption className="s-small mt-4">Shivansh Dwivedi and Someet Shende, co-founders</figcaption>
          </figure>
        </Container>
      </Section>

      {/* Timeline: the dated list, and the git log set into a plate */}
      <Section id="timeline" labelledBy="timeline-h">
        <Container size="wide">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-6">
            <div className="px-[var(--s-gutter-wide)] lg:col-span-5 lg:px-0 lg:pl-12">
              <Eyebrow>Timeline</Eyebrow>
              <Heading id="timeline-h" title="From first commit to 1.0," rest="in two weeks." />
              <Body className="mt-5">Short and honest, from the git log and Exhibit&apos;s own log of PayPal calls. Dates are in India Standard Time.</Body>
              <ol className="s-co-timeline mt-10">
                {TIMELINE.map((t, i) => (
                  <li key={i} className={t.gold ? "is-gold" : undefined}>
                    <time>{t.date}</time>
                    <div>
                      <b>{t.title}</b>
                      {t.body ? <p>{t.body}</p> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <figure className="s-figure min-w-0 lg:col-span-7">
              <PlateStage painting="petoOldSouvenirs" focus={[50, 30]} height={820} mobile={{ height: 320, focus: [45, 22] }} sizes="(max-width: 1024px) 100vw, 820px">
                <PlateOverlay left="6%" top="46%" width="88%">
                  <Terminal title="git log" label="The repository's history, a selection" className="!shadow-[0_0_0_1px_rgb(0_0_0/0.6),0_22px_50px_-14px_rgb(30_16_4/0.5)]">
                    <div>
                      <span className="p">$ </span>
                      <span className="c">git log --reverse --format=&apos;%h %ad %s&apos; --date=short</span>
                    </div>
                    {GIT_LOG.map(([h, d, m]) => (
                      <div key={h} className="sm:pl-[19ch] sm:-indent-[19ch]">
                        <span className="y">{h}</span> <span className="p">{d}</span> <span className="c">{m}</span>
                      </div>
                    ))}
                  </Terminal>
                </PlateOverlay>
              </PlateStage>
              <PlateCaption painting="petoOldSouvenirs" even>
                <b>The history, as git keeps it.</b> Seven of the 22 commits on main, from the first on Oct 20 to version 1.0.0 on Nov 3, 2026.
              </PlateCaption>
            </figure>
          </div>
        </Container>
      </Section>

      {/* The short version: two ruled strips of facts */}
      <Section id="facts" labelledBy="facts-h">
        <Container>
          <SectionHead aside={<Lede>Everything here can be checked in the repository or on the sandbox record.</Lede>}>
            <Eyebrow>The short version</Eyebrow>
            <Heading id="facts-h" title="Exhibit, in eight facts." />
          </SectionHead>
          <FactStrip
            items={[
              { k: "Started", v: TEAM.firstCommit, note: "The first commit" },
              { k: "Founders", v: "Two co-founders", note: "Shivansh Dwivedi and Someet Shende" },
              { k: "Built for", v: "PayPal AI Hackathon", note: "2026" },
              { k: "Version", v: "1.0.0", note: "Released Nov 3, 2026" },
            ]}
          />
          <FactStrip
            className="!border-t-0"
            items={[
              { k: "Licence", v: "MIT", note: "Shivansh Dwivedi, Someet Shende, KaDeep AI" },
              { k: "Tested on", v: "PayPal's sandbox", note: "244 logged API calls" },
              { k: "On sale", v: "Not yet", note: "Pricing is planned" },
              { k: "PayPal", v: "Independent", note: "Not affiliated with or endorsed by PayPal" },
            ]}
          />
          <Small className="mt-5">
            The code, the issues and the security policy live at <TextLink href={GITHUB.repo}>github.com/exhibitlabs/exhibit</TextLink>
          </Small>
        </Container>
      </Section>

      {/* Close */}
      <Section tone="band" labelledBy="about-close-h">
        <Container>
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end lg:gap-6">
            <div className="lg:col-span-7">
              <Heading id="about-close-h" title="See it work a case," rest="or tell us about yours." />
            </div>
            <div className="lg:col-span-5">
              <Body>
                Write to <a href={`mailto:${CONTACT_EMAIL}`} className="underline decoration-[color:var(--s-line-2)] underline-offset-4 hover:decoration-[color:var(--s-ink)]">{CONTACT_EMAIL}</a>, or run a case end to end in the live demo.
              </Body>
              <Actions>
                <ButtonLink href={DEMO_URL} arrow>
                  Try the live demo
                </ButtonLink>
                <ButtonLink href={ROUTES.contact} variant="ghost">
                  Contact us
                </ButtonLink>
              </Actions>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
