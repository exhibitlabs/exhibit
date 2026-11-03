// Exhibit dot art: the drawings. Each piece is drawn twice, by hand, in grid cells: `lg` on the site's
// 60 x 45 grid and `sm` on 32 x 24 for small placements. Rules of the family:
// - Bold silhouettes; structural strokes at least two cells (one on sm); straight text lines are rows of dots.
// - Full dots (FULL) are solid ink, small dots (SMALL) mid tones, rings (RING) light tones, faint rings
//   (FAINT) shadows. Rings never draw an outline that has to read solid.
// - Words only in the 5 x 7 dot face (canvas.text), big enough to read.
// - Keep framed pieces inside cells 4..55 x 4..40: DotArt's frame prints on the outer two rings.
import { FAINT, FULL, GOLD, LARGE, PAPER, RING, SMALL, and, annulus, circle, ellipse, line, minus, or, poly, quad, rect, roundRect, textWidth } from "./raster.mjs";

/** A rectangle outline `t` cells thick. */
const frameRect = (x, y, w, h, t, r = 0) => (r ? minus(roundRect(x, y, w, h, r), roundRect(x + t, y + t, w - 2 * t, h - 2 * t, Math.max(0, r - t))) : minus(rect(x, y, w, h), rect(x + t, y + t, w - 2 * t, h - 2 * t)));

/** Point on a parallelogram: o + u * a + v * b. */
const at = (o, a, b, u, v) => [o[0] + u * a[0] + v * b[0], o[1] + u * a[1] + v * b[1]];
const quadPts = (o, a, b, u0, u1, v0, v1) => [at(o, a, b, u0, v0), at(o, a, b, u1, v0), at(o, a, b, u1, v1), at(o, a, b, u0, v1)];
const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];

