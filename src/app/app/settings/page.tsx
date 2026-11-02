import path from "node:path";
import { PageHeader } from "@/components/app/PageHeader";
import { SettingsView } from "@/components/app/SettingsView";
import { AI_MODEL, aiProvider, appUrl, paypalCredentials, paypalMode } from "@/lib/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default function SettingsPage() {
  const { clientId, webhookId } = paypalCredentials();
  const masked = clientId ? `${clientId.slice(0, 6)}…${clientId.slice(-4)}` : "";
  return (
    <>
      <PageHeader eyebrow="Connections" title="Settings" subtitle="Where Exhibit gets its facts and how it reaches PayPal." />
      <SettingsView mode={paypalMode()} provider={aiProvider()} model={AI_MODEL} clientId={masked} webhookUrl={`${appUrl()}/api/webhooks/paypal`} webhookIdSet={!!webhookId} mcpServerPath={path.join(process.cwd(), "mcp", "server.ts")} />
    </>
  );
}
