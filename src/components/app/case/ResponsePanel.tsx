"use client";

import { clsx } from "clsx";
import { Check, ChevronDown, FileText, Gavel, Languages, Loader2, Pencil, RotateCcw, Send, X } from "lucide-react";
import { useState } from "react";
import type { CaseBrief } from "@/lib/agent/brief";
import type { ProtectionReport } from "@/lib/agent/playbook";
import type { AutopilotVerdict } from "@/lib/autopilot";
import type { ActionResult } from "@/lib/actions";
import { dateTime } from "@/lib/format";
import type { Dispute } from "@/lib/paypal/types";
import { Button } from "../../ui/Button";
import { Chip } from "../../ui/Chip";
import { Tabs } from "../../ui/Tabs";
import { ANSWER_LABEL, API_OF, actionLabel, actorLabel, canAct, type ActionRow } from "./caseState";
import { CitedText, type Cite } from "./CitedText";

export const LETTER_MAX = 1900;

const VERDICT_TONE = { LIKELY_ELIGIBLE: "green", AT_RISK: "outline", NOT_ELIGIBLE: "red", NOT_APPLICABLE: "neutral" } as const;
const VERDICT_LABEL = { LIKELY_ELIGIBLE: "Likely protected", AT_RISK: "At risk", NOT_ELIGIBLE: "Not protected", NOT_APPLICABLE: "Not covered" } as const;

export function protectionChip(report: ProtectionReport) {
  return { tone: VERDICT_TONE[report.verdict], label: VERDICT_LABEL[report.verdict] };
}

