import { InboxView } from "@/components/app/InboxView";
import { DotArt } from "@/components/ui/DotArt";
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
  return <InboxView initialRows={rows} initialStats={dashboardStats(rows)} mode={mode} emptyArt={<DotArt name="parcel" width={128} height={96} className="mb-4" />} />;
}
