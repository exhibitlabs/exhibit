import { AutopilotView } from "@/components/app/AutopilotView";
import { getAutopilot, simulationCases } from "@/lib/autopilot";
import { paypalMode } from "@/lib/config";
import { demoReady } from "@/lib/demo";
import { cachedDisputes, latestBriefs } from "@/lib/disputes";
import { REASON_LABEL } from "@/lib/paypal/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Autopilot" };

export default async function AutopilotPage() {
  await demoReady();
  const briefs = latestBriefs();
  const cases = cachedDisputes()
    .filter((d) => d.status !== "RESOLVED" && briefs.has(d.dispute_id))
    .map((d) => ({ id: d.dispute_id, buyer: d.disputed_transactions[0]?.buyer?.name ?? "Buyer", reason: REASON_LABEL[d.reason], amount: Number(d.dispute_amount.value), brief: briefs.get(d.dispute_id)! }));
  return <AutopilotView initial={getAutopilot()} cases={cases} history={simulationCases()} mode={paypalMode()} />;
}
