#!/usr/bin/env node
// Brand images for the READMEs and GitHub, made from real page parts with headless Chrome.
//
//   npm run dev -- -p 3101                 # any running Exhibit (demo mode is fine); nothing is written to it
//   node docs/brand/build.mjs              # every image below
//   node docs/brand/build.mjs hero org     # only the named groups: hero, social, org, avatar
//
// Writes to docs/brand/:
//   readme-hero-light.png, readme-hero-dark.png   2000 x 1000: the README banner (a 1000 x 500 layout at 2x)
//   social-preview.png                            1280 x 640: the repository's social preview
//   org-banner-light.png, org-banner-dark.png     2000 x 800: the organisation profile banner
//   org-avatar.png                                1024 x 1024: the organisation's profile picture
// and copies the organisation banners to ../exhibit-org-dotgithub/profile/assets/ next to the repository, when
// that folder exists (set ORG_DIR to use another one).
//
// Every image is laid out inside a page of the running site, so its type is the site's own Geist and its colours
// are the site's tokens. The parts are ones that don't change when the site's product pictures do: the logo
// (public/logo.svg), the headline, a painting from public/art/ credited from paintings.ts, the dot art from the
// site's generator (src/components/site/dots), and on the hero, the agent-requested filing from
// src/components/landing/records/proof.json. No number is typed here.
//
// Environment: BASE (default http://localhost:3101) and CHROME, as for docs/submission/capture.mjs, whose
// dependency-free Chrome client this reuses. Node 24 or newer (it loads the dot art's .ts files directly).

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Browser } from "../submission/capture.mjs";

// Node warns that the dot art's .ts modules have no "type" in a package.json; expected here, so keep it quiet.
const printers = process.listeners("warning");
process.removeAllListeners("warning");
process.on("warning", (w) => w.code !== "MODULE_TYPELESS_PACKAGE_JSON" && printers.forEach((p) => p(w)));
const { DOT_ART, DOT_WORDMARK } = await import("../../src/components/site/dots/art-data.ts");
const { dotSvg } = await import("../../src/components/site/dots/paint.ts");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const BASE = (process.env.BASE ?? "http://localhost:3101").replace(/\/$/, "");
const ORG_DIR = path.resolve(process.env.ORG_DIR ?? path.join(ROOT, "../exhibit-org-dotgithub"));
const read = (p) => readFileSync(path.join(ROOT, p), "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ parts

/** The site's colours (src/app/(site)/site.css) and GitHub's dark canvas, which the dark images sit on. */
const THEMES = {
  light: { bg: "#ffffff", ink: "#0a0a0a", dim: "#858583", muted: "#6b6b6b", dots: "#0a0a0a", plate: "#0a0a0a", letter: "#ffffff" },
  dark: { bg: "#0d1117", ink: "#f2f2ef", dim: "#8a8a85", muted: "#a8a8a3", dots: "#f2f2ef", plate: "#f2f2ef", letter: "#0a0a0a" },
};
const GOLD = "#e8a33d";
const HEADLINE = ["Disputes, answered with evidence.", "Refunds when the buyer is right."];
const EYEBROW = "The AI dispute agent for PayPal merchants";

/** The logo mark from public/logo.svg, recoloured for the theme (the inverse mark on dark, as LogoMark does). */
const LOGO = read("public/logo.svg");
function logo(size, t, { square = false } = {}) {
  return LOGO.replace("<svg ", `<svg width="${size}" height="${size}" aria-hidden="true" `)
    .replace(/\s*\n\s*/g, "")
    .replace('fill="#0a0a0a"', `fill="${t.plate}"`)
    .replace('fill="#ffffff"', `fill="${t.letter}"`)
    .replace(square ? / rx="\d+"/ : /$^/, "");
}

/** A painting's credit, from src/components/site/paintings.ts. */
function painting(id) {
  const src = read("src/components/site/paintings.ts");
  const at = src.indexOf(`  ${id}: {`);
  const block = src.slice(at, src.indexOf("\n  },", at));
  const field = (k) => block.match(new RegExp(`\\b${k}: "([^"]+)"`))?.[1];
  const p = { src: field("src"), title: field("title"), artist: field("artist"), date: field("date"), museum: field("museum"), license: field("license") };
  if (Object.values(p).some((v) => !v)) throw new Error(`Could not read painting "${id}" from paintings.ts`);
  return p;
}
const HARNETT = painting("harnett");
/** The homepage hero's crop of the same painting (src/components/site/home/Hero.tsx), and its focus. */
const HARNETT_HERO = { src: "/art/harnett-hero.webp", focus: "50% 32.5%" };

/** The filing an outside agent asked for and the merchant approved, from Exhibit's sandbox call log. */
function agentFiling() {
  const proof = JSON.parse(read("src/components/landing/records/proof.json"));
  const asked = proof.actions.find((a) => a.actor.startsWith("agent:"));
  const w = asked && proof.writes.find((x) => x.disputeId === asked.disputeId && x.status < 400 && Math.abs(Date.parse(x.at) - Date.parse(asked.at)) < 2000);
  if (!w) throw new Error("proof.json has no agent-requested filing");
  const d = new Date(w.at);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n) => String(n).padStart(2, "0");
  return {
    method: w.method,
    path: `…/disputes/${w.disputeId}/${w.path.split("/").pop()}`,
    status: w.status,
    debugId: w.debugId,
    ms: `${w.ms.toLocaleString("en-US")} ms`,
    when: `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`,
    agent: asked.actor.replace(/^agent:/, "").replace(/ approved by merchant$/, ""),
  };
}

