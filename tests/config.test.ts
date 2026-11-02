// Guarantee: Exhibit never reaches PayPal's sandbox or an AI provider by accident. Demo mode is the
// default, sandbox mode needs both credentials, and the AI provider falls back from an API key to
// the local Claude login to recorded runs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { aiProvider, dataDir, paypalMode } from "@/lib/config";

const CLEAN = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "EXHIBIT_PAYPAL_MODE", "EXHIBIT_AI_PROVIDER", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "EXHIBIT_ALLOW_CLAUDE_CODE"];
let home: string;
beforeEach(() => {
  for (const k of CLEAN) vi.stubEnv(k, undefined);
  home = fs.mkdtempSync(path.join(os.tmpdir(), "exhibit-home-"));
  vi.stubEnv("HOME", home);
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(home, { recursive: true, force: true });
});
const signedIntoClaude = () => fs.mkdirSync(path.join(home, ".claude"));

describe("the test environment", () => {
  it("uses the PayPal simulator, recorded runs and a private data directory, whatever this machine has", () => {
    vi.unstubAllEnvs(); // back to what tests/support/setup.ts pinned
    expect(paypalMode()).toBe("demo");
    expect(aiProvider()).toBe("replay");
    expect(dataDir().startsWith(fs.realpathSync(os.tmpdir()) + path.sep) || dataDir().startsWith(os.tmpdir() + path.sep)).toBe(true);
    expect(dataDir()).not.toBe(path.join(process.cwd(), ".data")); // never the developer's own demo or sandbox database
  });

  it("refuses to reach beyond the machine", async () => {
    await expect(fetch("https://api-m.sandbox.paypal.com/v1/oauth2/token")).rejects.toThrow(/must not use the network/);
    await expect(fetch("https://example.com")).rejects.toThrow(/must not use the network/);
  });
});

describe("paypalMode", () => {
  it("is demo (the in-process simulator) when there are no credentials", () => {
    expect(paypalMode()).toBe("demo");
  });

  it("needs both a client id and a secret before it calls PayPal's sandbox", () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "id");
    expect(paypalMode()).toBe("demo");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    expect(paypalMode()).toBe("sandbox");
  });

  it("can be pinned to demo even when credentials are present, so tests and demos never touch the sandbox", () => {
    vi.stubEnv("PAYPAL_CLIENT_ID", "id");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret");
    vi.stubEnv("EXHIBIT_PAYPAL_MODE", "demo");
    expect(paypalMode()).toBe("demo");
  });
});

describe("aiProvider", () => {
  it("replays recorded runs when there is no key and no Claude login", () => {
    expect(aiProvider()).toBe("replay");
  });

  it("uses the local Claude CLI login when there is one", () => {
    signedIntoClaude();
    expect(aiProvider()).toBe("claude-code");
  });

  it("prefers an Anthropic API key to the Claude login", () => {
    signedIntoClaude();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    expect(aiProvider()).toBe("anthropic");
    vi.stubEnv("ANTHROPIC_API_KEY", undefined);
    vi.stubEnv("ANTHROPIC_AUTH_TOKEN", "token");
    expect(aiProvider()).toBe("anthropic");
  });

  it("can be told to ignore the Claude login", () => {
    signedIntoClaude();
    vi.stubEnv("EXHIBIT_ALLOW_CLAUDE_CODE", "0");
    expect(aiProvider()).toBe("replay");
  });

  it("can be forced, but only to a provider that exists", () => {
    signedIntoClaude();
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    vi.stubEnv("EXHIBIT_AI_PROVIDER", "replay");
    expect(aiProvider()).toBe("replay");
    vi.stubEnv("EXHIBIT_AI_PROVIDER", "claude-code");
    expect(aiProvider()).toBe("claude-code");
    vi.stubEnv("EXHIBIT_AI_PROVIDER", "some-other-model");
    expect(aiProvider()).toBe("anthropic"); // an unknown value is ignored, not trusted
  });
});

describe("dataDir", () => {
  it("is the directory the environment names, so a run never writes into the project by accident", () => {
    vi.stubEnv("EXHIBIT_DATA_DIR", path.join(home, "data"));
    expect(dataDir()).toBe(path.join(home, "data"));
  });

  it("defaults to .data in the working directory", () => {
    vi.stubEnv("EXHIBIT_DATA_DIR", undefined);
    expect(dataDir()).toBe(path.join(process.cwd(), ".data"));
  });
});
