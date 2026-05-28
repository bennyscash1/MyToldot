'use client';

import { useTranslations } from 'next-intl';

import type { DashboardPerson } from '../types';

interface BiographyCardProps {
  person: DashboardPerson;
  lineClamp: number;
  tv?: boolean;
}

const BIO_PREVIEW_CHARS = 400;

export function BiographyCard({ person, lineClamp, tv = false }: BiographyCardProps) {
  const t = useTranslations('dashboard');
  const bio = person.bio?.trim() ?? '';
  const truncatedByChars =
    bio.length > BIO_PREVIEW_CHARS
      ? bio.slice(0, BIO_PREVIEW_CHARS).trimEnd() + '…'
      : bio;
  const showReadMore = bio.length > BIO_PREVIEW_CHARS;

  return (
    <div
      className={
        'min-h-0 flex-1 border-emerald-500 border-e-2 pe-3 ' +
        (tv ? 'mt-2' : 'mt-3')
      }
    >
      {truncatedByChars ? (
        <p
          className="whitespace-pre-line text-slate-700 leading-relaxed"
          style={{
            fontSize: `calc(${tv ? '0.95rem' : '0.875rem'} * var(--dash-scale, 1))`,
            display: '-webkit-box',
            WebkitLineClamp: lineClamp,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {truncatedByChars}
        </p>
      ) : (
        <p className="text-sm italic text-slate-400">{t('noBio')}</p>
      )}
      {showReadMore && (
        <p className="mt-1 text-xs font-medium text-emerald-700">{t('readMore')}</p>
      )}
    </div>
  );
}
