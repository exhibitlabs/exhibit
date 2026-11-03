import "./company.css";
import { clsx } from "clsx";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import type { CSSProperties } from "react";
import { FOUNDERS, TEAM } from "@/components/landing/data";
import { TextLink } from "../actions";
import { Reveal } from "../Reveal";
import { DotArt, DotTrack } from "../dots/DotArt";
import { ROUTES } from "../nav";
import { DISPUTE_STEPS, EXHIBIT_FACTS, FOUNDER_PHOTOS, MARKET_FACTS, PAYPAL_TOOL_STEPS, type CompanyFact } from "./records";

// The about page's own pieces: the founders' portraits, their cards and quote, and "Exhibit in 8 facts".
// Server components; styles in company.css (portraits, founders, quote, facts).

type FounderName = (typeof FOUNDERS)[number]["name"];

/**
 * Where a founder's photo sits inside a box of the given aspect ratio (width / height), so the face lands at
 * `at` (fractions of the box) and the head is `head` of the box's height. Both photos go through this, which is
 * what keeps their crops the same although the originals are framed differently.
 */
function crop(name: FounderName, ratio: number, head: number, at: [number, number]): CSSProperties {
  const photo = FOUNDER_PHOTOS[name];
  // The photos are square: covering the box makes them this many times the box's width and height.
  const coverW = Math.max(1, 1 / ratio);
  const coverH = Math.max(1, ratio);
  const zoom = Math.max(1, head / (photo.head * coverH));
  const w = coverW * zoom;
  const h = coverH * zoom;
  const clamp = (v: number, size: number) => Math.min(0, Math.max(1 - size, v));
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
  return {
    width: pct(w),
    height: pct(h),
    left: pct(clamp(at[0] - photo.face[0] * w, w)),
    top: pct(clamp(at[1] - photo.face[1] * h, h)),
    "--s-co-tone": photo.tone,
  } as CSSProperties;
}

/**
 * A founder's photo, cropped like every other one on the page and printed in grey; it turns to colour when its
 * card is hovered or focused (company.css). Decorative unless `alt` is given.
 */
export function Portrait({ name, ratio = 1, head = 0.4, at = [0.5, 0.38], alt = "", className }: { name: FounderName; ratio?: number; head?: number; at?: [number, number]; alt?: string; className?: string }) {
  return (
    <span className={clsx("s-co-portrait", className)} style={{ aspectRatio: String(ratio) }}>
      <Image src={FOUNDER_PHOTOS[name].src} alt={alt} width={640} height={640} unoptimized className="s-co-portrait__img" style={crop(name, ratio, head, at)} />
    </span>
  );
}

