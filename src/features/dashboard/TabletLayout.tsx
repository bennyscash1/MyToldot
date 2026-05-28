'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';
import { DashboardGrid } from './DashboardGrid';
import type { AutoFitMetrics } from './hooks/useAutoFit';
import type { UsePersonRotationResult } from './hooks/usePersonRotation';
import type { DashboardData } from './types';

interface TabletLayoutProps {
  data: DashboardData;
  rotation: UsePersonRotationResult;
  metrics: AutoFitMetrics;
}

export function TabletLayout({ data, rotation, metrics }: TabletLayoutProps) {
  const t = useTranslations('dashboard');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        data-dashboard-header
        className="mb-2 flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/60 pb-2"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={`/tree/${data.tree.shortCode}`}
            className="shrink-0 text-sm font-medium text-emerald-700 hover:underline"
          >
            {t('backToTree')}
          </Link>
          <h1 className="truncate text-base font-semibold text-slate-800">
            {data.tree.name}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={rotation.togglePause}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            {rotation.paused ? t('resume') : t('pause')}
          </button>
          <button
            type="button"
            onClick={rotation.next}
            disabled={rotation.isNextDebounced}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('nextPerson')}
          </button>
        </div>
      </header>

      <DashboardGrid
        data={data}
        rotation={rotation}
        metrics={metrics}
        showPersonNav
      />
    </div>
  );
}
