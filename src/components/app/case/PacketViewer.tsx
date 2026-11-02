"use client";

import { clsx } from "clsx";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import type { CaseBrief } from "@/lib/agent/brief";
import { refLabel } from "@/lib/reflabel";

/**
 * The evidence packet exactly as PayPal's reviewer receives it: the real PDF, rendered in place.
 * Edits to the letter are rendered into the cover page before anything is filed.
 */
export function PacketViewer({ disputeId, brief, letter, hoverRef }: { disputeId: string; brief: CaseBrief; letter: string; hoverRef?: string | null }) {
  const [loaded, setLoaded] = useState(false);
  const edited = letter !== brief.response_letter;
  const base = `/api/disputes/${disputeId}/packet`;
  const src = `${base}${edited ? `?letter=${encodeURIComponent(letter)}` : ""}#view=FitH&toolbar=0&navpanes=0`;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="relative overflow-hidden rounded-xl border border-line bg-[#f3f3f3]">
        {!loaded ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[12.5px] text-muted">
            <Loader2 className="size-4 animate-spin" /> Rendering the packet from source records
          </div>
        ) : null}
        <iframe key={src} title={`Evidence packet for ${disputeId}`} src={src} onLoad={() => setLoaded(true)} className="relative block h-[min(78vh,860px)] w-full" />
      </div>
      <aside className="space-y-3">
        <div className="flex gap-2">
          <a href={`${base}${edited ? `?letter=${encodeURIComponent(letter)}` : ""}`} target="_blank" rel="noreferrer" className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-[12.5px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-[#fafafa]">
            <ExternalLink className="size-3.5" /> Open
          </a>
          <a href={`${base}?download=1${edited ? `&letter=${encodeURIComponent(letter)}` : ""}`} className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-[12.5px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-[#fafafa]">
            <Download className="size-3.5" /> Download PDF
          </a>
        </div>
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-4 py-3 text-[12px] font-medium uppercase tracking-wider text-muted">
            <FileText className="size-3.5" /> {brief.exhibits.length} exhibit{brief.exhibits.length === 1 ? "" : "s"}
          </div>
          <ul className="divide-y divide-line">
            {brief.exhibits.map((e) => (
              <li key={e.label} className={clsx("flex gap-3 px-4 py-2.5 transition-colors", hoverRef === e.ref && "bg-[rgb(232_163_61/0.12)]")}>
                <span className="num flex size-6 shrink-0 items-center justify-center rounded-md bg-ink text-[12px] font-semibold text-white">{e.label}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium leading-tight">{e.title}</div>
                  <div className="mt-0.5 text-[12px] leading-snug text-muted">{e.why}</div>
                  <div className="num mt-1 truncate text-[10.5px] text-faint" title={e.ref}>
                    {refLabel(e.ref)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="px-1 text-[11.5px] leading-relaxed text-muted">
          The model chose these exhibits; it didn&apos;t write them. Each page is re-read from the source record when the packet renders, so a citation that doesn&apos;t resolve can&apos;t reach PayPal.{edited ? " The cover letter shows your edits." : ""}
        </p>
      </aside>
    </div>
  );
}
