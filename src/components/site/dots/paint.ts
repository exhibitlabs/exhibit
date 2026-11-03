// How a dot grid is printed: the one renderer behind the site's DotArt, the app's DotArt and the brand SVG
// export (generator/export-svg.mjs). Framework-free and dependency-free so Node can run it as is.
//
// A grid is rows of glyphs, one per cell: "." paper, ":" faint ring, "o" ring, "+" small dot, "*" large
// dot, "#" full dot, "@" full dot in gold. Every dot is a zero-length dash with a round cap: one path per
// tone, one subpath per horizontal run of cells, stroke-dasharray "0 1" so a dash lands on each cell
// centre. Each run starts half a cell before its first centre and ends half a cell after its last, with
// stroke-dashoffset 0.5, so no dash sits on a path end: Chrome drops a zero-length dash at the very end
// of a path and WebKit (Safari) draws it, so the last dot of every run used to depend on the browser.
// Rings are the same runs drawn wide, with a mask punching out the middle.

export type DotGrid = readonly string[];

export type DotStroke = { d: string; width: number; opacity: number; gold?: boolean };
export type DotLayers = { cols: number; rows: number; fills: DotStroke[]; rings: DotStroke[]; holes: DotStroke[] };

/** Dot diameter and opacity per tone, in cells. */
const FILL = { "#": { width: 0.86, opacity: 1 }, "*": { width: 0.74, opacity: 0.95 }, "+": { width: 0.6, opacity: 0.85 } } as const;
/** Ring radius (to the middle of the line) and opacity per tone, in cells. */
const RING = { o: { r: 0.29, opacity: 0.95 }, ":": { r: 0.27, opacity: 0.42 } } as const;
/** Ring line width, in cells. */
const LINE = 0.2;

export const DASH = { fill: "none", strokeLinecap: "round", strokeDasharray: "0 1", strokeDashoffset: 0.5 } as const;

/** Horizontal runs of cells that pass `test`, as path data. */
function runs(grid: DotGrid, test: (ch: string, i: number, j: number) => boolean): string {
  let d = "";
  grid.forEach((row, j) => {
    let i = 0;
    while (i < row.length) {
      if (!test(row[i], i, j)) {
        i++;
        continue;
      }
      const start = i;
      while (i < row.length && test(row[i], i, j)) i++;
      d += `M${start} ${j + 0.5}h${i - start}`;
    }
  });
  return d;
}

/** The strokes that print `grid`. `ghost` turns every mark into a pale ring; `frame` adds the two-ring border. */
export function dotLayers(grid: DotGrid, { ghost = false, frame = false }: { ghost?: boolean; frame?: boolean } = {}): DotLayers {
  const cols = grid[0]?.length ?? 0;
  const rows = grid.length;
  const fills: DotStroke[] = [];
  const rings: { d: string; r: number; opacity: number }[] = [];
  if (ghost) {
    rings.push({ d: runs(grid, (ch) => ch === "#" || ch === "*" || ch === "+" || ch === "@"), r: 0.29, opacity: 0.5 });
    rings.push({ d: runs(grid, (ch) => ch === "o" || ch === ":"), r: 0.27, opacity: 0.22 });
  } else {
    for (const [ch, f] of Object.entries(FILL)) fills.push({ d: runs(grid, (c) => c === ch), ...f });
    fills.push({ d: runs(grid, (c) => c === "@"), ...FILL["#"], gold: true });
    for (const [ch, r] of Object.entries(RING)) rings.push({ d: runs(grid, (c) => c === ch), ...r });
  }
  if (frame) {
    const edge = (n: number) => (_: string, i: number, j: number) => Math.min(i, j, cols - 1 - i, rows - 1 - j) === n;
    rings.push({ d: runs(grid, edge(0)), r: 0.27, opacity: 0.32 }, { d: runs(grid, edge(1)), r: 0.27, opacity: 0.18 });
  }
  const live = rings.filter((r) => r.d);
  return {
    cols,
    rows,
    fills: fills.filter((f) => f.d),
    rings: live.map((r) => ({ d: r.d, width: 2 * r.r + LINE, opacity: r.opacity })),
    holes: live.map((r) => ({ d: r.d, width: 2 * r.r - LINE, opacity: 1 })),
  };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/**
 * A standalone SVG document for `grid` (brand assets, READMEs). `ink` and `gold` are colours; `width`
 * sets the rendered size in px (height follows the grid). `id` keeps the mask id unique if several
 * documents are inlined into one page.
 */
export function dotSvg(grid: DotGrid, { ink = "#0a0a0a", gold = "#e8a33d", width, title, id = "dots", ghost, frame, pad = 0 }: { ink?: string; gold?: string; width?: number; title?: string; id?: string; ghost?: boolean; frame?: boolean; pad?: number } = {}): string {
  const L = dotLayers(grid, { ghost, frame });
  const vw = L.cols + 2 * pad;
  const vh = L.rows + 2 * pad;
  const size = width ? ` width="${width}" height="${Math.round((width * vh) / vw)}"` : "";
  const dash = `fill="none" stroke-linecap="round" stroke-dasharray="0 1" stroke-dashoffset="0.5"`;
  const path = (s: DotStroke, color: string) => `<path d="${s.d}" ${dash} stroke="${color}" stroke-width="${s.width}"${s.opacity < 1 ? ` opacity="${s.opacity}"` : ""}/>`;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${vw} ${vh}"${size}${title ? ` role="img" aria-label="${esc(title)}"` : ""}>`];
  if (title) out.push(`<title>${esc(title)}</title>`);
  for (const f of L.fills) out.push(path(f, f.gold ? gold : ink));
  if (L.rings.length) {
    out.push(`<mask id="${id}" maskUnits="userSpaceOnUse" x="-1" y="-1" width="${L.cols + 2}" height="${L.rows + 2}"><rect x="-1" y="-1" width="${L.cols + 2}" height="${L.rows + 2}" fill="#fff"/>`);
    for (const h of L.holes) out.push(path(h, "#000"));
    out.push(`</mask><g mask="url(#${id})">`);
    for (const r of L.rings) out.push(path(r, ink));
    out.push("</g>");
  }
  out.push("</svg>");
  return out.join("");
}
