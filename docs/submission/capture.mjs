#!/usr/bin/env node
// Devpost gallery images and thumbnail for Exhibit, captured from a running demo with headless Chrome.
//
//   npm run dev -- -p 3101                               # Exhibit in demo mode (no PayPal credentials)
//   node docs/submission/capture.mjs                     # the eight gallery images, then the thumbnail
//   node docs/submission/capture.mjs landing thumbnail   # only the named shots
//   node docs/submission/capture.mjs --url /app/autopilot --out /tmp/autopilot.png   # any page, as it loads
//
// Shots, in gallery order: landing, proof, command-center, case, prevention, ask, approval, activity, and
// then thumbnail. Gallery images are 1440 x 900 CSS pixels at 2x (2880 x 1800 PNG); the thumbnail is
// 1500 x 1000 (3:2, Devpost's recommended ratio). Every page loads with reduced motion, so nothing is
// caught mid-animation, and console errors are printed under the shot they happened in.
//
// Environment: BASE (default http://localhost:3101), CHROME (default: Google Chrome on macOS) and OUT
// (default: this folder). No npm packages: it drives Chrome over the DevTools protocol with Node's
// built-in WebSocket (Node 22 or newer).
//
// The site shots hold on to stable hooks only (the hero section, its .s-plate or the .s-stage around it,
// #proof .s-board), never the inner markup of a product picture, so a redrawn picture is captured as it is.
// The thumbnail is laid out in the page from real parts: the nav's logo mark and its wordmark's weight and
// spacing, the hero's plate cloned whole (painting and product picture), the hero caption's painting credit and
// type set in the site's Geist, so every edge stays sharp. Home page shots wait for React to hydrate the page
// (the hero's FitBox sizes its picture then), which takes seconds on a dev server that has just started.
//
// It refuses a server in sandbox mode and writes only to the demo merchant, only what the guided demo
// does: if PP-D-50211 has no brief it runs the recorded agent on it, and for the approval shot it queues one
// agent request there, then rejects it with the app's own Reject button once the frame is taken (a request
// that was already pending is shown and left alone). It never approves, files, refunds or messages a buyer.

import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.BASE ?? "http://localhost:3101").replace(/\/$/, "");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = path.resolve(process.env.OUT ?? HERE);

const CASE_ID = "PP-D-50211"; // Megan Hale, item not received: the case the MCP transcript queued for approval
const ORDER_ID = "KA-10561"; // Lena Hoffmann: the German prevention save shown on the site
// One of the palette's suggested questions. Its answer, chart and follow-ups fit the palette at 1440 x 900.
const QUESTION = "What's our win rate by dispute reason?";
// The note Claude attached to its request in the recorded MCP run (docs/MCP_DEMO.md).
const MCP_NOTE = 'Strongest open case: UPS delivered to the exact transaction address, signed by "M. HALE" with a front-door photo, and every Seller Protection check passes (88%, high confidence).';
// The overview's demo-guide strip, dismissed as a visitor would dismiss it (it stays under Guide in the top bar).
const APP_STORAGE = { "exhibit:guide-strip": "hidden" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------------------------------
// A minimal DevTools protocol client: one WebSocket to the browser, one flat session per page.

class Browser {
  static async launch() {
    const profile = mkdtempSync(path.join(tmpdir(), "exhibit-capture-"));
    const args = ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--hide-scrollbars", "--mute-audio", "--force-color-profile=srgb", "--lang=en-US", "about:blank"];
    const proc = spawn(CHROME, args, { stdio: ["ignore", "ignore", "pipe"] });
    const url = await new Promise((resolve, reject) => {
      let log = "";
      const timer = setTimeout(() => reject(new Error(`Chrome did not start. Is CHROME right? (${CHROME})`)), 30_000);
      proc.stderr.on("data", (d) => {
        log += d;
        const m = log.match(/DevTools listening on (ws:\/\/\S+)/);
        if (m) {
          clearTimeout(timer);
          resolve(m[1]);
        }
      });
      proc.on("error", reject);
      proc.on("exit", (code) => reject(new Error(`Chrome exited with code ${code}`)));
    });
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error("Could not connect to Chrome")), { once: true });
    });
    return new Browser(proc, ws, profile);
  }

  constructor(proc, ws, profile) {
    this.proc = proc;
    this.ws = ws;
    this.profile = profile;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener("message", (e) => {
      const msg = JSON.parse(typeof e.data === "string" ? e.data : e.data.toString());
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else for (const l of this.listeners) l(msg);
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  once(method, sessionId, timeout = 60_000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeout);
      const listener = (m) => {
        if (m.method !== method || m.sessionId !== sessionId) return;
        clearTimeout(timer);
        this.listeners.delete(listener);
        resolve(m.params);
      };
      this.listeners.add(listener);
    });
  }

  /** A fresh page in its own browser context, so storage never leaks from one shot to the next. */
  async page({ width = 1440, height = 900, scale = 2, storage = {}, reducedMotion = true } = {}) {
    const { browserContextId } = await this.send("Target.createBrowserContext", { disposeOnDetach: true });
    const { targetId } = await this.send("Target.createTarget", { url: "about:blank", browserContextId });
    const { sessionId } = await this.send("Target.attachToTarget", { targetId, flatten: true });
    const page = new Page(this, sessionId, targetId, browserContextId);
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: scale, mobile: false });
    if (reducedMotion) await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    // Runs before the app's own scripts on every document: seed storage, hide the Next.js dev badge.
    const seed = Object.entries(storage)
      .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`)
      .join("");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try { ${seed} } catch {}
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = "nextjs-portal { display: none !important; }";
          document.head.append(s);
        });`,
    });
    return page;
  }

  async close() {
    try {
      await this.send("Browser.close");
    } catch {
      /* already gone */
    }
    this.proc.kill();
    await sleep(300);
    rmSync(this.profile, { recursive: true, force: true });
  }
}

