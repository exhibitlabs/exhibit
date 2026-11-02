import { ApprovalsView } from "@/components/app/AgentApprovals";
import { PageHeader } from "@/components/app/PageHeader";
import { paypalMode } from "@/lib/config";
import { demoReady } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent requests" };

export default async function ApprovalsPage() {
  await demoReady();
  return (
    <>
      <PageHeader eyebrow="Approval queue · MCP" title="Agent requests" subtitle="Outside AI agents can investigate on their own, but anything that reaches PayPal or a buyer waits here for you. Approving runs the same code as your own button." />
      <ApprovalsView mode={paypalMode()} />
    </>
  );
}
