#!/usr/bin/env node
// Builds the marketing website and docs as static files for Cloudflare (Workers static assets), without the app.
//
//   node scripts/build-site.mjs            # build into .next-site, assemble deploy/site/dist
//   npx wrangler deploy --config deploy/site/wrangler.jsonc
//
// The build runs with NEXT_PUBLIC_EXHIBIT_SITE_ONLY=1, so images are served unoptimized (there is no server), and
// with NEXT_PUBLIC_EXHIBIT_DEMO_URL, the hosted demo (render.yaml): "Try the live demo", Sign in and /app go there.
// It defaults to HOSTED_DEMO_URL in src/components/landing/data.ts. Set it to another address, or to nothing for a
// site without a demo: then "Book a demo" leads, Sign in is hidden and /app goes to /contact.
//
// Every site page is prerendered, so the output is the
// prerendered HTML, the hashed assets in /_next/static, /public and the static metadata files (sitemap, robots,
// Open Graph images, the docs search index). /app, /api and /pitch are left out; the site's Worker
// (deploy/site/worker.ts) answers the one dynamic route, POST /api/contact.
//
// The contact form's Turnstile widget gets the site's public site key. To try the built site locally with
// `wrangler dev`, build with Cloudflare's test key instead: NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA.
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "0x4AAAAAAFygUWhy3fgpVlKC";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const HOSTED_DEMO_URL = readFileSync(path.join(ROOT, "src/components/landing/data.ts"), "utf8").match(/HOSTED_DEMO_URL = "([^"]+)"/)?.[1];
if (!HOSTED_DEMO_URL) throw new Error("No HOSTED_DEMO_URL in src/components/landing/data.ts");
const DEMO_URL = process.env.NEXT_PUBLIC_EXHIBIT_DEMO_URL ?? HOSTED_DEMO_URL;
const BUILD = path.join(ROOT, ".next-site");
const OUT = path.join(ROOT, "deploy/site/dist");
const SKIP = [/^app(\/|\.|$)/, /^api(\/|$)/, /^pitch(\/|\.|$)/, /^_global-error/];

if (!process.argv.includes("--no-build")) {
  rmSync(BUILD, { recursive: true, force: true });
  execFileSync("npx", ["next", "build"], {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_EXHIBIT_SITE_ONLY: "1", NEXT_PUBLIC_EXHIBIT_DEMO_URL: DEMO_URL, NEXT_PUBLIC_TURNSTILE_SITE_KEY: TURNSTILE_SITE_KEY, EXHIBIT_DIST_DIR: ".next-site", EXHIBIT_PAYPAL_MODE: "demo", EXHIBIT_AI_PROVIDER: "replay", NEXT_TELEMETRY_DISABLED: "1" },
  });
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const walk = (dir, base = dir) => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? walk(path.join(dir, f), base) : [path.relative(base, path.join(dir, f))]));
const appDir = path.join(BUILD, "server/app");
let pages = 0;
let files = 0;
for (const rel of walk(appDir)) {
  if (SKIP.some((re) => re.test(rel))) continue;
  let dest = null;
  if (rel === "_not-found.html") dest = "404.html";
  else if (rel.endsWith(".html")) dest = rel;
  else if (rel.endsWith(".body")) dest = rel.slice(0, -".body".length); // static route handlers and metadata images
  if (!dest) continue;
  mkdirSync(path.dirname(path.join(OUT, dest)), { recursive: true });
  cpSync(path.join(appDir, rel), path.join(OUT, dest));
  if (dest.endsWith(".html")) pages++;
  else files++;
}
cpSync(path.join(BUILD, "static"), path.join(OUT, "_next/static"), { recursive: true });
cpSync(path.join(ROOT, "public"), OUT, { recursive: true });

writeFileSync(
  path.join(OUT, "_headers"),
  `/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
/art/*
  Cache-Control: public, max-age=2592000
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
`,
);
// The app isn't on the static site. Its addresses go to the hosted demo, page for page, or without one to the page
// where a demo can be booked.
const app = DEMO_URL.replace(/\/+$/, "");
writeFileSync(path.join(OUT, "_redirects"), DEMO_URL ? `/app ${app} 302\n/app/* ${app}/:splat 302\n` : "/app /contact 302\n/app/* /contact 302\n");

for (const must of ["index.html", "404.html", "proof.html", "docs.html", "sitemap.xml", "robots.txt"]) {
  if (!existsSync(path.join(OUT, must))) throw new Error(`Missing ${must} in ${OUT}`);
}
console.log(`Static site: ${pages} pages and ${files} other files in ${path.relative(ROOT, OUT)}`);
console.log(DEMO_URL ? `Live demo: ${DEMO_URL}` : "Live demo: none, so the site leads with Book a demo");
// Cloudflare's test site keys start with 1x, 2x or 3x. The live secret rejects their tokens, so such a build
// would refuse every contact message if it were deployed.
if (!process.argv.includes("--no-build")) {
  if (/^[123]x/.test(TURNSTILE_SITE_KEY)) console.warn(`Turnstile: TEST site key ${TURNSTILE_SITE_KEY}. For local testing only; don't deploy this build.`);
  else console.log(`Turnstile: site key ${TURNSTILE_SITE_KEY}`);
}
