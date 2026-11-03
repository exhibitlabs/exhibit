import "server-only";
import fs from "node:fs";
import path from "node:path";
import { parseDoc, plainText, type Block, type Inline, type ParsedDoc } from "./markdown";

/**
 * Loads the docs from src/content/docs/*.md (format: src/content/docs/README.md), validates them and
 * builds the sidebar, previous/next links and the search index. In production every page is parsed once
 * and any broken frontmatter, internal link or anchor fails the build. In development the files are
 * re-read on every request so edits show up on refresh, and problems are listed on the page instead.
 */

export const DOCS_SECTIONS = ["Get started", "How it works", "Integrations", "Trust", "Reference"] as const;
export type DocsSection = (typeof DOCS_SECTIONS)[number];

export const DOCS_REPO_PATH = "src/content/docs";
export const DOCS_EDIT_BASE = "https://github.com/exhibitlabs/exhibit/blob/main/src/content/docs";

export type DocPage = {
  /** "" for the Introduction (index.md). */
  slug: string;
  href: string;
  file: string;
  title: string;
  label: string;
  description: string;
  section: DocsSection;
  order: number;
  toc: boolean;
  doc: ParsedDoc;
};

export type DocsNavGroup = { section: DocsSection; pages: { href: string; label: string; title: string }[] };

type Store = { pages: DocPage[]; problems: Map<string, string[]>; global: string[] };

const DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), DOCS_REPO_PATH);
const isProd = process.env.NODE_ENV === "production";
let cached: Store | null = null;

function load(): Store {
  if (cached && isProd) return cached;
  const files = fs.existsSync(DIR)
    ? fs.readdirSync(DIR).filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    : [];
  const problems = new Map<string, string[]>();
  const global: string[] = [];
  const note = (file: string, msg: string) => {
    const list = problems.get(file) ?? [];
    list.push(msg);
    problems.set(file, list);
  };

  const pages: DocPage[] = [];
  for (const file of files) {
    const source = fs.readFileSync(path.join(DIR, file), "utf8");
    const doc = parseDoc(source);
    const fm = doc.frontmatter;
    const slug = file === "index.md" ? "" : file.replace(/\.md$/, "");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug !== "") note(file, `file name "${file}" is not a lowercase hyphenated slug`);
    for (const key of ["title", "description", "section", "order"]) {
      if (!fm[key]) note(file, `frontmatter is missing "${key}"`);
    }
    const section = (DOCS_SECTIONS as readonly string[]).includes(fm.section) ? (fm.section as DocsSection) : null;
    if (fm.section && !section) note(file, `unknown section "${fm.section}" (use one of: ${DOCS_SECTIONS.join(", ")})`);
    const order = Number(fm.order);
    if (fm.order && !Number.isInteger(order)) note(file, `order "${fm.order}" is not an integer`);
    if (fm.description && fm.description.length > 200) note(file, "description is longer than 200 characters");
    for (const w of doc.warnings) note(file, w);
    pages.push({
      slug,
      href: slug ? `/docs/${slug}` : "/docs",
      file,
      title: fm.title || slug || "Introduction",
      label: fm.label || fm.title || slug,
      description: fm.description || "",
      section: section ?? "Reference",
      order: Number.isInteger(order) ? order : 99,
      toc: fm.toc !== "false",
      doc,
    });
  }

  pages.sort((a, b) => DOCS_SECTIONS.indexOf(a.section) - DOCS_SECTIONS.indexOf(b.section) || a.order - b.order || a.title.localeCompare(b.title));

  // Two pages in the same slot.
  const slots = new Map<string, string>();
  for (const p of pages) {
    const key = `${p.section}#${p.order}`;
    const other = slots.get(key);
    if (other) note(p.file, `same section and order as ${other}`);
    else slots.set(key, p.file);
  }

  // Internal links and anchors.
  const byHref = new Map(pages.map((p) => [p.href, p]));
  for (const p of pages) {
    for (const href of p.doc.links) {
      if (href.startsWith("#")) {
        if (!p.doc.ids.has(href.slice(1))) note(p.file, `link to missing anchor "${href}"`);
        continue;
      }
      if (!href.startsWith("/docs")) continue;
      const [rawPath, hash] = href.split("#");
      const target = byHref.get(rawPath.replace(/\/+$/, "") || "/docs");
      if (!target) {
        note(p.file, `link to missing page "${href}"`);
        continue;
      }
      if (hash && !target.doc.ids.has(hash)) note(p.file, `link to missing anchor "${href}" (no heading with id "${hash}" on ${target.file})`);
    }
  }

  if (!pages.some((p) => p.slug === "")) global.push("index.md (the Introduction) is missing");

  const store = { pages, problems, global };
  if (isProd) {
    const all = [...global, ...[...problems].flatMap(([file, list]) => list.map((m) => `${file}: ${m}`))];
    // Unknown fence languages and similar notes are warnings; frontmatter and link problems fail the build.
    const fatal = all.filter((m) => !/unknown code language|without a title|ignored|not understood|ignores text/.test(m));
    if (fatal.length) throw new Error(`Docs content check failed:\n  - ${fatal.join("\n  - ")}`);
    if (all.length) console.warn(`Docs content warnings:\n  - ${all.join("\n  - ")}`);
    cached = store;
  }
  return store;
}

