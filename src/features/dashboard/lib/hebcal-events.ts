import { HDate } from '@hebcal/core';

import { gregorianToHebrew } from '@/features/persons/lib/hebrewDate';
import type { UpcomingEvent } from '../types';

interface PersonForEvents {
  id: string;
  displayName: string;
  birthDate: Date | null;
  deathDate: Date | null;
  isDeceased: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const EVENT_WINDOW_PAST_DAYS = 30;
export const EVENT_WINDOW_FUTURE_DAYS = 30;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

function inWindow(delta: number, pastDays: number, futureDays: number): boolean {
  return delta >= -pastDays && delta <= futureDays;
}

/** Today first, then upcoming (soonest), then past (most recent first). */
export function sortDashboardEvents(events: UpcomingEvent[]): UpcomingEvent[] {
  return [...events].sort((a, b) => {
    if (a.daysUntil === 0 && b.daysUntil !== 0) return -1;
    if (b.daysUntil === 0 && a.daysUntil !== 0) return 1;
    if (a.daysUntil > 0 && b.daysUntil > 0) return a.daysUntil - b.daysUntil;
    if (a.daysUntil < 0 && b.daysUntil < 0) return b.daysUntil - a.daysUntil;
    if (a.daysUntil > 0 && b.daysUntil <= 0) return -1;
    if (a.daysUntil <= 0 && b.daysUntil > 0) return 1;
    return 0;
  });
}

export function getUpcomingBirthdays(
  persons: PersonForEvents[],
  now: Date,
  futureDays = EVENT_WINDOW_FUTURE_DAYS,
  pastDays = EVENT_WINDOW_PAST_DAYS,
): UpcomingEvent[] {
  const today = startOfDay(now);
  const out: UpcomingEvent[] = [];

  for (const p of persons) {
    if (p.isDeceased || !p.birthDate) continue;
    const birth = new Date(p.birthDate);
    if (Number.isNaN(birth.getTime())) continue;

    let best: UpcomingEvent | null = null;

    for (const year of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
      const candidate = new Date(year, birth.getMonth(), birth.getDate());
      const delta = daysBetween(today, candidate);
      if (!inWindow(delta, pastDays, futureDays)) continue;

      const event: UpcomingEvent = {
        type: 'birthday',
        personId: p.id,
        personName: p.displayName,
        date: candidate.toISOString(),
        dateHebrew: gregorianToHebrew(candidate) ?? '',
        daysUntil: delta,
        ageOrYears: year - birth.getFullYear(),
      };

      if (
        !best ||
        Math.abs(delta) < Math.abs(best.daysUntil) ||
        (Math.abs(delta) === Math.abs(best.daysUntil) && delta > best.daysUntil)
      ) {
        best = event;
      }
    }

    if (best) out.push(best);
  }

  return out;
}

export function getUpcomingYahrzeits(
  persons: PersonForEvents[],
  now: Date,
  futureDays = EVENT_WINDOW_FUTURE_DAYS,
  pastDays = EVENT_WINDOW_PAST_DAYS,
): UpcomingEvent[] {
  const today = startOfDay(now);
  const todayHDate = new HDate(today);
  const out: UpcomingEvent[] = [];

  for (const p of persons) {
    if (!p.isDeceased || !p.deathDate) continue;
    const death = new Date(p.deathDate);
    if (Number.isNaN(death.getTime())) continue;

    let deathHDate: HDate;
    try {
      deathHDate = new HDate(death);
    } catch {
      continue;
    }
    const hMonth = deathHDate.getMonth();
    const hDay = deathHDate.getDate();
    const deathHYear = deathHDate.getFullYear();

    let best: UpcomingEvent | null = null;
    const baseHYear = todayHDate.getFullYear();

    for (const hYear of [baseHYear - 1, baseHYear, baseHYear + 1]) {
      let candidateHDate: HDate;
      try {
        candidateHDate = new HDate(hDay, hMonth, hYear);
      } catch {
        continue;
      }
      const candidateGreg = startOfDay(candidateHDate.greg());
      const delta = daysBetween(today, candidateGreg);
      if (!inWindow(delta, pastDays, futureDays)) continue;

      const years = hYear - deathHYear;
      if (years <= 0) continue;

      const event: UpcomingEvent = {
        type: 'yahrzeit',
        personId: p.id,
        personName: p.displayName,
        date: candidateGreg.toISOString(),
        dateHebrew: gregorianToHebrew(candidateGreg) ?? '',
        daysUntil: delta,
        ageOrYears: years,
      };

      if (
        !best ||
        Math.abs(delta) < Math.abs(best.daysUntil) ||
        (Math.abs(delta) === Math.abs(best.daysUntil) && delta > best.daysUntil)
      ) {
        best = event;
      }
    }

    if (best) out.push(best);
  }

  return out;
}

export function todayHebrew(now: Date): string {
  return gregorianToHebrew(now) ?? '';
}
