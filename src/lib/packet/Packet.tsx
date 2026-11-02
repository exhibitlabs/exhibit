import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { CaseBrief } from "../agent/brief";
import type { CaseFile } from "../disputes";
import type { ResolvedRef } from "../evidence";
import { REASON_LABEL, STAGE_LABEL } from "../paypal/types";
import type { Merchant } from "../store/types";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
let registered = false;
function registerFonts() {
  if (registered) return;
  Font.register({
    family: "Inter",
    fonts: [
      { src: path.join(FONT_DIR, "Inter-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "Inter-Medium.ttf"), fontWeight: 500 },
      { src: path.join(FONT_DIR, "Inter-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(FONT_DIR, "Inter-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: "Serif",
    fonts: [
      { src: path.join(FONT_DIR, "InstrumentSerif-Regular.ttf") },
      { src: path.join(FONT_DIR, "InstrumentSerif-Italic.ttf"), fontStyle: "italic" },
    ],
  });
  Font.register({
    family: "Mono",
    fonts: [
      { src: path.join(FONT_DIR, "JetBrainsMono-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONT_DIR, "JetBrainsMono-Medium.ttf"), fontWeight: 500 },
    ],
  });
  Font.registerHyphenationCallback((w) => [w]);
  registered = true;
}

const INK = "#0a0a0a";
const MUTED = "#737373";
const LINE = "#e5e5e5";
const PAPER = "#f5f5f5";
const ACCENT = "#d4d4d4";
const GREEN = "#15803d";
const RED = "#b91c1c";

const s = StyleSheet.create({
  page: { fontFamily: "Inter", fontSize: 9.5, color: INK, paddingTop: 44, paddingBottom: 56, paddingHorizontal: 48, lineHeight: 1.45, backgroundColor: "#ffffff" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26 },
  brand: { fontSize: 11, fontWeight: 600 },
  small: { fontSize: 8, color: MUTED },
  mono: { fontFamily: "Mono", fontSize: 8.5 },
  h1: { fontFamily: "Inter", fontWeight: 600, fontSize: 24, lineHeight: 1.15, letterSpacing: -0.4, marginBottom: 6 },
  h2: { fontSize: 15, fontWeight: 600, lineHeight: 1.25, marginBottom: 4 },
  label: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, borderColor: LINE, marginTop: 14, marginBottom: 18 },
  cell: { width: "25%", paddingVertical: 8, paddingRight: 8, borderBottomWidth: 1, borderColor: LINE },
  cell3: { width: "33.33%", paddingVertical: 8, paddingRight: 8, borderBottomWidth: 1, borderColor: LINE },
  section: { marginBottom: 16 },
  letter: { fontSize: 10, lineHeight: 1.55 },
  tag: { width: 26, height: 26, borderRadius: 4, backgroundColor: INK, color: "#fff", fontSize: 12, fontWeight: 600, textAlign: "center", paddingTop: 5, marginRight: 10 },
  row: { flexDirection: "row" },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderColor: LINE, paddingVertical: 5 },
  th: { fontSize: 7.5, color: MUTED, textTransform: "uppercase", letterSpacing: 0.6 },
  footerText: { position: "absolute", bottom: 26, fontSize: 7.5, color: MUTED, width: 300 },
  bubble: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 8, marginBottom: 6 },
  callout: { backgroundColor: PAPER, borderLeftWidth: 2, borderColor: ACCENT, padding: 10, marginBottom: 12 },
});

const money = (n: number | string, c = "USD") => `${c === "USD" ? "$" : c + " "}${Number(n).toFixed(2)}`;
const date = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }) : "—");
const dateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC" : "—";
const addr = (a?: { name?: string; line1: string; line2?: string; city: string; state?: string; postal_code: string; country: string }) =>
  a ? [a.name, a.line1, a.line2, `${a.city}${a.state ? ", " + a.state : ""} ${a.postal_code}`, a.country].filter(Boolean).join("\n") : "—";

function Fact({ label, value, mono, w = "cell" }: { label: string; value: string; mono?: boolean; w?: "cell" | "cell3" }) {
  return (
    <View style={s[w]}>
      <Text style={s.label}>{label}</Text>
      <Text style={mono ? s.mono : undefined}>{value}</Text>
    </View>
  );
}

function Footer({ merchant, disputeId }: { merchant: Merchant; disputeId: string }) {
  return (
    <>
      <Text style={[s.footerText, { left: 48 }]} fixed>
        {merchant.legal_name} · Response to PayPal dispute {disputeId}
      </Text>
      <Text style={[s.footerText, { right: 48, textAlign: "right" }]} fixed>
        Prepared with Exhibit
      </Text>
    </>
  );
}

/** Lets long URLs and ids wrap: react-pdf only breaks at whitespace, so add zero-width spaces after separators. */
const breakable = (v: string) => v.replace(/([/=&?._-])/g, "$1\u200b");

function ExhibitBody({ r }: { r: ResolvedRef }) {
  switch (r.kind) {
    case "shipment": {
      const sh = r.data;
      return (
        <View>
          <View style={s.grid}>
            <Fact label="Carrier" value={`${sh.carrier.replace(/_/g, " ")} · ${sh.service}`} />
            <Fact label="Tracking number" value={sh.tracking_number} mono />
            <Fact label="Shipped" value={dateTime(sh.shipped_at)} />
            <Fact label="Status" value={sh.status.replace(/_/g, " ")} />
            <Fact label="Delivered" value={dateTime(sh.delivered_at)} />
            <Fact label="Signature" value={sh.signature ? sh.signature.name : "—"} />
            <Fact label="Delivered to" value={sh.delivered_to ? addr(sh.delivered_to) : "—"} />
            <Fact label="Verify online" value={breakable(sh.tracking_url.replace(/^https?:\/\//, ""))} mono />
          </View>
          {sh.delivery_photo ? (
            <View style={s.callout}>
              <Text style={s.label}>Carrier delivery photo</Text>
              <Text>{sh.delivery_photo}</Text>
            </View>
          ) : null}
          {sh.qc_photo ? (
            <View style={s.callout}>
              <Text style={s.label}>Pre-dispatch quality check</Text>
              <Text>{sh.qc_photo}</Text>
            </View>
          ) : null}
          <Text style={[s.label, { marginBottom: 4 }]}>Carrier scan history</Text>
          <View style={[s.tr, { borderTopWidth: 1 }]}>
            <Text style={[s.th, { width: "28%" }]}>Time</Text>
            <Text style={[s.th, { width: "26%" }]}>Location</Text>
            <Text style={[s.th, { width: "46%" }]}>Event</Text>
          </View>
          {sh.events.map((e, i) => (
            <View key={i} style={s.tr} wrap={false}>
              <Text style={[s.mono, { width: "28%" }]}>{dateTime(e.at)}</Text>
              <Text style={{ width: "26%" }}>{e.location}</Text>
              <Text style={{ width: "46%", fontWeight: e.code === "DELIVERED" ? 600 : 400 }}>{e.description}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "order": {
      const o = r.data;
      return (
        <View>
          <View style={s.grid}>
            <Fact label="Order" value={o.id} mono />
            <Fact label="Placed" value={dateTime(o.placed_at)} />
            <Fact label="PayPal capture" value={o.paypal.capture_id} mono />
            <Fact label="Funding" value={o.paypal.funding === "CARD" ? "Card via PayPal" : "PayPal balance / wallet"} />
            <Fact label="Ship to (transaction address)" value={addr(o.shipping_address)} />
            <Fact label="Bill to" value={o.billing_address ? addr(o.billing_address) : "Same as PayPal account"} />
            <Fact label="Shipping method" value={o.shipping_method} />
            <Fact label="Policies accepted" value={`${dateTime(o.checkout.accepted_terms_at)} (v${o.checkout.policies_version})`} />
          </View>
          <View style={[s.tr, { borderTopWidth: 1 }]}>
            <Text style={[s.th, { width: "20%" }]}>SKU</Text>
            <Text style={[s.th, { width: "50%" }]}>Item</Text>
            <Text style={[s.th, { width: "10%", textAlign: "right" }]}>Qty</Text>
            <Text style={[s.th, { width: "20%", textAlign: "right" }]}>Amount</Text>
          </View>
          {o.items.map((i) => (
            <View key={i.sku} style={s.tr}>
              <Text style={[s.mono, { width: "20%" }]}>{i.sku}</Text>
              <Text style={{ width: "50%" }}>{i.name}</Text>
              <Text style={{ width: "10%", textAlign: "right" }}>{i.qty}</Text>
              <Text style={{ width: "20%", textAlign: "right" }}>{money(i.unit_price * i.qty)}</Text>
            </View>
          ))}
          <View style={[s.row, { justifyContent: "flex-end", marginTop: 6 }]}>
            <Text style={{ fontWeight: 600 }}>Total charged {money(o.total)}</Text>
          </View>
          {o.refunds?.length ? <Text style={[s.small, { marginTop: 8 }]}>Refunds: {o.refunds.map((x) => `${x.id} (${money(x.amount)}, ${date(x.at)})`).join("; ")}</Text> : null}
        </View>
      );
    }
    case "listing": {
      const p = r.data;
      return (
        <View>
          <Text style={{ fontSize: 12, fontWeight: 600, marginTop: 10 }}>{p.name}</Text>
          <Text style={{ marginBottom: 10 }}>{p.description}</Text>
          <View style={s.grid}>
            <Fact label="Material" value={p.material} w="cell3" />
            <Fact label="Dimensions" value={p.dimensions} w="cell3" />
            <Fact label="Listed color" value={p.color} w="cell3" />
          </View>
          {p.listing_notes.length ? (
            <View style={s.callout}>
              <Text style={s.label}>Disclosed on the product page</Text>
              {p.listing_notes.map((n, i) => (
                <Text key={i}>• {n}</Text>
              ))}
            </View>
          ) : null}
          <Text style={s.label}>Listing photographs</Text>
          <View style={[s.row, { marginTop: 4 }]}>
            {p.photos.map((ph, i) => (
              <View key={i} style={{ marginRight: 12, alignItems: "center" }}>
                <View style={{ width: 84, height: 64, backgroundColor: ph.tone, borderRadius: 4 }} />
                <Text style={[s.small, { marginTop: 3 }]}>{ph.caption}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }
    case "customer": {
      const c = r.data;
      return (
        <View style={s.grid}>
          <Fact label="Customer" value={c.name} />
          <Fact label="Customer since" value={date(c.first_order_at)} />
          <Fact label="Orders" value={String(c.order_ids.length)} />
          <Fact label="Lifetime value" value={money(c.lifetime_value)} />
          <Fact label="Prior disputes" value={String(c.prior_disputes)} />
          <Fact label="Order ids" value={c.order_ids.join(", ")} mono />
          {c.notes ? <Fact label="Account note" value={c.notes} /> : null}
        </View>
      );
    }
    case "message":
    case "conversation": {
      const list = r.kind === "message" ? [r.data] : r.data;
      return (
        <View style={{ marginTop: 10 }}>
          {list.map((m) => (
            <View key={m.id} style={[s.bubble, m.from === "merchant" ? { backgroundColor: PAPER } : {}]} wrap={false}>
              <Text style={s.small}>
                {m.from === "customer" ? "Buyer" : "Kora Atelier"} · {m.channel} · {dateTime(m.at)}
                {m.subject ? ` · “${m.subject}”` : ""}
              </Text>
              <Text style={{ marginTop: 3 }}>{m.body}</Text>
            </View>
          ))}
        </View>
      );
    }
    case "risk": {
      const k = r.data;
      return (
        <View style={s.grid}>
          <Fact label="AVS (address check)" value={k.avs_result ?? "—"} />
          <Fact label="CVV" value={k.cvv_result ?? "—"} />
          <Fact label="3-D Secure" value={k.three_ds ?? "—"} />
          <Fact label="Checkout IP" value={`${k.ip.address}\n${k.ip.city}${k.ip.region ? ", " + k.ip.region : ""}, ${k.ip.country}`} />
          <Fact label="IP to ship-to distance" value={`${k.ip_to_shipping_km} km`} />
          <Fact label="Device" value={`${k.device.id}${k.device.seen_before ? `, seen since ${date(k.device.first_seen)}` : ", first seen"}`} />
          <Fact label="Email age" value={`${Math.round(k.email_age_days / 365)} yr`} />
          <Fact label="Orders in 24h" value={String(k.orders_last_24h)} />
        </View>
      );
    }
    case "policy": {
      const p = r.data;
      return (
        <View>
          <View style={s.grid}>
            <Fact label="Policy" value={p.title} w="cell3" />
            <Fact label="Version" value={p.version} w="cell3" />
            <Fact label="Accepted by buyer" value={dateTime(p.accepted_at)} w="cell3" />
          </View>
          <Text style={s.letter}>{p.body}</Text>
          <Text style={[s.small, { marginTop: 8 }]}>{p.url}</Text>
        </View>
      );
    }
    case "protection": {
      const p = r.data;
      return (
        <View style={{ marginTop: 10 }}>
          <Text style={{ marginBottom: 8 }}>{p.summary}</Text>
          {p.checks.map((c) => (
            <View key={c.id} style={[s.tr, { alignItems: "flex-start" }]} wrap={false}>
              <Text style={{ width: 16, color: c.status === "pass" ? GREEN : c.status === "fail" ? RED : MUTED, fontWeight: 700 }}>{c.status === "pass" ? "✓" : c.status === "fail" ? "✕" : "·"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: 600 }}>{c.label}</Text>
                <Text>{c.detail}</Text>
                {c.quote ? <Text style={[s.small, { fontSize: 8.5 }]}>PayPal: “{c.quote}”</Text> : null}
              </View>
            </View>
          ))}
          <Text style={[s.small, { marginTop: 8 }]}>Requirements quoted from {p.source}</Text>
        </View>
      );
    }
    case "dispute":
      return (
        <View style={s.grid}>
          <Fact label="Dispute" value={r.data.dispute_id} mono />
          <Fact label="Reason" value={REASON_LABEL[r.data.reason]} />
          <Fact label="Stage" value={STAGE_LABEL[r.data.dispute_life_cycle_stage]} />
          <Fact label="Amount" value={money(r.data.dispute_amount.value, r.data.dispute_amount.currency_code)} />
        </View>
      );
    case "paypal_message":
      return (
        <View style={[s.bubble, { marginTop: 10 }]}>
          <Text style={s.small}>
            {r.data.posted_by} via PayPal · {dateTime(r.data.time_posted)}
          </Text>
          <Text style={{ marginTop: 3 }}>{r.data.content}</Text>
        </View>
      );
  }
}

export type PacketExhibit = { label: string; title: string; why: string; resolved: ResolvedRef };

export function PacketDocument({ cf, brief, exhibits, letter, merchant }: { cf: CaseFile; brief: CaseBrief; exhibits: PacketExhibit[]; letter: string; merchant: Merchant }) {
  registerFonts();
  const d = cf.dispute;
  const t = d.disputed_transactions[0];
  return (
    <Document title={`Response to PayPal dispute ${d.dispute_id}`} author={merchant.legal_name} creator="Exhibit" producer="Exhibit">
      <Page size="LETTER" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.brand}>{merchant.name}</Text>
            <Text style={s.small}>{addr(merchant.address).split("\n").slice(1).join(", ")}</Text>
            <Text style={s.small}>
              {merchant.email} · {merchant.website}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.label}>Dispute response</Text>
            <Text style={[s.mono, { fontSize: 11 }]}>{d.dispute_id}</Text>
            <Text style={s.small}>{date(new Date().toISOString())}</Text>
          </View>
        </View>
        <Text style={s.h1}>Response to PayPal dispute</Text>
        <Text style={[s.mono, { fontSize: 13, marginBottom: 6 }]}>{d.dispute_id}</Text>
        <Text style={{ color: MUTED, fontSize: 10.5 }}>{brief.headline}</Text>
        <View style={s.grid}>
          <Fact label="Reason" value={REASON_LABEL[d.reason]} />
          <Fact label="Stage" value={`${STAGE_LABEL[d.dispute_life_cycle_stage]}${d.external_reason_code ? ` · code ${d.external_reason_code}` : ""}`} />
          <Fact label="Amount" value={money(d.dispute_amount.value, d.dispute_amount.currency_code)} />
          <Fact label="Response due" value={dateTime(d.seller_response_due_date)} />
          <Fact label="Transaction" value={t?.seller_transaction_id ?? "—"} mono />
          <Fact label="Order" value={cf.order?.id ?? t?.invoice_number ?? "—"} mono />
          <Fact label="Buyer" value={t?.buyer?.name ?? "—"} />
          <Fact label="Opened" value={date(d.create_time)} />
        </View>
        <View style={s.section}>
          <Text style={s.label}>Merchant&apos;s response</Text>
          <Text style={s.letter}>{letter}</Text>
        </View>
        {exhibits.length ? (
          <View style={s.section}>
            <Text style={s.label}>Exhibits</Text>
            {exhibits.map((e) => (
              <View key={e.label} style={[s.tr, { alignItems: "flex-start" }]}>
                <Text style={{ width: 22, fontWeight: 700 }}>{e.label}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 600 }}>{e.title}</Text>
                  <Text style={s.small}>{e.why}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
        <Footer merchant={merchant} disputeId={d.dispute_id} />
      </Page>
      {exhibits.map((e) => (
        <Page key={e.label} size="LETTER" style={s.page}>
          <View style={[s.row, { alignItems: "center", marginBottom: 6 }]}>
            <Text style={s.tag}>{e.label}</Text>
            <View style={{ flex: 1 }}>
              <Text style={s.label}>Exhibit {e.label}</Text>
              <Text style={s.h2}>{e.title}</Text>
            </View>
          </View>
          <Text style={{ color: MUTED, marginBottom: 4 }}>{e.why}</Text>
          <Text style={[s.small, s.mono]}>Source record: {e.resolved.ref}</Text>
          <ExhibitBody r={e.resolved} />
          <Footer merchant={merchant} disputeId={d.dispute_id} />
        </Page>
      ))}
    </Document>
  );
}
