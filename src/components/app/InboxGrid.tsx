"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { clsx } from "clsx";
import { ArrowUpRight, Clock3 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { InboxRow } from "@/lib/inbox";
import { dateTime, usd } from "@/lib/format";
import { Chip, DECISION_META, outcomeMeta } from "../ui/Chip";
import { CallPill, DeadlineBar } from "./cells";

ModuleRegistry.registerModules([AllCommunityModule]);

export const exhibitGridTheme = themeQuartz.withParams({
  fontFamily: "var(--font-geist)",
  fontSize: 13,
  dataFontSize: 13,
  headerFontSize: 11,
  headerFontWeight: 500,
  headerTextColor: "#737373",
  headerBackgroundColor: "#ffffff",
  backgroundColor: "#ffffff",
  foregroundColor: "#0a0a0a",
  borderColor: "#ebebeb",
  rowBorder: { color: "#f0f0f0" },
  columnBorder: false,
  headerColumnBorder: false,
  wrapperBorder: false,
  wrapperBorderRadius: 12,
  rowHoverColor: "#fafafa",
  selectedRowBackgroundColor: "#f5f5f5",
  accentColor: "#0a0a0a",
  checkboxCheckedBackgroundColor: "#0a0a0a",
  checkboxCheckedBorderColor: "#0a0a0a",
  cellHorizontalPadding: 16,
  spacing: 6,
  headerHeight: 38,
  rowHeight: 66,
});

const ACTION_WORD: Record<string, string> = {
  provide_evidence: "File evidence",
  provide_supporting_info: "Send to PayPal's review",
  refund_then_prove: "Refund, then file proof",
  make_offer: "Send an offer",
  accept_claim: "Accept and refund",
  send_message: "Message the buyer",
};

function CaseCell({ data }: ICellRendererParams<InboxRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full min-w-0 flex-col justify-center leading-tight">
      <div className="flex items-center gap-2">
        <span className="truncate font-medium">{data.buyer}</span>
        <span className="num shrink-0 text-[11.5px] text-faint">{data.id}</span>
      </div>
      <div className="mt-1 truncate text-[12.5px] text-muted">{data.headline ?? data.title ?? data.item}</div>
    </div>
  );
}

function ReasonCell({ data }: ICellRendererParams<InboxRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full flex-col items-start justify-center gap-1 leading-tight">
      <Chip tone={data.reasonCode === "UNAUTHORISED" ? "red" : "neutral"}>{data.reason}</Chip>
      <span className="pl-0.5 text-[11.5px] text-muted">{data.stage}</span>
    </div>
  );
}

function AmountCell({ data }: ICellRendererParams<InboxRow>) {
  if (!data) return null;
  return <div className="num flex h-full items-center justify-end text-[13.5px]">{usd(data.amount)}</div>;
}

function DueCell({ data }: ICellRendererParams<InboxRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full items-center">
      <DeadlineBar hoursLeft={data.hoursLeft} createdAt={data.createdAt} dueAt={data.dueAt} resolved={data.statusCode === "RESOLVED"} />
    </div>
  );
}

function CallCell({ data }: ICellRendererParams<InboxRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full items-center">
      <CallPill decision={data.decision} likelihood={data.likelihood} empty={data.statusCode === "RESOLVED" ? "Not analyzed" : "Not analyzed yet"} />
    </div>
  );
}

