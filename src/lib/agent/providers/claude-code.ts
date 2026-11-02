import "server-only";
// Claude CLI provider: runs the same agent and tools through the Claude Agent SDK, authenticated by
// the local Claude Code login, so no API key is needed. Set EXHIBIT_ALLOW_CLAUDE_CODE=0 to turn it off.

import { createSdkMcpServer, query, tool } from "@anthropic-ai/claude-agent-sdk";
import { AI_MODEL } from "../../config";
import { systemPrompt, userPrompt } from "../prompt";
import { executeTool, TOOLS, type ToolContext } from "../tools";

export async function runWithClaudeCode(ctx: ToolContext): Promise<{ usage: { input_tokens: number; output_tokens: number } }> {
  const server = createSdkMcpServer({
    name: "exhibit",
    version: "1.0.0",
    tools: TOOLS.map((t) =>
      tool(t.name, t.description, t.schema.shape, async (args: unknown) => {
        const r = await executeTool(t.name, args, ctx);
        return { content: [{ type: "text" as const, text: r.text }], isError: r.isError };
      }),
    ),
  });

  // Strip the parent Claude Code session's variables so the SDK starts a clean, isolated session.
  const env: Record<string, string | undefined> = { ...process.env };
  for (const k of Object.keys(env)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_")) delete env[k];

  const abort = new AbortController();
  const usage = { input_tokens: 0, output_tokens: 0 };
  const q = query({
    prompt: userPrompt(ctx.disputeId),
    options: {
      model: AI_MODEL,
      systemPrompt: systemPrompt(),
      mcpServers: { exhibit: server },
      // Only the Exhibit tools: no account-level connectors or user MCP servers.
      strictMcpConfig: true,
      tools: [],
      allowedTools: TOOLS.map((t) => `mcp__exhibit__${t.name}`),
      settingSources: [],
      permissionMode: "dontAsk",
      thinking: { type: "adaptive", display: "summarized" },
      effort: "medium",
      includePartialMessages: true,
      maxTurns: 14,
      persistSession: false,
      abortController: abort,
      env,
    },
  });

  try {
    for await (const m of q) {
      if (m.type === "stream_event" && m.event.type === "content_block_delta") {
        const delta = m.event.delta;
        if (delta.type === "thinking_delta") ctx.emit({ t: "thinking", text: delta.thinking });
        else if (delta.type === "text_delta") ctx.emit({ t: "text", text: delta.text });
      } else if (m.type === "assistant") {
        const u = m.message.usage;
        if (u) {
          usage.input_tokens += (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);
          usage.output_tokens += u.output_tokens ?? 0;
        }
      } else if (m.type === "result") {
        if (m.subtype !== "success" && !ctx.brief) throw new Error(`Agent stopped: ${m.subtype}`);
        break;
      }
      // The brief is the deliverable; once it is accepted there is nothing left for the model to do.
      if (ctx.brief) {
        abort.abort();
        break;
      }
    }
  } catch (e) {
    if (!ctx.brief) throw e;
  } finally {
    q.close();
  }
  if (!ctx.brief) throw new Error("The agent finished without filing a case brief.");
  return { usage };
}