const dots = (grid, ink, id) => dotSvg(grid, { ink, gold: GOLD, id }).replace("<svg ", '<svg width="100%" style="display:block" ');
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ------------------------------------------------------------------ layouts (CSS px; rendered at the scale given)

const stage = (w, h, t, inner) =>
  `<div data-stage style="position:fixed;left:0;top:0;width:${w}px;height:${h}px;overflow:hidden;background:${t.bg};color:${t.ink};font-family:var(--s-sans);-webkit-font-smoothing:antialiased;z-index:2147483647">${inner}</div>`;
const eyebrow = (t, left, top) =>
  `<p style="position:absolute;left:${left}px;top:${top}px;margin:0;display:flex;align-items:center;gap:10px;font-size:15px;line-height:1;color:${t.muted}"><span style="width:8px;height:8px;background:${GOLD}"></span>${EYEBROW}</p>`;
const credit = (p) => `${esc(p.artist)}, <i style="font-family:var(--s-serif);font-size:1.12em">${esc(p.title)}</i>, ${esc(p.date)}. ${esc(p.museum)}, ${esc(p.license)}.`;

/** The README hero: the site's hero in miniature, with the agent-requested sandbox filing on the plate. */
function hero(theme) {
  const t = THEMES[theme];
  const f = agentFiling();
  const label = (k, v) => `<span style="color:#6b6b6b">${k}<br><span style="font-family:var(--s-mono);font-size:15px;color:#0a0a0a">${v}</span></span>`;
  return stage(
    1000,
    500,
    t,
    `
    <div style="position:absolute;left:40px;top:38px;display:flex;align-items:center;gap:10px">${logo(28, t)}<span style="font-size:23px;font-weight:600;letter-spacing:-0.045em;line-height:1">Exhibit</span></div>
    <p style="position:absolute;right:40px;top:37px;margin:0;width:330px;text-align:right;font-size:12.5px;line-height:1.5;color:${t.muted}">${credit(HARNETT)}</p>
    ${eyebrow(t, 40, 104)}
    <h1 style="position:absolute;left:38px;top:132px;margin:0;font-size:52px;font-weight:500;letter-spacing:-0.04em;line-height:1.04">${HEADLINE[0]}<br><span style="color:${t.dim}">${HEADLINE[1]}</span></h1>
    <div style="position:absolute;left:24px;right:24px;top:282px;height:260px;border-radius:6px 6px 0 0;overflow:hidden;background:#9a7440">
      <img src="${HARNETT_HERO.src}" alt="" style="position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;object-position:${HARNETT_HERO.focus}">
      <div style="position:absolute;right:40px;top:30px;width:430px;padding:15px 18px 14px;border-radius:10px;background:#fff;color:#0a0a0a;font-size:12.5px;line-height:1.35;box-shadow:0 1px 2px rgb(0 0 0 / .14),0 14px 34px -10px rgb(30 20 8 / .55)">
        <div style="display:flex;justify-content:space-between;color:#6b6b6b"><span style="display:flex;align-items:center;gap:6px"><span style="width:6px;height:6px;border-radius:9px;background:#15803d"></span>PayPal sandbox · live API</span><span>${f.when}</span></div>
        <div style="margin-top:9px;font-family:var(--s-mono);font-size:11.5px;color:#2f2f2f;white-space:nowrap">${f.method} ${f.path}</div>
        <div style="margin-top:9px;display:flex;align-items:flex-end;gap:18px">
          <span style="font-family:var(--s-mono);font-size:46px;line-height:.9;letter-spacing:-0.04em;color:#15803d">${f.status}</span>
          ${label("PayPal-Debug-Id", f.debugId)}${label("Latency", f.ms)}
        </div>
        <div style="margin-top:11px;padding-top:9px;border-top:1px solid #ebebea;color:#474747">Approved by the merchant after ${esc(f.agent)} asked through MCP.</div>
      </div>
    </div>`,
  );
}

