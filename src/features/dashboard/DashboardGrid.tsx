'use client';

import { useTranslations } from 'next-intl';

import type { AutoFitMetrics } from './hooks/useAutoFit';
import type { UsePersonRotationResult } from './hooks/usePersonRotation';
import { BiographiesPanel } from './panels/BiographiesPanel';
import { EventsPanel } from './panels/EventsPanel';
import { GalleryPanel } from './panels/GalleryPanel';
import { PersonNowCard } from './panels/PersonNowCard';
import { StatsPanel } from './panels/StatsPanel';
import type { DashboardData } from './types';

interface DashboardGridProps {
  data: DashboardData;
  rotation: UsePersonRotationResult;
  metrics: AutoFitMetrics;
  tv?: boolean;
  showPersonNav?: boolean;
}

export function DashboardGrid({
  data,
  rotation,
  metrics,
  tv = false,
  showPersonNav = true,
}: DashboardGridProps) {
  const gridCols = tv ? 'grid-cols-[1.2fr_2fr_1fr]' : 'grid-cols-[1fr_2fr_1fr]';

  return (
    <div
      className={`grid min-h-0 flex-1 ${gridCols}`}
      style={{ gap: 'var(--dash-gap, 16px)' }}
    >
      <aside className="flex min-h-0 flex-col gap-[var(--dash-gap,16px)] overflow-hidden">
        <EventsPanel
          events={data.upcomingEvents}
          type="birthday"
          maxRows={metrics.maxEvents}
          todayHebrew={data.todayHebrewDate}
          todayGregorianIso={data.todayGregorianDate}
        />
        <EventsPanel
          events={data.upcomingEvents}
          type="yahrzeit"
          maxRows={metrics.maxEvents}
        />
        <BiographiesPanel
          bios={data.recentBios}
          treeShortCode={data.tree.shortCode}
          maxRows={metrics.maxBios}
        />
      </aside>

      <main className="min-h-0 overflow-hidden">
        {rotation.currentPerson ? (
          <PersonNowCard
            person={rotation.currentPerson}
            secondsRemaining={rotation.secondsRemaining}
            paused={rotation.paused}
            bioLineClamp={metrics.bioLineClamp}
            tv={tv}
            showNav={showPersonNav}
            onNext={rotation.next}
            onPrev={rotation.prev}
            onSelectPerson={rotation.setFocalPersonId}
          />
        ) : (
          <EmptyState />
        )}
      </main>

      <aside className="flex min-h-0 flex-col gap-[var(--dash-gap,16px)] overflow-hidden">
        <GalleryPanel
          photos={data.recentPhotos}
          totalPhotoCount={data.totalPhotoCount}
          treeId={data.tree.id}
          slots={metrics.gallerySlots}
        />
        <StatsPanel stats={data.treeStats} tv={tv} />
      </aside>
    </div>
  );
}

function EmptyState() {
  const t = useTranslations('dashboard');
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-slate-200/70 bg-white p-8 text-center shadow-md">
      <div>
        <p className="font-medium text-slate-700">{t('emptyTree')}</p>
        <p className="mt-2 text-sm text-slate-500">{t('emptyTreeHelp')}</p>
      </div>
    </div>
  );
}
