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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

export function getUpcomingBirthdays(
  persons: PersonForEvents[],
  now: Date,
  days = 7,
): UpcomingEvent[] {
  const today = startOfDay(now);
  const out: UpcomingEvent[] = [];

  for (const p of persons) {
    if (p.isDeceased || !p.birthDate) continue;
    const birth = new Date(p.birthDate);
    if (Number.isNaN(birth.getTime())) continue;

    let nextYear = today.getFullYear();
    let candidate = new Date(nextYear, birth.getMonth(), birth.getDate());
    if (candidate < today) {
      nextYear += 1;
      candidate = new Date(nextYear, birth.getMonth(), birth.getDate());
    }
    const delta = daysBetween(today, candidate);
    if (delta < 0 || delta > days) continue;

    out.push({
      type: 'birthday',
      personId: p.id,
      personName: p.displayName,
      date: candidate.toISOString(),
      dateHebrew: gregorianToHebrew(candidate) ?? '',
      daysUntil: delta,
      ageOrYears: nextYear - birth.getFullYear(),
    });
  }

  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function getUpcomingYahrzeits(
  persons: PersonForEvents[],
  now: Date,
  days = 7,
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

    for (const yearOffset of [0, 1]) {
      const targetYear = todayHDate.getFullYear() + yearOffset;
      let candidateHDate: HDate;
      try {
        candidateHDate = new HDate(hDay, hMonth, targetYear);
      } catch {
        continue;
      }
      const candidateGreg = startOfDay(candidateHDate.greg());
      const delta = daysBetween(today, candidateGreg);
      if (delta < 0 || delta > days) continue;
      const years = targetYear - deathHYear;
      if (years <= 0) continue;

      out.push({
        type: 'yahrzeit',
        personId: p.id,
        personName: p.displayName,
        date: candidateGreg.toISOString(),
        dateHebrew: gregorianToHebrew(candidateGreg) ?? '',
        daysUntil: delta,
        ageOrYears: years,
      });
      break;
    }
  }

  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

export function todayHebrew(now: Date): string {
  return gregorianToHebrew(now) ?? '';
}
