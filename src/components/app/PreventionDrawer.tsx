"use client";

import { clsx } from "clsx";
import { ArrowRight, Check, ExternalLink, Languages, Loader2, Pencil, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MessageDraft, PreventionAction, PreventionFixOption, PreventionOrder, PreventionTimelineEvent } from "@/lib/prevention";
import { relTime, shortDate } from "@/lib/format";
import { Button } from "../ui/Button";
import { BAND, bandOf, BandPill, money, ScoreRing, SIGNAL_ICON } from "./PreventionParts";

const TONE: Record<PreventionTimelineEvent["tone"], string> = { neutral: "#c9c9c6", good: "#15803d", warn: "#8a8a87", bad: "#b91c1c" };
const MESSAGE_ACTIONS: PreventionAction[] = ["message_buyer", "hold_and_verify"];

export type FixHandler = (orderId: string, action: PreventionAction, message?: { subject?: string; body: string }) => Promise<boolean>;

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-6 py-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function MessagePreview({ draft, body, setBody }: { draft: MessageDraft; body: string; setBody: (s: string) => void }) {
  const [english, setEnglish] = useState(false);
  const [editing, setEditing] = useState(false);
  const shown = english && draft.translation ? draft.translation : { subject: draft.subject, body };
  return (
    <div className="mt-3 overflow-hidden rounded-[10px] border border-line">
      <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-1.5">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
          <Languages className="size-3.5" />
          Written in {draft.languageName}
        </span>
        <span className="flex items-center gap-1">
          {draft.translation ? (
            <button type="button" aria-pressed={english} onClick={() => setEnglish((v) => !v)} className={clsx("h-7 rounded-[6px] px-2 text-[12px] transition-colors", english ? "bg-active text-ink" : "text-ink-2 hover:bg-active")}>
              {english ? "Showing English" : "Show English"}
            </button>
          ) : null}
          {!english ? (
            <button type="button" aria-pressed={editing} onClick={() => setEditing((v) => !v)} className={clsx("inline-flex h-7 items-center gap-1 rounded-[6px] px-2 text-[12px] transition-colors", editing ? "bg-active text-ink" : "text-ink-2 hover:bg-active")}>
              <Pencil className="size-3" /> {editing ? "Done" : "Edit"}
            </button>
          ) : null}
        </span>
      </div>
      <div className="px-3.5 py-3">
        <div className="text-[13px] font-medium text-ink">{shown.subject}</div>
        {editing && !english ? (
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} aria-label="Message to the buyer" className="outline-none mt-2 w-full resize-none rounded-[8px] border border-line-strong bg-surface p-2.5 text-[13px] leading-[20px] text-ink focus:border-ink focus:shadow-[0_0_0_1px_var(--ink)]" />
        ) : (
          <p className="scroll-thin mt-1.5 max-h-[188px] overflow-y-auto whitespace-pre-line text-[13px] leading-[20px] text-ink-2">{shown.body}</p>
        )}
      </div>
    </div>
  );
}

function FixButton({ fix, busy, disabled, onClick }: { fix: PreventionFixOption; busy: boolean; disabled: boolean; onClick: () => void }) {
  if (fix.primary)
    return (
      <div>
        <Button variant="primary" size="lg" className="w-full" onClick={onClick} disabled={disabled}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : fix.channel === "inbox" ? <Send className="size-4" /> : <ArrowRight className="size-4" />}
          {fix.label}
        </Button>
        <div className="mt-1.5 truncate text-center text-[12px] text-muted">{fix.api ? <span className="mono text-[11px]">{fix.api}</span> : fix.channel === "inbox" ? "From the support inbox, in the buyer's language" : fix.detail}</div>
      </div>
    );
  return (
    <Button variant={fix.action === "dismiss" ? "ghost" : "secondary"} size="sm" disabled={disabled} onClick={onClick}>
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {fix.label}
    </Button>
  );
}

