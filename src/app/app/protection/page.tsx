import { PageHeader } from "@/components/app/PageHeader";
import { PreventionView } from "@/components/app/PreventionView";
import { demoReady } from "@/lib/demo";
import { preventionReport } from "@/lib/prevention";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prevention" };

export default async function PreventionPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  await demoReady();
  return (
    <>
      <PageHeader
        eyebrow="Prevention"
        title="Stop disputes before they're filed"
        subtitle="Exhibit scores every recent order for the signals that come before a PayPal dispute, then fixes them: tracking pushed to PayPal, refunds issued, buyers answered in their own language."
      />
      <PreventionView initial={preventionReport()} initialOrder={order ?? null} />
    </>
  );
}
