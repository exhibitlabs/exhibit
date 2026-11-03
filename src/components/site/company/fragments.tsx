import "./company.css";
import { clsx } from "clsx";
import { ArrowRight, Bot, Check, ChevronRight, Copy, FileText, User, X } from "lucide-react";
import type { CSSProperties } from "react";
import { DEFAULT_AUTOPILOT, evaluateRules } from "@/lib/autopilot-rules";
import proof from "@/components/landing/records/proof.json";
import evalResults from "../../../../eval/results.json";
import { fmtApp } from "../facts";
import { FitBox } from "../FitBox";
import { ActivityCall, ActivityEvent, ApprovalRow } from "../fragments";
import { UiStatus } from "../ui";
import { NOV3, SANDBOX_CASES } from "./records";

// Product UI fragments for the company pages, rebuilt from the real app after its final design pass
// (AgentApprovals.tsx, ActivityView.tsx, ApiInspector.tsx, AutopilotView.tsx) with real values only. Times are UTC in
// the app's own format. Each root carries data-ui like the kit's fragments.

/**
 * Agent requests as the merchant saw the page on Nov 3, 2026: Claude Code's request waiting, and the app's own note
 * beside the queue (stacked, as the page lays it out below 1024 px).
 */
export function ApprovalRequest({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div data-ui className={clsx("s-ui s-co-apq", className)} style={style} role="group" aria-label={`Exhibit's approval queue: ${NOV3.client} asks to send the evidence packet to PayPal's chargeback review, waiting for the merchant`}>
      <section className="s-f-card s-co-float">
        <div className="s-ui-card__head">
          <div>Waiting for you</div>
          <span>1 request</span>
        </div>
        <ApprovalRow />
      </section>
      <section className="s-f-card s-co-float s-co-apq__aside">
        <p className="s-co-apq__h">Agents ask. You decide.</p>
        <p>Exhibit runs as an MCP server. Claude Desktop, or an agent built on PayPal&apos;s Agent Toolkit, can triage, investigate and pull evidence packets on its own.</p>
        <p>Anything that reaches PayPal or a buyer arrives here as a request. Approving runs the same code as your own File button and logs it under the agent&apos;s name. Exhibit re-reads the dispute and checks the brief hasn&apos;t changed since the agent asked (a request against an older brief expires instead of running); PayPal rejects any action it no longer allows.</p>
        <span className="s-co-apq__link">
          Connect an agent <ArrowRight aria-hidden />
        </span>
      </section>
    </div>
  );
}

/**
 * The PayPal activity timeline around the Nov 3 approval, newest first, as the app lists it: seven contiguous rows.
 * The calls are in records/proof.json; the three rows that aren't calls (the request, the approval, the filing) read
 * as the app titles them on the sandbox's PayPal activity page (activity rows 287 to 292).
 */
const TRAIL_CALLS = proof.calls.filter((c) => c.disputeId === NOV3.disputeId && c.at >= "2026-11-03T02:38" && c.at <= "2026-11-03T02:40");
const call = (debugId: string) => TRAIL_CALLS.find((c) => c.debugId === debugId)!;
const ON = ` on ${NOV3.disputeId}`;

function TrailRows() {
  return (
    <ol className="s-f-act">
      <ActivityCall c={call("f21447644fc3e")} />
      <ActivityEvent icon={User} strong title="Sent supporting info with a 6-exhibit packet" actor="Claude Code, approved by merchant" disputeId={NOV3.disputeId} at="2026-11-03T02:39:18Z" />
      <ActivityCall c={call(NOV3.call.debugId)} />
      <ActivityCall c={call("f482123aa7dc5")} />
      <ActivityEvent icon={User} strong title={`Merchant approved ${NOV3.client}'s request: ${NOV3.title}${ON}`} actor="Merchant" disputeId={NOV3.disputeId} at="2026-11-03T02:39:14Z" />
      <ActivityCall c={call("f9266683bf3aa")} />
      <ActivityEvent icon={Bot} title={`${NOV3.client} requested approval: ${NOV3.title}${ON}`} actor={NOV3.client} disputeId={NOV3.disputeId} at="2026-11-03T02:38:15Z" />
    </ol>
  );
}

/** The audit log for the approved filing of Nov 3, 2026: the app's timeline at its 1440 px width, scaled to the window. */
export function AuditTrail({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div data-ui className={clsx("s-ui s-ui-window", className)} style={style} role="group" aria-label="Exhibit's PayPal activity for the approved filing of Nov 3, 2026, newest first">
      <div className="s-f-act--desk">
        <FitBox width={813} height={472} ratio max={1} fallback={0.76}>
          <TrailRows />
        </FitBox>
      </div>
      <div className="s-f-act--phone">
        <TrailRows />
      </div>
    </div>
  );
}

