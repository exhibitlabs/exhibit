// Recorded runs quote the dates of the demo case they were recorded against. The demo merchant is
// re-seeded relative to "now", so every date in a case moves by whole days between the recording
// and today. These helpers move the dates in recorded text by the same number of days, the way
// replay.ts already maps ids, so a replayed brief always agrees with the records it cites.
// Pure: safe on client and server, and easy to test.

const DAY = 86_400_000;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_RE = "(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)";

function monthIndex(name: string) {
  const n = name.slice(0, 3).toLowerCase();
  return MON.findIndex((m) => m.toLowerCase() === n);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Whole UTC days from `from` to `to`. */
export function dayDelta(from: string | Date, to: string | Date) {
  const a = new Date(from);
  const b = new Date(to);
  const da = Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate());
  const db = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  return Math.round((db - da) / DAY);
}

function shift(y: number, m: number, d: number, delta: number) {
  const t = new Date(Date.UTC(y, m, d) + delta * DAY);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}

/** A year-less date ("Oct 6") belongs to the year that puts it closest to the recording date. */
function yearFor(m: number, d: number, ref: Date) {
  const y = ref.getUTCFullYear();
  const candidates = [y - 1, y, y + 1].map((yy) => ({ yy, gap: Math.abs(Date.UTC(yy, m, d) - ref.getTime()) }));
  return candidates.sort((a, b) => a.gap - b.gap)[0].yy;
}

// One pass, longest formats first, so nothing is shifted twice.
const PATTERN = new RegExp(
  [
    String.raw`\b(\d{4})-(\d{2})-(\d{2})(T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?\b`, // 1-4 ISO date or datetime
    String.raw`\b${MONTH_RE} (\d{1,2})(?:st|nd|rd|th)?(?:, (\d{4}))?\b(?!\d)`, // 5-7 October 6[, 2026]
    String.raw`\b(\d{1,2}) ${MONTH_RE}(?: (\d{4}))?\b`, // 8-10 6 October[ 2026]
    String.raw`\b${MONTH_RE} (\d{4})\b`, // 11-12 October 2026
    String.raw`\b(0?[1-9]|[12]\d|3[01])\.(0?[1-9]|1[0-2])\.(\d{4})\b`, // 13-15 18.10.2026
    // Two-digit month and day only ("10/05"), so fractions like 1/2 are never read as dates.
    String.raw`\b(0[1-9]|1[0-2])/(0[1-9]|[12]\d|3[01])(?:/(\d{4}))?\b(?![/\d])`, // 16-18 10/05[/2026]
  ].join("|"),
  "g",
);

/**
 * Moves every date in `text` by `delta` days. `ref` is the recording date (resolves years that the
 * text leaves out). `known` lists full dates from the recorded case: a bare "February 2026" moves
 * only when a known date falls in that month, so policy versions and other fixed months stay put.
 */
export function shiftDates(text: string, delta: number, ref: Date, known: string[] = []): string {
  if (!delta || !text) return text;
  return text.replace(PATTERN, (match, ...g: (string | undefined)[]) => {
    // ISO date or datetime
    if (g[0]) {
      const s = shift(Number(g[0]), Number(g[1]) - 1, Number(g[2]), delta);
      return `${s.y}-${pad(s.m + 1)}-${pad(s.d)}${g[3] ?? ""}`;
    }
    // Month D[, YYYY]
    if (g[4]) {
      const m = monthIndex(g[4]);
      const d = Number(g[5]);
      if (m < 0 || d < 1 || d > 31) return match;
      const y = g[6] ? Number(g[6]) : yearFor(m, d, ref);
      const s = shift(y, m, d, delta);
      const name = g[4].length > 3 && g[4] !== "Sept" ? MONTHS[s.m] : MON[s.m];
      const suffix = /\d(st|nd|rd|th)\b/.test(match) ? ordinal(s.d) : "";
      return `${name} ${s.d}${suffix}${g[6] ? `, ${s.y}` : ""}`;
    }
    // D Month[ YYYY]
    if (g[7]) {
      const m = monthIndex(g[8]!);
      const d = Number(g[7]);
      if (m < 0 || d < 1 || d > 31) return match;
      const y = g[9] ? Number(g[9]) : yearFor(m, d, ref);
      const s = shift(y, m, d, delta);
      const name = g[8]!.length > 3 && g[8] !== "Sept" ? MONTHS[s.m] : MON[s.m];
      return `${s.d} ${name}${g[9] ? ` ${s.y}` : ""}`;
    }
    // Month YYYY: only when the recorded case has a date in that month.
    if (g[10]) {
      const m = monthIndex(g[10]);
      const y = Number(g[11]);
      const hit = known.map((k) => new Date(k)).find((k) => !Number.isNaN(k.getTime()) && k.getUTCFullYear() === y && k.getUTCMonth() === m);
      if (!hit) return match;
      const s = shift(y, m, hit.getUTCDate(), delta);
      const name = g[10].length > 3 && g[10] !== "Sept" ? MONTHS[s.m] : MON[s.m];
      return `${name} ${s.y}`;
    }
    // DD.MM.YYYY
    if (g[12]) {
      const s = shift(Number(g[14]), Number(g[13]) - 1, Number(g[12]), delta);
      return `${g[12].length === 2 ? pad(s.d) : s.d}.${g[13]!.length === 2 ? pad(s.m + 1) : s.m + 1}.${s.y}`;
    }
    // MM/DD[/YYYY]
    if (g[15]) {
      const m = Number(g[15]) - 1;
      const d = Number(g[16]);
      const y = g[17] ? Number(g[17]) : yearFor(m, d, ref);
      const s = shift(y, m, d, delta);
      const mm = g[15].length === 2 ? pad(s.m + 1) : String(s.m + 1);
      const dd = g[16]!.length === 2 ? pad(s.d) : String(s.d);
      return `${mm}/${dd}${g[17] ? `/${s.y}` : ""}`;
    }
    return match;
  });
}

function ordinal(d: number) {
  if (d % 100 >= 11 && d % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][d % 10] ?? "th";
}

/** Applies shiftDates to every string inside a JSON-like value. */
export function shiftDatesDeep<T>(value: T, delta: number, ref: Date, known: string[] = []): T {
  if (!delta) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return shiftDates(v, delta, ref, known);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  return walk(value) as T;
}
