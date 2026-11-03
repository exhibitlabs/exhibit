import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";

// A page that sets `openGraph` replaces the root's, images included, so the company pages name the site's
// share images (src/app/opengraph-image.png and twitter-image.png, 1200 x 630) explicitly, as the docs do
// (src/components/site/docs/meta.ts). Alt text comes from the images' own .alt.txt files.
function altFor(file: string) {
  try {
    return fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "src/app", file), "utf8").trim();
  } catch {
    return "Exhibit, the dispute agent for PayPal merchants.";
  }
}

/** Title, description, canonical URL and share cards for a company page (security, pricing, about, contact, legal). */
export function companyMetadata({ title, description, path: url }: { title: string; description: string; path: string }): Metadata {
  const shareTitle = `${title} · Exhibit`;
  const og = { url: "/opengraph-image.png", width: 1200, height: 630, alt: altFor("opengraph-image.alt.txt") };
  const tw = { url: "/twitter-image.png", width: 1200, height: 630, alt: altFor("twitter-image.alt.txt") };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", siteName: "Exhibit", url, title: shareTitle, description, images: [og] },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: [tw] },
  };
}
