import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "../ui/Logo";
import { DEMO_URL, DEMO_VIDEO_URL, GITHUB_URL } from "./data";
import { ButtonLink, Container } from "./Primitives";

export function FinalCta() {
  return (
    <section aria-label="Try Exhibit" className="border-t border-line">
      <Container className="flex flex-col items-start gap-8 py-20 md:flex-row md:items-end md:justify-between md:py-24">
        <h2 className="max-w-[640px] text-balance text-[30px] font-semibold leading-[1.1] tracking-[-0.035em] text-ink sm:text-[40px]">
          Watch Exhibit work a case.<span className="text-[#8a8a8a]"> It takes about a minute.</span>
        </h2>
        <div className="flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={DEMO_URL}>
            Try the live demo <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </ButtonLink>
          {DEMO_VIDEO_URL ? (
            <ButtonLink href={DEMO_VIDEO_URL} variant="secondary" external>
              <Play className="size-3.5" fill="currentColor" strokeWidth={0} aria-hidden /> Watch the demo<span className="sr-only"> (opens in a new tab)</span>
            </ButtonLink>
          ) : (
            <ButtonLink href="/proof" variant="secondary">
              Read the proof
            </ButtonLink>
          )}
        </div>
      </Container>
    </section>
  );
}

const linkCls = "rounded-sm text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <Container className="grid gap-10 py-12 md:grid-cols-[minmax(0,1fr)_auto] md:gap-16">
        <div className="max-w-[460px]">
          <Link href="/" className="inline-flex items-center gap-2 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" aria-label="Exhibit, home">
            <LogoMark size={20} />
            <span className="text-[15px] font-semibold leading-none tracking-[-0.04em]">Exhibit</span>
          </Link>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">The dispute agent for PayPal merchants. Built for the PayPal AI Hackathon 2026 by KaDeep AI.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-14 gap-y-2.5 text-[13.5px] sm:grid-cols-3">
          <Link href={DEMO_URL} className={linkCls}>
            Live demo
          </Link>
          <Link href="/proof" className={linkCls}>
            Proof
          </Link>
          <Link href="/#how" className={linkCls}>
            How it works
          </Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={linkCls}>
            GitHub<span className="sr-only"> (opens in a new tab)</span>
          </a>
          <a href={`${GITHUB_URL}/blob/main/LICENSE`} target="_blank" rel="noopener noreferrer" className={linkCls}>
            MIT License<span className="sr-only"> (opens in a new tab)</span>
          </a>
          <Link href="/#pricing" className={linkCls}>
            Pricing
          </Link>
        </nav>
      </Container>
      <Container>
        <div className="flex flex-col gap-2 border-t border-line py-6 text-[12px] leading-relaxed text-muted md:flex-row md:justify-between md:gap-10">
          <p>Exhibit is an independent project. It is not affiliated with or endorsed by PayPal. PayPal is a trademark of PayPal, Inc.</p>
          <p className="shrink-0">Kora Atelier, the demo merchant, is fictional.</p>
        </div>
      </Container>
    </footer>
  );
}
