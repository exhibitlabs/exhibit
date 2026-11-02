import { InboxView } from "@/components/app/InboxView";
import { paypalMode } from "@/lib/config";
import { demoReady } from "@/lib/demo";
import { disputesForInbox, latestBriefs } from "@/lib/disputes";
import { dashboardStats, inboxRows } from "@/lib/inbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Disputes" };

export default async function InboxPage() {
  await demoReady();
  const rows = inboxRows(await disputesForInbox(), latestBriefs());
  const mode = paypalMode();
  return (
    <InboxView
      initialRows={rows}
      initialStats={dashboardStats(rows)}
      mode={mode}
      header={{
        eyebrow: mode === "sandbox" ? "PayPal Disputes API · live sandbox" : "PayPal Disputes API · simulator",
        title: "Disputes",
        subtitle: "Every PayPal dispute and chargeback with Exhibit's call. Open a case to see the evidence, the response it drafted, and the one action PayPal is waiting for.",
      }}
    />
  );
}