// The card pinned into Harnett's torn-card rectangle, with the painting's own corners laid back over it, as the
// site's closing plate does (src/components/site/home/Closing.tsx: the clip paths traced from the canvas and the
// card's place, here in fractions of the 2004 x 2400 painting).
const PIECES = [
  "polygon(53.51% 69.36%,60.76% 69.32%,60.52% 69.81%,60.20% 70.35%,59.98% 70.80%,59.72% 71.25%,59.61% 71.70%,59.55% 72.15%,59.13% 72.60%,58.69% 72.87%,58.26% 73.23%,57.94% 73.50%,57.62% 73.85%,57.35% 74.30%,56.87% 74.75%,56.43% 75.20%,56.00% 75.65%,55.57% 76.10%,55.14% 76.55%,54.71% 76.91%,54.28% 77.27%,53.85% 77.54%,53.58% 77.67%,53.51% 77.67%)",
  "polygon(80.11% 69.34%,83.22% 69.32%,83.28% 72.96%,82.96% 72.60%,82.63% 72.06%,82.31% 71.52%,82.04% 70.98%,81.83% 70.53%,81.45% 70.17%,80.91% 69.86%,80.37% 69.59%)",
  "polygon(55.20% 81.45%,55.74% 81.54%,56.17% 82.03%,56.54% 82.48%,56.81% 82.80%,56.81% 83.29%,56.76% 83.83%,56.92% 84.37%,57.19% 84.82%,57.37% 85.22%,56.81% 85.09%,55.52% 84.64%,54.23% 84.19%,53.85% 83.83%,54.23% 83.11%,54.77% 82.12%,55.09% 81.54%)",
  "polygon(83.22% 81.72%,83.35% 84.37%,79.46% 84.32%,79.89% 84.01%,80.43% 83.74%,80.97% 83.47%,81.40% 83.20%,81.93% 82.88%,82.37% 82.57%,82.69% 82.21%,82.96% 81.89%)",
];
const CARD = { x0: 0.5352, y0: 0.6932, x1: 0.8332, y1: 0.8439 };

/** The organisation banner: the dot wordmark and the headline, and the "EXHIBIT A" card pinned on Harnett's rack. */
function orgBanner(theme) {
  const t = THEMES[theme];
  const PW = 400;
  const PH = 352;
  const CW = 300; // plate size and the card's width on it
  const IW = CW / (CARD.x1 - CARD.x0);
  const IH = (IW * 2400) / 2004;
  const left = PW / 2 - ((CARD.x0 + CARD.x1) / 2) * IW;
  const top = PH / 2 - ((CARD.y0 + CARD.y1) / 2) * IH;
  const art = (clip) => `<img src="${HARNETT.src}" alt="" style="position:absolute;max-width:none;width:${IW}px;height:${IH}px;left:${left}px;top:${top}px${clip ? `;clip-path:${clip}` : ""}">`;
  const card = { l: left + CARD.x0 * IW, t: top + CARD.y0 * IH, w: (CARD.x1 - CARD.x0) * IW, h: (CARD.y1 - CARD.y0) * IH };
  return stage(
    1000,
    400,
    t,
    `
    <div style="position:absolute;left:40px;top:46px;width:430px">${dots(DOT_WORDMARK.fine, t.dots, `wm-${theme}`)}</div>
    ${eyebrow(t, 40, 158)}
    <h1 style="position:absolute;left:38px;top:186px;margin:0;font-size:40px;font-weight:500;letter-spacing:-0.04em;line-height:1.06">Disputes, answered<br>with evidence.<br><span style="color:${t.dim}">Refunds when the<br>buyer is right.</span></h1>
    <div style="position:absolute;right:24px;top:24px;width:${PW}px;height:${PH}px;border-radius:6px;overflow:hidden;background:#9a7440;isolation:isolate">
      ${art()}
      <div style="position:absolute;z-index:2;left:${card.l}px;top:${card.t}px;width:${card.w}px;height:${card.h}px;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:1px;box-shadow:0 0 0 1px rgb(60 35 8 / .1),2px 3px 5px rgb(60 35 8 / .22),8px 16px 28px -10px rgb(60 35 8 / .4)">
        <div style="width:${Math.round(card.w * 0.62)}px">${dots(DOT_ART.stamp, "#0a0a0a", `stamp-${theme}`)}</div>
      </div>
      ${PIECES.map((clip) => `<div style="position:absolute;inset:0;z-index:3;filter:drop-shadow(0 1px 1px rgb(50 28 6 / .35)) drop-shadow(1px 3px 4px rgb(50 28 6 / .22))">${art(clip)}</div>`).join("")}
    </div>`,
  );
}

/** The organisation's profile picture: the logo mark, full bleed (GitHub rounds the corners itself). */
const avatar = () => stage(1024, 1024, THEMES.light, logo(1024, THEMES.light, { square: true }));

// ------------------------------------------------------------------ rendering

