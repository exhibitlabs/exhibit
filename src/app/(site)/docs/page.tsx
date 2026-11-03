import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDoc } from "@/components/site/docs/content";
import { DocArticle } from "@/components/site/docs/DocArticle";
import { docsMetadata } from "@/components/site/docs/meta";
import { DotArt } from "@/components/site/dots/DotArt";

export function generateMetadata(): Metadata {
  const page = getDoc("");
  const description = page?.description ?? "Run, understand and trust Exhibit, the dispute agent for PayPal merchants.";
  return docsMetadata({ title: "Docs", shareTitle: "Exhibit docs", description, path: "/docs", type: "website" });
}

/** The docs home is the Introduction (src/content/docs/index.md), with the one piece of dot art in the docs. */
export default function DocsHome() {
  const page = getDoc("");
  if (!page) notFound();
  return <DocArticle page={page} hero={<DotArt name="magnifier" />} />;
}
