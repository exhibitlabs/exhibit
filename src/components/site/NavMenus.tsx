"use client";

import { clsx } from "clsx";
import { ArrowRight, ChevronDown, FileSearch, Mail, MessagesSquare, Package, Scale, SquareTerminal, Stamp, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { ROUTES, type NavLink } from "./nav";

// The header's dropdowns: Product (a list beside a preview card with the item's dot drawing) and Company (the
// same card under a short list); Dropdown is a plain list for any menu without drawings. All are disclosure
// menus, the accessible pattern for site navigation: a real button with aria-expanded that shows a panel of
// ordinary links. Styles: "navigation" in src/app/(site)/site.css.

/** Each item's small picture: a line icon for its page (Company) or one that matches its dot drawing (Product). */
const ICONS: Record<string, LucideIcon> = {
  magnifier: FileSearch,
  stamp: Stamp,
  parcel: Package,
  bubble: MessagesSquare,
  terminal: SquareTerminal,
  scales: Scale,
  [ROUTES.about]: UsersRound,
  [ROUTES.contact]: Mail,
};

/**
 * Open and close for one dropdown. Opens on hover (mouse) or on click, tap, Enter or Space; ArrowDown or
 * ArrowUp on the button opens it at the first or last link. Closes on Escape (focus returns to the button),
 * a click or tap outside, focus leaving it, or the mouse leaving it. Inside, the arrow keys move between the
 * links and Home and End jump to the ends.
 */
function useDisclosure(onOpen?: () => void) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLLIElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const pointer = useRef("");

  const close = useCallback((focusButton = false) => {
    window.clearTimeout(closeTimer.current);
    setOpen(false);
    if (focusButton) button.current?.focus();
  }, []);
  const show = () => {
    window.clearTimeout(closeTimer.current);
    if (!open) onOpen?.();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const items = () => [...(root.current?.querySelectorAll<HTMLAnchorElement>("[data-menu-item]") ?? [])];

  return {
    open,
    close,
    root: {
      ref: root,
      onPointerEnter: (e: ReactPointerEvent) => {
        if (e.pointerType === "mouse") show();
      },
      onPointerLeave: (e: ReactPointerEvent) => {
        if (e.pointerType !== "mouse") return;
        window.clearTimeout(closeTimer.current);
        closeTimer.current = window.setTimeout(() => setOpen(false), 160);
      },
      onBlur: (e: FocusEvent) => {
        if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false);
      },
    },
    button: {
      ref: button,
      type: "button" as const,
      "aria-expanded": open,
      onPointerDown: (e: ReactPointerEvent) => {
        pointer.current = e.pointerType;
      },
      onClick: (e: MouseEvent) => {
        // A mouse that hovered the menu open leaves it open on click; touch, pen and the keyboard toggle it.
        if (open && pointer.current === "mouse" && e.detail > 0) return;
        if (open) close();
        else show();
      },
      onKeyDown: (e: ReactKeyboardEvent) => {
        if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
        e.preventDefault();
        // Show the panel now, so its first or last link can take focus in the same keystroke.
        flushSync(show);
        const list = items();
        list[e.key === "ArrowUp" ? list.length - 1 : 0]?.focus();
      },
    },
    panelKeyDown: (e: ReactKeyboardEvent) => {
      const list = items();
      const i = list.indexOf(document.activeElement as HTMLAnchorElement);
      let next: number;
      if (e.key === "ArrowDown") next = (i + 1) % list.length;
      else if (e.key === "ArrowUp") next = i < 0 ? list.length - 1 : (i - 1 + list.length) % list.length;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = list.length - 1;
      else return;
      e.preventDefault();
      list[next]?.focus();
    },
  };
}

/** One link in a menu: icon tile, title, one-line description. */
function MenuItem({ link, active, current, onActivate, onNavigate }: { link: NavLink; active?: boolean; current?: boolean; onActivate?: () => void; onNavigate: () => void }) {
  const Icon = ICONS[link.href] ?? (link.art ? ICONS[link.art] : undefined);
  return (
    <Link
      href={link.href}
      data-menu-item
      className="s-menu__item"
      data-active={active || undefined}
      aria-current={current ? "page" : undefined}
      onPointerEnter={onActivate}
      onFocus={onActivate}
      onClick={onNavigate}
    >
      {Icon ? (
        <span className="s-menu__tile" aria-hidden>
          <Icon />
        </span>
      ) : null}
      <span className="s-menu__text">
        <span className="s-menu__label">{link.label}</span>
        {link.description ? <span className="s-menu__desc">{link.description}</span> : null}
      </span>
    </Link>
  );
}

