/**
 * A small Markdown parser for the docs. It handles exactly the subset documented in
 * src/content/docs/README.md and returns a plain AST that render.tsx turns into React elements.
 * No HTML is ever passed through: anything outside the subset renders as text.
 */

export type Inline =
  | { type: "text"; value: string }
  | { type: "code"; value: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; children: Inline[] }
  | { type: "image"; src: string; alt: string };

export type CalloutKind = "note" | "tip" | "important" | "warning" | "caution";
export type Align = "left" | "center" | "right" | null;

export type ListItem = { content: Inline[]; children: ListBlock[] };
export type ListBlock = { type: "list"; ordered: boolean; start: number; items: ListItem[] };
export type CodeBlock = { type: "code"; lang: string; title?: string; code: string };
export type Step = { id: string; title: Inline[]; blocks: Block[] };
export type Card = { href: string; title: Inline[]; description: Inline[] };

export type Block =
  | { type: "heading"; level: 2 | 3 | 4; id: string; content: Inline[]; text: string }
  | { type: "paragraph"; content: Inline[] }
  | CodeBlock
  | ListBlock
  | { type: "callout"; kind: CalloutKind; title?: Inline[]; blocks: Block[] }
  | { type: "quote"; blocks: Block[] }
  | { type: "table"; align: Align[]; head: Inline[][]; rows: Inline[][][] }
  | { type: "image"; src: string; alt: string }
  | { type: "hr" }
  | { type: "steps"; steps: Step[] }
  | { type: "cards"; cards: Card[] }
  | { type: "tabs"; tabs: CodeBlock[] };

export type Heading = { level: 2 | 3; id: string; text: string };

export type ParsedDoc = {
  frontmatter: Record<string, string>;
  blocks: Block[];
  /** Headings shown in "On this page" (h2 and h3, including step titles). */
  headings: Heading[];
  /** Every heading id on the page, for anchor checks. */
  ids: Set<string>;
  /** Every link href on the page, for link checks. */
  links: string[];
  /** Problems worth fixing: unknown fence languages, unclosed containers. */
  warnings: string[];
};

const CALLOUT = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i;
const FENCE = /^(\s*)(`{3,}|~{3,})\s*(.*)$/;
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const HR = /^\s{0,3}((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/;
const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;
const IMAGE_LINE = /^\s*!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)\s*$/;
const CONTAINER_OPEN = /^:::(steps|cards|tabs)\s*$/;
const CONTAINER_CLOSE = /^:::\s*$/;

/** Heading ids: lowercase, apostrophes dropped, every other run of non-letters/digits becomes one hyphen. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

export function plainText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
        case "code":
          return n.value;
        case "image":
          return n.alt;
        default:
          return plainText(n.children);
      }
    })
    .join("");
}

/* ------------------------------------------------------------------ frontmatter */

export function splitFrontmatter(source: string): { frontmatter: Record<string, string>; body: string } {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\s*(?:\n|$)/.exec(text);
  if (!match) return { frontmatter: {}, body: text };
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    frontmatter[key] = value;
  }
  return { frontmatter, body: text.slice(match[0].length) };
}

/* ------------------------------------------------------------------ inline */

const ESCAPABLE = new Set("\\`*_{}[]()#+-.!|<>~\"'".split(""));

function isPunct(ch: string | undefined) {
  return ch === undefined || /[\s\p{P}\p{S}]/u.test(ch);
}

/** Finds the closing run of exactly `n` backticks starting at `from`. */
function findCodeClose(s: string, from: number, n: number): number {
  let i = from;
  while (i < s.length) {
    if (s[i] === "`") {
      let j = i;
      while (j < s.length && s[j] === "`") j++;
      if (j - i === n) return i;
      i = j;
    } else i++;
  }
  return -1;
}

/** Index just past the `]` that closes the bracket opened at `open`, skipping code spans and escapes. */
function findBracketClose(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "`") {
      let j = i;
      while (j < s.length && s[j] === "`") j++;
      const close = findCodeClose(s, j, j - i);
      if (close === -1) {
        i = j - 1;
        continue;
      }
      i = close + (j - i) - 1;
      continue;
    }
    if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Parses `(href "title")` at `open`; returns the href and the index after `)`. */
function parseLinkTarget(s: string, open: number): { href: string; end: number } | null {
  if (s[open] !== "(") return null;
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) {
        const inner = s.slice(open + 1, i).trim();
        const href = inner.replace(/\s+"[^"]*"$/, "").trim();
        if (!href || /\s/.test(href)) return null;
        return { href, end: i + 1 };
      }
    }
  }
  return null;
}

