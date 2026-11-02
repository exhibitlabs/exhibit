import { EVALUATION, PAYPAL_FEES, PRICING } from "./data";
import { ArrowLink, Container, Heading, Panel, Section } from "./Primitives";

export function Money() {
  return (
    <Section id="money" label="The money" className="border-t border-line bg-[#fafafa]">
      <Container>
        <Heading kicker="The money" title="Every dispute can carry a PayPal fee." rest="These are PayPal's published US fees. A dispute that is never filed costs nothing." />

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {PAYPAL_FEES.fees.map((f) => (
            <Panel key={f.label} className="px-5 py-5">
              <div className="num text-[34px] leading-none tracking-[-0.03em] text-ink">${f.amount}</div>
              <div className="mt-3 text-[14px] font-medium text-ink">{f.label}</div>
              <div className="mt-1 text-[12.5px] leading-snug text-muted">{f.note}</div>
            </Panel>
          ))}
        </div>
        <figure className="mt-5 flex flex-col gap-2 text-[13px] leading-relaxed text-muted md:flex-row md:items-baseline md:justify-between md:gap-8">
          <blockquote className="text-ink-2">“{PAYPAL_FEES.quote}”</blockquote>
          <figcaption className="shrink-0">
            <ArrowLink href={PAYPAL_FEES.url} external className="text-[13px]">
              PayPal merchant fees
            </ArrowLink>
            <span className="ml-2 text-muted">
              updated {PAYPAL_FEES.updated}, checked {PAYPAL_FEES.retrieved}
            </span>
          </figcaption>
        </figure>
        <p className="mt-3 max-w-[720px] text-[13px] leading-relaxed text-muted">PayPal&apos;s page does not say whether the fee is returned when the seller wins.</p>

        {EVALUATION ? (
          <Panel className="mt-10">
            <dl className="grid sm:grid-cols-3">
              {[
                [`${EVALUATION.agreementRate}%`, `agreement with labelled decisions, ${EVALUATION.cases} cases`],
                [`${EVALUATION.minutesPerCase} min`, "median time to a finished brief"],
                ...(EVALUATION.correctlyRefunded != null ? [[`${EVALUATION.correctlyRefunded}%`, "of should-refund cases refunded"]] : []),
              ].map(([v, k], i) => (
                <div key={k} className={`flex flex-col gap-1 px-5 py-5 ${i ? "border-t border-line sm:border-l sm:border-t-0" : ""}`}>
                  <dt className="order-2 text-[13px] text-muted">{k}</dt>
                  <dd className="num order-1 text-[28px] leading-none tracking-[-0.03em] text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-line px-5 py-3 text-[12.5px] text-muted">
              {EVALUATION.method}
              {EVALUATION.url ? (
                <>
                  {" "}
                  <ArrowLink href={EVALUATION.url} external className="text-[12.5px]">
                    Method and results
                  </ArrowLink>
                </>
              ) : null}
            </div>
          </Panel>
        ) : null}

        <div id="pricing" className="mt-14 scroll-mt-20 border-t border-line pt-10">
          <div className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
            <p className="num text-[11.5px] uppercase tracking-[0.12em] text-muted">{PRICING.label}</p>
            <div>
              <p className="max-w-[640px] text-[22px] font-semibold leading-snug tracking-[-0.02em] text-ink">{PRICING.line}</p>
              <p className="mt-2 text-[13.5px] text-muted">{PRICING.note}</p>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