export function getAllDocs(): DocPage[] {
  return load().pages;
}

export function getDoc(slug: string): DocPage | undefined {
  return load().pages.find((p) => p.slug === slug);
}

/** Problems for one page, shown on the page in development only. */
export function getDocProblems(page: DocPage): string[] {
  if (isProd) return [];
  const store = load();
  return [...(page.slug === "" ? store.global : []), ...(store.problems.get(page.file) ?? [])];
}

export function getDocsNav(): DocsNavGroup[] {
  const pages = load().pages;
  return DOCS_SECTIONS.map((section) => ({
    section,
    pages: pages.filter((p) => p.section === section).map((p) => ({ href: p.href, label: p.label, title: p.title })),
  })).filter((g) => g.pages.length > 0);
}

export function getPrevNext(page: DocPage): { prev?: DocPage; next?: DocPage } {
  const pages = load().pages;
  const i = pages.findIndex((p) => p.href === page.href);
  return { prev: i > 0 ? pages[i - 1] : undefined, next: i >= 0 && i < pages.length - 1 ? pages[i + 1] : undefined };
}

/* ------------------------------------------------------------------ search index */

export type SearchEntry = {
  /** Link target: the page, or the page plus a heading anchor. */
  href: string;
  page: string;
  section: string;
  /** The heading this chunk sits under; empty for the page's opening. */
  heading: string;
  text: string;
};

function blockText(b: Block): string {
  const inl = (n: Inline[]) => plainText(n);
  switch (b.type) {
    case "paragraph":
      return inl(b.content);
    case "heading":
      return b.text;
    case "code":
      return b.code.length > 400 ? b.code.slice(0, 400) : b.code;
    case "list": {
      const walk = (l: typeof b): string => l.items.map((it) => [inl(it.content), ...it.children.map(walk)].join(" ")).join(" ");
      return walk(b);
    }
    case "callout":
      return [b.title ? inl(b.title) : "", ...b.blocks.map(blockText)].join(" ");
    case "quote":
      return b.blocks.map(blockText).join(" ");
    case "table":
      // Rows only: header cells ("Field", "What it does") would crowd every snippet.
      return b.rows
        .map((r) => {
          const t = r.map(inl).filter(Boolean).join(", ");
          return /[.!?:]$/.test(t) ? t : `${t}.`;
        })
        .join(" ");
    case "cards":
      return b.cards.map((c) => `${inl(c.title)} ${inl(c.description)}`).join(" ");
    case "tabs":
      return b.tabs.map((t) => t.code.slice(0, 300)).join(" ");
    default:
      return "";
  }
}

export function getSearchIndex(): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const p of load().pages) {
    let current: SearchEntry = { href: p.href, page: p.title, section: p.section, heading: "", text: p.description };
    const push = () => {
      current.text = current.text.replace(/\s+/g, " ").trim();
      out.push(current);
    };
    for (const b of p.doc.blocks) {
      if (b.type === "heading" && b.level <= 3) {
        push();
        current = { href: `${p.href}#${b.id}`, page: p.title, section: p.section, heading: b.text, text: "" };
      } else if (b.type === "steps") {
        for (const s of b.steps) {
          push();
          current = { href: `${p.href}#${s.id}`, page: p.title, section: p.section, heading: plainText(s.title), text: s.blocks.map(blockText).join(" ") };
        }
      } else {
        current.text += " " + blockText(b);
      }
    }
    push();
  }
  return out;
}
