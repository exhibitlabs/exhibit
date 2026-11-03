// A read-only tap on the Claude Agent SDK, used only by the eval. eval/run.ts points Exhibit's Claude
// CLI provider (src/lib/agent/providers/claude-code.ts) at this module instead of the SDK. It
// re-exports the SDK unchanged and wraps query() so the harness can record what the CLI reports: the
// model that answered, per-call token usage, tool calls and rate-limit events. Every message passes
// through untouched, and a failure in the tap can never reach the agent.

import * as sdk from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage, SDKRateLimitInfo } from "@anthropic-ai/claude-agent-sdk";

export * from "@anthropic-ai/claude-agent-sdk";

export type CallUsage = { input_tokens: number; cache_creation_input_tokens: number; cache_read_input_tokens: number; output_tokens: number };

export type Tap = {
  disputeId: string;
  /** Models named by the CLI's init message and by each API response. */
  models: string[];
  /**
   * Token usage per API call (message id), from the stream: message_start carries the input and cache
   * counts, message_delta the final output count. Streamed assistant messages repeat a call's id once
   * per content block with a usage snapshot taken before the output was written, so they only fill gaps.
   * Each field keeps its maximum.
   */
  calls: Record<string, CallUsage>;
  toolUses: { id: string; name: string }[];
  /** tool_result blocks the CLI marked as errors (including inputs the SDK rejected before Exhibit saw them). */
  toolErrors: number;
  rateLimits: SDKRateLimitInfo[];
  /** `error` on assistant messages: rate_limit, overloaded, authentication_failed, ... */
  assistantErrors: string[];
  systemEvents: Record<string, number>;
  result?: { subtype: string; is_error: boolean; num_turns: number; total_cost_usd: number; duration_ms: number };
  messages: number;
  /** The API call whose stream events are arriving (message_delta carries no id). */
  current?: string;
};

const g = globalThis as typeof globalThis & { __exhibitEvalTaps?: Map<string, Tap> };
/** One tap per dispute id, filled while its run streams. */
export const taps = (g.__exhibitEvalTaps ??= new Map<string, Tap>());

type Usage = Partial<Record<keyof CallUsage, number | null>> | null;

type Loose = {
  type: string;
  subtype?: string;
  model?: string;
  error?: string;
  message?: { id?: string; model?: string; usage?: Usage; content?: unknown };
  event?: { type?: string; message?: { id?: string; model?: string; usage?: Usage }; usage?: Usage };
  rate_limit_info?: SDKRateLimitInfo;
  is_error?: boolean;
  num_turns?: number;
  total_cost_usd?: number;
  duration_ms?: number;
};

function record(t: Tap, id: string, usage: Usage) {
  if (!usage) return;
  const prev = t.calls[id] ?? { input_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: 0 };
  t.calls[id] = {
    input_tokens: Math.max(prev.input_tokens, usage.input_tokens ?? 0),
    cache_creation_input_tokens: Math.max(prev.cache_creation_input_tokens, usage.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens: Math.max(prev.cache_read_input_tokens, usage.cache_read_input_tokens ?? 0),
    output_tokens: Math.max(prev.output_tokens, usage.output_tokens ?? 0),
  };
}

function observe(t: Tap, raw: SDKMessage) {
  const m = raw as unknown as Loose;
  t.messages++;
  if (m.type === "stream_event" && m.event) {
    const e = m.event;
    if (e.type === "message_start" && e.message?.id) {
      t.current = e.message.id;
      if (e.message.model && !t.models.includes(e.message.model)) t.models.push(e.message.model);
      record(t, e.message.id, e.message.usage ?? null);
    } else if (e.type === "message_delta" && t.current) {
      record(t, t.current, e.usage ?? null);
    }
  } else if (m.type === "system") {
    const key = m.subtype ?? "system";
    t.systemEvents[key] = (t.systemEvents[key] ?? 0) + 1;
    if (m.subtype === "init" && m.model && !t.models.includes(m.model)) t.models.push(m.model);
  } else if (m.type === "assistant" && m.message) {
    if (m.error) t.assistantErrors.push(m.error);
    const { id, model, usage, content } = m.message;
    if (model && !t.models.includes(model)) t.models.push(model);
    if (id) record(t, id, usage ?? null);
    if (Array.isArray(content))
      for (const b of content as { type?: string; id?: string; name?: string }[])
        if (b.type === "tool_use" && b.id && b.name && !t.toolUses.some((x) => x.id === b.id)) t.toolUses.push({ id: b.id, name: b.name });
  } else if (m.type === "user" && Array.isArray(m.message?.content)) {
    for (const b of m.message.content as { type?: string; is_error?: boolean }[]) if (b.type === "tool_result" && b.is_error) t.toolErrors++;
  } else if (m.type === "rate_limit_event" && m.rate_limit_info) {
    t.rateLimits.push(m.rate_limit_info);
  } else if (m.type === "result") {
    t.result = { subtype: m.subtype ?? "", is_error: !!m.is_error, num_turns: m.num_turns ?? 0, total_cost_usd: m.total_cost_usd ?? 0, duration_ms: m.duration_ms ?? 0 };
  }
}

export function query(params: Parameters<typeof sdk.query>[0]): ReturnType<typeof sdk.query> {
  const q = sdk.query(params);
  // Exhibit's user prompt names the dispute: "... Investigate PayPal dispute PP-D-61204 and file the case brief."
  const disputeId = (typeof params.prompt === "string" && /dispute (\S+) and file/.exec(params.prompt)?.[1]) || `unknown-${taps.size + 1}`;
  const t: Tap = { disputeId, models: [], calls: {}, toolUses: [], toolErrors: 0, rateLimits: [], assistantErrors: [], systemEvents: {}, messages: 0 };
  taps.set(disputeId, t);
  const tapped: ReturnType<typeof sdk.query> = new Proxy(q, {
    get(target, prop) {
      if (prop === Symbol.asyncIterator) return () => tapped;
      if (prop === "next")
        return async (...args: [] | [unknown]) => {
          const r = await target.next(...args);
          if (!r.done) {
            try {
              observe(t, r.value);
            } catch {
              // Observation only: never let the tap affect the run.
            }
          }
          return r;
        };
      const v: unknown = Reflect.get(target, prop, target);
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
  return tapped;
}
