import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { DEMO_URL, DEMO_VIDEO_URL } from "./data";
import { HERO_CASES } from "./hero-data";
import { HeroReplay } from "./HeroReplay";
import { ButtonLink, Container } from "./Primitives";
import { disputeActions } from "./proof-data";
import proof from "./records/proof.json";

// Responses only: provide-evidence, provide-supporting-info, accept-claim. The sandbox-only adjudicate call is not one.
const disputeWrites = disputeActions.length;

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative">
      <Container className="pb-2 pt-12 sm:pt-16 lg:pt-20">
        <Link
          href="/proof"
          className="group inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-white py-1 pl-2.5 pr-3 text-[12.5px] text-ink-2 shadow-[0_1px_2px_rgb(0_0_0/0.03)] transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <span className="size-1.5 shrink-0 rounded-full bg-green" aria-hidden />
          <span className="truncate">
            Tested live on the PayPal sandbox<span className="hidden sm:inline">, every call on the record</span>
          </span>
          <ArrowRight className="size-3 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start lg:gap-14">
          <h1 id="hero-title" className="max-w-[760px] text-balance text-[40px] font-semibold leading-[1.03] tracking-[-0.045em] text-ink sm:text-[54px] lg:text-[58px]">
            The dispute agent for PayPal merchants.
          </h1>
          <div className="lg:pt-2">
            <p className="max-w-[560px] text-pretty text-[17px] leading-[1.6] text-muted sm:text-[18px]">
              Exhibit reads each dispute from PayPal&apos;s Disputes API, investigates it with Claude, cites every claim to a real record and files the response through PayPal. When the buyer is right, it refunds.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href={DEMO_URL}>
                Try the live demo <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </ButtonLink>
              {DEMO_VIDEO_URL ? (
                <ButtonLink href={DEMO_VIDEO_URL} variant="secondary" external>
                  <Play className="size-3.5" fill="currentColor" strokeWidth={0} aria-hidden /> Watch the demo<span className="sr-only"> (opens in a new tab)</span>
                </ButtonLink>
              ) : (
                <span className="text-[13px] text-muted sm:ml-1.5">No sign-up. The demo runs on a sample store.</span>
              )}
            </div>
          </div>
        </div>
      </Container>

      <Container className="lp-rise pt-8 [animation-delay:240ms] md:pt-12">
        <HeroReplay cases={HERO_CASES} />
      </Container>

      <Container className="pt-14 md:pt-16">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line py-7 sm:grid-cols-4">
          {[
            [proof.totals.calls, "calls to PayPal's sandbox API, logged"],
            [proof.totals.disputes, "sandbox chargebacks investigated"],
            [disputeWrites, "dispute responses filed through the API"],
            [proof.totals.endpoints, "PayPal endpoints exercised live"],
          ].map(([n, label]) => (
            <div key={label as string} className="flex flex-col gap-1.5">
              <dt className="order-2 text-[13px] leading-snug text-muted">{label}</dt>
              <dd className="num order-1 text-[28px] leading-none tracking-[-0.03em] text-ink">{n}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[13px] text-muted">
          From Exhibit&apos;s own API log, with HTTP status, latency and PayPal debug ids.{" "}
          <Link href="/proof" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            See every call
          </Link>
        </p>
      </Container>
    </section>
  );
}
