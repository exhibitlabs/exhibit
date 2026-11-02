import "server-only";
import { paypalMode } from "./config";
import { kvGet, kvSet } from "./db";

/**
 * The demo guide's checklist. Each step is marked by the code path that really does the work (an
 * investigation finishing, a filing PayPal accepted, a prevention fix), never by a click on the
 * guide itself. Progress lives in the demo database, so a demo reset clears it. Sandbox mode never
 * writes it.
 */
export const GUIDE_STEPS = ["run", "evidence", "file", "prevent", "ask", "approve"] as const;
export type GuideStep = (typeof GUIDE_STEPS)[number];
export type GuideProgress = Record<GuideStep, boolean>;

const KEY = "demo_progress";

export function demoProgress(): GuideProgress {
  const saved = paypalMode() === "demo" ? kvGet<Partial<GuideProgress>>(KEY, {}) : {};
  return Object.fromEntries(GUIDE_STEPS.map((s) => [s, !!saved[s]])) as GuideProgress;
}

export function markDemoProgress(...steps: GuideStep[]) {
  if (paypalMode() !== "demo" || !steps.length) return;
  const cur = kvGet<Partial<GuideProgress>>(KEY, {});
  if (steps.every((s) => cur[s])) return;
  kvSet(KEY, { ...cur, ...Object.fromEntries(steps.map((s) => [s, true])) });
}
