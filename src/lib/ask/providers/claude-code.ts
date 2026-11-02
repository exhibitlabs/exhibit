import "server-only";
// Development provider: the same tools through the Claude Agent SDK on a local Claude Code login
// (EXHIBIT_ALLOW_CLAUDE_CODE=1). Isolated like the case agent: only Exhibit's tools, no user settings.

import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import { askSystemPrompt, askUserPrompt } from "../prompt";
import type { AskTurn } from "../schema";
import { answerTextStreamer } from "../stream-text";
import { ASK_TOOLS, executeAskTool, type AskContext } from "../tools";

export async function askWithClaudeCode(question: string, history: AskTurn[], ctx: AskContext, model: string) {
  const server = createSdkMcpServer({
    name: "ask",
    version: "1.0.0",
    tools: ASK_TOOLS.map((t) =>
      tool(t.name, t.description, t.schema.shape, async (args: unknown) => {
        const r = await executeAskTool(t.name, args, ctx);
        return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
      }),
    ),
  });

  const env: Record<string, string | undefined> = { ...process.env };
  for (const k of Object.keys(env)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_")) delete env[k];

  const abort = new AbortController();
  const onEvent = answerTextStreamer(ctx.emit, (n) => n.endsWith("present_answer"));
  const q = query({
    prompt: askUserPrompt(question, history),
    options: {
      model,
      systemPrompt: askSystemPrompt(),
      mcpServers: { ask: server },
      strictMcpConfig: true,
      tools: [],
      allowedTools: ASK_TOOLS.map((t) => `mcp__ask__${t.name}`),
      settingSources: [],
      permissionMode: "dontAsk",
      thinking: { type: "adaptive" },
      effort: "low",
      includePartialMessages: true,
      maxTurns: 8,
      persistSession: false,
      abortController: abort,
      env,
    },
  });

  try {
    for await (const m of q) {
      if (m.type === "stream_event") onEvent(m.event);
      else if (m.type === "result") {
        if (m.subtype !== "success" && !ctx.answer) throw new Error(`Agent stopped: ${m.subtype}`);
        break;
      }
      if (ctx.answer) {
        abort.abort();
        break;
      }
    }
  } catch (e) {
    if (!ctx.answer) throw e;
  } finally {
    q.close();
  }
  if (!ctx.answer) throw new Error("Exhibit could not finish this answer.");
}
