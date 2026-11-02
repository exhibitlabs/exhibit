import { clsx } from "clsx";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { GITHUB_URL, PAYPAL_MCP_QUOTE } from "./data";
import { Container, Heading, Panel, Provenance, Section } from "./Primitives";

// Excerpts of a real run, recorded 2026-10-20 23:41 UTC with `node mcp/agent-demo.ts` (docs/MCP_DEMO.md):
// Claude with only Exhibit's MCP server attached, against the demo merchant.
const TRANSCRIPT: { who: "merchant" | "call" | "result" | "claude"; text: ReactNode }[] = [
  { who: "merchant", text: "Triage my open PayPal disputes and get the strongest one ready to file." },
  { who: "call", text: <>list_disputes</> },
  { who: "result", text: <>{`{ "count": 8, "total_amount": 1805, … }`}</> },
  { who: "call", text: <>get_case_brief · investigate_dispute ×7</> },
  { who: "call", text: <>request_dispute_action {`{ "dispute_id": "PP-D-50211" }`}</> },
  {
    who: "result",
    text: <>{`{ "approval_id": "apv_4e8074d6db", "status": "pending", "action": "provide_evidence", "moves_money": false, "requested_by": "Claude Code" }`}</>,
  },
  { who: "claude", text: "I've triaged all 8 open disputes ($1,805 total) and set up the strongest one for filing. Nothing has been filed yet. It goes to PayPal only once you approve it." },
];

const CONFIG = `{
  "mcpServers": {
    "exhibit": {
      "command": "node",
      "args": ["/path/to/exhibit/mcp/server.ts"],
      "env": { "EXHIBIT_URL": "http://localhost:3000" }
    },
    "paypal": {
      "command": "npx",
      "args": ["-y", "@paypal/mcp", "--tools=all"],
      "env": { "PAYPAL_ENVIRONMENT": "SANDBOX" }
    }
  }
}`;

function Line({ who, children }: { who: (typeof TRANSCRIPT)[number]["who"]; children: ReactNode }) {
  const label = { merchant: "Merchant", call: "→ tool", result: "← Exhibit", claude: "Claude" }[who];
  return (
    <li className="grid grid-cols-[72px_minmax(0,1fr)] gap-3 py-2 sm:grid-cols-[84px_minmax(0,1fr)]">
      <span className={clsx("num pt-px text-[11px]", who === "merchant" || who === "claude" ? "text-ink" : "text-muted")}>{label}</span>
      <span className={clsx("min-w-0 break-words", who === "call" || who === "result" ? "num text-[12px]" : "text-[13.5px] leading-relaxed", who === "call" ? "text-ink" : who === "result" ? "text-muted" : "text-ink-2")}>{children}</span>
    </li>
  );
}

export function Agents() {
  return (
    <Section id="agents" label="For AI agents">
      <Container>
        <Heading
          kicker="For AI agents"
          title="Agents request. Merchants approve."
          rest="Money never moves without the merchant."
          lede="Exhibit ships an MCP server, so Claude, ChatGPT or an agent built on PayPal's Agent Toolkit can triage and prepare disputes. No tool files with PayPal, moves money or messages a buyer. An agent can only ask."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Panel>
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <span className="text-[12.5px] font-medium text-ink">Claude, with only Exhibit&apos;s MCP server attached</span>
              <span className="num shrink-0 text-[11px] text-muted">57 s · 10 tool calls</span>
            </div>
            <ol className="divide-y divide-line/70 px-4 sm:px-5">
              {TRANSCRIPT.map((l, i) => (
                <Line key={i} who={l.who}>
                  {l.text}
                </Line>
              ))}
            </ol>
          </Panel>

          <div className="flex flex-col gap-5">
            <Panel>
              <div className="border-b border-line px-5 py-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">What the merchant sees in Exhibit</div>
              <div className="px-5 py-4">
                <p className="text-[13px] text-muted">An AI agent (Claude Code) requests:</p>
                <p className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-ink">File evidence with PayPal</p>
                <p className="num mt-1 text-[12px] text-muted">PP-D-50211 · Megan Hale · $284 · item not received</p>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-2">Exhibit files the response letter and a 3-exhibit PDF packet with PayPal, covering proof of fulfillment, proof of delivery signature. Win likelihood 88%.</p>
                <div className="mt-4 flex gap-2" aria-hidden>
                  <span className="inline-flex h-8 items-center rounded-lg border border-line-strong px-3 text-[12.5px] font-medium text-ink">Reject</span>
                  <span className="inline-flex h-8 items-center rounded-lg bg-ink px-3 text-[12.5px] font-medium text-white">Approve and file</span>
                </div>
              </div>
            </Panel>

            <figure className="rounded-2xl border border-line bg-[#fafafa] px-5 py-4">
              <blockquote className="text-[16px] font-medium leading-snug tracking-[-0.01em] text-ink">“{PAYPAL_MCP_QUOTE.text}”</blockquote>
              <figcaption className="mt-2 text-[12.5px] leading-relaxed text-muted">
                PayPal Developer Blog,{" "}
                <a href={PAYPAL_MCP_QUOTE.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-ink-2 underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                  {PAYPAL_MCP_QUOTE.title}
                  <ArrowUpRight className="size-3" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
                , {PAYPAL_MCP_QUOTE.date}
              </figcaption>
              <p className="mt-3 border-t border-line pt-3 text-[13px] leading-relaxed text-ink-2">
                Exhibit holds money to the same rule. When the merchant approves, it re-reads the dispute from PayPal and checks the request still matches the latest brief. If the brief has changed, the request expires.
              </p>
            </figure>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Panel>
            <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
              <span className="text-[12.5px] font-medium text-ink">Runs next to PayPal&apos;s own MCP server</span>
              <span className="num text-[11px] text-muted">claude_desktop_config.json</span>
            </div>
            <pre className="num overflow-x-auto px-4 py-4 text-[11.5px] leading-[1.65] text-ink-2 sm:px-5">{CONFIG}</pre>
          </Panel>
          <div className="flex flex-col justify-center gap-3 px-1 text-[14px] leading-relaxed text-muted">
            <p>
              <span className="font-medium text-ink">Read tools</span> list cases, run an investigation, fetch the brief and the evidence packet, and report on prevention.
            </p>
            <p>
              <span className="font-medium text-ink">Request tools</span> queue a filing or a prevention fix for approval and return a link. The merchant approves in Exhibit, and the action runs through the same code path as their own button, logged as approved by the merchant.
            </p>
          </div>
        </div>

        <Provenance tone="demo" className="mt-6">
          Excerpts of a real run recorded Oct 20, 2026: Claude Opus 5.5 with only Exhibit&apos;s MCP server attached, on the demo merchant. Full transcript in{" "}
          <a href={`${GITHUB_URL}/blob/main/docs/MCP_DEMO.md`} target="_blank" rel="noopener noreferrer" className="text-ink-2 underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            docs/MCP_DEMO.md<span className="sr-only"> (opens in a new tab)</span>
          </a>
          .
        </Provenance>
      </Container>
    </Section>
  );
}
