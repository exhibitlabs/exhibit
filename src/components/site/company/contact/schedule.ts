// Which demo times the contact form offers. The visitor proposes up to three; the founders confirm one by
// email. Times are offered in the visitor's own zone, every half hour from 08:00 to 19:30, from 12 hours
// from now to four weeks out, weekends included. Shared by the browser and the Worker.
import { addDays, dayOf, isWeekend, zonedInstant } from "./zones";

export const MAX_PICKS = 3;
export const WINDOW_DAYS = 28;
export const MIN_NOTICE_MS = 12 * 60 * 60 * 1000;

const FIRST_SLOT_MIN = 8 * 60;
const LAST_SLOT_MIN = 19 * 60 + 30;
const STEP_MIN = 30;

const pad = (n: number) => String(n).padStart(2, "0");

/** The clock times offered on every day: "08:00", "08:30" … "19:30". */
export const SLOT_CLOCKS: readonly string[] = Array.from({ length: (LAST_SLOT_MIN - FIRST_SLOT_MIN) / STEP_MIN + 1 }, (_, i) => {
  const m = FIRST_SLOT_MIN + i * STEP_MIN;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
});

/** A time the visitor picked, as they saw it: a day and a clock in their chosen zone. */
export type Pick = { day: string; clock: string };

/** The first and last bookable day, in the visitor's zone. */
export function bookableDays(zone: string, now: number): { first: string; last: string } {
  const first = dayOf(now, zone);
  return { first, last: addDays(first, WINDOW_DAYS - 1) };
}

/** The instant of a day and clock if it is still offered, or null (too soon, outside the window, or a clock the zone skips). */
export function offeredAt(pick: Pick, zone: string, now: number): number | null {
  const { first, last } = bookableDays(zone, now);
  if (pick.day < first || pick.day > last || !SLOT_CLOCKS.includes(pick.clock)) return null;
  const at = zonedInstant(pick.day, pick.clock, zone);
  return at !== null && at >= now + MIN_NOTICE_MS ? at : null;
}

/** The times still offered on a day. */
export function slotsOn(day: string, zone: string, now: number): { clock: string; at: number }[] {
  return SLOT_CLOCKS.flatMap((clock) => {
    const at = offeredAt({ day, clock }, zone, now);
    return at === null ? [] : [{ clock, at }];
  });
}

/** Whether a day has any time left, without building its slots (the calendar asks this for every cell). */
export function hasSlots(day: string, zone: string, now: number): boolean {
  const { first, last } = bookableDays(zone, now);
  if (day < first || day > last) return false;
  // Every slot on a day after the earliest bookable instant's own day is late enough.
  const earliestDay = dayOf(now + MIN_NOTICE_MS, zone);
  if (day !== earliestDay) return day > earliestDay;
  return slotsOn(day, zone, now).length > 0;
}

/** The day the calendar opens on: the first weekday with a time left, else the first day with one. */
export function firstChoiceDay(zone: string, now: number): string {
  const { first } = bookableDays(zone, now);
  const open = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(first, i)).filter((d) => hasSlots(d, zone, now));
  return open.find((d) => !isWeekend(d)) ?? open[0] ?? first;
}
