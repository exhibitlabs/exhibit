"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { dateTime } from "@/lib/format";
import { ApiInspector, MethodTag, StatusPill, type ApiRowLite } from "../ApiInspector";

/** Every PayPal call made for this case. Click one for the request, response and debug id. */
export function ApiCalls({ rows, mode }: { rows: ApiRowLite[]; mode: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!rows.length) return <p className="rounded-[10px] border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-muted">No PayPal calls for this case yet.</p>;
  return (
    <>
      <div className="card overflow-hidden border">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[660px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[12px] text-muted">
                <th className="h-9 pl-5 font-normal">Call</th>
                <th className="h-9 font-normal">Status</th>
                <th className="h-9 text-right font-normal">Latency</th>
                <th className="h-9 pl-6 font-normal">PayPal-Debug-Id</th>
                <th className="h-9 pr-5 text-right font-normal">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setOpen(r.id)} className="group cursor-pointer border-b border-rule last:border-0 hover:bg-hover">
                  <td className="h-11 max-w-0 pl-5 pr-3">
                    <button type="button" onClick={() => setOpen(r.id)} className="flex min-w-0 max-w-full items-center gap-2 rounded-[4px] text-left">
                      <MethodTag method={r.meta.method} />
                      <span className="mono truncate text-[12px] text-ink">{r.meta.path}</span>
                    </button>
                  </td>
                  <td className="w-16">
                    <StatusPill status={r.meta.status} />
                  </td>
                  <td className="mono w-20 text-right text-[12px] text-muted">{r.meta.ms} ms</td>
                  <td className="mono w-40 max-w-40 truncate pl-6 text-[12px] text-muted">{r.meta.debugId ?? "–"}</td>
                  <td className="w-44 pr-5 text-right text-muted">
                    <span className="inline-flex items-center gap-1">
                      <span suppressHydrationWarning>{dateTime(r.at)}</span>
                      <ChevronRight className="size-3.5 text-ghost transition-colors group-hover:text-ink" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <ApiInspector id={open} onClose={() => setOpen(null)} mode={mode} />
    </>
  );
}
