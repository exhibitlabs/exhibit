"use client";

import "./company.css";
import { Check, Copy, Mail } from "lucide-react";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { PlateCaption, PlateOverlay, PlateStage } from "../Plate";

type Topic = "demo" | "question" | "other";

const TOPICS: { id: Topic; label: string; hint: string }[] = [
  { id: "demo", label: "Book a demo", hint: "A walkthrough on the live demo or your sandbox" },
  { id: "question", label: "Ask a question", hint: "About the product, pricing or the code" },
  { id: "other", label: "Something else", hint: "Press, partnerships, anything" },
];

const DISPUTE_VOLUMES = ["Fewer than 10", "10 to 50", "50 to 200", "More than 200", "Not sure"];

type Fields = { name: string; email: string; company: string; website: string; volume: string; times: string; message: string };
const EMPTY: Fields = { name: "", email: "", company: "", website: "", volume: "", times: "", message: "" };

/** The email the form opens: subject and body, built from what the visitor typed. */
function compose(topic: Topic, f: Fields) {
  const name = f.name.trim();
  const who = f.company.trim() || name;
  const subject = topic === "demo" ? `Demo request${who ? `: ${who}` : ""}` : topic === "question" ? `Question about Exhibit${name ? ` from ${name}` : ""}` : `Message for Exhibit${name ? ` from ${name}` : ""}`;
  const lines: string[] = ["Hello Shivansh and Someet,", ""];
  if (topic === "demo") {
    lines.push("I'd like a demo of Exhibit.", "");
    lines.push(`Name: ${name}`);
    if (f.company.trim()) lines.push(`Company or store: ${f.company.trim()}`);
    if (f.website.trim()) lines.push(`Website: ${f.website.trim()}`);
    if (f.volume) lines.push(`PayPal disputes a month: ${f.volume}`);
    if (f.times.trim()) lines.push(`Times that suit me: ${f.times.trim()}`);
    if (f.email.trim()) lines.push(`Reply to: ${f.email.trim()}`);
    if (f.message.trim()) lines.push("", f.message.trim());
  } else {
    lines.push(f.message.trim(), "");
    lines.push(name);
    if (f.company.trim()) lines.push(f.company.trim());
    if (f.email.trim()) lines.push(`Reply to: ${f.email.trim()}`);
  }
  return { subject, body: lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() };
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

/**
 * Contact form with no backend. Submitting builds a mailto: link with the subject and body filled in and
 * opens the visitor's own email app; the preview shows exactly what that email will say. It never claims a
 * message was sent: only the visitor's email app can send it. Without JavaScript the form still opens a
 * plain-text email through its mailto action.
 */
export function MailtoForm({ to }: { to: string }) {
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const [topic, setTopic] = useState<Topic>("demo");
  const [f, setF] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof Fields, string>>>({});
  const [opened, setOpened] = useState(false);
  const [copied, setCopied] = useState<"message" | "address" | null>(null);

  const set = (k: keyof Fields) => (e: { target: { value: string } }) => {
    setF((prev) => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }));
    setOpened(false);
  };

  const { subject, body } = compose(topic, f);
  const href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const plain = `To: ${to}\nSubject: ${subject}\n\n${body}`;

  const copy = async (what: "message" | "address") => {
    try {
      await navigator.clipboard.writeText(what === "message" ? plain : to);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!f.name.trim()) next.name = "Please add your name.";
    if (topic !== "demo" && !f.message.trim()) next.message = "Please write a short message.";
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) next.email = "That email address doesn't look complete.";
    setErrors(next);
    if (Object.keys(next).length) {
      const first = Object.keys(next)[0];
      document.getElementById(id(first))?.focus();
      return;
    }
    window.location.href = href;
    setOpened(true);
  };

  const blank = (v: string, label: string) => (v.trim() ? v.trim() : <span className="blank">{label}</span>);

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-6">
      <form className="s-co-form lg:col-span-5" action={`mailto:${to}`} method="post" encType="text/plain" onSubmit={submit} noValidate aria-describedby={id("note")}>
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
                  setOpened(false);
                  setErrors({});
                }}
              />
              <b>{t.label}</b>
              <span>{t.hint}</span>
            </label>
          ))}
        </fieldset>

        <div className="s-co-row2">
          <Field id={id("name")} label="Your name" error={errors.name}>
            <input id={id("name")} name="name" className="s-co-input" autoComplete="name" value={f.name} onChange={set("name")} aria-invalid={!!errors.name} aria-describedby={errors.name ? `${id("name")}-err` : undefined} required />
          </Field>
          <Field id={id("email")} label="Email for our reply" optional error={errors.email}>
            <input id={id("email")} name="email" type="email" className="s-co-input" autoComplete="email" value={f.email} onChange={set("email")} aria-invalid={!!errors.email} aria-describedby={errors.email ? `${id("email")}-err` : undefined} />
          </Field>
        </div>

        <div className="s-co-row2">
          <Field id={id("company")} label="Company or store" optional>
            <input id={id("company")} name="company" className="s-co-input" autoComplete="organization" value={f.company} onChange={set("company")} />
          </Field>
          {topic === "demo" ? (
            <Field id={id("website")} label="Website" optional>
              <input id={id("website")} name="website" className="s-co-input" autoComplete="url" inputMode="url" value={f.website} onChange={set("website")} />
            </Field>
          ) : (
            <div aria-hidden className="hidden sm:block" />
          )}
        </div>

        {topic === "demo" ? (
          <div className="s-co-row2">
            <Field id={id("volume")} label="PayPal disputes a month" optional>
              <select id={id("volume")} name="volume" className="s-co-input" value={f.volume} onChange={set("volume")}>
                <option value="">Choose one</option>
                {DISPUTE_VOLUMES.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field id={id("times")} label="Times that suit you" optional>
              <input id={id("times")} name="times" className="s-co-input" placeholder="e.g. weekday mornings, CET" value={f.times} onChange={set("times")} />
            </Field>
          </div>
        ) : null}

        <Field id={id("message")} label={topic === "demo" ? "Anything we should know" : "Your message"} optional={topic === "demo"} error={errors.message}>
          <textarea
            id={id("message")}
            name="message"
            className="s-co-input"
            maxLength={1500}
            value={f.message}
            onChange={set("message")}
            placeholder={topic === "demo" ? "The disputes you see most, the store platform you use, what you want to see." : ""}
            aria-invalid={!!errors.message}
            aria-describedby={errors.message ? `${id("message")}-err` : undefined}
          />
        </Field>

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="submit" className="s-btn s-btn--ink">
            <Mail className="s-icon" aria-hidden /> Open in my email app
          </button>
          <button type="button" className="s-btn s-btn--ghost" onClick={() => copy("message")}>
            {copied === "message" ? <Check className="s-icon" aria-hidden /> : <Copy className="s-icon" aria-hidden />}
            {copied === "message" ? "Copied" : "Copy the message"}
          </button>
        </div>

        <p id={id("note")} className="s-small m-0">
          This site has no form backend. Nothing is sent until you press Send in your own email app.
        </p>

        <div role="status" aria-live="polite">
          {opened ? (
            <div className="s-co-status">
              <b>Your email app should now be open, with this message ready.</b>
              It hasn&apos;t been sent yet: press Send there. If nothing opened, copy the message and send it to{" "}
              <a href={`mailto:${to}`} className="underline underline-offset-4">
                {to}
              </a>
              .
            </div>
          ) : null}
        </div>
      </form>

      <figure className="s-figure min-w-0 lg:sticky lg:top-[calc(var(--s-nav-h)+24px)] lg:col-span-7 lg:self-start">
        <PlateStage painting="mitchell" focus={[50, 42]} height={700} mobile={{ height: 240, focus: [40, 40], zoom: 1.2 }} sizes="(max-width: 1024px) 100vw, 820px" preload>
          <PlateOverlay left="9%" top="8%" width="82%">
          <div data-ui className="s-ui s-ui-sheet s-ui-sheet--paper s-co-mail" role="group" aria-label="The email your app will open">
            <dl className="s-co-mail__head m-0">
              <div>
                <dt>To</dt>
                <dd className="m-0 flex items-center justify-between gap-2">
                  <span className="min-w-0 break-all">{to}</span>
                  <button type="button" className="s-co-copy shrink-0" onClick={() => copy("address")} aria-label="Copy the email address">
                    {copied === "address" ? <Check className="s-icon" aria-hidden /> : <Copy className="s-icon" aria-hidden />}
                    {copied === "address" ? "Copied" : "Copy"}
                  </button>
                </dd>
              </div>
              <div>
                <dt>Subject</dt>
                <dd className="m-0 font-medium text-[#0a0a0a]">{subject}</dd>
              </div>
            </dl>
            <div className="s-co-mail__body" aria-live="off">
              {topic === "demo" ? (
                <>
                  {"Hello Shivansh and Someet,\n\nI'd like a demo of Exhibit.\n\nName: "}
                  {blank(f.name, "your name")}
                  {"\nCompany or store: "}
                  {blank(f.company, "optional")}
                  {"\nWebsite: "}
                  {blank(f.website, "optional")}
                  {"\nPayPal disputes a month: "}
                  {f.volume ? f.volume : <span className="blank">optional</span>}
                  {"\nTimes that suit me: "}
                  {blank(f.times, "optional")}
                  {f.email.trim() ? `\nReply to: ${f.email.trim()}` : null}
                  {f.message.trim() ? `\n\n${f.message.trim()}` : null}
                </>
              ) : (
                <>
                  {"Hello Shivansh and Someet,\n\n"}
                  {blank(f.message, "your message")}
                  {"\n\n"}
                  {blank(f.name, "your name")}
                  {f.company.trim() ? `\n${f.company.trim()}` : null}
                  {f.email.trim() ? `\nReply to: ${f.email.trim()}` : null}
                </>
              )}
            </div>
          </div>
          </PlateOverlay>
        </PlateStage>
        <PlateCaption painting="mitchell" even>
          <b>The email your app will open.</b> It updates as you type. Grey lines are left out if you leave them empty.
        </PlateCaption>
      </figure>
    </div>
  );
}
