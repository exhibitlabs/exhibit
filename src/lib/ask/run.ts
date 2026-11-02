import "server-only";
import { AI_MODEL, aiProvider } from "../config";
import { askWithAnthropic } from "./providers/anthropic";
import { askWithClaudeCode } from "./providers/claude-code";
import { askOffline, routeOffline } from "./providers/offline";
import type { Answer, AnswerInput, AskEvent, AskIndex, AskProviderKind, AskTurn } from "./schema";
import { SUGGESTED_QUESTIONS } from "./schema";
import { bookFor, newContext, type AskContext } from "./tools";
import { loadPrevention } from "./data";

/** Ask Exhibit is a quick chat, so it can run on a different model than the case agent. */
export const ASK_MODEL = process.env.EXHIBIT_ASK_MODEL ?? AI_MODEL;

export function askProvider(): AskProviderKind {
  if (process.env.EXHIBIT_ASK_PROVIDER === "offline") return "offline";
  const p = aiProvider();
  return p === "replay" ? "offline" : p;
}

const MODEL_NAME: Record<string, string> = { "claude-opus-5-5": "Claude Opus 5.5", "claude-sonnet-5-5": "Claude Sonnet 5.5", "claude-haiku-5-5": "Claude Haiku 5.5", "claude-fable-5-1": "Claude Fable 5.1" };

export function providerLabel(p: AskProviderKind) {
  const name = MODEL_NAME[ASK_MODEL] ?? ASK_MODEL;
  if (p === "anthropic") return `${name} · Claude API`;
  if (p === "claude-code") return `${name} · Claude CLI`;
  return "Offline answers · sign in to the Claude CLI for open questions";
}

/** Resolves chip ids to real records so the palette shows what the data says, not what the model wrote. */
async function enrich(a: AnswerInput, ctx: AskContext): Promise<Answer> {
  const b = await bookFor(ctx);
  const p = a.orders?.length ? (ctx.prevention ??= loadPrevention()) : undefined;
  const cases = (a.cases ?? []).flatMap((c) => {
    const r = b.rows.find((x) => x.id === c.id);
    return r ? [{ id: r.id, buyer: r.buyer, reason: r.reason, amount: r.amount, currency: r.currency, status: r.status, hoursLeft: r.hoursLeft, decision: r.decision, note: c.note, href: `/app/disputes/${r.id}` }] : [];
  });
  const orders = (a.orders ?? []).flatMap((o) => {
    const r = p?.orders.find((x) => x.orderId === o.id);
    return r ? [{ id: r.orderId, buyer: r.buyer, item: r.item, amount: r.amount, band: r.band, signal: r.top?.label ?? null, note: o.note, href: `/app/protection?order=${encodeURIComponent(r.orderId)}` }] : [];
  });
  return { text: a.text.trim(), chart: a.chart ?? null, cases, orders, followups: a.followups.slice(0, 3) };
}

/** Streams one answer: tool steps, then prose, then the structured answer. */
export async function runAsk(question: string, history: AskTurn[], emit: (e: AskEvent) => void) {
  const started = Date.now();
  const provider = askProvider();
  const ctx = newContext(emit);
  emit({ t: "start", provider, model: provider === "offline" ? "offline" : ASK_MODEL, label: providerLabel(provider) });
  try {
    let answer: AnswerInput | undefined;
    if (provider === "offline") answer = await askOffline(question, history, ctx);
    else {
      try {
        if (provider === "anthropic") await askWithAnthropic(question, history, ctx, ASK_MODEL);
        else await askWithClaudeCode(question, history, ctx, ASK_MODEL);
        answer = ctx.answer;
      } catch (e) {
        // The live model failed (no login, rate limit, outage): answer offline when the question allows.
        const intent = await routeOffline(question, history, ctx);
        if (!intent) throw e;
        emit({ t: "text_reset" });
        emit({ t: "notice", message: "The live agent is unavailable, so this is an offline answer." });
        answer = await intent();
      }
    }
    if (!answer) throw new Error("No answer.");
    if (answer !== ctx.answer) await streamOut(answer.text, emit);
    emit({ t: "answer", answer: await enrich(answer, ctx) });
  } catch (e) {
    emit({ t: "error", message: e instanceof Error ? e.message : String(e) });
  }
  emit({ t: "done", ms: Date.now() - started });
}

/** Offline answers are composed at once; read them out at a natural pace. */
async function streamOut(text: string, emit: (e: AskEvent) => void) {
  const parts = text.match(/\S+\s*/g) ?? [text];
  for (let i = 0; i < parts.length; i += 2) {
    emit({ t: "text", text: parts.slice(i, i + 2).join("") });
    await new Promise((r) => setTimeout(r, 14));
  }
}

/** Data for the palette's quick navigation. */
export async function askIndex(): Promise<AskIndex> {
  const ctx = newContext(() => {});
  const b = await bookFor(ctx);
  let orders: AskIndex["orders"] = [];
  try {
    orders = loadPrevention().atRisk.slice(0, 6).map((o) => ({ id: o.orderId, buyer: o.buyer, item: o.item, amount: o.amount, band: o.band, signal: o.top?.label ?? null }));
  } catch {
    // Prevention data is optional for navigation.
  }
  const provider = askProvider();
  return {
    provider,
    label: providerLabel(provider),
    cases: [...b.queue, ...b.rows.filter((r) => r.statusCode === "RESOLVED")].map((r) => ({ id: r.id, buyer: r.buyer, reason: r.reason, amount: r.amount, status: r.status, hoursLeft: r.hoursLeft, decision: r.decision })),
    orders,
    suggestions: SUGGESTED_QUESTIONS,
  };
}