class Page {
  constructor(browser, sessionId, targetId, contextId) {
    this.browser = browser;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.contextId = contextId;
    /** Console errors and uncaught exceptions on this page, printed after its shot. */
    this.errors = [];
    this.onEvent = (m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") this.errors.push(m.params.args.map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 400));
      else if (m.method === "Runtime.exceptionThrown") this.errors.push((m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 400));
    };
    browser.listeners.add(this.onEvent);
  }

  send(method, params) {
    return this.browser.send(method, params, this.sessionId);
  }

  async goto(url) {
    const loaded = this.browser.once("Page.loadEventFired", this.sessionId, 120_000);
    const r = await this.send("Page.navigate", { url: /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `${BASE}${url}` });
    if (r.errorText) throw new Error(`Could not open ${url}: ${r.errorText}. Is Exhibit running at ${BASE}?`);
    await loaded;
    await this.eval("document.fonts.ready.then(() => true)");
  }

  async eval(expression) {
    const r = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  }

  /** Runs a self-contained function in the page with JSON arguments and returns its (awaited) result. */
  run(fn, ...args) {
    return this.eval(`(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(", ")})`);
  }

  /** Polls a page expression until it is truthy. */
  async waitFor(expression, { timeout = 30_000, label = expression } = {}) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await this.eval(`!!(${expression})`).catch(() => false)) return;
      await sleep(150);
    }
    throw new Error(`Timed out waiting for: ${label}`);
  }

  waitForText(text, opts) {
    return this.waitFor(`document.body && document.body.innerText.includes(${JSON.stringify(text)})`, { label: `text "${text}"`, ...opts });
  }

  /** Clicks the first visible element matching `selector` whose text includes `text`. */
  async click(selector, text = "") {
    const ok = await this.eval(`(() => {
      const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((e) => e.offsetParent !== null && e.innerText.includes(${JSON.stringify(text)}));
      if (!el) return false;
      el.scrollIntoView({ block: "nearest" });
      el.click();
      return true;
    })()`);
    if (!ok) throw new Error(`Nothing to click: ${selector} "${text}"`);
  }

  async screenshot(file, clip) {
    const { data } = await this.send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 }, captureBeyondViewport: true } : {}) });
    writeFileSync(file, Buffer.from(data, "base64"));
  }

  async close() {
    this.browser.listeners.delete(this.onEvent);
    await this.browser.send("Target.closeTarget", { targetId: this.targetId }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------------------------------
// Demo preparation, through Exhibit's own API on the demo server.

async function api(pathname, init) {
  const r = await fetch(`${BASE}${pathname}`, init);
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${init?.method ?? "GET"} ${pathname}: ${r.status} ${body?.error ?? ""}`);
  return body;
}

async function requireDemoMode() {
  const status = await api("/api/status").catch((e) => {
    throw new Error(`Exhibit is not reachable at ${BASE} (${e.message}). Start it with: npm run dev -- -p 3101`);
  });
  if (status.paypalMode !== "demo") throw new Error(`${BASE} is in ${status.paypalMode} mode. Point BASE at a demo-mode server: this script writes to the demo merchant.`);
  return status;
}

/** Makes sure the case has a finished brief, running the agent (recorded runs in demo mode) if not. */
async function ensureBrief(id) {
  const state = await api(`/api/disputes/${id}/state`);
  if (state.run?.status === "done" && state.run.brief) return;
  console.log(`  ${id} has no brief yet: running the agent on it (recorded run, about 30 s)`);
  const r = await fetch(`${BASE}/api/disputes/${id}/run`, { method: "POST" });
  if (!r.ok || !r.body) throw new Error(`Could not start a run on ${id}: ${r.status}`);
  // Drain the event stream; it closes when the run ends.
  const reader = r.body.getReader();
  while (!(await reader.read()).done);
  const after = await api(`/api/disputes/${id}/state`);
  if (after.run?.status !== "done") throw new Error(`The run on ${id} did not finish (${after.run?.status ?? "no run"})`);
}

/**
 * Queues the same request Claude made over MCP in docs/MCP_DEMO.md. Executes nothing. If the case already
 * has a pending request, that one is shown instead, and left alone afterwards: it isn't ours to reject.
 */
async function ensureApproval(id) {
  await ensureBrief(id);
  const r = await api("/api/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "dispute_action", disputeId: id, client: "Claude Code", note: MCP_NOTE }) });
  if (r.existing) console.log(`  ${id} already has a pending agent request (${r.approval.id}): showing it, leaving it pending`);
  return { id: r.approval.id, created: !r.existing };
}

const isPending = async (id) => (await api(`/api/approvals?status=pending&target=${CASE_ID}`)).approvals.some((a) => a.id === id);

/** Leaves the demo as it was: rejects the request this run queued, with the case page's own Reject button. */
async function rejectInApp(page, ctx) {
  if (!ctx.approvalId || !ctx.approvalCreated || !(await isPending(ctx.approvalId))) return;
  const banner = `document.querySelector('section[aria-label="Agent request"]')`;
  if (!(await page.eval(`!!${banner}`).catch(() => false))) await page.goto(`/app/disputes/${CASE_ID}`);
  await page.waitFor(banner, { label: "the agent request on the case page" });
  await page.click('section[aria-label="Agent request"] button', "Reject");
  await page.waitFor(`!${banner}`, { label: "the agent request to close" });
  if (await isPending(ctx.approvalId)) throw new Error(`Agent request ${ctx.approvalId} is still pending. Reject it in the app under Agent requests.`);
  console.log(`  rejected the agent request in the app (${ctx.approvalId}); nothing was sent to PayPal`);
}

/** App frames: no focus ring from headless focus, no toast left over from the work behind the shot. */
async function settle(page) {
  await page.eval("document.activeElement && document.activeElement.blur && document.activeElement.blur(), true");
  await page.waitFor(`!document.querySelector('[aria-live="polite"] > [role="status"]')`, { timeout: 12_000, label: "toasts to clear" }).catch(() => console.warn("    a toast is still showing"));
  await sleep(300);
}

// ---------------------------------------------------------------------------------------------------
// Framing, run inside the page. Each function is self-contained (it is sent to the page as source).

/** Homepage proof: the evidence board alone (totals, every call as a dot, every filing, the failures). */
async function frameProofBoard() {
  // The sticky nav is hidden so the frame can open on the board instead of on a nav over a cut heading.
  const s = document.createElement("style");
  s.textContent = "header.s-nav { visibility: hidden !important; }";
  document.head.append(s);
  const board = document.querySelector("#proof .s-board");
  window.scrollTo(0, Math.round(board.getBoundingClientRect().top + scrollY - 36));
  await new Promise((r) => setTimeout(r, 500));
  // The first row of panels under the dot strip (filings and failures) should end inside the frame.
  const grid = board.querySelector(".s-board__grid");
  return grid ? Math.round(grid.getBoundingClientRect().bottom) : null;
}

/** Case page: the evidence graph right under the compact sticky header, the brief and the letter below. */
async function frameCase() {
  const graph = () => [...document.querySelectorAll("main section")].find((s) => s.innerText.trim().startsWith("Evidence graph"));
  const head = () => [...document.querySelectorAll("main header")].find((h) => getComputedStyle(h).position === "sticky");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  // Past the title first, so the header compacts (it stays compact on the way back), then the graph under it.
  window.scrollTo(0, Math.round(graph().getBoundingClientRect().top + scrollY - 100));
  await wait(500);
  for (let i = 0, still = 0; i < 24 && still < 2; i++) {
    const off = graph().getBoundingClientRect().top - ((head()?.getBoundingClientRect().bottom ?? 48) + 16);
    if (Math.abs(off) < 2) {
      still++;
    } else {
      still = 0;
      window.scrollBy({ top: off, behavior: "instant" });
    }
    await wait(350);
  }
}

/**
 * Prevention drawer: the German reply and its send button with the caption under it all in frame, and no
 * line of text left half under the drawer's sticky header or across the frame's bottom edge.
 */
async function frameDrawer(label) {
  const d = document.querySelector(`[role="dialog"][aria-label="${label}"]`);
  const head = d.querySelector("header");
  const send = [...d.querySelectorAll("button")].filter((b) => /Message buyer/.test(b.innerText)).pop();
  if (!send) return "no send button";
  const end = (send.nextElementSibling ?? send).getBoundingClientRect().bottom;
  const top = head ? head.getBoundingClientRect().bottom : 0;
  const H = innerHeight;
  const boxes = [...d.querySelectorAll("*")]
    .filter((e) => !(head && head.contains(e)) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.height > 0);
  const cut = (s) => boxes.some((r) => (r.top - s < top + 4 && r.bottom - s > top) || (r.top - s < H && r.bottom - s > H));
  const from = Math.max(0, Math.ceil(end - (H - 12)));
  let s = from;
  while (s < from + 160 && cut(s)) s++;
  d.scrollTop += s;
  await new Promise((r) => setTimeout(r, 400));
  return cut(0) && s === from + 160 ? "no clean framing found" : null;
}

/**
 * The thumbnail, laid out in the page so type and picture stay sharp: the logo and name, one line saying
 * what Exhibit is, and the homepage hero's plate (Harnett's letter rack with the product picture tucked into
 * it), cloned whole and running off the bottom edge as it runs below the fold on the site. The painting is
 * credited with the hero caption's own credit line, as the site credits every plate.
 */
function composeThumbnail() {
  const W = 1500;
  const H = 1000;
  const M = 40; // the plate's side margin, as on the site's wide container
  const PLATE_TOP = 392;
  const hero = (document.getElementById("hero-title") ?? document.querySelector("main h1")).closest("section");
  // The painting and its product picture: the .s-plate itself, or the .s-stage holding it with its overlays.
  const plate = hero.querySelector(".s-plate").closest(".s-stage") ?? hero.querySelector(".s-plate");
  const box = plate.getBoundingClientRect();
  const scale = (W - 2 * M) / box.width;
  const mark = document.querySelector("header .s-brand svg")?.cloneNode(true);
  // The wordmark is set in the nav's weight and letter spacing, scaled up with it.
  const word = document.querySelector("header .s-brand__word");
  const ws = word ? getComputedStyle(word) : null;
  const weight = ws?.fontWeight ?? "600";
  const tracking = ws ? `${(parseFloat(ws.letterSpacing) / parseFloat(ws.fontSize)).toFixed(3)}em` : "-0.045em";
  const credit = hero.querySelector(".s-cap__art")?.cloneNode(true);
  const stage = document.createElement("div");
  stage.setAttribute("data-thumbnail", "");
  stage.className = document.querySelector(".site")?.className ?? "site"; // the site's tokens and fonts
  stage.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;z-index:2147483647;background:#fff;overflow:hidden;font-family:var(--s-sans);color:var(--s-ink);-webkit-font-smoothing:antialiased`;
  stage.innerHTML = `
    <div data-brand style="position:absolute;left:80px;top:70px;display:flex;align-items:center;gap:18px">
      <span style="font-size:68px;font-weight:${weight};letter-spacing:${tracking};line-height:1">Exhibit</span>
    </div>
    <p style="position:absolute;left:80px;top:180px;margin:0;font-size:88px;font-weight:500;letter-spacing:-0.045em;line-height:1">The AI dispute agent<br><span style="color:var(--s-dim)">for PayPal merchants.</span></p>
    <div data-plate style="position:absolute;left:${M}px;top:${PLATE_TOP}px;width:${box.width}px;height:${box.height}px;transform:scale(${scale});transform-origin:0 0"></div>`;
  if (mark) {
    mark.style.cssText = "display:block;flex:none;width:68px;height:68px"; // over the nav's own size for it
    stage.querySelector("[data-brand]").prepend(mark);
  }
  if (credit) {
    credit.style.cssText = `position:absolute;right:${M + 40}px;top:86px;width:430px;margin:0;text-align:right;font-size:16px;line-height:1.55;color:var(--s-muted)`;
    stage.append(credit);
  }
  const clone = plate.cloneNode(true);
  clone.style.width = `${box.width}px`;
  clone.style.height = `${box.height}px`;
  clone.style.margin = "0";
  stage.querySelector("[data-plate]").append(clone);
  // Outside React's tree: React skips unexpected children of <body>, but a node added inside the tree before
  // hydration ends fails it, and React throws the node away.
  document.body.append(stage);
  window.scrollTo(0, 0);
  return { plate: [Math.round(box.width), Math.round(box.height)], scale: Number(scale.toFixed(3)), mark: !!mark };
}

/** Homepage hero ready: heading, painting decoded, product picture laid out (on the plate or its stage). */
async function heroReady(p) {
  const hero = `(document.getElementById("hero-title") ?? document.querySelector("main h1")).closest("section")`;
  await p.waitFor(`document.getElementById("hero-title") ?? document.querySelector("main h1")`, { label: "the hero heading" });
  await p.waitFor(
    `(() => { const plate = ${hero}.querySelector(".s-plate"); const img = plate && plate.querySelector("img"); const block = plate && (plate.closest(".s-stage") ?? plate); return img && img.complete && img.naturalWidth > 0 && block.children.length > 1; })()`,
    { label: "the hero plate (painting and product picture)" },
  );
  // A FitBox sizes its product picture once React has hydrated the page, by setting --fit.
  await p.waitFor(`[...${hero}.querySelectorAll(".s-fit")].every((el) => el.style.getPropertyValue("--fit"))`, { label: "the product picture sized to its plate (hydration)", timeout: 60_000 });
  await sleep(1200); // the sized picture settles
}

// ---------------------------------------------------------------------------------------------------
// The shots. Each opens a fresh page; `prepare` runs before the page opens, `ready` after it loads and
// `cleanup` after the frame is written (or the shot failed).

const SHOTS = [
  {
    name: "landing",
    file: "gallery-01-landing.png",
    url: "/",
    ready: heroReady,
  },
  {
    name: "proof",
    file: "gallery-02-proof.png",
    url: "/",
    ready: async (p) => {
      await p.waitFor(`document.querySelector("#proof .s-board")`, { label: "the proof board" });
      await sleep(600);
      const bottom = await p.run(frameProofBoard);
      if (bottom > 900 - 8) console.warn(`    the proof board's filings and failures end at ${bottom}px, past the frame`);
    },
  },
  {
    name: "command-center",
    file: "gallery-03-command-center.png",
    url: "/app",
    storage: APP_STORAGE,
    ready: async (p) => {
      await p.waitFor(`document.querySelector("main h1") && document.querySelector("main h1").innerText.includes("recovered")`, { label: "the command center" });
      await sleep(2500); // charts and figures settle
      await settle(p);
    },
  },
  {
    name: "case",
    file: "gallery-04-case.png",
    url: `/app/disputes/${CASE_ID}`,
    storage: APP_STORAGE,
    prepare: () => ensureBrief(CASE_ID),
    ready: async (p) => {
      await p.waitForText("Evidence graph");
      await p.waitForText("Response to PayPal");
      await sleep(1500);
      await p.run(frameCase);
      await settle(p);
    },
  },
  {
    name: "prevention",
    file: "gallery-05-prevention.png",
    url: `/app/protection?order=${ORDER_ID}`,
    storage: APP_STORAGE,
    ready: async (p) => {
      await p.waitFor(`document.querySelector('[role="dialog"][aria-label="Order ${ORDER_ID}"]')`, { label: "the prevention drawer" });
      await sleep(1500);
      const problem = await p.run(frameDrawer, `Order ${ORDER_ID}`);
      if (problem) console.warn(`    prevention drawer: ${problem}`);
      await settle(p);
    },
  },
  {
    name: "ask",
    file: "gallery-06-ask.png",
    url: `/app?ask=${encodeURIComponent(QUESTION)}`,
    storage: APP_STORAGE,
    ready: async (p) => {
      await p.waitForText(QUESTION);
      // The answer is done when the palette's input offers a follow-up again.
      await p.waitFor(`document.querySelector('[role="dialog"][aria-label="Ask Exhibit"] [data-turn] svg') && document.querySelector('input[aria-label="Ask a follow-up"]')?.placeholder === "Ask a follow-up…"`, { label: "the answer and its chart", timeout: 60_000 });
      await sleep(1500);
      await settle(p);
    },
  },
  {
    name: "approval",
    file: "gallery-07-agent-approval.png",
    url: (ctx) => `/app/disputes/${CASE_ID}?approval=${ctx.approvalId}`,
    storage: APP_STORAGE,
    prepare: async (ctx) => {
      ({ id: ctx.approvalId, created: ctx.approvalCreated } = await ensureApproval(CASE_ID));
    },
    ready: async (p) => {
      await p.waitFor(`document.querySelector('section[aria-label="Agent request"]')`, { label: "the agent request on the case page" });
      await sleep(1500);
      await settle(p);
    },
    cleanup: rejectInApp,
  },
  {
    name: "activity",
    file: "gallery-08-paypal-activity.png",
    url: "/app/activity",
    storage: APP_STORAGE,
    ready: async (p) => {
      await p.waitForText("API surface");
      await sleep(1000);
      // A filing if the demo has one, otherwise the newest read of a dispute (rows are newest first).
      await p.click("ol > li > button", "/provide-evidence").catch(() => p.click("ol > li > button", "/v1/customer/disputes/"));
      await p.waitFor(`document.querySelector('[role="dialog"][aria-label="PayPal API call"]')`, { label: "the API inspector" });
      await sleep(1200);
      await settle(p);
    },
  },
  {
    name: "thumbnail",
    file: "thumbnail.png",
    url: "/",
    viewport: { width: 1500, height: 1000, scale: 1 },
    ready: async (p) => {
      await heroReady(p);
      await p.run(composeThumbnail);
      await p.eval("document.fonts.ready.then(() => true)");
      await sleep(600);
    },
  },
];

// ---------------------------------------------------------------------------------------------------

async function capture(browser, shot, ctx) {
  if (shot.prepare) await shot.prepare(ctx);
  const page = await browser.page({ ...shot.viewport, storage: shot.storage });
  try {
    await page.goto(typeof shot.url === "function" ? shot.url(ctx) : shot.url);
    if (shot.ready) await shot.ready(page, ctx);
    const file = path.join(OUT, shot.file);
    await page.screenshot(file);
    console.log(`  ${path.relative(process.cwd(), file)}`);
  } finally {
    try {
      if (shot.cleanup) await shot.cleanup(page, ctx);
    } finally {
      for (const e of new Set(page.errors)) console.warn(`    console error on ${shot.name}: ${e}`);
      await page.close();
    }
  }
}

async function main() {
  const argv = process.argv.slice(2);
  await requireDemoMode();
  const browser = await Browser.launch();
  try {
    const urlAt = argv.indexOf("--url");
    if (urlAt >= 0) {
      // Ad hoc: any page, as it loads, at the gallery size.
      const outAt = argv.indexOf("--out");
      const out = outAt >= 0 ? path.resolve(argv[outAt + 1]) : path.join(OUT, "page.png");
      const page = await browser.page({ storage: APP_STORAGE });
      await page.goto(argv[urlAt + 1]);
      await sleep(Number(process.env.SETTLE ?? 2500));
      await page.screenshot(out);
      console.log(out);
      for (const e of new Set(page.errors)) console.warn(`  console error: ${e}`);
      return;
    }
    const wanted = argv.filter((a) => !a.startsWith("-"));
    const unknown = wanted.filter((w) => !SHOTS.some((s) => s.name === w));
    if (unknown.length) throw new Error(`Unknown shot: ${unknown.join(", ")}. Shots: ${SHOTS.map((s) => s.name).join(", ")}`);
    mkdirSync(OUT, { recursive: true });
    const ctx = {};
    console.log(`Capturing from ${BASE}`);
    for (const shot of SHOTS) if (!wanted.length || wanted.includes(shot.name)) await capture(browser, shot, ctx);
  } finally {
    await browser.close();
  }
}

export { Browser };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