export function ProtectionCard({ report, defaultOpen = false }: { report: ProtectionReport; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const passed = report.checks.filter((c) => c.status === "pass").length;
  return (
    <section className="card border px-5 py-4">
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-ink">PayPal Seller Protection</span>
          <span className="mt-0.5 block text-[13px] text-muted">
            {passed} of {report.checks.length} requirements met on the records we hold
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          <Chip tone={VERDICT_TONE[report.verdict]}>{VERDICT_LABEL[report.verdict]}</Chip>
          <ChevronDown className={clsx("size-4 text-ghost transition-transform", open && "rotate-180")} />
        </span>
      </button>
      <p className="mt-2 text-[13px] leading-[20px] text-ink-2">{report.summary}</p>
      {open ? (
        <ul className="mt-3 border-t border-line pt-1">
          {report.checks.map((c) => (
            <li key={c.id} className="flex gap-2.5 border-b border-rule py-2.5 text-[13px] leading-[19px] last:border-0">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center" aria-label={c.status === "pass" ? "Met" : c.status === "fail" ? "Not met" : "Not applicable"}>
                {c.status === "pass" ? <Check className="size-3.5 text-green" strokeWidth={2.6} /> : c.status === "fail" ? <X className="size-3.5 text-red" strokeWidth={2.6} /> : <span className="size-1.5 rounded-full bg-ghost" />}
              </span>
              <div className="min-w-0">
                <div className="font-medium text-ink">{c.label}</div>
                <div className="text-muted">{c.detail}</div>
                {c.quote ? <div className="mt-1 border-l-2 border-line pl-2.5 text-[12px] leading-[18px] text-muted">“{c.quote}”</div> : null}
              </div>
            </li>
          ))}
          <li className="pt-2.5 text-[12px] text-muted">
            Requirements quoted from{" "}
            <a className="text-ink-2 underline decoration-line-strong underline-offset-2 hover:decoration-ink" href={report.source} target="_blank" rel="noreferrer">
              PayPal&apos;s Seller Protection program
            </a>
            . PayPal makes the final decision.
          </li>
        </ul>
      ) : null}
    </section>
  );
}

type Props = {
  dispute: Dispute;
  brief: CaseBrief;
  letter: string;
  setLetter: (v: string) => void;
  message: string;
  setMessage: (v: string) => void;
  editing: boolean;
  setEditing: (v: boolean) => void;
  cites: Cite[];
  onHoverRef: (ref: string | null) => void;
  autopilot: AutopilotVerdict | null;
  mode: string;
  answered: ActionRow | undefined;
  lastAction: ActionResult | null;
  submitting: boolean;
  onSubmit: () => void;
  onShowCalls: () => void;
  onSandbox: (op: "decide" | "require_evidence" | "buyer_accepts_offer", outcome?: "SELLER_FAVOR" | "BUYER_FAVOR") => Promise<void>;
  highlight?: boolean;
};

/** What Exhibit will send: the letter (with its citations), the buyer message, and the one action. */
export function ResponsePanel(p: Props) {
  const { dispute, brief } = p;
  const amount = Number(dispute.dispute_amount.value);
  const letterUsed = brief.paypal_action.type !== "send_message";
  const [tab, setTab] = useState<"letter" | "buyer">(letterUsed ? "letter" : "buyer");
  const [english, setEnglish] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const allowed = canAct(dispute, brief);
  const packetUsed = ["provide_evidence", "refund_then_prove", "provide_supporting_info"].includes(brief.paypal_action.type);
  const tooLong = p.letter.length > LETTER_MAX;
  const edited = p.letter !== brief.response_letter || (brief.buyer_message ? p.message !== brief.buyer_message.text : false);
  const done = p.lastAction?.ok ? p.lastAction : null;

  const sandbox = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <section className={clsx("card overflow-hidden border", p.highlight && "shadow-[0_0_0_2px_var(--ink)]")} id="response" aria-label="What Exhibit will send">
        <div className="flex items-center justify-between gap-3 border-b border-line pl-5 pr-3">
          <Tabs
            size="sm"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: "letter", label: "Response to PayPal", hidden: !letterUsed },
              { key: "buyer", label: brief.buyer_message ? `Message to buyer${brief.buyer_message.language !== "en" ? ` · ${brief.buyer_message.language.toUpperCase()}` : ""}` : "Message to buyer", hidden: !brief.buyer_message },
            ]}
          />
          <div className="flex shrink-0 items-center gap-2">
            {tab === "letter" ? <span className={clsx("num text-[12px]", tooLong ? "font-medium text-red" : "text-muted")}>{p.letter.length.toLocaleString("en-US")} / {LETTER_MAX.toLocaleString("en-US")}</span> : null}
            {tab === "buyer" && brief.buyer_message?.english && !p.editing ? (
              <Button size="sm" variant="ghost" onClick={() => setEnglish(!english)}>
                <Languages className="size-3.5" /> {english ? "Original" : "English"}
              </Button>
            ) : null}
            {!done && !p.answered ? (
              <Button size="sm" variant={p.editing ? "secondary" : "ghost"} onClick={() => p.setEditing(!p.editing)} title="Edit (E)">
                {p.editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
                {p.editing ? "Done" : "Edit"}
              </Button>
            ) : null}
          </div>
        </div>
        <div className="px-5 py-4">
          {tab === "letter" ? (
            p.editing ? (
              <textarea autoFocus value={p.letter} onChange={(e) => p.setLetter(e.target.value)} rows={14} aria-label="Response to PayPal" className="scroll-thin outline-none w-full resize-y rounded-[8px] border border-line-strong bg-surface p-3 text-[14px] leading-[22px] text-ink focus:border-ink focus:shadow-[0_0_0_1px_var(--ink)]" />
            ) : (
              <CitedText text={p.letter} cites={p.cites} exhibits={brief.exhibits} onHover={p.onHoverRef} className="scroll-thin max-h-[400px] overflow-y-auto pr-1 text-[14px] leading-[23px] text-ink-2" />
            )
          ) : brief.buyer_message ? (
            p.editing ? (
              <textarea autoFocus value={p.message} onChange={(e) => p.setMessage(e.target.value)} rows={10} aria-label="Message to buyer" className="scroll-thin outline-none w-full resize-y rounded-[8px] border border-line-strong bg-surface p-3 text-[14px] leading-[22px] text-ink focus:border-ink focus:shadow-[0_0_0_1px_var(--ink)]" />
            ) : (
              <CitedText text={english && brief.buyer_message.english ? brief.buyer_message.english : p.message} cites={p.cites} exhibits={brief.exhibits} onHover={p.onHoverRef} className="scroll-thin max-h-[400px] overflow-y-auto pr-1 text-[14px] leading-[23px] text-ink-2" />
            )
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="mono inline-flex size-4 items-center justify-center rounded-[4px] bg-ink text-[11px] font-semibold text-white">A</span> an exhibit in the packet
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="underline decoration-dotted decoration-[1.5px] underline-offset-[3px]">1Z84…</span> matches a record; hover for the source
            </span>
            {edited && !p.answered && !done ? (
              <button
                type="button"
                onClick={() => {
                  p.setLetter(brief.response_letter);
                  p.setMessage(brief.buyer_message?.text ?? "");
                }}
                className="ml-auto inline-flex items-center gap-1 rounded-[6px] text-ink-2 hover:text-ink"
              >
                <RotateCcw className="size-3" /> Back to Exhibit&apos;s draft
              </button>
            ) : null}
          </div>
        </div>

        <div className="border-t border-line px-5 py-4">
          {done || p.answered ? (
            <div>
              <div className="flex items-center gap-2 text-[14px] font-medium text-green">
                <Check className="size-4" strokeWidth={2.6} />
                {done ? "Sent to PayPal" : (ANSWER_LABEL[p.answered!.kind] ?? "Filed")}
              </div>
              <p className="mt-1.5 text-[13px] leading-[20px] text-ink-2">
                {done ? done.detail : `${ANSWER_LABEL[p.answered!.kind] ?? "Filed"} by ${actorLabel(p.answered!.actor)} on ${dateTime(p.answered!.created_at)}.`} {dispute.status === "RESOLVED" ? "PayPal has closed the case." : "PayPal has it now; the case updates when PayPal responds."}
              </p>
              <button type="button" onClick={p.onShowCalls} className="mt-2 rounded-[4px] text-[12px] text-muted underline decoration-line-strong underline-offset-2 hover:text-ink">
                <span className="mono">{API_OF[done?.kind ?? p.answered?.kind ?? ""] ?? "PayPal call"}</span> → 200 · see the call
              </button>
            </div>
          ) : (
            <>
              {p.autopilot ? (
                <div className="mb-3 flex gap-2 text-[13px] leading-[19px] text-muted">
                  <Gavel className="mt-0.5 size-3.5 shrink-0" />
                  <span>{p.autopilot.reason}</span>
                </div>
              ) : null}
              <Button variant="primary" size="lg" className="w-full" disabled={!allowed || p.submitting || tooLong || p.editing} onClick={p.onSubmit}>
                {p.submitting ? <Loader2 className="size-4 animate-spin" /> : packetUsed ? <FileText className="size-4" /> : <Send className="size-4" />}
                {actionLabel(brief, amount)}
              </Button>
              <div className="mono mt-2 truncate text-center text-[11px] text-faint" title={API_OF[brief.paypal_action.type]}>
                {API_OF[brief.paypal_action.type]}
              </div>
              {p.editing ? <p className="mt-2 text-center text-[13px] text-muted">Finish editing to send.</p> : null}
              {tooLong ? <p className="mt-2 text-center text-[13px] text-red">PayPal accepts up to {LETTER_MAX.toLocaleString("en-US")} characters.</p> : null}
              {!allowed ? <p className="mt-2 text-center text-[13px] leading-[19px] text-muted">{dispute.status === "UNDER_REVIEW" ? "PayPal is reviewing this case and isn't asking for this action now." : "PayPal is not waiting on you for this case right now."}</p> : null}
              {p.lastAction && !p.lastAction.ok ? (
                <div className="mt-3 rounded-[8px] bg-red-soft px-3 py-2.5 text-[13px] text-red">
                  {p.lastAction.error}
                  {p.lastAction.issue ? (
                    <div className="mono mt-1 text-[12px]">
                      issue {p.lastAction.issue}
                      {p.lastAction.debugId ? ` · debug_id ${p.lastAction.debugId}` : ""}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      {dispute.status === "UNDER_REVIEW" || (p.mode === "demo" && dispute.status === "WAITING_FOR_BUYER_RESPONSE") ? (
        <section className="rounded-[10px] border border-dashed border-line-strong px-5 py-4">
          <h3 className="text-[13px] font-medium text-ink">{p.mode === "demo" ? "Simulator controls" : "Sandbox controls"}</h3>
          <p className="mb-3 mt-0.5 text-[13px] leading-[19px] text-muted">
            {dispute.status === "UNDER_REVIEW"
              ? p.mode === "demo"
                ? "Stand in for PayPal's reviewer. In the sandbox this is PayPal's adjudicate endpoint."
                : "Stand in for PayPal's reviewer with the sandbox-only adjudicate endpoint."
              : "Stand in for the buyer and accept the offer."}
          </p>
          {dispute.status === "UNDER_REVIEW" ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!!busy} onClick={() => sandbox("seller", () => p.onSandbox("decide", "SELLER_FAVOR"))}>
                {busy === "seller" ? <Loader2 className="size-3.5 animate-spin" /> : null} Rule for the merchant
              </Button>
              <Button size="sm" disabled={!!busy} onClick={() => sandbox("buyer", () => p.onSandbox("decide", "BUYER_FAVOR"))}>
                {busy === "buyer" ? <Loader2 className="size-3.5 animate-spin" /> : null} Rule for the buyer
              </Button>
            </div>
          ) : (
            <Button size="sm" disabled={!!busy} onClick={() => sandbox("accept", () => p.onSandbox("buyer_accepts_offer"))}>
              {busy === "accept" ? <Loader2 className="size-3.5 animate-spin" /> : null} Buyer accepts the offer
            </Button>
          )}
        </section>
      ) : null}
    </div>
  );
}
