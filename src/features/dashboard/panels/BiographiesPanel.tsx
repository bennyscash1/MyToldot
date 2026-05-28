'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import type { RecentBio } from '../types';

interface BiographiesPanelProps {
  bios: RecentBio[];
  treeShortCode: string;
  maxRows: number;
}

export function BiographiesPanel({
  bios,
  treeShortCode,
  maxRows,
}: BiographiesPanelProps) {
  const t = useTranslations('dashboard.panels');
  const rows = bios.slice(0, maxRows);

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-slate-200/70 bg-white p-3 shadow-sm">
      <h2 className="mb-2 shrink-0 text-sm font-semibold text-slate-800">
        {t('recentBios')}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-2 py-3 text-center text-xs text-slate-500">
          {t('noBios')}
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
          {rows.map((bio) => (
            <li key={bio.personId}>
              <Link
                href={`/tree/${treeShortCode}?focus=${bio.personId}`}
                className="flex items-center gap-2 rounded-md p-1.5 transition hover:bg-emerald-50"
                aria-label={t('viewPerson')}
              >
                {bio.profileImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={bio.profileImageUrl}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-full border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-400">
                    {(bio.personName[0] ?? '?').toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-800">
                    {bio.personName}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {relativeTime(bio.updatedAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(months / 12)}y`;
}
