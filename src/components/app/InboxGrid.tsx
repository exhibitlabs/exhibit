"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi, type ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { clsx } from "clsx";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { InboxRow } from "@/lib/inbox";
import { dateTime, dueLabel, usd } from "@/lib/format";
import { Chip, DECISION_META, outcomeMeta } from "../ui/Chip";
import { CallPill, DeadlineBar } from "./cells";
import { plain } from "@/lib/plain";

ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * The one table style: Geist 14, 12px grey sentence-case headers on no fill with one rule under them, #f1f1f0
 * row rules, no column lines, no zebra, a #f7f7f6 hover. Numbers right-aligned in tabular figures by the cells.
 */
export const exhibitGridTheme = themeQuartz.withParams({
  fontFamily: "var(--font-geist)",
  fontSize: 14,
  dataFontSize: 14,
  headerFontSize: 12,
  headerFontWeight: 400,
  headerTextColor: "#6b6b6a",
  headerBackgroundColor: "#ffffff",
  headerCellHoverBackgroundColor: "#ffffff",
  headerRowBorder: { color: "#ebebea" },
  backgroundColor: "#ffffff",
  foregroundColor: "#0a0a0a",
  borderColor: "#ebebea",
  rowBorder: { color: "#f1f1f0" },
  columnBorder: false,
  headerColumnBorder: false,
  wrapperBorder: false,
  wrapperBorderRadius: 0,
  rowHoverColor: "#f7f7f6",
  selectedRowBackgroundColor: "#f3f3f2",
  accentColor: "#0a0a0a",
  checkboxBorderRadius: 4,
  checkboxUncheckedBorderColor: "#cdcdca",
  checkboxCheckedBackgroundColor: "#0a0a0a",
  checkboxCheckedBorderColor: "#0a0a0a",
  iconSize: 12,
  cellHorizontalPadding: 16,
  spacing: 6,
  headerHeight: 36,
  rowHeight: 60,
});

const ACTION_WORD: Record<string, string> = {
  provide_evidence: "File evidence",
  provide_supporting_info: "Send to PayPal's review",
  refund_then_prove: "Refund, then file proof",
  make_offer: "Send an offer",
  accept_claim: "Accept and refund",
  send_message: "Message the buyer",
};

/** What the merchant does next on a row, in words: the one trailing column every row shares. */
function nextStep(r: InboxRow): { label: string; act: boolean } {
  if (r.statusCode === "RESOLVED") return { label: "", act: false };
  if (r.answered) return { label: `${r.answered}, with PayPal`, act: false };
  if (r.nextStep === "investigate") return { label: "Run Exhibit", act: true };
  if (r.nextStep === "respond" && r.action) return { label: ACTION_WORD[r.action] ?? "Respond", act: true };
  return { label: r.status, act: false };
}

/** The identity cell links to the case, so the table is reachable by keyboard as well as by row click. */
function CaseCell({ data }: ICellRendererParams<InboxRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full min-w-0 flex-col justify-center leading-tight">
      <div className="flex min-w-0 items-baseline gap-2">
        <Link href={`/app/disputes/${data.id}`} className="truncate rounded-[4px] font-medium text-ink hover:underline hover:decoration-line-strong hover:underline-offset-2">
          {data.buyer}
        </Link>
        <span className="mono shrink-0 text-[12px] text-faint">{data.id}</span>
      </div>
      <div className="mt-1 truncate text-[13px] text-muted">{data.headline ? plain(data.headline) : (data.title ?? data.item)}</div>
    </div>
  );
}

function ReasonCell({ data }: ICellRendererParams<InboxRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full min-w-0 flex-col justify-center leading-tight">
      <span className="truncate text-[14px] text-ink-2">{data.reason}</span>
      <span className="mt-1 text-[13px] text-muted">{data.stage}</span>
    </div>
  );
}

