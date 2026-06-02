'use client';

import { useEffect, useRef, type RefObject } from 'react';

// ──────────────────────────────────────────────
// useFocusTrap — minimal, dependency-free focus management for dialogs.
//
// While `active` is true it:
//   1. Remembers the element that had focus before the dialog opened.
//   2. Moves focus into the dialog (first focusable element, else the
//      container itself).
//   3. Keeps Tab / Shift+Tab cycling within the container (WCAG 2.4.3).
//   4. Restores focus to the original trigger when the dialog closes.
//
// Escape-to-close is intentionally NOT handled here — each dialog already
// owns its own Escape listener. RTL-safe: tab order follows the DOM, which
// is direction-agnostic.
// ──────────────────────────────────────────────

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

/**
 * Traps keyboard focus inside `containerRef` while `active` is true.
 * Pass the same ref you spread onto the dialog's root element.
 */
export function useFocusTrap<T extends HTMLElement>(
  containerRef: RefObject<T | null>,
  active: boolean,
): void {
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Move focus inside on open (next frame so slide-in animations don't fight it).
    const raf = requestAnimationFrame(() => {
      const focusable = getFocusable(container);
      (focusable[0] ?? container).focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = getFocusable(container);
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (activeEl === first || !container.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKeyDown, true);
      previouslyFocused.current?.focus?.();
    };
  }, [active, containerRef]);
}
