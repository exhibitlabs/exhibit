"use client";

import "./company.css";
import "./contact.css";
import { Check, CircleAlert, Copy, LoaderCircle, Mail, Send } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode, type RefObject } from "react";
import { PlateCaption, PlateOverlay, PlateStage } from "../Plate";
import { letterBlocks, letterText, subjectFor, type Block } from "./contact/letter";
import { offeredAt, type Pick } from "./contact/schedule";
import { DISPUTE_VOLUMES, LIMITS, validateContact, type ContactPayload, type FieldErrors, type Topic } from "./contact/submission";
import { TurnstileGate, type TurnstileProblem } from "./contact/turnstile";
import { dayAndClock, zoneName } from "./contact/zones";
import { Scheduler, SchedulerField, SchedulerPlaceholder, type PickedTime } from "./Scheduler";

const TOPICS: { id: Topic; label: string; hint: string }[] = [
  { id: "demo", label: "Book a demo", hint: "A walkthrough on the live demo or your sandbox" },
  { id: "question", label: "Ask a question", hint: "About the product, pricing or the code" },
  { id: "other", label: "Something else", hint: "Press, partnerships, anything" },
];

type Fields = { name: string; email: string; company: string; website: string; volume: string; message: string };
const EMPTY: Fields = { name: "", email: "", company: "", website: "", volume: "", message: "" };
const ORDER: (keyof Fields)[] = ["name", "email", "company", "website", "volume", "message"];

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; email: string; times: number[]; zone: string } | { kind: "fallback" } | { kind: "error"; reason: string };

// What the browser knows that the server can't: the visitor's time zone, clock style and the time. The server
// renders without them (null, false, 0) and the calendar appears once the page is running in the browser.
const never = () => () => {};
let detected: { zone: string; twelveHour: boolean } | null = null;
const detect = () =>
  (detected ??= {
    zone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    twelveHour: ["h11", "h12"].includes(new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hourCycle ?? ""),
  });
const detectZone = () => detect().zone;
const detectTwelveHour = () => detect().twelveHour;
const everyFewSeconds = (tick: () => void) => {
  const t = window.setInterval(tick, 15_000);
  return () => window.clearInterval(t);
};
const thisMinute = () => Math.floor(Date.now() / 60_000);

/** Why a send failed, in the visitor's words, by the Worker's error code (deploy/site/contact.ts). */
const REASONS: Record<string, string> = {
  forbidden: "The form can only send from this site's own page.",
  unsupported_media_type: "Our server couldn't accept the form as your browser sent it.",
  too_large: "The message is too long to send.",
  bad_request: "Our server couldn't read the message.",
  rejected: "Our spam filter took it for an automated message.",
  invalid: "Some fields need another look.",
  not_configured: "The form isn't set up to send yet.",
  bot_check_failed: "The bot check didn't pass.",
  bot_check_unavailable: "The bot check couldn't be reached.",
  send_failed: "Our mail service didn't accept it.",
  server_error: "Something went wrong on our side.",
};
const PROBLEMS: Record<TurnstileProblem, string> = {
  blocked: "The bot check couldn't load. A content blocker or network filter may be stopping it.",
  failed: "The bot check didn't work in this browser.",
  timeout: "The bot check took too long to answer.",
};

/** The page the visitor came from: a path on this site, or only the origin of another site. */
function cameFrom(): string {
  try {
    const r = new URL(document.referrer);
    return r.origin === location.origin ? `${r.pathname}${r.search}` : r.origin;
  } catch {
    return "";
  }
}

function stop(gate: RefObject<TurnstileGate | null>) {
  gate.current?.destroy();
  gate.current = null;
}