/** One logged PayPal call as the app's request inspector shows it: the Nov 3 filing, exactly as stored. */
export function CallInspector({ className, style }: { className?: string; style?: CSSProperties }) {
  const c = NOV3.call;
  const body = JSON.stringify({ multipart: [{ name: "input", json: { notes: `${c.notesStart} …` } }, { name: "supporting-document", file: c.file, bytes: c.bytes }] }, null, 2);
  const response = JSON.stringify({ links: [{ href: c.response.href, rel: c.response.rel, method: c.response.method }] }, null, 2);
  const curl = `curl -X ${c.method} 'https://api-m.sandbox.paypal.com${c.path}' \\\n  -H 'Authorization: Bearer $PAYPAL_ACCESS_TOKEN'`;
  return (
    <div data-ui className={clsx("s-ui s-ui-sheet s-co-insp", className)} style={style} role="group" aria-label="The stored record of one PayPal call, in Exhibit's request inspector">
      <div className="s-co-insp__hd">
        <div className="min-w-0">
          <p className="s-co-insp__env">PayPal sandbox · live API</p>
          <p className="s-co-insp__line">
            <span className="s-f-act__m">{c.method}</span>
            <span className="s-ui-mono s-co-insp__path">{c.path}</span>
          </p>
        </div>
        <span className="s-f-dr__x" aria-hidden>
          <X />
        </span>
      </div>
      <div className="s-co-insp__body">
        <dl className="s-co-insp__dl">
          <div>
            <dt>Status</dt>
            <dd>
              <UiStatus code={c.status} />
            </dd>
          </div>
          <div>
            <dt>Latency</dt>
            <dd className="s-ui-mono">{c.ms} ms</dd>
          </div>
          <div className="s-co-insp__wide">
            <dt>When</dt>
            <dd>{fmtApp("2026-11-03T02:39:18Z")}</dd>
          </div>
          <div className="s-co-insp__wide">
            <dt>PayPal-Debug-Id</dt>
            <dd className="s-co-insp__id">
              <span className="s-ui-mono">{c.debugId}</span>
              <CopyChip />
            </dd>
          </div>
          <div className="s-co-insp__wide">
            <dt>PayPal-Request-Id</dt>
            <dd>
              <span className="s-ui-mono">none (not idempotent)</span>
            </dd>
          </div>
        </dl>
        <section>
          <div className="s-co-insp__h">
            <b>Request</b>
            <span>The Authorization header is never stored</span>
          </div>
          <div className="s-co-insp__headers s-ui-mono">
            <div>
              <span>Accept:</span> {c.headers.Accept}
            </div>
            <div>
              <span>Content-Type:</span> {c.headers["Content-Type"]}
            </div>
            <div>
              <span>Authorization:</span> Bearer [redacted]
            </div>
          </div>
          <Json text={body} />
        </section>
        <section>
          <div className="s-co-insp__h">
            <b>Response</b>
          </div>
          <Json text={response} />
        </section>
        <section>
          <div className="s-co-insp__h">
            <b>Reproduce</b>
            <span>bring your own sandbox token</span>
          </div>
          <Json text={curl} />
        </section>
      </div>
    </div>
  );
}

function CopyChip() {
  return (
    <span className="s-co-copychip" aria-hidden>
      <Copy />
      Copy
    </span>
  );
}

