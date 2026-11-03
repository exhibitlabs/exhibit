import { clsx } from "clsx";
import { Check } from "lucide-react";
import { PREVENTION_REPLY } from "./hero-data";
import { Container, Heading, Panel, Provenance, Section, usd, utcDate } from "./Primitives";
import prevention from "./records/prevention.json";

type Order = (typeof prevention.radar.orders)[number];

const radar = prevention.radar;
const save = prevention.save;
const atRisk = radar.orders.filter((o) => o.status === "at_risk").sort((a, b) => b.score - a.score || b.exposure - a.exposure);
const KINDS = radar.bySignal.map((s) => s.kind);

const BAND_STYLE: Record<string, { dot: string; chip: string; label: string }> = {
  high: { dot: "#b91c1c", chip: "bg-red-soft text-red", label: "High" },
  elevated: { dot: "#e8a33d", chip: "bg-[#fdf6ea] text-[#8a5a12]", label: "Elevated" },
  watch: { dot: "#a1a1a1", chip: "bg-sunken text-ink-2", label: "Watch" },
};

/** Stable pseudo-random 0..1 from an order id, so the radar renders the same on server and client. */
function jitter(id: string, salt = 0) {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

function position(o: Order) {
  const sector = Math.max(0, KINDS.indexOf(o.signal?.kind ?? KINDS[0]));
  const width = 360 / KINDS.length;
  const angle = ((sector * width + width * (0.18 + 0.64 * jitter(o.id)) - 90) * Math.PI) / 180;
  const [r0, r1] = o.band === "high" ? [22, 58] : o.band === "elevated" ? [70, 100] : [108, 134];
  const r = r0 + (r1 - r0) * (o.band === "high" ? (100 - o.score) / 30 : jitter(o.id, 7));
  return { x: 160 + r * Math.cos(angle), y: 160 + r * Math.sin(angle), r: 3.2 + Math.min(4, o.exposure / 220) };
}

function Radar() {
  const width = 360 / KINDS.length;
  return (
    <svg viewBox="0 0 320 320" className="h-auto w-full max-w-[340px]" role="img" aria-label={`Radar of ${radar.totals.watched} recent orders: ${radar.totals.high} high risk, ${radar.totals.elevated} elevated, ${radar.totals.watch} to watch, ${radar.totals.prevented} prevented.`}>
      <defs>
        <linearGradient id="lp-sweep-fill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0a0a0a" stopOpacity="0" />
          <stop offset="1" stopColor="#0a0a0a" stopOpacity="0.07" />
        </linearGradient>
      </defs>
      {[140, 104, 64].map((r) => (
        <circle key={r} cx="160" cy="160" r={r} fill="none" stroke="#ebebeb" />
      ))}
      <circle cx="160" cy="160" r="64" fill="#fbfbfb" stroke="#ebebeb" />
      {KINDS.map((_, i) => {
        const a = ((i * width - 90) * Math.PI) / 180;
        return <line key={i} x1={160 + 64 * Math.cos(a)} y1={160 + 64 * Math.sin(a)} x2={160 + 140 * Math.cos(a)} y2={160 + 140 * Math.sin(a)} stroke="#f0f0f0" />;
      })}
      <g className="lp-sweep" style={{ transformOrigin: "160px 160px", transformBox: "view-box" }}>
        <path d="M160 160 L160 20 A140 140 0 0 1 281 90 Z" fill="url(#lp-sweep-fill)" />
      </g>
      <text x="160" y="16" textAnchor="middle" className="fill-muted text-[8px] uppercase tracking-[0.12em]">
        Watch
      </text>
      <text x="160" y="53" textAnchor="middle" className="fill-muted text-[8px] uppercase tracking-[0.12em]">
        Elevated
      </text>
      <text x="160" y="164" textAnchor="middle" className="fill-muted text-[8px] uppercase tracking-[0.12em]">
        High
      </text>
      {atRisk.map((o) => {
        const p = position(o);
        return (
          <g key={o.id}>
            {o.band === "high" ? <circle cx={p.x} cy={p.y} r={p.r + 3.5} fill={BAND_STYLE.high.dot} opacity="0.12" /> : null}
            <circle cx={p.x} cy={p.y} r={p.r} fill={BAND_STYLE[o.band].dot} stroke="#fff" strokeWidth="1.5" />
          </g>
        );
      })}
      <g transform="translate(272 268)">
        <circle r="9" fill="#15803d" stroke="#fff" strokeWidth="2" />
        <path d="M-3.5 0.2 L-1 2.7 L3.8 -2.4" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

function FixChip({ fix }: { fix: Order["fix"] }) {
  if (!fix) return null;
  return (
    <span className="inline-flex max-w-full flex-col rounded-md border border-line bg-white px-2 py-1 text-[11.5px] font-medium leading-tight text-ink-2">
      <span className="truncate">{fix.label}</span>
      <span className="truncate text-[10.5px] font-normal text-muted">{fix.channel === "paypal" ? "PayPal API" : "Inbox"}</span>
    </span>
  );
}

export function Prevention() {
  const t = radar.totals;
  const rows = atRisk.slice(0, 6);
  return (
    <Section id="prevention" label="Prevention" className="border-t border-line">
      <Container>
        <Heading
          kicker="Prevention"
          title="Stop the dispute before it is filed."
          rest="Each warning sign comes with a fix."
          lede="The radar watches recent orders for the signs that come before a PayPal dispute: tracking that never reached PayPal, a parcel stuck in transit, a buyer waiting on a reply, a refund running late."
        />

        <Panel className="mt-12">
          <dl className="grid grid-cols-2 border-b border-line sm:grid-cols-4">
            {[
              [t.watched, "orders watched"],
              [t.atRisk, "at risk"],
              [usd(t.exposure), "exposure, with PayPal fees"],
              [`${t.prevented} · ${usd(t.saved)}`, "prevented so far"],
            ].map(([v, k], i) => (
              <div key={k as string} className={clsx("flex flex-col gap-1 px-5 py-4", i % 2 === 1 && "border-l border-line", i >= 2 && "border-t border-line sm:border-t-0", i === 2 && "sm:border-l")}>
                <dt className="order-2 text-[12.5px] text-muted">{k}</dt>
                <dd className="num order-1 text-[22px] leading-none tracking-[-0.02em] text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="grid lg:grid-cols-[380px_minmax(0,1fr)]">
            <div className="flex flex-col items-center justify-center gap-4 border-b border-line px-6 py-8 lg:border-b-0 lg:border-r">
              <Radar />
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
                {(["high", "elevated", "watch"] as const).map((b) => (
                  <span key={b} className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: BAND_STYLE[b].dot }} aria-hidden />
                    {BAND_STYLE[b].label}
                  </span>
                ))}
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-green" aria-hidden />
                  Prevented
                </span>
              </div>
            </div>

            <div className="min-w-0">
              <div className="hidden grid-cols-[52px_minmax(0,1.2fr)_minmax(0,1.1fr)_76px_minmax(0,1.3fr)] gap-4 border-b border-line bg-[#fafafa] px-5 py-2.5 text-[11px] uppercase tracking-[0.08em] text-muted md:grid">
                <span>Risk</span>
                <span>Order</span>
                <span>Warning sign</span>
                <span className="text-right">Exposure</span>
                <span>Fix</span>
              </div>
              <ul className="divide-y divide-line">
                {rows.map((o, i) => (
                  <li key={o.id} className={clsx("grid-cols-[44px_minmax(0,1fr)] gap-x-3 gap-y-2 px-5 py-3.5 md:grid md:grid-cols-[52px_minmax(0,1.2fr)_minmax(0,1.1fr)_76px_minmax(0,1.3fr)] md:items-center md:gap-4", i < 4 ? "grid" : "hidden")}>
                    <span className={clsx("num flex h-6 w-10 items-center justify-center rounded-md text-[12px] font-semibold", BAND_STYLE[o.band].chip)}>{o.score}</span>
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-ink">{o.buyer}</div>
                      <div className="truncate text-[12px] text-muted">
                        {o.id} · {o.item}
                      </div>
                    </div>
                    <div className="col-start-2 min-w-0 md:col-start-auto">
                      <div className="truncate text-[12.5px] text-ink-2">{o.signal?.label}</div>
                      <div className="truncate text-[11.5px] text-muted">Leads to: {o.signal?.reason}</div>
                    </div>
                    <span className="num col-start-2 text-[12.5px] text-ink-2 md:col-start-auto md:text-right">{usd(o.exposure)}</span>
                    <span className="col-start-2 md:col-start-auto">
                      <FixChip fix={o.fix} />
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-5 py-3 text-[12px] text-muted">
                <span className="md:hidden">{atRisk.length - 4}</span>
                <span className="hidden md:inline">{atRisk.length - rows.length}</span> more at-risk orders on the radar. Fixes run through the PayPal API where one exists, and through the store&apos;s inbox where it doesn&apos;t.
              </div>
            </div>
          </div>

          <div className="grid gap-5 border-t border-line bg-[#fafafa] px-5 py-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-8 md:px-6">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-green">
                <Check className="size-3.5" strokeWidth={3} aria-hidden /> Prevented · {save.orderId}
              </div>
              <p className="mt-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">
                {save.buyer} said she would open a PayPal dispute. Exhibit replied in German first.
              </p>
              <p className="num mt-2 text-[12px] text-muted">
                Risk {save.fix.before.score} → {save.fix.after.score} · {usd(save.fix.saved)} exposure removed · {utcDate(save.fix.at)}
              </p>
            </div>
            <figure className="rounded-xl border border-line bg-white px-4 py-3.5">
              <blockquote lang="de" className="text-[13px] leading-relaxed text-ink">
                {PREVENTION_REPLY.german} {PREVENTION_REPLY.germanPromise}
              </blockquote>
              <figcaption className="mt-2 border-t border-line pt-2 text-[12.5px] leading-relaxed text-muted">
                Translation: {PREVENTION_REPLY.english} {PREVENTION_REPLY.englishPromise}
              </figcaption>
            </figure>
          </div>
        </Panel>
        <Provenance tone="demo" className="mt-5">
          Demo merchant snapshot from Exhibit&apos;s prevention radar, {utcDate(radar.capturedAt)}. Exposure is the order total plus PayPal&apos;s dispute fee: $15 for PayPal checkout, $20 for card.
        </Provenance>
      </Container>
    </Section>
  );
}
