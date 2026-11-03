// A small MIME builder for the contact form's email, with no dependencies: RFC 5322 headers, RFC 2047 encoded
// words for names and subjects that aren't plain ASCII, and RFC 2045 quoted-printable bodies, joined with CRLF.
//
// Header safety: every value that goes into a header passes through headerText(), which turns CR, LF and every
// other control character into a space, so nothing a visitor types can end a header line and start another
// (a Bcc:, a second Subject:, a body). Addresses must match a strict pattern or the build throws.

export type Address = { name?: string; email: string };

export type Mail = {
  from: Address;
  to: Address;
  replyTo?: Address;
  subject: string;
  text: string;
  /** Optional HTML alternative; the message is then multipart/alternative. */
  html?: string;
  date: Date;
  /** The part before and after the @, without angle brackets: "3f2a…@exhibit.9to5code.com". */
  messageId: string;
  /** Multipart boundary. Tests pass a fixed one; it starts with "=_", which quoted-printable output can never contain. */
  boundary?: string;
};

const MAX_LINE = 76;
const ADDRESS = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const MESSAGE_ID = /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/;
const PLAIN = /^[\x20-\x7e]*$/;

/** A value made safe for a header: CR, LF and other control characters become spaces; runs of spaces collapse. */
export function headerText(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, " ")
    .replace(/ {2,}/g, " ")
    .trim();
}

const utf8 = (s: string) => new TextEncoder().encode(s);

function base64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * RFC 2047 encoded words ("=?UTF-8?B?…?="), each at most 39 bytes of text so a word stays 64 characters and a
 * header line holding one stays under 76. Characters are never split across words.
 */
export function encodedWords(value: string): string[] {
  const words: string[] = [];
  let chunk = "";
  let size = 0;
  for (const ch of value) {
    const n = utf8(ch).length;
    if (chunk && size + n > 39) {
      words.push(`=?UTF-8?B?${base64(utf8(chunk))}?=`);
      chunk = "";
      size = 0;
    }
    chunk += ch;
    size += n;
  }
  if (chunk) words.push(`=?UTF-8?B?${base64(utf8(chunk))}?=`);
  return words;
}

/** Free text as header tokens: plain ASCII split at spaces, anything else (or anything that looks encoded) as encoded words. */
function textTokens(value: string): string[] {
  const v = headerText(value);
  if (!v) return [];
  return PLAIN.test(v) && !v.includes("=?") ? v.split(" ") : encodedWords(v);
}

/** An address as header tokens: `"Ada Lovelace" <ada@example.com>`, the name encoded when it isn't plain ASCII. */
function addressTokens(a: Address): string[] {
  const email = headerText(a.email);
  if (!ADDRESS.test(email)) throw new Error("Refusing to put an unsafe email address in a header.");
  const name = headerText(a.name ?? "");
  if (!name) return [`<${email}>`];
  const display = PLAIN.test(name) && !name.includes("=?") ? `"${name.replace(/(["\\])/g, "\\$1")}"`.split(" ") : encodedWords(name);
  return [...display, `<${email}>`];
}

/** One header, folded at token boundaries so lines stay within 76 characters where the tokens allow. */
export function headerLine(name: string, tokens: string[]): string {
  const lines: string[] = [];
  let line = `${name}:`;
  for (const token of tokens) {
    if (line.length + 1 + token.length > MAX_LINE && line.trim() !== `${name}:`) {
      lines.push(line);
      line = "";
    }
    line += ` ${token}`;
  }
  lines.push(line);
  return lines.join("\r\n");
}

/** "Wed, 04 Nov 2026 13:05:09 +0000". */
export function mailDate(d: Date): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = (n: number) => String(n).padStart(2, "0");
  return `${days[d.getUTCDay()]}, ${p(d.getUTCDate())} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} +0000`;
}

/**
 * Quoted-printable (RFC 2045) of UTF-8 text. Printable ASCII stays readable, "=" and every other byte become
 * =XX, a space or tab at the end of a line is encoded, line breaks become CRLF, and long lines get soft breaks
 * ("=" at the end) so no line passes 76 characters. An =XX is never split by a soft break.
 */
export function quotedPrintable(text: string): string {
  const out: string[] = [];
  for (const line of text.replace(/\r\n?/g, "\n").split("\n")) {
    const tokens: string[] = [];
    for (const b of utf8(line)) tokens.push((b >= 33 && b <= 126 && b !== 61) || b === 32 || b === 9 ? String.fromCharCode(b) : `=${b.toString(16).toUpperCase().padStart(2, "0")}`);
    const last = tokens.length - 1;
    if (last >= 0 && (tokens[last] === " " || tokens[last] === "\t")) tokens[last] = tokens[last] === " " ? "=20" : "=09";
    let physical = "";
    for (const token of tokens) {
      if (physical.length + token.length > MAX_LINE - 1) {
        out.push(`${physical}=`);
        physical = "";
      }
      physical += token;
    }
    out.push(physical);
  }
  return out.join("\r\n");
}

function part(type: string, body: string): string[] {
  return [`Content-Type: ${type}; charset=utf-8`, "Content-Transfer-Encoding: quoted-printable", "", quotedPrintable(body)];
}

/** The whole message, ready for EmailMessage: headers, a blank line, the body. CRLF line endings throughout. */
export function buildMime(mail: Mail): string {
  const messageId = headerText(mail.messageId);
  if (!MESSAGE_ID.test(messageId)) throw new Error("Refusing an unsafe Message-ID.");
  const head = [
    headerLine("From", addressTokens(mail.from)),
    headerLine("To", addressTokens(mail.to)),
    ...(mail.replyTo ? [headerLine("Reply-To", addressTokens(mail.replyTo))] : []),
    headerLine("Subject", textTokens(mail.subject)),
    `Date: ${mailDate(mail.date)}`,
    `Message-ID: <${messageId}>`,
    "MIME-Version: 1.0",
  ];
  if (!mail.html) return [...head, ...part("text/plain", mail.text), ""].join("\r\n");
  const boundary = headerText(mail.boundary ?? `=_exhibit_${crypto.randomUUID()}`);
  return [
    ...head,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    ...part("text/plain", mail.text),
    `--${boundary}`,
    ...part("text/html", mail.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}
