import { CommandCenter } from "@/components/app/overview/CommandCenter";
import { DotArt } from "@/components/ui/DotArt";
import { demoReady } from "@/lib/demo";
import { buildOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Command center" };

export default async function CommandCenterPage() {
  await demoReady();
  return <CommandCenter initial={await buildOverview()} guideArt={<DotArt name="letter" width={100} height={75} className="hidden shrink-0 sm:block" />} />;
}
