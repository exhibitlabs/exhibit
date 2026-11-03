"use client";

import { ArrowRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ButtonLink } from "./actions";
import { NAV, NAV_ACTIONS, ROUTES } from "./nav";
import { Dropdown, PreviewMenu } from "./NavMenus";

/**
 * The header's logo: the mark (the geometry of LogoMark in src/components/ui/Logo.tsx, in the site's tokens)
 * and the wordmark. On hover or keyboard focus the gold arm slides back into the stem and out again, the
 * move the demo video's logo makes. The replay always finishes, even if the pointer leaves, and reduced
 * motion turns it off (site.css).
 */
function Brand() {
  const link = useRef<HTMLAnchorElement>(null);
  const clip = `s-arm${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const play = () => {
    const el = link.current;
    if (!el || el.dataset.play !== undefined || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.dataset.play = "";
  };
  return (
    <Link
      ref={link}
      href={ROUTES.home}
      className="s-brand"
      aria-label="Exhibit, home"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") play();
      }}
      onFocus={(e) => {
        if (e.currentTarget.matches(":focus-visible")) play();
      }}
      onAnimationEnd={() => {
        if (link.current) delete link.current.dataset.play;
      }}
    >
      <svg className="s-brand__mark" viewBox="0 0 48 48" aria-hidden focusable="false">
        <defs>
          <clipPath id={clip}>
            <rect x="14" width="34" height="48" />
          </clipPath>
        </defs>
        <rect className="s-brand__plate" width="48" height="48" rx="11" />
        <path className="s-brand__e" d="M8 8h32v6H8zM8 34h32v6H8zM8 8h6v32H8z" />
        <g clipPath={`url(#${clip})`}>
          <path className="s-brand__arm" d="M20 21h20v6H20z" />
        </g>
      </svg>
      <span className="s-brand__word" aria-hidden>
        Exhibit
      </span>
    </Link>
  );
}

/**
 * The site's top bar, a client component rendered by SiteNav: logo, the Product and Company menus,
 * Security, Docs, Pricing, Sign in and two actions; below 1024 px a phone menu instead of the links.
 * `art` and `thumbs` are the menu items' dot drawings (large for each menu's card, small for the phone
 * menu), keyed by href.
 */
export function NavBar({ art, thumbs }: { art: Record<string, ReactNode>; thumbs: Record<string, ReactNode> }) {
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
  const closeMobile = () => setMobileOpen(false);
  const arrow = <ArrowRight className="s-icon s-mnav__arrow" aria-hidden />;

  return (
    <header className="s-nav" data-scrolled={scrolled || mobileOpen}>
      <a href="#main" className="s-skip">
        Skip to content
      </a>
      <div className="s-wrap s-nav__in">
        <Brand />
        <nav aria-label="Main">
          <ul className="s-nav__links">
            {NAV.map((item) =>
              item.children && (item.overview || item.children.some((c) => art[c.href])) ? (
                <PreviewMenu
                  key={item.label}
                  label={item.label}
                  links={item.children}
                  overview={item.overview}
                  art={art}
                  active={item.overview ? isActive(item.overview.href) : item.children.some((c) => isActive(c.href))}
                  pathname={pathname}
                />
              ) : item.children ? (
                <Dropdown key={item.label} label={item.label} links={item.children} active={item.children.some((c) => isActive(c.href))} pathname={pathname} />
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
                {group.children!.map((l) =>
                  thumbs[l.href] ? (
                    <li key={l.href}>
                      <Link href={l.href} className="s-mnav__item" aria-current={pathname === l.href ? "page" : undefined} onClick={closeMobile}>
                        <span className="s-mnav__thumb" aria-hidden>
                          {thumbs[l.href]}
                        </span>
                        <span className="s-mnav__text">
                          <span className="s-mnav__label">{l.label}</span>
                          {l.description ? <span className="s-mnav__desc">{l.description}</span> : null}
                        </span>
                      </Link>
                    </li>
                  ) : (
                    <li key={l.href}>
                      <Link href={l.href} className="s-mnav__link" aria-current={pathname === l.href ? "page" : undefined} onClick={closeMobile}>
                        {l.label}
                        {arrow}
                      </Link>
                    </li>
                  ),
                )}
                {group.overview ? (
                  <li>
                    <Link href={group.overview.href} className="s-mnav__all" aria-current={pathname === group.overview.href ? "page" : undefined} onClick={closeMobile}>
                      {group.overview.text}
                      {arrow}
                    </Link>
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
          <div className="s-mnav__group">
            <ul>
              {NAV.filter((i) => !i.children).map((l) => (
                <li key={l.label}>
                  <Link href={l.href!} className="s-mnav__link" aria-current={isActive(l.href) ? "page" : undefined} onClick={closeMobile}>
                    {l.label}
                    {arrow}
                  </Link>
                </li>
              ))}
              {NAV_ACTIONS.signIn ? (
                <li>
                  <Link href={NAV_ACTIONS.signIn.href} className="s-mnav__link" onClick={closeMobile}>
                    {NAV_ACTIONS.signIn.label}
                    {arrow}
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