/** A plain dropdown: a narrow panel of links, for a menu whose links have no drawings. */
export function Dropdown({ label, links, active, pathname }: { label: string; links: NavLink[]; active: boolean; pathname: string }) {
  const menu = useDisclosure();
  const id = useId();
  return (
    <li {...menu.root} className="s-nav__item">
      <button {...menu.button} className="s-nav__link" aria-controls={id} data-active={active || undefined}>
        {label}
        <ChevronDown className="s-nav__chev" aria-hidden />
      </button>
      <div id={id} className="s-menu" data-open={menu.open} onKeyDown={menu.panelKeyDown}>
        <ul className="s-menu__list">
          {links.map((l) => (
            <li key={l.href}>
              <MenuItem link={l} current={pathname === l.href} onNavigate={() => menu.close()} />
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

/**
 * A menu with a preview card that shows the hovered or focused item's dot drawing with its name and one short
 * line. Product passes `overview`: its five capabilities sit beside the card, with a last row to the overview.
 * Company has no overview: its two links sit above the card in a narrow panel that hangs from its button. The
 * card crossfades between items. It repeats what the list says, so it is hidden from screen readers and out of
 * the tab order; a mouse can still click it. `art` holds each item's drawing, keyed by href, printed on the
 * server (see SiteNav).
 */
export function PreviewMenu({
  label,
  links,
  overview,
  art,
  active,
  pathname,
}: {
  label: string;
  links: NavLink[];
  overview?: NavLink & { text: string };
  art: Record<string, ReactNode>;
  active: boolean;
  pathname: string;
}) {
  const items = overview ? [...links, overview] : links;
  // The menu opens on the page you are on, or on the first capability.
  const start = Math.max(0, items.findIndex((l) => l.href === pathname));
  const [shown, setShown] = useState(start);
  const menu = useDisclosure(() => setShown(start));
  const id = useId();
  const last = items.length - 1;
  return (
    <li {...menu.root} className={clsx("s-nav__item", overview && "s-nav__item--mega")}>
      <button {...menu.button} className="s-nav__link" aria-controls={id} data-active={active || undefined}>
        {label}
        <ChevronDown className="s-nav__chev" aria-hidden />
      </button>
      <div id={id} className={clsx("s-mega", !overview && "s-mega--stack")} data-open={menu.open} onKeyDown={menu.panelKeyDown}>
        <div className="s-mega__side">
          <p className="s-mega__head" aria-hidden>
            {label}
          </p>
          <ul className="s-menu__list">
            {links.map((l, i) => (
              <li key={l.href}>
                <MenuItem link={l} active={i === shown} current={pathname === l.href} onActivate={() => setShown(i)} onNavigate={() => menu.close()} />
              </li>
            ))}
          </ul>
          {overview ? (
            <Link
              href={overview.href}
              data-menu-item
              className="s-mega__all"
              data-active={shown === last || undefined}
              aria-current={pathname === overview.href ? "page" : undefined}
              onPointerEnter={() => setShown(last)}
              onFocus={() => setShown(last)}
              onClick={() => menu.close()}
            >
              {overview.text}
              <ArrowRight className="s-icon" aria-hidden />
            </Link>
          ) : null}
        </div>
        <Link href={items[shown].href} className="s-mega__card" tabIndex={-1} aria-hidden onClick={() => menu.close()}>
          <span className="s-mega__stage">
            {items.map((l, i) => (
              <span key={l.href} className="s-mega__slide" data-active={i === shown || undefined}>
                <span className="s-mega__chip">{l.label}</span>
                <span className="s-mega__art">{art[l.href]}</span>
              </span>
            ))}
          </span>
          <span className="s-mega__bar">
            <span className="s-mega__captions">
              {items.map((l, i) => (
                <span key={l.href} data-active={i === shown || undefined}>
                  {l.caption}
                </span>
              ))}
            </span>
            <ArrowRight className="s-icon" />
          </span>
        </Link>
      </div>
    </li>
  );
}