/** Finds a closing emphasis delimiter for `delim` starting at `from`, skipping code spans and links. */
function findEmphasisClose(s: string, from: number, delim: string): number {
  for (let i = from; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\") {
      i++;
      continue;
    }
    if (ch === "`") {
      let j = i;
      while (j < s.length && s[j] === "`") j++;
      const close = findCodeClose(s, j, j - i);
      if (close !== -1) i = close + (j - i) - 1;
      else i = j - 1;
      continue;
    }
    if (ch === "[") {
      const close = findBracketClose(s, i);
      if (close !== -1) {
        const target = parseLinkTarget(s, close + 1);
        if (target) {
          i = target.end - 1;
          continue;
        }
      }
    }
    if (s.startsWith(delim, i)) {
      // `**` must not be read as the closing `*` of an em, and vice versa.
      if (delim === "*" && (s[i + 1] === "*" || s[i - 1] === "*")) {
        if (s[i + 1] === "*") i++;
        continue;
      }
      const before = s[i - 1];
      const after = s[i + delim.length];
      if (before === undefined || /\s/.test(before)) continue; // closer must follow non-space
      if (delim === "_" && !isPunct(after)) continue; // no intraword underscores
      if (i === from) continue;
      return i;
    }
  }
  return -1;
}

const AUTOLINK = /^https?:\/\/[^\s<>]+/;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      const last = out[out.length - 1];
      if (last && last.type === "text") last.value += buf;
      else out.push({ type: "text", value: buf });
      buf = "";
    }
  };

  let i = 0;
  while (i < src.length) {
    const ch = src[i];

    if (ch === "\\" && i + 1 < src.length && ESCAPABLE.has(src[i + 1])) {
      buf += src[i + 1];
      i += 2;
      continue;
    }

    if (ch === "`") {
      let j = i;
      while (j < src.length && src[j] === "`") j++;
      const n = j - i;
      const close = findCodeClose(src, j, n);
      if (close !== -1) {
        let value = src.slice(j, close).replace(/\n/g, " ");
        if (value.length > 2 && value.startsWith(" ") && value.endsWith(" ") && value.trim()) value = value.slice(1, -1);
        flush();
        out.push({ type: "code", value });
        i = close + n;
        continue;
      }
      buf += src.slice(i, j);
      i = j;
      continue;
    }

    if (ch === "!" && src[i + 1] === "[") {
      const close = findBracketClose(src, i + 1);
      if (close !== -1) {
        const target = parseLinkTarget(src, close + 1);
        if (target) {
          flush();
          out.push({ type: "image", alt: src.slice(i + 2, close), src: target.href });
          i = target.end;
          continue;
        }
      }
    }

    if (ch === "[") {
      const close = findBracketClose(src, i);
      if (close !== -1) {
        const target = parseLinkTarget(src, close + 1);
        if (target) {
          flush();
          out.push({ type: "link", href: target.href, children: parseInline(src.slice(i + 1, close)) });
          i = target.end;
          continue;
        }
      }
    }

    if ((ch === "*" && src[i + 1] === "*") || (ch === "_" && src[i + 1] === "_" && isPunct(src[i - 1]))) {
      const delim = ch + ch;
      if (src[i + 2] && !/\s/.test(src[i + 2])) {
        const close = findEmphasisClose(src, i + 2, delim);
        if (close !== -1) {
          flush();
          out.push({ type: "strong", children: parseInline(src.slice(i + 2, close)) });
          i = close + 2;
          continue;
        }
      }
    }

    if ((ch === "*" && src[i + 1] !== "*") || (ch === "_" && isPunct(src[i - 1]))) {
      if (src[i + 1] && !/\s/.test(src[i + 1])) {
        const close = findEmphasisClose(src, i + 1, ch);
        if (close !== -1) {
          flush();
          out.push({ type: "em", children: parseInline(src.slice(i + 1, close)) });
          i = close + 1;
          continue;
        }
      }
    }

    if (ch === "h" && (i === 0 || /[\s(]/.test(src[i - 1]))) {
      const m = AUTOLINK.exec(src.slice(i));
      if (m) {
        let url = m[0];
        // Trailing punctuation belongs to the sentence, not the URL.
        while (/[.,:;!?'"]$/.test(url) || (url.endsWith(")") && (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0))) {
          url = url.slice(0, -1);
        }
        flush();
        out.push({ type: "link", href: url, children: [{ type: "text", value: url }] });
        i += url.length;
        continue;
      }
    }

    buf += ch;
    i++;
  }
  flush();
  return out;
}

/* ------------------------------------------------------------------ blocks */

type Ctx = { ids: Map<string, number>; all: Set<string>; warnings: string[] };

const indentOf = (line: string) => {
  let n = 0;
  for (const ch of line) {
    if (ch === " ") n++;
    else if (ch === "\t") n += 4;
    else break;
  }
  return n;
};
const isBlank = (line: string | undefined) => line === undefined || line.trim() === "";

function uniqueId(ctx: Ctx, base: string): string {
  const id = base || "section";
  let seen = ctx.ids.get(id) ?? 0;
  let out = seen === 0 ? id : `${id}-${seen + 1}`;
  while (ctx.all.has(out)) {
    seen++;
    out = `${id}-${seen + 1}`;
  }
  ctx.ids.set(id, seen + 1);
  ctx.all.add(out);
  return out;
}

function headingParts(raw: string, ctx: Ctx): { id: string; content: Inline[]; text: string } {
  let text = raw;
  let custom: string | undefined;
  const m = /\s*\{#([A-Za-z0-9_-]+)\}\s*$/.exec(text);
  if (m) {
    custom = m[1];
    text = text.slice(0, m.index);
  }
  const content = parseInline(text);
  const plain = plainText(content);
  return { id: uniqueId(ctx, custom ?? slugify(plain)), content, text: plain };
}

function parseFenceInfo(info: string): { lang: string; title?: string } {
  const titleMatch = /title\s*=\s*"([^"]*)"|title\s*=\s*'([^']*)'/.exec(info);
  const title = titleMatch ? (titleMatch[1] ?? titleMatch[2]) : undefined;
  const lang = info.replace(/title\s*=\s*("[^"]*"|'[^']*')/, "").trim().split(/\s+/)[0] ?? "";
  return { lang: lang.toLowerCase(), title };
}

/** Reads a fenced code block starting at `start`. Returns the block and the index after the closing fence. */
function readFence(lines: string[], start: number): { block: CodeBlock; next: number } {
  const m = FENCE.exec(lines[start])!;
  const indent = m[1].length;
  const marker = m[2];
  const { lang, title } = parseFenceInfo(m[3]);
  const body: string[] = [];
  let i = start + 1;
  for (; i < lines.length; i++) {
    const close = /^(\s*)(`{3,}|~{3,})\s*$/.exec(lines[i]);
    if (close && close[2][0] === marker[0] && close[2].length >= marker.length) {
      i++;
      break;
    }
    // Remove the fence's own indentation from each line.
    let line = lines[i];
    let strip = indent;
    while (strip > 0 && line.startsWith(" ")) {
      line = line.slice(1);
      strip--;
    }
    body.push(line);
  }
  return { block: { type: "code", lang: lang || "text", title, code: body.join("\n") }, next: i };
}

/** Index of the `:::` that closes a container opened at `start`, skipping fenced code. */
function findContainerClose(lines: string[], start: number): number {
  let inFence: string | null = null;
  for (let i = start + 1; i < lines.length; i++) {
    const f = /^\s*(`{3,}|~{3,})/.exec(lines[i]);
    if (f) {
      if (!inFence) inFence = f[1];
      else if (f[1][0] === inFence[0] && f[1].length >= inFence.length && lines[i].trim() === f[1]) inFence = null;
      continue;
    }
    if (!inFence && CONTAINER_CLOSE.test(lines[i])) return i;
  }
  return -1;
}

function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = "";
  let inCode = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      cur += "\\|";
      i++;
      continue;
    }
    if (ch === "`") {
      let j = i;
      while (j < s.length && s[j] === "`") j++;
      const n = j - i;
      if (inCode === 0) inCode = n;
      else if (inCode === n) inCode = 0;
      cur += s.slice(i, j);
      i = j - 1;
      continue;
    }
    if (ch === "|" && inCode === 0) {
      cells.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  cells.push(cur.trim());
  return cells;
}

