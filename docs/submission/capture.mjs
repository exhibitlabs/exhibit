#!/usr/bin/env node
// Devpost gallery images and thumbnail for Exhibit, captured from a running demo with headless Chrome.
//
//   npm run dev -- -p 3101                         # Exhibit in demo mode (no PayPal credentials)
//   node docs/submission/capture.mjs               # every gallery image, then the thumbnail
//   node docs/submission/capture.mjs proof ask     # only the named shots ("thumbnail" is one)
//   node docs/submission/capture.mjs --url /app/autopilot --out /tmp/autopilot.png   # any page, as is
//
// Environment: BASE (default http://localhost:3101), CHROME (default: Google Chrome on macOS) and
// OUT (default: this folder). No npm packages: it drives Chrome over the DevTools protocol with Node's
// built-in WebSocket (Node 22 or newer). Gallery images are 1440 x 900 CSS pixels at 2x (2880 x 1800);
// the thumbnail is 1500 x 1000 (3:2, Devpost's recommended ratio).
//
// It writes only to the demo merchant, and only what the guided demo does: if PP-D-50211 has no brief
// it runs the recorded agent on it, and it queues one pending agent request there. It never approves,
// files or refunds anything, and it refuses to run against a server in sandbox mode.

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
const ORDER_ID = "KA-10561"; // Lena Hoffmann: the prevention save shown on the landing page
const QUESTION = "Why are we losing item-not-received cases?";
// The note Claude attached to its request in the recorded MCP run (docs/MCP_DEMO.md).
const MCP_NOTE = 'Strongest open case: UPS delivered to the exact transaction address, signed by "M. HALE" with a front-door photo, and every Seller Protection check passes (88%, high confidence).';

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
  async page({ width = 1440, height = 900, scale = 2, storage = {}, reducedMotion = false } = {}) {
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
      el.scrollIntoView({ block: "center" });
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

/** Queues the same request Claude made over MCP in docs/MCP_DEMO.md. Executes nothing. */
async function ensureApproval(id) {
  await ensureBrief(id);
  const r = await api("/api/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "dispute_action", disputeId: id, client: "Claude Code", note: MCP_NOTE }) });
  return r.approval.id;
}

// ---------------------------------------------------------------------------------------------------
// The shots. Each opens a fresh page; `prepare` runs before the page opens, `ready` after it loads.

const GUIDE_MIN = { "exhibit:guide": "min" };

const SHOTS = [
  {
    name: "landing",
    file: "gallery-01-landing.png",
    url: "/",
    reducedMotion: true,
    ready: async (p) => {
      await p.waitForText("The dispute agent for PayPal merchants.");
      await sleep(800);
    },
  },
  {
    name: "proof",
    file: "gallery-02-proof.png",
    url: "/proof",
    ready: async (p) => {
      await p.waitForText("What Exhibit has done on the live PayPal sandbox.");
      // The totals, then the four chargebacks with what was filed and PayPal's status. The sticky nav is
      // made opaque so the scrolled-away heading doesn't show through its blur.
      await p.eval(`(() => {
        const s = document.createElement("style");
        s.textContent = "header.sticky { background: #fff !important; backdrop-filter: none !important; }";
        document.head.append(s);
        window.scrollTo(0, document.querySelector("main dl").getBoundingClientRect().top + scrollY - 100);
      })()`);
      await sleep(600);
    },
  },
  {
    name: "command-center",
    file: "gallery-03-command-center.png",
    url: "/app",
    storage: GUIDE_MIN,
    ready: async (p) => {
      await p.waitForText("recovered");
      await sleep(2500); // KPIs count up
    },
  },
  {
    name: "case",
    file: "gallery-04-case.png",
    url: `/app/disputes/${CASE_ID}`,
    storage: GUIDE_MIN,
    prepare: () => ensureBrief(CASE_ID),
    ready: async (p) => {
      await p.waitForText("Evidence graph");
      await p.waitForText("Response to PayPal");
      await sleep(1500);
      // The evidence graph at the top (below the compact sticky header), the brief and the cited letter below
      // it. Banners can still be loading above the graph, so scroll until its position holds. The sticky
      // header is made opaque so nothing scrolled under it shows through its blur.
      await p.eval(`(async () => {
        const s = document.createElement("style");
        s.textContent = "main header.sticky { background: #fff !important; backdrop-filter: none !important; }";
        document.head.append(s);
        const card = () => [...document.querySelectorAll("section.card")].find((s) => s.innerText.trim().startsWith("Evidence graph"));
        for (let i = 0, still = 0; i < 20 && still < 2; i++) {
          const off = card().getBoundingClientRect().top - 76;
          if (Math.abs(off) < 2) still++;
          else (still = 0), window.scrollBy({ top: off, behavior: "instant" });
          await new Promise((r) => setTimeout(r, 350));
        }
      })()`);
      await sleep(500);
    },
  },
  {
    name: "prevention",
    file: "gallery-05-prevention.png",
    url: `/app/protection?order=${ORDER_ID}`,
    storage: GUIDE_MIN,
    ready: async (p) => {
      await p.waitFor(`document.querySelector('[role="dialog"][aria-label="Order ${ORDER_ID}"]')`, { label: "the prevention drawer" });
      await sleep(1500);
    },
  },
  {
    name: "ask",
    file: "gallery-06-ask.png",
    url: `/app?ask=${encodeURIComponent(QUESTION)}`,
    storage: GUIDE_MIN,
    ready: async (p) => {
      await p.waitForText(QUESTION);
      await p.waitFor(`document.querySelector('[data-turn]') && !document.querySelector('[data-turn] [aria-busy="true"]')`, { label: "the answer" });
      await sleep(4000); // the answer streams in, then the chart draws
      // Headless focus counts as keyboard focus, which draws a heavy ring on the follow-up box.
      await p.eval("document.activeElement && document.activeElement.blur(), true");
      await sleep(300);
    },
  },
  {
    name: "approval",
    file: "gallery-07-agent-approval.png",
    url: (ctx) => `/app/disputes/${CASE_ID}?approval=${ctx.approvalId}`,
    storage: GUIDE_MIN,
    prepare: async (ctx) => {
      ctx.approvalId = await ensureApproval(CASE_ID);
    },
    ready: async (p) => {
      await p.waitForText("requests:");
      await sleep(1500);
    },
  },
  {
    name: "activity",
    file: "gallery-08-paypal-activity.png",
    url: "/app/activity",
    storage: GUIDE_MIN,
    ready: async (p) => {
      await p.waitForText("API surface");
      await sleep(1000);
      // A filing if the demo has one, otherwise the newest read of a dispute (rows are newest first).
      await p.click("ol > li > button", "/provide-evidence").catch(() => p.click("ol > li > button", "/v1/customer/disputes/"));
      await p.waitFor(`document.querySelector('[role="dialog"][aria-label="PayPal API call"]')`, { label: "the API inspector" });
      await sleep(1200);
    },
  },
  {
    name: "thumbnail",
    file: "thumbnail.png",
    url: "/",
    viewport: { width: 1500, height: 1000, scale: 1 },
    reducedMotion: true,
    ready: async (p) => {
      await p.waitForText("Real run");
      await sleep(800);
      await p.eval(`(${composeThumbnail.toString()})()`);
      await p.eval("document.fonts.ready.then(() => true)");
      await sleep(500);
    },
  },
];

/**
 * Runs in the page: lays the logo, the one-line pitch and the hero's evidence graph (a clone of the real
 * component, finished state) onto a 1500 x 1000 white card, so type and graph stay vector-sharp.
 */
function composeThumbnail() {
  const W = 1500;
  const H = 1000;
  const PAD = 80;
  const frame = document.querySelector(".lp-rise > div > div"); // the replay's frame, without its caption
  const width = frame.getBoundingClientRect().width;
  const scale = (W - 2 * PAD) / width;
  const graphBottom = 476; // px into the frame where the graph ends and the brief begins
  const top = H - graphBottom * scale;
  const stage = document.createElement("div");
  stage.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#fff;overflow:hidden;font-family:var(--font-sans);color:var(--ink)";
  stage.innerHTML = `
    <div style="position:absolute;left:${PAD}px;right:${PAD}px;top:60px;display:flex;align-items:center;justify-content:space-between">
      <div style="display:flex;align-items:center;gap:16px">
        <svg width="52" height="52" viewBox="0 0 48 48" aria-hidden="true"><rect width="48" height="48" rx="11" fill="#0a0a0a"/><path fill="#fff" d="M8 8h32v6H8zM8 34h32v6H8zM8 8h6v32H8z"/><path fill="#e8a33d" d="M20 21h20v6H20z"/></svg>
        <span style="font-size:38px;font-weight:600;letter-spacing:-0.045em;line-height:1">Exhibit</span>
      </div>
      <div style="display:flex;align-items:center;gap:10px;border:1px solid #e3e3e3;border-radius:999px;padding:10px 20px 10px 16px;font-size:20px;line-height:1;color:#3f3f3f">
        <span style="width:9px;height:9px;border-radius:50%;background:#15803d"></span>Tested live on the PayPal sandbox
      </div>
    </div>
    <h1 style="position:absolute;left:${PAD}px;top:146px;margin:0;font-size:84px;font-weight:600;letter-spacing:-0.045em;line-height:1">The dispute agent for<br>PayPal merchants.</h1>
    <p style="position:absolute;left:${PAD}px;top:${Math.round(top) - 82}px;margin:0;font-size:26px;line-height:1.3;color:#737373;letter-spacing:-0.01em">Investigates with Claude. Cites every claim. Files through PayPal's Disputes API.</p>
    <div style="position:absolute;left:${PAD}px;top:${top}px;width:${width}px;transform:scale(${scale});transform-origin:top left"></div>`;
  const clone = frame.cloneNode(true);
  clone.style.width = `${width}px`;
  stage.lastElementChild.append(clone);
  (document.querySelector(".lp-page") ?? document.body).append(stage);
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------------------------------------------

async function capture(browser, shot, ctx) {
  if (shot.prepare) await shot.prepare(ctx);
  const page = await browser.page({ ...shot.viewport, storage: shot.storage, reducedMotion: shot.reducedMotion });
  try {
    await page.goto(typeof shot.url === "function" ? shot.url(ctx) : shot.url);
    if (shot.ready) await shot.ready(page, ctx);
    const file = path.join(OUT, shot.file);
    await page.screenshot(file);
    console.log(`  ${path.relative(process.cwd(), file)}`);
  } finally {
    await page.close();
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const browser = await Browser.launch();
  try {
    const urlAt = argv.indexOf("--url");
    if (urlAt >= 0) {
      // Ad hoc: any page, as it loads, at the gallery size.
      const out = argv[argv.indexOf("--out") + 1] ?? path.join(OUT, "page.png");
      const page = await browser.page({ storage: GUIDE_MIN });
      await page.goto(argv[urlAt + 1]);
      await sleep(Number(process.env.SETTLE ?? 2500));
      await page.screenshot(out);
      console.log(out);
      return;
    }
    await requireDemoMode();
    mkdirSync(OUT, { recursive: true });
    const wanted = argv.filter((a) => !a.startsWith("-"));
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
