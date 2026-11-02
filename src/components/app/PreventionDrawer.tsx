"use client";

import { clsx } from "clsx";
import { ArrowRight, Check, ExternalLink, Languages, Loader2, Pencil, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { MessageDraft, PreventionAction, PreventionFixOption, PreventionOrder, PreventionTimelineEvent } from "@/lib/prevention";
import { relTime, shortDate } from "@/lib/format";
import { Button } from "../ui/Button";
import { BAND, bandOf, BandPill, money, ScoreRing, SIGNAL_ICON } from "./PreventionParts";

const TONE: Record<PreventionTimelineEvent["tone"], string> = { neutral: "#d4d4d4", good: "#16a34a", warn: "#e8a33d", bad: "#dc2626" };
const MESSAGE_ACTIONS: PreventionAction[] = ["message_buyer", "hold_and_verify"];

export type FixHandler = (orderId: string, action: PreventionAction, message?: { subject?: string; body: string }) => Promise<boolean>;

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border-t border-line px-6 py-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{title}</h3>
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
    <div className="mt-3 overflow-hidden rounded-[10px] border border-line bg-[#fcfcfc]">
      <div className="flex items-center justify-between border-b border-line bg-surface px-3.5 py-2">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-2">
          <Languages className="size-3.5 text-muted" />
          Written in {draft.languageName}
        </span>
        <span className="flex items-center gap-1">
          {draft.translation ? (
            <button onClick={() => setEnglish((v) => !v)} className={clsx("h-6 rounded-md px-2 text-[11.5px] transition-colors", english ? "bg-ink text-white" : "text-muted hover:bg-sunken")}>
              {english ? "Showing English" : "Show English"}
            </button>
          ) : null}
          {!english ? (
            <button onClick={() => setEditing((v) => !v)} className={clsx("inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11.5px] transition-colors", editing ? "bg-sunken text-ink" : "text-muted hover:bg-sunken")}>
              <Pencil className="size-3" /> {editing ? "Done" : "Edit"}
            </button>
          ) : null}
        </span>
      </div>
      <div className="px-3.5 py-3">
        <div className="text-[12.5px] font-medium text-ink">{shown.subject}</div>
        {editing && !english ? (
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={9} className="mt-2 w-full resize-none rounded-md border border-line bg-surface p-2 text-[12.5px] leading-relaxed text-ink-2 outline-none focus:border-line-strong" />
        ) : (
          <p className="scroll-thin mt-1.5 max-h-[188px] overflow-y-auto whitespace-pre-line text-[12.5px] leading-relaxed text-ink-2">{shown.body}</p>
        )}
      </div>
    </div>
  );
}

