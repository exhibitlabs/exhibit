"use client";

import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { clsx } from "clsx";
import { Check, CircleDashed, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PreventionAction, PreventionOrder } from "@/lib/prevention";
import { Button } from "../ui/Button";
import { exhibitGridTheme } from "./InboxGrid";
import { BAND, bandOf, BandPill, money, SignalChip } from "./PreventionParts";

type Ctx = { onSelect: (id: string) => void; onFix: (id: string, action: PreventionAction) => void; working: Set<string> };
type P = ICellRendererParams<PreventionOrder, unknown, Ctx>;

function OrderCell({ data }: P) {
  if (!data) return null;
  return (
    <div className="flex h-full flex-col justify-center leading-tight">
      <span className="font-medium">{data.buyer}</span>
      <span className="num mt-1 truncate text-[11.5px] text-faint">
        {data.orderId} · {data.item}
      </span>
    </div>
  );
}

function RiskCell({ data }: P) {
  if (!data) return null;
  const b = bandOf(data);
  if (data.status !== "at_risk")
    return (
      <div className="flex h-full items-center">
        <span className="text-[12.5px]" style={{ color: BAND[b].text }}>
          {data.status === "prevented" ? `${data.history.find((h) => h.before.score)?.before.score ?? "–"} → 0` : "—"}
        </span>
      </div>
    );
  return (
    <div className="flex h-full items-center gap-2.5">
      <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-[#f0f0f0]">
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${data.score}%`, background: BAND[b].color }} />
      </span>
      <span className="num text-[13px]">{data.score}</span>
    </div>
  );
}

function SignalsCell({ data }: P) {
  if (!data) return null;
  if (!data.signals.length) return <div className="flex h-full items-center text-[12.5px] text-faint">{data.status === "prevented" ? "Fixed by Exhibit" : "Nothing to fix"}</div>;
  return (
    <div className="flex h-full items-center gap-1.5 overflow-hidden">
      {data.signals.slice(0, 2).map((s) => (
        <SignalChip key={s.kind} kind={s.kind} />
      ))}
      {data.signals.length > 2 ? <span className="num text-[11.5px] text-faint">+{data.signals.length - 2}</span> : null}
    </div>
  );
}

function SyncCell({ data }: P) {
  if (!data) return null;
  if (!data.shipment) return <div className="flex h-full items-center text-[12.5px] text-faint">Not shipped</div>;
  return (
    <div className="flex h-full items-center">
      {data.shipment.onPayPal ? (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-green">
          <Check className="size-3.5" strokeWidth={2.5} /> On PayPal
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
          <CircleDashed className="size-3.5" /> Missing
        </span>
      )}
    </div>
  );
}

function FixCell({ data, context }: P) {
  if (!data) return null;
  const fix = data.fixes.find((f) => f.primary);
  if (data.status === "prevented")
    return (
      <div className="flex h-full items-center text-[12.5px] text-green">
        <Check className="mr-1 size-3.5" strokeWidth={2.5} /> {money(data.saved)} saved
      </div>
    );
  if (!fix) return null;
  const busy = context?.working.has(data.orderId);
  return (
    <div className="flex h-full items-center">
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={(e) => {
          e.stopPropagation();
          context?.onFix(data.orderId, fix.action);
        }}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
        {fix.label}
      </Button>
    </div>
  );
}

const TABS = [
  { id: "all", label: "All" },
  { id: "at_risk", label: "At risk" },
  { id: "prevented", label: "Prevented" },
  { id: "clear", label: "Clear" },
] as const;

export function PreventionGrid({ orders, onSelect, onFix, working, onPushAll, pushing }: Ctx & { orders: PreventionOrder[]; onPushAll: () => void; pushing: boolean }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  const rows = useMemo(() => (tab === "all" ? orders : orders.filter((o) => (tab === "clear" ? o.status === "clear" || o.status === "dismissed" : o.status === tab))), [orders, tab]);
  const shipped = orders.filter((o) => o.shipment);
  const missing = shipped.filter((o) => !o.shipment?.onPayPal);
  const pct = shipped.length ? Math.round(((shipped.length - missing.length) / shipped.length) * 100) : 100;
  const context = useMemo<Ctx>(() => ({ onSelect, onFix, working }), [onSelect, onFix, working]);
  const grid = useRef<AgGridReact<PreventionOrder>>(null);
  // Cell renderers read `working` from context, which AG Grid does not watch.
  useEffect(() => {
    grid.current?.api?.refreshCells({ columns: ["fix"], force: true });
  }, [working]);

  const cols = useMemo<ColDef<PreventionOrder>[]>(
    () => [
      { headerName: "Order", field: "buyer", flex: 1.5, minWidth: 220, cellRenderer: OrderCell },
      { headerName: "Risk", field: "score", width: 130, cellRenderer: RiskCell, sort: "desc" },
      { headerName: "Signals", flex: 1.6, minWidth: 260, cellRenderer: SignalsCell, sortable: false },
      { headerName: "Likely dispute", valueGetter: (p) => p.data?.top?.reasonLabel ?? "", width: 160, cellClass: "text-ink-2" },
      { headerName: "Exposure", field: "exposure", width: 112, cellClass: "num", valueFormatter: (p) => money(p.value) },
      { headerName: "PayPal tracking", valueGetter: (p) => (p.data?.shipment ? (p.data.shipment.onPayPal ? 1 : 0) : 2), width: 140, cellRenderer: SyncCell },
      {
        headerName: "Status",
        valueGetter: (p) => p.data?.status ?? "",
        width: 120,
        cellRenderer: (p: P) => (p.data ? <div className="flex h-full items-center"><BandPill band={bandOf(p.data)} /></div> : null),
      },
      { headerName: "", colId: "fix", width: 210, cellRenderer: FixCell, sortable: false },
    ],
    [],
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-4">
          <h2 className="text-[14px] font-medium">Every watched order</h2>
          <div className="flex items-center rounded-lg bg-sunken p-0.5">
            {TABS.map((t) => {
              const n = t.id === "all" ? orders.length : orders.filter((o) => (t.id === "clear" ? o.status === "clear" || o.status === "dismissed" : o.status === t.id)).length;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} className={clsx("h-7 rounded-md px-2.5 text-[12.5px] transition-colors", tab === t.id ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line),0_1px_2px_rgb(0_0_0/0.04)]" : "text-muted hover:text-ink")}>
                  {t.label} <span className="num ml-0.5 text-faint">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {shipped.length ? (
            <span className="text-[12px] text-muted">
              Tracking on PayPal <span className="num text-ink">{pct}%</span>
            </span>
          ) : null}
          <Button size="sm" variant={missing.length ? "secondary" : "ghost"} disabled={pushing || !missing.length} onClick={onPushAll}>
            {pushing ? <Loader2 className="size-3.5 animate-spin" /> : <UploadCloud className="size-3.5" />}
            {missing.length ? `Push ${missing.length} missing to PayPal` : shipped.length ? "All tracking synced" : "No shipments to sync"}
          </Button>
        </div>
      </div>
      <div className="ag-theme-exhibit">
        <AgGridReact<PreventionOrder>
          ref={grid}
          theme={exhibitGridTheme}
          rowData={rows}
          columnDefs={cols}
          context={context}
          domLayout="autoHeight"
          getRowId={(p) => p.data.orderId}
          suppressCellFocus
          overlayNoRowsTemplate={`<span style="color: var(--muted); font-size: 13px">${orders.length ? "Nothing in this view." : "No recent orders to watch yet."}</span>`}
          defaultColDef={{ suppressMovable: true }}
          rowHeight={58}
          onRowClicked={(e) => e.data && e.data.status === "at_risk" && onSelect(e.data.orderId)}
          rowClassRules={{ "pv-row-done": (p) => p.data?.status === "prevented" }}
        />
      </div>
    </div>
  );
}
