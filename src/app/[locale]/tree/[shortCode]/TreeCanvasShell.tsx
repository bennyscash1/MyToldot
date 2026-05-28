import type { ReactNode } from 'react';

import { Spinner } from '@/components/ui/Spinner';

/**
 * Fills the locked viewport under the tree nav bar. Used by the canvas page and
 * route-level loading UI so flex/overflow behavior stays consistent.
 */
export function TreeCanvasShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {children}
    </div>
  );
}

/** Centered spinner over the cream canvas region (route loading + shared fallback). */
export function TreeCanvasLoadingArea() {
  return (
    <div className="relative min-h-0 flex-1 bg-[#f4f3e9]">
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner />
      </div>
    </div>
  );
}