function Field({ id, label, optional, error, children }: { id: string; label: string; optional?: boolean; error?: string; children: ReactNode }) {
  return (
    <div className="s-co-field">
      <label htmlFor={id}>
        {label}
        {optional ? <small> (optional)</small> : null}
      </label>
      {children}
      {error ? (
        <span id={`${id}-err`} className="s-co-error">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** The letter as the founders will read it, with grey stand-ins for what hasn't been filled in yet. */
function LetterPreview({ blocks }: { blocks: Block[] }) {
  const grey = (s: string) => <span className="blank">{s}</span>;
  const out: ReactNode[] = [];
  blocks.forEach((b, i) => {
    let node: ReactNode = null;
    if (b.kind === "lines") {
      const lines = b.lines.filter((l) => l.text || l.placeholder);
      if (lines.length) node = lines.map((l, j) => <span key={j}>{j ? "\n" : ""}{l.text || grey(l.placeholder ?? "")}</span>);
    } else if (b.kind === "fields") {
      node = b.rows.map((r, j) => (
        <span key={j}>
          {j ? "\n" : ""}
          {r.label}: {r.text || grey(r.placeholder ?? "")}
        </span>
      ));
    } else if (b.kind === "times") {
      node = b.items.length ? (
        <>
          {b.label}:{b.items.map((t) => `\n- ${t}`).join("")}
        </>
      ) : (
        <>
          {b.label}: {grey(b.placeholder)}
        </>
      );
    } else if (b.kind === "message") {
      node = b.piece.text || (b.piece.placeholder ? grey(b.piece.placeholder) : null);
    }
    if (node) out.push(<span key={i}>{out.length ? "\n\n" : ""}{node}</span>);
  });
  return <>{out}</>;
}

/**
 * The contact form. It sends straight to the founders' inbox: POST /api/contact, which on the live site is the
 * static site's Worker (deploy/site/worker.ts). "Sent" appears only when the Worker answers 200. Where there
 * is no sender (the Next app answers 501), it falls back to the visitor's own email app with the message
 * written; when sending fails it says why and offers that email and a copy. Demo requests can propose up to
 * three times with the scheduler; the preview beside the form shows the letter exactly as it will arrive.
 * Without JavaScript the form opens a plain-text email through its mailto action.
 */
export function ContactForm({ to, privacyHref }: { to: string; privacyHref: string }) {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [topic, setTopic] = useState<Topic>("demo");
  const [f, setF] = useState<Fields>(EMPTY);
  const [hp, setHp] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [zoneChoice, setZoneChoice] = useState<string | null>(null);

  const detectedZone = useSyncExternalStore(never, detectZone, () => null);
  const twelveHour = useSyncExternalStore(never, detectTwelveHour, () => false);
  const minute = useSyncExternalStore(everyFewSeconds, thisMinute, () => 0);
  const ready = detectedZone !== null && minute > 0;
  const zone = zoneChoice ?? detectedZone ?? "UTC";
  const now = minute * 60_000;

  const gate = useRef<TurnstileGate | null>(null);
  const tsBox = useRef<HTMLDivElement>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef<string | null>(null);

  // Picks keep their day and clock when the zone changes; ones no longer offered (too soon now) drop out.
  const picked = useMemo<PickedTime[]>(
    () =>
      ready
        ? picks
            .flatMap((p) => {
              const at = offeredAt(p, zone, now);
              return at === null ? [] : [{ ...p, at }];
            })
            .sort((a, b) => a.at - b.at)
        : [],
    [ready, picks, zone, now],
  );
  const times = topic === "demo" ? picked.map((p) => p.at) : [];

  const letter = { topic, ...f, times, timeZone: zone };
  const blocks = letterBlocks(letter);
  const subject = subjectFor(letter);
  const body = letterText(blocks);
  const mailto = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const plain = `To: ${to}\nSubject: ${subject}\n\n${body}`;

  useEffect(() => () => stop(gate), []);
  useEffect(() => {
    if (status.kind === "sent") sentHeading.current?.focus();
  }, [status.kind]);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    document.getElementById(target)?.focus();
  });

  const startGate = () => {
    if (!gate.current && tsBox.current) gate.current = new TurnstileGate(tsBox.current, setInteractive);
    void gate.current?.start();
  };

  const set = (k: keyof Fields) => (e: { target: { value: string } }) => {
    setF((prev) => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
    if (status.kind === "fallback") setStatus({ kind: "idle" });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plain);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const showErrors = (next: FieldErrors) => {
    setErrors(next);
    const first = ORDER.find((k) => next[k]);
    if (first) focusNext.current = id(first);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status.kind === "sending") return;
    const draft = { topic, ...f, times: times.map((t) => new Date(t).toISOString()), timeZone: zone };
    const checked = validateContact(draft, Date.now());
    if (!checked.ok) {
      showErrors(checked.errors);
      return;
    }
    setErrors({});
    setStatus({ kind: "sending" });
    startGate();

    // No token (Cloudflare unreachable or blocked) still goes to the server: the Next app answers 501, which
    // opens the email app; the live Worker refuses it, and the visitor hears why.
    const verdict = gate.current ? await gate.current.take(20_000) : ({ problem: "failed" } as const);
    const problem = "problem" in verdict ? verdict.problem : null;
    const payload: ContactPayload = { ...draft, page: `${location.origin}${location.pathname}${location.search}`, referrer: cameFrom(), token: "token" in verdict ? verdict.token : "", hp };

    let res: Response;
    try {
      res = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    } catch {
      gate.current?.reset();
      setStatus({ kind: "error", reason: problem ? PROBLEMS[problem] : "We couldn't reach our server. You may be offline." });
      return;
    }
    if (res.status === 501 || res.status === 404 || res.status === 405) {
      gate.current?.reset();
      setStatus({ kind: "fallback" });
      window.location.href = mailto;
      return;
    }
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; fields?: FieldErrors } | null;
    if (res.ok && data?.ok === true) {
      stop(gate);
      setStatus({ kind: "sent", email: checked.value.email, times, zone });
      return;
    }
    gate.current?.reset();
    if (data?.error === "invalid" && data.fields) showErrors(data.fields);
    const reason = problem && (!data?.error || data.error.startsWith("bot_check")) ? PROBLEMS[problem] : (REASONS[data?.error ?? ""] ?? `Our server answered with an error (${res.status}).`);
    setStatus({ kind: "error", reason });
  };

  const writeAnother = () => {
    setF(EMPTY);
    setPicks([]);
    setErrors({});
    setStatus({ kind: "idle" });
    focusNext.current = id("name");
  };

  const sending = status.kind === "sending";
  const fallbackActions = (
    <div className="s-co-alert__actions">
      <a className="s-btn s-btn--ink s-btn--sm" href={mailto}>
        <Mail className="s-icon" aria-hidden /> Open in my email app
      </a>
      <button type="button" className="s-btn s-btn--ghost s-btn--sm" onClick={copy}>
        {copied ? <Check className="s-icon" aria-hidden /> : <Copy className="s-icon" aria-hidden />}
        {copied ? "Copied" : "Copy the message"}
      </button>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-6">
      {status.kind === "sent" ? (
        <div className="s-co-sent lg:col-span-5">
          <span className="s-co-sent__mark" aria-hidden>
            <Check className="s-icon" />
          </span>
          <h2 ref={sentHeading} tabIndex={-1}>
            Sent to the founders&apos; inbox.
          </h2>
          <p>
            We&apos;ll reply to <b>{status.email}</b>, usually within a few days.
          </p>
          {status.times.length ? (
            <p>
              You offered {status.times.map((t) => dayAndClock(t, status.zone, twelveHour)).join("; ")} ({zoneName(status.zone, status.times[0])}). We&apos;ll confirm one, or suggest another.
            </p>
          ) : null}
          <button type="button" className="s-btn s-btn--ghost" onClick={writeAnother}>
            Write another message
          </button>
        </div>
      ) : (
        <form className="s-co-form lg:col-span-5" action={`mailto:${to}`} method="post" encType="text/plain" onSubmit={submit} onFocus={startGate} onPointerDown={startGate} noValidate aria-describedby={id("note")} aria-busy={sending}>
          <fieldset className="s-co-topics">
            <legend className="s-co-field">
              <span className="text-[13px] font-medium text-[color:var(--s-ink)]">What can we help with?</span>
            </legend>
            {TOPICS.map((t) => (
              <label key={t.id} className="s-co-topic">
                <input
                  type="radio"
                  name="topic"
                  value={t.id}
                  checked={topic === t.id}
                  onChange={() => {
                    setTopic(t.id);
                    setErrors({});
                    if (status.kind !== "sending") setStatus({ kind: "idle" });
                  }}
                />
                <b>{t.label}</b>
                <span>{t.hint}</span>
              </label>
            ))}
          </fieldset>

          <div className="s-co-row2">
            <Field id={id("name")} label="Your name" error={errors.name}>
              <input id={id("name")} name="name" className="s-co-input" autoComplete="name" maxLength={LIMITS.name} value={f.name} onChange={set("name")} aria-invalid={!!errors.name} aria-describedby={errors.name ? `${id("name")}-err` : undefined} required />
            </Field>
            <Field id={id("email")} label="Email for our reply" error={errors.email}>
              <input id={id("email")} name="email" type="email" className="s-co-input" autoComplete="email" maxLength={LIMITS.email} value={f.email} onChange={set("email")} aria-invalid={!!errors.email} aria-describedby={errors.email ? `${id("email")}-err` : undefined} required />
            </Field>
          </div>

          <div className="s-co-row2">
            <Field id={id("company")} label="Company or store" optional error={errors.company}>
              <input id={id("company")} name="company" className="s-co-input" autoComplete="organization" maxLength={LIMITS.company} value={f.company} onChange={set("company")} />
            </Field>
            {topic === "demo" ? (
              <Field id={id("website")} label="Website" optional error={errors.website}>
                <input id={id("website")} name="website" className="s-co-input" autoComplete="url" inputMode="url" maxLength={LIMITS.website} value={f.website} onChange={set("website")} />
              </Field>
            ) : (
              <div aria-hidden className="hidden sm:block" />
            )}
          </div>

          {topic === "demo" ? (
            <>
              <div className="s-co-row2">
                <Field id={id("volume")} label="PayPal disputes a month" optional error={errors.volume}>
                  <select id={id("volume")} name="volume" className="s-co-input" value={f.volume} onChange={set("volume")}>
                    <option value="">Choose one</option>
                    {DISPUTE_VOLUMES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <SchedulerField labelId={id("times")} hintId={id("times-hint")}>
                {ready ? <Scheduler zone={zone} onZoneChange={setZoneChoice} now={now} picks={picked} onPicksChange={setPicks} twelveHour={twelveHour} /> : <SchedulerPlaceholder />}
                {errors.times || errors.timeZone ? <span className="s-co-error">{errors.times ?? errors.timeZone}</span> : null}
              </SchedulerField>
            </>
          ) : null}

          <Field id={id("message")} label={topic === "demo" ? "Anything we should know" : "Your message"} optional={topic === "demo"} error={errors.message}>
            <textarea
              id={id("message")}
              name="message"
              className="s-co-input"
              maxLength={LIMITS.message}
              value={f.message}
              onChange={set("message")}
              placeholder={topic === "demo" ? "The disputes you see most, the store platform you use, what you want to see." : ""}
              aria-invalid={!!errors.message}
              aria-describedby={errors.message ? `${id("message")}-err` : undefined}
            />
          </Field>

          {/* People never see or reach this field; scripts that fill in every field do, and the Worker refuses them. */}
          <div className="s-co-hp" aria-hidden="true">
            <label>
              Leave this empty
              <input type="text" name="exh_hp_note" tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
            </label>
          </div>

          <div className="s-co-send">
            {/* Cloudflare Turnstile draws itself here only when it needs a click; most visitors never see it. */}
            <div ref={tsBox} className={interactive ? "s-co-turnstile is-on" : "s-co-turnstile"} />
            {sending && interactive ? <p className="s-co-hint">Tick the box above to finish sending.</p> : null}
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="submit" className="s-btn s-btn--ink" aria-disabled={sending || undefined}>
                {sending ? <LoaderCircle className="s-icon s-co-spin" aria-hidden /> : <Send className="s-icon" aria-hidden />}
                {sending ? "Sending" : "Send message"}
              </button>
            </div>
            {/* What happened, right under the button: the email-app fallback, or why it wasn't sent. */}
            <div role="status" aria-live="polite">
              {sending ? <span className="s-sr-only">Sending your message.</span> : null}
              {status.kind === "fallback" ? (
                <div className="s-co-status">
                  <b>Your email app should now be open, with this message ready.</b>
                  This copy of the site can&apos;t send messages itself, so nothing has been sent yet: press Send in your email app. If nothing opened, use the buttons below.
                  {fallbackActions}
                </div>
              ) : null}
            </div>
            {status.kind === "error" ? (
              <div className="s-co-alert" role="alert">
                <CircleAlert className="s-icon s-co-alert__icon" aria-hidden />
                <div>
                  <b>Your message wasn&apos;t sent.</b> {status.reason} You can send it from your own email app instead, or try again.
                  {fallbackActions}
                </div>
              </div>
            ) : null}
          </div>

          <p id={id("note")} className="s-small m-0 max-w-[64ch]">
            Your message goes straight to the founders&apos; inbox, with the page you came from. Nothing is stored on this site, and Cloudflare Turnstile checks that you&apos;re not a bot. More on the{" "}
            <a href={privacyHref} className="underline decoration-[color:var(--s-line-2)] underline-offset-4 hover:decoration-[color:var(--s-ink)]">
              privacy page
            </a>
            .
          </p>
        </form>
      )}

      <figure className="s-figure min-w-0 lg:sticky lg:top-[calc(var(--s-nav-h)+24px)] lg:col-span-7 lg:self-start">
        <PlateStage painting="mitchell" focus={[50, 42]} height={700} mobile={{ height: 240, focus: [40, 40], zoom: 1.2 }} sizes="(max-width: 1024px) 100vw, 820px" preload>
          <PlateOverlay left="9%" top="8%" width="82%">
            <div data-ui className="s-ui s-ui-sheet s-ui-sheet--paper s-co-mail" role="group" aria-label="The message the founders will receive">
              <dl className="s-co-mail__head m-0">
                <div>
                  <dt>To</dt>
                  <dd className="m-0 flex items-center justify-between gap-2">
                    <span className="min-w-0">Shivansh and Someet, Exhibit</span>
                    {status.kind === "sent" ? (
                      <span className="s-co-mail__sent">
                        <Check className="s-icon" aria-hidden /> Sent
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt>Reply to</dt>
                  <dd className="m-0 min-w-0 break-all">{f.email.trim() || (status.kind === "sent" ? status.email : <span className="s-co-mail__blank">your email</span>)}</dd>
                </div>
                <div>
                  <dt>Subject</dt>
                  <dd className="m-0 font-medium text-[#0a0a0a]">{subject}</dd>
                </div>
              </dl>
              <div className="s-co-mail__body" aria-live="off">
                <LetterPreview blocks={blocks} />
              </div>
            </div>
          </PlateOverlay>
        </PlateStage>
        <PlateCaption painting="mitchell" even>
          <b>What the founders receive.</b> It updates as you type, and grey lines are left out. They also see the page you came from and when you sent it.
        </PlateCaption>
      </figure>
    </div>
  );
}
