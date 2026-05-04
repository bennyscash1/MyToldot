'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';

import { PersonForm } from '@/features/persons/components/PersonForm';
import type { PersonInput } from '@/features/family-tree/schemas/person.schema';
import type { PlaceholderMeta } from '../../lib/types';

// ────────────────────────────────────────────────────────────────
// AddRelativePopover
//
// A floating, viewport-clamped popover that opens at the screen coordinate
// of the clicked placeholder. It contains a quick-add form and calls the
// relevant mutation. On success, the parent closes it.
//
// Positioning: we receive (screenX, screenY) from the click event. The
// popover renders fixed to the viewport. We clamp to screen edges so it
// never opens partially off-screen on mobile.
// ────────────────────────────────────────────────────────────────

const TITLE: Record<PlaceholderMeta['kind'], string> = {
  'add-parent': 'הוספת הורה',
  'add-spouse': 'הוספת בן/בת זוג',
  'add-child': 'הוספת ילד',
  'add-sibling': 'הוספת אח/אחות',
};

export interface AddRelativePopoverProps {
  meta: PlaceholderMeta;
  anchorGender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN' | null;
  /** Viewport coordinates where the placeholder was clicked. */
  screenX: number;
  screenY: number;
  onClose: () => void;
  onSubmit: (input: PersonInput) => Promise<void>;
  isSubmitting: boolean;
  errorMessage: string | null;
}

const POPOVER_WIDTH = 340;
const POPOVER_MAX_HEIGHT = 480;
const EDGE_GAP = 12;

function clampPosition(x: number, y: number): { left: number; top: number } {
  if (typeof window === 'undefined') return { left: x, top: y };
  const left = Math.min(
    Math.max(x - POPOVER_WIDTH / 2, EDGE_GAP),
    window.innerWidth - POPOVER_WIDTH - EDGE_GAP,
  );
  const top = Math.min(Math.max(y + 8, EDGE_GAP), window.innerHeight - POPOVER_MAX_HEIGHT - EDGE_GAP);
  return { left, top };
}

export function AddRelativePopover({
  meta,
  anchorGender,
  screenX,
  screenY,
  onClose,
  onSubmit,
  isSubmitting,
  errorMessage,
}: AddRelativePopoverProps) {
  const locale = useLocale();
  const headerDir = locale === 'he' ? 'rtl' : 'ltr';
  const ref = useRef<HTMLDivElement>(null);

  // Close on Escape + click-outside.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [onClose]);

  const { left, top } = clampPosition(screenX, screenY);

  const forcedSpouseGender =
    meta.kind === 'add-spouse'
      ? anchorGender === 'MALE'
        ? 'FEMALE'
        : anchorGender === 'FEMALE'
          ? 'MALE'
          : undefined
      : undefined;

  return (
    <div
      ref={ref}
      style={{ left, top, width: POPOVER_WIDTH, maxHeight: POPOVER_MAX_HEIGHT }}
      className="fixed z-50 overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
      role="dialog"
      aria-modal="true"
    >
      <div className="mb-3 flex items-center justify-between" dir={headerDir}>
        <h3 className="text-sm font-semibold text-slate-900">{TITLE[meta.kind]}</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          aria-label="סגור"
        >
          ✕
        </button>
      </div>

      <PersonForm
        variant="quick"
        forcedGender={forcedSpouseGender}
        submitLabel="שמור"
        cancelLabel="ביטול"
        onSubmit={onSubmit}
        onCancel={onClose}
        isSubmitting={isSubmitting}
        errorMessage={errorMessage}
      />
    </div>
  );
}
