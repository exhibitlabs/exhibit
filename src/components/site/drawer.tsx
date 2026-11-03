import { ArrowRight, Languages, MessageSquareWarning, Package, PackageX, Pencil, Send, Undo2, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { UiButton, UiRing } from "./ui";

// The app's prevention drawer (src/components/app/PreventionDrawer.tsx), as presentational pieces with no data of
// their own: the server fragments and the client PreventionSave pass the records in. Classes live in site.css (s-f-dr).

export type DrawerOrder = { buyer: string; country: string; orderId: string; item: string; score: number; band: "high" | "elevated" | "watch"; exposure: number; amount: number; fee: number; card?: boolean };
export type DrawerSignal = { kind: string; label: string; reason: string; detail: string; quote?: string; weight?: number; lang?: string };

const usd0 = (n: number) => `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const BAND_LABEL = { high: "High", elevated: "Elevated", watch: "Watch" } as const;
const ICON: Record<string, LucideIcon> = { buyer_waiting: MessageSquareWarning, tracking_stalled: PackageX, refund_overdue: Undo2 };

/** The header: score ring (a green check once prevented), buyer and country, order and item, band, exposure. */
export function DrawerHeadView({ order, prevented = false }: { order: DrawerOrder; prevented?: boolean }) {
  return (
    <div className="s-f-dr__hd">
      {prevented ? <UiRing value={0} check size={56} stroke={4} tone="green" label="Prevented" /> : <UiRing value={order.score} size={56} stroke={4} tone={order.band === "high" ? "red" : "grey"} unit="" label={`Risk ${order.score} of 100`} />}
      <div className="s-f-dr__who">
        <div className="s-f-dr__name">
          <b>{order.buyer}</b>
          <span className="s-f-dr__cc">{order.country}</span>
        </div>
        <div className="s-f-dr__sub">
          <span className="s-ui-mono">{order.orderId}</span> · {order.item}
        </div>
        <div className={`s-f-band s-f-band--${prevented ? "prevented" : order.band}`}>
          <i />
          {prevented ? "Prevented" : BAND_LABEL[order.band]}
        </div>
        <div className="s-f-dr__exp">
          <span className="s-ui-mono s-f-dr__ink">{usd0(order.exposure)}</span> exposure: <span className="s-ui-mono">{usd0(order.amount)}</span> order + <span className="s-ui-mono">{usd0(order.fee)}</span> PayPal {order.card ? "chargeback" : "dispute"} fee
        </div>
      </div>
      <span className="s-f-dr__x" aria-hidden>
        <X />
      </span>
    </div>
  );
}

/** The green confirmation the drawer shows once a fix lands. */
export function DrawerSuccess({ saved, fee }: { saved: number; fee: number }) {
  return (
    <div className="s-f-success">
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <b>Dispute prevented</b>
        <span>
          {usd0(saved)} {saved <= fee + 0.01 ? "in PayPal fees saved, and the customer kept" : "of exposure off the table"}
        </span>
      </div>
    </div>
  );
}

/** "Why it's at risk": each signal with its sentence, the quote it rests on and its weight bar. */
export function DrawerSignalsView({ signals }: { signals: DrawerSignal[] }) {
  return (
    <section className="s-f-sec">
      <div className="s-f-sec__h">
        <b>Why it&apos;s at risk</b>
        <span>
          {signals.length} signal{signals.length === 1 ? "" : "s"}
        </span>
      </div>
      {signals.length ? (
        <ul className="s-f-sigs">
          {signals.map((s) => {
            const Icon = ICON[s.kind] ?? Package;
            return (
              <li key={s.kind} className="s-f-sig">
                <div className="s-f-sig__hd">
                  <Icon aria-hidden strokeWidth={1.7} />
                  <b>{s.label}</b>
                  <span>
                    <ArrowRight aria-hidden /> {s.reason}
                  </span>
                </div>
                <p className="s-f-sig__why">{s.detail}</p>
                {s.quote ? (
                  <p className="s-f-sig__q" lang={s.lang}>
                    &ldquo;{s.quote}&rdquo;
                  </p>
                ) : null}
                {s.weight != null ? (
                  <div className="s-f-sig__bar">
                    <span>
                      <i style={{ width: `${s.weight}%`, background: s.weight >= 65 ? "#b91c1c" : s.weight >= 40 ? "#8a8a87" : "#c9c9c6" }} />
                    </span>
                    <em>+{s.weight} risk</em>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="s-f-sec__none">Nothing left on this order. Exhibit keeps watching for new scans and messages.</p>
      )}
    </section>
  );
}

/**
 * The message as "Fix it now" previews it: the language bar with Show English and Edit, the subject, the body (the
 * app scrolls it after 188 px). Pass `onEnglish` to make Show English work; Edit is drawn, not wired.
 */
export function MessagePreviewView({ language, subject, body, english, onEnglish }: { language: string; subject: string; body: string; english?: boolean; onEnglish?: () => void }) {
  return (
    <div className="s-f-msg">
      <div className="s-f-msg__bar" lang="en">
        <span className="s-f-msg__lang">
          <Languages aria-hidden />
          Written in {language}
        </span>
        <span className="s-f-msg__tools">
          {onEnglish ? (
            <button type="button" className="s-f-msg__btn" aria-pressed={!!english} onClick={onEnglish}>
              {english ? "Showing English" : "Show English"}
            </button>
          ) : (
            <span className="s-f-msg__btn" aria-hidden>
              Show English
            </span>
          )}
          {!english ? (
            <span className="s-f-msg__btn" aria-hidden>
              <Pencil /> Edit
            </span>
          ) : null}
        </span>
      </div>
      <div className="s-f-msg__body" lang={english ? "en" : language === "German" ? "de" : undefined}>
        <p className="s-f-msg__subj">{subject}</p>
        <p className="s-f-msg__text">{body}</p>
      </div>
    </div>
  );
}

/** "Fix it now": what the fix does, an optional preview, the one primary action and the line under it. */
export function FixSectionView({ detail, children, label, channel, api, top = false }: { detail: string; children?: ReactNode; label: string; channel: "inbox" | "paypal"; api?: string | null; top?: boolean }) {
  return (
    <section className={top ? "s-f-sec s-f-sec--top" : "s-f-sec"}>
      <div className="s-f-sec__h">
        <b>Fix it now</b>
      </div>
      <p className="s-f-sec__p">{detail}</p>
      {children}
      <div className="s-f-fix">
        <UiButton variant="primary" size="lg" className="s-f-fix__btn">
          {channel === "inbox" ? <Send /> : <ArrowRight />}
          {label}
        </UiButton>
        <p className="s-f-fix__cap">{api ? <span className="s-ui-mono">{api}</span> : "From the support inbox, in the buyer's language"}</p>
      </div>
    </section>
  );
}
