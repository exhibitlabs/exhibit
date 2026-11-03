import type { Metadata } from "next";
import { Body, ButtonLink, Container, DotArt, Eyebrow, Heading, PageHeader, Plate, PlateCaption, Reveal, ROUTES, Section, SectionHead, StatusCode, TextLink } from "@/components/site";
import { PacketViewer } from "@/components/site/product/PacketViewer";
import { ProductCta } from "@/components/site/product/ProductCta";
import { ProductNav } from "@/components/site/product/ProductNav";
import { ProductPager } from "@/components/site/product/ProductPager";
import { FILINGS, REFUNDS, hhmm, utc, utcDate } from "@/components/site/product/data";
import { EXHIBIT_PAGES, FILING, LETTERHEAD, PACKET_COVER, pdfDate } from "@/components/site/product/filing";
import { PdfFacts, PdfLabel, PdfLetterhead, PdfPage, PdfTitle, type PdfFact } from "@/components/site/packet";
import { productMetadata } from "@/components/site/product/meta";
import { GITHUB_URL } from "@/components/landing/data";

const DESCRIPTION =
  "Exhibit writes the response PayPal's reviewer reads and binds every piece of evidence as a lettered exhibit, rendered from the records themselves. Every citation must resolve before anything is filed.";

export const metadata: Metadata = productMetadata({ title: "Evidence packets", description: DESCRIPTION, path: ROUTES.product.evidencePackets });

/** What each kind of record prints as an exhibit page (src/lib/evidence.ts refs, src/lib/packet/Packet.tsx). */
const REFS = [
  { ref: "shipment:", prints: "The carrier's scan history, the delivery address and signature, and any delivery or packing photo." },
  { ref: "order:", prints: "Line items and totals, the shipping address on the transaction, the billing address and when the buyer accepted the policies." },
  { ref: "listing:", prints: "The product page as the buyer saw it: description, what it disclosed, its photographs." },
  { ref: "msg:  conversation:", prints: "Each message between the store and the buyer, with sender and time." },
  { ref: "risk:", prints: "AVS and CVV results, 3-D Secure, the checkout IP and its distance from the address, the device, email age." },
  { ref: "customer:", prints: "Customer since, orders, lifetime value, prior disputes." },
  { ref: "policy:", prints: "The full policy text, its version, and when the buyer accepted it." },
  { ref: "paypal:seller-protection:", prints: "Each Seller Protection requirement with its status and PayPal's own wording." },
  { ref: "paypal:dispute:  paypal:message:", prints: "The case as PayPal holds it, and the buyer's messages on it." },
];

const kim = REFUNDS.find((r) => r.buyer === "Jordan Kim")!;
/** The cover as the packet prints it for Kim's case. PayPal's response date isn't in the records, so that cell is left out. */
const KIM_FACTS: PdfFact[] = [
  { k: "Reason", v: kim.reason },
  { k: "Stage", v: `Chargeback · code ${kim.reasonCode}` },
  { k: "Amount", v: `$${kim.amount.toFixed(2)}` },
  { k: "Transaction", v: kim.captureId, mono: true },
  { k: "Order", v: kim.orderId, mono: true },
  { k: "Buyer", v: kim.buyer },
  { k: "Opened", v: pdfDate(kim.openedAt) },
];
const patel = REFUNDS.find((r) => r.buyer === "Priya Patel")!;
const failed = FILINGS.filter((f) => f.status >= 400);

