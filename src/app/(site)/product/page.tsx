import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Body, ButtonLink, Container, DotArt, Eyebrow, Heading, PageHeader, Plate, PlateCaption, Reveal, ROUTES, Section, SectionHead, StatusCode, Tag, TextLink } from "@/components/site";
import { CAPABILITIES } from "@/components/site/product/capabilities";
import { ProductCta } from "@/components/site/product/ProductCta";
import { ProductNav } from "@/components/site/product/ProductNav";
import { LIVE, REFUNDS, utc } from "@/components/site/product/data";
import { AskTurnTop, ApprovalBannerView, BriefCardView, LENA_ORDER, PacketPage } from "@/components/site/fragments";
import { DrawerHeadView, DrawerSuccess } from "@/components/site/drawer";
import { BriefCard } from "@/components/site/company/cases";
import { LENA_DRAWER } from "@/components/site/facts";
import { productMetadata } from "@/components/site/product/meta";
import { GITHUB_URL } from "@/components/landing/data";

const DESCRIPTION =
  "Exhibit is the dispute agent for PayPal merchants. It heads off disputes before they are filed, investigates each case across eight sources, files a cited evidence packet through PayPal's API once you approve, answers questions about the whole dispute book and works with other AI agents over MCP.";

export const metadata: Metadata = productMetadata({ title: "Product", description: DESCRIPTION, path: ROUTES.product.overview });

/** The PayPal endpoints Exhibit calls (README "PayPal APIs"), with whether each was called on the live sandbox. */
const ENDPOINTS: { ep: string[]; use: string; live: boolean }[] = [
  { ep: ["GET /v1/customer/disputes", "GET /v1/customer/disputes/{id}"], use: "Sync the inbox; read the case facts, deadline, the evidence PayPal wants and the actions it allows right now", live: true },
  { ep: ["POST /v1/customer/disputes/{id}/provide-evidence"], use: "File evidence, tracking and the PDF packet", live: true },
  { ep: ["POST /v1/customer/disputes/{id}/provide-supporting-info"], use: "Send the letter and the packet while PayPal reviews a chargeback", live: true },
  { ep: ["POST /v1/customer/disputes/{id}/accept-claim"], use: "Refund the buyer when the records say they are right", live: true },
  { ep: ["GET /v2/payments/captures/{id}"], use: "Read the payment, with PayPal's own Seller Protection flag", live: true },
  { ep: ["POST /v1/oauth2/token"], use: "Client-credentials OAuth", live: true },
  { ep: ["POST /v1/customer/disputes/{id}/make-offer", "POST /v1/customer/disputes/{id}/send-message"], use: "Offers and messages to the buyer at the inquiry stage", live: false },
  { ep: ["POST /v2/payments/captures/{id}/refund"], use: "Refund first, then file the refund as proof; refund before a claim (Prevention)", live: false },
  { ep: ["POST /v2/checkout/orders/{id}/track"], use: "Push missing tracking to PayPal before a claim (Prevention)", live: false },
  { ep: ["POST /v1/notifications/verify-webhook-signature"], use: "Verify CUSTOMER.DISPUTE webhooks", live: false },
];

const LIMITS = [
  { t: "No store or carrier connectors yet.", d: "Orders, carrier scans, the inbox and checkout signals come from the built-in demo store, in sandbox mode too. Shopify, WooCommerce and carrier APIs are next." },
  { t: "Offers and buyer messages are tested on the simulator only.", d: "PayPal allows them only at the inquiry stage, which sandbox chargebacks skip." },
  { t: "Tracking pushes and capture refunds too.", d: "Both are built and tested against the simulator, and not yet called on the live sandbox." },
  { t: "No webhooks from PayPal yet.", d: "PayPal delivers them only to a public HTTPS address, and nothing is deployed yet." },
  { t: "Sandbox outcomes are not PayPal decisions.", d: "The one resolved sandbox case closed after a sandbox-only call. A real reviewer may rule differently." },
  { t: "No sign-in yet.", d: "Exhibit is a single-merchant app. Don't expose a deployment with live PayPal credentials until authentication sits in front of it." },
];

const cap = (key: string) => CAPABILITIES.find((c) => c.key === key)!;

/** One capability, pinned to the board: a crop of the app (decorative here: the link says where it goes), then its name. */
function Pin({ k, tilt, children }: { k: string; tilt: number; children: React.ReactNode }) {
  const c = cap(k);
  return (
    <Link href={c.href} className={`s-pr-pin s-pr-pin--${k}`} style={{ ["--tilt" as string]: `${tilt}deg` }} aria-label={`${c.label}: ${c.description}`}>
      <div data-ui className="s-ui s-pr-pin__ui" aria-hidden>
        {children}
      </div>
      <span className="s-pr-pin__label">
        <span className="s-pr-pin__name">
          <span className="s-pr-pin__idx">{c.index}</span>
          {c.label}
        </span>
        <span className="s-pr-pin__desc">{c.description}</span>
        <ArrowRight className="s-icon s-pr-pin__arrow" aria-hidden />
      </span>
    </Link>
  );
}

