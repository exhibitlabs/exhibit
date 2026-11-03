"use client";

import { useEffect, useMemo, useState } from "react";
import type { TocHeading } from "./types";

/** Tracks the heading currently at the top of the viewport. */
function useActiveHeading(ids: string[]) {
  const [active, setActive] = useState<string | undefined>(ids[0]);
  useEffect(() => {
    if (!ids.length) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const offset = 140;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top - offset <= 0) current = id;
        else break;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom) {
        // Near the end every remaining heading is on screen; pick the last one the reader can reach.
        const visible = ids.filter((id) => {
          const el = document.getElementById(id);
          return el && el.getBoundingClientRect().top < window.innerHeight;
        });
        if (visible.length) current = visible[visible.length - 1];
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

/** "On this page" for wide screens: h2 and h3 headings with scroll tracking. */
export function DocsToc({ headings }: { headings: TocHeading[] }) {
  const key = headings.map((h) => h.id).join("|");
  const ids = useMemo(() => (key ? key.split("|") : []), [key]);
  const active = useActiveHeading(ids);
  if (!headings.length) return null;
  return (
    <nav aria-label="On this page" className="d-toc">
      <p className="d-toc__title">On this page</p>
      <ul className="d-toc__list">
        {headings.map((h) => (
          <li key={h.id} className={h.level === 3 ? "d-toc__item d-toc__item--sub" : "d-toc__item"}>
            <a href={`#${h.id}`} className="d-toc__link" aria-current={active === h.id ? "location" : undefined}>
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
