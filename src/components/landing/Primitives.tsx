// Formatting helpers shared by /pitch (src/app/pitch/page.tsx). The old landing components that also lived
// here were replaced by the site kit in src/components/site.

/** Sentences of a text, without splitting "$68.00" or "3-D". */
export const sentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

export const usd = (n: number, digits = 0) => `$${n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 20, 2026" in UTC, so server and browser always agree. */
export function utcDate(iso: string) {
  const d = new Date(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** "Oct 20, 13:34 UTC". */
export function utcDateTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${hh}:${mm} UTC`;
}

export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
