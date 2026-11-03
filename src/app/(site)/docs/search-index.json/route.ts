import { getSearchIndex } from "@/components/site/docs/content";

// The docs search index: one entry per heading, built from the Markdown at build time and served as a
// static file. The search dialog fetches it the first time it opens.
export const dynamic = "force-static";

export function GET() {
  return Response.json(getSearchIndex());
}
