"use client";

import { clsx } from "clsx";
import { RotateCcw } from "lucide-react";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Tip } from "../ui/Tooltip";
import type { AiProviderKind } from "./Sidebar";

const AI_SHORT: Record<AiProviderKind, string> = { replay: "recorded Claude runs", "claude-code": "Claude CLI, live", anthropic: "Claude API, live" };

const AI_TIP: Record<AiProviderKind, string> = {
  replay: "The agent's reasoning comes from recorded Claude runs; every tool call, check and PayPal request executes live",
  "claude-code": "The agent runs live on this machine's Claude CLI login",
  anthropic: "The agent runs live on the Claude API",
};

/** The environment in one line, at the top bar's left: where PayPal calls go and how the agent runs. It truncates before it touches the search. */
export function EnvLine({ mode, provider, onWhatsReal, className }: { mode: "demo" | "sandbox"; provider: AiProviderKind; onWhatsReal?: () => void; className?: string }) {
  return (
    <div className={clsx("flex min-w-0 items-center gap-2 text-[13px] text-muted", className)}>
      <span className={clsx("size-1.5 shrink-0 rounded-full", mode === "sandbox" ? "bg-green" : "bg-amber")} aria-hidden />
      <Tip label={`${mode === "sandbox" ? "Every call goes to api-m.sandbox.paypal.com." : "PayPal's API is simulated: real request shapes, errors and limits."} ${AI_TIP[provider]}.`} side="bottom" align="start" wide className="min-w-0">
        <span className="min-w-0 truncate">
          {mode === "sandbox" ? "PayPal sandbox, live API" : "PayPal simulator"}
          <span className="hidden min-[1360px]:inline"> · {AI_SHORT[provider]}</span>
        </span>
      </Tip>
      {onWhatsReal ? (
        <button type="button" onClick={onWhatsReal} className="shrink-0 rounded-[6px] px-1 font-medium text-ink underline decoration-line-strong underline-offset-[3px] transition-colors hover:decoration-ink">
          What&apos;s real?
        </button>
      ) : null}
    </div>
  );
}

/** Below the phone and tablet top bar, demo only: the same line, so demo data is labelled at every width. */
export function DemoStrip({ provider, onWhatsReal }: { provider: AiProviderKind; onWhatsReal: () => void }) {
  return (
    <div className="flex h-9 items-center gap-2 border-b border-line bg-frame px-4 text-[13px] text-muted sm:px-6 lg:hidden">
      <span className="size-1.5 shrink-0 rounded-full bg-amber" aria-hidden />
      <span className="min-w-0 truncate">
        <span className="font-medium text-ink-2">Demo merchant</span> · PayPal simulator · {AI_SHORT[provider]}
      </span>
      <button type="button" onClick={onWhatsReal} className="ml-auto shrink-0 font-medium text-ink underline decoration-line-strong underline-offset-[3px]">
        What&apos;s real?
      </button>
    </div>
  );
}

function Part({ title, tone, children }: { title: string; tone?: "real" | "plain"; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-line pt-3 first:border-0 first:pt-0 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-5">
      <div className="flex items-center gap-2 text-[14px] font-medium text-ink sm:items-start">
        <span className={clsx("size-1.5 shrink-0 rounded-full sm:mt-2", tone === "real" ? "bg-green" : "bg-ghost")} aria-hidden />
        {title}
      </div>
      <p className="text-[14px] leading-[22px] text-ink-2">{children}</p>
    </div>
  );
}

/** Exactly what in the demo is real, simulated, recorded or made up. */
export function WhatsReal({ open, onClose, provider, idleMinutes, onReset }: { open: boolean; onClose: () => void; provider: AiProviderKind; idleMinutes: number; onReset: () => void }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="What's real in this demo"
      width={640}
      footer={
        <>
          <span className="mr-auto text-[12px] text-muted">Resets on its own after {idleMinutes} minutes without activity.</span>
          <Button
            size="sm"
            onClick={() => {
              onClose();
              onReset();
            }}
          >
            <RotateCcw className="size-3.5" /> Reset demo
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Part title="Real, running now" tone="real">
          Exhibit&apos;s PayPal client (the same code path the live sandbox uses), the agent&apos;s nine tools executing against each case, citation checks on every brief, the check that each brief asks only for an action PayPal allows on the dispute, the evidence packet PDF, the approval queue, Autopilot&apos;s rules and the audit log.
        </Part>
        <Part title="Simulated">
          PayPal&apos;s servers. A built-in simulator implements the Disputes v1, Orders v2 and Payments v2 endpoints Exhibit uses, with PayPal&apos;s request and response shapes, error codes and file limits. The buyer&apos;s side and PayPal&apos;s ruling are simulator controls on the case page.
        </Part>
        <Part title={provider === "replay" ? "Recorded" : "Live"} tone={provider === "replay" ? "plain" : "real"}>
          {provider === "replay" ? (
            <>The agent&apos;s reasoning on these demo cases comes from Claude runs recorded on 20 Oct 2026. The tool calls, validation and filing run live each time. Sign in to the Claude CLI or set ANTHROPIC_API_KEY and the same agent runs live.</>
          ) : (
            <>The agent runs live on {provider === "claude-code" ? "the Claude CLI login on this machine" : "the Claude API"}. If it can&apos;t start, a recorded run takes over and the trace says so.</>
          )}
        </Part>
        <Part title="Demo data">Kora Atelier, its orders, buyers and carrier scans are fictional. The 90-day history behind the charts is generated and labelled.</Part>
        <p className="rounded-[8px] bg-sunken px-3.5 py-3 text-[13px] leading-[20px] text-ink-2">
          <span className="font-medium text-ink">Sandbox mode</span> runs this same code against api-m.sandbox.paypal.com with real OAuth, real disputes and real filings: <span className="mono text-[12px]">provide-evidence</span>, <span className="mono text-[12px]">provide-supporting-info</span> and <span className="mono text-[12px]">adjudicate</span> were verified there on 20 Oct 2026. The demo never touches sandbox data.
        </p>
      </div>
    </Dialog>
  );
}
