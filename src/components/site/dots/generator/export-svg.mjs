// Writes every dot piece and the wordmark as standalone SVG files, for READMEs, decks and the press kit.
//   node src/components/site/dots/generator/export-svg.mjs [out-dir]     (default docs/brand/dots)
// Two files per drawing: <name>-on-light.svg in ink (#0a0a0a) for light backgrounds and <name>-on-dark.svg
// in a light tone (#f2f2ef, the site's night text) for dark ones. The wordmark's arm stays gold (#e8a33d)
// on both. Same grids (../art-data.ts) and printer (../paint.ts) as the site, so the files match it dot for
// dot. Run it after generate.mjs whenever a drawing changes. Node 24 or later (it loads the .ts directly).
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Node warns that the .ts modules below have no "type" in a package.json; expected here, so keep it quiet.
const printers = process.listeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code !== "MODULE_TYPELESS_PACKAGE_JSON" && printers.forEach((p) => p(w)));

const { DOT_ART, DOT_WORDMARK } = await import("../art-data.ts");
const { dotSvg } = await import("../paint.ts");

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../../../../..");
const out = process.argv[2] || join(root, "docs/brand/dots");

const TONES = { "on-light": "#0a0a0a", "on-dark": "#f2f2ef" };
const GOLD = "#e8a33d";
/** Rendered size of one grid cell in the files' width and height (they scale freely: there is a viewBox). */
const CELL = 5;

const TITLES = {
  letter: "a letter in an open envelope",
  parcel: "a taped parcel",
  slip: "a signed delivery slip with a barcode",
  stamp: "a rubber stamp reading EXHIBIT A",
  verdict: "a stamp reading RESOLVED, with a check",
  scales: "a balance",
  shield: "a shield with a check",
  bubble: "two speech bubbles",
  terminal: "a terminal window with a prompt",
  magnifier: "a magnifier over a page",
  receipt: "a long torn receipt",
};

const drawings = [
  ...Object.entries(DOT_ART).map(([name, grid]) => ({ name, grid, title: `Exhibit dot art: ${TITLES[name] ?? name}` })),
  { name: "wordmark", grid: DOT_WORDMARK.fine, title: "Exhibit" },
  { name: "wordmark-small", grid: DOT_WORDMARK.coarse, title: "Exhibit" },
];

mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) if (f.endsWith(".svg")) rmSync(join(out, f)); // drop renamed pieces
for (const { name, grid, title } of drawings)
  for (const [tone, ink] of Object.entries(TONES)) {
    const id = `${name}-${tone}`.replace(/[^a-z0-9-]/g, "");
    const svg = dotSvg(grid, { ink, gold: GOLD, width: grid[0].length * CELL, title, id });
    writeFileSync(join(out, `${name}-${tone}.svg`), `${svg}\n`);
  }
console.log(`wrote ${drawings.length * 2} files to ${relative(process.cwd(), out) || "."}`);
