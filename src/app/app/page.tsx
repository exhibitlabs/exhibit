import { CommandCenter } from "@/components/app/overview/CommandCenter";
import { buildOverview } from "@/lib/overview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Command center" };

export default async function CommandCenterPage() {
  return <CommandCenter initial={await buildOverview()} />;
}
