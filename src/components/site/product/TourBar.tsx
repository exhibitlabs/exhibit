"use client";

import { ArrowLeft, ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FocusEvent, type ReactNode } from "react";

export type TourStop = { key: string; index: string; label: string; href: string };

/**
 * The product tour bar, a client component rendered by ProductTour (which prints the dot icons on the server).
 * A nav labelled "Product tour", sticky right under the site header: the six chapters as an ordered list of links
 * joined by a thin line filled up to the current chapter (aria-current="page"), the next chapter on the right (on
 * the last, the way back to the platform: the header beside it already carries the primary call to action, and the
 * chapter's end card offers it again), and a progress line along the bottom edge that fills as the page is read. The bar's own width picks the layout (container queries in product.css): every name when they fit, icons
 * only for the other chapters when they don't, and on phones the current chapter as a button that opens the list.
 */
export function TourBar({
  chapters,
  current,
  icons,
  nowIcon,
  next,
  home,
}: {
  chapters: TourStop[];
  /** Position of the current chapter in `chapters`. */
  current: number;
  /** Each chapter's icon, in order, and the current one again for the phone button (every copy needs its own svg). */
  icons: ReactNode[];
  nowIcon: ReactNode;
  /** The next chapter, or null on the last, where the link back to `home` (the platform) takes its place. */
  next: TourStop | null;
  home: TourStop;
}) {
  const [open, setOpen] = useState(false);
  const nav = useRef<HTMLElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const now = chapters[current];

  // Reading progress: how far the page's content (the bar's parent, <main>) has scrolled past, written straight to
  // the fill's transform once a frame, so scrolling never re-renders React.
  useEffect(() => {
    const bar = nav.current;
    const line = fill.current;
    const main = bar?.parentElement;
    if (!bar || !line || !main) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const end = main.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
      const p = end > 0 ? Math.min(1, Math.max(0, window.scrollY / end)) : 1;
      line.style.transform = `scaleX(${p})`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const grow = new ResizeObserver(schedule);
    grow.observe(main);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      grow.disconnect();
    };
  }, []);

  // The phone list closes on Escape (focus back on its button), a tap or click outside, or a resize.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!nav.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    const onResize = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  // Tabbing out of the open list closes it too.
  const onBlur = (e: FocusEvent) => {
    if (open && !nav.current?.contains(e.relatedTarget as Node)) setOpen(false);
  };
  const close = () => setOpen(false);
  const arrow = <ArrowRight className="s-icon s-btn__arrow" aria-hidden />;

  return (
    <nav ref={nav} aria-label="Product tour" className="s-tour" data-open={open || undefined} onBlur={onBlur}>
      <div className="s-wrap s-tour__in">
        <button ref={button} type="button" className="s-tour__now" aria-expanded={open} aria-controls={listId} onClick={() => setOpen((o) => !o)}>
          <span className="s-tour__icon" aria-hidden>
            {nowIcon}
          </span>
          <span className="s-tour__num">{now.index}</span>
          <span className="s-tour__label">{now.label}</span>
          <span className="s-sr-only">, all chapters</span>
          <ChevronDown className="s-tour__chev" aria-hidden />
        </button>
        <ol id={listId} className="s-tour__steps">
          {chapters.map((c, i) => (
            <li key={c.key} className="s-tour__step" data-state={i < current ? "done" : i === current ? "now" : "next"}>
              {i > 0 ? (
                <span className="s-tour__line" aria-hidden>
                  <i />
                </span>
              ) : null}
              <Link href={c.href} className="s-tour__link" aria-current={i === current ? "page" : undefined} onClick={close}>
                <span className="s-tour__icon" aria-hidden>
                  {icons[i]}
                </span>
                <span className="s-tour__meta">
                  <span className="s-tour__num">{c.index}</span>
                  <span className="s-tour__label">{c.label}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
        {next ? (
          <Link href={next.href} className="s-btn s-btn--ink s-btn--sm s-tour__next" onClick={close}>
            <span>
              Next<span className="s-tour__nextname">: {next.label}</span>
            </span>
            {arrow}
          </Link>
        ) : (
          <Link href={home.href} className="s-btn s-btn--ink s-btn--sm s-tour__next" onClick={close}>
            <ArrowLeft className="s-icon s-tour__back" aria-hidden />
            <span className="s-tour__homelong">Back to the platform</span>
            <span className="s-tour__homeshort" aria-hidden>
              {home.label}
            </span>
          </Link>
        )}
      </div>
      <span className="s-tour__progress" aria-hidden>
        <span ref={fill} className="s-tour__fill" />
      </span>
    </nav>
  );
}
