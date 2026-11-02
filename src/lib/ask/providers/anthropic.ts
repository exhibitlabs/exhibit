import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam, BetaTool, BetaToolResultBlockParam, BetaToolUseBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { askSystemPrompt, askUserPrompt } from "../prompt";
import type { AskTurn } from "../schema";
import { answerTextStreamer } from "../stream-text";
import { ASK_TOOLS, executeAskTool, type AskContext } from "../tools";

const MAX_TURNS = 6;

function toolDefs(): BetaTool[] {
  return ASK_TOOLS.map((t) => {
    const schema = z.toJSONSchema(t.schema) as Record<string, unknown>;
    delete schema.$schema;
    // Inputs stream as generated; every input is validated with zod before it runs.
    return { name: t.name, description: t.description, input_schema: schema as BetaTool["input_schema"], eager_input_streaming: true };
  });
}

/** Claude API: a short streaming tool loop at low effort, ending in present_answer. */
export async function askWithAnthropic(question: string, history: AskTurn[], ctx: AskContext, model: string) {
  const client = new Anthropic();
  const tools = toolDefs();
  const messages: BetaMessageParam[] = [{ role: "user", content: askUserPrompt(question, history) }];
  let nudged = false;
  let parseRetries = 0;

  for (let turn = 0; turn < MAX_TURNS && !ctx.answer; turn++) {
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: [{ type: "text", text: askSystemPrompt(), cache_control: { type: "ephemeral" } }],
      tools,
      messages,
    });
    stream.on("streamEvent", answerTextStreamer(ctx.emit, (n) => n === "present_answer"));

    let msg;
    try {
      msg = await stream.finalMessage();
      parseRetries = 0;
    } catch (err) {
      // A malformed streamed tool input rejects finalMessage(); re-issue the turn (API errors are rethrown).
      if (err instanceof Anthropic.APIError || parseRetries++ >= 2) throw err;
      continue;
    }
    if (msg.stop_reason === "refusal") throw new Error("The model declined this question.");
    messages.push({ role: "assistant", content: msg.content });

    const toolUses = msg.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
    if (!toolUses.length) {
      if (nudged) break;
      nudged = true;
      messages.push({ role: "user", content: "Call present_answer now with your answer." });
      continue;
    }
    if (msg.stop_reason === "max_tokens") throw new Error("A tool call was cut off at max_tokens.");
    const results = await Promise.all(toolUses.map((tu) => executeAskTool(tu.name, tu.input, ctx, tu.id)));
    const content: BetaToolResultBlockParam[] = toolUses.map((tu, i) => ({ type: "tool_result", tool_use_id: tu.id, content: results[i].text, is_error: results[i].isError }));
    messages.push({ role: "user", content });
  }
  if (!ctx.answer) throw new Error("Exhibit could not finish this answer.");
}
