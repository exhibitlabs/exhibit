// A tiny rasteriser for dot art, in grid cells. Pure JavaScript: no browser, no fonts, no network.
//
// A drawing paints shapes onto a cols x rows grid of tone levels. A cell takes a shape's level when the
// cell's centre (i + 0.5, j + 0.5) is inside the shape, so edges land on whole cells and nothing is
// anti-aliased into stray rings. Later shapes paint over earlier ones; level 0 erases back to paper.
//
// Levels: 0 paper, 1 faint ring, 2 ring, 3 small dot, 4 large dot, 5 full dot, 6 full dot in gold.

/** Characters used for each level in art-data.ts (index = level). */
export const GLYPHS = [".", ":", "o", "+", "*", "#", "@"];

export const PAPER = 0;
export const FAINT = 1;
export const RING = 2;
export const SMALL = 3;
export const LARGE = 4;
export const FULL = 5;
export const GOLD = 6;

// ---------------------------------------------------------------- shapes: (x, y) => inside?

export const rect = (x, y, w, h) => (px, py) => px >= x && px < x + w && py >= y && py < y + h;

/** A rectangle with every corner rounded by r (radius in cells). */
export const roundRect = (x, y, w, h, r) => (px, py) => {
  if (!(px >= x && px < x + w && py >= y && py < y + h)) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return (px - cx) ** 2 + (py - cy) ** 2 <= r * r + 1e-9;
};

export const circle = (cx, cy, r) => (px, py) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r + 1e-9;

export const ellipse = (cx, cy, rx, ry) => (px, py) => ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2 <= 1 + 1e-9;

/** A ring between radii r0 and r1. */
export const annulus = (cx, cy, r0, r1) => (px, py) => {
  const d = (px - cx) ** 2 + (py - cy) ** 2;
  return d >= r0 * r0 - 1e-9 && d <= r1 * r1 + 1e-9;
};

/** A filled polygon (even-odd rule). */
export const poly = (pts) => (px, py) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

function segDist2(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
}

/** A polyline stroked `w` cells wide with round joins and caps. */
export const line = (pts, w) => (px, py) => {
  const r2 = (w / 2) ** 2 + 1e-9;
  for (let i = 1; i < pts.length; i++) if (segDist2(px, py, pts[i - 1], pts[i]) <= r2) return true;
  return false;
};

/** Points along a quadratic Bezier, for curved strokes. */
export function quad(a, c, b, steps = 24) {
  const out = [];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

export const or = (...shapes) => (px, py) => shapes.some((s) => s(px, py));
export const and = (...shapes) => (px, py) => shapes.every((s) => s(px, py));
export const minus = (a, ...holes) => (px, py) => a(px, py) && !holes.some((h) => h(px, py));

// ---------------------------------------------------------------- dot face

// A 5 x 7 dot-matrix face for the few words the art prints (stamps). One cell per stroke, the way a
// dot-matrix printer sets type, so every letter sits exactly on the grid.
const FACE = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
};

/** Width in cells of `text` set in the dot face at `scale`, with `gap` empty columns between letters. */
export const textWidth = (text, scale = 1, gap = 1) => [...text].reduce((w, ch, i) => w + (ch === " " ? 3 : 5) * scale + (i ? gap * scale : 0), 0);

// ---------------------------------------------------------------- canvas

export function canvas(cols, rows) {
  const cells = new Uint8Array(cols * rows);
  let clip = null;
  const c = {
    cols,
    rows,
    /** Paint every cell whose centre is inside `shape`. */
    fill(shape, level) {
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const x = i + 0.5;
          const y = j + 0.5;
          if (shape(x, y) && (!clip || clip(x, y))) cells[j * cols + i] = level;
        }
      return c;
    },
    /** Paint only cells that already carry ink (level >= 1), e.g. to shade inside a silhouette. */
    tint(shape, level) {
      return c.fill((x, y) => shape(x, y) && cells[Math.floor(y) * cols + Math.floor(x)] > 0, level);
    },
    /** Restrict painting to `shape` while `fn` runs. */
    within(shape, fn) {
      const prev = clip;
      clip = prev ? and(prev, shape) : shape;
      fn();
      clip = prev;
      return c;
    },
    /** Set one cell. */
    dot(i, j, level) {
      if (i >= 0 && j >= 0 && i < cols && j < rows) cells[j * cols + i] = level;
      return c;
    },
    get(i, j) {
      return i >= 0 && j >= 0 && i < cols && j < rows ? cells[j * cols + i] : 0;
    },
    /** Set `text` in the dot face with its top-left cell at (x, y). */
    text(text, x, y, level, { scale = 1, gap = 1 } = {}) {
      let cx = x;
      for (const ch of text) {
        if (ch === " ") {
          cx += 3 * scale + gap * scale;
          continue;
        }
        const g = FACE[ch];
        if (!g) throw new Error(`dot face has no glyph for "${ch}"`);
        for (let gy = 0; gy < 7; gy++)
          for (let gx = 0; gx < 5; gx++) {
            if (g[gy][gx] !== "1") continue;
            for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) c.dot(cx + gx * scale + sx, y + gy * scale + sy, level);
          }
        cx += 5 * scale + gap * scale;
      }
      return c;
    },
    /** The grid as rows of glyphs. */
    rowsOut() {
      const out = [];
      for (let j = 0; j < rows; j++) out.push(Array.from(cells.subarray(j * cols, (j + 1) * cols), (v) => GLYPHS[v]).join(""));
      return out;
    },
  };
  return c;
}
