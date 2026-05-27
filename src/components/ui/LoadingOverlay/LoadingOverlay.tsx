'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { useLocale } from 'next-intl';

import { LOADING_MESSAGES, type LoadingVariant } from './loading-messages';
import { useDelayedLoading } from './use-delayed-loading';

const ROTATE_INTERVAL_MS = 2500;
const CROSSFADE_MS = 200;

export interface LoadingOverlayProps {
  /** Drives the overlay. Owned by each call site (useTransition / mutation hook). */
  isPending: boolean;
  variant: LoadingVariant;
  /**
   * Applied to the relative wrapper. Use it to preserve the wrapped region's
   * layout (e.g. `flex min-h-0 flex-1 flex-col`) so the overlay doesn't
   * collapse a flex column.
   */
  className?: string;
  children: React.ReactNode;
}

/**
 * Scoped, non-modal loading overlay. Covers only its parent region (the
 * `relative` wrapper), never the page. Appears after 400ms of pending state,
 * rotates themed messages, and fades out on completion. Children stay mounted
 * throughout and only lose pointer events while the overlay is visible.
 *
 * Not dismissable — there is intentionally no backdrop click handler.
 */
export function LoadingOverlay({
  isPending,
  variant,
  className,
  children,
}: LoadingOverlayProps) {
  const locale = useLocale();
  const { shouldRender, isVisible } = useDelayedLoading(isPending);

  const messages =
    LOADING_MESSAGES[variant][locale === 'he' ? 'he' : 'en'];

  const [index, setIndex] = useState(0);
  const [messageVisible, setMessageVisible] = useState(true);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset to the first message each time the overlay (re)appears.
  useEffect(() => {
    if (shouldRender) setIndex(0);
  }, [shouldRender]);

  // Rotate messages with a short crossfade. Only runs while visible and when
  // there is more than one message to cycle through.
  useEffect(() => {
    if (!shouldRender || messages.length <= 1) return;
    const interval = setInterval(() => {
      setMessageVisible(false);
      swapTimer.current = setTimeout(() => {
        setIndex((i) => (i + 1) % messages.length);
        setMessageVisible(true);
      }, CROSSFADE_MS);
    }, ROTATE_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      if (swapTimer.current) clearTimeout(swapTimer.current);
    };
  }, [shouldRender, messages.length]);

  return (
    <div
      className={clsx('relative', shouldRender && 'pointer-events-none', className)}
    >
      {/*
        No extra wrapper around children — keeping them a direct child of the
        relative box preserves flex/scroll layout. While the overlay shows, the
        relative box is pointer-events-none (children inert) and the overlay
        re-enables pointer-events to swallow clicks over its area.
      */}
      {children}

      {shouldRender && (
        <div
          className={clsx(
            'pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-4 text-center',
            'bg-[#f4f3e9]/85 backdrop-blur-sm transition-opacity duration-200',
            isVisible ? 'opacity-100' : 'opacity-0',
          )}
          aria-busy="true"
          role="status"
        >
          <span
            className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent"
            aria-hidden="true"
          />
          <p
            className={clsx(
              'max-w-xs text-sm italic leading-snug text-slate-600 transition-opacity duration-200',
              messageVisible ? 'opacity-100' : 'opacity-0',
            )}
          >
            {messages[index] ?? messages[0]}
          </p>
        </div>
      )}
    </div>
  );
}
