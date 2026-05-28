'use client';

import { useLocale, useTranslations } from 'next-intl';

import { MiniFamilyTree } from '../MiniFamilyTree';
import { usePhotoCarousel } from '../hooks/usePhotoCarousel';
import type { DashboardPerson } from '../types';
import { BiographyCard } from './BiographyCard';

interface PersonNowCardProps {
  person: DashboardPerson;
  secondsRemaining: number;
  paused: boolean;
  bioLineClamp: number;
  tv?: boolean;
  showNav?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  onSelectPerson: (id: string) => void;
}

export function PersonNowCard({
  person,
  secondsRemaining,
  paused,
  bioLineClamp,
  tv = false,
  showNav = true,
  onNext,
  onPrev,
  onSelectPerson,
}: PersonNowCardProps) {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const isRtl = locale === 'he';
  const carousel = usePhotoCarousel(
    person.id,
    person.profileImageUrl,
    person.galleryUrls,
    paused,
  );

  const parentsLine =
    person.parentNames.length > 0
      ? t('childOf', { parents: person.parentNames.join(' · ') })
      : null;

  const nameClass = tv
    ? 'text-[clamp(2rem,3.5vw,calc(2.75rem*var(--dash-scale,1)))]'
    : 'text-[clamp(1.375rem,2.5vw,calc(1.75rem*var(--dash-scale,1)))]';

  return (
    <article className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/70 bg-white p-4 shadow-md">
      {showNav && onNext && onPrev && (
        <>
          <NavArrow side="prev" isRtl={isRtl} onClick={onPrev} label={t('previous')} />
          <NavArrow side="next" isRtl={isRtl} onClick={onNext} label={t('next')} />
        </>
      )}

      <div className="mb-2 shrink-0">
        <span
          className={
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ' +
            (paused ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700')
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

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden md:grid-cols-[minmax(0,38%)_1fr]">
        <div className="flex shrink-0 flex-col items-center">
          <div className="relative w-full max-w-[220px] shrink-0">
            {carousel.current ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={carousel.current.url}
                alt={person.displayName}
                className="aspect-[4/5] w-full rounded-lg border border-slate-200 object-cover"
              />
            ) : (
              <PlaceholderAvatar />
            )}
          </div>
          {carousel.total > 1 && (
            <div className="mt-2 flex justify-center gap-1">
              {carousel.slides.map((slide, i) => (
                <span
                  key={slide.url + i}
                  className={
                    'size-1.5 rounded-full ' +
                    (i === carousel.index ? 'bg-emerald-600' : 'bg-slate-300')
                  }
                  aria-hidden
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <p className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
            {t('featuredEyebrow')}
          </p>
          <h1
            className={`mt-0.5 shrink-0 font-semibold text-slate-900 ${nameClass}`}
          >
            {person.displayName}
          </h1>
          {parentsLine && (
            <p className="mt-0.5 shrink-0 text-xs text-slate-600">{parentsLine}</p>
          )}
          <div className="shrink-0">
            <DatesRow person={person} compact={!tv} />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <BiographyCard person={person} lineClamp={bioLineClamp} tv={tv} />
          </div>
        </div>
      </div>

      <div className="mt-3 shrink-0 border-t border-slate-100 pt-3">
        <MiniFamilyTree person={person} onSelectPerson={onSelectPerson} />
      </div>
    </article>
  );
}

function DatesRow({
  person,
  compact,
}: {
  person: DashboardPerson;
  compact: boolean;
}) {
  const t = useTranslations('dashboard');
  const showDeath = person.isDeceased && person.deathDate;

  return (
    <div
      className={
        'mt-2 grid gap-2 ' + (compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3')
      }
    >
      <DateCell
        label={t('born')}
        gregorian={formatGregorian(person.birthDate)}
        hebrew={person.birthDateHebrew}
      />
      {showDeath && (
        <DateCell
          label={t('died')}
          gregorian={formatGregorian(person.deathDate)}
          hebrew={person.deathDateHebrew}
        />
      )}
      <div className="rounded-md border border-slate-200/70 bg-slate-50/50 p-2">
        <p className="text-[10px] font-medium uppercase text-slate-500">
          {t('relations')}
        </p>
        <p className="mt-0.5 text-[11px] text-slate-700">
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
}: {
  label: string;
  gregorian: string | null;
  hebrew: string | null;
}) {
  return (
    <div className="rounded-md border border-slate-200/70 bg-slate-50/50 p-2">
      <p className="text-[10px] font-medium uppercase text-slate-500">{label}</p>
      {gregorian && (
        <p className="mt-0.5 text-[11px] font-medium text-slate-800">{gregorian}</p>
      )}
      {hebrew && <p className="text-[10px] text-slate-600">{hebrew}</p>}
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
    <div className="flex aspect-[4/5] w-full items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-12 w-12 text-slate-300"
        aria-hidden
      >
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.7-8 6v1h16v-1c0-3.3-3.6-6-8-6Z" />
      </svg>
    </div>
  );
}

function NavArrow({
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
  const isLeft = (side === 'prev' && !isRtl) || (side === 'next' && isRtl);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        'absolute top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-slate-200 bg-white p-1.5 text-slate-600 shadow md:inline-flex ' +
        (isLeft ? '-left-3' : '-right-3')
      }
    >
      <span className="sr-only">{label}</span>
      <span aria-hidden>{isLeft ? '‹' : '›'}</span>
    </button>
  );
}
