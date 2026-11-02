import { ArrowLink, ButtonLink, Container, Heading, Panel, Section, utcDateTime } from "./Primitives";
import { describe, disputeActions, failedWrites, NOT_LIVE, PROOF, shortPath } from "./proof-data";

export function ProofSummary() {
  const t = PROOF.totals;
  return (
    <Section id="proof" label="Proof" className="border-t border-line">
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <Heading
            kicker="Proof"
            title="Verified on the live PayPal sandbox."
            rest="Every call is on the record."
            lede="Real chargebacks, real API calls and PayPal debug ids, from Exhibit's own log. Plus a plain list of what hasn't been tested live."
          />
          <ButtonLink href="/proof" variant="secondary" className="shrink-0 self-start md:self-auto">
            See all {t.calls} calls
          </ButtonLink>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <Panel>
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
              <span className="text-[12.5px] font-medium text-ink">Dispute responses filed through the API</span>
              <span className="num text-[11px] text-muted">{PROOF.host}</span>
            </div>
            <ul className="divide-y divide-line">
              {disputeActions.map((w) => (
                <li key={w.debugId} className="px-4 py-3 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-ink">{describe(w).label}</div>
                      <div className="num mt-0.5 truncate text-[11.5px] text-muted">
                        POST {shortPath(w.path)} · {w.disputeId}
                      </div>
                    </div>
                    <span className="num shrink-0 rounded bg-green-soft px-1.5 py-0.5 text-[11.5px] font-medium text-green">{w.status}</span>
                  </div>
                  <div className="num mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted">
                    <span>{utcDateTime(w.at)}</span>
                    <span>{w.ms.toLocaleString("en-US")} ms</span>
                    <span>PayPal-Debug-Id {w.debugId}</span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-line bg-[#fafafa] px-4 py-3 text-[12.5px] leading-relaxed text-muted sm:px-5">
              {failedWrites.length} filing attempts failed along the way (HTTP {failedWrites.map((f) => f.status).join(" and ")}). They are on the proof page, with what we changed because of them.
            </div>
          </Panel>

          <div className="flex flex-col gap-5">
            <Panel>
              <dl className="grid grid-cols-2">
                {[
                  [t.calls, "API calls logged"],
                  [t.ok, "returned 2xx"],
                  [t.disputes, "sandbox chargebacks"],
                  [t.endpoints, "endpoints"],
                ].map(([v, k], i) => (
                  <div key={k as string} className={`flex flex-col gap-1 px-5 py-4 ${i % 2 ? "border-l border-line" : ""} ${i > 1 ? "border-t border-line" : ""}`}>
                    <dt className="order-2 text-[12.5px] text-muted">{k}</dt>
                    <dd className="num order-1 text-[22px] leading-none tracking-[-0.02em] text-ink">{v}</dd>
                  </div>
                ))}
              </dl>
            </Panel>
            <Panel className="flex-1">
              <div className="border-b border-line px-5 py-3 text-[12.5px] font-medium text-ink">Not tested live yet</div>
              <ul className="divide-y divide-line">
                {NOT_LIVE.map((n) => (
                  <li key={n.what} className="px-5 py-3">
                    <div className="text-[13px] font-medium text-ink">{n.what}</div>
                    <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{n.why}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
        <p className="mt-5 text-[13px] text-muted">
          Exported from Exhibit&apos;s database with no credentials, request bodies or buyer emails. <ArrowLink href="/proof">Open the proof page</ArrowLink>
        </p>
      </Container>
    </Section>
  );
}
