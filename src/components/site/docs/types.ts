// Shapes shared by the docs' server loader and its client components (no server-only imports here).

export type DocsNavPage = { href: string; label: string; title: string };
export type DocsNavGroupData = { section: string; pages: DocsNavPage[] };
export type TocHeading = { level: 2 | 3; id: string; text: string };
export type SearchEntryData = { href: string; page: string; section: string; heading: string; text: string };

/** The static search index, built from the Markdown at build time. */
export const SEARCH_INDEX_URL = "/docs/search-index.json";
