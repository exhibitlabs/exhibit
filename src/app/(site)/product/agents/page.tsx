import type { Metadata } from "next";
import { User } from "lucide-react";
import { Body, ButtonLink, Container, CTA, DotArt, Eyebrow, Heading, PageHeader, Plate, PlateCaption, Reveal, ROUTES, Section, SectionHead, TextLink } from "@/components/site";
import { ConfigTabs, type ConfigTab } from "@/components/site/product/ConfigTabs";
import { ProductCta } from "@/components/site/product/ProductCta";
import { ProductNav } from "@/components/site/product/ProductNav";
import { ProductPager } from "@/components/site/product/ProductPager";
import { seconds, utcDate } from "@/components/site/product/data";
import { ActivityEvent, ApprovalBannerView } from "@/components/site/fragments";
import { FILING } from "@/components/site/product/filing";
import { productMetadata } from "@/components/site/product/meta";
import { GITHUB_URL, PAYPAL_AGENT_TOOLS, PAYPAL_MCP_QUOTE } from "@/components/landing/data";

const DESCRIPTION =
  "Exhibit ships an MCP server with nine tools, so Claude, ChatGPT or an agent built on PayPal's Agent Toolkit can triage and prepare PayPal disputes. Agents request, merchants approve, and nothing reaches PayPal until the merchant says so.";

export const metadata: Metadata = productMetadata({ title: "For AI agents", description: DESCRIPTION, path: ROUTES.product.aiAgents });

const A = FILING.approval;
const sec = (iso: string) => iso.slice(11, 19);

/** Nov 3, 2026, UTC: the app's activity log and the call log (records/proof.json) for this one filing. */
const TIMELINE = [
  { at: FILING.run.startedAt, what: "The case is run again from the app", detail: `${FILING.disputeId} · Claude Opus 5.5 on the Claude CLI` },
  { at: "2026-11-03T02:35:28.665Z", what: `Brief ready: Fight, ${FILING.run.winLikelihood}%, ${FILING.run.exhibits} exhibits`, detail: `${seconds(FILING.run.durationMs)} · the citation and action checks pass` },
  { at: A.requestedAt, what: `${A.client} asks for approval over MCP`, detail: `request_dispute_action → ${A.id}, pending`, agent: true },
  { at: A.approvedAt, what: "The merchant approves it in Exhibit", detail: "Same-origin request from the app" },
  { at: FILING.reread.at, what: "Exhibit reads the dispute again from PayPal", detail: `GET ${FILING.reread.status} · ${FILING.reread.debugId}` },
  { at: FILING.at, what: "Filed with PayPal, logged under the agent's name", detail: `${FILING.call} · ${FILING.status} in ${FILING.ms.toLocaleString("en-US")} ms · ${FILING.debugId}`, filed: true },
  { at: FILING.after.at, what: "Status read back from PayPal: under review", detail: `GET ${FILING.after.status} · ${FILING.after.debugId}` },
];

/** The nine MCP tools (mcp/server.ts, README). */
const TOOLS: { name: string; does: string; asks?: boolean }[] = [
  { name: "list_disputes", does: "Open cases, sorted by deadline, with Exhibit's call and win likelihood." },
  { name: "investigate_dispute", does: "Runs the Exhibit agent on one case and returns the cited brief. Takes about 10 to 90 seconds. Files nothing." },
  { name: "get_case_brief", does: "The latest brief, without a new run." },
  { name: "get_evidence_packet", does: "The URL of the PDF packet Exhibit would file." },
  { name: "get_prevention_report", does: "Orders likely to become disputes, with risk scores and fixes." },
  { name: "get_overview", does: "Recovered, at risk, win rate and the dispute rate against card-network thresholds." },
  { name: "request_dispute_action", does: "Queues the brief's PayPal action for the merchant's approval and returns a link.", asks: true },
  { name: "request_prevention_fix", does: "Queues a prevention fix for the merchant's approval.", asks: true },
  { name: "get_approval_status", does: "Pending, approved with PayPal's result, rejected, failed or expired." },
];

