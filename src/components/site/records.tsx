import { clsx } from "clsx";
import type { ReactNode } from "react";

/** A big mono figure with its label ("244  API calls logged"). Put several in a grid. */
export function Stat({ value, label, className }: { value: ReactNode; label: ReactNode; className?: string }) {
  return (
    <div className={clsx("s-stat", className)}>
      <span className="s-stat__n">{value}</span>
      <span className="s-stat__l">{label}</span>
    </div>
  );
}

/** Key and value rows with hairlines ("Delivery  UPS, signed for by D REYES"). */
export function Facts({ items, className }: { items: { k: ReactNode; v: ReactNode }[]; className?: string }) {
  return (
    <ul className={clsx("s-facts", className)}>
      {items.map((it, i) => (
        <li key={i}>
          <span className="s-facts__k">{it.k}</span>
          <span>{it.v}</span>
        </li>
      ))}
    </ul>
  );
}

/** An HTTP status from PayPal as a small mono code, green for 2xx, red for errors. */
export function StatusCode({ code, className }: { code: number; className?: string }) {
  return <span className={clsx("s-code", code < 400 ? "s-code--ok" : "s-code--err", className)}>{code}</span>;
}

/** Small status label. `dot` shows the gold dot ("Planned"); `green` for good news. */
export function Tag({ children, dot, green, className }: { children: ReactNode; dot?: boolean; green?: boolean; className?: string }) {
  return (
    <span className={clsx("s-tag", green && "s-tag--green", className)}>
      {dot ? <span className="s-tag__dot" aria-hidden /> : null}
      {children}
    </span>
  );
}