/** One founder: photo, name, role and GitHub. No bio beyond what is true. */
export function FounderCard({ founder }: { founder: (typeof FOUNDERS)[number] }) {
  const handle = founder.github.replace(/^https:\/\//, "");
  return (
    <article className="s-co-founder">
      <Portrait name={founder.name} ratio={4 / 5} head={0.38} at={[0.5, 0.36]} alt={`Photo of ${founder.name}`} className="s-co-founder__photo" />
      <div className="s-co-founder__text">
        <h3>{founder.name}</h3>
        <p>{founder.role}</p>
        <TextLink href={founder.github} className="s-co-founder__gh">
          {handle}
        </TextLink>
      </div>
    </article>
  );
}

/** The founders' quote, verbatim, attributed to both. Set beside their cards, so it needs no portraits of its own. */
export function FoundersQuote() {
  return (
    <figure className="s-co-quote">
      <blockquote className="s-co-quote__text">
        <p>
          <span className="s-co-quote__mark" aria-hidden>
            &ldquo;
          </span>
          The proof that wins a dispute is scattered across your store, your carrier, your inbox and PayPal. Exhibit gathers it, cites every line and files it. When the buyer is right, it says so.&rdquo;
        </p>
      </blockquote>
      <figcaption className="s-co-quote__by">
        <b>{TEAM.names}</b>
        <span>Co-founders of Exhibit Labs</span>
      </figcaption>
    </figure>
  );
}

/** "$15 to $30" and "3 of 12": the joining word set smaller, so the figures carry the line. */
function Figure({ value, spoken }: { value: string; spoken?: string }) {
  const parts = value.split(/( to | of )/);
  return (
    <p className="s-co-fact__n">
      <span aria-hidden={spoken ? true : undefined}>
        {parts.map((part, i) =>
          part === " to " || part === " of " ? (
            <span key={i} className="s-co-fact__join">
              {part}
            </span>
          ) : (
            part
          ),
        )}
      </span>
      {spoken ? <span className="s-sr-only">{spoken}</span> : null}
    </p>
  );
}

function Source({ source }: { source: CompanyFact["source"] }) {
  return (
    <p className="s-co-fact__src">
      <span className="s-sr-only">Source: </span>
      <a href={source.href} target="_blank" rel="noopener noreferrer">
        {source.name}
        <ArrowUpRight className="s-icon" aria-hidden />
        <span className="s-sr-only"> (opens in a new tab)</span>
      </a>
    </p>
  );
}

/**
 * Exhibit in 8 facts: six about the market (PayPal's scale, then chargebacks worldwide), ruled like a report,
 * then the two about Exhibit on dark cards, with the homepage's 3-of-12 dot track echoed small.
 */
export function EightFacts() {
  const { steps, filings } = EXHIBIT_FACTS;
  return (
    <div className="s-co-facts">
      <div className="s-co-facts__group">
        <div className="s-co-facts__head">
          <h3 id="facts-market">The market</h3>
          <p>PayPal&apos;s scale, and the growing cost of chargebacks.</p>
        </div>
        <ul className="s-co-facts__grid" aria-labelledby="facts-market">
          {MARKET_FACTS.map((f, i) => (
            <Reveal as="li" key={f.figure} delay={(i % 3) * 80} className="s-co-fact">
              <Figure value={f.figure} spoken={f.spoken} />
              <p className="s-co-fact__l">{f.label}</p>
              <Source source={f.source} />
            </Reveal>
          ))}
        </ul>
      </div>

      <div className="s-co-facts__group">
        <div className="s-co-facts__head">
          <h3 id="facts-exhibit">Exhibit</h3>
          <p>What Exhibit adds, and what it never does.</p>
        </div>
        <ul className="s-co-wedge" aria-labelledby="facts-exhibit">
          <Reveal as="li" className="s-co-wedge__card s-co-fact">
            <Figure value={steps.figure} />
            <p className="s-co-fact__l">{steps.label}</p>
            <div className="s-co-wedge__tracks">
              <p className="s-co-wedge__cap">
                <span>PayPal&apos;s agent tools</span>
                <span className="s-num">
                  {PAYPAL_TOOL_STEPS.length} of {DISPUTE_STEPS}
                </span>
              </p>
              <DotTrack filled={PAYPAL_TOOL_STEPS} dots={[5, 3]} columnsMobile={12} label={`PayPal's agent tools cover ${PAYPAL_TOOL_STEPS.length} of the ${DISPUTE_STEPS} steps: finding disputes, reading one, and accepting the claim.`} />
              <p className="s-co-wedge__cap">
                <span>Exhibit</span>
                <span className="s-num">
                  {DISPUTE_STEPS} of {DISPUTE_STEPS}
                </span>
              </p>
              <DotTrack filled="all" dots={[5, 3]} columnsMobile={12} label={`Exhibit covers all ${DISPUTE_STEPS} steps.`} />
            </div>
            <Source source={steps.source} />
          </Reveal>
          <Reveal as="li" delay={90} className="s-co-wedge__card s-co-fact">
            <Figure value={filings.figure} />
            <p className="s-co-fact__l">{filings.label}</p>
            <DotArt name="shield" className="s-co-wedge__art" />
            <p className="s-co-fact__src">
              <TextLink href={`${ROUTES.security}#approvals`}>How approvals work</TextLink>
            </p>
          </Reveal>
        </ul>
      </div>

      <p className="s-co-facts__note">
        PayPal&apos;s figures are from its annual report for 2025, filed with the SEC. The chargeback figures are worldwide totals from Mastercard&apos;s 2025 State of Chargebacks, based on research by Datos Insights, not PayPal&apos;s own. PayPal&apos;s fees and agent tools were read on its websites.
      </p>
    </div>
  );
}