function startsBlock(lines: string[], i: number): boolean {
  const line = lines[i];
  if (FENCE.test(line) || HEADING.test(line) || /^\s*>/.test(line) || HR.test(line)) return true;
  if (CONTAINER_OPEN.test(line) || CONTAINER_CLOSE.test(line)) return true;
  const li = LIST_ITEM.exec(line);
  if (li && indentOf(line) < 4) return true;
  if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) return true;
  if (IMAGE_LINE.test(line)) return true;
  return false;
}

function parseList(lines: string[], start: number, ctx: Ctx): { block: ListBlock; next: number } {
  const first = LIST_ITEM.exec(lines[start])!;
  const baseIndent = indentOf(lines[start]);
  const ordered = /\d/.test(first[2]);
  const block: ListBlock = { type: "list", ordered, start: ordered ? parseInt(first[2], 10) : 1, items: [] };
  let i = start;
  let current: { text: string[]; children: ListBlock[] } | null = null;

  const pushCurrent = () => {
    if (current) block.items.push({ content: parseInline(current.text.join(" ")), children: current.children });
  };

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      // A blank line ends the list unless the list (or an item's continuation) carries on after it.
      let j = i + 1;
      while (j < lines.length && isBlank(lines[j])) j++;
      if (j >= lines.length) break;
      const next = LIST_ITEM.exec(lines[j]);
      const nextIndent = indentOf(lines[j]);
      if (next && nextIndent === baseIndent && /\d/.test(next[2]) === ordered) {
        i = j;
        continue;
      }
      if (nextIndent > baseIndent && current) {
        i = j;
        continue;
      }
      break;
    }

    const indent = indentOf(line);
    const m = LIST_ITEM.exec(line);
    if (m && indent === baseIndent) {
      if (/\d/.test(m[2]) !== ordered) break;
      pushCurrent();
      current = { text: [m[3]], children: [] };
      i++;
      continue;
    }
    if (m && indent > baseIndent && current) {
      const nested = parseList(lines, i, ctx);
      current.children.push(nested.block);
      i = nested.next;
      continue;
    }
    if (indent > baseIndent && current && !FENCE.test(line)) {
      current.text.push(line.trim());
      i++;
      continue;
    }
    if (current && indent <= baseIndent && !m && !startsBlock(lines, i)) {
      // Lazy continuation of the item's paragraph.
      current.text.push(line.trim());
      i++;
      continue;
    }
    break;
  }
  pushCurrent();
  return { block, next: i };
}

