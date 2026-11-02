"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/** A centred modal. Escape and a click outside close it; focus moves in on open and back on close. */
export function Dialog({ open, onClose, title, children, width = 520, footer }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; width?: number; footer?: React.ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
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
    <div className="app-shell ask-fade fixed inset-0 z-[110] flex items-start justify-center bg-[rgb(250_250_250/0.6)] px-4 pt-[12vh] backdrop-blur-[3px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" style={{ width }} className="ask-in max-w-full overflow-hidden rounded-2xl border border-[#e4e4e4] bg-surface shadow-[0_32px_90px_-20px_rgb(0_0_0/0.22),0_10px_28px_-12px_rgb(0_0_0/0.12)] outline-none">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[14px] font-medium">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <div className="scroll-thin max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="flex items-center justify-end gap-2 border-t border-line bg-[#fcfcfc] px-5 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
