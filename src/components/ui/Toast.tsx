"use client";

import { clsx } from "clsx";
import { Check, Info, X } from "lucide-react";
import { useEffect, useState } from "react";

export type ToastInput = { title: string; sub?: string; tone?: "neutral" | "success" | "error"; value?: string; action?: { label: string; run: () => void } };
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
      // A toast with an action (Undo) stays long enough to use it.
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), t.action ? 8000 : t.tone === "error" ? 6500 : 4200);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const dismiss = (id: number) => setItems((cur) => cur.filter((x) => x.id !== id));
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[90] flex flex-col items-center gap-2 px-4 lg:left-[232px]">
      {items.map((t) => (
        <div key={t.id} role="status" className="toast-in pointer-events-auto flex max-w-[min(560px,100%)] items-center gap-3 rounded-[10px] bg-ink py-2.5 pl-3.5 pr-2 text-white shadow-[0_12px_32px_-8px_rgb(0_0_0/0.3)]">
          <span className={clsx("flex shrink-0 items-center justify-center", t.tone === "success" ? "text-[#86efac]" : t.tone === "error" ? "text-[#fca5a5]" : "text-white/60")} aria-hidden>
            {t.tone === "error" ? <X className="size-4" strokeWidth={2.4} /> : t.tone === "success" ? <Check className="size-4" strokeWidth={2.4} /> : <Info className="size-4" />}
          </span>
          <div className="min-w-0 leading-tight">
            <div className="text-[14px] font-medium">
              {t.title}
              {t.value ? <span className="num ml-1.5 text-[#86efac]">{t.value}</span> : null}
            </div>
            {t.sub ? <div className="mt-0.5 truncate text-[12px] text-white/65">{t.sub}</div> : null}
          </div>
          {t.action ? (
            <button
              type="button"
              onClick={() => {
                t.action!.run();
                dismiss(t.id);
              }}
              className="ml-2 shrink-0 rounded-[6px] px-2 py-1 text-[13px] font-medium text-white underline decoration-white/40 underline-offset-2 transition-colors hover:decoration-white"
            >
              {t.action.label}
            </button>
          ) : null}
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(t.id)} className="ml-1 flex size-7 shrink-0 items-center justify-center rounded-[6px] text-white/50 transition-colors hover:bg-white/10 hover:text-white">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
