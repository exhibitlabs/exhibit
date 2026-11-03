import type { Metadata } from "next";
import { companyMetadata } from "@/components/site/company/meta";
import type { ReactNode } from "react";
import { ArrowUpRight, Ban, Bot, Check, FileLock2, Gauge, KeyRound, Lock, ScrollText, ShieldAlert, UserRound, X } from "lucide-react";
import { Actions, Body, ButtonLink, Container, DotArt, Eyebrow, Facts, Heading, Lede, Mono, PageHeader, PlateCaption, PlateOverlay, PlateStage, Section, SectionHead, Small, Terminal, TextLink } from "@/components/site";
import { FactStrip } from "@/components/site/company/FactStrip";
import { ApprovalRequest, AuditTrail, AutopilotPanel, CallInspector, TraceRejection } from "@/components/site/company/fragments";
import { OnThisPage } from "@/components/site/company/OnThisPage";
import { CONTACT_EMAIL, GITHUB, NOV3, SQLITE_TABLES, TEST_FILES, TEST_TOTAL } from "@/components/site/company/records";
import { AUTOPILOT_LIMITS } from "@/lib/autopilot-rules";

const DESCRIPTION =
  "How Exhibit keeps money and customers safe: every claim cited to a record, only the actions PayPal allows, merchant approval for AI agents, Autopilot hard limits and an audit log of every PayPal call. Open source, 300 tests, tested on PayPal's sandbox, no certification yet.";

export const metadata: Metadata = companyMetadata({ title: "Security", description: DESCRIPTION, path: "/security" });

const CEILING = `$${AUTOPILOT_LIMITS.maxAmount.max.toLocaleString("en-US")}`;
const FLOOR = `${AUTOPILOT_LIMITS.minLikelihood.min}%`;

/** The eight promises in SECURITY.md, each with the test files that hold it. */
const PROMISES: { title: string; body: ReactNode; tests: string[] }[] = [
  {
    title: "The model can't invent evidence.",
    body: (
      <>
        Every exhibit and every reasoning point must cite a ref a tool returned, such as <Mono>shipment:SHP-10503</Mono>. A brief is rejected unless each ref resolves to a record on that case, and the evidence packet re-reads those records from source.
      </>
    ),
    tests: ["citation-guardrail"],
  },
  {
    title: "Only actions PayPal allows right now.",
    body: "A brief is rejected if its action isn't among the links PayPal returns on the dispute at that moment, or if its offer type or amount is outside what the dispute allows.",
    tests: ["action-guardrail", "filing"],
  },
  {
    title: "An AI agent can ask, never do.",
    body: "Over MCP, an agent can investigate and request. A request only creates a pending approval. The app takes the decision only from a same-origin browser request, and no MCP tool reaches that route or any route that files, refunds or messages.",
    tests: ["approvals-api", "mcp-server"],
  },
  {
    title: "Approval is pinned to the brief.",
    body: "If the case is investigated again after an agent asks, the request expires instead of filing something the merchant never saw.",
    tests: ["approvals"],
  },
  {
    title: "Autopilot stays inside hard limits.",
    body: `It is off by default and sends low-confidence briefs to a person. No saved setting can file evidence below ${FLOOR} likelihood or act on more than ${CEILING}, and it never acts on a run an outside agent started.`,
    tests: ["autopilot", "agent-run"],
  },
  {
    title: "The agent can look, not touch.",
    body: "Its tools only read. On the Claude CLI it gets Exhibit's tools and nothing else: no shell, no file access, no other MCP servers, no user settings.",
    tests: ["agent-tools"],
  },
  {
    title: "Ask Exhibit only says what the data says.",
    body: "It can't change anything. An answer that names a dispute or order that doesn't exist, or charts a number no tool returned, is sent back.",
    tests: ["ask-grounding"],
  },
  {
    title: "Demo mode never calls PayPal.",
    body: (
      <>
        Without credentials, or with <Mono>EXHIBIT_PAYPAL_MODE=demo</Mono>, every PayPal call goes to an in-process simulator with the real API&apos;s request shapes and errors.
      </>
    ),
    tests: ["simulator", "config"],
  },
];