export default function ProductOverviewPage() {
  const kim = REFUNDS.find((r) => r.buyer === "Jordan Kim")!;
  const patel = REFUNDS.find((r) => r.buyer === "Priya Patel")!;
  return (
    <>
      <ProductNav current="overview" />
      <PageHeader
        eyebrow="Product"
        title="One agent for the whole dispute."
        rest="Before it is filed, and after."
        lede="Exhibit watches recent orders for the signs that come before a PayPal dispute, investigates each case that opens, writes the response with every claim cited to a record, and files it through PayPal's own API once you approve. When the buyer is right, it refunds."
        actions={
          <>
            <ButtonLink href={ROUTES.app} arrow>
              Try the live demo
            </ButtonLink>
            <ButtonLink href={ROUTES.contact} variant="ghost">
              Book a demo
            </ButtonLink>
          </>
        }
        aside={<DotArt name="scales" frame className="w-[210px] sm:w-[260px] lg:w-[300px]" />}
      />

      {/* 1. The five capabilities, pinned to Harnett's rack */}
      <Section id="capabilities" labelledBy="capabilities-title">
        <Container>
          <SectionHead aside={<Body>Five capabilities, each shown with a real fragment of the product and the record behind it. Open one to see how it works.</Body>}>
            <Heading id="capabilities-title" title="What Exhibit does," rest="on one board." />
          </SectionHead>
        </Container>
        <Container size="wide">
          <Reveal>
            <figure className="s-figure">
              <Plate painting="harnett" focus={[50, 46]} zoom={1.08} preload className="s-pr-flow" sizes="(max-width: 768px) 100vw, 1376px">
                <div className="s-pr-flow__in" style={{ ["--pad-t" as string]: "88px", ["--pad-x" as string]: "clamp(24px, 5vw, 80px)", ["--pad-b" as string]: "80px", ["--pad-t-m" as string]: "130px" }}>
                  <div className="s-pr-board">
                    <Pin k="investigate" tilt={-0.6}>
                      <BriefCardView summary="none" why={false} risks={false} />
                    </Pin>
                    <Pin k="evidence" tilt={0.7}>
                      <PacketPage paragraphs={0} />
                    </Pin>
                    <Pin k="prevention" tilt={0.5}>
                      <div className="s-f-dr">
                        <DrawerHeadView order={LENA_ORDER} prevented />
                        <DrawerSuccess saved={LENA_DRAWER.saved} fee={LENA_DRAWER.fee} />
                      </div>
                    </Pin>
                    <Pin k="ask" tilt={-0.7}>
                      <AskTurnTop />
                    </Pin>
                    <Pin k="agents" tilt={0.4}>
                      <ApprovalBannerView />
                    </Pin>
                  </div>
                </div>
              </Plate>
              <PlateCaption painting="harnett">
                <b>The product, rebuilt from the app.</b> Records from the PayPal sandbox, except Lena Hoffmann&apos;s order, which is on the demo store. Kora Atelier and its buyers are demo records.
              </PlateCaption>
            </figure>
          </Reveal>
        </Container>
      </Section>

      {/* 2. Fair to buyers */}
      <Section id="fair" tone="band" labelledBy="fair-title">
        <Container>
          <div className="s-pr-fair">
            <div className="s-pr-fair__text">
              <Eyebrow>Fair to buyers</Eyebrow>
              <Heading id="fair-title" title="It refunds when" rest="the buyer is right." />
              <p className="s-lede s-pr-fair__lede">Exhibit&apos;s playbook refunds or offers when the merchant is at fault, and tells the agent never to fight a refund the store owes. On the live sandbox it accepted two claims instead of fighting them, with a letter that says why.</p>
              <p className="s-small s-pr-fair__eval">
                In the evaluation it refunded 9 of 9 cases where the buyer was right. Those were 30 synthetic cases written and labelled by Exhibit&apos;s builders: a check of consistency, not of accuracy on real disputes.
              </p>
              <TextLink href={ROUTES.product.investigate}>How it decides</TextLink>
            </div>
            <div className="s-pr-fair__slips">
              {([
                ["refund", kim],
                ["refund2", patel],
              ] as const).map(([run, r], i) => (
                <Reveal key={r.disputeId} delay={i * 90}>
                  <figure className="s-pr-fair__case">
                    <BriefCard run={run} />
                    <figcaption className="s-pr-fair__filed">
                      <span className="s-mono">accept-claim</span> <StatusCode code={r.status} /> <span className="s-mono">{r.debugId}</span>
                      <span>
                        {r.buyer}, {r.reason.toLowerCase()}, {utc(r.filedAt)} UTC
                      </span>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </Container>
      </Section>

      {/* 3. Built on PayPal's APIs */}
      <Section id="paypal-apis" labelledBy="apis-title">
        <Container>
          <SectionHead aside={<Body>Every call goes through one client that logs its status, latency and PayPal debug id, and never logs a secret. On the live sandbox: {LIVE.calls} calls, {LIVE.ok} returned 2xx, {LIVE.errors} errors, {LIVE.endpoints} endpoints.</Body>}>
            <Eyebrow>Built on PayPal</Eyebrow>
            <Heading id="apis-title" title="Built on PayPal's own APIs." rest="Tested live where allowed." />
          </SectionHead>
          <Reveal className="s-table-wrap">
            <table className="s-table s-pr-apis s-pr-stack">
              <caption className="s-sr-only">The PayPal endpoints Exhibit calls</caption>
              <thead>
                <tr>
                  <th scope="col">Endpoint</th>
                  <th scope="col">What Exhibit uses it for</th>
                  <th scope="col">Live sandbox</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((e) => (
                  <tr key={e.ep[0]}>
                    <td className="s-mono s-pr-apis__ep">
                      {e.ep.map((x) => (
                        <span key={x}>{x}</span>
                      ))}
                    </td>
                    <td>{e.use}</td>
                    <td>{e.live ? <Tag green>Called live</Tag> : <span className="text-[var(--s-muted)]">Simulator only</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3">
            <TextLink href={ROUTES.proof}>Every call on the record</TextLink>
            <TextLink href={ROUTES.docs.api}>The API in the docs</TextLink>
          </div>
        </Container>
      </Section>

      {/* 4. Three ways to run it */}
      <Section id="run" tone="night" labelledBy="run-title">
        <Container>
          <SectionHead aside={<Body>The same code runs in all three. Only where the records and the PayPal calls come from changes.</Body>}>
            <Eyebrow>Run it</Eyebrow>
            <Heading id="run-title" title="Three ways to run it." rest="Nothing needs a key to start." />
          </SectionHead>
          <div className="s-pr-run">
            <Reveal className="s-pr-run__ways">
              <div className="s-pr-run__way">
                <h3 className="s-h s-h--h3">The live demo</h3>
                <p>A built-in PayPal simulator with the real API&apos;s request and response shapes, error codes and file limits, for a fictional store, Kora Atelier. Recorded Claude runs replay and every tool call executes live. A banner says what is real, simulated or recorded, and the demo resets after 20 quiet minutes.</p>
                <ButtonLink href={ROUTES.app} variant="light" arrow>
                  Try the live demo
                </ButtonLink>
              </div>
              <div className="s-pr-run__way">
                <h3 className="s-h s-h--h3">Your PayPal sandbox</h3>
                <p>Create a REST app for a sandbox business account and set its client id and secret. Settings then tests the connection, and Seed the sandbox opens real chargebacks in three steps for Exhibit to answer.</p>
                <TextLink href={ROUTES.docs.sandbox}>The sandbox guide</TextLink>
              </div>
            </Reveal>
            <Reveal delay={90} className="s-pr-run__machine">
              <h3 className="s-h s-h--h3">Your own machine</h3>
              <p>Node.js 24 or newer. Signed in to the Claude CLI, investigations run live on Claude Opus 5.5; with an Anthropic API key, on the Claude API; with neither, recorded runs replay.</p>
              <div data-ui className="s-term s-pr-run__term" role="group" aria-label="Quick start">
                <div className="s-term__bar" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <span>quick start</span>
                </div>
                <div>
                  <span className="p">$ </span>
                  <span className="c">git clone {GITHUB_URL}</span>
                </div>
                <div>
                  <span className="p">$ </span>
                  <span className="c">cd exhibit &amp;&amp; npm install</span>
                </div>
                <div>
                  <span className="p">$ </span>
                  <span className="c">npm run dev</span>
                </div>
                <div>
                  <span className="p"># then open http://localhost:3000/app</span>
                </div>
                <div className="mt-3">
                  <span className="p">$ </span>
                  <span className="c">npm test</span> <span className="p"># 300 tests, no credentials needed</span>
                </div>
              </div>
              <TextLink href={ROUTES.github}>Open source on GitHub, MIT</TextLink>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* 5. What it doesn't do yet */}
      <Section id="limits" labelledBy="limits-title">
        <Container>
          <SectionHead aside={<Body>Exhibit is hackathon software, tested on the PayPal sandbox. These are the gaps its README lists today.</Body>}>
            <Eyebrow>Limits</Eyebrow>
            <Heading id="limits-title" title="What it doesn't do yet." rest="Said plainly." />
          </SectionHead>
          <ul className="s-pr-limits">
            {LIMITS.map((l, i) => (
              <Reveal as="li" key={l.t} delay={(i % 2) * 60}>
                <h3 className="s-pr-limits__t">{l.t}</h3>
                <p className="s-pr-limits__d">{l.d}</p>
              </Reveal>
            ))}
          </ul>
          <div className="mt-8">
            <TextLink href={ROUTES.security}>How Exhibit handles security</TextLink>
          </div>
        </Container>
      </Section>

      <ProductCta
        id="product-cta"
        title="Run a dispute end to end."
        rest="In the live demo, no sign-up."
        lede="Open a case, run Exhibit, read the cited brief and file it with the PayPal simulator. Or book a walkthrough on your own PayPal sandbox."
        art="stamp"
      />
    </>
  );
}
