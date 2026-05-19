'use client';

import { useTranslations } from 'next-intl';

import type { UpcomingEvent } from '../types';

interface UpcomingEventsPanelProps {
  events: UpcomingEvent[];
  todayHebrew: string;
  todayGregorianIso: string;
}

export function UpcomingEventsPanel({
  events,
  todayHebrew,
  todayGregorianIso,
}: UpcomingEventsPanelProps) {
  const t = useTranslations('dashboard.panels');
  const birthdays = events.filter((e) => e.type === 'birthday');
  const yahrzeits = events.filter((e) => e.type === 'yahrzeit');
  const todayDate = new Date(todayGregorianIso);
  const todayLabel = `${String(todayDate.getDate()).padStart(2, '0')}.${String(todayDate.getMonth() + 1).padStart(2, '0')}.${todayDate.getFullYear()}`;

  return (
    <section className="rounded-lg border border-slate-200/70 bg-white p-4 shadow-sm">
      <header className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-800">{t('weekTitle')}</h2>
      </header>
      <p className="mb-3 text-xs text-slate-500">
        {todayHebrew} · {todayLabel}
      </p>

      {events.length === 0 && (
        <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
          {t('weekEmpty')}
        </p>
      )}

      {birthdays.length > 0 && (
        <div className="mb-3 rounded-md bg-amber-50 p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800">
            <CakeIcon className="h-4 w-4" />
            {t('birthdaysSection')}
          </h3>
          <ul className="flex flex-col gap-2">
            {birthdays.map((e) => (
              <EventRow key={`bd-${e.personId}`} event={e} />
            ))}
          </ul>
        </div>
      )}

      {yahrzeits.length > 0 && (
        <div className="rounded-md bg-slate-100 p-3">
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <CandleIcon className="h-4 w-4" />
            {t('yahrzeitsSection')}
          </h3>
          <ul className="flex flex-col gap-2">
            {yahrzeits.map((e) => (
              <EventRow key={`yz-${e.personId}`} event={e} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function EventRow({ event }: { event: UpcomingEvent }) {
  const t = useTranslations('dashboard.panels');
  const dayLabel =
    event.daysUntil === 0
      ? t('today')
      : event.daysUntil === 1
        ? t('tomorrow')
        : t('inDays', { n: event.daysUntil });
  const ageLabel =
    event.type === 'birthday'
      ? t('turning', { age: event.ageOrYears })
      : t('yearsSince', { n: event.ageOrYears });
  return (
    <li className="flex items-start justify-between gap-2 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-800">{event.personName}</p>
        <p className="text-xs text-slate-500">{event.dateHebrew}</p>
      </div>
      <div className="shrink-0 text-end">
        <p className="text-xs font-medium text-slate-700">{dayLabel}</p>
        <p className="text-[11px] text-slate-500">{ageLabel}</p>
      </div>
    </li>
  );
}

function CakeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1ZM6 8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2H6V8Zm-2 4h16v3a3 3 0 0 1-3 3h-2.5l-1.6 1.6a1.5 1.5 0 0 1-2.1 0L9.4 18H7a3 3 0 0 1-3-3v-3Z" />
    </svg>
  );
}

function CandleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2c.7 1.4 2 2.4 2 4 0 1.1-.9 2-2 2s-2-.9-2-2c0-1.6 1.3-2.6 2-4Zm-4 9a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-9Z" />
    </svg>
  );
}
