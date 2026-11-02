"use client";

import { clsx } from "clsx";
import { CreditCard, MapPinOff, MessageSquareWarning, PackageX, Signature, Undo2, UploadCloud, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PreventionOrder, PreventionSignalKind, RiskBand } from "@/lib/prevention";

export const BAND: Record<RiskBand | "prevented", { label: string; color: string; soft: string; text: string }> = {
  high: { label: "High", color: "#dc2626", soft: "#fef2f2", text: "#b91c1c" },
  elevated: { label: "Elevated", color: "#e8a33d", soft: "#fdf6ea", text: "#9a5b0b" },
  watch: { label: "Watch", color: "#a3a3a3", soft: "#f5f5f5", text: "#525252" },
  clear: { label: "Clear", color: "#d4d4d4", soft: "#f5f5f5", text: "#737373" },
  prevented: { label: "Prevented", color: "#16a34a", soft: "#f0fdf4", text: "#15803d" },
};

export const SIGNAL_ICON: Record<PreventionSignalKind, LucideIcon> = {
  tracking_not_on_paypal: UploadCloud,
  tracking_stalled: PackageX,
  unsigned_high_value: Signature,
  address_mismatch: MapPinOff,
  refund_overdue: Undo2,
  buyer_waiting: MessageSquareWarning,
  weak_checkout: CreditCard,
};

export const SIGNAL_SHORT: Record<PreventionSignalKind, string> = {
  tracking_not_on_paypal: "No tracking on PayPal",
  tracking_stalled: "Tracking stalled",
  unsigned_high_value: "No signature",
  address_mismatch: "Address mismatch",
  refund_overdue: "Refund overdue",
  buyer_waiting: "Buyer waiting",
  weak_checkout: "Weak checkout",
};

export const SIGNAL_ORDER: PreventionSignalKind[] = ["tracking_not_on_paypal", "tracking_stalled", "buyer_waiting", "refund_overdue", "address_mismatch", "unsigned_high_value", "weak_checkout"];

export const bandOf = (o: Pick<PreventionOrder, "status" | "band">) => (o.status === "prevented" ? "prevented" : o.status === "at_risk" ? o.band : "clear");

export const money = (n: number, digits = 0) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });

/** Counts toward `value` whenever it changes. */
export function useTicker(value: number, ms = 900) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(a + (value - a) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);
  return shown;
}

export function ScoreRing({ score, band, size = 40, stroke = 3.5, className }: { score: number; band: RiskBand | "prevented"; size?: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const meta = BAND[band];
  return (
    <span className={clsx("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efefef" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={meta.color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(Math.max(band === "prevented" ? 100 : score, 2) / 100) * c} ${c}`}
          style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.22,1,0.36,1), stroke 0.3s" }}
        />
      </svg>
      <span className="num absolute text-[12px] font-medium" style={{ fontSize: size > 50 ? size * 0.3 : undefined, color: band === "prevented" ? meta.text : "var(--ink)" }}>
        {band === "prevented" ? "✓" : score}
      </span>
    </span>
  );
}

export function SignalChip({ kind, muted, className }: { kind: PreventionSignalKind; muted?: boolean; className?: string }) {
  const Icon = SIGNAL_ICON[kind];
  return (
    <span className={clsx("inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[12px] font-medium", muted ? "bg-sunken text-muted" : "bg-surface text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]", className)}>
      <Icon className="size-3.5" strokeWidth={1.9} />
      {SIGNAL_SHORT[kind]}
    </span>
  );
}

export function BandPill({ band }: { band: RiskBand | "prevented" }) {
  const m = BAND[band];
  return (
    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md px-2 text-[12px] font-medium" style={{ background: m.soft, color: m.text }}>
      <span className="size-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}
