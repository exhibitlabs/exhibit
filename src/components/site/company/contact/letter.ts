// The letter the contact form sends: one composition for the live preview beside the form, the email the
// Worker sends to the founders (plain text and HTML) and the email-app fallback, so all three say the same.
// Proposed times always appear in the visitor's zone and in IST, because the founders are in India.
// Shared by the browser and the Worker: relative imports only, nothing from React or Next.
import type { ContactMessage, Topic } from "./submission";
import { IST_ZONE, clockText, dayAndClock, dayKey, dayOf, dayShort, formatOffset, offsetMinutes, wallClock, zoneCity, zoneName } from "./zones";

export const GREETING = "Hello Shivansh and Someet,";

/** What the letter is built from. The form passes its fields as typed; the Worker passes a validated message. */
export type LetterInput = Pick<ContactMessage, "topic" | "name" | "email" | "company" | "website" | "volume" | "message" | "times" | "timeZone">;

/** A piece of text, and the grey stand-in the preview shows while it is empty. Empty pieces are left out of the email. */
export type Piece = { text: string; placeholder?: string };

export type Block =
  | { kind: "lines"; lines: Piece[] }
  | { kind: "fields"; rows: (Piece & { label: string })[] }
  | { kind: "times"; label: string; items: string[]; placeholder: string }
  | { kind: "message"; piece: Piece }
  | { kind: "note"; lines: string[] };

/** "Demo request: Ada Lovelace, Acme". */
export function subjectFor({ topic, name, company }: { topic: Topic; name: string; company: string }): string {
  const head = topic === "demo" ? "Demo request" : topic === "question" ? "Question" : "Message";
  const who = [name.trim(), company.trim()].filter(Boolean).join(", ");
  return who ? `${head}: ${who}` : head;
}

/** One proposed time: "Thu 5 Nov, 09:00 Berlin time (GMT+1) = 13:30 IST", with IST's date when it differs. */
export function timeLine(at: number, zone: string): string {
  const ist = offsetMinutes(at, IST_ZONE);
  const off = offsetMinutes(at, zone);
  if (off === ist) return `${dayAndClock(at, IST_ZONE)} IST`;
  const local = `${dayAndClock(at, zone)} ${zoneName(zone, at)}${zoneCity(zone) ? ` (${formatOffset(off)})` : ""}`;
  const w = wallClock(at, IST_ZONE);
  const inIndia = dayOf(at, IST_ZONE) === dayOf(at, zone) ? clockText(w.hour, w.minute) : dayAndClock(at, IST_ZONE);
  return `${local} = ${inIndia} IST`;
}

/** The letter, block by block, with stand-ins for what the visitor hasn't filled in yet. */
export function letterBlocks(l: LetterInput): Block[] {
  const t = (s: string) => s.trim();
  if (l.topic === "demo") {
    return [
      { kind: "lines", lines: [{ text: GREETING }] },
      { kind: "lines", lines: [{ text: "I'd like a demo of Exhibit." }] },
      {
        kind: "fields",
        rows: [
          { label: "Name", text: t(l.name), placeholder: "your name" },
          { label: "Email", text: t(l.email), placeholder: "your email" },
          { label: "Company or store", text: t(l.company), placeholder: "optional" },
          { label: "Website", text: t(l.website), placeholder: "optional" },
          { label: "PayPal disputes a month", text: t(l.volume), placeholder: "optional" },
        ],
      },
      { kind: "times", label: "Times that suit me", items: l.times.map((at) => timeLine(at, l.timeZone)), placeholder: "optional" },
      { kind: "message", piece: { text: t(l.message) } },
    ];
  }
  return [
    { kind: "lines", lines: [{ text: GREETING }] },
    { kind: "message", piece: { text: t(l.message), placeholder: "your message" } },
    { kind: "lines", lines: [{ text: t(l.name), placeholder: "your name" }, { text: t(l.company) }, { text: t(l.email), placeholder: "your email" }] },
  ];
}

