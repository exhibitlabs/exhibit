import { AppShell } from "@/components/app/AppShell";
import { AskPalette } from "@/components/app/ask/AskPalette";
import { listApprovals } from "@/lib/approvals";
import { askProvider, providerLabel } from "@/lib/ask/run";
import { aiProvider, paypalMode } from "@/lib/config";
import { demoReady, demoStatus } from "@/lib/demo";
import { navState } from "@/lib/nav";
import { store } from "@/lib/store/repo";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Seeds a first demo, or resets one that sat idle, before anything reads demo data.
  await demoReady();
  const mode = paypalMode();
  return (
    <AppShell
      merchant={store.merchant().name}
      mode={mode}
      provider={aiProvider()}
      nav={navState()}
      demo={mode === "demo" ? demoStatus(listApprovals({ status: "pending" }).length) : null}
      palette={<AskPalette provider={askProvider()} label={providerLabel(askProvider())} />}
    >
      {children}
    </AppShell>
  );
}
