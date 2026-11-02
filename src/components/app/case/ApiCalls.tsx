"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { dateTime } from "@/lib/format";
import { ApiInspector, MethodTag, StatusPill, type ApiRowLite } from "../ApiInspector";

/** Every PayPal call made for this case. Click one for the request, response and debug id. */
export function ApiCalls({ rows, mode }: { rows: ApiRowLite[]; mode: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!rows.length) return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-[13px] text-muted">No PayPal calls for this case yet.</p>;
  return (
    <>
      <div className="card overflow-hidden">
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-left text-[10.5px] uppercase tracking-[0.06em] text-faint">
                <th className="py-2 pl-4 font-medium">Call</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 text-right font-medium">Latency</th>
                <th className="py-2 pl-4 font-medium">PayPal-Debug-Id</th>
                <th className="py-2 pr-4 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => setOpen(r.id)} className="group cursor-pointer border-b border-line/70 last:border-0 hover:bg-[#fafafa]">
                  <td className="max-w-0 py-2 pl-4 pr-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <MethodTag method={r.meta.method} />
                      <span className="num truncate text-ink-2">{r.meta.path}</span>
                    </span>
                  </td>
                  <td className="w-16 py-2">
                    <StatusPill status={r.meta.status} />
                  </td>
                  <td className="num w-20 py-2 text-right text-muted">{r.meta.ms}ms</td>
                  <td className="num w-40 max-w-40 truncate py-2 pl-4 text-faint">{r.meta.debugId ?? ""}</td>
                  <td className="w-40 py-2 pr-4 text-right text-faint">
                    <span className="inline-flex items-center gap-1">
                      {dateTime(r.at)}
                      <ChevronRight className="size-3.5 text-line-strong transition-colors group-hover:text-ink" />
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
