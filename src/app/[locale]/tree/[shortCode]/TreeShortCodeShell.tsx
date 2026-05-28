'use client';

import type { ReactNode } from 'react';

import { usePathname } from '@/i18n/routing';
import { isTreeCanvasPathname } from '@/lib/routing/viewport';

/**
 * Flex height chain for the canvas route only. Sub-routes (about, manage,
 * dashboard) use natural block layout so content can scroll with the page.
 */
export function TreeShortCodeShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const isCanvas = isTreeCanvasPathname(pathname);

  return (
    <div className={isCanvas ? 'flex min-h-0 flex-1 flex-col' : undefined}>
      {children}
    </div>
  );
}
