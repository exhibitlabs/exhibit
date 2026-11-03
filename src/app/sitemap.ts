import type { MetadataRoute } from "next";
import { getAllDocs } from "@/components/site/docs/content";
import { ROUTES } from "@/components/site/nav";

const BASE = "https://exhibit.9to5code.com";

/** The public marketing site and the docs. The app (/app) and the pitch deck are left out on purpose. */
export default function sitemap(): MetadataRoute.Sitemap {
  const site = [
    ROUTES.home,
    ROUTES.proof,
    ...Object.values(ROUTES.product),
    ROUTES.security,
    ROUTES.pricing,
    ROUTES.about,
    ROUTES.contact,
    ...Object.values(ROUTES.legal),
  ];
  const docs = getAllDocs().map((d) => d.href);
  return [...new Set([...site, ...docs])].map((path) => ({ url: `${BASE}${path === "/" ? "" : path}` }));
}
