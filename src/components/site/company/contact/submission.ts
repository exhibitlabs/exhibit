// The contact form's message: its fields, their limits, and the one validator that the browser runs before
// sending and the Worker (deploy/site/contact.ts) runs again before emailing, so the two always agree.
// Shared by the browser and the Worker: relative imports only, nothing from React or Next.
import { MAX_PICKS, WINDOW_DAYS } from "./schedule";
import { isTimeZone } from "./zones";

export const TOPIC_IDS = ["demo", "question", "other"] as const;
export type Topic = (typeof TOPIC_IDS)[number];

export const DISPUTE_VOLUMES = ["Fewer than 10", "10 to 50", "50 to 200", "More than 200", "Not sure"] as const;

/** Longest accepted value of each field, in characters. */
export const LIMITS = { name: 100, email: 254, company: 120, website: 200, message: 2000, page: 500 } as const;

/** The largest request body the Worker reads. A full message is well under half of this. */
export const MAX_BODY_BYTES = 16 * 1024;

/** Turnstile tokens are at most 2048 characters. */
export const TOKEN_MAX = 2048;

/** What the browser sends to POST /api/contact, as JSON. */
export type ContactPayload = {
  topic: Topic;
  name: string;
  email: string;
  company: string;
  website: string;
  volume: string;
  message: string;
  /** Up to three proposed times, as ISO instants in UTC ("2026-11-05T08:00:00.000Z"). Demo requests only. */
  times: string[];
  /** The visitor's IANA time zone, in which they saw and picked the times. */
  timeZone: string;
  /** The contact page's address and the page the visitor came from (same-site path, or another site's origin). */
  page: string;
  referrer: string;
  /** The Turnstile token, and the honeypot field, which people never see and leave empty. */
  token: string;
  hp: string;
};

/** A message that passed validation, cleaned. Times are UTC instants in ms, sorted, without repeats. */
export type ContactMessage = {
  topic: Topic;
  name: string;
  email: string;
  company: string;
  website: string;
  volume: string;
  message: string;
  times: number[];
  timeZone: string;
  page: string;
  referrer: string;
};

export type Field = "topic" | "name" | "email" | "company" | "website" | "volume" | "message" | "times" | "timeZone";
export type FieldErrors = Partial<Record<Field, string>>;

/**
 * An address safe to put in a Reply-To header: no spaces, quotes, angle brackets, commas or semicolons, and a
 * domain with a dot. Plain ASCII only, so the header never needs SMTPUTF8.
 */
export const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.(?:[A-Za-z]{2,}|xn--[A-Za-z0-9-]+)$/;

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const HOUR = 60 * 60 * 1000;

export const MESSAGES = {
  topic: "Please choose what we can help with.",
  nameMissing: "Please add your name.",
  nameLong: `Please keep your name under ${LIMITS.name} characters.`,
  emailMissing: "Please add your email, so we can reply.",
  emailBad: "That email address doesn't look complete.",
  company: `Please keep this under ${LIMITS.company} characters.`,
  website: `Please keep this under ${LIMITS.website} characters.`,
  volume: "Please choose one of the options.",
  messageMissing: "Please write a short message.",
  messageLong: `Please keep your message under ${LIMITS.message.toLocaleString("en-US")} characters.`,
  timesMany: "Please pick up to three times.",
  timesBad: "Those times couldn't be read. Please pick them again.",
  timesPast: "One of your times has passed. Please pick it again.",
  timeZone: "Please choose your time zone again.",
} as const;

/** One line of text: line breaks and control characters become spaces, spaces collapse, the ends are trimmed. */
export function oneLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Running text: line breaks kept as \n, other control characters dropped, at most one blank line in a row. */
export function multiLine(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n?|[\u2028\u2029\u0085]/g, "\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Checks and cleans a message. `now` is the checker's clock: proposed times must still be ahead of it (with an
 * hour's grace for a visitor whose clock runs fast) and inside the scheduler's window. The token and honeypot
 * are not checked here; the Worker handles both before it calls this.
 */
export function validateContact(input: unknown, now: number): { ok: true; value: ContactMessage } | { ok: false; errors: FieldErrors } {
  const o = (input && typeof input === "object" && !Array.isArray(input) ? input : {}) as Record<string, unknown>;
  const errors: FieldErrors = {};

  const topic = TOPIC_IDS.find((t) => t === o.topic) ?? null;
  if (!topic) errors.topic = MESSAGES.topic;
  const demo = topic === "demo";

  const name = oneLine(o.name);
  if (!name) errors.name = MESSAGES.nameMissing;
  else if (name.length > LIMITS.name) errors.name = MESSAGES.nameLong;

  const email = oneLine(o.email);
  if (!email) errors.email = MESSAGES.emailMissing;
  else if (email.length > LIMITS.email || !EMAIL_RE.test(email)) errors.email = MESSAGES.emailBad;

  const company = oneLine(o.company);
  if (company.length > LIMITS.company) errors.company = MESSAGES.company;

  const website = demo ? oneLine(o.website) : "";
  if (website.length > LIMITS.website) errors.website = MESSAGES.website;

  const volume = demo ? oneLine(o.volume) : "";
  if (volume && !DISPUTE_VOLUMES.some((v) => v === volume)) errors.volume = MESSAGES.volume;

  const message = multiLine(o.message);
  if (topic && !demo && !message) errors.message = MESSAGES.messageMissing;
  else if (message.length > LIMITS.message) errors.message = MESSAGES.messageLong;

  let times: number[] = [];
  if (demo && o.times != null) {
    if (!Array.isArray(o.times)) errors.times = MESSAGES.timesBad;
    else if (o.times.length > MAX_PICKS) errors.times = MESSAGES.timesMany;
    else {
      const parsed = o.times.map((t) => (typeof t === "string" && ISO_UTC.test(t) ? Date.parse(t) : NaN));
      if (parsed.some((t) => Number.isNaN(t) || t > now + (WINDOW_DAYS + 2) * 24 * HOUR)) errors.times = MESSAGES.timesBad;
      else if (parsed.some((t) => t < now - HOUR)) errors.times = MESSAGES.timesPast;
      else times = [...new Set(parsed)].sort((a, b) => a - b);
    }
  }

  const zone = oneLine(o.timeZone);
  const timeZone = isTimeZone(zone) ? zone : null;
  if (times.length && !timeZone) errors.timeZone = MESSAGES.timeZone;

  if (!topic || Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: { topic, name, email, company, website, volume, message, times, timeZone: timeZone ?? "UTC", page: oneLine(o.page).slice(0, LIMITS.page), referrer: oneLine(o.referrer).slice(0, LIMITS.page) },
  };
}
