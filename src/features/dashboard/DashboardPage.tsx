'use client';

import { Suspense, useRef } from 'react';
import { useLocale } from 'next-intl';

import { TabletLayout } from './TabletLayout';
import { TVLayout } from './TVLayout';
import { useAutoFit } from './hooks/useAutoFit';
import { useLivingRoomMode } from './hooks/useLivingRoomMode';
import { usePersonRotation } from './hooks/usePersonRotation';
import type { DashboardData } from './types';

interface DashboardPageProps {
  data: DashboardData;
  initialPersonId?: string | null;
}

export function DashboardPage(props: DashboardPageProps) {
  return (
    <Suspense fallback={<DashboardPageFallback data={props.data} />}>
      <DashboardPageInner {...props} />
    </Suspense>
  );
}

function DashboardPageFallback({ data }: { data: DashboardData }) {
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  return (
    <div
      dir={dir}
      id="dashboard-root"
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f4f3e9] px-4 py-3"
    >
      <p className="text-sm text-slate-600">{data.tree.name}</p>
    </div>
  );
}

function DashboardPageInner({ data, initialPersonId }: DashboardPageProps) {
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const rootRef = useRef<HTMLDivElement>(null);
  const { isLivingRoomMode, hydrated } = useLivingRoomMode();
  const rotation = usePersonRotation(
    data.persons,
    data.tree.id,
    initialPersonId,
  );
  const metrics = useAutoFit(
    rootRef,
    isLivingRoomMode ? 'tv' : 'tablet',
    isLivingRoomMode ? 0 : 52,
  );

  return (
    <div
      ref={rootRef}
      id="dashboard-root"
      dir={dir}
      className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f4f3e9] px-4 py-3 sm:px-5"
    >
      {hydrated && !isLivingRoomMode ? (
        <TabletLayout data={data} rotation={rotation} metrics={metrics} />
      ) : (
        <TVLayout data={data} rotation={rotation} metrics={metrics} />
      )}
    </div>
  );
}
