"use client";

import { clsx } from "clsx";
import { Check } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { PdfExhibitHead, PdfFacts, PdfLabel, PdfLetterhead, PdfPage, PdfTitle, type Letterhead, type PdfFact } from "../packet";
import type { ExhibitPage } from "./filing";

// The packet as PayPal's reviewer received it, printed as src/lib/packet/Packet.tsx prints it: the cover page
// (letterhead, facts, the merchant's response, the exhibit index) beside the page of whichever exhibit is selected.
// "(Exhibit B)" in the letter, a row of the index and the file tabs all open that exhibit's page, and the cited
// exhibit takes the gold tint the app's packet panel gives it. Without JavaScript the cover and exhibit B read in full.

type Exhibit = { label: string; title: string; ref: string; why: string };

export function PacketViewer({
  letter,
  exhibits,
  pages,
  facts,
  headline,
  disputeId,
  dated,
  merchant,
  initial = "B",
}: {
  letter: string;
  exhibits: Exhibit[];
  pages: Record<string, ExhibitPage>;
  facts: PdfFact[];
  headline: string;
  disputeId: string;
  dated: string;
  merchant: Letterhead;
  initial?: string;
}) {
  const [sel, setSel] = useState(initial);
  const ex = exhibits.find((e) => e.label === sel)!;
  const page = pages[sel];

  const mark = (label: string, key: string) => {
    const e = exhibits.find((x) => x.label === label);
    if (!e) return <Fragment key={key}>{label}</Fragment>;
    return (
      <button key={key} type="button" className="s-pdf__cite" aria-pressed={sel === label} aria-controls="exhibit-page" aria-label={`Exhibit ${label}: ${e.title}`} onClick={() => setSel(label)}>
        {label}
      </button>
    );
  };

  // "(Exhibit B)" in the letter keeps its words, with the B as a control.
  const paragraphs = letter.split("\n\n").map((para, i) => {
    const parts: ReactNode[] = [];
    let last = 0;
    for (const m of para.matchAll(/\(Exhibit ([A-H])\)/g)) {
      parts.push(para.slice(last, m.index));
      parts.push(
        <span key={`m${m.index}`} className="s-pdf__nb">
          (Exhibit {mark(m[1], `b${m.index}`)})
        </span>,
      );
      last = (m.index ?? 0) + m[0].length;
    }
    parts.push(para.slice(last));
    return <p key={i}>{parts}</p>;
  });

  return (
    <div className="s-pr-packet">
      <div data-ui className="s-ui s-ui-sheet s-ui-sheet--paper s-pr-cover" role="group" aria-label="The packet's cover page">
        <PdfPage merchant={merchant} disputeId={disputeId} className="s-pdf--cover">
          <PdfLetterhead merchant={merchant} disputeId={disputeId} date={dated} />
          <PdfTitle disputeId={disputeId} headline={headline} />
          <PdfFacts facts={facts} />
          <div className="s-pdf__sec">
            <PdfLabel>Merchant&apos;s response</PdfLabel>
            <div className="s-pdf__letter">{paragraphs}</div>
          </div>
          <div className="s-pdf__sec">
            <PdfLabel>Exhibits</PdfLabel>
            <ol className="s-pdf__index">
              {exhibits.map((e) => (
                <li key={e.label}>
                  <button type="button" className={clsx("s-pdf__xrow", sel === e.label && "is-on")} aria-pressed={sel === e.label} aria-controls="exhibit-page" onClick={() => setSel(e.label)}>
                    <b>{e.label}</b>
                    <span>
                      <span className="s-pdf__xt">{e.title}</span>
                      <span className="s-pdf__small">{e.why}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </PdfPage>
      </div>

      <div className="s-pr-packet__side">
        <div className="s-pr-tabs" role="group" aria-label="Exhibits">
          {exhibits.map((e) => (
            <button key={e.label} type="button" className="s-pr-tab" aria-pressed={sel === e.label} aria-controls="exhibit-page" aria-label={`Exhibit ${e.label}: ${e.title}`} onClick={() => setSel(e.label)}>
              {e.label}
            </button>
          ))}
        </div>
        <div id="exhibit-page" data-ui className="s-ui s-ui-sheet s-ui-sheet--paper s-pr-expage" role="region" aria-live="polite" aria-label={`Exhibit ${ex.label}: ${ex.title}`}>
          <PdfPage merchant={merchant} disputeId={disputeId} className="s-pdf--exhibit">
            <PdfExhibitHead label={ex.label} title={ex.title} why={ex.why} source={ex.ref} />
            {page.facts ? <PdfFacts facts={page.facts} /> : null}

            {page.scans ? (
              <>
                <PdfLabel className="s-pdf__tlabel">Carrier scan history</PdfLabel>
                <table className="s-pdf__table">
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: "28%" }}>
                        Time
                      </th>
                      <th scope="col" style={{ width: "26%" }}>
                        Location
                      </th>
                      <th scope="col">Event</th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.scans.map((s) => (
                      <tr key={s.at}>
                        <td className="s-pdf__mono">
                          <span className="s-pdf__nb">{s.at.slice(0, s.at.lastIndexOf(", ") + 1)}</span> <span className="s-pdf__nb">{s.at.slice(s.at.lastIndexOf(", ") + 2)}</span>
                        </td>
                        <td>{s.location}</td>
                        <td className={s.delivered ? "s-pdf__strong" : undefined}>{s.event}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            ) : null}

            {page.items ? (
              <>
                <table className="s-pdf__table">
                  <thead>
                    <tr>
                      <th scope="col">Item</th>
                      <th scope="col" className="s-pdf__r" style={{ width: "12%" }}>
                        Qty
                      </th>
                      <th scope="col" className="s-pdf__r" style={{ width: "22%" }}>
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.items.map((it) => (
                      <tr key={it.name}>
                        <td>{it.name}</td>
                        <td className="s-pdf__r">{it.qty}</td>
                        <td className="s-pdf__r">{it.amount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {page.total ? <p className="s-pdf__total">Total charged {page.total}</p> : null}
              </>
            ) : null}

            {page.messages
              ? page.messages.map((m) => (
                  <div key={m.meta} className="s-pdf__bubble">
                    <p className="s-pdf__small">{m.meta}</p>
                    <p>{m.body}</p>
                  </div>
                ))
              : null}

            {page.checks ? (
              <ul className="s-pdf__checks">
                {page.checks.map((c) => (
                  <li key={c.label}>
                    <Check className="s-pdf__tick" strokeWidth={3} aria-label="Passes" />
                    <div>
                      <p className="s-pdf__strong">{c.label}</p>
                      <p className="s-pdf__small">PayPal: &ldquo;{c.quote}&rdquo;</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </PdfPage>
        </div>
      </div>
    </div>
  );
}