function Json({ text }: { text: string }) {
  return (
    <div className="s-co-json">
      <pre className="s-ui-mono">{text}</pre>
      <CopyChip />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- Autopilot
function Toggle({ on }: { on: boolean }) {
  return <span className={clsx("s-co-tg", on && "s-co-tg--on")} aria-hidden />;
}

function Money({ value }: { value: number }) {
  return (
    <span className="s-co-money">
      <span>$</span>
      <span className="s-ui-mono">{value}</span>
    </span>
  );
}

function Rule({ title, body, on, children }: { title: string; body: string; on: boolean; children?: React.ReactNode }) {
  return (
    <div className="s-co-rule">
      <Toggle on={on} />
      <div className="s-co-rule__tx">
        <div className="s-co-rule__top">
          <b>{title}</b>
          <span>no past cases</span>
        </div>
        <p>{body}</p>
        {children ? <div className={clsx("s-co-rule__ctl", !on && "is-off")}>{children}</div> : null}
      </div>
    </div>
  );
}

const usd2 = (n: number) => `$${n.toFixed(2)}`;
const CALL: Record<string, string> = { FIGHT: "Fight", REFUND: "Refund" };

/**
 * Autopilot as it ships (off, with its default rules) and the app's "Your open cases under these rules" for the three
 * open sandbox chargebacks. Verdicts and reasons come from the app's own evaluateRules(), on the latest brief per case.
 */
export function AutopilotPanel({ className }: { className?: string }) {
  const s = DEFAULT_AUTOPILOT;
  const on = { ...s, enabled: true };
  const open = SANDBOX_CASES.filter((c) => c.status !== "RESOLVED")
    .sort((a, b) => b.id.localeCompare(a.id))
    .map((c) => ({ ...c, verdict: evaluateRules({ decision: c.decision, confidence: c.confidence, win_likelihood: c.likelihood }, c.amount, on) }));
  const auto = open.filter((r) => r.verdict.verdict === "AUTO");
  const knob = ((s.fight.minLikelihood - 60) / 40) * 100;
  return (
    <div data-ui className={clsx("s-ui s-co-ap", className)} role="group" aria-label="Exhibit's Autopilot page: off, with the default rules, and what they would do with the three open sandbox chargebacks">
      <section className="s-f-card s-co-ap__switch">
        <Toggle on={false} />
        <div>
          <p className="s-co-ap__h">Autopilot off</p>
          <p className="s-co-ap__p">When it&apos;s on and an investigation finishes with a brief inside the rules below, Exhibit sends the response itself: for a new dispute from PayPal&apos;s webhook, a case you run, or a batch. Investigations an outside agent starts through MCP, and briefs prepared at a demo reset, never act on their own.</p>
        </div>
      </section>
      <section className="s-f-card">
        <Rule title="File evidence on strong cases" body="Submit the evidence packet when the case is strong and the amount is modest." on={s.fight.enabled}>
          <span className="s-co-rule__f">
            Win likelihood at least
            <span className="s-co-range" aria-hidden>
              <i style={{ width: `${knob}%` }} />
              <b style={{ left: `${knob}%` }} />
            </span>
            <span className="s-co-rule__n">{s.fight.minLikelihood}%</span>
          </span>
          <span className="s-co-rule__f">
            and up to <Money value={s.fight.maxAmount} />
          </span>
        </Rule>
        <Rule title="Refund when the buyer is right" body="When Exhibit finds the merchant at fault, refund small claims at once instead of paying fees to lose them." on={s.refund.enabled}>
          <span className="s-co-rule__f">
            Up to <Money value={s.refund.maxAmount} />
          </span>
        </Rule>
        <Rule title="Send fair offers" body="Propose a partial refund, return or replacement in the inquiry stage." on={s.offers.enabled}>
          <span className="s-co-rule__f">
            When the offer is at most <Money value={s.offers.maxAmount} />
          </span>
        </Rule>
        <Rule title="Message buyers in the inquiry stage" body="Reply in the buyer's language with the facts: often enough to close the case before it escalates." on={s.messages.enabled} />
      </section>
      <section className="s-f-card">
        <div className="s-co-ap__casehd">
          <p className="s-co-ap__h2">Your open cases under these rules</p>
          <p className="s-co-ap__sub">
            {auto.length} of {open.length} briefed cases (${auto.reduce((a, r) => a + r.amount, 0)}) fall inside them. Saving doesn&apos;t act on a brief already written: Autopilot acts when a case&apos;s next investigation finishes.
          </p>
        </div>
        <ul className="s-co-ap__cases">
          {open.map((r) => (
            <li key={r.id}>
              <div className="min-w-0 flex-1">
                <p className="s-co-ap__who">
                  <b>{r.buyer}</b>
                  <span className="s-ui-mono">{usd2(r.amount)}</span>
                  <span>· {CALL[r.decision] ?? r.decision}</span>
                </p>
                <p className="s-co-ap__why">{r.verdict.reason}</p>
              </div>
              <span className={r.verdict.verdict === "AUTO" ? "s-co-ap__v s-co-ap__v--auto" : "s-co-ap__v"}>{r.verdict.verdict === "AUTO" ? "Exhibit alone" : "Waits for you"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------- Investigation trace
const INR07 = evalResults.cases.find((c) => c.id === "inr-07")!;

function TraceStep({ ok, summary }: { ok: boolean; summary: string }) {
  return (
    <div className="s-co-step">
      <FileText className="s-co-step__ic" strokeWidth={1.7} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="s-co-step__top">
          <b>Case brief</b>
          <span className="s-ui-mono s-co-step__tool">file_case_brief</span>
          <span className="s-co-step__r">
            {ok ? <Check className="s-co-step__ok" strokeWidth={2.4} aria-label="Passed" /> : <X className="s-co-step__no" strokeWidth={2.4} aria-label="Rejected" />}
            <ChevronRight className="s-co-step__chev" aria-hidden />
          </span>
        </p>
        <p className={ok ? "s-co-step__sum" : "s-co-step__sum s-co-step__sum--err"}>{summary}</p>
      </div>
    </div>
  );
}

/**
 * Two steps of the evaluation run on case inr-07 as the case page's Investigation tab lists them (CaseWorkspace.tsx and
 * AgentTrace.tsx ToolStep): the first brief, rejected by file_case_brief's own check, then the fixed one. Values from
 * eval/results.json; the harness doesn't keep each step's milliseconds, so they are left out.
 */
export function TraceRejection({ className }: { className?: string }) {
  const c = INR07;
  return (
    <div data-ui className={clsx("s-ui s-ui-card s-co-trace", className)} role="group" aria-label="A rejected brief and its fix, in the agent's trace">
      <div className="s-co-trace__hd">
        <span className="s-co-trace__t">
          <i aria-hidden />
          Investigation
          <span>
            · {c.tools.length} tool calls · {(c.minutes * 60).toFixed(1)} s
          </span>
        </span>
        <span className="s-co-trace__m">{c.models[0]}</span>
      </div>
      <div className="s-co-trace__body">
        <TraceStep ok={false} summary={`Brief rejected: ${c.guardrails.rejections[0].detail}`} />
        <TraceStep ok summary={`${c.decision} · ${c.win_likelihood}% · ${c.exhibits} exhibit(s)`} />
      </div>
    </div>
  );
}
