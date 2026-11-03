// Guarantee: the contact form's email is well-formed MIME, and nothing a visitor types can add a header to it.
// CR and LF never reach a header (no Bcc: smuggled in through a name or subject), unsafe addresses are refused,
// non-ASCII names and subjects are RFC 2047 encoded, and quoted-printable bodies decode back to the exact text.
import { describe, expect, it } from "vitest";
import { buildMime, encodedWords, headerLine, headerText, mailDate, quotedPrintable, type Mail } from "../deploy/site/mime";

const decodeQP = (s: string) => {
  const joined = s.replace(/=\r\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i++) {
    if (joined[i] === "=") {
      bytes.push(parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...new TextEncoder().encode(joined[i]));
  }
  return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\r\n/g, "\n");
};
const decodeWords = (s: string) =>
  s
    .replace(/\r\n /g, " ")
    .replace(/\?= =\?/g, "?==?")
    .replace(/=\?UTF-8\?B\?([^?]+)\?=/g, (_, b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))));

/** The header block, unfolded: one entry per header. */
const headersOf = (raw: string) =>
  raw
    .slice(0, raw.indexOf("\r\n\r\n"))
    .replace(/\r\n[ \t]/g, " ")
    .split("\r\n");

const base: Mail = {
  from: { name: "Ada Lovelace via Exhibit", email: "contact@exhibit.9to5code.com" },
  to: { email: "founders@example.com" },
  replyTo: { name: "Ada Lovelace", email: "ada@example.com" },
  subject: "Demo request: Ada Lovelace, Acme",
  text: "Hello Shivansh and Someet,\n\nI'd like a demo of Exhibit.",
  html: "<p>Hello Shivansh and Someet,</p>",
  date: new Date(Date.UTC(2026, 10, 4, 6, 5, 9)),
  messageId: "3f2a9c1e@exhibit.9to5code.com",
  boundary: "=_exhibit_test",
};

describe("header sanitising", () => {
  it("turns CR, LF and other control characters into spaces", () => {
    expect(headerText("Ada\r\nBcc: evil@example.com")).toBe("Ada Bcc: evil@example.com");
    expect(headerText("a\u0000b\tc d\u0085e")).toBe("a b c d e");
    expect(headerText("  lots   of\n\n space ")).toBe("lots of space");
  });

  it("keeps a subject with a smuggled Bcc on one Subject header", () => {
    const raw = buildMime({ ...base, subject: "Demo request\r\nBcc: evil@example.com\r\n\r\nspam body" });
    const headers = headersOf(raw);
    expect(headers.filter((h) => /^bcc:/i.test(h))).toEqual([]);
    expect(headers.filter((h) => h.startsWith("Subject:"))).toEqual(["Subject: Demo request Bcc: evil@example.com spam body"]);
  });

  it("keeps a display name with CR or LF inside its own header", () => {
    const raw = buildMime({ ...base, replyTo: { name: "Ada\nBcc: evil@example.com", email: "ada@example.com" }, from: { name: "x\r\nTo: evil@example.com", email: "contact@exhibit.9to5code.com" } });
    const headers = headersOf(raw);
    expect(headers.filter((h) => /^(bcc|to):/i.test(h))).toEqual(["To: <founders@example.com>"]);
    expect(headers).toContain('Reply-To: "Ada Bcc: evil@example.com" <ada@example.com>');
  });

  it("refuses an address that could break out of the angle brackets", () => {
    for (const email of ["ada@example.com>\r\nBcc: evil@example.com", "ada@example.com, evil@example.com", "Ada <ada@example.com>", "ada@exa mple.com", "@example.com"]) {
      expect(() => buildMime({ ...base, replyTo: { email } })).toThrow(/unsafe email address/);
    }
  });

  it("refuses a Message-ID with anything but an id in it", () => {
    expect(() => buildMime({ ...base, messageId: "x@y>\r\nBcc: evil@example.com" })).toThrow(/Message-ID/);
  });

  it("quotes plain display names and escapes quotes and backslashes", () => {
    const raw = buildMime({ ...base, replyTo: { name: 'Ada "Countess" Love\\lace', email: "ada@example.com" } });
    expect(headersOf(raw)).toContain('Reply-To: "Ada \\"Countess\\" Love\\\\lace" <ada@example.com>');
  });
});

