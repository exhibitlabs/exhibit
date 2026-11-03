import type { Metadata } from "next";
import { companyMetadata } from "@/components/site/company/meta";
import Link from "next/link";
import { ArrowUpRight, Bug, Code2, ShieldAlert } from "lucide-react";
import { Body, Container, DotArt, Eyebrow, Heading, Lede, PageHeader, ROUTES, Section, SectionHead, Small } from "@/components/site";
import { ContactForm } from "@/components/site/company/ContactForm";
import { CONTACT_EMAIL, GITHUB } from "@/components/site/company/records";

const DESCRIPTION = `Book a demo of Exhibit or ask a question. The form sends your message straight to the founders' inbox, and you can pick times for a demo. Or write to ${CONTACT_EMAIL}.`;

export const metadata: Metadata = companyMetadata({ title: "Contact", description: DESCRIPTION, path: "/contact" });

const ROUTES_OUT = [
  {
    icon: Bug,
    k: "GitHub issues",
    title: "Bugs and ideas",
    body: "Open an issue on GitHub. There are templates for bug reports and feature requests.",
    href: GITHUB.newIssue,
    cta: "Open an issue",
  },
  {
    icon: ShieldAlert,
    k: "Private report",
    title: "Security problems",
    body: "Report a vulnerability privately on GitHub, or email us. Please don't open a public issue with the details.",
    href: GITHUB.reportVulnerability,
    cta: "Report a vulnerability",
  },
  {
    icon: Code2,
    k: "MIT licence",
    title: "The code",
    body: "Read every prompt, tool and guardrail, and run the 359 tests yourself. Pull requests are welcome.",
    href: GITHUB.repo,
    cta: "github.com/exhibitlabs/exhibit",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Book a demo, or ask us anything."
        rest="There's no sales team, just the two co-founders."
        lede={`The form sends your message straight to the founders' inbox. For a demo, pick a few times that suit you. You can also write to ${CONTACT_EMAIL} directly.`}
        aside={<DotArt name="letter" frame className="w-[180px] sm:w-[220px] lg:w-full lg:max-w-[292px]" />}
      />

      {/* The form and the letter it will open */}
      <Section spacing="tight" label="Contact form">
        <Container>
          <ContactForm to={CONTACT_EMAIL} privacyHref={ROUTES.legal.privacy} />
        </Container>
      </Section>

      {/* Write directly, or reach the project on GitHub */}
      <Section labelledBy="direct-h">
        <Container>
          <div className="grid grid-cols-1 gap-8 border-t border-[color:var(--s-ink)] pt-8 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-4">
              <Eyebrow>Or write directly</Eyebrow>
              <h2 id="direct-h" className="s-sr-only">
                Write directly
              </h2>
              <Small className="max-w-[320px]">Any email client works. Write from the address you&apos;d like us to answer.</Small>
            </div>
            <div className="lg:col-span-8">
              <a className="s-co-address" href={`mailto:${CONTACT_EMAIL}`}>
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
          <div className="s-co-cards mt-14">
            {ROUTES_OUT.map((r) => (
              <a key={r.title} href={r.href} target="_blank" rel="noopener noreferrer" className="s-co-card group transition-shadow hover:shadow-[inset_0_0_0_1px_var(--s-line-2)]">
                <div className="s-co-card__k">
                  <r.icon className="s-icon" aria-hidden />
                  <span>{r.k}</span>
                </div>
                <h3>{r.title}</h3>
                <p>{r.body}</p>
                <span className="s-link mt-5 !text-[13.5px] group-hover:underline">
                  {r.cta}
                  <ArrowUpRight className="s-icon s-link__out" aria-hidden />
                </span>
                <span className="s-sr-only"> (opens in a new tab)</span>
              </a>
            ))}
          </div>
        </Container>
      </Section>

      {/* What happens next: steps, with the speech-bubble dot art */}
      <Section tone="band" labelledBy="next-h">
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-6">
              <SectionHead className="!mb-10 !block">
                <Eyebrow>What happens next</Eyebrow>
                <Heading id="next-h" title="You send it." rest="We answer it." />
              </SectionHead>
              <ol className="s-co-steps">
                <li>
                  <div>
                    <h3>It reaches the founders</h3>
                    <p>Straight to our inbox, with any times you picked in your time zone and in India&apos;s, where we are.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <h3>We reply by email</h3>
                    <p>To the address you gave. We aim to reply within a few days.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <h3>For a demo, we confirm a time</h3>
                    <p>One of the times you picked, or another that suits you.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <h3>We walk through a case with you</h3>
                    <p>On the live demo or on your own PayPal sandbox.</p>
                  </div>
                </li>
              </ol>
            </div>
            <div className="flex flex-col justify-between gap-10 lg:col-span-5 lg:col-start-8">
              <DotArt name="bubble" className="w-full max-w-[420px]" />
              <div>
                <Lede>The form sends what you see in its preview, plus the page you came from and the time. It goes to our inbox, and this site stores none of it.</Lede>
                <Body className="mt-3">
                  How Exhibit handles data is on the{" "}
                  <Link href={ROUTES.legal.privacy} className="underline decoration-[color:var(--s-line-2)] underline-offset-4 hover:decoration-[color:var(--s-ink)]">
                    privacy page
                  </Link>
                  .
                </Body>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
