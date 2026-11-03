"use client";

import { ChevronLeft, ChevronRight, Globe, X } from "lucide-react";
import { memo, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MAX_PICKS, bookableDays, firstChoiceDay, hasSlots, slotsOn, type Pick } from "./contact/schedule";
import {
  IST_ZONE,
  addDays,
  addMonths,
  clockLabel,
  clockText,
  dayLong,
  dayOf,
  dayShort,
  daysInMonth,
  formatOffset,
  indiaGap,
  isWeekend,
  monthOf,
  monthTitle,
  offsetMinutes,
  wallClock,
  weekdayName,
  weekdayOf,
  zoneCity,
  zonedInstant,
} from "./contact/zones";

/** A picked time and the instant it means in the visitor's current zone. */
export type PickedTime = Pick & { at: number };

const REGIONS: [string, string][] = [
  ["Africa", "Africa"],
  ["America", "Americas"],
  ["Antarctica", "Antarctica"],
  ["Arctic", "Arctic"],
  ["Asia", "Asia"],
  ["Atlantic", "Atlantic"],
  ["Australia", "Australia"],
  ["Europe", "Europe"],
  ["Indian", "Indian Ocean"],
  ["Pacific", "Pacific"],
];

/** Every time zone this browser knows, grouped by region and labelled with its city and current offset. */
function zoneGroups(at: number, current: string): { region: string; zones: { value: string; label: string }[] }[] {
  let names: string[] = [];
  try {
    names = Intl.supportedValuesOf("timeZone");
  } catch {
    names = [];
  }
  const groups = new Map<string, { value: string; label: string }[]>();
  for (const z of new Set([...names, "UTC", current])) {
    let label: string;
    try {
      const city = zoneCity(z);
      const off = formatOffset(offsetMinutes(at, z));
      label = city ? `${city} (${off})` : z === "UTC" || z === "Etc/UTC" ? "UTC" : off;
    } catch {
      continue;
    }
    const region = REGIONS.find(([k]) => z.startsWith(`${k}/`))?.[1] ?? "Other";
    groups.set(region, [...(groups.get(region) ?? []), { value: z, label }]);
  }
  return [...REGIONS.map(([, r]) => r), "Other"].filter((r) => groups.has(r)).map((region) => ({ region, zones: groups.get(region)!.sort((a, b) => a.label.localeCompare(b.label)) }));
}

/** The IST equivalent of a time, for the list of picks: "13:30 IST", with the date when India is already on the next day. */
function inIndia(at: number, zone: string, twelveHour: boolean): string | null {
  if (offsetMinutes(at, zone) === offsetMinutes(at, IST_ZONE)) return null;
  const w = wallClock(at, IST_ZONE);
  const clock = clockText(w.hour, w.minute, twelveHour);
  return dayOf(at, IST_ZONE) === dayOf(at, zone) ? `${clock} IST` : `${dayShort(dayOf(at, IST_ZONE))}, ${clock} IST`;
}

const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Monday first, so the weekend closes each row

/** A slot's time; on a 12-hour clock "am" and "pm" are set smaller, so "12:30 pm" fits a narrow button. */
function SlotTime({ clock, twelveHour }: { clock: string; twelveHour: boolean }) {
  if (!twelveHour) return <>{clock}</>;
  const [time, meridiem] = clockLabel(clock, true).split(" ");
  return (
    <>
      {time}
      <span className="s-sched__ampm"> {meridiem}</span>
    </>
  );
}

/** The field around the scheduler: its label, the limit, and what goes inside (the calendar, or its stand-in). */
export function SchedulerField({ labelId, hintId, children }: { labelId: string; hintId: string; children: ReactNode }) {
  return (
    <div className="s-sched" role="group" aria-labelledby={labelId} aria-describedby={hintId}>
      <div className="s-sched__head">
        <span id={labelId} className="s-sched__label">
          Times that suit you <small>(optional)</small>
        </span>
        <span id={hintId} className="s-sched__hint">
          Pick up to three. We&apos;ll confirm one by email.
        </span>
      </div>
      {children}
    </div>
  );
}

