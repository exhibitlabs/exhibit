"use client";

import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Check, Loader2, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PreventionAction, PreventionOrder } from "@/lib/prevention";
import { Button } from "../ui/Button";
import { exhibitGridTheme } from "./InboxGrid";
import { BAND, bandOf, money, SIGNAL_SHORT } from "./PreventionParts";
import { Segmented } from "../ui/Tabs";

type Ctx = { onSelect: (id: string) => void; onFix: (id: string, action: PreventionAction) => void; working: Set<string> };
type P = ICellRendererParams<PreventionOrder, unknown, Ctx>;

function OrderCell({ data }: P) {
  if (!data) return null;
  return (
    <div className="flex h-full min-w-0 flex-col justify-center leading-tight">
      <span className="truncate font-medium text-ink">{data.buyer}</span>
      <span className="mt-1 truncate text-[13px] text-muted">
        <span className="mono text-[12px]">{data.orderId}</span> · {data.item}
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
        <span className="num text-[13px]" style={{ color: data.status === "prevented" ? BAND.prevented.text : "var(--muted)" }}>
          {data.status === "prevented" ? `${data.history.find((h) => h.before.score)?.before.score ?? "–"} → 0` : "–"}
        </span>
      </div>
    );
  return (
    <div className="flex h-full items-center gap-2">
      <span className="num w-6 text-right text-[14px] font-medium text-ink">{data.score}</span>
      <span className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: BAND[b].text }}>
        <span className="size-1.5 rounded-full" style={{ background: BAND[b].color }} />
        {BAND[b].label}
      </span>
    </div>
  );
}

function SignalsCell({ data }: P) {
  if (!data) return null;
  if (!data.signals.length) return <div className="flex h-full items-center text-[13px] text-muted">{data.status === "prevented" ? "Fixed by Exhibit" : "Nothing to fix"}</div>;
  return (
    <div className="flex h-full items-center truncate text-[13px] text-ink-2" title={data.signals.map((s) => SIGNAL_SHORT[s.kind]).join(", ")}>
      {data.signals.slice(0, 2).map((s) => SIGNAL_SHORT[s.kind]).join(" · ")}
      {data.signals.length > 2 ? <span className="text-muted">&nbsp;· +{data.signals.length - 2}</span> : null}
    </div>
  );
}

function SyncCell({ data }: P) {
  if (!data) return null;
  if (!data.shipment) return <div className="flex h-full items-center text-[13px] text-muted">Not shipped</div>;
  return (
    <div className="flex h-full items-center">
      {data.shipment.onPayPal ? (
        <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
          <Check className="size-3.5" strokeWidth={2.2} /> On PayPal
        </span>
      ) : (
        <span className="text-[13px] font-medium text-ink">Missing</span>
      )}
    </div>
  );
}

function FixCell({ data, context }: P) {
  if (!data) return null;
  const fix = data.fixes.find((f) => f.primary);
  if (data.status === "prevented")
    return (
      <div className="flex h-full items-center justify-end text-[13px] text-green">
        <Check className="mr-1 size-3.5" strokeWidth={2.5} /> {money(data.saved)} saved
      </div>
    );
  if (!fix) return null;
  const busy = context?.working.has(data.orderId);
  return (
    <div className="flex h-full items-center justify-end">
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
      { headerName: "Risk", field: "score", width: 124, cellRenderer: RiskCell, sort: "desc" },
      { headerName: "Signals", flex: 1.3, minWidth: 200, cellRenderer: SignalsCell, sortable: false },
      { headerName: "Likely dispute", valueGetter: (p) => p.data?.top?.reasonLabel ?? "–", width: 156, cellClass: "text-ink-2 text-[13px]" },
      { headerName: "Exposure", field: "exposure", width: 108, type: "rightAligned", cellClass: "ag-right-aligned-cell mono text-[13px]", valueFormatter: (p) => money(p.value) },
      { headerName: "PayPal tracking", valueGetter: (p) => (p.data?.shipment ? (p.data.shipment.onPayPal ? 1 : 0) : 2), width: 132, cellRenderer: SyncCell },
      { headerName: "Fix", colId: "fix", width: 200, cellRenderer: FixCell, sortable: false, headerClass: "ag-right-aligned-header" },
    ],
    [],
  );

  return (
    <section className="card overflow-hidden border" aria-label="Every watched order">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 border-b border-line px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h2 className="text-[14px] font-semibold text-ink">Every watched order</h2>
          <Segmented
            value={tab}
            onChange={setTab}
            items={TABS.map((t) => ({ key: t.id, label: t.label, count: t.id === "all" ? orders.length : orders.filter((o) => (t.id === "clear" ? o.status === "clear" || o.status === "dismissed" : o.status === t.id)).length }))}
          />
        </div>
        <div className="flex items-center gap-3">
          {shipped.length ? (
            <span className="text-[13px] text-muted">
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
          defaultColDef={{ suppressMovable: true, resizable: false }}
          rowHeight={56}
          onRowClicked={(e) => e.data && e.data.status === "at_risk" && onSelect(e.data.orderId)}
          rowClassRules={{ "pv-row-done": (p) => p.data?.status === "prevented" }}
        />
      </div>
    </section>
  );
}
