// Time zone arithmetic for the contact form's scheduler and the email it sends, with no dependencies.
//
// An instant is UTC milliseconds. A day is a calendar date written "2026-11-05"; a clock is "09:30".
// Only Intl.DateTimeFormat's numeric parts are used and every name comes from the tables below, so the
// output is identical in browsers, Node and the Workers runtime, whatever locale data each one ships.
// Shared by the browser and the Worker: relative imports only, nothing from React or Next.

export const IST_ZONE = "Asia/Kolkata";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ICU still answers with some retired city names; show the ones people use today.
const CITY_NAMES: Record<string, string> = {
  Asmera: "Asmara",
  Calcutta: "Kolkata",
  Enderbury: "Kanton",
  Faeroe: "Faroe",
  Godthab: "Nuuk",
  Katmandu: "Kathmandu",
  Kiev: "Kyiv",
  Ponape: "Pohnpei",
  Rangoon: "Yangon",
  Saigon: "Ho Chi Minh City",
  Truk: "Chuuk",
};

export type Wall = { year: number; month: number; day: number; hour: number; minute: number };

const pad = (n: number) => String(n).padStart(2, "0");

const formatters = new Map<string, Intl.DateTimeFormat>();
function partsIn(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: zone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
    formatters.set(zone, f);
  }
  return f;
}

/** True for a time zone name this runtime understands ("Europe/Berlin", "UTC"). */
export function isTimeZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || !zone || zone.length > 64) return false;
  try {
    partsIn(zone);
    return true;
  } catch {
    return false;
  }
}

/** The wall clock in a zone at an instant. */
export function wallClock(instant: number, zone: string): Wall {
  const w: Wall = { year: 0, month: 0, day: 0, hour: 0, minute: 0 };
  for (const p of partsIn(zone).formatToParts(instant)) {
    if (p.type === "year" || p.type === "month" || p.type === "day" || p.type === "hour" || p.type === "minute") w[p.type] = Number(p.value);
  }
  if (w.hour === 24) w.hour = 0; // older engines print midnight as 24 of the same day
  return w;
}

/** Minutes the zone is ahead of UTC at an instant: 330 for India, -300 for New York in winter. */
export function offsetMinutes(instant: number, zone: string): number {
  const w = wallClock(instant, zone);
  return Math.round((Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute) - Math.floor(instant / 60_000) * 60_000) / 60_000);
}

export const dayKey = (year: number, month: number, day: number) => `${year}-${pad(month)}-${pad(day)}`;
const splitDay = (day: string) => day.split("-").map(Number) as [number, number, number];

/** The calendar day in a zone at an instant. */
export function dayOf(instant: number, zone: string): string {
  const w = wallClock(instant, zone);
  return dayKey(w.year, w.month, w.day);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = splitDay(day);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return dayKey(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 0 is Sunday, 6 is Saturday. */
export function weekdayOf(day: string): number {
  const [y, m, d] = splitDay(day);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isWeekend(day: string): boolean {
  const w = weekdayOf(day);
  return w === 0 || w === 6;
}

/** "2026-11" for any day in November 2026. */
export const monthOf = (day: string) => day.slice(0, 7);

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}`;
}

/** Every day of a month, in order. */
export function daysInMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => dayKey(y, m, i + 1));
}

/**
 * The instant a wall-clock time happens in a zone, or null when the zone's clocks skip it (the hour lost
 * when summer time starts). In the repeated hour when summer time ends, the later of the two is returned.
 */
export function zonedInstant(day: string, clock: string, zone: string): number | null {
  const [y, m, d] = splitDay(day);
  const [h, mi] = clock.split(":").map(Number);
  const asUtc = Date.UTC(y, m - 1, d, h, mi);
  let t = asUtc - offsetMinutes(asUtc, zone) * 60_000;
  t = asUtc - offsetMinutes(t, zone) * 60_000;
  const w = wallClock(t, zone);
  return w.year === y && w.month === m && w.day === d && w.hour === h && w.minute === mi ? t : null;
}

// ---------------------------------------------------------------- words

/** "GMT+1", "GMT+5:30", "GMT-3:30", "GMT". */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return "GMT";
  const a = Math.abs(minutes);
  return `GMT${minutes > 0 ? "+" : "-"}${Math.floor(a / 60)}${a % 60 ? `:${pad(a % 60)}` : ""}`;
}

/** The place a zone is named after: "Berlin", "New York", "Kolkata". Null for zones named by offset. */
export function zoneCity(zone: string): string | null {
  if (zone === "UTC" || zone.startsWith("Etc/") || !zone.includes("/")) return null;
  const last = zone.slice(zone.lastIndexOf("/") + 1).replace(/_/g, " ");
  return CITY_NAMES[last] ?? last;
}

/** How a zone reads in a sentence: "Berlin time", or "UTC" and "GMT-5" for zones named by offset. */
export function zoneName(zone: string, at: number): string {
  const city = zoneCity(zone);
  if (city) return `${city} time`;
  return zone === "UTC" || zone === "Etc/UTC" ? "UTC" : formatOffset(offsetMinutes(at, zone));
}

/** "Thu 5 Nov". */
export function dayShort(day: string): string {
  const [, m, d] = splitDay(day);
  return `${WEEKDAYS[weekdayOf(day)].slice(0, 3)} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

/** "Thursday 5 November". */
export function dayLong(day: string): string {
  const [, m, d] = splitDay(day);
  return `${WEEKDAYS[weekdayOf(day)]} ${d} ${MONTHS[m - 1]}`;
}

export const weekdayName = (index: number) => WEEKDAYS[index];

/** "November 2026". */
export function monthTitle(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** "09:30", or "9:30 am" on a 12-hour clock. */
export function clockText(hour: number, minute: number, twelveHour = false): string {
  if (!twelveHour) return `${pad(hour)}:${pad(minute)}`;
  return `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? "am" : "pm"}`;
}

/** A clock string ("14:30") in words for this visitor. */
export function clockLabel(clock: string, twelveHour = false): string {
  const [h, m] = clock.split(":").map(Number);
  return clockText(h, m, twelveHour);
}

/** "Thu 5 Nov, 09:30" for an instant in a zone. */
export function dayAndClock(instant: number, zone: string, twelveHour = false): string {
  const w = wallClock(instant, zone);
  return `${dayShort(dayKey(w.year, w.month, w.day))}, ${clockText(w.hour, w.minute, twelveHour)}`;
}

/** "India is 4 h 30 min ahead of you", for the scheduler's day heading. */
export function indiaGap(zone: string, at: number): string {
  const diff = offsetMinutes(at, IST_ZONE) - offsetMinutes(at, zone);
  if (diff === 0) return "You're on India time, like the founders.";
  const a = Math.abs(diff);
  const span = [Math.floor(a / 60) ? `${Math.floor(a / 60)} h` : "", a % 60 ? `${a % 60} min` : ""].filter(Boolean).join(" ");
  return `India is ${span} ${diff > 0 ? "ahead of" : "behind"} you.`;
}
