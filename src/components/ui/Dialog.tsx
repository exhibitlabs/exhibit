"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * A centred modal on a quiet ink scrim (no blur). Escape and a click outside close it; focus moves in on open,
 * Tab stays inside, and focus returns to the trigger on close.
 */
export function Dialog({ open, onClose, title, children, width = 520, footer }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; width?: number; footer?: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const f = [...panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')].filter((el) => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      before?.focus?.();
    };
  }, [open, onClose]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="app-shell ask-fade fixed inset-0 z-[110] flex items-start justify-center bg-[rgb(10_10_10/0.18)] px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId} style={{ width }} className="ask-in max-w-full overflow-hidden rounded-[10px] border border-line bg-surface shadow-[0_24px_64px_-16px_rgb(0_0_0/0.24),0_4px_14px_-6px_rgb(0_0_0/0.08)] outline-none">
        <div className="flex items-center justify-between gap-4 px-5 pb-1 pt-4">
          <h2 id={titleId} className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1.5 flex size-8 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-active hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <div className="scroll-thin max-h-[70vh] overflow-y-auto px-5 pb-5 pt-2">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