const SERVER = "/path/to/exhibit/mcp/server.ts";
const URL = "http://localhost:3000";
const exhibit = { command: "node", args: [SERVER], env: { EXHIBIT_URL: URL } };
// The app's three configs and the note under each (src/components/app/AgentApprovals.tsx, AgentConnectCard).
const CONFIGS: ConfigTab[] = [
  { id: "desktop", label: "Claude Desktop", code: JSON.stringify({ mcpServers: { exhibit } }, null, 2), note: "Add it to claude_desktop_config.json (Settings, Developer, Edit config) and restart Claude." },
  { id: "code", label: "Claude Code", code: `claude mcp add exhibit -e EXHIBIT_URL=${URL} -- node ${SERVER}`, note: "Run once in a terminal; new Claude Code sessions pick it up. Try: “Triage my open PayPal disputes and get the strongest one ready to file.”" },
  { id: "paypal", label: "With PayPal's MCP", code: JSON.stringify({ mcpServers: { paypal: { command: "npx", args: ["-y", "@paypal/mcp", "--tools=all"], env: { PAYPAL_ACCESS_TOKEN: "<sandbox access token>", PAYPAL_ENVIRONMENT: "SANDBOX" } }, exhibit } }, null, 2), note: "Both servers side by side: PayPal's for payments, invoices and tracking, Exhibit's for disputes. Agents are told to prefer Exhibit over accept_dispute_claim, which concedes the case." },
];

/** The approval states and how the app labels them (src/components/app/AgentApprovals.tsx). */
const STATES = [
  { chip: "Waiting for you", tone: "outline", what: "The request sits on the case page and in Agent requests until the merchant decides." },
  { chip: "Approved, sent", tone: "green", what: "Exhibit ran the action and keeps PayPal's result with the request." },
  { chip: "Rejected", tone: "neutral", what: "Nothing was sent. The agent sees it was declined." },
  { chip: "Failed", tone: "red", what: "Approved, but PayPal refused it. The error is kept." },
  { chip: "Expired", tone: "neutral", what: "The case was investigated again before approval, so the request no longer matches the brief. Nothing was sent." },
];

/** The recorded triage on the demo store (docs/MCP_DEMO.md, Oct 20, 2026). */
const TRIAGE = [
  { id: "PP-D-50219", buyer: "Reyes", amount: 420, due: "Oct 21", call: "Fight", pct: 88, note: "Already filed, PayPal reviewing" },
  { id: "PP-D-50227", buyer: "Brooks", amount: 96, due: "Oct 22", call: "Fight", pct: 78, note: "Not a duplicate: a gift for his brother" },
  { id: "PP-D-50211", buyer: "Hale", amount: 284, due: "Oct 28", call: "Fight", pct: 88, note: "Queued for the merchant's approval", queued: true },
  { id: "PP-D-50240", buyer: "Ortiz", amount: 355, due: "Oct 28", call: "Offer a replacement", pct: 20, note: "Strap ring cracked in transit" },
  { id: "PP-D-50214", buyer: "Grant", amount: 166, due: "Oct 29", call: "Offer a refund on return", pct: 35, note: "Colour as listed, inside the return window" },
  { id: "PP-D-50223", buyer: "Kim", amount: 68, due: "Oct 29", call: "Refund", pct: 5, note: "Returned to sender, no proof of delivery" },
  { id: "PP-D-50231", buyer: "Patel", amount: 180, due: "Oct 29", call: "Refund", pct: 3, note: "Return arrived, never refunded" },
  { id: "PP-D-50236", buyer: "Vogel", amount: 236, due: "Oct 30", call: "Message the buyer", pct: 80, note: "Waiting in a DHL Packstation" },
];

