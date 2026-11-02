import { RUNS, type RunRecord } from "./hero-data";
import { Container, DecisionPill, Heading, Panel, Provenance, Section, sentences, utcDateTime } from "./Primitives";
import demo from "./records/demo-briefs.json";
import proof from "./records/proof.json";

const REASON: Record<string, string> = { MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received", CREDIT_NOT_PROCESSED: "Credit not processed", UNAUTHORISED: "Unauthorized" };

/** The opening of the agent's note to the buyer: greeting, apology, and the line about the money. */
function noteLines(text: string) {
  const paras = text.split("\n").map((p) => p.trim()).filter(Boolean);
  const greeting = paras[0];
  const all = sentences(paras.slice(1, 3).join(" "));
  const first = all[0];
  const money = all.find((s) => /coming back|refund/i.test(s) && s !== first);
  return { greeting, first, money };
}

function RefundCard({ run }: { run: RunRecord }) {
  const call = proof.writes.find((w) => w.disputeId === run.disputeId && w.path.endsWith("/accept-claim"));
  const note = run.brief.buyerMessage ? noteLines(run.brief.buyerMessage.text) : null;
  return (
    <Panel className="flex flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-ink">{run.claim.buyer}</div>
          <div className="text-[12.5px] text-muted">
            {REASON[run.claim.reason ?? ""] ?? run.claim.reason} · <span className="num">${run.claim.amount}</span> chargeback
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <DecisionPill decision="REFUND" />
          <span className="num text-[11px] text-muted">{run.brief.winLikelihood}% if fought</span>
        </div>
      </div>
      <div className="flex-1 px-5 py-4">
        <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">{run.brief.headline}</p>
        {note ? (
          <figure className="mt-4 rounded-xl bg-[#fafafa] px-4 py-3.5">
            <figcaption className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Exhibit&apos;s note to the buyer</figcaption>
            <blockquote className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-ink-2">
              <p>{note.greeting}</p>
              <p>{note.first}</p>
              {note.money ? <p>{note.money}</p> : null}
            </blockquote>
          </figure>
        ) : null}
      </div>
      {call ? (
        <div className="num flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-5 py-3 text-[11px] text-muted">
          <span className="text-ink-2">POST …/accept-claim</span>
          <span className="rounded bg-green-soft px-1.5 py-0.5 font-medium text-green">{call.status}</span>
          <span>{call.ms.toLocaleString("en-US")} ms</span>
          <span>debug id {call.debugId}</span>
          <span>{utcDateTime(call.at)}</span>
        </div>
      ) : null}
    </Panel>
  );
}

const ORDER = ["FIGHT", "OFFER", "MESSAGE_BUYER", "REFUND"] as const;
const LABEL: Record<(typeof ORDER)[number], string> = { FIGHT: "Fight", OFFER: "Offer", MESSAGE_BUYER: "Message the buyer", REFUND: "Refund" };

export function Fair() {
  const counts = ORDER.map((d) => ({ d, n: demo.cases.filter((c) => c.decision === d).length }));
  const total = demo.cases.length;
  return (
    <Section id="fair" label="Fair to buyers">
      <Container>
        <Heading
          kicker="Fair to buyers"
          title="When the buyer is right, Exhibit refunds."
          rest="PayPal puts buyers first. So does Exhibit."
          lede="It tells you when a case can't be won, refunds, and writes to the buyer. You skip a fight you would lose, the buyer gets their money back sooner, and a dispute that is never filed carries no fee."
        />

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <RefundCard run={RUNS.refund} />
          <RefundCard run={RUNS.refund2} />
        </div>
        <Provenance className="mt-5">
          Two sandbox chargebacks. Exhibit refused to fight both, and the merchant accepted the claims through PayPal&apos;s API. Buyer names and store records are demo data.
        </Provenance>

        <div className="mt-14 grid gap-6 border-t border-line pt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-center md:gap-12">
          <div>
            <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">Fight is one of four answers.</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
              On the demo merchant&apos;s {total} open cases, Exhibit chose to fight {counts[0].n}. For the rest it offered a fix, wrote to the buyer, or refunded.
            </p>
          </div>
          <div>
            <div className="flex h-9 w-full overflow-hidden rounded-lg" role="img" aria-label={counts.map((c) => `${LABEL[c.d]}: ${c.n}`).join(", ")}>
              {counts.map((c, i) => (
                <div
                  key={c.d}
                  className="flex items-center justify-center text-[12px] font-medium"
                  style={{ width: `${(c.n / total) * 100}%`, background: ["#0a0a0a", "#5c5c5c", "#a3a3a3", "#e5e5e5"][i], color: i < 2 ? "#fff" : "#0a0a0a" }}
                >
                  <span className="num">{c.n}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-muted">
              {counts.map((c, i) => (
                <span key={c.d} className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm ring-1 ring-black/10" style={{ background: ["#0a0a0a", "#5c5c5c", "#a3a3a3", "#e5e5e5"][i] }} aria-hidden />
                  {LABEL[c.d]} <span className="num text-muted">{c.n}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
