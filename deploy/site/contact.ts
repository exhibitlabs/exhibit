// POST /api/contact on the static site's Worker: checks a contact form message and emails it to the founders.
//
// In order: same-site origin, JSON only, a 16 KB body limit, the honeypot, the shared validator (the browser
// ran the same one), Cloudflare Turnstile through siteverify, then the email. It answers 200 only after the
// email was handed to Cloudflare, so the form never shows "sent" for a message that wasn't. Nothing is stored
// or logged except the reason a send failed.
//
// The Worker entry (worker.ts) passes in the send function and the secret; tests pass fakes.
import { composeEmail } from "../../src/components/site/company/contact/letter";
import { MAX_BODY_BYTES, TOKEN_MAX, validateContact, type FieldErrors } from "../../src/components/site/company/contact/submission";
import { buildMime } from "./mime";

/** The sender, on the subdomain where Email Routing is active. */
export const FROM_ADDRESS = "contact@exhibit.9to5code.com";
/** The founders' inbox. Must match `send_email[0].destination_address` in wrangler.jsonc, which only allows this one. */
export const TO_ADDRESS = "shivansh2283@gmail.com";

export const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type ContactDeps = {
  /** The Turnstile secret (Worker secret TURNSTILE_SECRET). Without it every message is refused. */
  secret: string | undefined;
  /** Hands the raw message to Cloudflare. Throws if Cloudflare refuses it. */
  send: (mail: { from: string; to: string; raw: string }) => Promise<void>;
  /** For siteverify; defaults to the global fetch. */
  fetch?: typeof fetch;
  now?: () => number;
  uuid?: () => string;
};

export type ContactError = "forbidden" | "unsupported_media_type" | "too_large" | "bad_request" | "rejected" | "invalid" | "not_configured" | "bot_check_failed" | "bot_check_unavailable" | "send_failed" | "server_error";

const MESSAGES: Record<ContactError, string> = {
  forbidden: "This form only accepts messages from its own page.",
  unsupported_media_type: "The form must be sent as JSON.",
  too_large: "That message is too long to send.",
  bad_request: "The message couldn't be read.",
  rejected: "This message looks automated, so it wasn't sent.",
  invalid: "Some fields need another look.",
  not_configured: "The form isn't set up to send yet.",
  bot_check_failed: "The bot check didn't pass, so nothing was sent.",
  bot_check_unavailable: "The bot check couldn't be reached, so nothing was sent.",
  send_failed: "Our mail service didn't accept the message, so it wasn't sent.",
  server_error: "Something went wrong on our side, so nothing was sent.",
};

const STATUS: Record<ContactError, number> = {
  forbidden: 403,
  unsupported_media_type: 415,
  too_large: 413,
  bad_request: 400,
  rejected: 400,
  invalid: 400,
  not_configured: 500,
  bot_check_failed: 403,
  bot_check_unavailable: 503,
  send_failed: 502,
  server_error: 500,
};

const HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };

export function ok(): Response {
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: HEADERS });
}

export function fail(error: ContactError, fields?: FieldErrors): Response {
  return new Response(JSON.stringify({ ok: false, error, message: MESSAGES[error], ...(fields ? { fields } : {}) }), { status: STATUS[error], headers: HEADERS });
}

/** A browser on this site sends its own origin; other sites' pages are refused. Local development hosts are allowed. */
function sameSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const o = new URL(origin);
    return o.host === new URL(request.url).host || o.hostname === "localhost" || o.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** The body as text, or null once it passes `max` bytes (whatever Content-Length claims). */
export async function readBody(request: Request, max: number): Promise<string | null> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    all.set(c, at);
    at += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/** Asks Turnstile whether the token is good. "unavailable" when siteverify can't be reached or answers with an error page. */
export async function verifyTurnstile(token: string, secret: string, ip: string | null, idempotencyKey: string, fetcher: typeof fetch): Promise<"ok" | "failed" | "unavailable"> {
  const body = new URLSearchParams({ secret, response: token, idempotency_key: idempotencyKey });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetcher(SITEVERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return "unavailable";
    const data = (await res.json()) as { success?: unknown };
    return data.success === true ? "ok" : "failed";
  } catch {
    return "unavailable";
  }
}

export async function handleContact(request: Request, deps: ContactDeps): Promise<Response> {
  const now = deps.now?.() ?? Date.now();
  if (!sameSite(request)) return fail("forbidden");
  if (!/^application\/json(\s*;|$)/i.test(request.headers.get("content-type") ?? "")) return fail("unsupported_media_type");

  const text = await readBody(request, MAX_BODY_BYTES);
  if (text === null) return fail("too_large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail("bad_request");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail("bad_request");
  const { hp, token } = body as { hp?: unknown; token?: unknown };

  // People never see the honeypot field; anything typed into it came from a script.
  if (typeof hp === "string" && hp.trim() !== "") return fail("rejected");

  const checked = validateContact(body, now);
  if (!checked.ok) return fail("invalid", checked.errors);

  if (!deps.secret) return fail("not_configured");
  if (typeof token !== "string" || !token || token.length > TOKEN_MAX) return fail("bot_check_failed");
  const uuid = deps.uuid ?? (() => crypto.randomUUID());
  const verdict = await verifyTurnstile(token, deps.secret, request.headers.get("cf-connecting-ip"), uuid(), deps.fetch ?? fetch);
  if (verdict === "unavailable") return fail("bot_check_unavailable");
  if (verdict === "failed") return fail("bot_check_failed");

  const m = checked.value;
  const email = composeEmail(m, now);
  const raw = buildMime({
    from: { name: `${m.name} via Exhibit`, email: FROM_ADDRESS },
    to: { email: TO_ADDRESS },
    replyTo: { name: m.name, email: m.email },
    subject: email.subject,
    text: email.text,
    html: email.html,
    date: new Date(now),
    messageId: `${uuid()}@exhibit.9to5code.com`,
  });
  try {
    await deps.send({ from: FROM_ADDRESS, to: TO_ADDRESS, raw });
  } catch (e) {
    console.error("contact: Cloudflare refused the email:", e instanceof Error ? e.message : String(e));
    return fail("send_failed");
  }
  return ok();
}