export const PIECES = {
  // A letter tucked into an open envelope: arriving mail, a dispute opening, contact.
  letter: {
    lg(c) {
      c.fill(poly([[8, 21], [30, 11], [52, 21]]), SMALL); // the open back flap, its tip behind the letter
      c.fill(rect(8, 21, 44, 19), SMALL); // inside of the envelope
      c.fill(rect(14, 10, 32, 26), FULL); // the letter, outlined
      c.fill(rect(16, 12, 28, 24), PAPER);
      c.fill(rect(19, 15, 11, 2), FULL); // heading
      for (const [y, w] of [[19, 22], [22, 19], [25, 21]]) c.fill(rect(19, y, w, 1), FULL);
      c.fill(poly([[8, 21], [30, 33], [52, 21], [52, 40], [8, 40]]), FULL); // the front pocket
    },
    sm(c) {
      c.fill(poly([[4, 11], [16, 5.5], [28, 11]]), SMALL);
      c.fill(rect(4, 11, 24, 10), SMALL);
      c.fill(rect(7, 5, 18, 14), FULL);
      c.fill(rect(8, 6, 16, 13), PAPER);
      c.fill(rect(10, 8, 6, 1), FULL);
      c.fill(rect(10, 10, 12, 1), FULL);
      c.fill(rect(10, 12, 10, 1), FULL);
      c.fill(poly([[4, 11], [16, 17.5], [28, 11], [28, 21], [4, 21]]), FULL);
    },
  },

  // A parcel: an isometric box on 2:1 edges, outlined in ink: white top split by tape, mid-tone left
  // face, dark right face with a blank label (lg only). No marks on the label: skewed lines turn to noise.
  parcel: {
    lg(c) {
      const T = [30, 5], L = [-20, 10], R = [20, 10], V = [0, 14];
      const Lv = at(T, L, R, 1, 0), Rv = at(T, L, R, 0, 1), F = at(T, L, R, 1, 1);
      const down = (p) => [p[0], p[1] + V[1]];
      c.fill(ellipse(30, 41.5, 17, 1.6), FAINT); // shadow
      c.fill(poly([T, Rv, down(Rv), down(F), down(Lv), Lv]), FULL); // the whole box in ink
      c.fill(poly([[30, 7.2], [45.6, 15], [30, 22.8], [14.4, 15]]), PAPER); // top face, inside its edge
      c.fill(poly([[12, 17.2], [30, 26.2], [30, 37], [12, 28]]), SMALL); // left face, inside its edge
      c.fill(poly(quadPts(T, L, R, 0, 1, 0.44, 0.56)), FULL); // tape over the top
      c.fill(poly(quadPts(Lv, sub(F, Lv), V, 0.44, 0.56, 0, 0.55)), FULL); // and down the front
      c.fill(poly(quadPts(F, sub(Rv, F), V, 0.3, 0.76, 0.34, 0.74)), PAPER); // label
    },
    sm(c) {
      const T = [16, 2], L = [-12, 6], R = [12, 6], V = [0, 8];
      const Lv = at(T, L, R, 1, 0), Rv = at(T, L, R, 0, 1), F = at(T, L, R, 1, 1);
      const down = (p) => [p[0], p[1] + V[1]];
      c.fill(poly([T, Rv, down(Rv), down(F), down(Lv), Lv]), FULL);
      c.fill(poly([[16, 3.6], [25, 8], [16, 12.4], [7, 8]]), PAPER);
      c.fill(poly([[5, 9], [16, 14.5], [16, 21], [5, 15.5]]), SMALL);
      c.fill(poly(quadPts(T, L, R, 0, 1, 0.42, 0.58)), FULL);
      c.fill(poly(quadPts(Lv, sub(F, Lv), V, 0.42, 0.58, 0, 0.6)), FULL); // no label: too small to read here
    },
  },

  // The signed delivery slip: a barcode, two lines, an X and a signature, with a faint drop shadow.
  slip: {
    lg(c) {
      c.fill(rect(12, 8, 40, 33), FAINT); // the sheet's shadow
      c.fill(rect(9, 5, 40, 33), FULL);
      c.fill(rect(11, 7, 36, 29), PAPER);
      let x = 14;
      for (const [w, gap] of [[2, 1], [1, 1], [1, 2], [2, 1], [1, 1], [3, 1], [1, 2], [1, 1], [2, 1], [1, 1], [2, 2], [1, 0]]) {
        c.fill(rect(x, 10, w, 8), FULL); // barcode
        x += w + gap;
      }
      for (const [y, w] of [[21, 27], [24, 19]]) c.fill(rect(14, y, w, 1), SMALL);
      c.fill(rect(14, 33, 30, 1), SMALL); // signature line
      c.text("X", 14, 26, FULL);
      const sig = [...quad([21, 32], [21, 26], [24, 27]), ...quad([24, 27], [27, 28], [25, 31]), ...quad([25, 31], [24, 33], [28, 30]), ...quad([28, 30], [31, 26], [32, 30]), ...quad([32, 30], [33, 33], [36, 29]), ...quad([36, 29], [38, 26], [39, 30]), ...quad([39, 30], [40, 32], [44, 28])];
      c.fill(line(sig, 1.7), FULL);
    },
    sm(c) {
      c.fill(rect(7, 5, 22, 18), FAINT);
      c.fill(rect(5, 3, 22, 18), FULL);
      c.fill(rect(6, 4, 20, 16), PAPER);
      for (const x of [8, 10, 11, 13, 15, 16, 18, 20, 21, 23]) c.fill(rect(x, 6, 1, 4), FULL);
      c.fill(rect(8, 12, 12, 1), SMALL);
      c.fill(rect(8, 17, 16, 1), SMALL);
      c.fill(line([...quad([9, 16], [10, 13], [12, 14.5]), ...quad([12, 14.5], [13.5, 16], [15, 14.5]), ...quad([15, 14.5], [16.5, 13], [18, 14.5]), ...quad([18, 14.5], [19.5, 16], [21.5, 14])], 1.25), FULL);
    },
  },

  // The EXHIBIT A rubber stamp, set in the dot face.
  stamp: {
    lg(c) {
      c.fill(frameRect(5, 6, 50, 34, 2, 4), FULL);
      c.text("EXHIBIT", 30 - Math.ceil(textWidth("EXHIBIT") / 2), 11, FULL);
      c.fill(rect(10, 20, 40, 1), FULL);
      c.text("A", 25, 23, FULL, { scale: 2 });
    },
    sm(c) {
      c.fill(frameRect(3, 2, 26, 20, 1, 2), FULL);
      c.text("A", 11, 5, FULL, { scale: 2 });
    },
  },

  // A RESOLVED stamp with a check: the outcome. DotArt draws it `ghost` while a case is undecided.
  verdict: {
    lg(c) {
      c.fill(frameRect(3, 8, 55, 29, 2, 3), FULL);
      c.text("RESOLVED", 7, 13, FULL);
      c.fill(line([[25, 26], [29, 30], [37, 22]], 3), FULL);
    },
    sm(c) {
      c.fill(frameRect(3, 4, 26, 16, 1, 2), FULL);
      c.fill(line([[11, 12], [14.5, 15.5], [21, 8.5]], 2), FULL);
    },
  },

  // A balance: PayPal weighing the case.
  scales: {
    lg(c) {
      c.fill(ellipse(30, 40.5, 15, 1.8), FAINT);
      c.fill(poly([[23, 39], [37, 39], [34.5, 35], [25.5, 35]]), FULL); // base
      c.fill(rect(29, 11, 2, 25), FULL); // post
      c.fill(circle(30, 10, 2.5), FULL);
      c.fill(rect(10, 12, 40, 2), FULL); // beam
      for (const cx of [12, 48]) {
        c.fill(or(line([[cx, 14], [cx - 7, 27]], 1), line([[cx, 14], [cx + 7, 27]], 1)), SMALL);
        c.fill(and(ellipse(cx, 27, 9, 5.5), rect(cx - 9, 27, 18, 6)), FULL); // pan
      }
    },
    sm(c) {
      c.fill(rect(12, 20, 8, 2), FULL);
      c.fill(rect(15, 5, 2, 16), FULL);
      c.fill(rect(4, 6, 24, 1), FULL);
      for (const cx of [6, 26]) {
        c.fill(or(line([[cx, 7], [cx - 3.5, 13.5]], 1), line([[cx, 7], [cx + 3.5, 13.5]], 1)), SMALL);
        c.fill(and(ellipse(cx, 13.5, 5, 3.2), rect(cx - 5, 13.5, 10, 4)), FULL);
      }
    },
  },

  // A shield with a check: approval gates and guardrails.
  shield: {
    lg(c) {
      const top = quad([14, 9], [30, 2], [46, 9]);
      const right = quad([46, 22], [45.5, 34], [30, 41.5]);
      const left = quad([30, 41.5], [14.5, 34], [14, 22]);
      const outline = poly([...top, [46, 22], ...right, ...left]);
      c.fill(and(outline, rect(0, 0, 30, 45)), FULL);
      c.fill(and(outline, rect(30, 0, 30, 45)), SMALL);
      c.fill(line([[21, 22.5], [27, 28.5], [39, 15.5]], 3.6), PAPER);
    },
    sm(c) {
      const outline = poly([...quad([7, 4], [16, 0.5], [25, 4]), [25, 11], ...quad([25, 11], [24.5, 18], [16, 22.5]), ...quad([16, 22.5], [7.5, 18], [7, 11])]);
      c.fill(and(outline, rect(0, 0, 16, 24)), FULL);
      c.fill(and(outline, rect(16, 0, 16, 24)), SMALL);
      c.fill(line([[11, 11.5], [14.5, 15], [21, 8]], 2), PAPER);
    },
  },

  // Two speech bubbles: the buyer's message and the reply.
  bubble: {
    lg(c) {
      c.fill(frameRect(6, 7, 30, 20, 2, 4), FULL); // the message, outlined
      c.fill(poly([[10, 26], [8, 32], [17, 26]]), FULL);
      for (const [y, w] of [[12, 18], [15, 21], [18, 14]]) c.fill(rect(11, y, w, 1), FULL);
      c.fill(or(roundRect(20, 18, 36, 21, 5), poly([[42, 36], [51, 42.5], [49, 36]])), PAPER); // knockout
      c.fill(or(roundRect(22, 20, 32, 17, 4), poly([[44, 36], [50, 40.5], [48.5, 36]])), FULL); // the reply, solid
      for (const [y, w] of [[25, 20], [29, 14]]) c.fill(rect(27, y, w, 2), PAPER);
    },
    sm(c) {
      c.fill(frameRect(3, 3, 17, 11, 1, 2), FULL);
      c.fill(poly([[5, 13.5], [4, 17], [9, 13.5]]), FULL);
      c.fill(rect(6, 6, 10, 1), FULL);
      c.fill(rect(6, 9, 7, 1), FULL);
      c.fill(roundRect(11, 9, 19, 12, 3), PAPER);
      c.fill(or(roundRect(12, 10, 17, 10, 2), poly([[23, 19.5], [27, 22.5], [26, 19.5]])), FULL);
      c.fill(rect(15, 13, 11, 1), PAPER);
      c.fill(rect(15, 16, 7, 1), PAPER);
    },
  },

  // A terminal window: solid title bar with three buttons, a white screen, a prompt and its command in
  // full dots, the output in small dots, a block cursor. The screen stays white: a dark one prints as a
  // solid black block.
  terminal: {
    lg(c) {
      c.fill(roundRect(6, 7, 48, 31, 3), FULL); // the window
      c.fill(rect(8, 13, 44, 23), PAPER); // its screen, under the title bar
      for (const x of [11, 15, 19]) c.fill(rect(x, 9, 2, 2), PAPER); // window buttons
      c.fill(poly([[12, 16], [14.6, 16], [19, 20.5], [14.6, 25], [12, 25], [16.4, 20.5]]), FULL); // the prompt
      c.fill(rect(22, 20, 18, 2), FULL); // the command
      c.fill(rect(12, 29, 30, 1), SMALL); // its output
      c.fill(rect(12, 32, 22, 1), SMALL);
      c.fill(rect(36, 31, 3, 3), FULL); // the cursor
    },
    sm(c) {
      c.fill(roundRect(3, 3, 26, 18, 2), FULL);
      c.fill(rect(4, 6, 24, 14), PAPER);
      for (const x of [6, 8, 10]) c.dot(x, 4, PAPER);
      c.fill(poly([[6, 8], [7.6, 8], [10.4, 11], [7.6, 14], [6, 14], [8.8, 11]]), FULL);
      c.fill(rect(12, 10, 10, 2), FULL);
      c.fill(rect(6, 16, 15, 1), SMALL);
      c.fill(rect(22, 15, 2, 3), FULL);
    },
  },

  // A magnifier over a page: investigating the records.
  magnifier: {
    lg(c) {
      c.fill(frameRect(8, 5, 28, 36, 2), LARGE);
      for (const [y, w] of [[10, 14], [13, 18], [16, 12], [19, 16], [22, 10], [25, 15], [28, 12], [31, 16], [34, 9]]) c.fill(rect(12, y, w, 1), FULL);
      c.fill(circle(35, 24, 8), PAPER);
      c.fill(circle(35, 24, 8), RING);
      c.within(circle(35, 24, 7.5), () => {
        c.fill(rect(27, 19, 13, 2), FULL);
        c.fill(rect(27, 24, 9, 2), FULL);
      });
      c.fill(annulus(35, 24, 8, 11.5), FULL);
      c.fill(line([[43.5, 32.5], [51.5, 40]], 4.4), FULL);
    },
    sm(c) {
      c.fill(frameRect(4, 2, 15, 20, 1), LARGE);
      for (const [y, w] of [[5, 8], [7, 10], [9, 6], [11, 9], [13, 6], [15, 8], [17, 5]]) c.fill(rect(6, y, w, 1), FULL);
      c.fill(circle(19, 12, 4.5), PAPER);
      c.fill(circle(19, 12, 4.5), RING);
      c.fill(annulus(19, 12, 4.5, 6.6), FULL);
      c.fill(line([[23.5, 16.5], [27.5, 20.5]], 2.6), FULL);
    },
  },

  // A long receipt with a torn edge: the record of calls.
  receipt: {
    lg(c) {
      const teeth = [];
      for (let x = 44, k = 0; x >= 16; x -= 2, k++) teeth.push([x, k % 2 ? 41 : 39]);
      const paper = poly([[16, 4], [44, 4], ...teeth]);
      const inner = poly([[18, 6], [42, 6], ...teeth.map(([x, y]) => [Math.min(42, Math.max(18, x)), y - 2])]);
      c.fill(paper, FULL);
      c.fill(inner, PAPER);
      c.fill(rect(21, 9, 12, 2), FULL); // heading
      c.fill(rect(21, 12, 18, 1), SMALL);
      for (let k = 0; k < 5; k++) {
        c.fill(rect(21, 16 + 3 * k, 10 + ((k * 3) % 4), 1), SMALL); // items
        c.fill(rect(35, 16 + 3 * k, 4, 1), FULL); // amounts
      }
      for (let x = 21; x < 39; x += 2) c.dot(x, 31, FULL); // a dotted rule
      c.fill(rect(21, 33, 7, 2), FULL); // the total
      c.fill(rect(33, 33, 6, 2), FULL);
    },
    sm(c) {
      const teeth = [];
      for (let x = 22, k = 0; x >= 10; x -= 2, k++) teeth.push([x, k % 2 ? 22 : 21]);
      c.fill(poly([[10, 2], [22, 2], ...teeth]), FULL);
      c.fill(poly([[11, 3], [21, 3], ...teeth.map(([x, y]) => [Math.min(21, Math.max(11, x)), y - 1])]), PAPER);
      c.fill(rect(13, 5, 5, 1), FULL);
      for (let k = 0; k < 4; k++) {
        c.fill(rect(13, 8 + 2 * k, 4, 1), SMALL);
        c.fill(rect(18, 8 + 2 * k, 2, 1), FULL);
      }
      c.fill(rect(13, 17, 7, 1), FULL);
    },
  },
};