/** PayPal endpoints Exhibit calls (README "PayPal APIs"), grouped by what they can do. */
const ENDPOINTS: { group: string; note: string; rows: { ep: string; use: string; live: boolean }[] }[] = [
  {
    group: "Reads",
    note: "Any time Exhibit syncs or investigates",
    rows: [
      { ep: "POST /v1/oauth2/token", use: "Client-credentials sign-in", live: true },
      { ep: "GET /v1/customer/disputes", use: "Inbox sync", live: true },
      { ep: "GET /v1/customer/disputes/{id}", use: "Case facts, deadline and the actions PayPal allows now", live: true },
      { ep: "GET /v2/payments/captures/{id}", use: "The payment, with PayPal's own Seller Protection flag", live: true },
    ],
  },
  {
    group: "Actions",
    note: "Only after you file or approve, or by an Autopilot rule you switched on",
    rows: [
      { ep: "POST …/disputes/{id}/provide-evidence", use: "Evidence, tracking and the PDF packet", live: true },
      { ep: "POST …/disputes/{id}/provide-supporting-info", use: "The letter and packet while PayPal reviews a chargeback", live: true },
      { ep: "POST …/disputes/{id}/accept-claim", use: "Refund the buyer when the records say they are right", live: true },
      { ep: "POST …/disputes/{id}/make-offer", use: "Refund, return or replacement offers at the inquiry stage", live: false },
      { ep: "POST …/disputes/{id}/send-message", use: "Messages to the buyer at the inquiry stage", live: false },
      { ep: "POST /v2/payments/captures/{id}/refund", use: "Refund first, then file the refund as proof", live: false },
      { ep: "POST /v2/checkout/orders/{id}/track", use: "Push missing tracking before a claim (Prevention)", live: false },
    ],
  },
  {
    group: "Webhooks",
    note: "Checked before anything runs",
    rows: [{ ep: "POST /v1/notifications/verify-webhook-signature", use: "Verify CUSTOMER.DISPUTE.* webhooks", live: false }],
  },
  {
    group: "Sandbox setup",
    note: "Sandbox-only calls for seeding test cases",
    rows: [
      { ep: "POST /v2/checkout/orders and …/capture", use: "Create and capture sandbox orders", live: true },
      { ep: "POST /v2/customer-support/process-chargeback", use: "Open sandbox chargebacks", live: true },
      { ep: "POST …/disputes/{id}/adjudicate", use: "Ask the sandbox to rule", live: true },
      { ep: "POST …/disputes/{id}/require-evidence", use: "Move a sandbox case to evidence requested", live: false },
    ],
  },
];

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight className="s-icon" aria-hidden />
      <span className="s-sr-only"> (opens in a new tab)</span>
    </a>
  );
}