function blockText(b: Block): string {
  switch (b.kind) {
    case "lines":
      return b.lines
        .map((p) => p.text)
        .filter(Boolean)
        .join("\n");
    case "fields":
      return b.rows
        .filter((r) => r.text)
        .map((r) => `${r.label}: ${r.text}`)
        .join("\n");
    case "times":
      return b.items.length ? `${b.label}:\n${b.items.map((i) => `- ${i}`).join("\n")}` : "";
    case "message":
      return b.piece.text;
    case "note":
      return b.lines.join("\n");
  }
}

/** The letter as plain text, empty lines left out. */
export function letterText(blocks: Block[]): string {
  return blocks.map(blockText).filter(Boolean).join("\n\n");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const P = "margin:0 0 16px";

function blockHtml(b: Block): string {
  switch (b.kind) {
    case "lines": {
      const lines = b.lines.map((p) => p.text).filter(Boolean);
      return lines.length ? `<p style="${P}">${lines.map(esc).join("<br>")}</p>` : "";
    }
    case "fields": {
      const rows = b.rows.filter((r) => r.text);
      if (!rows.length) return "";
      const tr = rows.map((r) => `<tr><td style="padding:3px 18px 3px 0;color:#6b6b6b;vertical-align:top;white-space:nowrap">${esc(r.label)}</td><td style="padding:3px 0;color:#0a0a0a">${esc(r.text)}</td></tr>`);
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;${P}">${tr.join("")}</table>`;
    }
    case "times":
      if (!b.items.length) return "";
      return `<p style="margin:0 0 6px"><strong>${esc(b.label)}</strong></p><ul style="margin:0 0 16px;padding-left:20px">${b.items.map((i) => `<li style="margin:3px 0">${esc(i)}</li>`).join("")}</ul>`;
    case "message":
      return b.piece.text ? `<p style="${P};white-space:pre-wrap">${esc(b.piece.text)}</p>` : "";
    case "note":
      return `<p style="margin:28px 0 0;color:#6b6b6b;font-size:13px;line-height:1.5">${b.lines.map(esc).join("<br>")}</p>`;
  }
}

/** The letter as a small HTML email. Every value is escaped; nothing is linked or loaded. */
export function letterHtml(blocks: Block[], title: string): string {
  return [
    `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head>`,
    `<body style="margin:0;padding:24px;background:#ffffff">`,
    `<div style="max-width:600px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#0a0a0a">`,
    blocks.map(blockHtml).join(""),
    `</div></body></html>`,
  ].join("");
}

/** "Wed 4 Nov 2026, 13:05 UTC (18:35 IST)", with IST's date too when it is already the next day there. */
export function sentStamp(at: number): string {
  const u = wallClock(at, "UTC");
  const ist = wallClock(at, IST_ZONE);
  const istDay = dayOf(at, IST_ZONE) === dayOf(at, "UTC") ? "" : `${dayShort(dayOf(at, IST_ZONE))}, `;
  return `${dayShort(dayKey(u.year, u.month, u.day))} ${u.year}, ${clockText(u.hour, u.minute)} UTC (${istDay}${clockText(ist.hour, ist.minute)} IST)`;
}

/** The email the Worker sends: the letter, then where and when it was sent. */
export function composeEmail(m: ContactMessage, sentAt: number): { subject: string; text: string; html: string } {
  const note: string[] = [`Sent with the contact form on ${m.page || "exhibit.9to5code.com"}`, `Came from: ${m.referrer || "no referring page"}`, `Sent: ${sentStamp(sentAt)}`];
  if (m.times.length) note.push(`Visitor's time zone: ${m.timeZone} (${formatOffset(offsetMinutes(m.times[0], m.timeZone))})`);
  const blocks: Block[] = [...letterBlocks(m), { kind: "note", lines: note }];
  const subject = subjectFor(m);
  return { subject, text: letterText(blocks), html: letterHtml(blocks, subject) };
}
