"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { DocsNavGroupData } from "./types";

const normalise = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/** The docs' section list. Marks the current page with aria-current. */
export function DocsSidebar({ nav, onNavigate }: { nav: DocsNavGroupData[]; onNavigate?: () => void }) {
  const pathname = normalise(usePathname() ?? "");
  return (
    <nav aria-label="Documentation" className="d-sidenav">
      {nav.map((group) => {
        const gid = `d-nav-${group.section.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
        return (
          <div key={group.section} className="d-sidenav__group">
            <p className="d-sidenav__title" id={gid}>
              {group.section}
            </p>
            <ul aria-labelledby={gid} className="d-sidenav__list">
              {group.pages.map((p) => {
                const active = pathname === p.href;
                return (
                  <li key={p.href}>
                    <Link href={p.href} aria-current={active ? "page" : undefined} className="d-sidenav__link" onClick={onNavigate}>
                      {p.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
