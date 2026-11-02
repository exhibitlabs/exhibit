import { InboxView } from "@/components/app/InboxView";
import { PageHeader } from "@/components/app/PageHeader";
import { paypalMode } from "@/lib/config";
import { disputesForInbox, latestBriefs } from "@/lib/disputes";
import { dashboardStats, inboxRows } from "@/lib/inbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "Disputes" };

export default async function InboxPage() {
  const rows = inboxRows(await disputesForInbox(), latestBriefs());
  return (
    <>
      <PageHeader
        eyebrow="PayPal Disputes API · synced live"
        title="Disputes"
        subtitle="Every open PayPal dispute and chargeback, with Exhibit's recommendation. Open a case to see the investigation, the evidence packet and the response."
      />
      <InboxView initialRows={rows} initialStats={dashboardStats(rows)} mode={paypalMode()} />
    </>
  );
}
