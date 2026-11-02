"use client";

import { AllCommunityModule, ModuleRegistry, type ColDef, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { ArrowRight, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { QueueRow } from "@/lib/overview";
import { dateTime, dueLabel, usd } from "@/lib/format";
import { DecisionChip } from "../../ui/Chip";
import { exhibitGridTheme } from "../InboxGrid";

ModuleRegistry.registerModules([AllCommunityModule]);

const queueTheme = exhibitGridTheme.withParams({ rowHeight: 54, headerHeight: 34, wrapperBorderRadius: 0, cellHorizontalPadding: 14 });

/** Time left in PayPal's response window, as a countdown bar that turns red inside 48 hours. */
function DeadlineCell({ data }: ICellRendererParams<QueueRow>) {
  if (!data) return null;
  const h = data.hoursLeft;
  const urgent = h !== null && h < 48;
  const left = h !== null && data.windowHours ? Math.max(0.03, Math.min(1, h / data.windowHours)) : 0;
  return (
    <div className="flex h-full flex-col justify-center gap-1.5" title={data.dueAt ? `Respond by ${dateTime(data.dueAt)}` : undefined}>
      <div className={`flex items-center gap-1.5 text-[13px] font-medium ${urgent ? "text-red" : h !== null && h < 120 ? "text-ink" : "text-ink-2"}`}>
        {urgent ? <span className="pulse-dot size-1.5 rounded-full bg-red" /> : null}
        <span className="num">{dueLabel(h)}</span>
      </div>
      <div className="h-[3px] w-[80px] overflow-hidden rounded-full bg-[#efefef]">
        <div className="bar-grow h-full rounded-full" style={{ width: `${left * 100}%`, background: urgent ? "var(--red)" : "var(--ink)" }} />
      </div>
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

/** Exhibit's call with its win likelihood as a bar: the decision pill and the number carry the meaning. */
function CallCell({ data }: ICellRendererParams<QueueRow>) {
  if (!data) return null;
  if (!data.decision) return <div className="flex h-full items-center text-[12px] text-faint">Not analyzed yet</div>;
  const l = data.likelihood ?? 0;
  return (
    <div className="flex h-full items-center gap-2.5">
      <DecisionChip decision={data.decision} />
      <span className="relative h-1 w-12 overflow-hidden rounded-full bg-[#ececec]">
        <span className="bar-grow absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${Math.max(4, l)}%` }} />
      </span>
      <span className="num text-[12px] text-ink-2">{l}%</span>
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
      { headerName: "Case", colId: "case", valueGetter: (p) => `${p.data?.buyer}|${p.data?.reason}`, flex: 1.5, minWidth: 112, cellRenderer: CaseCell },
      { headerName: "Amount", field: "amount", width: 86, cellRenderer: AmountCell, headerClass: "ag-right-aligned-header", sortable: true },
      {
        headerName: "Exhibit's call",
        colId: "call",
        valueGetter: (p) => (p.data?.decision ? `${p.data.decision}|${p.data.likelihood}` : ""),
        flex: 1.1,
        minWidth: 124,
        cellRenderer: CallCell,
        sortable: true,
        comparator: (_a, _b, na, nb) => (na.data?.likelihood ?? -1) - (nb.data?.likelihood ?? -1),
      },
      { headerName: "", colId: "next", valueGetter: (p) => `${p.data?.next}|${p.data?.acted ?? ""}`, width: 144, cellRenderer: NextCell, cellClass: "group" },
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
