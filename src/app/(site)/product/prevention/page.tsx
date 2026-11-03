import type { Metadata } from "next";
import { Body, ButtonLink, Container, CTA, DotArt, Eyebrow, Heading, PageHeader, Plate, PlateCaption, Reveal, ROUTES, Section, SectionHead, Stat, TextLink } from "@/components/site";
import { PreventionSave } from "@/components/site/product/PreventionSave";
import { ProductCta } from "@/components/site/product/ProductCta";
import { ProductNav } from "@/components/site/product/ProductNav";
import { ProductPager } from "@/components/site/product/ProductPager";
import { LENA, RADAR, itemName, money, utcDate } from "@/components/site/product/data";
import { DrawerHeadView, FixSectionView } from "@/components/site/drawer";
import { LENA_DRAWER } from "@/components/site/facts";
import { LENA_ORDER } from "@/components/site/fragments";
import { productMetadata } from "@/components/site/product/meta";

const DESCRIPTION =
  "Exhibit scores recent PayPal orders for the seven signals that come before a dispute and fixes them first: tracking pushed to PayPal, overdue refunds sent, and buyers answered in their own language.";

export const metadata: Metadata = productMetadata({ title: "Prevention", description: DESCRIPTION, path: ROUTES.product.prevention });

/** What sets each signal off and the fix it offers (src/lib/prevention.ts: SIGNALS, detectSignals, FIX). */
const SIGNAL_INFO: Record<string, { trigger: string; fix: string; api?: string }> = {
  tracking_stalled: { trigger: "No carrier scan for 4 days or more, a delivery exception, or the promised delivery date has passed.", fix: "Message the buyer" },
  tracking_not_on_paypal: { trigger: "Shipped, but the tracking number never reached PayPal, so an item-not-received claim would start with no proof on file.", fix: "Push tracking to PayPal", api: "POST /v2/checkout/orders/{id}/track" },
  weak_checkout: { trigger: "A first order of $200 or more with two or more warnings: AVS or CVV mismatch, no 3-D Secure, a distant IP, a new email, several orders in a day, a different billing address.", fix: "Hold and verify the buyer" },
  buyer_waiting: { trigger: "A buyer message unanswered for 24 hours, or one that mentions a dispute, a chargeback or a missing order.", fix: "Message the buyer" },
  unsigned_high_value: { trigger: "Delivered without a signature over $250, though the shipping policy promises signature confirmation above that.", fix: "Message the buyer, or require signatures" },
  address_mismatch: { trigger: "Delivered somewhere other than the address on the PayPal transaction, which voids Seller Protection.", fix: "Message the buyer" },
  refund_overdue: { trigger: "The return arrived and no refund went out within 3 business days, as the returns policy promises.", fix: "Refund now", api: "POST /v2/payments/captures/{id}/refund" },
};

const FIXES = [
  { label: "Push tracking to PayPal", channel: "PayPal API", api: "POST /v2/checkout/orders/{id}/track", what: "Sends the carrier and tracking number to the PayPal order, so proof of shipment is on file before any claim." },
  { label: "Refund now", channel: "PayPal API", api: "POST /v2/payments/captures/{id}/refund", what: "Refunds the capture through PayPal and tells the buyer, before they file a credit-not-processed claim." },
  { label: "Message the buyer", channel: "Support inbox", what: "A status update in the buyer's language, written from templates in English, German and French, with the order's own scans and dates." },
  { label: "Hold and verify the buyer", channel: "Support inbox", what: "Holds fulfilment and asks the buyer to confirm billing details before anything ships." },
  { label: "Require signatures", channel: "Store rule", what: "Turns on a rule: every label above the threshold needs signature confirmation." },
];