function AmountCell({ data }: ICellRendererParams<InboxRow>) {
  if (!data) return null;
  return <div className="mono flex h-full items-center justify-end text-[13px] text-ink">{usd(data.amount)}</div>;
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

function NextCell({ data }: ICellRendererParams<InboxRow>) {
  if (!data) return null;
  const o = outcomeMeta(data.outcome, data.answered);
  if (o)
    return (
      <div className="flex h-full items-center justify-end">
        <Chip tone={o.tone}>{o.label}</Chip>
      </div>
    );
  const n = nextStep(data);
  return (
    <div className="flex h-full items-center justify-end">
      {n.act ? (
        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-ink">
          {n.label}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      ) : (
        <span className="truncate text-[13px] text-muted">{n.label}</span>
      )}
    </div>
  );
}

/** Open cases by deadline, soonest first; resolved cases last. The grid's default sort, for the phone list too. */
const dueKey = (r: InboxRow) => (r.statusCode === "RESOLVED" ? 1e9 : (r.hoursLeft ?? 1e8));
const byDeadline = (a: InboxRow, b: InboxRow) => dueKey(a) - dueKey(b);

type Hover = { row: InboxRow; x: number; y: number; above: boolean };

/** Detail on hover: the brief's summary, the action it takes and the exact deadline. */
function HoverCard({ h }: { h: Hover }) {
  const r = h.row;
  const m = r.decision ? DECISION_META[r.decision] : null;
  return createPortal(
    <div style={{ left: h.x, top: h.y }} className={clsx("app-shell pv-fade pointer-events-none fixed z-[90] w-[352px] rounded-[10px] border border-line bg-surface p-4 shadow-[0_20px_50px_-16px_rgb(0_0_0/0.22),0_4px_14px_-6px_rgb(0_0_0/0.08)]", h.above && "-translate-y-full")}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[14px] font-medium">
          {r.buyer} <span className="mono text-[12px] font-normal text-faint">{r.id}</span>
        </span>
        <span className="mono shrink-0 text-[13px]">{usd(r.amount)}</span>
      </div>
      <div className="mt-0.5 truncate text-[13px] text-muted">
        {r.reason} · {r.stage} · {r.item}
      </div>
      {m ? (
        <>
          <div className="mt-3 flex items-center gap-2">
            <Chip tone={m.tone}>{m.label}</Chip>
            <span className="text-[13px] text-muted">
              {r.likelihood}% · {r.confidence?.toLowerCase()} confidence · {r.exhibits} exhibit{r.exhibits === 1 ? "" : "s"}
            </span>
          </div>
          <p className="mt-2 line-clamp-4 text-[13px] leading-[20px] text-ink-2">{r.summary ? plain(r.summary) : null}</p>
          {r.action && !r.answered && r.statusCode !== "RESOLVED" ? <div className="mt-2 text-[13px] font-medium text-ink">Next: {ACTION_WORD[r.action]}</div> : null}
        </>
      ) : (
        <p className="mt-3 text-[13px] leading-[20px] text-ink-2">{r.statusCode === "RESOLVED" ? "Resolved by PayPal." : "Exhibit hasn't investigated this case yet. Open it and press Run Exhibit, or select it and choose Investigate."}</p>
      )}
      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[12px] text-muted">
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
      { headerName: "Due", colId: "due", valueGetter: (p) => (p.data ? dueKey(p.data) : 1e9), width: 112, cellRenderer: DueCell, sortable: true, sort: "asc" },
      { headerName: "Case", colId: "case", valueGetter: (p) => `${p.data?.buyer}|${p.data?.headline ?? p.data?.title ?? ""}`, flex: 2.3, minWidth: 260, cellRenderer: CaseCell, sortable: true },
      { headerName: "Reason", field: "reason", flex: 1, minWidth: 168, cellRenderer: ReasonCell, sortable: true },
      { headerName: "Amount", field: "amount", width: 112, cellRenderer: AmountCell, type: "rightAligned", sortable: true },
      { headerName: "Exhibit's call", colId: "call", valueGetter: (p) => (p.data?.decision ? `${p.data.decision}|${p.data.likelihood}` : ""), width: 150, cellRenderer: CallCell, sortable: true, comparator: (_a, _b, na, nb) => (na.data?.likelihood ?? -1) - (nb.data?.likelihood ?? -1) },
      { headerName: "Next step", colId: "next", valueGetter: (p) => `${p.data?.status}|${p.data?.outcome ?? ""}|${p.data?.answered ?? ""}|${p.data?.nextStep ?? ""}|${p.data?.action ?? ""}`, width: 196, cellRenderer: NextCell, cellClass: "group", headerClass: "ag-right-aligned-header" },
    ],
    [],
  );

  const showHover = useCallback((row: InboxRow, el: HTMLElement | null) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = el?.getBoundingClientRect();
      if (!r) return;
      const above = r.bottom + 230 > window.innerHeight;
      setHover({ row, x: Math.min(Math.max(16, r.left + 300), window.innerWidth - 368), y: above ? r.top - 4 : r.bottom + 4, above });
    }, 500);
  }, []);
  const hideHover = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setHover(null);
  }, []);

  return (
    <>
      <div className="ag-theme-exhibit hidden lg:block" onMouseLeave={hideHover}>
        <AgGridReact<InboxRow>
          theme={exhibitGridTheme}
          rowData={rows}
          columnDefs={cols}
          domLayout="autoHeight"
          getRowId={(p) => p.data.id}
          suppressCellFocus
          rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: false }}
          selectionColumnDef={{ width: 44, pinned: false, suppressHeaderMenuButton: true }}
          onGridReady={(e) => (api.current = e.api)}
          onSelectionChanged={(e) => onSelection(e.api.getSelectedRows().map((r) => r.id))}
          getRowClass={(p) => (p.data?.statusCode === "RESOLVED" ? "text-ink-2" : undefined)}
          onCellMouseOver={(e) => e.data && e.colDef.colId !== "ag-Grid-SelectionColumn" && showHover(e.data, (e.event?.target as HTMLElement | null)?.closest(".ag-row") as HTMLElement | null)}
          onCellMouseOut={hideHover}
          onRowClicked={(e) => {
            const t = e.event?.target as HTMLElement | null;
            if (t?.closest(".ag-selection-checkbox, .ag-checkbox-input-wrapper, a")) return;
            if (e.data) router.push(`/app/disputes/${e.data.id}`);
          }}
          defaultColDef={{ resizable: false, sortable: false, suppressMovable: true }}
        />
      </div>
      {/* Phones and tablets: two-line rows. The identity and amount on line 1; reason, stage, deadline and call on line 2. */}
      <ul className="divide-y divide-rule lg:hidden">
        {[...rows].sort(byDeadline).map((r) => {
          const n = nextStep(r);
          const o = outcomeMeta(r.outcome, r.answered);
          const due = r.statusCode !== "RESOLVED" && r.hoursLeft !== null ? dueLabel(r.hoursLeft) : null;
          return (
            <li key={r.id}>
              <Link href={`/app/disputes/${r.id}`} className="-mx-2 block rounded-[8px] px-2 py-3 transition-colors hover:bg-hover">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[14px] font-medium text-ink">
                    {r.buyer} <span className="mono text-[12px] font-normal text-faint">{r.id}</span>
                  </span>
                  <span className="mono shrink-0 text-[13px] text-ink">{usd(r.amount)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-[13px] text-muted">
                  <span className="min-w-0 truncate">
                    {r.reason} · {r.stage}
                    {due ? (
                      <>
                        {" · "}
                        <span className={clsx("num", r.hoursLeft! < 48 ? "font-medium text-red" : "text-ink-2")}>{due}</span>
                      </>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">{o ? <Chip tone={o.tone}>{o.label}</Chip> : r.decision ? <CallPill decision={r.decision} likelihood={r.likelihood} /> : <span className={n.act ? "font-medium text-ink" : ""}>{n.label}</span>}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {hover ? <HoverCard h={hover} /> : null}
    </>
  );
}
