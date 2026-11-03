"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CopyButton } from "./CopyButton";

export type CodeTab = { title: string; code: string; body: ReactNode };

/** Alternative code blocks for one task (`:::tabs`). WAI-ARIA tabs with arrow-key navigation. */
export function CodeTabs({ tabs }: { tabs: CodeTab[] }) {
  const [active, setActive] = useState(0);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = tabs.length - 1;
    let next = active;
    if (e.key === "ArrowRight") next = active === last ? 0 : active + 1;
    else if (e.key === "ArrowLeft") next = active === 0 ? last : active - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <div className="d-codeblock d-codetabs">
      <div className="d-codeblock__bar">
        <div role="tablist" aria-label="Code examples" className="d-codetabs__list">
          {tabs.map((t, i) => (
            <button
              key={t.title + i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${i}`}
              aria-selected={i === active}
              aria-controls={`${base}-panel-${i}`}
              tabIndex={i === active ? 0 : -1}
              className="d-codetabs__tab"
              onClick={() => setActive(i)}
              onKeyDown={onKey}
            >
              {t.title}
            </button>
          ))}
        </div>
        <CopyButton text={tabs[active]?.code ?? ""} />
      </div>
      {tabs.map((t, i) => (
        <div key={t.title + i} role="tabpanel" id={`${base}-panel-${i}`} aria-labelledby={`${base}-tab-${i}`} hidden={i !== active}>
          {t.body}
        </div>
      ))}
    </div>
  );
}
