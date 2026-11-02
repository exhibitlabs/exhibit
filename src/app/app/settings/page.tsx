import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SettingsView } from "@/components/app/SettingsView";
import { listApprovals } from "@/lib/approvals";
import { askProvider, providerLabel } from "@/lib/ask/run";
import { AI_MODEL, aiProvider, appUrlConfigured, appUrl, paypalCredentials, paypalMode } from "@/lib/config";
import { demoReady, demoStatus } from "@/lib/demo";
import { kvGet } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await demoReady();
  const mode = paypalMode();
  const { clientId, webhookId } = paypalCredentials();
  const env = process.env;
  const forced = env.EXHIBIT_AI_PROVIDER === "anthropic" || env.EXHIBIT_AI_PROVIDER === "claude-code" || env.EXHIBIT_AI_PROVIDER === "replay" ? env.EXHIBIT_AI_PROVIDER : null;
  return (
    <SettingsView
      mode={mode}
      provider={aiProvider()}
      model={AI_MODEL}
      askLabel={providerLabel(askProvider())}
      ai={{
        forced,
        apiKey: !!(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN),
        cliLogin: fs.existsSync(path.join(/*turbopackIgnore: true*/ os.homedir(), ".claude")),
        cliDisabled: env.EXHIBIT_ALLOW_CLAUDE_CODE === "0",
      }}
      // In demo mode the sandbox app's client id is irrelevant (and never shown).
      clientId={mode === "sandbox" && clientId ? `${clientId.slice(0, 6)}…${clientId.slice(-4)}` : ""}
      configuredAppUrl={appUrlConfigured() ? appUrl() : null}
      webhookIdSet={!!webhookId}
      mcpLocalPath={path.join(process.cwd(), "mcp", "server.ts")}
      pendingApprovals={listApprovals({ status: "pending" }).length}
      demo={mode === "demo" ? { ...demoStatus(), resetReason: kvGet<string | null>("demo_reset_reason", null) } : null}
    />
  );
}
