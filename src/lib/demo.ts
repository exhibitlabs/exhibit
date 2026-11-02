import "server-only";
import { anyRunning, runAgent } from "./agent/run";
import { requestDisputeAction, reviewPath } from "./approvals";
import { paypalMode } from "./config";
import { kvGet, kvSet, logActivity, now } from "./db";
import { demoProgress, type GuideProgress } from "./demo-progress";
import { actionsFor, cachedDisputes, latestBriefs, syncDisputes } from "./disputes";
import { seedDemo } from "./seed";
import { store } from "./store/repo";

/**
 * The self-healing demo. Demo mode only: sandbox data is never reset or touched here.
 *
 * - Every reset re-seeds the demo merchant relative to now, so deadlines are always fresh.
 * - After DEMO_IDLE_MINUTES without activity, the next visit resets first, so one visitor's "Fix all"
 *   never leaves the next an empty demo, and nobody is reset mid-session.
 * - A reset prepares briefs on most open cases from the recorded runs in replays/ (tools execute
 *   live, no delays) and leaves DEMO_UNRUN for the visitor to investigate.
 *
 * Activity means a person doing something: an interaction heartbeat from the app or a change
 * (a run, a filing, a fix). Background polling and uptime checks don't count.
 */

export const DEMO_IDLE_MINUTES = 20;
/** Left un-run after a reset, so a visitor can press Run Exhibit and watch the evidence graph work. */
export const DEMO_UNRUN = ["inr-delivered-signed", "unauth-friendly-fraud"] as const;

const IDLE_MS = DEMO_IDLE_MINUTES * 60_000;
const g = globalThis as typeof globalThis & { __exhibitDemoReset?: Promise<void> | null; __exhibitDemoTouched?: number };

export const isDemo = () => paypalMode() === "demo";

function lastActiveMs() {
  const at = kvGet<string | null>("demo_last_active", null) ?? kvGet<string | null>("seeded_at", null);
  return at ? Date.parse(at) : 0;
}

/** Records that a person is using the demo. Cheap and throttled; a no-op outside demo mode. */
export function touchDemo() {
  if (!isDemo()) return;
  const t = Date.now();
  if (g.__exhibitDemoTouched && t - g.__exhibitDemoTouched < 30_000) return;
  g.__exhibitDemoTouched = t;
  kvSet("demo_last_active", new Date(t).toISOString());
}

/**
 * Call before reading demo data (pages, UI routes). Seeds a first demo, or resets one that has been
 * idle, and waits for a reset already in progress. Never resets while an investigation is running.
 */
export async function demoReady(): Promise<void> {
  if (!isDemo()) return;
  if (g.__exhibitDemoReset) return g.__exhibitDemoReset;
  const seeded = kvGet<string | null>("seeded_at", null);
  if (seeded && (Date.now() - lastActiveMs() < IDLE_MS || anyRunning())) return;
  return resetDemo(seeded ? "idle" : "first");
}

const REASON = { manual: "from the app", idle: `after ${DEMO_IDLE_MINUTES}+ quiet minutes`, first: "on the first visit" } as const;

/** Re-seeds the demo merchant and prepares briefs. Concurrent calls share one reset. */
export function resetDemo(reason: keyof typeof REASON): Promise<void> {
  if (!isDemo()) return Promise.reject(new Error("Demo controls are only available in demo mode. Sandbox data is never reset."));
  if (g.__exhibitDemoReset) return g.__exhibitDemoReset;
  if (reason === "manual" && anyRunning()) return Promise.reject(new Error("Exhibit is still investigating a case. Try again when it finishes."));
  const work = (async () => {
    try {
      seedDemo();
      g.__exhibitDemoTouched = Date.now();
      kvSet("demo_last_active", now());
      kvSet("demo_reset_reason", reason);
      await syncDisputes();
      const todo = cachedDisputes()
        .filter((d) => d.status !== "RESOLVED")
        .map((d) => ({ id: d.dispute_id, key: store.scenario(d.dispute_id)?.key }))
        .filter((x) => x.key && !(DEMO_UNRUN as readonly string[]).includes(x.key));
      for (let i = 0; i < todo.length; i += 3) await Promise.all(todo.slice(i, i + 3).map((x) => runAgent(x.id, undefined, { trigger: "seed", fast: true })));
      const ready = latestBriefs().size;
      logActivity("system", `Demo reset ${REASON[reason]}: ${ready} briefs prepared from recorded runs (every tool call executed live), ${DEMO_UNRUN.length} cases left to investigate`);
    } finally {
      g.__exhibitDemoReset = null;
    }
  })();
  g.__exhibitDemoReset = work;
  return work;
}

export type DemoStatus = {
  mode: "demo" | "sandbox";
  seededAt: string | null;
  lastActiveAt: string | null;
  idleMinutes: number;
  /** When the demo resets if nobody uses it before then. */
  resetsAfter: string | null;
  progress: GuideProgress;
  /** The case the guide sends visitors to first (left un-run at reset). */
  guideCase: { id: string; buyer: string; reason: string } | null;
  pendingApprovals: number;
};

export function demoStatus(pendingApprovals = 0): DemoStatus {
  if (!isDemo()) return { mode: "sandbox", seededAt: null, lastActiveAt: null, idleMinutes: DEMO_IDLE_MINUTES, resetsAfter: null, progress: demoProgress(), guideCase: null, pendingApprovals };
  const seededAt = kvGet<string | null>("seeded_at", null);
  const last = lastActiveMs();
  const first = cachedDisputes().find((d) => store.scenario(d.dispute_id)?.key === DEMO_UNRUN[0]);
  return {
    mode: "demo",
    seededAt,
    lastActiveAt: last ? new Date(last).toISOString() : null,
    idleMinutes: DEMO_IDLE_MINUTES,
    resetsAfter: last ? new Date(last + IDLE_MS).toISOString() : null,
    progress: demoProgress(),
    guideCase: first ? { id: first.dispute_id, buyer: first.disputed_transactions[0]?.buyer?.name ?? "Buyer", reason: first.reason } : null,
    pendingApprovals,
  };
}

const ANSWERED = new Set(["provide_evidence", "provide_supporting_info", "accept_claim", "make_offer", "send_message", "refund_capture"]);

/**
 * Demo guide: stands in for an outside AI agent. It files the request through the same approvals
 * API the MCP server's request_dispute_action tool uses, labelled as a demo client. Nothing executes
 * until the visitor approves it.
 */
export function simulateAgentRequest() {
  if (!isDemo()) return { ok: false as const, status: 400, error: "Only the demo can simulate an agent." };
  const briefs = latestBriefs();
  const open = cachedDisputes().filter((d) => d.status === "WAITING_FOR_SELLER_RESPONSE" && briefs.has(d.dispute_id) && !actionsFor(d.dispute_id).some((a) => a.status === "ok" && ANSWERED.has(a.kind)));
  const rank = (id: string) => {
    const b = briefs.get(id)!;
    return (b.decision === "FIGHT" && b.paypal_action.type === "provide_evidence" ? 1000 : 0) + b.win_likelihood;
  };
  const pick = open.sort((a, b) => rank(b.dispute_id) - rank(a.dispute_id))[0];
  if (!pick) return { ok: false as const, status: 409, error: "Every open case is already answered. Reset the demo to try the approval flow again." };
  const r = requestDisputeAction(pick.dispute_id, "Demo MCP client", "Sent from the demo guide through POST /api/approvals, the same call the MCP server's request_dispute_action tool makes.");
  return r.ok ? { ok: true as const, approval: r.approval, reviewPath: reviewPath(r.approval) } : r;
}
