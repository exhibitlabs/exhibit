import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type PayPalMode = "demo" | "sandbox";
export type AiProvider = "anthropic" | "claude-code" | "replay";

const env = process.env;

/** Demo mode runs every PayPal call against the built-in simulator; sandbox mode calls api-m.sandbox.paypal.com. */
export function paypalMode(): PayPalMode {
  if (env.EXHIBIT_PAYPAL_MODE === "demo") return "demo";
  return env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET ? "sandbox" : "demo";
}

export const PAYPAL_BASE_URL = {
  demo: "https://api-m.sandbox.paypal.com",
  sandbox: "https://api-m.sandbox.paypal.com",
} as const;

export function paypalCredentials() {
  return {
    clientId: env.PAYPAL_CLIENT_ID ?? "",
    clientSecret: env.PAYPAL_CLIENT_SECRET ?? "",
    webhookId: env.PAYPAL_WEBHOOK_ID ?? "",
  };
}

/** A Claude Code login on this machine lets the agent run live with no API key. Set EXHIBIT_ALLOW_CLAUDE_CODE=0 to opt out. */
function hasClaudeLogin() {
  if (env.EXHIBIT_ALLOW_CLAUDE_CODE === "0") return false;
  return env.EXHIBIT_ALLOW_CLAUDE_CODE === "1" || fs.existsSync(path.join(/*turbopackIgnore: true*/ os.homedir(), ".claude"));
}

/**
 * AI provider order: an Anthropic API key wins; otherwise the local Claude CLI login; otherwise
 * recorded runs are replayed so the demo still works with nothing installed.
 */
export function aiProvider(): AiProvider {
  const forced = env.EXHIBIT_AI_PROVIDER as AiProvider | undefined;
  if (forced === "anthropic" || forced === "claude-code" || forced === "replay") return forced;
  if (env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN) return "anthropic";
  return hasClaudeLogin() ? "claude-code" : "replay";
}

export const AI_MODEL = env.EXHIBIT_MODEL ?? "claude-opus-5-5";

export function dataDir() {
  return path.resolve(/*turbopackIgnore: true*/ env.EXHIBIT_DATA_DIR ?? path.join(process.cwd(), ".data"));
}

export function appUrl() {
  return env.EXHIBIT_APP_URL ?? "http://localhost:3000";
}