export default function SecurityPage() {
  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Nothing reaches PayPal until you say so."
        rest="Every rule below is in the code."
        lede="Exhibit works with money and with customers, so a way around its guardrails is a security bug, not a quirk. This page covers each guardrail, what Exhibit stores, what it can touch, the PayPal access it uses, the model it runs on and how to report a problem."
        actions={
          <>
            <ButtonLink href={GITHUB.reportVulnerability}>Report a vulnerability</ButtonLink>
            <ButtonLink href={GITHUB.securityMd} variant="ghost">
              Read SECURITY.md
            </ButtonLink>
          </>
        }
        aside={<DotArt name="shield" frame className="w-[180px] sm:w-[220px] lg:w-full lg:max-w-[292px]" />}
      />

      <Container className="mt-12 lg:mt-16">
        <p className="s-small mb-3">Where Exhibit stands, Nov 3, 2026</p>
        <FactStrip
          label="Status"
          items={[
            { k: "Certification", v: "None yet", note: "No SOC 2 or other certification" },
            { k: "Tested on", v: "PayPal's sandbox", note: "Not used in production" },
            { k: "Sign-in", v: "Not yet", note: "A single-merchant app" },
            { k: "Tests", v: `${TEST_TOTAL} passing`, note: "No keys or network needed" },
            { k: "Source", v: "Open, MIT licence", note: "github.com/exhibitlabs/exhibit" },
          ]}
        />
        <OnThisPage
          items={[
            { id: "guardrails", label: "Guardrails" },
            { id: "approvals", label: "Approvals" },
            { id: "autopilot", label: "Autopilot" },
            { id: "audit-log", label: "Audit log" },
            { id: "data", label: "Data" },
            { id: "access", label: "Access" },
            { id: "model", label: "Model" },
            { id: "paypal", label: "PayPal" },
            { id: "open-source", label: "Open source" },
            { id: "disclosure", label: "Disclosure" },
            { id: "status", label: "Not yet" },
          ]}
        />
      </Container>

      {/* Guardrails: the eight promises, a ruled grid */}
      <Section id="guardrails" labelledBy="guardrails-h">
        <Container>
          <SectionHead aside={<Lede>These are the rules to try to break. Each one has its own tests in the repository, and CI runs all {TEST_TOTAL} on every push and pull request, with no secrets.</Lede>}>
            <Eyebrow>Guardrails</Eyebrow>
            <Heading id="guardrails-h" title="Eight promises," rest="each one held by tests." />
          </SectionHead>
          <ol className="s-co-promises">
            {PROMISES.map((p, i) => (
              <li key={p.title}>
                <span className="s-co-promises__n">{String(i + 1).padStart(2, "0")}</span>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
                <div className="s-co-tests">
                  {p.tests.map((t) => (
                    <Ext key={t} href={GITHUB.file(`tests/${t}.test.ts`)}>
                      {t}
                    </Ext>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
            <TraceRejection className="lg:col-span-7" />
            <div className="lg:col-span-5">
              <Small>
                <b className="font-medium text-[color:var(--s-ink-2)]">A real rejection.</b> On the synthetic case inr-07, the first brief named an action without the evidence types PayPal needs. It was sent back before it was saved, and the agent fixed it. The 30 evaluation cases were written and labelled with Claude, so they show the rules apply consistently, not accuracy on real disputes.
              </Small>
              <TextLink href={GITHUB.file("eval/RESULTS.md")} className="mt-3">
                The evaluation, with its limits
              </TextLink>
            </div>
          </div>
        </Container>
      </Section>

      {/* Approvals: the request set into a plate, the flow beside it */}
      <Section id="approvals" labelledBy="approvals-h">
        <Container size="wide">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
            <figure className="s-figure min-w-0 lg:col-span-8">
              <PlateStage painting="petoOfficeBoard" focus={[50, 24]} height={660} mobile={{ height: 300, focus: [55, 20] }} sizes="(max-width: 1024px) 100vw, 900px">
                <PlateOverlay left="7%" top="30%" width="min(620px, 86%)">
                  <ApprovalRequest />
                </PlateOverlay>
              </PlateStage>
              <PlateCaption painting="petoOfficeBoard" even>
                <b>The approval queue.</b> {NOV3.client} asked to send the Daniel Reyes packet to PayPal at {NOV3.requestedAt} on Nov 3, 2026. The merchant approved at {NOV3.decidedAt}, and PayPal returned {NOV3.call.status}.
              </PlateCaption>
            </figure>
            <div className="px-[var(--s-gutter-wide)] lg:col-span-4 lg:px-0 lg:pr-4 lg:pt-2">
              <Eyebrow>Approval gate</Eyebrow>
              <Heading id="approvals-h" title="An agent can ask." rest="Only you can say yes." />
              <Body className="mt-5">Claude, ChatGPT or an agent built on PayPal&apos;s Agent Toolkit can triage your disputes through Exhibit&apos;s MCP server. Anything that would file, refund, offer or message a buyer becomes a request instead.</Body>
              <ol className="s-co-steps mt-8">
                <li>
                  <div>
                    <h3>The agent asks</h3>
                    <p>
                      <code>request_dispute_action</code> queues the brief&apos;s PayPal action. Nothing is sent to PayPal.
                    </p>
                  </div>
                </li>
                <li>
                  <div>
                    <h3>You see what would happen</h3>
                    <p>The action, the amount, whether money moves, and the brief it was made against.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <h3>You decide in the app</h3>
                    <p>The decision route takes only a same-origin browser request. Anything else gets a 403.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <h3>The brief is checked again</h3>
                    <p>If the case was investigated again after the agent asked, the request expires and nothing is filed.</p>
                  </div>
                </li>
                <li>
                  <div>
                    <h3>Exhibit files and logs it</h3>
                    <p>It re-reads the dispute from PayPal, runs the same code as your own File button, and logs the filing under the agent&apos;s name.</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </Container>
      </Section>

      {/* Autopilot: the grey band, the shipped settings beside the limits */}
      <Section id="autopilot" tone="band" labelledBy="autopilot-h">
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-5">
              <Eyebrow>Autopilot</Eyebrow>
              <Heading id="autopilot-h" title="Off by default." rest="Fenced in when it's on." />
              <Lede className="mt-5">Autopilot lets Exhibit act alone on cases you decide are routine. Your rules can be stricter than the limits below. No saved setting can make them looser: every setting is clamped to them when it is saved and when it is read.</Lede>
              <ul className="s-co-list mt-8">
                <li>
                  <Lock className="s-icon" aria-hidden />
                  <span>
                    <b>Nothing above {CEILING}</b> is ever automatic.
                  </span>
                </li>
                <li>
                  <Gauge className="s-icon" aria-hidden />
                  <span>
                    <b>Evidence is never filed alone below {FLOOR}</b> win likelihood.
                  </span>
                </li>
                <li>
                  <UserRound className="s-icon" aria-hidden />
                  <span>
                    <b>Low-confidence briefs</b> always go to a person.
                  </span>
                </li>
                <li>
                  <Bot className="s-icon" aria-hidden />
                  <span>
                    <b>Runs an outside agent started</b> never act on their own.
                  </span>
                </li>
                <li>
                  <ShieldAlert className="s-icon" aria-hidden />
                  <span>
                    <b>If a brief&apos;s call and its PayPal action disagree,</b> a person decides.
                  </span>
                </li>
                <li>
                  <ScrollText className="s-icon" aria-hidden />
                  <span>
                    <b>Every automatic action is logged</b> as Autopilot, beside the brief behind it.
                  </span>
                </li>
              </ul>
              <Small className="mt-5">
                The limits live in <Mono>src/lib/autopilot-rules.ts</Mono>. Held by <Mono>autopilot.test.ts</Mono> and <Mono>agent-run.test.ts</Mono>.
              </Small>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <AutopilotPanel />
              <Small className="mt-4">Rebuilt from Exhibit&apos;s Autopilot page. The verdicts come from the app&apos;s own rule function, run on the latest brief for each sandbox case.</Small>
            </div>
          </div>
        </Container>
      </Section>

      {/* Audit log: the night band, the trail set into a dark plate */}
      <Section id="audit-log" tone="night" labelledBy="audit-h">
        <Container>
          <SectionHead aside={<Lede>One client makes every PayPal call and logs its method, path, status, latency and PayPal&apos;s debug id, with the request and the response. Agent runs, requests, approvals and filings land in the same log, with who acted.</Lede>}>
            <Eyebrow>Audit log</Eyebrow>
            <Heading id="audit-h" title="Every call and every decision," rest="on the record." />
          </SectionHead>
        </Container>
        <Container size="wide">
          <figure className="s-figure">
            <PlateStage painting="hoogstraten" focus={[50, 40]} height={600} mobile={{ height: 280, focus: [30, 40], zoom: 1.2 }}>
              <PlateOverlay left="47%" top="12%" width="min(620px, 49%)">
                <AuditTrail />
              </PlateOverlay>
            </PlateStage>
            <PlateCaption painting="hoogstraten">
              <b>The audit trail.</b> The Nov 3 approval, row by row, as Exhibit logged it (UTC). After the merchant approved, Exhibit read the dispute from PayPal again, then filed.
            </PlateCaption>
          </figure>
        </Container>
        <Container>
          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-4">
              <h3 className="s-h s-h--h3">Who acted, on every filing</h3>
              <Body className="mt-3">Each filing records its actor, exactly as these labels appear in the log.</Body>
            </div>
            <ul className="s-co-list lg:col-span-8">
              <li>
                <UserRound className="s-icon" aria-hidden />
                <span>
                  <code>merchant</code>: you pressed File in the app.
                </span>
              </li>
              <li>
                <Gauge className="s-icon" aria-hidden />
                <span>
                  <code>autopilot</code>: a rule you switched on acted, inside the hard limits.
                </span>
              </li>
              <li>
                <Bot className="s-icon" aria-hidden />
                <span>
                  <code>agent:{NOV3.client} approved by merchant</code>: an outside agent asked, and you approved.
                </span>
              </li>
              <li>
                <ScrollText className="s-icon" aria-hidden />
                <span>
                  <code>sandbox</code>: a sandbox-only control, such as asking the sandbox to rule.
                </span>
              </li>
            </ul>
          </div>
        </Container>
      </Section>

      {/* Data: the database's tables, one stored call, what is never written */}
      <Section id="data" labelledBy="data-h">
        <Container>
          <SectionHead aside={<Lede>A self-hosted Exhibit keeps everything in SQLite, through Node&apos;s built-in node:sqlite, in one file per mode under .data/. Demo data never mixes with sandbox data, and Exhibit sends nothing to its makers.</Lede>}>
            <Eyebrow>Data and credentials</Eyebrow>
            <Heading id="data-h" title="Your data stays on the machine" rest="that runs Exhibit." />
          </SectionHead>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-5">
              <Terminal title="sqlite3" label="The tables in a self-hosted Exhibit database">
                <div>
                  <span className="p">$ </span>
                  <span className="c">sqlite3 .data/exhibit-sandbox.db .tables</span>
                </div>
                <div className="whitespace-pre-wrap">{SQLITE_TABLES.join("   ")}</div>
              </Terminal>
              <Facts
                className="!mt-6"
                items={[
                  { k: <Mono>docs</Mono>, v: "Store records (orders, shipments, buyers, messages, checkout signals) and cached PayPal disputes and captures" },
                  { k: <Mono>runs</Mono>, v: "Each agent run: its trace and the validated brief" },
                  { k: <Mono>actions</Mono>, v: "Every filing, with what was sent and what PayPal returned" },
                  { k: <Mono>activity</Mono>, v: "The audit log" },
                  { k: <Mono>api_calls</Mono>, v: "PayPal request and response bodies, with secrets masked" },
                  { k: <Mono>approvals</Mono>, v: "Requests from outside agents, and your decisions" },
                  { k: <Mono>kv</Mono>, v: "Settings, such as your Autopilot rules" },
                ]}
              />
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <CallInspector />
              <Small className="mt-4">One row of api_calls, the Nov 3 filing, as Exhibit stored it. The packet is kept by name and size. The Authorization header that carried the token was never written down.</Small>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-6">
            <div>
              <h3 className="s-h s-h--h3">Never written down</h3>
              <ul className="s-co-list mt-4">
                <li>
                  <Ban className="s-icon" aria-hidden />
                  <span>
                    <b>The Authorization header</b> of any PayPal call. Your client id and secret travel in it.
                  </span>
                </li>
                <li>
                  <Ban className="s-icon" aria-hidden />
                  <span>
                    <b>PayPal access tokens.</b> The token lives in memory and is renewed a minute before it expires.
                  </span>
                </li>
                <li>
                  <Ban className="s-icon" aria-hidden />
                  <span>
                    <b>Secret fields.</b> Anything named like <code>token</code>, <code>client_secret</code>, <code>password</code>, <code>authorization</code>, <code>security_code</code> or <code>cvv</code> becomes <code>[redacted]</code> first.
                  </span>
                </li>
                <li>
                  <Ban className="s-icon" aria-hidden />
                  <span>
                    <b>Card numbers.</b> A logged card number keeps only its last four digits.
                  </span>
                </li>
                <li>
                  <Ban className="s-icon" aria-hidden />
                  <span>
                    <b>Uploaded files.</b> Files sent to PayPal are logged by name and size, not content.
                  </span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="s-h s-h--h3">Keys</h3>
              <ul className="s-co-list mt-4">
                <li>
                  <KeyRound className="s-icon" aria-hidden />
                  <span>
                    <b>Credentials go in .env.local.</b> Every <code>.env</code> file except <code>.env.example</code> is ignored by git.
                  </span>
                </li>
                <li>
                  <FileLock2 className="s-icon" aria-hidden />
                  <span>
                    <b>Nothing needs a key</b> to run, test or build. The tests refuse outbound network calls, and CI runs with no secrets.
                  </span>
                </li>
                <li>
                  <ShieldAlert className="s-icon" aria-hidden />
                  <span>
                    <b>If a key is ever committed,</b> rotate it first. Deleting the file in a later commit doesn&apos;t remove it from history.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </Container>
      </Section>

      {/* Access: who can do what, as a matrix */}
      <Section id="access" labelledBy="access-h">
        <Container>
          <SectionHead even aside={<Lede>Three things can set Exhibit in motion: its own agent, an outside agent over MCP, and Autopilot if you switch it on. None of them reaches PayPal on its own say-so.</Lede>}>
            <Eyebrow>Access</Eyebrow>
            <Heading id="access-h" title="What each agent can touch," rest="and what it can't." />
          </SectionHead>
          <table className="s-co-matrix">
            <thead>
              <tr>
                <th scope="col">
                  <span className="s-sr-only">Who</span>
                </th>
                <th scope="col">Can</th>
                <th scope="col">Cannot</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  Exhibit&apos;s agent<small>Claude, with eight read-only tools and file_case_brief</small>
                </th>
                <td data-label="Can" className="s-co-can">
                  <ul>
                    <li>
                      <Check className="s-icon" aria-hidden />
                      Read the dispute from PayPal&apos;s Disputes API
                    </li>
                    <li>
                      <Check className="s-icon" aria-hidden />
                      Read the order, carrier scans, buyer history and messages, checkout signals and store policies
                    </li>
                    <li>
                      <Check className="s-icon" aria-hidden />
                      Read PayPal&apos;s Seller Protection flag on the payment
                    </li>
                    <li>
                      <Check className="s-icon" aria-hidden />
                      File a case brief, which must pass the citation and action checks
                    </li>
                  </ul>
                </td>
                <td data-label="Cannot" className="s-co-cannot">
                  <ul>
                    <li>
                      <X className="s-icon" aria-hidden />
                      File, refund, offer or message a buyer
                    </li>
                    <li>
                      <X className="s-icon" aria-hidden />
                      Run commands or read files: on the Claude CLI it gets no built-in tools
                    </li>
                    <li>
                      <X className="s-icon" aria-hidden />
                      Use other MCP servers or your Claude settings
                    </li>
                  </ul>
                </td>
              </tr>
              <tr>
                <th scope="row">
                  Outside agents over MCP<small>Claude, ChatGPT or an agent built on PayPal&apos;s Agent Toolkit</small>
                </th>
                <td data-label="Can" className="s-co-can">
                  <ul>
                    <li>
                      <Check className="s-icon" aria-hidden />
                      List disputes and run investigations
                    </li>
                    <li>
                      <Check className="s-icon" aria-hidden />
                      Read briefs, evidence packets, the prevention report and the overview
                    </li>
                    <li>
                      <Check className="s-icon" aria-hidden />
                      Request an action or a prevention fix, for your approval
                    </li>
                    <li>
                      <Check className="s-icon" aria-hidden />
                      See whether a request was approved, rejected, failed or expired
                    </li>
                  </ul>
                </td>
                <td data-label="Cannot" className="s-co-cannot">
                  <ul>
                    <li>
                      <X className="s-icon" aria-hidden />
                      Approve a request
                    </li>
                    <li>
                      <X className="s-icon" aria-hidden />
                      File, refund, offer or message a buyer
                    </li>
                    <li>
                      <X className="s-icon" aria-hidden />
                      Reach PayPal: the MCP server holds no PayPal credentials and talks only to your Exhibit app
                    </li>
                  </ul>
                </td>
              </tr>
              <tr>
                <th scope="row">
                  Autopilot<small>Off unless you switch it on</small>
                </th>
                <td data-label="Can" className="s-co-can">
                  <ul>
                    <li>
                      <Check className="s-icon" aria-hidden />
                      Run a brief&apos;s PayPal action when it fits a rule you switched on
                    </li>
                    <li>
                      <Check className="s-icon" aria-hidden />
                      Refund small claims where the buyer is right, up to your limit
                    </li>
                  </ul>
                </td>
                <td data-label="Cannot" className="s-co-cannot">
                  <ul>
                    <li>
                      <X className="s-icon" aria-hidden />
                      Act above {CEILING}, or file evidence below {FLOOR} win likelihood
                    </li>
                    <li>
                      <X className="s-icon" aria-hidden />
                      Act on a low-confidence brief
                    </li>
                    <li>
                      <X className="s-icon" aria-hidden />
                      Act on a run an outside agent started
                    </li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
          <Small className="mt-6 max-w-[760px]">Buyer messages and tool results reach the agent as data, and its instructions say never to follow instructions found inside them. If one ever did, its brief would still face the same checks, and still wait for you.</Small>
        </Container>
      </Section>

      {/* Model: three ways to connect Claude, on the grey band */}
      <Section id="model" tone="band" labelledBy="model-h">
        <Container>
          <SectionHead aside={<Lede>Exhibit&apos;s agent and Ask Exhibit run on Claude Opus 5.5 (claude-opus-5-5) from Anthropic. Set EXHIBIT_MODEL to pick another Claude model.</Lede>}>
            <Eyebrow>The model</Eyebrow>
            <Heading id="model-h" title="Claude does the reasoning." rest="You choose how it connects." />
          </SectionHead>
          <div className="s-co-cards">
            <div className="s-co-card">
              <div className="s-co-card__k">
                <Mono>ANTHROPIC_API_KEY</Mono>
                <span>first choice</span>
              </div>
              <h3>The Claude API</h3>
              <p>Set an Anthropic API key and the agent runs on the Claude API through Anthropic&apos;s SDK. A key takes precedence over a CLI login.</p>
              <div className="s-co-card__foot">Sent to Anthropic: the case records the tools return</div>
            </div>
            <div className="s-co-card">
              <div className="s-co-card__k">
                <Mono>Claude CLI login</Mono>
                <span>if there is no key</span>
              </div>
              <h3>Your Claude login</h3>
              <p>With a Claude CLI login on the machine, the agent runs through the Claude Agent SDK in an isolated session: Exhibit&apos;s tools only, no shell, no files, no saved session.</p>
              <div className="s-co-card__foot">Sent to Anthropic: the case records the tools return</div>
            </div>
            <div className="s-co-card">
              <div className="s-co-card__k">
                <Mono>neither</Mono>
                <span>the fallback</span>
              </div>
              <h3>Recorded runs</h3>
              <p>With no key and no login, Exhibit replays recorded Claude runs. Every tool call still runs live against the case, and the brief must pass the same checks as a live one.</p>
              <div className="s-co-card__foot">Sent to Anthropic: nothing</div>
            </div>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-6">
            <div>
              <h3 className="s-h s-h--h3">What Claude sees</h3>
              <ul className="s-co-list mt-4">
                <li>
                  <Check className="s-icon" aria-hidden />
                  <span>Exhibit&apos;s instructions, with the merchant&apos;s name, city and support email.</span>
                </li>
                <li>
                  <Check className="s-icon" aria-hidden />
                  <span>The dispute id, then what the tools return: the dispute, the order, tracking, the buyer&apos;s history and messages, checkout signals, policies and the Seller Protection check.</span>
                </li>
                <li>
                  <Check className="s-icon" aria-hidden />
                  <span>For Ask Exhibit, your question and the records its tools return. Answers aren&apos;t stored.</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="s-h s-h--h3">What it never gets</h3>
              <ul className="s-co-list mt-4">
                <li>
                  <X className="s-icon" aria-hidden />
                  <span>Your PayPal client id, secret or access token.</span>
                </li>
                <li>
                  <X className="s-icon" aria-hidden />
                  <span>A tool that writes to PayPal, moves money or messages a buyer.</span>
                </li>
                <li>
                  <X className="s-icon" aria-hidden />
                  <span>Your files, a shell, or other MCP servers.</span>
                </li>
              </ul>
            </div>
          </div>
          <Small className="mt-8">What Exhibit sends to Claude is covered by your own terms with Anthropic, through your API key or your Claude plan.</Small>
        </Container>
      </Section>

      {/* PayPal: scopes and every endpoint, a split with a table */}
      <Section id="paypal" labelledBy="paypal-h">
        <Container>
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
            <div className="lg:sticky lg:top-[calc(var(--s-nav-h)+40px)] lg:col-span-4 lg:self-start">
              <Eyebrow>PayPal access</Eyebrow>
              <Heading id="paypal-h" title="Sandbox only," rest="through PayPal's own REST APIs." />
              <Body className="mt-5">Exhibit signs in with OAuth client credentials from a sandbox REST app you create. Both of its modes point at <Mono>api-m.sandbox.paypal.com</Mono>: there is no production mode in the code yet. In demo mode, the same client talks to an in-process simulator instead.</Body>
              <div className="mt-6 rounded-[10px] bg-[color:var(--s-band)] p-5">
                <p className="s-small !text-[color:var(--s-ink-2)]">
                  PayPal&apos;s Disputes API reference names two scopes for this work: <Mono>disputes/read-seller</Mono> to read a merchant&apos;s disputes, and <Mono>disputes/update-seller</Mono> for merchant actions. Exhibit requests no scopes itself. The token carries what your REST app was granted.
                </p>
              </div>
              <Body className="mt-6">Webhooks for CUSTOMER.DISPUTE.* are verified with PayPal&apos;s verify-webhook-signature API before anything runs. PayPal hasn&apos;t delivered one to Exhibit yet: that needs a public HTTPS address.</Body>
            </div>
            <div className="lg:col-span-7 lg:col-start-6">
              <div className="s-table-wrap">
                <table className="s-table s-co-eptable md:min-w-[560px]">
                  <caption className="s-sr-only">Every PayPal endpoint Exhibit calls, and whether it has been called on the live sandbox</caption>
                  <thead>
                    <tr>
                      <th scope="col">Endpoint</th>
                      <th scope="col">What for</th>
                      <th scope="col">Live sandbox</th>
                    </tr>
                  </thead>
                  {ENDPOINTS.map((g) => (
                    <tbody key={g.group}>
                      <tr>
                        <th scope="rowgroup" colSpan={3} className="!pt-6 !text-[13px] !font-medium !text-[color:var(--s-ink)]">
                          {g.group} <span className="ml-2 font-normal text-[color:var(--s-muted)]">{g.note}</span>
                        </th>
                      </tr>
                      {g.rows.map((r) => (
                        <tr key={r.ep}>
                          <td className="s-mono md:whitespace-nowrap">{r.ep}</td>
                          <td>{r.use}</td>
                          <td className="whitespace-nowrap">{r.live ? <span className="s-code s-code--ok">called</span> : <span className="text-[12px] text-[color:var(--s-muted)]">simulator only</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
              <Small className="mt-4">
                &ldquo;Called&rdquo; means Exhibit has called it on <Mono>api-m.sandbox.paypal.com</Mono>. Every call is in the <TextLink href="/proof">sandbox record</TextLink>.
              </Small>
            </div>
          </div>
        </Container>
      </Section>

      {/* Open source: the test ledger */}
      <Section id="open-source" labelledBy="oss-h">
        <Container>
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-6">
            <div className="lg:col-span-5">
              <Eyebrow>Open source and tests</Eyebrow>
              <Heading id="oss-h" title="Read every prompt, tool and guardrail." rest="Then run the tests yourself." />
              <Body className="mt-5">Exhibit is MIT licensed. The suite forces demo mode and recorded runs, uses a temporary data directory and blocks outbound network calls, so it needs no keys, no network and no Claude login.</Body>
              <Body className="mt-3">GitHub Actions runs lint, type checks, every test and a production build on each push and pull request to main, with no secrets.</Body>
              <Actions>
                <ButtonLink href={GITHUB.repo} variant="ghost">
                  View the code
                </ButtonLink>
                <ButtonLink href={GITHUB.ci} variant="ghost">
                  The CI workflow
                </ButtonLink>
              </Actions>
            </div>
            <div className="lg:col-span-6 lg:col-start-7">
              <ol className="s-co-ledger" aria-label="Test files and how many tests each holds">
                {TEST_FILES.map((t) => (
                  <li key={t.file}>
                    <a href={GITHUB.file(`tests/${t.file}`)} target="_blank" rel="noopener noreferrer">
                      {t.file}
                      <span className="s-sr-only"> (opens in a new tab)</span>
                    </a>
                    <span className="s-co-ledger__fill" aria-hidden />
                    <span className="s-co-ledger__n">{t.tests}</span>
                  </li>
                ))}
              </ol>
              <div className="s-co-ledger__total">
                <span>{TEST_FILES.length} files, all passing on Nov 3, 2026</span>
                <b>{TEST_TOTAL} tests</b>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Disclosure: a quiet panel */}
      <Section id="disclosure" labelledBy="disclosure-h">
        <Container>
          <div className="s-co-panel">
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-6">
              <div className="lg:col-span-6">
                <Eyebrow>Responsible disclosure</Eyebrow>
                <Heading id="disclosure-h" title="Found a way around a guardrail?" rest="Tell us privately." />
                <Body className="mt-5">Please don&apos;t open a public issue with the details. Report it privately on GitHub, or email us. Say what you did, what you expected, what happened and the commit you tested. A report that reproduces in demo mode, with no credentials, is the easiest to confirm.</Body>
                <Actions>
                  <ButtonLink href={GITHUB.reportVulnerability}>Report it on GitHub</ButtonLink>
                  <ButtonLink href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Security report")}`} variant="ghost">
                    Email {CONTACT_EMAIL}
                  </ButtonLink>
                </Actions>
                <Small className="mt-4">We aim to reply within a few days. Exhibit is at version 1.0, so only main is supported.</Small>
              </div>
              <div className="lg:col-span-5 lg:col-start-8">
                <h3 className="s-h s-h--h4">In scope</h3>
                <ul className="s-co-list mt-3">
                  {[
                    "Executing or approving an action without the merchant",
                    "Evidence or citations the model could forge",
                    "Actions outside the allowed set or Autopilot's limits",
                    "Leaked credentials",
                    "Prompt injection, through a buyer message or tool result, that leads to an action",
                  ].map((t) => (
                    <li key={t}>
                      <Check className="s-icon" aria-hidden />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <h3 className="s-h s-h--h4 mt-8">Out of scope</h3>
                <ul className="s-co-list mt-3">
                  {["The demo merchant's fictional data", "Differences between the simulator and PayPal's real API", "Vulnerabilities in dependencies: please report those upstream"].map((t) => (
                    <li key={t}>
                      <X className="s-icon" aria-hidden />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* Not yet: the honest gaps */}
      <Section id="status" labelledBy="status-h">
        <Container>
          <SectionHead aside={<Lede>Exhibit is version 1.0 of a hackathon project, two weeks from its first commit. These are the gaps we know about.</Lede>}>
            <Eyebrow>Honest status</Eyebrow>
            <Heading id="status-h" title="What Exhibit doesn't have yet." />
          </SectionHead>
          <ul className="s-co-notyet">
            <li>
              <b>A certification</b>
              <span>No SOC 2 or any other certification, and no third-party security review.</span>
            </li>
            <li>
              <b>Sign-in</b>
              <span>Exhibit is a single-merchant app with no login. Anyone who can reach a deployment can act as its merchant, so don&apos;t put one on the internet with real credentials until authentication sits in front of it.</span>
            </li>
            <li>
              <b>Production PayPal</b>
              <span>Both modes point at PayPal&apos;s sandbox. Exhibit has never handled a real customer&apos;s money.</span>
            </li>
            <li>
              <b>Live tests of every endpoint</b>
              <span>Offers, buyer messages, tracking push, capture refunds and webhooks are verified on the simulator only.</span>
            </li>
            <li>
              <b>A private demo</b>
              <span>The live demo is shared: everyone using it works the same fictional store until it resets after 20 quiet minutes.</span>
            </li>
          </ul>
        </Container>
      </Section>
    </>
  );
}
