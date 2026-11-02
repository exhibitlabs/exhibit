import { Check, Minus } from "lucide-react";
import { PAYPAL_AGENT_TOOLS } from "./data";
import { ArrowLink, Container, Heading, Panel, Section } from "./Primitives";

type Row = { step: string; paypal?: string; exhibit: string; notLive?: boolean };

const ROWS: Row[] = [
  { step: "List open disputes", paypal: "list_disputes", exhibit: "Inbox sync, and list_disputes for agents" },
  { step: "Read a dispute", paypal: "get_dispute", exhibit: "Live case facts, deadline and allowed actions" },
  { step: "Accept the claim", paypal: "accept_dispute_claim", exhibit: "accept-claim, when the records say the buyer is right" },
  { step: "Investigate the order, delivery, messages and checkout", exhibit: "Eight sources, every claim cited to a record" },
  { step: "Submit evidence", exhibit: "provide-evidence, with a lettered PDF packet" },
  { step: "Add supporting info while PayPal reviews", exhibit: "provide-supporting-info" },
  { step: "Offer a refund, return or replacement", exhibit: "make-offer", notLive: true },
  { step: "Message the buyer", exhibit: "send-message, in the buyer's language", notLive: true },
  { step: "Stop a dispute before it is filed", exhibit: "Prevention radar and fixes" },
];

export function Gap() {
  return (
    <Section id="gap" label="PayPal's agent tools, completed">
      <Container>
        <Heading
          kicker="Built on PayPal's toolkit"
          title="PayPal's agent tools can list, read and accept a dispute."
          rest="Exhibit handles the rest of the case."
        />

        <Panel className="mt-12">
          <table className="w-full border-collapse text-left text-[13.5px]">
            <caption className="sr-only">What PayPal&apos;s agent tools cover, and what Exhibit adds</caption>
            <thead>
              <tr className="border-b border-line bg-[#fafafa] text-[11.5px] uppercase tracking-[0.08em] text-muted">
                <th scope="col" className="w-[40%] px-4 py-3 font-medium sm:px-6">Dispute lifecycle</th>
                <th scope="col" className="hidden px-4 py-3 font-medium sm:table-cell sm:px-6">PayPal agent tools</th>
                <th scope="col" className="px-4 py-3 font-medium sm:px-6">Exhibit</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.step} className="border-b border-line last:border-0">
                  <th scope="row" className="px-4 py-3.5 align-top font-medium text-ink sm:px-6">
                    {r.step}
                    {r.paypal ? <span className="num mt-1 block text-[11.5px] font-normal text-muted sm:hidden">PayPal: {r.paypal}</span> : null}
                  </th>
                  <td className="hidden px-4 py-3.5 align-top sm:table-cell sm:px-6">
                    {r.paypal ? (
                      <span className="flex items-center gap-2">
                        <Check className="size-3.5 shrink-0 text-muted" strokeWidth={2.5} aria-hidden />
                        <span className="num text-[12.5px] text-ink-2">{r.paypal}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-muted">
                        <Minus className="size-3.5 shrink-0" aria-hidden />
                        <span className="sr-only">Not in the toolkit</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 align-top sm:px-6">
                    <span className="flex items-start gap-2">
                      <Check className="mt-[3px] size-3.5 shrink-0 text-green" strokeWidth={2.75} aria-hidden />
                      <span className="text-ink-2">
                        {r.exhibit}
                        {r.notLive ? (
                          <sup className="ml-0.5 text-muted" aria-label="not yet run on the live sandbox">
                            *
                          </sup>
                        ) : null}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="mt-5 flex flex-col gap-3 text-[13px] leading-relaxed text-muted md:flex-row md:items-start md:justify-between md:gap-10">
          <p className="max-w-[640px]">
            Accepting the claim is the right call when the buyer is right, and Exhibit makes it. Everything else is the work a PayPal reviewer needs to see.{" "}
            <span className="text-muted">* Implemented and tested against the simulator. PayPal only allows offers and buyer messages at the inquiry stage, which sandbox chargebacks skip.</span>
          </p>
          <ArrowLink href={PAYPAL_AGENT_TOOLS.url} external className="shrink-0 text-[13px]">
            PayPal agent tools reference
          </ArrowLink>
        </div>
      </Container>
    </Section>
  );
}
