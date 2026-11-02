import "server-only";
import { paypalMode } from "./config";
import { listActivity, type ActivityRow } from "./db";

/** Who did it. Agent = Exhibit itself or an outside AI agent; merchant = a person in the app. */
export type Lane = "api" | "agent" | "merchant" | "webhook" | "system";

export type ApiInfo = { method: string; path: string; endpoint: string; status: number; ms: number; debugId?: string; requestId?: string };

export type TimelineItem = {
  id: number;
  at: string;
  kind: string;
  lane: Lane;
  actor: string;
  title: string;
  disputeId: string | null;
  orderId: string | null;
  error: boolean;
  api?: ApiInfo;
};

/** /v1/customer/disputes/PP-D-50211/provide-evidence → /v1/customer/disputes/{id}/provide-evidence */
export function endpointOf(path: string) {
  return path
    .replace(/\?.*$/, "")
    .replace(/\/disputes\/[^/]+/, (m) => (m === "/disputes/" ? m : "/disputes/{id}"))
    .replace(/\/orders\/[^/]+/, "/orders/{id}")
    .replace(/\/captures\/[^/]+/, "/captures/{id}");
}

function actorOf(meta: Record<string, unknown> | null) {
  const a = typeof meta?.actor === "string" ? meta.actor : null;
  if (!a) return null;
  if (a === "merchant") return { lane: "merchant" as const, actor: "Merchant" };
  if (a === "autopilot") return { lane: "agent" as const, actor: "Autopilot" };
  const m = /^agent:(.+) approved by merchant$/.exec(a);
  if (m) return { lane: "merchant" as const, actor: `${m[1]}, approved by merchant` };
  return { lane: "agent" as const, actor: a };
}

function toItem(r: ActivityRow): TimelineItem {
  const meta = (r.meta && typeof r.meta === "object" ? r.meta : null) as Record<string, unknown> | null;
  const orderId = typeof meta?.orderId === "string" ? meta.orderId : null;
  const base = { id: r.id, at: r.at, kind: r.kind, disputeId: r.dispute_id, orderId, error: r.kind.endsWith("_error") };
  if (r.kind === "api") {
    const m = meta as unknown as { method: string; path: string; status: number; ms: number; debugId?: string; requestId?: string };
    return { ...base, lane: "api", actor: paypalMode() === "demo" ? "PayPal simulator" : "PayPal sandbox", title: `${m.method} ${endpointOf(m.path)}`, error: m.status >= 400, api: { method: m.method, path: m.path, endpoint: endpointOf(m.path), status: m.status, ms: m.ms, debugId: m.debugId, requestId: m.requestId } };
  }
  if (r.kind === "webhook") return { ...base, lane: "webhook", actor: "PayPal webhook", title: r.message };
  if (r.kind === "agent" || r.kind === "agent_error") return { ...base, lane: "agent", actor: "Exhibit", title: r.message };
  if (r.kind === "approval") {
    const byMerchant = /^Merchant (approved|rejected)/.test(r.message);
    const client = typeof meta?.client === "string" ? meta.client : "AI agent";
    return { ...base, lane: byMerchant ? "merchant" : "agent", actor: byMerchant ? "Merchant" : client, title: r.message };
  }
  if (r.kind === "action" || r.kind === "action_error") {
    const who = actorOf(meta) ?? { lane: "merchant" as const, actor: "Merchant" };
    return { ...base, lane: who.lane, actor: who.actor, title: r.message };
  }
  if (r.kind === "settings") return { ...base, lane: "merchant", actor: "Merchant", title: r.message };
  if (r.kind === "sandbox") return { ...base, lane: "system", actor: paypalMode() === "demo" ? "Simulator control" : "Sandbox control", title: r.message };
  return { ...base, lane: "system", actor: "Exhibit", title: r.message };
}

export function activityTimeline(limit = 400): { items: TimelineItem[]; mode: string } {
  return { items: listActivity({ limit }).map(toItem), mode: paypalMode() };
}

export function disputeTimeline(disputeId: string, limit = 120): TimelineItem[] {
  return listActivity({ disputeId, limit }).map(toItem);
}