const NAIR = RADAR.orders.find((o) => o.id === "KA-10562")!;
/** What the app's refund fix says it does (src/lib/prevention.ts, FIX.refund). */
const REFUND_FIX = "Refunds the capture through PayPal and tells the buyer, before they file credit-not-processed.";
const atRisk = RADAR.orders.filter((o) => o.status === "at_risk");
const maxExposure = Math.max(...RADAR.bySignal.map((s) => s.exposure));
const t = RADAR.totals;

/** The 17 at-risk orders on a 0 to 100 risk axis, stacked where scores repeat; Lena's prevented order at 0. */
function RiskStrip() {
  const byScore = new Map<number, typeof atRisk>();
  for (const o of atRisk) byScore.set(o.score, [...(byScore.get(o.score) ?? []), o]);
  return (
    <figure className="s-pr-strip">
      <div className="s-pr-strip__plot" role="img" aria-label={`${atRisk.length} at-risk orders by risk score: ${atRisk.map((o) => o.score).join(", ")}. One order, Lena Hoffmann's, was prevented and now scores 0.`}>
        <span className="s-pr-strip__band s-pr-strip__band--watch" style={{ left: "15%", width: "25%" }}>
          <span>Watch</span>
        </span>
        <span className="s-pr-strip__band s-pr-strip__band--elev" style={{ left: "40%", width: "25%" }}>
          <span>Elevated</span>
        </span>
        <span className="s-pr-strip__band s-pr-strip__band--high" style={{ left: "65%", width: "35%" }}>
          <span>High</span>
        </span>
        {[...byScore.entries()].map(([score, list]) =>
          list.map((o, i) => <span key={o.id} className={`s-pr-strip__dot s-pr-strip__dot--${o.band}`} style={{ left: `${score}%`, bottom: `${10 + i * 15}px` }} title={`${o.buyer}, ${o.id}: risk ${score}`} />),
        )}
        <span className="s-pr-strip__dot s-pr-strip__dot--saved" style={{ left: "0%", bottom: "10px" }} title="Lena Hoffmann, KA-10561: prevented, risk 0" />
        <span className="s-pr-strip__lena" style={{ left: "0%" }}>
          Lena Hoffmann, 84 to 0
        </span>
      </div>
      <div className="s-pr-strip__axis" aria-hidden>
        {[0, 15, 40, 65, 100].map((v) => (
          <span key={v} style={{ left: `${v}%` }}>
            {v}
          </span>
        ))}
      </div>
      <figcaption className="s-small s-pr-strip__cap">Each dot is one order on the demo store&apos;s radar, {utcDate(RADAR.capturedAt)}, placed by its risk score.</figcaption>
    </figure>
  );
}