function FixButton({ fix, busy, disabled, onClick }: { fix: PreventionFixOption; busy: boolean; disabled: boolean; onClick: () => void }) {
  if (fix.primary)
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="group flex w-full items-center gap-3 rounded-[10px] bg-ink px-4 py-3 text-left text-white transition-colors hover:bg-[#262626] disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-medium">{fix.label}</span>
          <span className="num mt-0.5 block truncate text-[11px] text-white/55">{fix.api ? `${fix.api} · PayPal API` : fix.channel === "inbox" ? "Support inbox · in the buyer's language" : fix.detail}</span>
        </span>
        {busy ? <Loader2 className="size-4 animate-spin" /> : fix.channel === "inbox" ? <Send className="size-4 transition-transform group-hover:translate-x-0.5" /> : <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />}
      </button>
    );
  return (
    <Button variant={fix.action === "dismiss" ? "ghost" : "secondary"} size="sm" disabled={disabled} onClick={onClick} className={fix.action === "dismiss" ? "text-muted" : ""}>
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
      <div className="pv-fade fixed inset-0 z-40 bg-[rgb(10_10_10/0.08)]" onClick={onClose} />
      <aside className="pv-drawer scroll-thin fixed inset-y-0 right-0 z-50 flex w-[520px] max-w-[100vw] flex-col overflow-y-auto border-l border-line bg-surface shadow-[-24px_0_48px_rgb(0_0_0/0.06)]" role="dialog" aria-label={`Order ${order.orderId}`}>
        <header className="sticky top-0 z-10 flex items-start gap-4 bg-surface/95 px-6 pb-5 pt-5 backdrop-blur">
          <ScoreRing score={order.score} band={success ? "prevented" : b} size={64} stroke={5} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="display truncate text-[22px] leading-tight">{order.buyer}</h2>
              <span className="rounded bg-sunken px-1.5 py-0.5 text-[11px] font-medium text-muted">{order.country}</span>
            </div>
            <div className="num mt-1 truncate text-[12px] text-muted">
              {order.orderId} · {order.item}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <BandPill band={success ? "prevented" : b} />
              <span className="text-[12px] text-muted">
                <span className="num text-ink">{money(order.exposure)}</span> exposure ={" "}
                <span className="num">{money(order.exposure - order.fee)}</span> order + <span className="num">{money(order.fee)}</span> PayPal {order.funding === "CARD" ? "chargeback" : "dispute"} fee
              </span>
            </div>
          </div>
          <button onClick={onClose} className="-mr-2 -mt-1 rounded-md p-1.5 text-muted transition-colors hover:bg-sunken hover:text-ink" aria-label="Close">
            <X className="size-4" />
          </button>
        </header>

        {success ? (
          <div className="pv-pop mx-6 mb-5 flex items-center gap-3 rounded-[10px] border border-[#bbf7d0] bg-green-soft px-4 py-3.5">
            <span className="flex size-8 items-center justify-center rounded-full bg-[#16a34a] text-white">
              <svg viewBox="0 0 24 24" className="size-4.5">
                <path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="pv-check" />
              </svg>
            </span>
            <div>
              <div className="text-[14px] font-medium text-green">Dispute prevented</div>
              <div className="text-[12.5px] text-[#166534]">
                <span className="num">{money(success.saved)}</span> {success.saved <= order.fee + 0.01 ? "in PayPal fees saved, and the customer kept" : "of exposure off the table"}
              </div>
            </div>
          </div>
        ) : null}

        <Section title="Why it's at risk" aside={<span className="num text-[11.5px] text-faint">{order.signals.length} signal{order.signals.length === 1 ? "" : "s"}</span>}>
          <div className="space-y-2.5">
            {order.signals.map((s) => {
              const Icon = SIGNAL_ICON[s.kind];
              return (
                <div key={s.kind} className="rounded-[10px] border border-line px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sunken">
                      <Icon className="size-3.5 text-ink-2" strokeWidth={1.9} />
                    </span>
                    <span className="flex-1 text-[13.5px] font-medium">{s.label}</span>
                    <span className="inline-flex items-center gap-1 text-[11.5px] text-muted">
                      <ArrowRight className="size-3" /> {s.reasonLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-ink-2">{s.detail}</p>
                  {s.quote ? <p className="mt-2 border-l-2 border-line-strong pl-2.5 text-[12.5px] leading-relaxed text-muted">“{s.quote}”</p> : null}
                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-[#f0f0f0]">
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${s.weight}%`, background: s.weight >= 65 ? BAND.high.color : s.weight >= 40 ? BAND.elevated.color : BAND.watch.color }} />
                    </span>
                    <span className="num w-14 text-right text-[11px] text-faint">+{s.weight} risk</span>
                  </div>
                </div>
              );
            })}
            {!order.signals.length ? <p className="text-[13px] text-muted">Nothing left on this order. Exhibit keeps watching for new scans and messages.</p> : null}
          </div>
        </Section>

        {primary && !success ? (
          <Section title="Fix it now">
            <FixButton fix={primary} busy={busy === primary.action} disabled={!!busy} onClick={() => run(primary.action)} />
            <p className="mt-2 text-[12px] leading-relaxed text-muted">{primary.detail}</p>
            {messageFix && draft ? <MessagePreview key={draftFor ?? ""} draft={draft} body={body} setBody={setBody} /> : messageFix && !draft ? <div className="shimmer mt-3 h-40 rounded-[10px]" /> : null}
            {secondary.length ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {secondary.map((f) => (
                  <FixButton key={f.action} fix={f} busy={busy === f.action} disabled={!!busy} onClick={() => run(f.action)} />
                ))}
              </div>
            ) : null}
            {error ? <p className="mt-3 text-[12.5px] text-red">{error}</p> : null}
          </Section>
        ) : null}

        {order.shipment ? (
          <Section
            title="Shipment"
            aside={
              <a href={order.shipment.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] text-muted hover:text-ink">
                Carrier page <ExternalLink className="size-3" />
              </a>
            }
          >
            <div className="grid grid-cols-3 gap-3 text-[12.5px]">
              <div>
                <div className="text-faint">Carrier</div>
                <div className="mt-0.5">{order.shipment.carrier}</div>
              </div>
              <div>
                <div className="text-faint">Tracking</div>
                <div className="num mt-0.5 truncate">{order.shipment.tracking}</div>
              </div>
              <div>
                <div className="text-faint">On PayPal</div>
                <div className={clsx("mt-0.5 inline-flex items-center gap-1", order.shipment.onPayPal ? "text-green" : "text-ink-2")}>
                  {order.shipment.onPayPal ? <Check className="size-3.5" strokeWidth={2.5} /> : null}
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
                  <span className={clsx("relative mt-1 size-[11px] shrink-0 rounded-full border-2 border-surface", e.kind === "now" && "pulse-dot")} style={{ background: e.kind === "now" ? "#0a0a0a" : TONE[e.tone], boxShadow: `0 0 0 1px ${e.kind === "now" ? "#0a0a0a" : TONE[e.tone]}` }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={clsx("text-[13px]", e.kind === "now" ? "font-medium" : "text-ink")}>{e.kind === "now" ? "Now · Exhibit is watching" : e.label}</span>
                      <span className="num shrink-0 text-[11px] text-faint">{e.kind === "now" ? "" : `${shortDate(e.at)} · ${relTime(e.at)}`}</span>
                    </div>
                    {e.detail ? <div className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted">{e.detail}</div> : null}
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
                <div key={h.id} className="flex items-start gap-2.5 text-[12.5px]">
                  <span className={clsx("mt-1.5 size-1.5 shrink-0 rounded-full", h.ok ? "bg-green" : "bg-red")} />
                  <div className="min-w-0 flex-1">
                    <div className="text-ink-2">{h.detail}</div>
                    <div className="num mt-0.5 text-[11px] text-faint">
                      risk {h.before.score} → {h.after.score} · {relTime(h.at)}
                      {h.paypal ? ` · ${h.paypal.method} ${h.paypal.path}` : ""}
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
