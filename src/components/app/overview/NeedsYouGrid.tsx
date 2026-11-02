"use client";

import { AllCommunityModule, ModuleRegistry, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { ArrowRight, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { QueueRow } from "@/lib/overview";
import { usd } from "@/lib/format";
import { CallPill, DeadlineBar } from "../cells";
import { exhibitGridTheme } from "../InboxGrid";

ModuleRegistry.registerModules([AllCommunityModule]);

const queueTheme = exhibitGridTheme.withParams({ rowHeight: 54, headerHeight: 34, wrapperBorderRadius: 0, cellHorizontalPadding: 14 });

function DeadlineCell({ data }: ICellRendererParams<QueueRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full items-center">
      <DeadlineBar hoursLeft={data.hoursLeft} createdAt={data.createdAt} dueAt={data.dueAt} />
    </div>
  );
}

function CaseCell({ data }: ICellRendererParams<QueueRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full min-w-0 flex-col justify-center leading-tight" title={data.id}>
      <div className="truncate font-medium">{data.buyer}</div>
      <div className="mt-1 truncate text-[12px] text-muted">
        {data.reason} · {data.stage}
      </div>
    </div>
  );
}

function AmountCell({ data }: ICellRendererParams<QueueRow>) {
  if (!data) return null;
  return <div className="num flex h-full items-center justify-end text-[13px]">{usd(data.amount, 0)}</div>;
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
  if (data.next === "waiting")
    return (
      <div className="flex h-full items-center justify-end gap-1.5 text-[12px] text-muted">
        <Clock3 className="size-3.5 shrink-0" strokeWidth={1.75} /> <span className="truncate">{data.acted}</span>
      </div>
    );
  return (
    <div className="flex h-full items-center justify-end">
      <span className="inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface px-2.5 text-[12px] font-medium text-ink shadow-[0_1px_1px_rgb(0_0_0/0.03)] transition-colors group-hover:border-line-strong">
        {data.next === "approve" ? "Review" : "Run"}
        <ArrowRight className="size-3" />
      </span>
    </div>
  );
}

export function NeedsYouGrid({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const cols = useMemo<ColDef<QueueRow>[]>(
    () => [
      { headerName: "Due", field: "hoursLeft", width: 90, cellRenderer: DeadlineCell, sortable: true, sort: "asc", comparator: (a, b) => (a ?? 1e9) - (b ?? 1e9) },
      { headerName: "Case", colId: "case", valueGetter: (p) => `${p.data?.buyer}|${p.data?.reason}`, flex: 1.3, minWidth: 112, cellRenderer: CaseCell },
      { headerName: "Amount", field: "amount", width: 86, cellRenderer: AmountCell, headerClass: "ag-right-aligned-header", sortable: true },
      {
        headerName: "Exhibit's call",
        colId: "call",
        valueGetter: (p) => (p.data?.decision ? `${p.data.decision}|${p.data.likelihood}` : ""),
        flex: 1.3,
        minWidth: 158,
        cellRenderer: CallCell,
        sortable: true,
        comparator: (_a, _b, na, nb) => (na.data?.likelihood ?? -1) - (nb.data?.likelihood ?? -1),
      },
      { headerName: "", colId: "next", valueGetter: (p) => `${p.data?.next}|${p.data?.acted ?? ""}`, width: 128, cellRenderer: NextCell, cellClass: "group" },
    ],
    [],
  );
  return (
    <div className="ag-theme-exhibit">
      <AgGridReact<QueueRow>
        theme={queueTheme}
        rowData={rows}
        columnDefs={cols}
        domLayout="autoHeight"
        getRowId={(p) => p.data.id}
        suppressCellFocus
        animateRows
        onRowClicked={(e) => e.data && router.push(`/app/disputes/${e.data.id}`)}
        defaultColDef={{ resizable: false, sortable: false, suppressMovable: true }}
      />
    </div>
  );
}