export default function PreventionPage() {
  return (
    <>
      <ProductNav current="prevention" />
      <PageHeader
        eyebrow="Prevention"
        eyebrowIndex="03"
        title="Most disputes give a warning."
        rest="Exhibit acts on it first."
        lede="A parcel stops moving, a buyer writes twice, a refund runs late. Exhibit watches recent orders for seven of those signals, scores the risk of a dispute and drafts the fix: tracking pushed to PayPal, a refund sent through PayPal, or a reply in the buyer's own language."
        actions={
          <>
            <ButtonLink href={CTA.primary.href} arrow>
              {CTA.primary.label}
            </ButtonLink>
            <ButtonLink href={CTA.secondary.href} variant="ghost">
              {CTA.secondary.label}
            </ButtonLink>
          </>
        }
        aside={<DotArt name="parcel" frame className="w-[210px] sm:w-[260px] lg:w-[300px]" />}
      />

      {/* 1. Lena Hoffmann's save, on Sommar's letter rack */}
      <Section id="save" labelledBy="save-title">
        <Container>
          <SectionHead
            aside={
              <Body>
                Lena Hoffmann&apos;s ${LENA.amount} duffle had not moved past customs in Leipzig for days when she wrote that she would open a PayPal dispute if she heard nothing by the end of the week. Exhibit scored the order {LENA.fix.before.score}, drafted a reply in German with the DHL scans and a plan, and no case was opened.
              </Body>
            }
          >
            <Heading id="save-title" title="A buyer about to dispute." rest="Answered in German." />
          </SectionHead>
        </Container>
        <Container size="wide">
          <Reveal>
            <figure className="s-figure">
              <Plate painting="sommar" focus={[50, 50]} zoom={1.05} preload className="s-pr-flow" sizes="(max-width: 768px) 100vw, 1376px">
                <div className="s-pr-flow__in" style={{ ["--pad-t" as string]: "88px", ["--pad-x" as string]: "clamp(24px, 5vw, 88px)", ["--pad-b" as string]: "88px", ["--pad-t-m" as string]: "140px" }}>
                  <PreventionSave order={LENA_ORDER} signals={LENA_DRAWER.signals.map((x) => ({ ...x, lang: x.kind === "buyer_waiting" ? "de" : undefined }))} fix={LENA_DRAWER.fix} english={LENA.english} saved={LENA_DRAWER.saved} />
                </div>
              </Plate>
              <PlateCaption painting="sommar">
                <b>Prevention, recorded on the demo store.</b> Order {LENA.orderId}, {utcDate(LENA.fix.at)}: risk {LENA.fix.before.score} before the reply, {LENA.fix.after.score} after, ${LENA.fix.saved} kept. Kora Atelier is a demo merchant on the PayPal simulator.
              </PlateCaption>
            </figure>
          </Reveal>
        </Container>
      </Section>

      {/* 2. The seven signals, by exposure on the demo radar */}
      <Section id="signals" labelledBy="signals-title">
        <Container>
          <SectionHead aside={<Body>Each signal maps to the PayPal dispute it tends to become and to a fix Exhibit can run. The bars are the demo store&apos;s radar on {utcDate(RADAR.capturedAt)}: {t.watched} recent orders watched, {t.atRisk} at risk.</Body>}>
            <Eyebrow>Signals</Eyebrow>
            <Heading id="signals-title" title="Seven warning signs." rest="Each one a future claim." />
          </SectionHead>
          <ol className="s-pr-signals">
            {RADAR.bySignal.map((s, i) => {
              const info = SIGNAL_INFO[s.kind];
              return (
                <Reveal as="li" key={s.kind} delay={i * 40} className="s-pr-signal">
                  <div className="s-pr-signal__main">
                    <h3 className="s-pr-signal__name">{s.label}</h3>
                    <p className="s-pr-signal__trigger">{info.trigger}</p>
                  </div>
                  <div className="s-pr-signal__meta">
                    <span className="s-pr-signal__k">Leads to</span>
                    <span>{s.reason}</span>
                    <span className="s-pr-signal__k">Fix</span>
                    <span>
                      {info.fix}
                      {info.api ? <span className="s-mono s-pr-signal__api">{info.api}</span> : null}
                    </span>
                  </div>
                  <div className="s-pr-signal__bar" aria-label={`${s.count} orders, ${money(s.exposure)} exposed`}>
                    <span className="s-pr-signal__fill" style={{ width: `${Math.max(4, (s.exposure / maxExposure) * 100)}%` }} />
                    <span className="s-pr-signal__num">
                      <span className="s-mono">{s.count}</span> {s.count === 1 ? "order" : "orders"} · <span className="s-mono">{money(s.exposure)}</span>
                    </span>
                  </div>
                </Reveal>
              );
            })}
          </ol>
          <p className="s-small s-pr-signals__note">Exposure is the order plus the dispute fee PayPal would charge: $15 for a PayPal checkout payment, $20 for a card payment. Demo store data.</p>
        </Container>
      </Section>

      {/* 3. Fixes */}
      <Section id="fixes" tone="band" labelledBy="fixes-title">
        <Container>
          <SectionHead aside={<Body>Fixes through PayPal&apos;s API come first, because they leave proof on PayPal&apos;s side. Before a dispute exists PayPal has no messaging API, so replies go out from the store&apos;s support inbox.</Body>}>
            <Eyebrow>Fixes</Eyebrow>
            <Heading id="fixes-title" title="Through PayPal first." rest="Then the buyer's inbox." />
          </SectionHead>
          <div className="s-pr-fixes">
            <Reveal className="s-pr-fixes__list">
              <ul>
                {FIXES.map((f) => (
                  <li key={f.label}>
                    <div className="s-pr-fixes__head">
                      <h3 className="s-h s-h--h4">{f.label}</h3>
                      <span className="s-pr-fixes__channel">{f.channel}</span>
                    </div>
                    <p className="s-body">{f.what}</p>
                    {f.api ? <p className="s-mono s-pr-fixes__api">{f.api}</p> : null}
                  </li>
                ))}
              </ul>
              <p className="s-small s-pr-fixes__honest">Tracking pushes and capture refunds are built and run against the PayPal simulator. They have not been called on the live sandbox yet.</p>
            </Reveal>
            <Reveal delay={90} className="s-pr-fixes__card">
              <div data-ui className="s-ui s-ui-sheet s-pr-order" role="group" aria-label={`Prevention drawer for order ${NAIR.id}, scrolled to Fix it now: ${NAIR.fix!.label}`}>
                <div className="s-f-dr">
                  <DrawerHeadView order={{ buyer: NAIR.buyer, country: NAIR.country, orderId: NAIR.id, item: itemName(NAIR.item), score: NAIR.score, band: NAIR.band as "high", exposure: NAIR.exposure, amount: NAIR.amount, fee: NAIR.fee, card: NAIR.funding === "CARD" }} />
                  <FixSectionView detail={REFUND_FIX} label={NAIR.fix!.label} channel="paypal" api={NAIR.fix!.api} />
                </div>
              </div>
              <p className="s-small s-pr-fixes__cap">The radar&apos;s highest-risk order on {utcDate(RADAR.capturedAt)}. Its fix is the refund the store owes, sent through PayPal.</p>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* 4. The score */}
      <Section id="score" labelledBy="score-title">
        <Container>
          <SectionHead aside={<Body>Each signal carries a weight. Exhibit combines them as independent chances, so two medium signals make a high risk, then adds the scores up into the disputes to expect if nothing changes.</Body>}>
            <Eyebrow>The score</Eyebrow>
            <Heading id="score-title" title="One risk score per order." rest="Signals add up like odds." />
          </SectionHead>
          <div className="s-pr-score">
            <Reveal className="s-pr-score__stats">
              <Stat value={t.watched} label="recent orders watched" />
              <Stat value={t.atRisk} label="at risk" />
              <Stat value={money(t.exposure)} label="exposed, with fees" />
              <Stat value={t.expectedDisputes.toFixed(2)} label="disputes expected if nothing changes" />
            </Reveal>
            <Reveal delay={80}>
              <RiskStrip />
            </Reveal>
          </div>
          <div className="s-pr-score__foot">
            <p className="s-body">
              <b className="font-medium text-[var(--s-ink)]">Prevented so far on the demo store:</b> {t.prevented} order, {money(t.saved)} kept, {money(t.feesAvoided)} in dispute fees avoided. No model scores an order: every point comes from a rule in the code, and each signal shows the record behind it.
            </p>
            <TextLink href={ROUTES.product.aiAgents}>Agents can read the radar and ask to run a fix</TextLink>
          </div>
        </Container>
      </Section>

      <ProductPager current="prevention" />
      <ProductCta
        id="prevention-cta"
        title="Reply before the case opens."
        rest="In the buyer's language."
        lede="Open Lena Hoffmann's order in the live demo and send the drafted German reply. It runs on the PayPal simulator with a demo store, so no real buyer is contacted."
        art="bubble"
      />
    </>
  );
}
