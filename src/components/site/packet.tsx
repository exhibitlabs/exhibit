import type { ReactNode } from "react";

// The evidence packet as src/lib/packet/Packet.tsx prints it (react-pdf, US Letter): the letterhead, the title and
// the dispute id, the facts grid under small uppercase labels, "Merchant's response", the exhibit index, each
// exhibit's own page, and the footer on every page. Presentational only, with no records of its own, so the server
// fragments and the client PacketViewer share it. Sizes are in PDF points (--pt, set per placement); the classes are
// s-pdf in site.css. The PDF sets Inter and JetBrains Mono; the site draws it in Geist and Geist Mono.

export type PdfFact = { k: string; v: string; mono?: boolean };
export type Letterhead = { name: string; legalName: string; address: string; email: string; website: string };

/** A page: the paper, its content, and the footer the PDF repeats on every page. */
export function PdfPage({ merchant, disputeId, className, children, footer = true }: { merchant: Letterhead; disputeId: string; className?: string; children: ReactNode; footer?: boolean }) {
  return (
    <div className={className ? `s-pdf ${className}` : "s-pdf"}>
      <div className="s-pdf__page">
        {children}
        {footer ? (
          <div className="s-pdf__foot">
            <span>
              {merchant.legalName} · Response to PayPal dispute {disputeId}
            </span>
            <span>Prepared with Exhibit</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The cover's letterhead: the merchant on the left, "Dispute response", the id and the date on the right. */
export function PdfLetterhead({ merchant, disputeId, date }: { merchant: Letterhead; disputeId: string; date: string }) {
  return (
    <div className="s-pdf__hd">
      <div>
        <p className="s-pdf__brand">{merchant.name}</p>
        <p className="s-pdf__small">{merchant.address}</p>
        <p className="s-pdf__small">
          {merchant.email} · {merchant.website}
        </p>
      </div>
      <div className="s-pdf__ref">
        <p className="s-pdf__label">Dispute response</p>
        <p className="s-pdf__mono s-pdf__refid">{disputeId}</p>
        <p className="s-pdf__small">{date}</p>
      </div>
    </div>
  );
}

/** "Response to PayPal dispute", the id in mono and the brief's headline in grey. */
export function PdfTitle({ disputeId, headline }: { disputeId: string; headline: string }) {
  return (
    <>
      <p className="s-pdf__h1">Response to PayPal dispute</p>
      <p className="s-pdf__id">{disputeId}</p>
      <p className="s-pdf__headline">{headline}</p>
    </>
  );
}

/** The ruled facts grid: four across (two on a narrow page), a small uppercase label over each value. */
export function PdfFacts({ facts, three }: { facts: PdfFact[]; three?: boolean }) {
  return (
    <dl className={three ? "s-pdf__grid s-pdf__grid--3" : "s-pdf__grid"}>
      {facts.map((f) => (
        <div key={f.k} className="s-pdf__cell">
          <dt className="s-pdf__label">{f.k}</dt>
          <dd className={f.mono ? "s-pdf__mono" : undefined}>{f.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function PdfLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={className ? `s-pdf__label ${className}` : "s-pdf__label"}>{children}</p>;
}

/** An exhibit page's head: the ink tag, "Exhibit B" and the title, then why it is attached and the source record. */
export function PdfExhibitHead({ label, title, why, source }: { label: string; title: string; why: string; source: string }) {
  return (
    <>
      <div className="s-pdf__xhd">
        <span className="s-pdf__tag" aria-hidden>
          {label}
        </span>
        <div className="min-w-0">
          <p className="s-pdf__label">Exhibit {label}</p>
          <p className="s-pdf__h2">{title}</p>
        </div>
      </div>
      <p className="s-pdf__why">{why}</p>
      <p className="s-pdf__src">Source record: {source}</p>
    </>
  );
}
