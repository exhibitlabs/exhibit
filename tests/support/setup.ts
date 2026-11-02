// Runs before every test file. The suite must work with no credentials, no network and no Claude
// login, so this pins the environment instead of trusting whatever the machine has.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterAll } from "vitest";

for (const k of [
  "PAYPAL_CLIENT_ID",
  "PAYPAL_CLIENT_SECRET",
  "PAYPAL_WEBHOOK_ID",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "EXHIBIT_MODEL",
  "EXHIBIT_ASK_MODEL",
  "EXHIBIT_APP_URL",
  "EXHIBIT_RECORD_REPLAYS",
  "EXHIBIT_URL",
]) {
  delete process.env[k];
}
process.env.EXHIBIT_PAYPAL_MODE = "demo"; // the in-process PayPal simulator, never api-m.sandbox.paypal.com
process.env.EXHIBIT_AI_PROVIDER = "replay"; // never the Claude CLI or the Anthropic API
process.env.EXHIBIT_ASK_PROVIDER = "offline";
process.env.EXHIBIT_ALLOW_CLAUDE_CODE = "0";

// Each test file runs in its own process, so each gets its own SQLite directory.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "exhibit-test-"));
process.env.EXHIBIT_DATA_DIR = dataDir;

// Only loopback is reachable. A test that tries to call PayPal (or anything else) fails loudly.
const realFetch = globalThis.fetch;
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const url = URL.canParse(href) ? new URL(href) : null;
  // data: and blob: URLs (the PDF renderer uses them) never leave the process.
  if (url && /^https?:$/.test(url.protocol) && !["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)) {
    return Promise.reject(new Error(`Tests must not use the network: blocked fetch to ${url.origin}`));
  }
  return realFetch(input, init);
}) as typeof fetch;

afterAll(() => {
  const open = (globalThis as unknown as { __exhibitDb?: Map<string, DatabaseSync> }).__exhibitDb;
  for (const conn of open?.values() ?? []) conn.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});
