"use client";

import { clsx } from "clsx";
import { Check, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

export type ToastInput = { title: string; sub?: string; tone?: "neutral" | "success" | "error"; value?: string };
type ToastItem = ToastInput & { id: number };

const EVENT = "exhibit:toast";
let seq = 0;

/** Shows a toast from anywhere in the app. One look, one position, one timing for every message. */
export function toast(t: ToastInput | string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastItem>(EVENT, { detail: { ...(typeof t === "string" ? { title: t } : t), id: ++seq } }));
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<ToastItem>).detail;
      setItems((cur) => [...cur.filter((x) => x.title !== t.title || x.sub !== t.sub).slice(-2), t]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), t.tone === "error" ? 6500 : 4200);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex flex-col items-center gap-2 px-4 lg:left-[232px]">
      {items.map((t) => (
        <div key={t.id} role="status" className="toast-in pointer-events-auto flex max-w-[min(560px,100%)] items-center gap-3 rounded-xl bg-ink py-2.5 pl-2.5 pr-3 text-white shadow-[0_12px_32px_rgb(0_0_0/0.2)]">
          <span className={clsx("flex size-7 shrink-0 items-center justify-center rounded-full", t.tone === "success" ? "bg-[#16a34a]" : t.tone === "error" ? "bg-[#dc2626]" : "bg-white/15")}>
            {t.tone === "error" ? <X className="size-3.5" /> : t.tone === "success" ? <Check className="size-4" strokeWidth={2.8} /> : <Info className="size-3.5" />}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="text-[13.5px] font-medium">
              {t.title}
              {t.value ? <span className="num ml-1.5 text-[#86efac]">{t.value}</span> : null}
            </div>
            {t.sub ? <div className="mt-0.5 truncate text-[11.5px] text-white/60">{t.sub}</div> : null}
          </div>
          <button type="button" aria-label="Dismiss" onClick={() => setItems((cur) => cur.filter((x) => x.id !== t.id))} className="ml-1 rounded p-1 text-white/50 transition-colors hover:text-white">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