export default function EvidencePage() {
  return (
    <>
      <ProductNav current="evidence" />
      <PageHeader
        eyebrow="Evidence packets"
        eyebrowIndex="02"
        title="Exhibit A to F,"
        rest="filed through PayPal."
        lede="Exhibit writes the letter PayPal's reviewer reads and binds each piece of evidence behind it as a lettered exhibit. The packet is rendered from the records themselves, never retyped by the model, and it goes to PayPal through the Disputes API once you approve."
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
        aside={<DotArt name="stamp" frame className="w-[210px] sm:w-[260px] lg:w-[300px]" />}
      />

      {/* 1. The packet as filed, on Mitchell's rack picture */}
      <Section id="packet" labelledBy="packet-title">
        <Container>
          <SectionHead aside={<Body>The response Exhibit filed for the Reyes chargeback on {utcDate(FILING.at)}, word for word, after the merchant approved it. Select an exhibit, in the letter or in the index, to open the page behind it.</Body>}>
            <Heading id="packet-title" title="The letter PayPal received," rest="with every claim lettered." />
          </SectionHead>
        </Container>
        <Container size="wide">
          <Reveal>
            <figure className="s-figure">
              <Plate painting="mitchell" focus={[50, 45]} zoom={1.02} preload className="s-pr-flow" sizes="(max-width: 768px) 100vw, 1376px">
                <div className="s-pr-flow__in" style={{ ["--pad-t" as string]: "96px", ["--pad-x" as string]: "clamp(24px, 5vw, 80px)", ["--pad-b" as string]: "80px", ["--pad-t-m" as string]: "132px" }}>
                  <PacketViewer letter={FILING.letter} exhibits={FILING.exhibits} pages={EXHIBIT_PAGES} facts={PACKET_COVER.facts} headline={FILING.headline} disputeId={FILING.disputeId} dated={PACKET_COVER.date} merchant={LETTERHEAD} />
                </div>
              </Plate>
              <PlateCaption painting="mitchell">
                <b>The response as filed.</b> <span className="s-mono">{FILING.call}</span>, HTTP {FILING.status} in {FILING.ms.toLocaleString("en-US")} ms, PayPal-Debug-Id <span className="s-mono">{FILING.debugId}</span>, {utcDate(FILING.at)} at {hhmm(FILING.at)} UTC. The letter went as the notes and the {FILING.packet.kb} KB packet as a PDF. Kora Atelier is a demo merchant.
              </PlateCaption>
            </figure>
          </Reveal>
        </Container>
      </Section>

      {/* 2. Citations that must resolve */}
      <Section id="citations" tone="band" labelledBy="citations-title">
        <Container>
          <SectionHead aside={<Body>Every tool result carries refs such as shipment:SHP-10503. A brief is rejected unless each ref it cites resolves to a record on this case, and the packet reads every record again from its source when it is rendered.</Body>}>
            <Eyebrow>Citations</Eyebrow>
            <Heading id="citations-title" title="A citation is a record id." rest="No record, no filing." />
          </SectionHead>
          <div className="s-pr-cites">
            <Reveal className="s-pr-cites__trace">
              <div data-ui className="s-ui s-ui-card" role="group" aria-label="The citation check on the filed brief">
                <div className="s-ui-card__head">
                  <div>The check, on the filed brief</div>
                  <span>
                    {FILING.exhibits.length} of {FILING.exhibits.length} resolve
                  </span>
                </div>
                <ul className="s-pr-trace">
                  {FILING.exhibits.map((e) => (
                    <li key={e.label}>
                      <span className="s-ui-exhibit">{e.label}</span>
                      <span className="s-ui-mono s-pr-trace__ref">{e.ref}</span>
                      <span className="s-pr-trace__kind">{e.kind}</span>
                      <span className="s-pr-trace__ok">resolves</span>
                    </li>
                  ))}
                </ul>
                <div className="s-pr-trace__rule">
                  <div className="s-ui-muted">When a ref does not resolve, the check returns</div>
                  <div className="s-ui-mono">Exhibit {"{label}"} cites unknown ref &quot;{"{ref}"}&quot;</div>
                  <div className="s-ui-muted">and the brief goes back to the agent. Nothing is saved or filed until every ref resolves.</div>
                </div>
              </div>
            </Reveal>
            <Reveal delay={80} className="s-pr-cites__refs">
              <h3 className="s-h s-h--h3">What each kind of record prints</h3>
              <p className="s-body">Each exhibit gets its own page, printed from the record its ref points to, with the ref at the top so a reviewer can trace it.</p>
              <div className="s-table-wrap">
                <table className="s-table s-pr-reftable s-pr-stack">
                  <caption className="s-sr-only">Record refs and what the packet prints for each</caption>
                  <thead>
                    <tr>
                      <th scope="col">Ref</th>
                      <th scope="col">The exhibit page prints</th>
                    </tr>
                  </thead>
                  <tbody>
                    {REFS.map((r) => (
                      <tr key={r.ref}>
                        <td className="s-mono s-pr-reftable__ref">
                          {r.ref.split("  ").map((x) => (
                            <span key={x}>{x}</span>
                          ))}
                        </td>
                        <td>{r.prints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* 3. What PayPal's reviewer receives */}
      <Section id="filing" labelledBy="filing-title">
        <Container>
          <SectionHead aside={<Body>Exhibit files through PayPal&apos;s own Disputes API. It sends only the evidence types PayPal asked for, one evidence per call, with the packet as a PDF. While PayPal reviews a chargeback, it sends supporting info.</Body>}>
            <Eyebrow>Filing</Eyebrow>
            <Heading id="filing-title" title="Filed the way PayPal asks." rest="One evidence per call." />
          </SectionHead>
          <div className="s-pr-filing">
            <Reveal className="s-pr-filing__req">
              <div data-ui className="s-term s-pr-http" role="group" aria-label="The Nov 3 filing request and PayPal's response">
                <div className="s-term__bar" aria-hidden>
                  <i />
                  <i />
                  <i />
                  <span>{utc(FILING.at)} UTC · api-m.sandbox.paypal.com</span>
                </div>
                <div className="s-pr-http__line">
                  <span className="y">POST</span> <span className="c">/v1/customer/disputes/{FILING.disputeId}/provide-supporting-info</span>
                </div>
                <div className="s-pr-http__line">
                  <span className="p">Content-Type: multipart/form-data</span>
                </div>
                <div className="s-pr-http__part">
                  <span className="p">input</span>
                  <span className="c">{`{ "notes": "Kora Atelier contests this chargeback: the account holder authorized this purchase and received it. …" }`}</span>
                </div>
                <div className="s-pr-http__part">
                  <span className="p">file</span>
                  <span className="c">
                    {FILING.packet.file} · {FILING.packet.kb} KB
                  </span>
                </div>
                <div className="s-pr-http__resp">
                  <span className="g">← {FILING.status}</span> <span className="p">· {FILING.ms.toLocaleString("en-US")} ms · PayPal-Debug-Id</span> <span className="c">{FILING.debugId}</span>
                </div>
              </div>
              <p className="s-small s-pr-filing__cap">The request as Exhibit&apos;s client sends it (src/lib/paypal/client.ts) and the response as logged. Authorization headers are never stored.</p>
            </Reveal>
            <Reveal delay={80} className="s-pr-routes">
              <div className="s-pr-route">
                <h3 className="s-h s-h--h4">PayPal asked for evidence</h3>
                <p className="s-mono s-pr-route__call">provide-evidence</p>
                <p className="s-body">One evidence of a type PayPal requested, such as proof of fulfillment with the carrier and tracking number, the letter as its notes and the packet attached. Up to 10 MB per file.</p>
              </div>
              <div className="s-pr-route">
                <h3 className="s-h s-h--h4">PayPal is reviewing a chargeback</h3>
                <p className="s-mono s-pr-route__call">provide-supporting-info</p>
                <p className="s-body">The letter as notes, up to 2,000 characters, and the packet. A new chargeback starts under review, when supporting info is the only response open.</p>
              </div>
              <div className="s-pr-route">
                <h3 className="s-h s-h--h4">The buyer is right</h3>
                <p className="s-mono s-pr-route__call">accept-claim</p>
                <p className="s-body">The letter as the note, and PayPal refunds the buyer the disputed amount.</p>
              </div>
            </Reveal>
          </div>

          <div className="s-pr-filed">
            <Reveal className="s-pr-filed__intro">
              <h3 className="s-h s-h--h3">Every response filed on the live sandbox</h3>
              <p className="s-body">
                Seven responses returned 200. The two that failed came first, on Oct 20: several evidences in one call drew a {failed[0].status} and then a {failed[1].status}. Since then Exhibit sends one evidence per call.
              </p>
              <TextLink href={ROUTES.proof}>The full sandbox record</TextLink>
            </Reveal>
            <Reveal delay={70} className="s-table-wrap">
              <table className="s-table s-pr-stack">
                <caption className="s-sr-only">Every dispute response Exhibit filed on the PayPal sandbox</caption>
                <thead>
                  <tr>
                    <th scope="col">Time (UTC)</th>
                    <th scope="col">Dispute</th>
                    <th scope="col">Call</th>
                    <th scope="col">HTTP</th>
                    <th scope="col">PayPal-Debug-Id</th>
                  </tr>
                </thead>
                <tbody>
                  {[...FILINGS].reverse().map((f) => (
                    <tr key={f.debugId}>
                      <td className="s-mono">{utc(f.at)}</td>
                      <td className="s-mono">{f.disputeId}</td>
                      <td className="s-mono">{f.call}</td>
                      <td>
                        <StatusCode code={f.status} />
                      </td>
                      <td className="s-mono">{f.debugId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* 4. Refunds get a letter too */}
      <Section id="refunds" tone="night" labelledBy="refunds-title">
        <Container>
          <div className="s-pr-refund">
            <div className="s-pr-refund__text">
              <Eyebrow>When the buyer is right</Eyebrow>
              <Heading id="refunds-title" title="Refunds get a letter too." rest="Same check, same record." />
              <p className="s-lede s-pr-refund__lede">
                A refund goes through the same citation check and the same log. The letter tells PayPal why the merchant accepts and cites its exhibits, and the claim is accepted in full.
              </p>
              <ul className="s-pr-refund__facts">
                <li>
                  <span className="s-mono">accept-claim</span> <StatusCode code={kim.status} /> <span className="s-mono">{kim.debugId}</span>
                  <span className="s-pr-refund__when">
                    {kim.buyer}, ${kim.amount}, {utc(kim.filedAt)} UTC
                  </span>
                </li>
                <li>
                  <span className="s-mono">accept-claim</span> <StatusCode code={patel.status} /> <span className="s-mono">{patel.debugId}</span>
                  <span className="s-pr-refund__when">
                    {patel.buyer}, ${patel.amount}, {utc(patel.filedAt)} UTC: her return arrived and was never refunded
                  </span>
                </li>
              </ul>
            </div>
            <Reveal delay={90} className="s-pr-refund__sheet">
              <div data-ui className="s-ui s-ui-sheet s-ui-sheet--paper s-pr-kim" role="group" aria-label={`The refund letter filed for ${kim.buyer}, on the packet's cover page`}>
                <PdfPage merchant={LETTERHEAD} disputeId={kim.disputeId} className="s-pdf--narrow" footer={false}>
                  <PdfLetterhead merchant={LETTERHEAD} disputeId={kim.disputeId} date={pdfDate(kim.filedAt)} />
                  <PdfTitle disputeId={kim.disputeId} headline={kim.headline} />
                  <PdfFacts facts={KIM_FACTS} />
                  <div className="s-pdf__sec">
                    <PdfLabel>Merchant&apos;s response</PdfLabel>
                    <div className="s-pdf__letter">
                      <p>{kim.letter}</p>
                    </div>
                  </div>
                  <div>
                    <PdfLabel>Exhibits</PdfLabel>
                    <div className="s-pdf__index">
                      {kim.exhibitList.map((e) => (
                        <div key={e.label} className="s-pdf__xrow">
                          <b>{e.label}</b>
                          <span>
                            <span className="s-pdf__xt">{e.title}</span>
                            <span className="s-pdf__small">{e.why}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </PdfPage>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      <ProductPager current="evidence" />
      <ProductCta
        id="evidence-cta"
        title="Build a packet yourself."
        rest="In the live demo."
        lede="Open a case in the live demo, read the response, page through the evidence packet and file it with the PayPal simulator. No sign-up."
        art="letter"
        note={
          <>
            The packet code is open source:{" "}
            <a className="underline decoration-[var(--s-line-2)] underline-offset-4 hover:decoration-[var(--s-ink)]" href={`${GITHUB_URL}/blob/main/src/lib/packet/Packet.tsx`} target="_blank" rel="noopener noreferrer">
              src/lib/packet<span className="s-sr-only"> (opens in a new tab)</span>
            </a>
            .
          </>
        }
      />
    </>
  );
}
