/**
 * End-to-end proof that an external agent can use Exhibit: runs Claude (via the Claude Agent SDK,
 * on the local Claude Code login) with ONLY the Exhibit MCP server attached, gives it a merchant's
 * request, and writes the transcript to docs/MCP_DEMO.md.
 *
 *   EXHIBIT_URL=http://localhost:3101 node mcp/agent-demo.ts
 *
 * The agent cannot file anything: request_dispute_action only queues an approval for the merchant.
 */
import { query } from "@anthropic-ai/claude-agent-sdk";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.EXHIBIT_URL ?? "http://localhost:3101").replace(/\/+$/, "");
const here = path.dirname(fileURLToPath(import.meta.url));
const PROMPT = process.env.DEMO_PROMPT ?? "Triage my open PayPal disputes and get the strongest one ready to file.";
const TOOLS = ["list_disputes", "investigate_dispute", "get_case_brief", "get_evidence_packet", "get_prevention_report", "get_overview", "request_dispute_action", "request_prevention_fix", "get_approval_status"];

const status = (await fetch(`${BASE}/api/status`).then((r) => r.json())) as { paypalMode: string; aiProvider: string };

// Run as a clean, isolated session even when launched from inside Claude Code.
const env: Record<string, string | undefined> = { ...process.env };
for (const k of Object.keys(env)) if (k === "CLAUDECODE" || k.startsWith("CLAUDE_CODE_")) delete env[k];

const out: string[] = [];
const started = Date.now();
let model = "";
let calls = 0;
const clip = (s: string, n = 1400) => (s.length > n ? `${s.slice(0, n)}\n… (${s.length - n} more characters)` : s);

const q = query({
  prompt: PROMPT,
  options: {
    mcpServers: { exhibit: { type: "stdio", command: process.execPath, args: [path.join(here, "server.ts")], env: { EXHIBIT_URL: BASE } } },
    strictMcpConfig: true,
    settingSources: [],
    tools: [],
    allowedTools: TOOLS.map((t) => `mcp__exhibit__${t}`),
    permissionMode: "dontAsk",
    systemPrompt: { type: "preset", preset: "claude_code", append: "You are helping a PayPal merchant through the Exhibit MCP server. Be concise in your final answer." },
    maxTurns: 30,
    persistSession: false,
    env,
  },
});

for await (const m of q) {
  if (m.type === "system" && m.subtype === "init") {
    model = m.model;
    const ex = m.mcp_servers.find((s) => s.name === "exhibit");
    process.stderr.write(`agent: ${m.model} · exhibit MCP ${ex?.status}\n`);
  } else if (m.type === "assistant") {
    for (const b of m.message.content) {
      if (b.type === "text" && b.text.trim()) out.push(`**Claude:** ${b.text.trim()}\n`);
      else if (b.type === "tool_use") {
        calls++;
        const name = b.name.replace(/^mcp__exhibit__/, "");
        process.stderr.write(`→ ${name} ${JSON.stringify(b.input)}\n`);
        out.push(`**→ \`${name}\`** \`${JSON.stringify(b.input)}\`\n`);
      }
    }
  } else if (m.type === "user" && Array.isArray(m.message.content)) {
    for (const b of m.message.content) {
      if (typeof b === "object" && b && "type" in b && b.type === "tool_result") {
        const c = (b as { content?: unknown }).content;
        const text = typeof c === "string" ? c : Array.isArray(c) ? c.map((x: { text?: string }) => x.text ?? "").join("\n") : "";
        out.push(`<details><summary>Exhibit returned${(b as { is_error?: boolean }).is_error ? " (error)" : ""}</summary>\n\n\`\`\`\n${clip(text)}\n\`\`\`\n</details>\n`);
      }
    }
  } else if (m.type === "result") {
    out.push(`---\n\n_${m.subtype === "success" ? "Finished" : `Stopped (${m.subtype})`} in ${((Date.now() - started) / 1000).toFixed(0)}s · ${m.num_turns} turns · ${calls} Exhibit tool calls${m.total_cost_usd ? ` · $${m.total_cost_usd.toFixed(2)}` : ""}._\n`);
  }
}

const approvals = (await fetch(`${BASE}/api/approvals?status=pending`).then((r) => r.json())) as { approvals: { id: string; title: string; target: string; client: string; status: string }[] };
const md = [
  "# Exhibit over MCP: a real agent run",
  "",
  `Recorded ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC with \`node mcp/agent-demo.ts\`. Claude (${model || "default model"}, via the Claude Agent SDK) had **only** the Exhibit MCP server attached (stdio, \`EXHIBIT_URL=${BASE}\`, PayPal ${status.paypalMode} mode, Exhibit agent: ${status.aiProvider}). No other tools, no filesystem, no shell.`,
  "",
  `> **Merchant:** ${PROMPT}`,
  "",
  ...out,
  "## After the run",
  "",
  approvals.approvals.length
    ? `Pending in Exhibit, waiting for the merchant (nothing has been sent to PayPal):\n\n${approvals.approvals.map((a) => `- \`${a.id}\` · ${a.title} · ${a.target} · requested by ${a.client}`).join("\n")}\n\nThe merchant sees the request as a banner on the case page and in Settings → Connect an AI agent, and approves or rejects it there.`
    : "No approvals are pending.",
  "",
].join("\n");
const file = path.join(here, "..", "docs", "MCP_DEMO.md");
fs.writeFileSync(file, md);
process.stderr.write(`wrote ${file}\n`);
