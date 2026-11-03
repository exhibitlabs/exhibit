"use client";

import { clsx } from "clsx";
import { Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DemoStatus } from "@/lib/demo";
import type { NavCounts, Notice } from "@/lib/nav";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Kbd } from "../ui/Kbd";
import { LogoMark } from "../ui/Logo";
import { toast, Toaster } from "../ui/Toast";
import { DemoStrip, EnvLine, WhatsReal } from "./DemoBanner";
import { DemoGuideProvider, GuideButton } from "./DemoGuide";
import { Notifications } from "./Notifications";
import { Shortcuts } from "./Shortcuts";
import { Sidebar, type AiProviderKind } from "./Sidebar";

type Nav = { counts: NavCounts; notices: Notice[] };

/** Asks the shell to reset the demo (with a confirmation) from anywhere in the app. */
export const requestDemoReset = () => window.dispatchEvent(new Event("exhibit:reset-demo"));

const openAsk = () => window.dispatchEvent(new CustomEvent("exhibit:ask"));

/** The sheet's two top corners, drawn over content that scrolls under the sticky top bar so the sheet keeps its shape. */
function Corner({ side }: { side: "l" | "r" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className={clsx("pointer-events-none absolute top-full", side === "l" ? "left-0" : "right-2 -scale-x-100")}>
      <path d="M0 0H12V0.5A11.5 11.5 0 0 0 0.5 12H0Z" fill="var(--frame)" />
      <path d="M12 0.5A11.5 11.5 0 0 0 0.5 12" fill="none" stroke="var(--line)" />
    </svg>
  );
}

/**
 * The frame: a tinted L of sidebar and top bar on #f6f6f5 with no rule between them, and the work on a white
 * sheet inset 8px from the window's right and bottom edges, 12px corners, a 1px edge and no shadow. The page
 * scrolls as a document, so the sheet's content passes under the sticky top bar. On phones and tablets the frame
 * folds: a 48px bar with the menu, the mark, Ask and notifications, and the sheet becomes the screen.
 */
export function AppShell({ merchant, mode, provider, nav: initialNav, demo, palette, children }: { merchant: string; mode: "demo" | "sandbox"; provider: AiProviderKind; nav: Nav; demo: DemoStatus | null; palette: React.ReactNode; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [nav, setNav] = useState(initialNav);
  const [menu, setMenu] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [real, setReal] = useState(false);
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

  // Refresh counts on every navigation (a filing on one page changes another page's count).
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

  const isDemo = mode === "demo" && !!demo;
  const shell = (
    <div className="app-shell flex min-h-dvh flex-col overflow-x-clip bg-frame text-ink lg:flex-row">
      <Sidebar merchant={merchant} mode={mode} counts={nav.counts} open={menu} onClose={() => setMenu(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop top bar: the environment, Ask Exhibit, the guide and notifications. */}
        <header className="sticky top-0 z-30 hidden h-12 grid-cols-[minmax(0,1fr)_minmax(240px,360px)_minmax(0,1fr)] items-center gap-4 bg-frame pl-6 pr-4 lg:grid xl:grid-cols-[minmax(0,1fr)_minmax(320px,440px)_minmax(0,1fr)]">
          <EnvLine mode={mode} provider={provider} onWhatsReal={isDemo ? () => setReal(true) : undefined} />
          <button type="button" onClick={openAsk} className="group flex h-8 w-full items-center gap-2 rounded-[8px] border border-line-strong bg-surface pl-2.5 pr-1.5 text-left text-[13px] text-muted transition-colors hover:border-[#cdcdca] hover:text-ink-2">
            <Search className="size-3.5 shrink-0" strokeWidth={1.8} />
            <span className="min-w-0 flex-1 truncate">Ask Exhibit, or jump to a case</span>
            <span className="flex gap-0.5">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="flex items-center justify-end gap-1">
            {isDemo ? <GuideButton /> : null}
            <Notifications notices={nav.notices} />
          </div>
          <Corner side="l" />
          <Corner side="r" />
          <span aria-hidden className="pointer-events-none absolute left-3 right-5 top-full h-px bg-line" />
        </header>

        {/* Phone and tablet bar. */}
        <header className="sticky top-0 z-30 flex h-12 items-center gap-1 border-b border-line bg-frame px-2 sm:px-4 lg:hidden">
          <button type="button" onClick={() => setMenu(true)} aria-label="Open menu" className="flex size-10 items-center justify-center rounded-[8px] text-ink-2 hover:bg-active">
            <Menu className="size-[18px]" />
          </button>
          <Link href="/app" aria-label="Exhibit, overview" className="flex items-center gap-2 rounded-[6px] px-1">
            <LogoMark size={22} />
            <span className="text-[15.5px] font-semibold leading-none tracking-[-0.045em]">Exhibit</span>
          </Link>
          <div className="ml-auto flex items-center gap-0.5">
            <button type="button" onClick={openAsk} aria-label="Ask Exhibit" className="flex size-10 items-center justify-center rounded-[8px] text-ink-2 hover:bg-active">
              <Search className="size-4" />
            </button>
            {isDemo ? <GuideButton compact /> : null}
            <Notifications notices={nav.notices} />
          </div>
        </header>
        {isDemo ? <DemoStrip provider={provider} onWhatsReal={() => setReal(true)} /> : null}

        <main className="relative min-w-0 flex-1 bg-surface pb-10 lg:mb-2 lg:mr-2 lg:min-h-[calc(100dvh-56px)] lg:rounded-[12px] lg:border lg:border-line">{children}</main>
      </div>
      {palette}
      <Shortcuts />
      <Toaster />
      {isDemo ? <WhatsReal open={real} onClose={() => setReal(false)} provider={provider} idleMinutes={demo.idleMinutes} onReset={() => setConfirmReset(true)} /> : null}
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
        <p className="text-[14px] leading-[22px] text-ink-2">
          Kora Atelier goes back to a fresh start: eight open disputes with deadlines counted from now, briefs prepared on six of them, prevention orders back on the radar, and the audit log cleared. This is a shared demo, so it also resets on its own after {demo?.idleMinutes ?? 20} quiet minutes.
        </p>
        <p className="mt-2 text-[13px] text-muted">Only the demo merchant is affected. Sandbox mode is never reset.</p>
      </Dialog>
    </div>
  );
  return isDemo ? <DemoGuideProvider initial={demo}>{shell}</DemoGuideProvider> : shell;
}
