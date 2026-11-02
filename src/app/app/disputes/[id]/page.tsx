import { notFound } from "next/navigation";
import { CaseWorkspace } from "@/components/app/case/CaseWorkspace";
import { disputeTimeline } from "@/lib/activity";
import { evaluateSellerProtection } from "@/lib/agent/playbook";
import { isRunning } from "@/lib/agent/run";
import { aiProvider, paypalMode } from "@/lib/config";
import { listActivity } from "@/lib/db";
import { demoReady } from "@/lib/demo";
import { actionsFor, cachedDispute, cachedDisputes, caseFile, latestRun, refreshDispute } from "@/lib/disputes";
import { PayPalError } from "@/lib/paypal/client";
import { store } from "@/lib/store/repo";

export const dynamic = "force-dynamic";

const TABS = ["packet", "facts", "trace", "calls", "history"] as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = cachedDispute(id);
  return { title: d ? `${d.disputed_transactions[0]?.buyer?.name ?? id} · ${id}` : id };
}

export default async function DisputePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string; guide?: string }> }) {
  const { id } = await params;
  const { tab, guide } = await searchParams;
  await demoReady();
  let d = cachedDispute(id);
  try {
    d = await refreshDispute(id);
  } catch (e) {
    if (!d) {
      if (e instanceof PayPalError && (e.status === 404 || e.status === 400)) notFound();
      throw e;
    }
  }
  const cf = caseFile(d);
  const run = latestRun(id) ?? null;

  // J / K and the arrows walk the open cases closest deadline first, like the inbox.
  const open = cachedDisputes()
    .filter((x) => x.status !== "RESOLVED")
    .sort((a, b) => (a.seller_response_due_date ?? "9999").localeCompare(b.seller_response_due_date ?? "9999"));
  const i = open.findIndex((x) => x.dispute_id === id);
  const label = (x?: (typeof open)[number]) => (x ? { id: x.dispute_id, buyer: x.disputed_transactions[0]?.buyer?.name ?? x.dispute_id } : null);

  return (
    <CaseWorkspace
      initial={{
        cf,
        run: run ? { id: run.id, status: run.status, provider: run.provider, model: run.model, brief: run.brief, events: run.events as never, finished_at: run.finished_at } : null,
        running: isRunning(id),
        actions: actionsFor(id) as never,
        api: listActivity({ disputeId: id, kind: "api", limit: 60 }) as never,
        history: disputeTimeline(id),
      }}
      protection={evaluateSellerProtection(cf, store.merchant().address.country)}
      mode={paypalMode()}
      provider={aiProvider()}
      nav={{ prev: i > 0 ? label(open[i - 1]) : null, next: i >= 0 && i < open.length - 1 ? label(open[i + 1]) : null, index: Math.max(0, i), total: open.length }}
      initialTab={(TABS as readonly string[]).includes(tab ?? "") ? (tab as (typeof TABS)[number]) : null}
      guide={guide ?? null}
    />
  );
}