/** What the server renders before the browser knows the visitor's time zone and clock: the panel, empty, at its size. */
export function SchedulerPlaceholder() {
  return (
    <div className="s-sched__panel s-sched__panel--waiting">
      <p className="s-sched__wait">Loading the calendar</p>
      <noscript>
        <p className="s-sched__wait">The calendar needs JavaScript. Write the times that suit you in your message instead.</p>
      </noscript>
    </div>
  );
}

type Props = {
  zone: string;
  onZoneChange: (zone: string) => void;
  /** The visitor's clock, to the minute. */
  now: number;
  /** The picks still on offer, in time order. */
  picks: PickedTime[];
  onPicksChange: (picks: Pick[]) => void;
  twelveHour: boolean;
};

/**
 * Pick up to three demo times: a calendar of the next four weeks, the day's times beside it (under it on
 * phones), the time zone, and the picks with their IST equivalents. Keyboard: arrows, Home, End, Page Up and
 * Page Down move through days (the day's times follow); Tab moves to the times, where arrows move and Space
 * or Enter picks. Screen readers hear each day's full date and how many times are picked on it.
 */
export const Scheduler = memo(function Scheduler({ zone, onZoneChange, now, picks, onPicksChange, twelveHour }: Props) {
  const uid = useId();
  const root = useRef<HTMLDivElement>(null);
  const focusNext = useRef<string | null>(null);
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [shownMonth, setShownMonth] = useState<string | null>(null);
  const [slotFocus, setSlotFocus] = useState<string | null>(null);
  const [said, setSaid] = useState("");

  const { first, last } = bookableDays(zone, now);
  const opening = useMemo(() => firstChoiceDay(zone, now), [zone, now]);
  const day = chosenDay && chosenDay >= first && chosenDay <= last ? chosenDay : opening;
  const minMonth = monthOf(first);
  const maxMonth = monthOf(last);
  const wanted = shownMonth ?? monthOf(day);
  const month = wanted < minMonth ? minMonth : wanted > maxMonth ? maxMonth : wanted;

  const monthDays = useMemo(() => daysInMonth(month), [month]);
  const open = useMemo(() => new Set(monthDays.filter((d) => hasSlots(d, zone, now))), [monthDays, zone, now]);
  const slots = useMemo(() => slotsOn(day, zone, now), [day, zone, now]);
  const hour = Math.floor(now / 3_600_000);
  const groups = useMemo(() => zoneGroups(hour * 3_600_000, zone), [hour, zone]);
  const zoneLabel = groups.flatMap((g) => g.zones).find((z) => z.value === zone)?.label ?? zone;
  const gap = indiaGap(zone, zonedInstant(day, "12:00", zone) ?? now);

  const weeks = useMemo(() => {
    const cells: (string | null)[] = [...Array<null>((weekdayOf(monthDays[0]) + 6) % 7).fill(null), ...monthDays];
    while (cells.length % 7) cells.push(null);
    return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  }, [monthDays]);

  const pickedOn = new Map<string, number>();
  for (const p of picks) pickedOn.set(p.day, (pickedOn.get(p.day) ?? 0) + 1);
  const isPicked = (clock: string) => picks.some((p) => p.day === day && p.clock === clock);
  const full = picks.length >= MAX_PICKS;
  const tabDay = day >= first && monthOf(day) === month ? day : (monthDays.find((d) => d >= first && d <= last) ?? null);
  const tabSlot = slots.find((s) => s.clock === slotFocus)?.clock ?? slots.find((s) => isPicked(s.clock))?.clock ?? slots[0]?.clock;

  // After keyboard moves, focus follows to the new cell once it has rendered.
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    root.current?.querySelector<HTMLElement>(target)?.focus();
  });

  const selectDay = (d: string, focus = false) => {
    setChosenDay(d);
    setShownMonth(monthOf(d));
    setSlotFocus(null);
    if (focus) focusNext.current = `[data-day="${d}"]`;
  };

  const onDayKey = (e: KeyboardEvent, d: string) => {
    const col = (weekdayOf(d) + 6) % 7;
    const sameDayIn = (n: number) => {
      const target = `${addMonths(monthOf(d), n)}-${d.slice(8)}`;
      const lastOfMonth = daysInMonth(addMonths(monthOf(d), n)).at(-1)!;
      return target > lastOfMonth ? lastOfMonth : target;
    };
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(d, -1),
      ArrowRight: () => addDays(d, 1),
      ArrowUp: () => addDays(d, -7),
      ArrowDown: () => addDays(d, 7),
      Home: () => addDays(d, -col),
      End: () => addDays(d, 6 - col),
      PageUp: () => sameDayIn(-1),
      PageDown: () => sameDayIn(1),
    };
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectDay(d);
      return;
    }
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    const target = move();
    selectDay(target < first ? first : target > last ? last : target, true);
  };

  // The parent keeps only the day and clock of each pick; the instant is worked out again from its zone.
  const keep = (list: Pick[]) => onPicksChange(list.map(({ day: d, clock }) => ({ day: d, clock })));

  const toggle = (clock: string) => {
    const label = `${dayLong(day)}, ${clockLabel(clock, twelveHour)}`;
    setSlotFocus(clock);
    if (isPicked(clock)) {
      const rest = picks.filter((p) => !(p.day === day && p.clock === clock));
      keep(rest);
      setSaid(`Removed ${label}. ${rest.length} of ${MAX_PICKS} picked.`);
      return;
    }
    if (full) {
      setSaid(`You've picked ${MAX_PICKS} times. Remove one to choose another.`);
      return;
    }
    keep([...picks, { day, clock }]);
    setSaid(`Added ${label}. ${picks.length + 1} of ${MAX_PICKS} picked.`);
  };

  const onSlotKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = slots.findIndex((s) => s.clock === tabSlot);
    if (i < 0) return;
    const cols = getComputedStyle(e.currentTarget).gridTemplateColumns.split(" ").filter(Boolean).length || 1;
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols, Home: -i, End: slots.length - 1 - i };
    if (!(e.key in step)) return;
    e.preventDefault();
    const next = slots[Math.min(slots.length - 1, Math.max(0, i + step[e.key]))];
    setSlotFocus(next.clock);
    focusNext.current = `[data-slot="${next.clock}"]`;
  };

  const remove = (p: PickedTime) => {
    const rest = picks.filter((q) => q !== p);
    keep(rest);
    setSaid(`Removed ${dayLong(p.day)}, ${clockLabel(p.clock, twelveHour)}. ${rest.length} of ${MAX_PICKS} picked.`);
  };

  const canPrev = month > minMonth;
  const canNext = month < maxMonth;
  const today = first;

  return (
    <div ref={root} className="s-sched__body">
      <div className="s-sched__panel">
        <div className="s-sched__cal">
          <div className="s-sched__month">
            <p id={`${uid}-month`} className="s-sched__title" aria-live="polite">
              {monthTitle(month)}
            </p>
            <div className="s-sched__navs">
              <button type="button" className="s-sched__nav" aria-label={`Show ${monthTitle(addMonths(month, -1))}`} aria-disabled={!canPrev || undefined} onClick={() => canPrev && setShownMonth(addMonths(month, -1))}>
                <ChevronLeft className="s-icon" aria-hidden />
              </button>
              <button type="button" className="s-sched__nav" aria-label={`Show ${monthTitle(addMonths(month, 1))}`} aria-disabled={!canNext || undefined} onClick={() => canNext && setShownMonth(addMonths(month, 1))}>
                <ChevronRight className="s-icon" aria-hidden />
              </button>
            </div>
          </div>
          <table role="grid" className="s-sched__days" aria-labelledby={`${uid}-month`}>
            <thead>
              <tr>
                {WEEK.map((w) => (
                  <th key={w} scope="col" abbr={weekdayName(w)} data-weekend={w % 6 === 0 || undefined}>
                    {weekdayName(w).slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, r) => (
                <tr key={r}>
                  {week.map((d, c) => {
                    if (!d) return <td key={`blank-${c}`} />;
                    const n = Number(d.slice(8));
                    if (d < first || d > last) {
                      return (
                        <td key={d} role="gridcell" aria-disabled="true" className="s-sched__day" data-state="out">
                          {n}
                        </td>
                      );
                    }
                    const count = pickedOn.get(d) ?? 0;
                    const label = [dayLong(d), d === today ? "today" : "", count ? `${count} picked` : "", open.has(d) ? "" : "no times left"].filter(Boolean).join(", ");
                    return (
                      <td
                        key={d}
                        role="gridcell"
                        className="s-sched__day"
                        data-day={d}
                        data-state={open.has(d) ? (isWeekend(d) ? "weekend" : "open") : "none"}
                        data-picked={count > 0 || undefined}
                        aria-selected={d === day}
                        aria-label={label}
                        tabIndex={d === tabDay ? 0 : -1}
                        onClick={() => selectDay(d)}
                        onKeyDown={(e) => onDayKey(e, d)}
                      >
                        {n}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="s-sched__tz">
            <Globe className="s-icon" aria-hidden />
            <label htmlFor={`${uid}-tz`}>Time zone</label>
            {/* The native select keeps the phone's own picker and full keyboard support; it lies, transparent, over its label. */}
            <span className="s-sched__tzpick">
              <span aria-hidden>{zoneLabel}</span>
              <select id={`${uid}-tz`} value={zone} onChange={(e) => onZoneChange(e.target.value)}>
                {groups.map((g) => (
                  <optgroup key={g.region} label={g.region}>
                    {g.zones.map((z) => (
                      <option key={z.value} value={z.value}>
                        {z.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </span>
          </div>
        </div>

        <div className="s-sched__slots">
          <p id={`${uid}-day`} className="s-sched__dayname">
            {dayLong(day)}
          </p>
          <p className="s-sched__gap">{gap}</p>
          {slots.length ? (
            <div role="group" aria-labelledby={`${uid}-day`} className="s-sched__times" onKeyDown={onSlotKey}>
              {slots.map((s) => {
                const on = isPicked(s.clock);
                return (
                  <button key={s.clock} type="button" className="s-sched__slot" data-slot={s.clock} aria-pressed={on} aria-disabled={(full && !on) || undefined} tabIndex={s.clock === tabSlot ? 0 : -1} onClick={() => toggle(s.clock)}>
                    <SlotTime clock={s.clock} twelveHour={twelveHour} />
                  </button>
                );
              })}
            </div>
          ) : null}
          {slots.length && full ? <p className="s-sched__full">That&apos;s three. Remove one below to pick another.</p> : null}
          {slots.length ? null : (
            <p className="s-sched__none">{day === today ? "No times left today." : "No times left on this day."} Pick another day.</p>
          )}
        </div>
      </div>

      {picks.length ? (
        <ul className="s-sched__picked" aria-label="Your times">
          {picks.map((p) => {
            const ist = inIndia(p.at, zone, twelveHour);
            return (
              <li key={`${p.day} ${p.clock}`}>
                <span className="s-sched__when">
                  {dayShort(p.day)}, {clockLabel(p.clock, twelveHour)}
                </span>
                {ist ? <span className="s-sched__ist">{ist}</span> : null}
                <button type="button" className="s-sched__remove" aria-label={`Remove ${dayLong(p.day)}, ${clockLabel(p.clock, twelveHour)}`} onClick={() => remove(p)}>
                  <X className="s-icon" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="s-sched__empty">No times picked. That&apos;s fine: we&apos;ll suggest some.</p>
      )}
      <p className="s-sr-only" aria-live="polite">
        {said}
      </p>
    </div>
  );
});
