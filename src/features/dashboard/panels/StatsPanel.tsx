'use client';

import { useTranslations } from 'next-intl';

import type { DashboardTreeStats } from '../types';

interface StatsPanelProps {
  stats: DashboardTreeStats;
  tv?: boolean;
}

export function StatsPanel({ stats, tv = false }: StatsPanelProps) {
  const t = useTranslations('dashboard.stats');
  const textSize = tv
    ? 'text-[calc(1.75rem*var(--dash-scale,1))]'
    : 'text-[calc(1.25rem*var(--dash-scale,1))]';
  const labelSize = tv ? 'text-sm' : 'text-xs';

  const items = [
    { label: t('totalMembers'), value: stats.memberCount },
    { label: t('generations'), value: stats.generationCount },
    { label: t('marriages'), value: stats.marriageCount },
    { label: t('photos'), value: stats.photoCount },
  ];

  return (
    <section className="flex min-h-0 flex-col rounded-lg border border-slate-200/70 bg-white p-3 shadow-sm">
      <h2 className="mb-2 shrink-0 text-sm font-semibold text-slate-800">
        {t('title')}
      </h2>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center justify-center rounded-md bg-emerald-50/80 px-2 py-3 text-center"
          >
            <p className={`font-semibold tabular-nums text-emerald-800 ${textSize}`}>
              {item.value.toLocaleString()}
            </p>
            <p className={`mt-1 text-slate-600 ${labelSize}`}>{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
