"use client";

import { clsx } from "clsx";
import { ArrowRight, ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { LogoMark } from "@/components/ui/Logo";
import { ButtonLink } from "./actions";
import { NAV, NAV_ACTIONS, ROUTES, type NavLink } from "./nav";

/** Disclosure dropdown (button + list of links), the accessible pattern for site navigation. */
function Dropdown({ label, links, active }: { label: string; links: NavLink[]; active: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLLIElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const close = useCallback((focusButton = false) => {
    setOpen(false);
    if (focusButton) button.current?.focus();
  }, []);

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

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => root.current?.querySelector<HTMLAnchorElement>(".s-menu a")?.focus());
    }
  };
  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...(root.current?.querySelectorAll<HTMLAnchorElement>(".s-menu a") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(i + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(i - 1 + items.length) % items.length]?.focus();
    }
  };

  return (
    <li
      ref={root}
      className="s-nav__item"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") {
          cancelClose();
          setOpen(true);
        }
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") {
          cancelClose();
          closeTimer.current = window.setTimeout(() => setOpen(false), 140);
        }
      }}
      onBlur={(e) => {
        if (!root.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button ref={button} type="button" className="s-nav__link" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} onKeyDown={onKeyDown} data-active={active || undefined}>
        {label}
        <ChevronDown className="s-nav__chev" aria-hidden />
      </button>
      <div id={id} className={clsx("s-menu", links.length < 3 && "s-menu--narrow")} data-open={open} onKeyDown={onMenuKey}>
        <ul>
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} onClick={() => setOpen(false)} tabIndex={open ? undefined : -1}>
                <span className="s-menu__label">{l.label}</span>
                {l.description ? <span className="s-menu__desc">{l.description}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

/** The site's top bar: wordmark, Product and Company menus, Security, Docs, Pricing, Sign in, two actions. */
export function SiteNav() {
  const pathname = usePathname() ?? "/";
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const burger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the phone menu on navigation; lock the page behind it while open.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMobileOpen(false);
  }
  useEffect(() => {
    if (!mobileOpen) return;
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        burger.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [mobileOpen]);

  const isActive = (href?: string) => !!href && href !== "/" && (pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="s-nav" data-scrolled={scrolled || mobileOpen}>
      <a href="#main" className="s-skip">
        Skip to content
      </a>
      <div className="s-wrap s-nav__in">
        <Link href={ROUTES.home} className="s-brand" aria-label="Exhibit, home">
          <LogoMark size={22} />
          <span aria-hidden>Exhibit</span>
        </Link>
        <nav aria-label="Main">
          <ul className="s-nav__links">
            {NAV.map((item) =>
              item.children ? (
                <Dropdown key={item.label} label={item.label} links={item.children} active={item.children.some((c) => isActive(c.href))} />
              ) : (
                <li key={item.label}>
                  <Link href={item.href!} className="s-nav__link" aria-current={isActive(item.href) ? "page" : undefined}>
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
        </nav>
        <div className="s-nav__cta">
          {NAV_ACTIONS.signIn ? (
            <Link href={NAV_ACTIONS.signIn.href} className="s-nav__link s-nav__signin">
              {NAV_ACTIONS.signIn.label}
            </Link>
          ) : null}
          <ButtonLink href={NAV_ACTIONS.secondary.href} variant="ghost" size="sm" className="s-nav__secondary">
            {NAV_ACTIONS.secondary.label}
          </ButtonLink>
          <ButtonLink href={NAV_ACTIONS.primary.href} size="sm">
            {NAV_ACTIONS.primary.label}
          </ButtonLink>
          <button ref={burger} type="button" className="s-nav__burger" aria-expanded={mobileOpen} aria-controls="s-mnav" aria-label={mobileOpen ? "Close menu" : "Open menu"} onClick={() => setMobileOpen((o) => !o)}>
            {mobileOpen ? <X className="s-icon" aria-hidden /> : <Menu className="s-icon" aria-hidden />}
          </button>
        </div>
      </div>
      <div id="s-mnav" className="s-mnav" hidden={!mobileOpen}>
        <nav aria-label="Main, phone" className="s-wrap">
          {NAV.filter((i) => i.children).map((group) => (
            <div key={group.label} className="s-mnav__group">
              <p className="s-mnav__title">{group.label}</p>
              <ul>
                {group.children!.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="s-mnav__link" onClick={() => setMobileOpen(false)}>
                      {l.label}
                      <ArrowRight className="s-icon" aria-hidden style={{ color: "var(--s-faint)" }} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="s-mnav__group">
            <ul>
              {NAV.filter((i) => !i.children).map((l) => (
                <li key={l.label}>
                  <Link href={l.href!} className="s-mnav__link" onClick={() => setMobileOpen(false)}>
                    {l.label}
                    <ArrowRight className="s-icon" aria-hidden style={{ color: "var(--s-faint)" }} />
                  </Link>
                </li>
              ))}
              {NAV_ACTIONS.signIn ? (
                <li>
                  <Link href={NAV_ACTIONS.signIn.href} className="s-mnav__link" onClick={() => setMobileOpen(false)}>
                    {NAV_ACTIONS.signIn.label}
                    <ArrowRight className="s-icon" aria-hidden style={{ color: "var(--s-faint)" }} />
                  </Link>
                </li>
              ) : null}
            </ul>
          </div>
          <div className="s-mnav__actions">
            <ButtonLink href={NAV_ACTIONS.secondary.href} variant="ghost">
              {NAV_ACTIONS.secondary.label}
            </ButtonLink>
            <ButtonLink href={NAV_ACTIONS.primary.href}>{NAV_ACTIONS.primary.label}</ButtonLink>
          </div>
        </nav>
      </div>
    </header>
  );
}
