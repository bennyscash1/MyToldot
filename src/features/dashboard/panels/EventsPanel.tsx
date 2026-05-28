'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import { sortDashboardEvents } from '../lib/hebcal-events';
import type { UpcomingEvent, UpcomingEventType } from '../types';

interface EventsPanelProps {
  events: UpcomingEvent[];
  type: UpcomingEventType;
  maxRows: number;
  todayHebrew?: string;
  todayGregorianIso?: string;
}

export function EventsPanel({
  events,
  type,
  maxRows,
  todayHebrew,
  todayGregorianIso,
}: EventsPanelProps) {
  const t = useTranslations('dashboard.panels');
  const sorted = useMemo(() => sortDashboardEvents(events), [events]);
  const filtered = sorted.filter((e) => e.type === type).slice(0, maxRows);
  const title = type === 'birthday' ? t('birthdaysTitle') : t('yahrzeitsTitle');
  const empty = type === 'birthday' ? t('noBirthdays') : t('noYahrzeits');

  const todayLabel = todayGregorianIso
    ? formatGregorianLabel(todayGregorianIso)
    : null;

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-slate-200/70 bg-white p-3 shadow-sm">
      <header className="mb-2 shrink-0">
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {todayHebrew && todayLabel && (
          <p className="mt-0.5 text-[11px] text-slate-500">
            {todayHebrew} · {todayLabel}
          </p>
        )}
      </header>
      {filtered.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-2 py-3 text-center text-xs text-slate-500">
          {empty}
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
          {filtered.map((e) => (
            <EventRow key={`${type}-${e.personId}-${e.date}`} event={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function EventRow({ event }: { event: UpcomingEvent }) {
  const t = useTranslations('dashboard.panels');
  const isPast = event.daysUntil < 0;
  const dayLabel = relativeDayLabel(event.daysUntil, t);
  const ageLabel =
    event.type === 'birthday'
      ? t('turning', { age: event.ageOrYears })
      : t('yearsSince', { n: event.ageOrYears });

  return (
    <li
      className={
        'flex items-start justify-between gap-2 text-xs transition-opacity ' +
        (isPast ? 'opacity-55' : 'opacity-100')
      }
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-800">{event.personName}</p>
        <p className="text-[10px] text-slate-500">{event.dateHebrew}</p>
      </div>
      <div className="shrink-0 text-end">
        <p className="text-[10px] font-medium text-slate-700">{dayLabel}</p>
        <p className="text-[10px] text-slate-500">{ageLabel}</p>
      </div>
    </li>
  );
}

type PanelT = ReturnType<typeof useTranslations<'dashboard.panels'>>;

function relativeDayLabel(daysUntil: number, t: PanelT): string {
  if (daysUntil === 0) return t('today');
  if (daysUntil === 1) return t('tomorrow');
  if (daysUntil === -1) return t('yesterday');
  if (daysUntil > 1) return t('inDays', { n: daysUntil });
  return t('daysAgo', { n: Math.abs(daysUntil) });
}

function formatGregorianLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}