function parseSteps(inner: string[], ctx: Ctx): Step[] {
  const steps: Step[] = [];
  let title: string | null = null;
  let body: string[] = [];
  const flush = () => {
    if (title === null) {
      if (body.some((l) => l.trim())) ctx.warnings.push(":::steps content before the first ### heading was ignored");
      return;
    }
    const h = headingParts(title, ctx);
    steps.push({ id: h.id, title: h.content, blocks: parseBlocks(body, ctx) });
  };
  let inFence: string | null = null;
  for (const line of inner) {
    const f = /^\s*(`{3,}|~{3,})/.exec(line);
    if (f) {
      if (!inFence) inFence = f[1];
      else if (f[1][0] === inFence[0] && line.trim() === f[1]) inFence = null;
    }
    const h = !inFence && !f ? /^###\s+(.*)$/.exec(line) : null;
    if (h) {
      flush();
      title = h[1];
      body = [];
    } else body.push(line);
  }
  flush();
  return steps;
}

function parseCards(inner: string[], ctx: Ctx): Card[] {
  const cards: Card[] = [];
  for (const raw of inner) {
    const line = raw.trim();
    if (!line) continue;
    const m = /^[-*+]\s+\[([^\]]+)\]\(([^)\s]+)\)\s*:?\s*(.*)$/.exec(line);
    if (!m) {
      ctx.warnings.push(`:::cards line not understood: ${line}`);
      continue;
    }
    cards.push({ title: parseInline(m[1]), href: m[2], description: parseInline(m[3]) });
  }
  return cards;
}

function parseTabs(inner: string[], ctx: Ctx): CodeBlock[] {
  const tabs: CodeBlock[] = [];
  let i = 0;
  while (i < inner.length) {
    if (FENCE.test(inner[i])) {
      const { block, next } = readFence(inner, i);
      if (!block.title) {
        ctx.warnings.push(":::tabs code block without a title; labelled by its language");
        block.title = block.lang;
      }
      tabs.push(block);
      i = next;
    } else {
      if (inner[i].trim()) ctx.warnings.push(`:::tabs ignores text outside code blocks: ${inner[i].trim()}`);
      i++;
    }
  }
  return tabs;
}

function parseBlocks(lines: string[], ctx: Ctx): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }

    const container = CONTAINER_OPEN.exec(line.trim());
    if (container) {
      const close = findContainerClose(lines, i);
      const end = close === -1 ? lines.length : close;
      if (close === -1) ctx.warnings.push(`:::${container[1]} is never closed`);
      const inner = lines.slice(i + 1, end);
      if (container[1] === "steps") blocks.push({ type: "steps", steps: parseSteps(inner, ctx) });
      else if (container[1] === "cards") blocks.push({ type: "cards", cards: parseCards(inner, ctx) });
      else blocks.push({ type: "tabs", tabs: parseTabs(inner, ctx) });
      i = end + 1;
      continue;
    }

    if (FENCE.test(line)) {
      const { block, next } = readFence(lines, i);
      blocks.push(block);
      i = next;
      continue;
    }

    const h = HEADING.exec(line);
    if (h) {
      const level = Math.min(Math.max(h[1].length, 2), 4) as 2 | 3 | 4;
      const parts = headingParts(h[2], ctx);
      blocks.push({ type: "heading", level, ...parts });
      i++;
      continue;
    }

    if (HR.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        inner.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      const marker = CALLOUT.exec(inner[0] ?? "");
      if (marker) {
        const title = marker[2].trim();
        blocks.push({
          type: "callout",
          kind: marker[1].toLowerCase() as CalloutKind,
          title: title ? parseInline(title) : undefined,
          blocks: parseBlocks(inner.slice(1), ctx),
        });
      } else {
        blocks.push({ type: "quote", blocks: parseBlocks(inner, ctx) });
      }
      continue;
    }

    if (line.includes("|") && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const head = splitRow(line).map(parseInline);
      const align: Align[] = splitRow(lines[i + 1]).map((c) => {
        const l = c.startsWith(":");
        const r = c.endsWith(":");
        return l && r ? "center" : r ? "right" : l ? "left" : null;
      });
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes("|")) {
        const cells = splitRow(lines[i]).map(parseInline);
        while (cells.length < head.length) cells.push([]);
        rows.push(cells.slice(0, head.length));
        i++;
      }
      blocks.push({ type: "table", align: align.slice(0, head.length), head, rows });
      continue;
    }

    const li = LIST_ITEM.exec(line);
    if (li) {
      const { block, next } = parseList(lines, i, ctx);
      blocks.push(block);
      i = next;
      continue;
    }

    const img = IMAGE_LINE.exec(line);
    if (img) {
      blocks.push({ type: "image", alt: img[1], src: img[2] });
      i++;
      continue;
    }

    const para: string[] = [line.trim()];
    i++;
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines, i)) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "paragraph", content: parseInline(para.join(" ")) });
  }
  return blocks;
}

/* ------------------------------------------------------------------ walk */

function collect(blocks: Block[], headings: Heading[], links: string[]) {
  const inl = (nodes: Inline[]) => {
    for (const n of nodes) {
      if (n.type === "link") {
        links.push(n.href);
        inl(n.children);
      } else if (n.type === "strong" || n.type === "em") inl(n.children);
    }
  };
  for (const b of blocks) {
    switch (b.type) {
      case "heading":
        if (b.level <= 3) headings.push({ level: b.level as 2 | 3, id: b.id, text: b.text });
        inl(b.content);
        break;
      case "paragraph":
        inl(b.content);
        break;
      case "list": {
        const walk = (l: ListBlock) =>
          l.items.forEach((it) => {
            inl(it.content);
            it.children.forEach(walk);
          });
        walk(b);
        break;
      }
      case "callout":
        if (b.title) inl(b.title);
        collect(b.blocks, [], links);
        break;
      case "quote":
        collect(b.blocks, [], links);
        break;
      case "table":
        b.head.forEach(inl);
        b.rows.forEach((r) => r.forEach(inl));
        break;
      case "steps":
        for (const s of b.steps) {
          headings.push({ level: 3, id: s.id, text: plainText(s.title) });
          inl(s.title);
          collect(s.blocks, [], links);
        }
        break;
      case "cards":
        for (const c of b.cards) {
          links.push(c.href);
          inl(c.description);
        }
        break;
    }
  }
}

export const HIGHLIGHT_LANGS = new Set([
  "bash", "sh", "shell", "zsh", "json", "jsonc", "ts", "typescript", "tsx", "js", "javascript", "jsx",
  "env", "dotenv", "yaml", "yml", "http", "md", "markdown", "text", "txt", "plain",
]);

export function parseDoc(source: string): ParsedDoc {
  const { frontmatter, body } = splitFrontmatter(source);
  const ctx: Ctx = { ids: new Map(), all: new Set(), warnings: [] };
  const blocks = parseBlocks(body.split("\n"), ctx);
  const headings: Heading[] = [];
  const links: string[] = [];
  collect(blocks, headings, links);
  const walkCode = (bs: Block[]) => {
    for (const b of bs) {
      if (b.type === "code" && !HIGHLIGHT_LANGS.has(b.lang)) ctx.warnings.push(`unknown code language "${b.lang}"`);
      if (b.type === "tabs") walkCode(b.tabs);
      if (b.type === "steps") b.steps.forEach((s) => walkCode(s.blocks));
      if (b.type === "callout" || b.type === "quote") walkCode(b.blocks);
    }
  };
  walkCode(blocks);
  return { frontmatter, blocks, headings, ids: ctx.all, links, warnings: ctx.warnings };
}
