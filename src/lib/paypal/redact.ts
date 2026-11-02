// What the PayPal activity inspector may show. Credentials never reach the log: the Authorization
// header is never stored, and token, secret and card fields are masked before anything is written.

const SECRET_KEY = /(^|_)(access_token|refresh_token|id_token|token|client_secret|secret|password|authorization|security_code|cvv|cvv2)$/i;
const MAX_STRING = 4_000;
const MAX_JSON = 24_000;

export const REDACTED = "[redacted]";

function maskCard(v: string) {
  const digits = v.replace(/\D/g, "");
  return digits.length >= 12 ? `•••• ${digits.slice(-4)}` : REDACTED;
}

/** Deep copy with secrets masked and very long strings shortened. */
export function redact(value: unknown, key = ""): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (SECRET_KEY.test(key)) return REDACTED;
    if (key === "number" && /^\d[\d\s-]{11,}$/.test(value)) return maskCard(value);
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}… (${value.length - MAX_STRING} more characters)` : value;
  }
  if (typeof value !== "object") return SECRET_KEY.test(key) ? REDACTED : value;
  if (Array.isArray(value)) return value.map((v) => redact(v, key));
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, redact(v, k)]));
}

/** Keeps a logged body small: very large payloads (a long dispute list) keep their first items. */
export function fitForLog(value: unknown): unknown {
  const text = JSON.stringify(value);
  if (!text || text.length <= MAX_JSON) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const listKey = Object.keys(obj).find((k) => Array.isArray(obj[k]) && (obj[k] as unknown[]).length > 3);
    if (listKey) {
      const list = obj[listKey] as unknown[];
      for (let keep = Math.min(list.length - 1, 20); keep >= 1; keep = Math.floor(keep / 2)) {
        const trimmed = { ...obj, [listKey]: [...list.slice(0, keep), `… ${list.length - keep} more items not stored`] };
        if (JSON.stringify(trimmed).length <= MAX_JSON) return trimmed;
      }
    }
  }
  return { truncated: true, preview: text.slice(0, MAX_JSON) };
}

/** Request headers worth showing. Authorization is deliberately absent. */
export const SHOWN_HEADERS = ["Content-Type", "Accept", "PayPal-Request-Id", "Prefer"];