export function PreventionDrawer({ order, onClose, onFix, success }: { order: PreventionOrder; onClose: () => void; onFix: FixHandler; success: { saved: number } | null }) {
  const [draft, setDraft] = useState<MessageDraft | null>(null);
  const [draftFor, setDraftFor] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState<PreventionAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsDraft = order.fixes.some((f) => MESSAGE_ACTIONS.includes(f.action));
  const draftKey = `${order.orderId}:${order.signals.map((s) => s.kind).join(",")}`;

  useEffect(() => {
    if (!needsDraft || draftFor === draftKey) return;
    let live = true;
    fetch(`/api/prevention?orderId=${encodeURIComponent(order.orderId)}`)
      .then((r) => r.json())
      .then((j: { draft: MessageDraft | null }) => {
        if (!live) return;
        setDraft(j.draft);
        setBody(j.draft?.body ?? "");
        setDraftFor(draftKey);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [needsDraft, draftKey, draftFor, order.orderId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async (action: PreventionAction) => {
    setBusy(action);
    setError(null);
    const custom = MESSAGE_ACTIONS.includes(action) && draft && body !== draft.body ? { subject: draft.subject, body } : undefined;
    const ok = await onFix(order.orderId, action, custom);
    if (!ok) setError("PayPal rejected the request. The error is in PayPal activity.");
    setBusy(null);
  };

  const b = bandOf(order);
  const primary = order.fixes.find((f) => f.primary);
  const secondary = order.fixes.filter((f) => !f.primary);
  const messageFix = order.fixes.find((f) => MESSAGE_ACTIONS.includes(f.action));

  return (
    <>
      <div className="pv-fade fixed inset-0 z-40 bg-[rgb(10_10_10/0.14)]" onClick={onClose} />
      <aside className="app-shell pv-drawer scroll-thin fixed inset-y-0 right-0 z-50 flex w-[520px] max-w-[100vw] flex-col overflow-y-auto border-l border-line bg-surface shadow-[-24px_0_48px_rgb(0_0_0/0.08)]" role="dialog" aria-modal="true" aria-label={`Order ${order.orderId}`}>
        <header className="sticky top-0 z-10 flex items-start gap-4 border-b border-line bg-surface px-6 pb-4 pt-5">
          <ScoreRing score={order.score} band={success ? "prevented" : b} size={56} stroke={4} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-[20px] font-semibold leading-7 tracking-[-0.015em] text-ink">{order.buyer}</h2>
              <span className="mono rounded-[4px] border border-line-strong px-1 text-[11px] text-muted" title="Buyer's country">
                {order.country}
              </span>
            </div>
            <div className="mt-0.5 truncate text-[13px] text-muted">
              <span className="mono text-[12px]">{order.orderId}</span> · {order.item}
            </div>
            <div className="mt-2">
              <BandPill band={success ? "prevented" : b} />
            </div>
            <div className="mt-1 text-[13px] text-muted">
              <span className="mono text-[12px] text-ink">{money(order.exposure)}</span> exposure: <span className="mono text-[12px]">{money(order.exposure - order.fee)}</span> order + <span className="mono text-[12px]">{money(order.fee)}</span> PayPal {order.funding === "CARD" ? "chargeback" : "dispute"} fee
            </div>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 -mt-1 flex size-8 items-center justify-center rounded-[8px] text-muted transition-colors hover:bg-active hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </header>

        {success ? (
          <div className="pv-pop mx-6 mt-5 flex items-center gap-3 rounded-[10px] bg-green-soft px-4 py-3.5">
            <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-green" aria-hidden>
              <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="pv-check" />
            </svg>
            <div>
              <div className="text-[14px] font-medium text-green">Dispute prevented</div>
              <div className="text-[13px] text-green">
                <span className="num">{money(success.saved)}</span> {success.saved <= order.fee + 0.01 ? "in PayPal fees saved, and the customer kept" : "of exposure off the table"}
              </div>
            </div>
          </div>
        ) : null}

        <Section title="Why it's at risk" aside={<span className="num text-[13px] text-muted">{order.signals.length} signal{order.signals.length === 1 ? "" : "s"}</span>}>
          <ul>
            {order.signals.map((s) => {
              const Icon = SIGNAL_ICON[s.kind];
              return (
                <li key={s.kind} className="border-b border-rule py-3 first:pt-0 last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.7} />
                    <span className="flex-1 text-[14px] font-medium text-ink">{s.label}</span>
                    <span className="inline-flex items-center gap-1 text-[12px] text-muted">
                      <ArrowRight className="size-3" /> {s.reasonLabel}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] leading-[20px] text-ink-2">{s.detail}</p>
                  {s.quote ? <p className="mt-2 border-l-2 border-line-strong pl-2.5 text-[13px] leading-[20px] text-muted">“{s.quote}”</p> : null}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-[#ededeb]">
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${s.weight}%`, background: s.weight >= 65 ? BAND.high.color : s.weight >= 40 ? BAND.elevated.color : BAND.watch.color }} />
                    </span>
                    <span className="num w-16 text-right text-[12px] text-muted">+{s.weight} risk</span>
                  </div>
                </li>
              );
            })}
            {!order.signals.length ? <li className="text-[13px] text-muted">Nothing left on this order. Exhibit keeps watching for new scans and messages.</li> : null}
          </ul>
        </Section>

        {primary && !success ? (
          <Section title="Fix it now">
            <p className="mb-3 text-[13px] leading-[20px] text-ink-2">{primary.detail}</p>
            {messageFix && draft ? <MessagePreview key={draftFor ?? ""} draft={draft} body={body} setBody={setBody} /> : messageFix && !draft ? <div className="skeleton mt-3 h-40 rounded-[10px]" /> : null}
            <div className="mt-4">
              <FixButton fix={primary} busy={busy === primary.action} disabled={!!busy} onClick={() => run(primary.action)} />
            </div>
            {secondary.length ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {secondary.map((f) => (
                  <FixButton key={f.action} fix={f} busy={busy === f.action} disabled={!!busy} onClick={() => run(f.action)} />
                ))}
              </div>
            ) : null}
            {error ? <p role="alert" className="mt-3 text-[13px] text-red">{error}</p> : null}
          </Section>
        ) : null}

        {order.shipment ? (
          <Section
            title="Shipment"
            aside={
              <a href={order.shipment.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-[4px] text-[13px] text-ink-2 hover:text-ink">
                Carrier page <ExternalLink className="size-3" />
              </a>
            }
          >
            <div className="grid grid-cols-3 gap-3 text-[13px]">
              <div>
                <div className="text-[12px] text-muted">Carrier</div>
                <div className="mt-0.5 text-ink">{order.shipment.carrier}</div>
              </div>
              <div>
                <div className="text-[12px] text-muted">Tracking</div>
                <div className="mono mt-0.5 truncate text-[12px] leading-5 text-ink">{order.shipment.tracking}</div>
              </div>
              <div>
                <div className="text-[12px] text-muted">On PayPal</div>
                <div className={clsx("mt-0.5 inline-flex items-center gap-1", order.shipment.onPayPal ? "text-ink-2" : "font-medium text-ink")}>
                  {order.shipment.onPayPal ? <Check className="size-3.5" strokeWidth={2.4} /> : null}
                  {order.shipment.onPayPal ? "Synced" : "Missing"}
                </div>
              </div>
            </div>
          </Section>
        ) : null}

        <Section title="Timeline">
          <ol className="relative">
            {order.timeline.map((e, i) => {
              const last = i === order.timeline.length - 1;
              return (
                <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                  {!last ? <span className="absolute left-[5px] top-3.5 h-full w-px bg-line" /> : null}
                  <span className="relative mt-1 size-[11px] shrink-0 rounded-full border-2 border-surface" style={{ background: e.kind === "now" ? "#0a0a0a" : TONE[e.tone], boxShadow: `0 0 0 1px ${e.kind === "now" ? "#0a0a0a" : TONE[e.tone]}` }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={clsx("text-[13px]", e.kind === "now" ? "font-medium text-ink" : "text-ink")}>{e.kind === "now" ? "Now · Exhibit is watching" : e.label}</span>
                      <span suppressHydrationWarning className="num shrink-0 text-[12px] text-muted">
                        {e.kind === "now" ? "" : `${shortDate(e.at)} · ${relTime(e.at)}`}
                      </span>
                    </div>
                    {e.detail ? <div className="mt-0.5 line-clamp-2 text-[12px] leading-[18px] text-muted">{e.detail}</div> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>

        {order.history.length ? (
          <Section title="What Exhibit did">
            <div className="space-y-2">
              {order.history.map((h) => (
                <div key={h.id} className="flex items-start gap-2.5 text-[13px]">
                  <span className={clsx("mt-1.5 size-1.5 shrink-0 rounded-full", h.ok ? "bg-green" : "bg-red")} />
                  <div className="min-w-0 flex-1">
                    <div className="text-ink-2">{h.detail}</div>
                    <div className="mt-0.5 text-[12px] text-muted">
                      risk {h.before.score} → {h.after.score} · <span suppressHydrationWarning>{relTime(h.at)}</span>
                      {h.paypal ? <span className="mono"> · {h.paypal.method} {h.paypal.path}</span> : ""}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        ) : null}
        <div className="h-6 shrink-0" />
      </aside>
    </>
  );
}
