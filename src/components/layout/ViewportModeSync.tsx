'use client';

import { useLayoutEffect } from 'react';

import { usePathname } from '@/i18n/routing';
import {
  isDashboardPathname,
  isLandingRootPathname,
  isTreeCanvasPathname,
} from '@/lib/routing/viewport';

/**
 * Keeps <body>, <main>, and footer scroll mode in sync with the client route.
 *
 * The locale layout also sets these from `x-pathname` on the server, but that
 * header can be stale after soft navigation — the canvas overflow lock then
 * sticks on scrollable pages until a full refresh.
 */
export function ViewportModeSync() {
  const pathname = usePathname() ?? '';
  const locked =
    isTreeCanvasPathname(pathname) || isDashboardPathname(pathname);
  const hideFooter =
    locked || isLandingRootPathname(pathname);

  useLayoutEffect(() => {
    const body = document.body;
    body.classList.toggle('h-screen', locked);
    body.classList.toggle('min-h-screen', !locked);
    body.classList.toggle('overflow-hidden', locked);
    body.classList.toggle('overflow-x-hidden', !locked);

    const main = document.getElementById('app-main');
    if (main) {
      main.classList.toggle('flex', locked);
      main.classList.toggle('min-h-0', locked);
      main.classList.toggle('flex-col', locked);
    }

    const footer = document.getElementById('app-footer');
    if (footer) {
      footer.hidden = hideFooter;
    }
  }, [pathname, locked, hideFooter]);

  return null;
}
