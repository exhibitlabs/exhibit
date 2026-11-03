"use client";

import { clsx } from "clsx";
import { Check, CreditCard, MapPinOff, MessageSquareWarning, PackageX, Signature, Undo2, UploadCloud, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PreventionOrder, PreventionSignalKind, RiskBand } from "@/lib/prevention";

/**
 * Risk bands. Red is kept for the one band that is about to become a dispute; elevated and watch are two greys;
 * green is a dispute Exhibit prevented. The brand's gold is not a status colour.
 */
export const BAND: Record<RiskBand | "prevented", { label: string; color: string; soft: string; text: string }> = {
  high: { label: "High", color: "#b91c1c", soft: "#fdf2f2", text: "#b91c1c" },
  elevated: { label: "Elevated", color: "#8a8a87", soft: "#f1f1ef", text: "#3d3d3c" },
  watch: { label: "Watch", color: "#c9c9c6", soft: "#f1f1ef", text: "#6b6b6a" },
  clear: { label: "Clear", color: "#e3e3e1", soft: "#f6f6f5", text: "#6b6b6a" },
  prevented: { label: "Prevented", color: "#15803d", soft: "#eef7f1", text: "#15803d" },
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

export function ScoreRing({ score, band, size = 40, stroke = 3, className }: { score: number; band: RiskBand | "prevented"; size?: number; stroke?: number; className?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const meta = BAND[band];
  return (
    <span className={clsx("relative inline-flex shrink-0 items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ededeb" strokeWidth={stroke} />
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
      <span className="num absolute text-[13px] font-semibold" style={{ fontSize: size > 50 ? size * 0.3 : undefined, color: band === "prevented" ? meta.text : "var(--ink)" }}>
        {band === "prevented" ? <Check className="size-4" strokeWidth={2.6} aria-label="Prevented" /> : score}
      </span>
    </span>
  );
}

/** A signal in words. Rows list them as plain text joined by a dot; the icon is for the drawer's headings. */
export function SignalChip({ kind, muted, className }: { kind: PreventionSignalKind; muted?: boolean; className?: string }) {
  return <span className={clsx("whitespace-nowrap", muted ? "text-muted" : "text-ink-2", className)}>{SIGNAL_SHORT[kind]}</span>;
}

/** The band as a word with a 6px mark; only High carries red. */
export function BandPill({ band }: { band: RiskBand | "prevented" }) {
  const m = BAND[band];
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[13px]" style={{ color: m.text }}>
      <span className="size-1.5 rounded-full" style={{ background: m.color }} />
      {m.label}
    </span>
  );
}
