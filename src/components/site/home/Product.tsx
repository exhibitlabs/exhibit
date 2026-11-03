import { TextLink } from "../actions";
import { ASK, fmtDate, fmtDateTime, PAYPAL_MCP_QUOTE, PREVENTION, REYES, usd } from "../facts";
import { AskAnswer, AtRiskCard, BriefSheet, BuyerReply, McpLines, PacketPage, ApprovalCard } from "../fragments";
import { Container, Section, SectionHead } from "../layout";
import { ROUTES } from "../nav";
import { PlateCaption, PlateOverlay, PlateStage } from "../Plate";
import { Facts } from "../records";
import { Reveal } from "../Reveal";
import { Body, Eyebrow, Heading, Mono } from "../type";
import { Terminal, UiSheet, UiWindow } from "../ui";

const PRODUCT = [
  { id: "investigate", idx: "01", label: "Investigate" },
  { id: "evidence-packets", idx: "02", label: "Evidence packets" },
  { id: "prevention", idx: "03", label: "Prevention" },
  { id: "ask-exhibit", idx: "04", label: "Ask Exhibit" },
  { id: "ai-agents", idx: "05", label: "For AI agents" },
];

function ProductIndex() {
  return (
    <nav className="s-prodnav" aria-label="Product">
      <span className="s-prodnav__lbl">Product</span>
      <ul>
        {PRODUCT.map((p) => (
          <li key={p.id}>
            <a href={`#${p.id}`}>
              <span className="s-num">{p.idx}</span>
              {p.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Investigate() {
  const b = REYES.brief;
  return (
    <div id="investigate" className="s-split s-anchor" aria-labelledby="investigate-title" role="region">
      <div className="s-split__txt">
        <Eyebrow index="01">Investigate</Eyebrow>
        <Heading id="investigate-title" title="Eight sources." rest="One cited decision." />
        <Body className="s-split__body">Exhibit reads the dispute, the order, the carrier scans, the buyer&apos;s history and messages, the checkout signals, the store policies and PayPal Seller Protection. Then it decides: fight, offer, refund or message the buyer. Every reason points to the record it came from.</Body>
        <Facts
          items={[
            { k: "Delivery", v: "UPS, signed for by D REYES at the transaction address" },
            { k: "Checkout", v: "3-D Secure authenticated, AVS and CVV matched" },
            { k: "Buyer", v: "“Briefcase arrived, it’s beautiful”" },
            { k: "Decision", v: `Fight, ${b.winLikelihood}% likely to win, ${b.exhibits.length} exhibits` },
          ]}
        />
        <TextLink href={ROUTES.product.investigate} className="s-split__link">
          How Exhibit investigates
        </TextLink>
      </div>
      <Reveal className="s-split__fig" delay={140}>
        <figure className="s-figure">
          <PlateStage painting="petoOfficeBoard" focus={[50, 51]} zoom={1.02} height={760} mobile={{ height: 300, focus: [62, 22], zoom: 1.5 }} sizes="(max-width: 767px) 150vw, (max-width: 1440px) 62vw, 880px">
            <PlateOverlay left="4.7%" top="262px" width="64%">
              <UiSheet label={`Exhibit's brief: ${b.headline}`} className="s-sheet-clip-760">
                <BriefSheet />
              </UiSheet>
            </PlateOverlay>
          </PlateStage>
          <PlateCaption painting="petoOfficeBoard" even>
            <b>The cited decision.</b> A recorded Claude run on the sandbox chargeback, {fmtDate(REYES.run.startedAt)}, {(REYES.run.durationMs / 1000).toFixed(1)} s.
          </PlateCaption>
        </figure>
      </Reveal>
    </div>
  );
}

function Packets() {
  const f = REYES.lastFiling;
  return (
    <div id="evidence-packets" className="s-split s-split--flip s-anchor" aria-labelledby="packets-title" role="region">
      <div className="s-split__txt">
        <Eyebrow index="02">Evidence packets</Eyebrow>
        <Heading id="packets-title" title="Exhibit A to F," rest="filed through PayPal." />
        <Body className="s-split__body">Exhibit writes the response letter and binds each piece of evidence as a lettered exhibit. Every claim in the letter cites its exhibit. Every exhibit resolves to a real record, or the packet is not filed.</Body>
        <Facts
          items={[
            { k: "Call", v: <Mono>provide-supporting-info</Mono> },
            {
              k: "PayPal",
              v: (
                <>
                  HTTP {f.status}, debug id <Mono>{f.debugId}</Mono>
                </>
              ),
            },
            { k: "Status", v: `Under review by PayPal, checked ${fmtDate(REYES.checkedAt)}` },
          ]}
        />
        <TextLink href={ROUTES.product.evidencePackets} className="s-split__link">
          How a packet is built
        </TextLink>
      </div>
      <Reveal className="s-split__fig" delay={140}>
        <figure className="s-figure">
          <PlateStage painting="mitchell" focus={[50, 19]} zoom={1.04} height={780} mobile={{ height: 300, focus: [50, 12], zoom: 1.3 }} sizes="(max-width: 767px) 150vw, (max-width: 1440px) 62vw, 880px">
            <PlateOverlay left="23.6%" top="128px" width="55.4%">
              <UiSheet paper label={`The evidence packet's cover page for dispute ${REYES.id}, exhibits A to F`}>
                <PacketPage />
              </UiSheet>
            </PlateOverlay>
          </PlateStage>
          <PlateCaption painting="mitchell" even>
            <b>The packet&apos;s cover page, as PayPal received it.</b> The letter cites six exhibits, each one traced to the record a tool returned. Filed {fmtDateTime(f.at)}.
          </PlateCaption>
        </figure>
      </Reveal>
    </div>
  );
}

function Prevention() {
  const s = PREVENTION.save;
  return (
    <div id="prevention" className="s-anchor" aria-labelledby="prevention-title" role="region">
      <Container>
        <SectionHead
          aside={
            <>
              <Body>Exhibit scores recent orders for the signals that come before a PayPal case: stalled tracking, a waiting buyer, an overdue refund. Then it fixes them. Tracking goes to PayPal, refunds go out, buyers get an answer.</Body>
              <TextLink href={ROUTES.product.prevention} className="s-split__link">
                How prevention works
              </TextLink>
            </>
          }
        >
          <Eyebrow index="03">Prevention</Eyebrow>
          <Heading id="prevention-title" title="Stops disputes before they are filed." rest="In the buyer's own language." />
        </SectionHead>
      </Container>
      <Reveal>
        <figure className="s-figure">
          <Container size="wide">
            <PlateStage painting="sommar" stageClassName="s-stage--late s-stage--tall" focus={[50, 27.5]} zoom={1} height={640} mobile={{ height: 300, focus: [40, 40], zoom: 1.4 }} sizes="(max-width: 767px) 150vw, (max-width: 1440px) 96vw, 1376px">
              <PlateOverlay left="8.7%" top="118px" width="37%">
                <UiSheet label={`At-risk order ${s.orderId}, ${s.buyer}, risk ${s.fix.before.score} of 100: buyer waiting, tracking stalled. Prevented.`}>
                  <AtRiskCard />
                </UiSheet>
              </PlateOverlay>
              <PlateOverlay left="54.4%" top="176px" width="36.4%">
                <UiSheet label={`Exhibit's reply to ${s.buyer}, in German`}>
                  <BuyerReply />
                </UiSheet>
              </PlateOverlay>
            </PlateStage>
          </Container>
          <Container>
            <PlateCaption painting="sommar">
              <b>Prevention.</b> A German buyer about to open a case. Exhibit answered in German with the DHL scan history and a plan, and the case was never opened: risk {s.fix.before.score} to {s.fix.after.score}, {usd(s.fix.saved, 0)} kept. Demo merchant, PayPal simulator.
            </PlateCaption>
          </Container>
        </figure>
      </Reveal>
    </div>
  );
}

function Ask() {
  const fight = ASK.answer.cases.filter((c) => c.decision === "FIGHT").length;
  const refund = ASK.answer.cases.filter((c) => c.decision === "REFUND").length;
  const total = ASK.answer.cases.reduce((n, c) => n + c.amount, 0);
  const words = ["no", "one", "two", "three", "four"];
  return (
    <div id="ask-exhibit" className="s-split s-anchor" aria-labelledby="ask-title" role="region">
      <div className="s-split__txt">
        <Eyebrow index="04">Ask Exhibit</Eyebrow>
        <Heading id="ask-title" title="Ask the whole dispute book a question." />
        <Body className="s-split__body">Plain questions, answered from your own records: what is at stake, what is due, what Exhibit recommends and why. Read-only, with every number traced back to a case.</Body>
        <Facts
          items={[
            { k: "Asked", v: `“${ASK.question}”` },
            { k: "Answer", v: `${usd(total, 0)} across ${ASK.answer.cases.length} open disputes, in ${(ASK.ms / 1000).toFixed(1)} s` },
            { k: "Calls", v: `Fight ${words[fight] ?? fight}. Refund ${words[refund] ?? refund}.` },
          ]}
        />
        <TextLink href={ROUTES.product.askExhibit} className="s-split__link">
          How Ask Exhibit works
        </TextLink>
      </div>
      <Reveal className="s-split__fig" delay={140}>
        <figure className="s-figure">
          <PlateStage painting="petoOldSouvenirs" focus={[84, 87]} zoom={1.065} height={760} mobile={{ height: 300, focus: [50, 30], zoom: 1.2 }} sizes="(max-width: 767px) 150vw, (max-width: 1440px) 62vw, 900px">
            <PlateOverlay left="32.9%" top="86px" width="63.9%">
              <UiWindow label={`Ask Exhibit answer: ${usd(total, 0)} at stake across ${ASK.answer.cases.length} open disputes`}>
                <AskAnswer height={560} />
              </UiWindow>
            </PlateOverlay>
          </PlateStage>
          <PlateCaption painting="petoOldSouvenirs" even>
            <b>Ask Exhibit.</b> A recorded answer over the sandbox dispute book, {fmtDate(ASK.capturedAt)}. PayPal makes the final call on all three.
          </PlateCaption>
        </figure>
      </Reveal>
    </div>
  );
}

function Agents() {
  return (
    <Section id="ai-agents" tone="band" labelledBy="agents-title" className="s-anchor">
      <Container>
        <div className="s-agents">
          <div className="s-agents__txt">
            <Eyebrow index="05">For AI agents</Eyebrow>
            <Heading id="agents-title" title="Agents request." rest="Merchants approve." />
            <Body className="s-split__body">Exhibit runs as an MCP server. Claude, ChatGPT or an agent built on PayPal&apos;s Agent Toolkit can triage, investigate and pull evidence packets. Anything that would reach PayPal or a buyer waits for you, and approving runs the same code as your own button.</Body>
            <blockquote className="s-quote">
              <p>&ldquo;{PAYPAL_MCP_QUOTE.text}&rdquo;</p>
              <footer>
                PayPal Developer Blog,{" "}
                <a href={PAYPAL_MCP_QUOTE.url} target="_blank" rel="noopener noreferrer">
                  {PAYPAL_MCP_QUOTE.title}
                  <span className="s-sr-only"> (opens in a new tab)</span>
                </a>
                , {PAYPAL_MCP_QUOTE.date}. Exhibit holds money to the same rule.
              </footer>
            </blockquote>
            <div className="s-agents__links">
              <TextLink href={ROUTES.product.aiAgents}>Exhibit for AI agents</TextLink>
              <TextLink href={ROUTES.docs.mcp}>Read the MCP guide</TextLink>
            </div>
          </div>
          <Reveal className="s-agents__ui" delay={140}>
            <div className="s-agents__cards">
              <ApprovalCard decided={false} />
            </div>
            <Terminal title="exhibit · mcp" label="The MCP tool flow behind the Nov 3 filing">
              <McpLines />
            </Terminal>
            <p className="s-small">Nine MCP tools. None of them files with PayPal, moves money or messages a buyer on its own. The transcript shows the tool flow behind the {fmtDate(REYES.lastFiling.at)} filing.</p>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

export function ProductSections() {
  return (
    <>
      <Section id="product" labelledBy="product-title" className="s-product">
        <Container>
          <h2 id="product-title" className="s-sr-only">
            The product
          </h2>
          <ProductIndex />
          <div className="s-product__stack">
            <Investigate />
            <Packets />
          </div>
        </Container>
        <div className="s-product__wide">
          <Prevention />
        </div>
        <Container>
          <Ask />
        </Container>
      </Section>
      <Agents />
    </>
  );
}
