import { clsx } from "clsx";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";

export type FaqItem = { q: string; a: ReactNode };

/**
 * Questions and answers as native <details> disclosures: keyboard and screen-reader friendly, no script.
 * `open` lists the indexes open on load (the first by default).
 */
export function Faq({ items, open = [0], className }: { items: FaqItem[]; open?: number[]; className?: string }) {
  return (
    <div className={clsx("s-faq", className)}>
      {items.map((item, i) => (
        <details key={item.q} open={open.includes(i)}>
          <summary>
            {item.q}
            <Plus className="s-icon" aria-hidden />
          </summary>
          <div className="s-faq__a">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
