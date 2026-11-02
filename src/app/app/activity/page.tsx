import { ActivityView } from "@/components/app/ActivityView";
import { activityTimeline } from "@/lib/activity";
import { demoReady } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const metadata = { title: "PayPal activity" };

export default async function ActivityPage() {
  await demoReady();
  const { items, mode } = activityTimeline();
  return <ActivityView initial={items} mode={mode} />;
}