function StatusCell({ data }: ICellRendererParams<InboxRow>) {
  if (!data) return null;
  const o = outcomeMeta(data.outcome);
  if (o)
    return (
      <div className="flex h-full items-center">
        <Chip tone={o.tone} dot>
          {o.label}
        </Chip>
      </div>
    );
  if (data.answered)
    return (
      <div className="flex h-full flex-col justify-center gap-0.5 leading-tight">
        <span className="flex items-center gap-1.5 text-[12.5px] text-ink-2">
          <Clock3 className="size-3.5 text-muted" strokeWidth={1.75} /> {data.answered}
        </span>
        <span className="text-[11.5px] text-muted">{data.status}</span>
      </div>
    );
  return (
    <div className="flex h-full flex-col justify-center gap-0.5 leading-tight">
      <span className={clsx("text-[12.5px]", data.statusCode === "WAITING_FOR_SELLER_RESPONSE" ? "font-medium text-ink" : "text-muted")}>{data.status}</span>
      <span className="text-[11.5px] text-muted">{data.nextStep === "respond" && data.action ? `Next: ${ACTION_WORD[data.action] ?? "respond"}` : data.nextStep === "investigate" ? "Next: run Exhibit" : ""}</span>
    </div>
  );
}

type Hover = { row: InboxRow; x: number; y: number; above: boolean };