describe("encoded words", () => {
  it("encodes a non-ASCII subject and decodes back to it, with every header line within 76 characters", () => {
    const subject = "Demo request: Søren Kierkegaard, Café Ørsted, 東京の店, and a very long tail to force folding";
    const raw = buildMime({ ...base, subject });
    const head = raw.slice(0, raw.indexOf("\r\n\r\n"));
    const line = head.split("\r\n").findIndex((l) => l.startsWith("Subject:"));
    const subjectLines = head.split("\r\n").slice(line).filter((l, i) => i === 0 || l.startsWith(" "));
    expect(subjectLines.length).toBeGreaterThan(1);
    for (const l of subjectLines) expect(l.length).toBeLessThanOrEqual(76);
    expect(decodeWords(subjectLines.join("\r\n").slice("Subject: ".length))).toBe(subject);
  });

  it("never splits a character between two words", () => {
    const words = encodedWords("é".repeat(40) + "😀".repeat(20));
    for (const w of words) expect(() => new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(atob(w.slice(10, -2)), (c) => c.charCodeAt(0)))).not.toThrow();
  });

  it("encodes text that already looks like an encoded word, so it arrives as typed", () => {
    const raw = buildMime({ ...base, subject: "=?UTF-8?B?aGk=?= literally" });
    const subject = headersOf(raw).find((h) => h.startsWith("Subject:"))!;
    expect(subject).not.toContain("aGk=?= literally");
    expect(decodeWords(subject.slice(9))).toBe("=?UTF-8?B?aGk=?= literally");
  });

  it("folds long plain headers at spaces", () => {
    const line = headerLine("Subject", "Demo request: a name that goes on and on, with a company name that also goes on and on".split(" "));
    expect(line.split("\r\n").every((l) => l.length <= 76)).toBe(true);
    expect(line.replace(/\r\n /g, " ")).toBe("Subject: Demo request: a name that goes on and on, with a company name that also goes on and on");
  });
});

describe("quoted-printable", () => {
  it("leaves plain text readable and encodes =, non-ASCII and trailing spaces", () => {
    expect(quotedPrintable("a = b")).toBe("a =3D b");
    expect(quotedPrintable("café")).toBe("caf=C3=A9");
    expect(quotedPrintable("trailing \nspace\t")).toBe("trailing=20\r\nspace=09");
  });

  it("wraps long lines with soft breaks and never splits an escape", () => {
    const text = `${"é".repeat(60)} ${"word ".repeat(40)}\n${"=".repeat(100)}`;
    const qp = quotedPrintable(text);
    for (const l of qp.split("\r\n")) {
      expect(l.length).toBeLessThanOrEqual(76);
      expect(l).not.toMatch(/=[0-9A-F]=?$/); // a lone "=" at the end is a soft break; half an escape never is
    }
    expect(decodeQP(qp)).toBe(text);
  });
});

describe("the whole message", () => {
  const raw = buildMime(base);

  it("has the headers the founders need, in order, with Reply-To set to the visitor", () => {
    expect(headersOf(raw)).toEqual([
      'From: "Ada Lovelace via Exhibit" <contact@exhibit.9to5code.com>',
      "To: <founders@example.com>",
      'Reply-To: "Ada Lovelace" <ada@example.com>',
      "Subject: Demo request: Ada Lovelace, Acme",
      "Date: Wed, 04 Nov 2026 06:05:09 +0000",
      "Message-ID: <3f2a9c1e@exhibit.9to5code.com>",
      "MIME-Version: 1.0",
      'Content-Type: multipart/alternative; boundary="=_exhibit_test"',
    ]);
  });

  it("uses CRLF everywhere and keeps every line within 998 characters", () => {
    expect(raw.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
    for (const l of raw.split("\r\n")) expect(l.length).toBeLessThanOrEqual(998);
  });

  it("carries a plain-text part and an HTML part, both UTF-8 quoted-printable", () => {
    const parts = raw.split("--=_exhibit_test");
    expect(parts).toHaveLength(4);
    expect(parts[3]).toBe("--\r\n");
    expect(parts[1]).toContain("Content-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n");
    expect(parts[2]).toContain("Content-Type: text/html; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n");
    const text = parts[1].split("\r\n\r\n").slice(1).join("\r\n\r\n").replace(/\r\n$/, "");
    expect(decodeQP(text)).toBe(base.text);
  });

  it("is plain text only when there is no HTML", () => {
    const single = buildMime({ ...base, html: undefined });
    expect(single).not.toContain("multipart");
    expect(headersOf(single).slice(-2)).toEqual(["Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: quoted-printable"]);
  });

  it("can't be cut short by a body that contains the boundary", () => {
    const tricky = buildMime({ ...base, text: "--=_exhibit_test--\nstill the body", html: "--=_exhibit_test" });
    expect(tricky.split("\r\n").filter((l) => l.startsWith("--=_exhibit_test"))).toEqual(["--=_exhibit_test", "--=_exhibit_test", "--=_exhibit_test--"]);
  });

  it("dates in RFC 5322 form", () => {
    expect(mailDate(new Date(Date.UTC(2027, 0, 9, 23, 4, 5)))).toBe("Sat, 09 Jan 2027 23:04:05 +0000");
  });
});
