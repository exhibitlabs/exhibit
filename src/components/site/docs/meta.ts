import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";

// A page that sets `openGraph` replaces the root's, images included, so the docs name the site's share
// images (src/app/opengraph-image.png and twitter-image.png, both 1200 x 630) explicitly. Their alt text
// is read from the images' own .alt.txt files, so it never drifts from the pictures.
function altFor(file: string) {
  try {
    return fs.readFileSync(path.join(/*turbopackIgnore: true*/ process.cwd(), "src/app", file), "utf8").trim();
  } catch {
    return "Exhibit, the dispute agent for PayPal merchants.";
  }
}

/** Title, description, canonical URL and share cards for one docs page. */
export function docsMetadata({ title, shareTitle, description, path: url, type = "article" }: { title: string; shareTitle: string; description: string; path: string; type?: "article" | "website" }): Metadata {
  const og = { url: "/opengraph-image.png", width: 1200, height: 630, alt: altFor("opengraph-image.alt.txt") };
  const tw = { url: "/twitter-image.png", width: 1200, height: 630, alt: altFor("twitter-image.alt.txt") };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type, siteName: "Exhibit", url, title: shareTitle, description, images: [og] },
    twitter: { card: "summary_large_image", title: shareTitle, description, images: [tw] },
  };
}
