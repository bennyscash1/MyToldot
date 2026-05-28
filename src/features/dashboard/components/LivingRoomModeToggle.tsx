'use client';

import { useTranslations } from 'next-intl';

import { usePathname } from '@/i18n/routing';
import { useLivingRoomMode } from '../hooks/useLivingRoomMode';

const DASHBOARD_PATH_RE = /\/tree\/\d{5}\/dashboard\/?$/;

interface LivingRoomModeToggleProps {
  /** Render the exit control (TV overlay). */
  variant: 'exit' | 'enter';
  className?: string;
}

export function LivingRoomModeToggle({
  variant,
  className = '',
}: LivingRoomModeToggleProps) {
  const t = useTranslations('dashboard');
  const pathname = usePathname() ?? '';
  const { isLivingRoomMode, hydrated, enterLivingRoom, exitLivingRoom } =
    useLivingRoomMode();

  if (!DASHBOARD_PATH_RE.test(pathname)) {
    return null;
  }

  if (variant === 'enter' && (!hydrated || isLivingRoomMode)) {
    return null;
  }

  if (variant === 'exit') {
    return (
      <button
        type="button"
        onClick={exitLivingRoom}
        className={
          'rounded-lg border border-slate-300 bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-white ' +
          className
        }
      >
        {t('exitLivingRoomMode')}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={enterLivingRoom}
      className={
        'inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 ' +
        className
      }
    >
      <TvIcon className="h-4 w-4 shrink-0" aria-hidden />
      <span>{t('livingRoomMode')}</span>
    </button>
  );
}

function TvIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5Zm2 0v10h12V5H6Zm-1 16a1 1 0 1 1 0-2h14a1 1 0 1 1 0 2H5Z" />
    </svg>
  );
}