// ---------------------------------------------------------------- the wordmark

/**
 * "Exhibit" drawn on the grid: the logo's E (its arm pulled off the stem by one stem width, in gold) and
 * "xhibit" in a geometric dot face, all solid ink. `s` is the stem width in cells; every measure is a
 * rounded multiple of it. Returns the width used, in cells.
 */
function wordmark(c, s) {
  const r = (k) => Math.round(k * s);
  const H = 5 * s; // cap height: the E, the ascenders, the i dots
  const X = r(3.4); // x-height
  const base = c.rows;
  const top = base - H;
  const xt = base - X;
  const gap = r(0.8);
  const bowl = r(3.6); // width of h and b
  let x = 0;
  // E
  c.fill(rect(x, top, 5 * s, s), FULL);
  c.fill(rect(x, base - s, 5 * s, s), FULL);
  c.fill(rect(x, top, s, H), FULL);
  c.fill(rect(x + 2 * s, top + 2 * s, 3 * s, s), GOLD);
  x += 5 * s + gap;
  // x: two arms that step exactly one cell per row, a clean 45 degrees at every size (a stroked line
  // rounds to uneven steps and a blob where the arms cross). Each row of an arm is s + 1 cells, which
  // prints about as heavy as the stems.
  const t = s + 1;
  const xw = X - 1 + t;
  for (let j = 0; j < X; j++) {
    c.fill(rect(x + j, xt + j, t, 1), FULL);
    c.fill(rect(x + xw - t - j, xt + j, t, 1), FULL);
  }
  x += xw + gap;
  // h
  c.fill(rect(x, top, s, H), FULL);
  c.fill(minus(roundRect(x, xt, bowl, X + s, r(1.6)), roundRect(x + s, xt + s, bowl - 2 * s, X + s, r(0.6)), rect(x, base, bowl, 2 * s)), FULL);
  x += bowl + gap;
  // i
  c.fill(rect(x, xt, s, X), FULL);
  c.fill(rect(x, top, s, s), FULL);
  x += s + gap;
  // b
  c.fill(rect(x, top, s, H), FULL);
  c.fill(minus(roundRect(x, xt, bowl, X, r(1.6)), roundRect(x + s, xt + s, bowl - 2 * s, X - 2 * s, r(0.6))), FULL);
  x += bowl + gap;
  // i
  c.fill(rect(x, xt, s, X), FULL);
  c.fill(rect(x, top, s, s), FULL);
  x += s + gap;
  // t: stem, crossbar at the x-height, a foot turning right
  const arm = r(0.8);
  const foot = r(1.2);
  const tx = x + arm;
  c.fill(rect(tx, top + r(0.6), s, H - r(0.6) - s), FULL);
  c.fill(rect(x, xt, arm + s + foot, s), FULL);
  c.fill(and(roundRect(tx, base - 3 * s, s + foot, 3 * s, r(1.2)), rect(tx, base - s, s + foot, s)), FULL);
  c.fill(and(roundRect(tx, base - 3 * s, 3 * s, 3 * s, r(1.2)), rect(tx, base - 2 * s, s, 2 * s)), FULL);
  return x + arm + s + foot;
}

/** Wordmark grids are sized to the drawing: generate.mjs measures it with a dry run. */
export const WORDMARK = {
  fine: { s: 5, draw: wordmark },
  coarse: { s: 3, draw: wordmark },
};

