"use client";

import { ArrowLeft, ArrowRight, Printer } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { LogoMark } from "../ui/Logo";

// The /pitch deck's frame: a 1600 x 900 stage scaled to the window, one slide at a time, with the slide's number in
// the URL (#1 to #14). The slides themselves are server components (./slides.tsx) built from the website's kit and
// passed in already rendered, so every product picture, painting and dot drawing is the site's own.
//
// Keys: Right, Down, Page Down and Space go forward; Left, Up, Page Up and Shift+Space go back; Home and End jump.
// Below 768 px wide the stage gives way to a phone view: every slide in one scrolling column, each reflowed with the
// kit's own phone layouts. Printing (or Save as PDF) puts one slide on each 16:9 page.

export type DeckSlide = {
  /** Short name, read out with the slide number ("3 of 14: The gap"). */
  label: string;
  /** Background: white, the site's grey band, or its one dark tone. */
  tone?: "plain" | "band" | "night";
  /** Hide the footer (logo and number), e.g. on the title slide. */
  bare?: boolean;
  content: ReactNode;
};

/** The stage's design size. deck.css lays every slide out at exactly this size. */
const STAGE_W = 1600;
const STAGE_H = 900;

const pad = (n: number) => String(n).padStart(2, "0");
/** The phone view's media query, the same as deck.css's. */
const PHONE = "screen and (max-width: 767px)";

/** The slide number in a URL hash ("#5" is 5), or null. */
function fromHash(hash: string, total: number) {
  const n = Number(hash.replace(/^#/, ""));
  return Number.isInteger(n) && n >= 1 && n <= total ? n : null;
}

export function Deck({ slides }: { slides: DeckSlide[] }) {
  const total = slides.length;
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(false);
  const [phone, setPhone] = useState(false);
  const [scale, setScale] = useState<number | null>(null);
  const [idle, setIdle] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const go = useCallback(
    (to: number) => {
      const n = Math.min(total - 1, Math.max(0, to));
      setI(n);
      // On a phone every slide is on the page: move the reader to it instead.
      if (window.matchMedia(PHONE).matches) document.getElementById(String(n + 1))?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    },
    [total],
  );

  // First paint already shows the right slide (CSS :target reads the hash before any script runs). After hydration
  // the deck takes over: it reads the hash once, then rewrites it as you move.
  useEffect(() => {
    const start = fromHash(window.location.hash, total);
    const media = window.matchMedia(PHONE);
    const sync = () => setPhone(media.matches);
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    requestAnimationFrame(() => {
      if (start) setI(start - 1);
      sync();
      fit();
      setReady(true);
    });
    const onHash = () => {
      const n = fromHash(window.location.hash, total);
      if (n) go(n - 1);
    };
    media.addEventListener("change", sync);
    window.addEventListener("resize", fit);
    window.addEventListener("hashchange", onHash);
    return () => {
      media.removeEventListener("change", sync);
      window.removeEventListener("resize", fit);
      window.removeEventListener("hashchange", onHash);
    };
  }, [go, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      // Space and Enter press a focused control; typing in a field never turns the page.
      if (el?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (el?.closest?.("button, a, summary") && [" ", "Enter"].includes(e.key)) return;
      const next = ["ArrowRight", "ArrowDown", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey);
      const prev = ["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey);
      // On a phone the arrow keys scroll the column as usual; only paging keys move between slides.
      if (phone && ["ArrowDown", "ArrowUp"].includes(e.key)) return;
      if (next || prev) {
        e.preventDefault();
        go(i + (next ? 1 : -1));
      } else if (e.key === "Home") {
        e.preventDefault();
        go(0);
      } else if (e.key === "End") {
        e.preventDefault();
        go(total - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, i, phone, total]);

  // The slide number lives in the URL, so a link or a reload lands on the same slide.
  useEffect(() => {
    if (ready) history.replaceState(null, "", `#${i + 1}`);
  }, [i, ready]);

  // Phone view: the slide in the middle of the screen is the current one.
  useEffect(() => {
    if (!phone || typeof IntersectionObserver === "undefined") return;
    const els = Array.from(stage.current?.querySelectorAll<HTMLElement>(".pd-slide") ?? []);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setI(els.indexOf(e.target as HTMLElement));
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [phone]);

  // The controls fade while you present and come back when the pointer moves or a key is pressed.
  useEffect(() => {
    const wake = () => {
      setIdle(false);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => setIdle(true), 2600);
    };
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, []);

  const stageStyle = scale ? ({ "--pd-scale": scale } as CSSProperties) : undefined;

  return (
    <div className="pd" data-ready={ready ? "" : undefined} data-idle={idle ? "" : undefined}>
      {/* One 16:9 page per slide when printed or saved as PDF. Rendered here, not in deck.css, so the page size
          leaves with the deck instead of lingering on the site after a client-side navigation. */}
      <style>{`@media print { @page { size: ${STAGE_W}px ${STAGE_H}px; margin: 0; } }`}</style>
      <div className="pd__bar" aria-hidden>
        <i style={{ width: `${((i + 1) / total) * 100}%` }} />
      </div>
      <header className="pd__phonebar">
        <span className="pd__brand">
          <LogoMark size={20} />
          Exhibit
        </span>
        <span className="pd__phonecount s-num">
          {pad(i + 1)} / {pad(total)}
        </span>
        <Link href="/" className="pd__exit">
          Exit
        </Link>
      </header>
      <main className="pd__viewport" aria-label="Exhibit pitch deck">
        <div ref={stage} className="pd__stage" style={stageStyle}>
          {slides.map((s, k) => {
            const state = k === i ? "on" : k < i ? "past" : "next";
            return (
              <section key={k} id={String(k + 1)} className="pd-slide" data-tone={s.tone ?? "plain"} data-state={state} aria-roledescription="slide" aria-label={`${k + 1} of ${total}: ${s.label}`}>
                <div className="pd-slide__body">{s.content}</div>
                {s.bare ? null : (
                  <footer className="pd-slide__foot">
                    <span className="pd__brand">
                      <LogoMark size={20} tone={s.tone === "night" ? "inverse" : "ink"} />
                      Exhibit
                    </span>
                    <span className="pd-slide__n s-num">
                      {pad(k + 1)} / {pad(total)}
                    </span>
                  </footer>
                )}
              </section>
            );
          })}
        </div>
      </main>
      <nav className="pd__controls" aria-label="Slides">
        <Link href="/" className="pd__ctl pd__ctl--text">
          Exit
        </Link>
        <button type="button" className="pd__ctl" onClick={() => window.print()} aria-label="Print or save as PDF, one slide per page">
          <Printer aria-hidden />
        </button>
        <button type="button" className="pd__ctl" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous slide">
          <ArrowLeft aria-hidden />
        </button>
        <span className="pd__count s-num" aria-live="polite">
          {i + 1} / {total}
        </span>
        <button type="button" className="pd__ctl" onClick={() => go(i + 1)} disabled={i === total - 1} aria-label="Next slide">
          <ArrowRight aria-hidden />
        </button>
      </nav>
    </div>
  );
}
