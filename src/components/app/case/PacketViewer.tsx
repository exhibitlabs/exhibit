"use client";

import { clsx } from "clsx";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import type { CaseBrief } from "@/lib/agent/brief";
import { refLabel } from "@/lib/reflabel";
import { buttonClass } from "../../ui/Button";

const subscribe = () => () => {};

/**
 * The evidence packet exactly as PayPal's reviewer receives it: the real PDF, rendered in place.
 * Edits to the letter are rendered into the cover page before anything is filed. Browsers that can't show a PDF
 * inline (most phones) get the same packet to open or download instead of a blank frame.
 */
export function PacketViewer({ disputeId, brief, letter, hoverRef }: { disputeId: string; brief: CaseBrief; letter: string; hoverRef?: string | null }) {
  const [loaded, setLoaded] = useState(false);
  const inline = useSyncExternalStore(subscribe, () => navigator.pdfViewerEnabled !== false, () => true);
  const edited = letter !== brief.response_letter;
  const base = `/api/disputes/${disputeId}/packet`;
  const q = edited ? `?letter=${encodeURIComponent(letter)}` : "";
  const src = `${base}${q}#view=FitH&toolbar=0&navpanes=0`;
  const openHref = `${base}${q}`;
  const downloadHref = `${base}?download=1${edited ? `&letter=${encodeURIComponent(letter)}` : ""}`;
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      {inline ? (
        <div className="relative overflow-hidden rounded-[10px] border border-line bg-sunken">
          {!loaded ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[13px] text-muted">
              <Loader2 className="size-4 animate-spin" /> Rendering the packet from source records
            </div>
          ) : null}
          <iframe key={src} title={`Evidence packet for ${disputeId}`} src={src} onLoad={() => setLoaded(true)} className="relative block h-[min(78vh,860px)] w-full" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[10px] border border-line bg-sunken px-6 py-14 text-center">
          <FileText className="size-6 text-muted" strokeWidth={1.5} />
          <div className="mt-3 text-[14px] font-medium text-ink">evidence-packet-{disputeId}.pdf</div>
          <p className="mt-1 max-w-sm text-[13px] leading-[20px] text-muted">This browser doesn&apos;t show PDFs inside the page. Open the packet in a new tab or download it: it is the file PayPal&apos;s reviewer receives{edited ? ", with your edits on the cover letter" : ""}.</p>
          <div className="mt-4 flex gap-2">
            <a href={openHref} target="_blank" rel="noreferrer" className={buttonClass("primary", "md")}>
              <ExternalLink className="size-3.5" /> Open the packet
            </a>
            <a href={downloadHref} className={buttonClass("secondary", "md")}>
              <Download className="size-3.5" /> Download PDF
            </a>
          </div>
        </div>
      )}
      <aside className="space-y-3">
        {inline ? (
          <div className="flex gap-2">
            <a href={openHref} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md", "flex-1")}>
              <ExternalLink className="size-3.5" /> Open
            </a>
            <a href={downloadHref} className={buttonClass("secondary", "md", "flex-1")}>
              <Download className="size-3.5" /> Download PDF
            </a>
          </div>
        ) : null}
        <section className="card overflow-hidden border">
          <h3 className="border-b border-line px-4 py-3 text-[14px] font-semibold text-ink">
            {brief.exhibits.length} exhibit{brief.exhibits.length === 1 ? "" : "s"}, in the order the letter cites them
          </h3>
          <ul>
            {brief.exhibits.map((e) => (
              <li key={e.label} className={clsx("flex gap-3 border-b border-rule px-4 py-3 transition-colors last:border-0", hoverRef === e.ref && "bg-[rgb(232_163_61/0.12)]")}>
                <span className="mono flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-ink text-[12px] font-semibold text-white">{e.label}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium leading-[18px] text-ink">{e.title}</div>
                  <div className="mt-0.5 text-[13px] leading-[19px] text-muted">{e.why}</div>
                  <div className="mono mt-1 truncate text-[12px] text-faint" title={e.ref}>
                    {refLabel(e.ref)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <p className="px-1 text-[12px] leading-[18px] text-muted">
          The model chose these exhibits; it didn&apos;t write them. Each page is re-read from the source record when the packet renders, so a citation that doesn&apos;t resolve can&apos;t reach PayPal.{edited ? " The cover letter shows your edits." : ""}
        </p>
      </aside>
    </div>
  );
}
