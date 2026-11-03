import type { ReactNode } from "react";
import { DotArt } from "./dots/DotArt";
import { NAV } from "./nav";
import { NavBar } from "./NavBar";

/**
 * The site's top bar. The bar itself is a client component (NavBar); this server side prints the menus' dot
 * drawings (large for each menu's preview card, small for the phone menu) and hands them over as markup, so
 * the drawings' data never ships in the page's JavaScript. Each drawing is rendered twice on purpose: every
 * copy gets its own mask id.
 */
export function SiteNav() {
  const art: Record<string, ReactNode> = {};
  const thumbs: Record<string, ReactNode> = {};
  for (const item of NAV) {
    for (const l of [...(item.children ?? []), ...(item.overview ? [item.overview] : [])]) {
      if (!l.art) continue;
      art[l.href] = <DotArt name={l.art} />;
      if (l !== item.overview) thumbs[l.href] = <DotArt name={l.art} small />;
    }
  }
  return <NavBar art={art} thumbs={thumbs} />;
}
