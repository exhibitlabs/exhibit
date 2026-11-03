// The site's information architecture: every marketing URL, in one place. The navigation, the footer and
// every page link to these constants, so a page that moves only changes here. Some targets are built by
// later passes (product pages, security, pricing, company, docs, legal); link to them anyway.

import { DEMO_URL, GITHUB_URL } from "@/components/landing/data";

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
  /** The product. Sign in and the primary "Try the live demo" both go here. */
  app: DEMO_URL,
  github: GITHUB_URL,
} as const;

export type NavLink = { label: string; href: string; description?: string; external?: boolean };

/** The Product menu, in order. Descriptions show in the dropdown. */
export const PRODUCT_LINKS: NavLink[] = [
  { label: "Investigate", href: ROUTES.product.investigate, description: "Eight sources, one cited decision" },
  { label: "Evidence packets", href: ROUTES.product.evidencePackets, description: "Exhibit A to F, filed through PayPal" },
  { label: "Prevention", href: ROUTES.product.prevention, description: "Stops disputes before they are filed" },
  { label: "Ask Exhibit", href: ROUTES.product.askExhibit, description: "Questions answered from your records" },
  { label: "For AI agents", href: ROUTES.product.aiAgents, description: "Agents request, merchants approve" },
];

export const COMPANY_LINKS: NavLink[] = [
  { label: "About", href: ROUTES.about, description: "Who builds Exhibit, and why" },
  { label: "Contact", href: ROUTES.contact, description: "Book a demo or ask a question" },
];

/** Top-level bar, left to right. Items with `children` render as an accessible dropdown. */
export const NAV: { label: string; href?: string; children?: NavLink[] }[] = [
  { label: "Product", children: PRODUCT_LINKS },
  { label: "Security", href: ROUTES.security },
  { label: "Docs", href: ROUTES.docs.home },
  { label: "Pricing", href: ROUTES.pricing },
  { label: "Company", children: COMPANY_LINKS },
];

export const NAV_ACTIONS = {
  signIn: { label: "Sign in", href: ROUTES.app },
  primary: { label: "Try the live demo", href: ROUTES.app },
  secondary: { label: "Book a demo", href: ROUTES.contact },
} as const;

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
      { label: "About", href: ROUTES.about },
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
