'use client';

import { useLocale, useTranslations } from 'next-intl';

import type { DashboardData } from '../types';
import { useRotation } from '../hooks/useRotation';
import { DashboardHeader } from './DashboardHeader';
import { FeaturedPersonCard } from './FeaturedPersonCard';
import { UpcomingEventsPanel } from './UpcomingEventsPanel';
import { RecentBiosPanel } from './RecentBiosPanel';
import { RecentGalleryPanel } from './RecentGalleryPanel';

interface DashboardClientProps {
  data: DashboardData;
}

export function DashboardClient({ data }: DashboardClientProps) {
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const t = useTranslations('dashboard');
  const rotation = useRotation(data.persons, data.tree.id);

  return (
    <div dir={dir} className="min-h-[calc(100vh-4rem)] bg-[#f4f3e9] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <DashboardHeader
          treeShortCode={data.tree.shortCode}
          paused={rotation.paused}
          onTogglePause={rotation.togglePause}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            {rotation.currentPerson ? (
              <FeaturedPersonCard
                person={rotation.currentPerson}
                secondsRemaining={rotation.secondsRemaining}
                paused={rotation.paused}
                onNext={rotation.next}
                onPrev={rotation.prev}
              />
            ) : (
              <div className="rounded-xl border border-slate-200/70 bg-white p-10 text-center shadow-md">
                <p className="text-base font-medium text-slate-700">{t('emptyTree')}</p>
                <p className="mt-2 text-sm text-slate-500">{t('emptyTreeHelp')}</p>
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-4">
            <UpcomingEventsPanel
              events={data.upcomingEvents}
              todayHebrew={data.todayHebrewDate}
              todayGregorianIso={data.todayGregorianDate}
            />
            <RecentBiosPanel bios={data.recentBios} treeShortCode={data.tree.shortCode} />
            <RecentGalleryPanel
              photos={data.recentPhotos}
              totalPhotoCount={data.totalPhotoCount}
              treeId={data.tree.id}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}
