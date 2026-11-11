// The site's information architecture: every marketing URL, in one place. The navigation, the footer and
// every page link to these constants, so a page that moves only changes here. Some targets are built by
// later passes (product pages, security, pricing, company, docs, legal); link to them anyway.

import { DEMO_URL, GITHUB_URL } from "@/components/landing/data";
import type { DotArtName } from "./dots/art-data";

export const ROUTES = {
  home: "/",
  proof: "/proof",
  product: {
    /** The product overview, linking to each capability page. */
    overview: "/product",
    investigate: "/product/investigate",
    evidencePackets: "/product/evidence",
    prevention: "/product/prevention",
    askExhibit: "/product/ask",
    aiAgents: "/product/agents",
  },
  security: "/security",
  docs: {
    home: "/docs",
    api: "/docs/api",
    mcp: "/docs/mcp",
    sandbox: "/docs/sandbox",
  },
  pricing: "/pricing",
  about: "/about",
  contact: "/contact",
  legal: {
    privacy: "/legal/privacy",
    terms: "/legal/terms",
  },
  /** The product: /app, or the hosted demo on the static website. Sign in and the primary "Try the live demo" both go here. */
  app: DEMO_URL,
  github: GITHUB_URL,
} as const;

export type NavLink = {
  label: string;
  href: string;
  description?: string;
  external?: boolean;
  /** Menus with a preview card (Product, Company): the dot drawing the card shows, and the one short line under it. */
  art?: DotArtName;
  caption?: string;
};

/**
 * The Product menu, in order. Descriptions show in the menu, the phone menu and on the product pages
 * (src/components/site/product/capabilities.ts reads this list by position, so keep it to the five).
 * `art` and `caption` fill the menu's preview card.
 */
export const PRODUCT_LINKS: NavLink[] = [
  { label: "Investigate", href: ROUTES.product.investigate, description: "Eight sources, one cited decision", art: "magnifier", caption: "Every reason points to a record." },
  { label: "Evidence packets", href: ROUTES.product.evidencePackets, description: "Exhibit A to F, filed through PayPal", art: "stamp", caption: "No record, no filing." },
  { label: "Prevention", href: ROUTES.product.prevention, description: "Stops disputes before they are filed", art: "parcel", caption: "Most disputes give a warning first." },
  { label: "Ask Exhibit", href: ROUTES.product.askExhibit, description: "Questions answered from your records", art: "bubble", caption: "Press ⌘K and ask in plain words." },
  { label: "For AI agents", href: ROUTES.product.aiAgents, description: "Agents request, merchants approve", art: "terminal", caption: "Nothing reaches PayPal until you approve." },
];

/** The Product menu's last row, to the overview page. `label` names it on the preview card; `text` is the row itself. */
export const PRODUCT_OVERVIEW: NavLink & { text: string } = {
  label: "Overview",
  text: "See the whole platform",
  href: ROUTES.product.overview,
  art: "scales",
  caption: "One agent for the whole dispute.",
};

/** The Company menu: the team behind Exhibit, and how to reach it. `art` and `caption` fill its preview card. */
export const COMPANY_LINKS: NavLink[] = [
  { label: "Exhibit Labs", href: ROUTES.about, description: "The team behind Exhibit", art: "scales", caption: "Let the evidence decide." },
  { label: "Contact", href: ROUTES.contact, description: "Book a demo or ask a question", art: "letter", caption: "Straight to the founders' inbox." },
];

/**
 * Top-level bar, left to right. Items with `children` render as an accessible dropdown with a dot-art preview
 * card: one with an `overview` as the wide menu (list beside the card, the overview as its last row), the
 * others as a narrow one (the card under the list).
 */
export const NAV: { label: string; href?: string; children?: NavLink[]; overview?: NavLink & { text: string } }[] = [
  { label: "Product", children: PRODUCT_LINKS, overview: PRODUCT_OVERVIEW },
  { label: "Security", href: ROUTES.security },
  { label: "Docs", href: ROUTES.docs.home },
  { label: "Pricing", href: ROUTES.pricing },
  { label: "Company", children: COMPANY_LINKS },
];

/**
 * Whether this build links to a running app: its own /app, or the hosted demo. The static website deploy has no
 * server. It is built with NEXT_PUBLIC_EXHIBIT_SITE_ONLY=1 and links to the hosted demo, NEXT_PUBLIC_EXHIBIT_DEMO_URL
 * (scripts/build-site.mjs). Built without a demo URL, every "Try the live demo" becomes "Book a demo" and Sign in is
 * hidden.
 */
export const HAS_APP = process.env.NEXT_PUBLIC_EXHIBIT_SITE_ONLY !== "1" || DEMO_URL !== "/app";

/** The site's two calls to action. Without the app, booking a demo leads and the sandbox record follows. */
export const CTA = {
  primary: HAS_APP ? { label: "Try the live demo", href: ROUTES.app } : { label: "Book a demo", href: ROUTES.contact },
  secondary: HAS_APP ? { label: "Book a demo", href: ROUTES.contact } : { label: "See the sandbox proof", href: ROUTES.proof },
};

export const NAV_ACTIONS = {
  signIn: HAS_APP ? { label: "Sign in", href: ROUTES.app } : null,
  primary: CTA.primary,
  secondary: CTA.secondary,
};

/** Footer sitemap columns. */
export const FOOTER_COLUMNS: { title: string; links: NavLink[] }[] = [
  { title: "Product", links: [...PRODUCT_LINKS.map(({ label, href }) => ({ label, href })), { label: "Pricing", href: ROUTES.pricing }] },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: ROUTES.docs.home },
      { label: "API", href: ROUTES.docs.api },
      { label: "MCP", href: ROUTES.docs.mcp },
      { label: "Sandbox guide", href: ROUTES.docs.sandbox },
      { label: "GitHub", href: ROUTES.github, external: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Exhibit Labs", href: ROUTES.about },
      { label: "Contact", href: ROUTES.contact },
      { label: "Founders", href: `${ROUTES.about}#founders` },
    ],
  },
  {
    title: "Trust",
    links: [
      { label: "Security", href: ROUTES.security },
      { label: "The sandbox record", href: ROUTES.proof },
      { label: "Approval gates", href: `${ROUTES.security}#approvals` },
      { label: "Audit log", href: `${ROUTES.security}#audit-log` },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: ROUTES.legal.privacy },
      { label: "Terms", href: ROUTES.legal.terms },
    ],
  },
];
