import { ApprovalsView } from "@/components/app/AgentApprovals";
import { DotArt } from "@/components/ui/DotArt";
import { paypalMode } from "@/lib/config";
import { demoReady } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agent requests" };

export default async function ApprovalsPage() {
  await demoReady();
  return <ApprovalsView mode={paypalMode()} emptyArt={<DotArt name="slip" width={120} height={90} />} />;
}
