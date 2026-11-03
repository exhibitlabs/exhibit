"use client";

import { AllCommunityModule, ModuleRegistry, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { QueueRow } from "@/lib/overview";
import { dueLabel, usd } from "@/lib/format";
import { CallPill, DeadlineBar } from "../cells";
import { exhibitGridTheme } from "../InboxGrid";

ModuleRegistry.registerModules([AllCommunityModule]);

const queueTheme = exhibitGridTheme.withParams({ rowHeight: 56, cellHorizontalPadding: 20 });

function DeadlineCell({ data }: ICellRendererParams<QueueRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full items-center">
      <DeadlineBar hoursLeft={data.hoursLeft} createdAt={data.createdAt} dueAt={data.dueAt} />
    </div>
  );
}

/** The identity cell is a real link, so the queue is reachable by keyboard as well as by row click. */
function CaseCell({ data }: ICellRendererParams<QueueRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full min-w-0 flex-col justify-center leading-tight">
      <Link href={`/app/disputes/${data.id}`} className="truncate rounded-[4px] font-medium text-ink hover:underline hover:decoration-line-strong hover:underline-offset-2">
        {data.buyer}
      </Link>
      <div className="mt-1 truncate text-[13px] text-muted">
        {data.reason} · {data.stage}
      </div>
    </div>
  );
}

function AmountCell({ data }: ICellRendererParams<QueueRow>) {
  if (!data) return null;
  return <div className="mono flex h-full items-center justify-end text-[13px] text-ink">{usd(data.amount)}</div>;
}

function CallCell({ data }: ICellRendererParams<QueueRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full items-center">
      <CallPill decision={data.decision} likelihood={data.likelihood} />
    </div>
  );
}

function NextCell({ data }: ICellRendererParams<QueueRow>) {
  if (!data) return null;
  if (data.next === "waiting") return <div className="flex h-full items-center justify-end truncate text-[13px] text-muted">{data.acted ?? "With PayPal"}</div>;
  return (
    <div className="flex h-full items-center justify-end">
      <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ink">
        {data.next === "approve" ? "Review" : "Run Exhibit"}
        <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </div>
  );
}

export function NeedsYouGrid({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const cols = useMemo<ColDef<QueueRow>[]>(
    () => [
      { headerName: "Due", field: "hoursLeft", width: 108, cellRenderer: DeadlineCell, sortable: true, sort: "asc", comparator: (a, b) => (a ?? 1e9) - (b ?? 1e9) },
      { headerName: "Case", colId: "case", valueGetter: (p) => `${p.data?.buyer}|${p.data?.reason}`, flex: 1.6, minWidth: 150, cellRenderer: CaseCell },
      { headerName: "Amount", field: "amount", width: 104, cellRenderer: AmountCell, type: "rightAligned", sortable: true },
      {
        headerName: "Exhibit's call",
        colId: "call",
        valueGetter: (p) => (p.data?.decision ? `${p.data.decision}|${p.data.likelihood}` : ""),
        flex: 1.1,
        minWidth: 140,
        cellRenderer: CallCell,
        sortable: true,
        comparator: (_a, _b, na, nb) => (na.data?.likelihood ?? -1) - (nb.data?.likelihood ?? -1),
      },
      { headerName: "Next", colId: "next", valueGetter: (p) => `${p.data?.next}|${p.data?.acted ?? ""}`, width: 132, cellRenderer: NextCell, cellClass: "group", headerClass: "ag-right-aligned-header" },
    ],
    [],
  );
  return (
    <>
    {/* Phones: two-line rows, the identity and amount first, then the reason, the deadline and Exhibit's call. */}
    <ul className="divide-y divide-rule px-5 sm:hidden">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/app/disputes/${r.id}`} className="-mx-2 block rounded-[8px] px-2 py-3 transition-colors hover:bg-hover">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[14px] font-medium text-ink">{r.buyer}</span>
              <span className="mono shrink-0 text-[13px] text-ink">{usd(r.amount)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-[13px] text-muted">
              <span className="min-w-0 truncate">
                {r.reason}
                {r.hoursLeft !== null ? (
                  <>
                    {" · "}
                    <span className={r.hoursLeft < 48 ? "num font-medium text-red" : "num text-ink-2"}>{dueLabel(r.hoursLeft)}</span>
                  </>
                ) : null}
              </span>
              <CallPill decision={r.decision} likelihood={r.likelihood} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
    <div className="ag-theme-exhibit max-sm:hidden">
      <AgGridReact<QueueRow>
        theme={queueTheme}
        rowData={rows}
        columnDefs={cols}
        domLayout="autoHeight"
        getRowId={(p) => p.data.id}
        suppressCellFocus
        onRowClicked={(e) => {
          if ((e.event?.target as HTMLElement | null)?.closest("a")) return;
          if (e.data) router.push(`/app/disputes/${e.data.id}`);
        }}
        defaultColDef={{ resizable: false, sortable: false, suppressMovable: true }}
      />
    </div>
    </>
  );
}