export default function AgentsPage() {
  return (
    <>
      <ProductNav current="agents" />
      <PageHeader
        eyebrow="For AI agents"
        eyebrowIndex="05"
        title="Agents request."
        rest="Merchants approve."
        lede="Exhibit runs as an MCP server. Claude, ChatGPT or an agent built on PayPal's Agent Toolkit can list cases, run an investigation and pull the evidence packet. Anything that would reach PayPal or a buyer becomes a request that waits for the merchant, and approving it runs the same code as the merchant's own button."
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
        aside={<DotArt name="terminal" frame className="w-[210px] sm:w-[260px] lg:w-[300px]" />}
      />

      {/* 1. The real Nov 3 run, on Hoogstraten's dark board */}
      <Section id="nov3" tone="night" labelledBy="nov3-title">
        <Container>
          <SectionHead
            aside={
              <Body>
                On {utcDate(FILING.at)}, Claude Code, connected through Exhibit&apos;s MCP server, asked to send the Reyes packet to PayPal&apos;s chargeback review. The merchant approved it in Exhibit. Exhibit read the dispute again from PayPal, then filed, and PayPal answered {FILING.status}.
              </Body>
            }
          >
            <Eyebrow>On the live sandbox</Eyebrow>
            <Heading id="nov3-title" title="An agent asked to file." rest="The merchant approved it." />
          </SectionHead>
        </Container>
        <Container size="wide">
          <Reveal>
            <figure className="s-figure">
              <Plate painting="hoogstraten" focus={[50, 40]} zoom={1.05} preload className="s-pr-flow" sizes="(max-width: 768px) 100vw, 1376px">
                <div className="s-pr-flow__in" style={{ ["--pad-t" as string]: "96px", ["--pad-x" as string]: "clamp(24px, 5vw, 88px)", ["--pad-b" as string]: "88px", ["--pad-t-m" as string]: "150px" }}>
                  <div className="s-pr-nov3">
                    <div className="s-pr-nov3__cards">
                      <div data-ui className="s-ui s-pr-banner" role="group" aria-label="The agent request, as the merchant saw it on the case page">
                        <ApprovalBannerView />
                      </div>
                      <div data-ui className="s-ui s-ui-sheet s-pr-decided" role="group" aria-label="The decision and the filing, in PayPal activity filtered to the merchant">
                        <ol className="s-f-act">
                          <ActivityEvent icon={User} strong title="Sent supporting info with a 6-exhibit packet" actor="Claude Code, approved by merchant" disputeId={FILING.disputeId} at={FILING.at} />
                          <ActivityEvent icon={User} strong title={`Merchant approved ${A.client}'s request: ${A.title} on ${FILING.disputeId}`} actor="Merchant" disputeId={FILING.disputeId} at={A.approvedAt} />
                        </ol>
                      </div>
                    </div>
                    <div data-ui className="s-ui s-ui-sheet s-ui-sheet--paper s-pr-log" role="group" aria-label="What happened, second by second">
                      <div className="s-pr-log__head">
                        <span>Nov 3, 2026 · UTC</span>
                        <span className="s-ui-mono">{A.id}</span>
                      </div>
                      <ol className="s-pr-log__list">
                        {TIMELINE.map((e) => (
                          <li key={e.at} className={e.filed ? "is-filed" : e.agent ? "is-agent" : undefined}>
                            <span className="s-ui-mono s-pr-log__at">{sec(e.at)}</span>
                            <span className="s-pr-log__dot" aria-hidden />
                            <div>
                              <div className="s-pr-log__what">{e.what}</div>
                              <div className="s-ui-mono s-pr-log__detail">{e.detail}</div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>
              </Plate>
              <PlateCaption painting="hoogstraten">
                <b>The request and the filing, rebuilt from Exhibit&apos;s records.</b> Approval <span className="s-mono">{A.id}</span> on the PayPal sandbox chargeback <span className="s-mono">{FILING.disputeId}</span>. The store and the buyer are demo records; the calls to PayPal are real.
              </PlateCaption>
            </figure>
          </Reveal>
        </Container>
      </Section>

      {/* 2. The nine tools */}
      <Section id="tools" labelledBy="tools-title">
        <Container>
          <SectionHead aside={<Body>Seven tools read or investigate. Two queue a request for the merchant. The server talks to a running Exhibit over HTTP and holds no PayPal credentials of its own.</Body>}>
            <Eyebrow>The MCP server</Eyebrow>
            <Heading id="tools-title" title="Nine tools." rest="None of them files on its own." />
          </SectionHead>
          <div className="s-pr-mcp">
            <Reveal className="s-table-wrap">
              <table className="s-table s-pr-mcp__table s-pr-stack">
                <caption className="s-sr-only">The nine tools on Exhibit&apos;s MCP server</caption>
                <thead>
                  <tr>
                    <th scope="col">Tool</th>
                    <th scope="col">What it does</th>
                    <th scope="col">Reaches PayPal or a buyer</th>
                  </tr>
                </thead>
                <tbody>
                  {TOOLS.map((t) => (
                    <tr key={t.name} className={t.asks ? "s-pr-mcp__ask" : undefined}>
                      <td className="s-mono">{t.name}</td>
                      <td>{t.does}</td>
                      <td>{t.asks ? <span className="s-pr-chip s-pr-chip--ink">Only after you approve</span> : <span className="text-[var(--s-muted)]">Never</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
            <Reveal delay={80} className="s-pr-mcp__side">
              <h3 className="s-h s-h--h4">Also on the server</h3>
              <p className="s-body">
                A resource, <span className="s-mono">exhibit://disputes/open</span>, with the open disputes as JSON, and a prompt, <span className="s-mono">triage_disputes</span>: list the cases, investigate the urgent ones, rank them by expected recovery and ask for approval on the strongest.
              </p>
              <h3 className="s-h s-h--h4 mt-7">What the agent is told</h3>
              <blockquote className="s-pr-mcp__quote">Give the merchant the approval_url and do not claim the action is done until get_approval_status says approved.</blockquote>
              <p className="s-small">From the server&apos;s instructions to every client that connects.</p>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* 3. Alongside PayPal's own MCP server */}
      <Section id="paypal" tone="band" labelledBy="paypal-title">
        <Container>
          <SectionHead aside={<Body>PayPal&apos;s agent tools can list disputes, read one and accept a claim, which resolves it in the buyer&apos;s favor. Exhibit runs beside them and does the part in between: it decides whether to fight and builds the evidence.</Body>}>
            <Eyebrow>With PayPal&apos;s MCP</Eyebrow>
            <Heading id="paypal-title" title="Next to PayPal's own server." rest="One config, both sets of tools." />
          </SectionHead>
          <div className="s-pr-pp">
            <Reveal className="s-pr-pp__tools">
              <h3 className="s-h s-h--h4">PayPal&apos;s dispute tools, quoted</h3>
              <ul className="s-pr-pp__list">
                {PAYPAL_AGENT_TOOLS.tools.map((t) => (
                  <li key={t.name}>
                    <span className="s-mono">{t.name}</span>
                    <span>&ldquo;{t.description}&rdquo;</span>
                  </li>
                ))}
              </ul>
              <p className="s-small">
                PayPal&apos;s agent tools reference, retrieved {utcDate(`${PAYPAL_AGENT_TOOLS.retrieved}T12:00:00Z`)}.
              </p>
              <h3 className="s-h s-h--h4 mt-8">What Exhibit tells an agent that has both</h3>
              <blockquote className="s-pr-mcp__quote">If PayPal&apos;s own MCP server (@paypal/mcp) is also connected, prefer Exhibit for disputes: PayPal&apos;s accept_dispute_claim concedes the case and refunds the buyer, while Exhibit decides whether to fight and builds the evidence.</blockquote>
            </Reveal>
            <Reveal delay={80} className="s-pr-pp__config">
              <ConfigTabs tabs={CONFIGS} />
              <p className="s-small s-pr-pp__cap">
                Start Exhibit, then point the client at <span className="s-mono">mcp/server.ts</span>. In the app, Settings shows these configs with your own path filled in.
              </p>
              <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
                <TextLink href={ROUTES.docs.mcp}>Read the MCP guide</TextLink>
                <TextLink href={`${GITHUB_URL}/blob/main/mcp/server.ts`}>Read the server</TextLink>
              </div>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* 4. The same rule PayPal uses */}
      <Section id="rule" labelledBy="rule-title">
        <Container>
          <div className="s-pr-rule">
            <Reveal className="s-pr-rule__quote">
              <Eyebrow>The approval gate</Eyebrow>
              <h2 id="rule-title" className="s-sr-only">
                The same rule PayPal uses
              </h2>
              <figure>
                <blockquote>&ldquo;{PAYPAL_MCP_QUOTE.text}&rdquo;</blockquote>
                <figcaption>
                  PayPal Developer Blog,{" "}
                  <a href={PAYPAL_MCP_QUOTE.url} target="_blank" rel="noopener noreferrer">
                    {PAYPAL_MCP_QUOTE.title}
                    <span className="s-sr-only"> (opens in a new tab)</span>
                  </a>
                  , {PAYPAL_MCP_QUOTE.date}
                </figcaption>
              </figure>
              <p className="s-lede">Exhibit holds money to the same rule. When the merchant approves, it reads the dispute again from PayPal and checks that the request still matches the latest brief. If the case was investigated again in between, the request expires and nothing is filed.</p>
              <p className="s-body">Approvals are accepted only from the app itself, never from the agent&apos;s side, and every action is logged under the agent&apos;s name. Autopilot never acts on a run an outside agent started.</p>
            </Reveal>
            <Reveal delay={80} className="s-pr-rule__states">
              <h3 className="s-h s-h--h4">Every request ends in one of five states</h3>
              <ul className="s-pr-states">
                {STATES.map((s) => (
                  <li key={s.chip}>
                    <span className={`s-pr-chip s-pr-chip--${s.tone}`}>{s.chip}</span>
                    <span className="s-pr-states__what">{s.what}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Container>
      </Section>

      {/* 5. A recorded triage, demo store */}
      <Section id="triage" labelledBy="triage-title">
        <Container>
          <SectionHead aside={<Body>A recorded run on the demo store, Oct 20, 2026: Claude Opus 5.5 with only Exhibit&apos;s MCP server attached. No other tools, no files, no shell. It read every case, ranked them and asked for approval on the strongest one.</Body>}>
            <Eyebrow>A recorded triage</Eyebrow>
            <Heading id="triage-title" title="Eight disputes, triaged." rest="One queued, nothing filed." />
          </SectionHead>
          <div className="s-pr-triage">
            <Reveal className="s-pr-triage__talk">
              <div data-ui className="s-ui s-ui-card" role="group" aria-label="The triage, in brief">
                <div className="s-ui-card__head">
                  <div>Claude, with only Exhibit&apos;s MCP server</div>
                  <span>57 s · 10 tool calls</span>
                </div>
                <ol className="s-pr-talk">
                  <li>
                    <span className="s-pr-talk__who">Merchant</span>
                    <span>Triage my open PayPal disputes and get the strongest one ready to file.</span>
                  </li>
                  <li className="is-call">
                    <span className="s-pr-talk__who">tool</span>
                    <span className="s-ui-mono">list_disputes</span>
                  </li>
                  <li className="is-call">
                    <span className="s-pr-talk__who">tool</span>
                    <span className="s-ui-mono">get_case_brief · investigate_dispute ×7</span>
                  </li>
                  <li className="is-call">
                    <span className="s-pr-talk__who">tool</span>
                    <span className="s-ui-mono">request_dispute_action PP-D-50211</span>
                  </li>
                  <li className="is-result">
                    <span className="s-pr-talk__who">Exhibit</span>
                    <span className="s-ui-mono">apv_4e8074d6db · pending · moves_money: false</span>
                  </li>
                  <li>
                    <span className="s-pr-talk__who">Claude</span>
                    <span>I&apos;ve triaged all 8 open disputes ($1,805 total) and set up the strongest one for filing. Nothing has been filed yet. It goes to PayPal only once you approve it.</span>
                  </li>
                </ol>
              </div>
              <p className="s-small s-pr-triage__cap">
                Demo mode: the PayPal simulator and recorded Exhibit runs. 11 turns, $0.27.{" "}
                <a className="underline decoration-[var(--s-line-2)] underline-offset-4 hover:decoration-[var(--s-ink)]" href={`${GITHUB_URL}/blob/main/docs/MCP_DEMO.md`} target="_blank" rel="noopener noreferrer">
                  Full transcript<span className="s-sr-only"> (opens in a new tab)</span>
                </a>
                .
              </p>
            </Reveal>
            <Reveal delay={80} className="s-table-wrap">
              <table className="s-table s-pr-triage__table s-pr-stack">
                <caption className="s-sr-only">Every case in the recorded triage, with Exhibit&apos;s call</caption>
                <thead>
                  <tr>
                    <th scope="col">Case</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Due</th>
                    <th scope="col">Exhibit&apos;s call</th>
                    <th scope="col">Why</th>
                  </tr>
                </thead>
                <tbody>
                  {TRIAGE.map((r) => (
                    <tr key={r.id} className={r.queued ? "s-pr-runs__hl" : undefined}>
                      <td>
                        <span className="s-mono">{r.id}</span> {r.buyer}
                      </td>
                      <td className="s-mono">${r.amount}</td>
                      <td>{r.due}</td>
                      <td>
                        {r.call}, <span className="s-mono">{r.pct}%</span>
                      </td>
                      <td className="text-[var(--s-muted)]">{r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Reveal>
          </div>
        </Container>
      </Section>

      <ProductPager current="agents" />
      <ProductCta
        id="agents-cta"
        title="Play the agent yourself."
        rest="Then approve or reject it."
        lede="The live demo has an Agent requests page with a button that plays an outside agent asking to act. Approve it and watch it run through the same code as your own button, on the PayPal simulator."
        art="shield"
      />
    </>
  );
}
