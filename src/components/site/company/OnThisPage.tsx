import "./company.css";
import { clsx } from "clsx";

/**
 * "On this page": a ruled row of anchor links under a page header, for long pages such as the trust
 * center. Scrolls sideways on phones. Each `id` must match a section's id.
 */
export function OnThisPage({ items, className, label = "On this page" }: { items: { id: string; label: string }[]; className?: string; label?: string }) {
  return (
    <nav aria-label={label} className={clsx("s-co-toc", className)}>
      <div className="s-co-toc__in">
        <span className="s-co-toc__label" aria-hidden>
          {label}
        </span>
        {items.map((it) => (
          <a key={it.id} href={`#${it.id}`}>
            {it.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
