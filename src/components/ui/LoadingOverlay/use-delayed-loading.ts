'use client';

import { useEffect, useRef, useState } from 'react';

const APPEAR_DELAY_MS = 400;
const FADE_OUT_MS = 200;

export interface DelayedLoadingState {
  /** Mount the overlay DOM? Stays true through the fade-out window. */
  shouldRender: boolean;
  /** Drive opacity: true = faded in, false = faded out. */
  isVisible: boolean;
}

/**
 * Gates a loading overlay on timing so fast operations never flash:
 *  - `isPending` true → after 400ms (if still pending) the overlay appears.
 *  - `isPending` false while shown → fade out for 200ms, then unmount.
 *  - `isPending` flips false before 400ms elapses → nothing ever renders.
 *
 * Pure timing; renders no UI. Each call site owns its own `isPending`.
 */
export function useDelayedLoading(isPending: boolean): DelayedLoadingState {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const appearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearAppear = () => {
      if (appearTimer.current) {
        clearTimeout(appearTimer.current);
        appearTimer.current = null;
      }
    };
    const clearFade = () => {
      if (fadeTimer.current) {
        clearTimeout(fadeTimer.current);
        fadeTimer.current = null;
      }
    };

    if (isPending) {
      // Cancel any pending fade-out; schedule the delayed appearance.
      clearFade();
      if (shouldRender) {
        // Re-toggled to pending mid fade-out — snap back to visible.
        setIsVisible(true);
      } else if (!appearTimer.current) {
        appearTimer.current = setTimeout(() => {
          appearTimer.current = null;
          setShouldRender(true);
          setIsVisible(true);
        }, APPEAR_DELAY_MS);
      }
    } else {
      // Not pending: cancel a not-yet-fired appearance (never flash)...
      clearAppear();
      // ...and if currently shown, fade out then unmount.
      if (shouldRender) {
        setIsVisible(false);
        if (!fadeTimer.current) {
          fadeTimer.current = setTimeout(() => {
            fadeTimer.current = null;
            setShouldRender(false);
          }, FADE_OUT_MS);
        }
      }
    }

    return () => {
      // Effect re-runs on isPending change; per-branch cleanup handled above.
      // Final unmount cleanup:
      clearAppear();
      clearFade();
    };
  }, [isPending, shouldRender]);

  return { shouldRender, isVisible };
}
