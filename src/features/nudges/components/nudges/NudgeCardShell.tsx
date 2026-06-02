'use client';

import { type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface NudgeCardShellProps {
  personName: string;
  prompt: string;
  /** Inline input area (date input, file picker button, etc.). */
  inputArea?: ReactNode;
  /** Primary action button. */
  primaryAction: ReactNode;
  onSkip: () => void;
  /** Optional click on the person name → open side panel. */
  onSelectPerson?: () => void;
  /** Saved confirmation row (✓ נשמר!) shown briefly after success. */
  savedFlash?: boolean;
  /** When true, the card slides out via CSS transform. */
  slidingOut?: boolean;
}

export function NudgeCardShell({
  personName,
  prompt,
  inputArea,
  primaryAction,
  onSkip,
  onSelectPerson,
  savedFlash = false,
  slidingOut = false,
}: NudgeCardShellProps) {
  const t = useTranslations('nudges');

  return (
    <div
      className={[
        'rounded-xl border border-gray-100 bg-white p-3 transition-all duration-200 ease-out hover:border-emerald-200',
        slidingOut ? '-translate-x-[110%] opacity-0' : 'translate-x-0 opacity-100',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={onSelectPerson}
        disabled={!onSelectPerson}
        className="block w-full truncate text-start text-sm font-medium text-gray-900 enabled:hover:text-emerald-700 disabled:cursor-default"
      >
        {personName}
      </button>
      <p className="mt-1 text-sm text-gray-700">{prompt}</p>
      {inputArea && <div className="mt-2">{inputArea}</div>}
      {savedFlash ? (
        <p
          role="status"
          className="mt-2 text-sm font-medium text-emerald-700"
        >
          ✓ {t('saved')}!
        </p>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2">
          {primaryAction}
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-gray-500 transition hover:text-gray-700"
          >
            {t('skip')}
          </button>
        </div>
      )}
    </div>
  );
}