/** Detail on hover: the brief's summary, the action it takes and the exact deadline. */
function HoverCard({ h }: { h: Hover }) {
  const r = h.row;
  const m = r.decision ? DECISION_META[r.decision] : null;
  return createPortal(
    <div style={{ left: h.x, top: h.y }} className={clsx("app-shell pv-fade pointer-events-none fixed z-[90] w-[340px] rounded-xl border border-[#e4e4e4] bg-surface p-4 shadow-[0_20px_50px_-16px_rgb(0_0_0/0.25),0_6px_16px_-8px_rgb(0_0_0/0.1)]", h.above && "-translate-y-full")}>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-[13px] font-medium">
          {r.buyer} <span className="num text-[11.5px] font-normal text-faint">{r.id}</span>
        </span>
        <span className="num shrink-0 text-[12.5px]">{usd(r.amount)}</span>
      </div>
      <div className="mt-0.5 text-[12px] text-muted">
        {r.reason} · {r.stage} · {r.item}
      </div>
      {m ? (
        <>
          <div className="mt-3 flex items-center gap-2">
            <Chip tone={m.tone}>{m.label}</Chip>
            <span className="text-[12px] text-muted">
              {r.likelihood}% · {r.confidence?.toLowerCase()} confidence · {r.exhibits} exhibit{r.exhibits === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-2 line-clamp-4 text-[12.5px] leading-relaxed text-ink-2">{r.summary}</p>
          {r.action && !r.answered && r.statusCode !== "RESOLVED" ? <div className="mt-2 text-[12px] font-medium text-ink">Next: {ACTION_WORD[r.action]}</div> : null}
        </>
      ) : (
        <p className="mt-3 text-[12.5px] leading-relaxed text-ink-2">{r.statusCode === "RESOLVED" ? "Resolved by PayPal." : "Exhibit hasn't investigated this case yet. Open it and press Run Exhibit, or select it and choose Investigate."}</p>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[11.5px] text-muted">
        <span>{r.answered ? `${r.answered} ${r.answeredAt ? dateTime(r.answeredAt) : ""}` : r.dueAt ? `Respond by ${dateTime(r.dueAt)}` : r.closedAt ? `Closed ${dateTime(r.closedAt)}` : ""}</span>
        <span className="inline-flex items-center gap-0.5 text-ink-2">
          Open <ArrowUpRight className="size-3" />
        </span>
      </div>
    </div>,
    document.body,
  );
}

export function InboxGrid({ rows, onSelection, clearSignal }: { rows: InboxRow[]; onSelection: (ids: string[]) => void; clearSignal: number }) {
  const router = useRouter();
  const api = useRef<GridApi<InboxRow> | null>(null);
  const [hover, setHover] = useState<Hover | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.current?.deselectAll();
  }, [clearSignal]);

  const cols = useMemo<ColDef<InboxRow>[]>(
    () => [
      // valueGetters fold in every field a renderer reads, so AG Grid refreshes the cell when any of them changes.
      { headerName: "Due", colId: "due", valueGetter: (p) => (p.data?.statusCode === "RESOLVED" ? 1e9 : (p.data?.hoursLeft ?? 1e8)), width: 118, cellRenderer: DueCell, sortable: true, sort: "asc" },
      { headerName: "Case", colId: "case", valueGetter: (p) => `${p.data?.buyer}|${p.data?.headline ?? p.data?.title ?? ""}`, flex: 2.4, minWidth: 260, cellRenderer: CaseCell, sortable: true },
      { headerName: "Reason", field: "reason", flex: 1, minWidth: 150, cellRenderer: ReasonCell, sortable: true },
      { headerName: "Amount", field: "amount", width: 112, cellRenderer: AmountCell, headerClass: "ag-right-aligned-header", sortable: true },
      { headerName: "Exhibit's call", colId: "call", valueGetter: (p) => (p.data?.decision ? `${p.data.decision}|${p.data.likelihood}` : ""), flex: 1.1, minWidth: 176, cellRenderer: CallCell, sortable: true, comparator: (_a, _b, na, nb) => (na.data?.likelihood ?? -1) - (nb.data?.likelihood ?? -1) },
      { headerName: "Status", colId: "status", valueGetter: (p) => `${p.data?.status}|${p.data?.outcome ?? ""}|${p.data?.answered ?? ""}|${p.data?.nextStep ?? ""}`, flex: 1.1, minWidth: 170, cellRenderer: StatusCell },
    ],
    [],
  );

  const showHover = useCallback((row: InboxRow, el: HTMLElement | null) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = el?.getBoundingClientRect();
      if (!r) return;
      const above = r.bottom + 230 > window.innerHeight;
      setHover({ row, x: Math.min(Math.max(16, r.left + 280), window.innerWidth - 356), y: above ? r.top - 4 : r.bottom + 4, above });
    }, 420);
  }, []);
  const hideHover = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setHover(null);
  }, []);

  return (
    <>
      <div className="card hidden overflow-hidden lg:block ag-theme-exhibit" onMouseLeave={hideHover}>
        <AgGridReact<InboxRow>
          theme={exhibitGridTheme}
          rowData={rows}
          columnDefs={cols}
          domLayout="autoHeight"
          getRowId={(p) => p.data.id}
          suppressCellFocus
          animateRows
          rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: false }}
          selectionColumnDef={{ width: 48, pinned: false, suppressHeaderMenuButton: true }}
          onGridReady={(e) => (api.current = e.api)}
          onSelectionChanged={(e) => onSelection(e.api.getSelectedRows().map((r) => r.id))}
          getRowClass={(p) => (p.data?.statusCode === "RESOLVED" ? "opacity-70" : undefined)}
          onCellMouseOver={(e) => e.data && e.colDef.colId !== "ag-Grid-SelectionColumn" && showHover(e.data, (e.event?.target as HTMLElement | null)?.closest(".ag-row") as HTMLElement | null)}
          onCellMouseOut={hideHover}
          onRowClicked={(e) => {
            const t = e.event?.target as HTMLElement | null;
            if (t?.closest(".ag-selection-checkbox, .ag-checkbox-input-wrapper")) return;
            if (e.data) router.push(`/app/disputes/${e.data.id}`);
          }}
          defaultColDef={{ resizable: false, sortable: false, suppressMovable: true }}
        />
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 lg:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/app/disputes/${r.id}`} className={clsx("card block px-4 py-3", r.statusCode === "RESOLVED" && "opacity-70")}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-medium">{r.buyer}</div>
                  <div className="mt-0.5 truncate text-[12px] text-muted">
                    {r.reason} · {r.stage}
                  </div>
                </div>
                <div className="num shrink-0 text-[13.5px]">{usd(r.amount)}</div>
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <CallPill decision={r.decision} likelihood={r.likelihood} />
                <DeadlineBar hoursLeft={r.hoursLeft} createdAt={r.createdAt} dueAt={r.dueAt} resolved={r.statusCode === "RESOLVED"} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {hover ? <HoverCard h={hover} /> : null}
    </>
  );
}
