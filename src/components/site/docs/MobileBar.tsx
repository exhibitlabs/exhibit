"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchTrigger } from "./Search";
import { DocsSidebar } from "./Sidebar";
import type { DocsNavGroupData } from "./types";

/**
 * The docs bar on phones and tablets: a sticky strip under the site navigation with the current page
 * and a button that opens the full docs menu. Escape, the close button, or choosing a page closes it.
 */
export function DocsMobileBar({ nav }: { nav: DocsNavGroupData[] }) {
  const pathname = (usePathname() ?? "").replace(/\/+$/, "") || "/";
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const current = nav.flatMap((g) => g.pages.map((p) => ({ ...p, section: g.section }))).find((p) => p.href === pathname);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("[aria-current='page'], a")?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="d-mobilebar" data-open={open || undefined}>
      <div className="d-mobilebar__row">
        <button
          ref={buttonRef}
          type="button"
          className="d-mobilebar__menu"
          aria-expanded={open}
          aria-controls="d-mobile-menu"
          onClick={() => setOpen((o) => !o)}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            {open ? (
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            )}
          </svg>
          <span className="d-mobilebar__crumb">
            {current ? (
              <>
                <span className="d-mobilebar__section">{current.section}</span>
                <span className="d-mobilebar__sep" aria-hidden="true">
                  /
                </span>
                <span className="d-mobilebar__page">{current.label}</span>
              </>
            ) : (
              <span className="d-mobilebar__page">Docs menu</span>
            )}
          </span>
          <span className="d-sr">{open ? "Close the docs menu" : "Open the docs menu"}</span>
        </button>
        <SearchTrigger variant="icon" />
      </div>
      <div id="d-mobile-menu" ref={panelRef} className="d-mobilebar__panel" hidden={!open}>
        <DocsSidebar nav={nav} onNavigate={() => setOpen(false)} />
      </div>
    </div>
  );
}
