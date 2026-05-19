'use client';

import { useLocale, useTranslations } from 'next-intl';

import type { DashboardPerson } from '../types';
import { usePhotoCarousel } from '../hooks/usePhotoCarousel';
import { MiniTreeStrip } from './MiniTreeStrip';

interface FeaturedPersonCardProps {
  person: DashboardPerson;
  secondsRemaining: number;
  paused: boolean;
  onNext: () => void;
  onPrev: () => void;
}

const BIO_PREVIEW_CHARS = 300;

export function FeaturedPersonCard({
  person,
  secondsRemaining,
  paused,
  onNext,
  onPrev,
}: FeaturedPersonCardProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const isRtl = locale === 'he';
  const carousel = usePhotoCarousel(person.id, person.profileImageUrl, person.galleryUrls, paused);

  const parentsLine =
    person.parentNames.length > 0
      ? t('childOf', { parents: person.parentNames.join(' · ') })
      : null;

  const bioPreview =
    person.bio && person.bio.length > BIO_PREVIEW_CHARS
      ? person.bio.slice(0, BIO_PREVIEW_CHARS).trimEnd() + '…'
      : person.bio;

  return (
    <div className="relative">
      <ArrowButton
        side="prev"
        isRtl={isRtl}
        onClick={onPrev}
        label={t('previous')}
      />
      <ArrowButton
        side="next"
        isRtl={isRtl}
        onClick={onNext}
        label={t('next')}
      />

      <article className="rounded-xl border border-slate-200/70 bg-white p-6 shadow-md">
        <div className="mb-4 flex items-center gap-2">
          <span
            className={
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ' +
              (paused
                ? 'bg-slate-100 text-slate-600'
                : 'bg-emerald-50 text-emerald-700')
            }
            aria-live="polite"
          >
            <span
              className={
                'size-1.5 rounded-full ' +
                (paused ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse')
              }
            />
            {paused ? t('paused') : t('nextIn', { seconds: secondsRemaining })}
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-[280px_1fr]">
          <div className="flex flex-col items-center">
            <div className="relative w-full max-w-[280px]">
              {carousel.current ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={carousel.current.url}
                  alt={person.displayName}
                  className="aspect-[4/5] w-full rounded-xl border border-slate-200 object-cover shadow-sm"
                />
              ) : (
                <PlaceholderAvatar />
              )}
            </div>
            {carousel.total > 1 && (
              <div className="mt-3 flex justify-center gap-1.5">
                {carousel.slides.map((slide, i) => (
                  <span
                    key={slide.url + i}
                    className={
                      'size-1.5 rounded-full transition-colors ' +
                      (i === carousel.index ? 'bg-emerald-600' : 'bg-slate-300')
                    }
                    aria-hidden
                  />
                ))}
              </div>
            )}
            {carousel.current?.caption ? (
              <p className="mt-2 max-w-[280px] text-center text-xs text-slate-500">
                {carousel.current.caption}
              </p>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-col">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              {t('featuredEyebrow')}
            </p>
            <h1 className="mt-1 text-3xl font-semibold text-slate-900">
              {person.displayName}
            </h1>
            {parentsLine && (
              <p className="mt-1 text-sm text-slate-600">{parentsLine}</p>
            )}

            <DatesRow person={person} />

            <div className="mt-4 border-s-2 border-emerald-500 ps-3">
              {bioPreview ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
                  {bioPreview}
                </p>
              ) : (
                <p className="text-sm italic text-slate-400">{t('noBio')}</p>
              )}
            </div>
          </div>
        </div>

        <MiniTreeStrip person={person} />
      </article>
    </div>
  );
}

function DatesRow({ person }: { person: DashboardPerson }) {
  const t = useTranslations('dashboard');
  const showDeath = person.isDeceased && person.deathDate;

  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
      <DateCell
        label={t('born')}
        gregorian={formatGregorian(person.birthDate)}
        hebrew={person.birthDateHebrew}
        extra={person.birthPlace ?? null}
      />
      {showDeath && (
        <DateCell
          label={t('died')}
          gregorian={formatGregorian(person.deathDate)}
          hebrew={person.deathDateHebrew}
          extra={
            person.ageAtDeath != null ? t('deathAge', { age: person.ageAtDeath }) : null
          }
        />
      )}
      <div className="rounded-lg border border-slate-200/70 bg-slate-50/50 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
          {t('relations')}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          {t('relationCounts', {
            spouses: person.counts.spouses,
            children: person.counts.children,
            grandchildren: person.counts.grandchildren,
          })}
        </p>
      </div>
    </div>
  );
}

function DateCell({
  label,
  gregorian,
  hebrew,
  extra,
}: {
  label: string;
  gregorian: string | null;
  hebrew: string | null;
  extra: string | null;
}) {
  return (
    <div className="rounded-lg border border-slate-200/70 bg-slate-50/50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {gregorian && (
        <p className="mt-1 text-sm font-medium text-slate-800">{gregorian}</p>
      )}
      {hebrew && <p className="text-xs text-slate-600">{hebrew}</p>}
      {extra && <p className="mt-1 text-xs text-slate-500">{extra}</p>}
    </div>
  );
}

function formatGregorian(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getFullYear()}`;
}

function PlaceholderAvatar() {
  return (
    <div className="flex aspect-[4/5] w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-16 w-16 text-slate-300"
        aria-hidden
      >
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.7-8 6v1h16v-1c0-3.3-3.6-6-8-6Z" />
      </svg>
    </div>
  );
}

function ArrowButton({
  side,
  isRtl,
  onClick,
  label,
}: {
  side: 'prev' | 'next';
  isRtl: boolean;
  onClick: () => void;
  label: string;
}) {
  const isLeftEdge =
    (side === 'prev' && !isRtl) || (side === 'next' && isRtl);
  const positionClass = isLeftEdge
    ? '-left-4 lg:-left-12'
    : '-right-4 lg:-right-12';
  const chevron = isLeftEdge ? (
    <ChevronLeftIcon />
  ) : (
    <ChevronRightIcon />
  );
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        'absolute top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-md transition hover:bg-emerald-50 hover:text-emerald-700 md:inline-flex ' +
        positionClass
      }
    >
      {chevron}
    </button>
  );
}

function ChevronLeftIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M12.79 5.23a.75.75 0 0 1 0 1.06L9.06 10l3.73 3.71a.75.75 0 1 1-1.06 1.06l-4.25-4.24a.75.75 0 0 1 0-1.06l4.25-4.24a.75.75 0 0 1 1.06 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.21 5.23a.75.75 0 0 1 1.06 0l4.25 4.24a.75.75 0 0 1 0 1.06l-4.25 4.24a.75.75 0 1 1-1.06-1.06L10.94 10 7.21 6.29a.75.75 0 0 1 0-1.06Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
