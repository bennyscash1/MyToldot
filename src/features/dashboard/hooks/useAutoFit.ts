'use client';

import { useEffect, useState, type RefObject } from 'react';

export type DashboardLayoutMode = 'tablet' | 'tv';

export interface AutoFitMetrics {
  scale: number;
  gap: number;
  maxEvents: number;
  maxBios: number;
  bioLineClamp: number;
  gallerySlots: number;
}

const DEFAULT: AutoFitMetrics = {
  scale: 1,
  gap: 16,
  maxEvents: 5,
  maxBios: 5,
  bioLineClamp: 6,
  gallerySlots: 6,
};

export function useAutoFit(
  rootRef: RefObject<HTMLElement | null>,
  mode: DashboardLayoutMode,
  headerHeight = 48,
): AutoFitMetrics {
  const [metrics, setMetrics] = useState<AutoFitMetrics>(DEFAULT);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const compute = () => {
      const h = el.clientHeight - headerHeight;
      const w = el.clientWidth;
      const isTv = mode === 'tv';
      const baseScale = isTv ? 1.05 : 0.95;
      const heightFactor = Math.min(1.35, Math.max(0.85, h / 720));
      const widthFactor = Math.min(1.35, Math.max(0.9, w / 1280));
      const scale = Math.min(1.35, baseScale * heightFactor * widthFactor);

      let gap = 16;
      let maxEvents = 5;
      let maxBios = 5;
      let bioLineClamp = isTv ? 8 : 6;
      let gallerySlots = 6;

      if (h < 640) {
        gap = 8;
        maxEvents = 3;
        maxBios = 3;
        bioLineClamp = 4;
        gallerySlots = 4;
      } else if (h < 760) {
        gap = 12;
        maxEvents = 4;
        maxBios = 4;
        bioLineClamp = 5;
      }

      setMetrics({ scale, gap, maxEvents, maxBios, bioLineClamp, gallerySlots });
      el.style.setProperty('--dash-scale', String(scale));
      el.style.setProperty('--dash-gap', `${gap}px`);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [rootRef, mode, headerHeight]);

  return metrics;
}
