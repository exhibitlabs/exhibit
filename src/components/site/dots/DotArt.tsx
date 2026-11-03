import { clsx } from "clsx";
import type { CSSProperties } from "react";
import { DOT_ART, DOT_ART_MINI, DOT_WORDMARK, type DotArtName, type DotMiniName } from "./art-data";
import { DOT_ART_SMALL } from "./art-small";
import { DotSvg } from "./DotSvg";
import type { DotGrid } from "./paint";

// Ink halftone dot art as static SVG. The drawings live in generator/drawings.mjs; generator/generate.mjs
// prints them into grids (art-data.ts for the site's 60 x 45 and the product tour's 16 x 12 icons,
// art-small.ts for 32 x 24) and paint.ts turns a grid into SVG paths. Everything renders on the server and
// ships no JavaScript. The app's DotArt (src/components/ui/DotArt.tsx) is the same renderer and data at its
// own sizes.

export type { DotArtName, DotGrid, DotMiniName };
export { DotSvg };

/**
 * One of the ink dot illustrations. Decorative by default (aria-hidden); pass `title` when the drawing
 * carries meaning on its own. `frame` adds the printed two-ring border; `ghost` draws the piece in pale
 * rings only (something that has not happened yet). Size it with CSS width (height follows, 4:3) and keep
 * it 180 px wide or more, so every cell stays at least 3 px; `small` switches to the 32 x 24 drawings for
 * placements 96 to 179 px wide.
 */
export function DotArt({ name, frame, ghost, small, title, className, style }: { name: DotArtName; frame?: boolean; ghost?: boolean; small?: boolean; title?: string; className?: string; style?: CSSProperties }) {
  return <DotSvg grid={(small ? DOT_ART_SMALL : DOT_ART)[name]} frame={frame} ghost={ghost} title={title} className={clsx("s-dots", className)} style={style} />;
}

/**
 * One of the six 16 x 12 dot icons, the product tour's chapters (scales, magnifier, stamp, parcel, bubble,
 * terminal). Size it with CSS width: 32 px prints 2 px a cell, and it reads from 28 to 36 px. Decorative
 * unless `title`. Its few-cell gold accent prints in --s-gold; set `--s-gold: currentColor` on a parent to
 * print it in the icon's ink.
 */
export function DotIcon({ name, title, className, style }: { name: DotMiniName; title?: string; className?: string; style?: CSSProperties }) {
  return <DotSvg grid={DOT_ART_MINI[name]} title={title} className={clsx("s-dots", className)} style={style} />;
}

/**
 * The monumental dotted wordmark: the logo's E with its arm in gold, and "xhibit", in solid ink dots.
 * A coarser drawing takes over on phones so every dot stays a dot. `accent={false}` draws the arm in ink.
 */
export function DotWordmark({ accent = true, className, style }: { accent?: boolean; className?: string; style?: CSSProperties }) {
  const ink = (g: DotGrid) => (accent ? g : g.map((row) => row.replace(/@/g, "#")));
  return (
    <div className={clsx("s-wordmark", className)} style={style} role="img" aria-label="Exhibit">
      <DotSvg grid={ink(DOT_WORDMARK.fine)} className="s-dots s-wordmark__fine" />
      <DotSvg grid={ink(DOT_WORDMARK.coarse)} className="s-dots s-wordmark__coarse" />
    </div>
  );
}

/**
 * A dotted comparison track: `cells` boxes in a row, each a small field of dots. Filled boxes print in
 * full ink dots, the rest in faint rings. Pass `filled` as indexes or "all". Lay the boxes out with
 * `columns` (desktop) and `columnsMobile`. The track is one image to screen readers: pass `label`.
 */
export function DotTrack({
  cells = 12,
  filled,
  dots = [9, 5],
  columns,
  columnsMobile = 6,
  label,
  className,
}: {
  cells?: number;
  filled: number[] | "all";
  /** Dots per box, [across, down]. */
  dots?: [number, number];
  columns?: number;
  columnsMobile?: number;
  label: string;
  className?: string;
}) {
  const [cx, cy] = dots;
  const on: DotGrid = Array.from({ length: cy }, () => "#".repeat(cx));
  const off: DotGrid = Array.from({ length: cy }, () => "o".repeat(cx));
  const isOn = (i: number) => filled === "all" || filled.includes(i);
  const vars = { "--s-track-cols": columns ?? cells, "--s-track-cols-m": columnsMobile } as CSSProperties;
  return (
    <div className={clsx("s-track", className)} style={vars} role="img" aria-label={label}>
      {Array.from({ length: cells }, (_, i) => (
        <div key={i} className={clsx("s-track__cell", isOn(i) ? "s-track__cell--on" : "s-track__cell--off")}>
          <DotSvg grid={isOn(i) ? on : off} className="s-dots" />
        </div>
      ))}
    </div>
  );
}

export const DOT_ART_NAMES = Object.keys(DOT_ART) as DotArtName[];
