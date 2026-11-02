"use client";

import { CircleCheck, FlaskConical, ListChecks, Mic, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import type { AiProviderKind } from "./Sidebar";

const AI_LINE: Record<AiProviderKind, string> = {
  replay: "recorded Claude runs, every tool call executed live",
  "claude-code": "the agent runs live on this machine's Claude CLI",
  anthropic: "the agent runs live on the Claude API",
};

/** A slim, always-visible line that says exactly what in the demo is real, simulated or recorded. */
export function DemoBanner({ provider, idleMinutes, onReset, onGuide }: { provider: AiProviderKind; idleMinutes: number; onReset: () => void; onGuide: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex min-h-9 items-center gap-3 border-b border-line bg-[#fcfcfc] px-4 py-1.5 text-[12px] text-ink-2 sm:px-6 lg:px-8">
        <span className="size-1.5 shrink-0 rounded-full bg-amber" aria-hidden />
        <p className="min-w-0 flex-1 truncate">
          <span className="font-medium text-ink">Demo merchant</span>
          <span className="text-muted"> · fictional store and buyers · PayPal simulator with the real API&apos;s shapes and errors · {AI_LINE[provider]}</span>
        </p>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded px-1.5 py-0.5 font-medium text-ink underline decoration-line-strong underline-offset-2 transition-colors hover:decoration-ink">
          What&apos;s real?
        </button>
        <button type="button" onClick={onGuide} className="hidden shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-muted transition-colors hover:text-ink sm:inline-flex">
          <ListChecks className="size-3.5" /> Guide
        </button>
        <button type="button" onClick={onReset} className="hidden shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-muted transition-colors hover:text-ink sm:inline-flex">
          <RotateCcw className="size-3.5" /> Reset demo
        </button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="What's real in this demo"
        width={600}
        footer={
          <>
            <span className="mr-auto text-[11.5px] text-muted">Resets on its own after {idleMinutes} minutes without activity.</span>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                onReset();
              }}
            >
              <RotateCcw className="size-3.5" /> Reset demo
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-[13px] leading-relaxed text-ink-2">
          <Section icon={<CircleCheck className="size-4 text-green" />} title="Real, running now">
            Exhibit&apos;s PayPal client (the same code path the live sandbox uses), the agent&apos;s nine tools executing against each case, citation checks on every brief, the check that an action is one PayPal currently allows, the evidence packet PDF, the approval queue, Autopilot&apos;s rules and the audit log.
          </Section>
          <Section icon={<FlaskConical className="size-4 text-ink" />} title="Simulated">
            PayPal&apos;s servers. A built-in simulator implements the Disputes v1, Orders v2 and Payments v2 endpoints Exhibit uses, with PayPal&apos;s request and response shapes, error codes and file limits. The buyer&apos;s side and PayPal&apos;s ruling are simulator controls on the case page.
          </Section>
          <Section icon={<Mic className="size-4 text-ink" />} title={provider === "replay" ? "Recorded" : "Live"}>
            {provider === "replay" ? (
              <>The agent&apos;s reasoning on these demo cases comes from Claude runs recorded on 20 Oct 2026. The tool calls, validation and filing run live each time. Sign in to the Claude CLI or set ANTHROPIC_API_KEY and the same agent runs live.</>
            ) : (
              <>The agent runs live on {provider === "claude-code" ? "the Claude CLI login on this machine" : "the Claude API"}. If it can&apos;t start, a recorded run takes over and the trace says so.</>
            )}
          </Section>
          <Section icon={<span className="size-2 rounded-full bg-amber" />} title="Demo data">
            Kora Atelier, its orders, buyers and carrier scans are fictional. The 90-day history behind the charts is generated and labelled.
          </Section>
          <div className="rounded-lg bg-sunken px-3.5 py-3 text-[12.5px]">
            <span className="font-medium text-ink">Sandbox mode</span> runs this same code against api-m.sandbox.paypal.com with real OAuth, real disputes and real filings: <span className="num">provide-evidence</span>, <span className="num">provide-supporting-info</span> and <span className="num">adjudicate</span> were verified there on 20 Oct 2026. The demo never touches sandbox data.
          </div>
        </div>
      </Dialog>
    </>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center">{icon}</span>
      <div>
        <div className="font-medium text-ink">{title}</div>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  );
}
