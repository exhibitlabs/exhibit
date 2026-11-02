import { AskPalette } from "@/components/app/ask/AskPalette";
import { Sidebar } from "@/components/app/Sidebar";
import { askProvider, providerLabel } from "@/lib/ask/run";
import { aiProvider, paypalMode } from "@/lib/config";
import { ensureSeeded } from "@/lib/seed";
import { store } from "@/lib/store/repo";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  ensureSeeded();
  return (
    <div className="flex min-h-dvh">
      <Sidebar merchant={store.merchant().name} mode={paypalMode()} provider={aiProvider()} />
      <main className="min-w-0 flex-1">{children}</main>
      <AskPalette provider={askProvider()} label={providerLabel(askProvider())} />
    </div>
  );
}
