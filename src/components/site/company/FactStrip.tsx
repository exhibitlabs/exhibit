import "./company.css";
import { clsx } from "clsx";
import type { CSSProperties, ReactNode } from "react";

/**
 * A ruled strip of short facts, key above value ("Certification / None yet"). Two columns on phones,
 * one row on desktop. `note` adds a quiet second line under a value.
 */
export function FactStrip({ items, className, label }: { items: { k: ReactNode; v: ReactNode; note?: ReactNode }[]; className?: string; label?: string }) {
  return (
    <dl className={clsx("s-co-strip", className)} style={{ "--s-co-cols": items.length } as CSSProperties} aria-label={label}>
      {items.map((it, i) => (
        <div key={i}>
          <dt>{it.k}</dt>
          <dd>
            {it.v}
            {it.note ? <small>{it.note}</small> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
