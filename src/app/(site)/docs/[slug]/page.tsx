import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllDocs, getDoc } from "@/components/site/docs/content";
import { DocArticle } from "@/components/site/docs/DocArticle";
import { docsMetadata } from "@/components/site/docs/meta";

// Every page is generated at build time from src/content/docs/*.md; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllDocs()
    .filter((p) => p.slug)
    .map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = getDoc(slug);
  if (!page) return {};
  return docsMetadata({ title: `${page.title} · Docs`, shareTitle: `${page.title} · Exhibit docs`, description: page.description, path: page.href });
}

export default async function DocsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getDoc(slug);
  if (!page) notFound();
  return <DocArticle page={page} />;
}
