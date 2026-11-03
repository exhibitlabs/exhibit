import { PreventionView } from "@/components/app/PreventionView";
import { DotArt } from "@/components/ui/DotArt";
import { demoReady } from "@/lib/demo";
import { preventionReport } from "@/lib/prevention";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prevention" };

export default async function PreventionPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  await demoReady();
  return <PreventionView initial={preventionReport()} initialOrder={order ?? null} emptyArt={<DotArt name="parcel" width={128} height={96} />} />;
}
