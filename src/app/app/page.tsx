import { CommandCenter } from "@/components/app/overview/CommandCenter";
import { demoReady } from "@/lib/demo";
import { buildOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Command center" };

export default async function CommandCenterPage() {
  await demoReady();
  return <CommandCenter initial={await buildOverview()} />;
}