/** Runs in the page: mounts the layout over the site page, inside an element carrying the site's classes. */
function mount(html) {
  const site = document.querySelector(".site");
  const style = document.createElement("style");
  style.textContent = "body > :not([data-brand-root]) { visibility: hidden !important; } nextjs-portal { display: none !important; }";
  document.head.append(style);
  const root = document.createElement("div");
  root.setAttribute("data-brand-root", "");
  root.className = site.className; // the site's tokens and the painting-title serif
  root.innerHTML = html;
  document.body.append(root);
  window.scrollTo(0, 0);
  return true;
}

/** Runs in the page: waits for every face the layout uses and every image, and reports anything missing. */
async function settle() {
  const root = document.querySelector("[data-brand-root]");
  const faces = new Set();
  for (const el of root.querySelectorAll("*")) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el);
    faces.add(`${cs.fontStyle} ${cs.fontWeight} 24px ${cs.fontFamily}`);
  }
  await Promise.all([...faces].map((f) => document.fonts.load(f)));
  await Promise.all([...root.querySelectorAll("img")].map((i) => i.decode().catch(() => null)));
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const loaded = [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/['"]/g, ""));
  return {
    geist: loaded.some((f) => /^Geist(?! Mono)/.test(f)),
    mono: !root.innerHTML.includes("--s-mono") || loaded.some((f) => /Geist Mono/.test(f)),
    missing: [...root.querySelectorAll("img")].filter((i) => !i.naturalWidth).map((i) => i.getAttribute("src")),
  };
}

async function render(browser, { file, html, width, height, scale }) {
  const page = await browser.page({ width, height, scale });
  try {
    await page.goto(`${BASE}/legal/terms`);
    await page.waitFor(`(() => { const n = document.querySelector(".site"); return !!n && Object.keys(n).some((k) => k.startsWith("__reactFiber")); })()`, { label: "the site page to hydrate", timeout: 60_000 });
    await sleep(400);
    await page.run(mount, html);
    const s = await page.run(settle);
    if (!s.geist || !s.mono) throw new Error(`${path.basename(file)}: the site's Geist fonts did not load`);
    if (s.missing.length) throw new Error(`${path.basename(file)}: images did not load: ${s.missing.join(", ")}`);
    await sleep(200);
    await page.screenshot(file);
    for (const e of new Set(page.errors)) console.warn(`    console error: ${e}`);
  } finally {
    await page.close();
  }
  const kb = Math.round(statSync(file).size / 1024);
  console.log(`  ${path.relative(process.cwd(), file)}  ${width * scale} x ${height * scale}  ${kb} KB${kb > 1000 ? "  (over 1 MB)" : ""}`);
}

const GROUPS = {
  hero: [
    { file: "readme-hero-light.png", html: () => hero("light"), width: 1000, height: 500, scale: 2 },
    { file: "readme-hero-dark.png", html: () => hero("dark"), width: 1000, height: 500, scale: 2 },
  ],
  social: [{ file: "social-preview.png", html: () => hero("light"), width: 1000, height: 500, scale: 1.28 }],
  org: [
    { file: "org-banner-light.png", html: () => orgBanner("light"), width: 1000, height: 400, scale: 2, org: "banner-light.png" },
    { file: "org-banner-dark.png", html: () => orgBanner("dark"), width: 1000, height: 400, scale: 2, org: "banner-dark.png" },
  ],
  avatar: [{ file: "org-avatar.png", html: avatar, width: 1024, height: 1024, scale: 1 }],
};

async function main() {
  const wanted = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const unknown = wanted.filter((w) => !(w in GROUPS));
  if (unknown.length) throw new Error(`Unknown group: ${unknown.join(", ")}. Groups: ${Object.keys(GROUPS).join(", ")}`);
  const groups = wanted.length ? wanted : Object.keys(GROUPS);
  const shots = groups.flatMap((g) => GROUPS[g]);
  const up = await fetch(`${BASE}/legal/terms`).catch(() => null);
  if (!up?.ok) throw new Error(`Exhibit is not reachable at ${BASE}. Start it with: npm run dev -- -p 3101 (or set BASE)`);
  console.log(`Rendering from ${BASE}`);
  const browser = await Browser.launch();
  try {
    for (const s of shots) await render(browser, { ...s, file: path.join(HERE, s.file), html: s.html() });
  } finally {
    await browser.close();
  }
  const assets = path.join(ORG_DIR, "profile", "assets");
  const orgShots = shots.filter((s) => s.org);
  if (orgShots.length && existsSync(path.join(ORG_DIR, "profile"))) {
    mkdirSync(assets, { recursive: true });
    for (const s of orgShots) copyFileSync(path.join(HERE, s.file), path.join(assets, s.org));
    console.log(`  copied the organisation banners to ${assets}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
