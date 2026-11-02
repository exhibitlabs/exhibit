"use client";

import { clsx } from "clsx";
import { Menu, Sparkle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DemoStatus } from "@/lib/demo";
import type { NavCounts, Notice } from "@/lib/nav";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Logo } from "../ui/Logo";
import { toast, Toaster } from "../ui/Toast";
import { DemoBanner } from "./DemoBanner";
import { DemoGuide } from "./DemoGuide";
import { Notifications } from "./Notifications";
import { Shortcuts } from "./Shortcuts";
import { Sidebar, type AiProviderKind } from "./Sidebar";

type Nav = { counts: NavCounts; notices: Notice[] };

/** Asks the shell to reset the demo (with a confirmation) from anywhere in the app. */
export const requestDemoReset = () => window.dispatchEvent(new Event("exhibit:reset-demo"));

export function AppShell({ merchant, mode, provider, nav: initialNav, demo, palette, children }: { merchant: string; mode: "demo" | "sandbox"; provider: AiProviderKind; nav: Nav; demo: DemoStatus | null; palette: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [nav, setNav] = useState(initialNav);
  const [menu, setMenu] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const lastBeat = useRef(0);

  const loadNav = useCallback(async () => {
    const r = await fetch("/api/nav", { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    if (r?.counts) setNav(r);
  }, []);

  useEffect(() => {
    const t = setInterval(loadNav, 8000);
    window.addEventListener("exhibit:nav", loadNav);
    return () => {
      clearInterval(t);
      window.removeEventListener("exhibit:nav", loadNav);
    };
  }, [loadNav]);

  // Refresh badges on every navigation (a filing on one page changes another page's count).
  useEffect(() => {
    const t = setTimeout(loadNav, 0);
    return () => clearTimeout(t);
  }, [path, loadNav]);

  // Demo only: a person interacting keeps the shared demo from resetting under them.
  useEffect(() => {
    if (mode !== "demo") return;
    const beat = () => {
      if (Date.now() - lastBeat.current < 60_000 || document.visibilityState !== "visible") return;
      lastBeat.current = Date.now();
      void fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "touch" }), keepalive: true }).catch(() => {});
    };
    const evs = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const e of evs) window.addEventListener(e, beat, { passive: true });
    return () => {
      for (const e of evs) window.removeEventListener(e, beat);
    };
  }, [mode]);

  useEffect(() => {
    const on = () => setConfirmReset(true);
    window.addEventListener("exhibit:reset-demo", on);
    return () => window.removeEventListener("exhibit:reset-demo", on);
  }, []);

  const reset = async () => {
    setResetting(true);
    try {
      const r = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "reset" }) }).then((x) => x.json());
      if (r.error) throw new Error(r.error);
      setConfirmReset(false);
      toast({ title: "Demo reset", sub: "Fresh deadlines, briefs prepared on 6 cases, 2 left for you to run", tone: "success" });
      window.dispatchEvent(new Event("exhibit:demo-changed"));
      void loadNav();
      router.refresh();
    } catch (e) {
      toast({ title: "Couldn't reset the demo", sub: e instanceof Error ? e.message : String(e), tone: "error" });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="app-shell flex min-h-dvh">
      <Sidebar merchant={merchant} mode={mode} provider={provider} counts={nav.counts} notices={nav.notices} open={menu} onClose={() => setMenu(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-white/90 px-3 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setMenu(true)} aria-label="Open menu" className="flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sunken">
            <Menu className="size-[18px]" />
          </button>
          <Link href="/app" aria-label="Overview">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <button type="button" onClick={() => window.dispatchEvent(new CustomEvent("exhibit:ask"))} aria-label="Ask Exhibit" className="flex size-9 items-center justify-center rounded-md text-ink-2 hover:bg-sunken">
              <Sparkle className="size-4" />
            </button>
            <Notifications notices={nav.notices} />
          </div>
        </header>
        {mode === "demo" && demo ? <DemoBanner provider={provider} idleMinutes={demo.idleMinutes} onReset={() => setConfirmReset(true)} onGuide={() => window.dispatchEvent(new Event("exhibit:guide"))} /> : null}
        <main key={path} className={clsx("page-in min-w-0 flex-1", mode === "demo" && "pb-16")}>
          {children}
        </main>
      </div>
      {mode === "demo" && demo ? <DemoGuide initial={demo} /> : null}
      {palette}
      <Shortcuts />
      <Toaster />
      <Dialog
        open={confirmReset}
        onClose={() => !resetting && setConfirmReset(false)}
        title="Reset the demo?"
        width={460}
        footer={
          <>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)} disabled={resetting}>
              Cancel
            </Button>
            <Button size="sm" variant="primary" onClick={reset} disabled={resetting}>
              {resetting ? "Resetting…" : "Reset demo"}
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-ink-2">
          Kora Atelier goes back to a fresh start: eight open disputes with deadlines counted from now, briefs prepared on six of them, prevention orders back on the radar, and the audit log cleared. This is a shared demo, so it also resets on its own after {demo?.idleMinutes ?? 20} quiet minutes.
        </p>
        <p className="mt-2 text-[12.5px] text-muted">Only the demo merchant is affected. Sandbox mode is never reset.</p>
      </Dialog>
    </div>
  );
}
