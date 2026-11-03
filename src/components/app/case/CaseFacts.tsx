"use client";

import { CheckCircle2, CircleDashed } from "lucide-react";
import type { CaseFile } from "@/lib/disputes";
import { dateTime, shortDate, usd } from "@/lib/format";
import { Chip } from "../../ui/Chip";

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card border px-5 py-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Row({ k, v, mono }: { k: string; v: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-rule py-1.5 text-[13px] last:border-0">
      <span className="shrink-0 text-muted">{k}</span>
      <span className={`min-w-0 text-right text-ink ${mono ? "mono text-[12px] leading-5" : ""}`}>{v}</span>
    </div>
  );
}

export function CaseFacts({ cf }: { cf: CaseFile }) {
  const d = cf.dispute;
  const t = d.disputed_transactions[0];
  const out = cf.shipments.find((s) => s.direction === "OUTBOUND");
  const ret = cf.shipments.find((s) => s.direction === "RETURN");
  const a = cf.order?.shipping_address;
  return (
    <div className="space-y-4">
      <Section title="Buyer's claim">
        {(d.messages ?? []).filter((m) => m.posted_by === "BUYER").length ? (
          <div className="space-y-2">
            {(d.messages ?? [])
              .filter((m) => m.posted_by === "BUYER")
              .map((m, i) => (
                <blockquote key={i} className="border-l-2 border-line-strong pl-3 text-[14px] leading-[22px] text-ink">
                  “{m.content}”<div className="mt-1 text-[12px] text-muted">{t?.buyer?.name} via PayPal · {dateTime(m.time_posted)}</div>
                </blockquote>
              ))}
          </div>
        ) : (
          <p className="text-[13px] leading-[20px] text-muted">{d.dispute_channel === "EXTERNAL" ? "Filed with the card issuer. No buyer message is passed through." : "No message from the buyer."}</p>
        )}
        {d.extensions?.merchandize_dispute_properties?.product_details?.sub_reasons?.length ? (
          <div className="mt-2 flex gap-1.5">
            {d.extensions.merchandize_dispute_properties.product_details.sub_reasons.map((r) => (
              <Chip key={r}>{r.toLowerCase()}</Chip>
            ))}
          </div>
        ) : null}
      </Section>

      <Section title="PayPal transaction">
        <Row k="Transaction" v={t?.seller_transaction_id ?? "—"} mono />
        <Row k="Amount" v={usd(Number(d.dispute_amount.value))} mono />
        <Row k="Channel" v={d.dispute_channel === "EXTERNAL" ? `Card issuer${d.external_reason_code ? ` · code ${d.external_reason_code}` : ""}` : "PayPal Resolution Center"} />
        <Row k="Opened" v={dateTime(d.create_time)} />
        <Row k="Buyer" v={t?.buyer?.email ?? t?.buyer?.name ?? "—"} />
      </Section>

      {cf.order ? (
        <Section title="Order" aside={<span className="mono text-[12px] text-muted">{cf.order.id}</span>}>
          {cf.order.items.map((i) => (
            <div key={i.sku} className="flex justify-between gap-4 py-1 text-[14px]">
              <span className="text-ink">{i.name}</span>
              <span className="mono text-[13px] text-ink">{usd(i.unit_price * i.qty)}</span>
            </div>
          ))}
          <div className="mt-2 border-t border-line pt-2 text-[13px] leading-[19px] text-ink-2">
            <div className="mb-0.5 text-[12px] text-muted">Ship to, as on the PayPal transaction</div>
            {a ? `${a.name}, ${a.line1}${a.line2 ? `, ${a.line2}` : ""}, ${a.city}${a.state ? `, ${a.state}` : ""} ${a.postal_code}, ${a.country}` : "—"}
          </div>
        </Section>
      ) : (
        <Section title="Order">
          <p className="text-[13px] text-muted">No store order matches this transaction.</p>
        </Section>
      )}

      {out ? (
        <Section
          title="Tracking"
          aside={<Chip tone={out.status === "DELIVERED" ? "green" : out.status === "RETURNED_TO_SENDER" ? "red" : "neutral"}>{out.status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</Chip>}
        >
          <div className="mb-3 flex items-center justify-between gap-3 text-[13px]">
            <span className="font-medium text-ink">{out.carrier.replace(/_/g, " ")}</span>
            <a href={out.tracking_url} target="_blank" rel="noreferrer" className="mono rounded-[4px] text-[12px] text-ink-2 underline decoration-line-strong underline-offset-2 hover:text-ink hover:decoration-ink">
              {out.tracking_number}
            </a>
          </div>
          <ol className="relative ml-1 space-y-2.5 border-l border-line pl-4">
            {out.events
              .slice()
              .reverse()
              .map((e, i) => (
                <li key={i} className="relative text-[13px] leading-[19px]">
                  <span className={`absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-surface ${e.code === "DELIVERED" ? "bg-green" : e.code === "EXCEPTION" || e.code === "RETURNED" ? "bg-red" : "bg-[#c9c9c6]"}`} />
                  <div className={e.code === "DELIVERED" ? "font-medium text-ink" : "text-ink-2"}>{e.description}</div>
                  <div className="text-[12px] text-muted">
                    {e.location} · {dateTime(e.at)}
                  </div>
                </li>
              ))}
          </ol>
          {out.signature ? <div className="mt-3 text-[13px] text-ink-2">Signed by {out.signature.name}</div> : null}
          <div className="mt-2 flex items-center gap-1.5 text-[13px] text-muted">
            {out.pushed_to_paypal ? <CheckCircle2 className="size-3.5 text-green" /> : <CircleDashed className="size-3.5 text-ghost" />}
            {out.pushed_to_paypal ? "Tracking on file with PayPal" : "Tracking never sent to PayPal"}
          </div>
          {ret ? (
            <div className="mt-3 rounded-[8px] bg-sunken px-3 py-2 text-[13px] text-ink-2">
              Return {ret.carrier} <span className="mono text-[12px]">{ret.tracking_number}</span>: {ret.status === "DELIVERED" ? `delivered to us ${shortDate(ret.delivered_at)}` : ret.status.toLowerCase()}
            </div>
          ) : null}
        </Section>
      ) : null}

      {cf.customer ? (
        <Section title="Customer">
          <Row k="Customer since" v={shortDate(cf.customer.first_order_at)} />
          <Row k="Orders" v={cf.customer.order_ids.length} />
          <Row k="Lifetime value" v={usd(cf.customer.lifetime_value, 0)} mono />
          <Row k="Prior disputes" v={cf.customer.prior_disputes} />
        </Section>
      ) : null}

      {cf.risk ? (
        <Section title="Checkout signals">
          <Row k="AVS / CVV" v={`${cf.risk.avs_result ?? "–"} / ${cf.risk.cvv_result ?? "–"}`} />
          <Row k="3-D Secure" v={cf.risk.three_ds?.toLowerCase() ?? "–"} />
          <Row k="IP location" v={`${cf.risk.ip.city}, ${cf.risk.ip.country} · ${cf.risk.ip_to_shipping_km} km`} />
          <Row k="Device" v={cf.risk.device.seen_before ? "Known device" : "New device"} />
        </Section>
      ) : null}
    </div>
  );
}
