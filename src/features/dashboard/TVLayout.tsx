'use client';

import { createPortal } from 'react-dom';

import { LivingRoomModeToggle } from './components/LivingRoomModeToggle';
import { DashboardGrid } from './DashboardGrid';
import type { AutoFitMetrics } from './hooks/useAutoFit';
import type { UsePersonRotationResult } from './hooks/usePersonRotation';
import type { DashboardData } from './types';

interface TVLayoutProps {
  data: DashboardData;
  rotation: UsePersonRotationResult;
  metrics: AutoFitMetrics;
}

export function TVLayout({ data, rotation, metrics }: TVLayoutProps) {
  const content = (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-[#f4f3e9] p-4"
      role="dialog"
      aria-modal
    >
      <div className="absolute end-4 top-4 z-10">
        <LivingRoomModeToggle variant="exit" />
      </div>

      <div className="min-h-0 flex-1 pt-10">
        <DashboardGrid
          data={data}
          rotation={rotation}
          metrics={metrics}
          tv
          showPersonNav={false}
        />
      </div>

      <div
        className="mt-2 h-1 shrink-0 overflow-hidden rounded-full bg-slate-200"
        aria-hidden
      >
        <div
          className="h-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
          style={{ width: `${rotation.progress * 100}%` }}
        />
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(content, document.body);
}
