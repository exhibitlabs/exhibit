import { clsx } from "clsx";
import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import { RUNS } from "./hero-data";
import { Container, Heading, Panel, Provenance, Section, utcDateTime } from "./Primitives";
import proof from "./records/proof.json";

const run = RUNS.fight;
const filings = proof.writes.filter((w) => w.disputeId === run.disputeId && w.status < 400);
const dispute = proof.disputes.find((d) => d.id === run.disputeId);

function Step({ n, title, body, children, className }: { n: string; title: string; body: ReactNode; children: ReactNode; className?: string }) {
  return (
    <li className={clsx("flex min-w-0 flex-col", className)}>
      <div className="flex items-baseline gap-3">
        <span className="num text-[12px] text-muted">{n}</span>
        <h3 className="text-[17px] font-semibold tracking-[-0.015em] text-ink">{title}</h3>
      </div>
      <p className="mt-2 max-w-[480px] text-[14.5px] leading-relaxed text-muted">{body}</p>
      <div className="mt-5 flex-1">{children}</div>
    </li>
  );
}

function Field({ k, v, mono = true }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <dt className="shrink-0 text-[12.5px] text-muted">{k}</dt>
      <dd className={clsx("min-w-0 truncate text-right text-[12.5px] text-ink", mono && "num")}>{v}</dd>
    </div>
  );
}

const REF_TONE: Record<string, string> = { shipment: "Carrier", order: "Order", risk: "Checkout", msg: "Message", conversation: "Messages", customer: "Customer", paypal: "PayPal", policy: "Policy", listing: "Listing" };

export function HowItWorks() {
  const reasoning = [run.brief.reasoning[1], run.brief.reasoning[2], run.brief.reasoning[3]];
  return (
    <Section id="how" label="How it works" className="border-t border-line bg-[#fafafa]">
      <Container>
        <Heading
          kicker="How it works"
          title="One real case, start to finish."
          rest="On the PayPal sandbox."
          lede={`${run.claim.buyer}'s card issuer says he never authorized a $${run.claim.amount} briefcase. Here is what Exhibit did with the chargeback, from the first API call to the filing.`}
        />

        <ol className="mt-14 grid grid-cols-1 gap-x-10 gap-y-14 md:grid-cols-2">
          <Step n="01" title="PayPal opens a chargeback" body="Exhibit pulls the case from the Disputes API, including the actions PayPal allows on it right now. It will only ever propose one of those.">
            <Panel>
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="text-[12.5px] font-medium text-ink">PayPal dispute</span>
                <span className="num text-[12px] text-muted">{run.disputeId}</span>
              </div>
              <dl className="px-4 py-1.5">
                <Field k="Reason" v={`${run.claim.reason} · code ${run.claim.reasonCode}`} />
                <Field k="Stage" v={run.claim.stage} />
                <Field k="Amount" v={`$${run.claim.amount.toFixed(2)} ${run.claim.currency}`} />
                <Field k="Status" v={run.claim.status} />
                <Field k="Seller can" v={<span className="rounded bg-sunken px-1.5 py-0.5">provide_supporting_info</span>} />
              </dl>
            </Panel>
          </Step>

          <Step n="02" title="It checks every claim against a record" body="Each point in the brief cites the records it rests on. A brief that cites anything its tools never returned is rejected, and the agent has to fix it.">
            <Panel className="divide-y divide-line">
              {reasoning.map((r) => (
                <div key={r.point} className="px-4 py-3.5">
                  <p className="text-[13px] leading-relaxed text-ink-2">{r.point}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.refs.map((ref) => (
                      <span key={ref} className="num inline-flex items-center gap-1 rounded-md border border-line bg-[#fafafa] px-1.5 py-0.5 text-[11px] text-ink-2">
                        <span className="text-muted">{REF_TONE[ref.split(":")[0]] ?? "Record"}</span>
                        {ref}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </Panel>
          </Step>

          <Step n="03" title="It builds the evidence packet" body="A letter for PayPal's reviewer and a PDF of lettered exhibits. Exhibits are rendered from your records, never from the model's text.">
            <Panel className="p-5">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
                <FileText className="size-3.5" aria-hidden /> Response to PayPal · {run.disputeId}
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-ink">{run.brief.letterOpening}</p>
              <ul className="mt-4 grid gap-1.5 border-t border-line pt-4">
                {run.brief.exhibits.map((x) => (
                  <li key={x.label} className="flex min-w-0 items-center gap-2.5 text-[12.5px]">
                    <span className="num flex size-[18px] shrink-0 items-center justify-center rounded bg-ink text-[10px] font-semibold text-white">{x.label}</span>
                    <span className="truncate text-ink-2">{x.title}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </Step>

          <Step n="04" title="You approve. It files." body="Nothing reaches PayPal until you approve. Then Exhibit files through the API and keeps the status, latency and PayPal debug id of every call.">
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3">
                <span className="text-[12.5px] font-medium text-ink">Filed on the sandbox</span>
                <span className="flex items-center gap-1.5 text-[12px] text-muted">
                  <span className="size-1.5 rounded-full bg-green" aria-hidden /> PayPal status: {dispute?.status ?? "UNDER_REVIEW"}
                </span>
              </div>
              <ul className="divide-y divide-line">
                {filings.map((f) => (
                  <li key={f.debugId} className="px-4 py-3">
                    <div className="num flex items-center gap-2 text-[12px]">
                      <span className="font-medium text-ink">POST</span>
                      <span className="min-w-0 truncate text-ink-2">…/disputes/{"{id}"}/{f.path.split("/").at(-1)}</span>
                      <span className="ml-auto shrink-0 rounded bg-green-soft px-1.5 py-0.5 font-medium text-green">{f.status}</span>
                    </div>
                    <div className="num mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted">
                      <span>{utcDateTime(f.at)}</span>
                      <span>{f.ms.toLocaleString("en-US")} ms</span>
                      <span>debug id {f.debugId}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </Step>
        </ol>

        <Provenance className="mt-12">
          Every value above comes from Exhibit&apos;s records for dispute {run.disputeId}. The brief is from its latest run, on Oct 21; the filings on Oct 20 came from earlier runs on the same case. Store, carrier and buyer records belong to Kora Atelier, a demo merchant.
        </Provenance>
      </Container>
    </Section>
  );
}
