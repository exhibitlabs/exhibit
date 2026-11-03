"use client";

import { useEffect } from "react";

/**
 * Marks which lifecycle chapter is being read: sets data-active on the case file so its stage list
 * highlights the chapter in the middle of the screen. Renders nothing; without it the list is static.
 */
export function LifecycleSpy({ docketId, chapterIds }: { docketId: string; chapterIds: string[] }) {
  useEffect(() => {
    const docket = document.getElementById(docketId);
    const chapters = chapterIds.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!docket || !chapters.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) docket.dataset.active = String(chapters.indexOf(e.target as HTMLElement));
        }
      },
      { rootMargin: "-42% 0px -52% 0px" },
    );
    chapters.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [docketId, chapterIds]);
  return null;
}
