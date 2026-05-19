'use client';

import { useTranslations } from 'next-intl';

import { Link } from '@/i18n/routing';

interface DashboardHeaderProps {
  treeShortCode: string;
  paused: boolean;
  onTogglePause: () => void;
}

export function DashboardHeader({
  treeShortCode,
  paused,
  onTogglePause,
}: DashboardHeaderProps) {
  const t = useTranslations('dashboard');

  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Link
        href={`/tree/${treeShortCode}`}
        aria-label={t('backToTree')}
        className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
      >
        <BackChevronIcon className="h-4 w-4 shrink-0 rtl:rotate-180" />
        <span>{t('backToTree')}</span>
      </Link>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          title={t('castComingSoon')}
          aria-label={t('castMode')}
          className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-400"
        >
          <CastIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{t('castMode')}</span>
        </button>
        <button
          type="button"
          onClick={onTogglePause}
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
        >
          {paused ? <PlayIcon className="h-4 w-4" /> : <PauseIcon className="h-4 w-4" />}
          <span className="hidden sm:inline">
            {paused ? t('resume') : t('pause')}
          </span>
        </button>
      </div>
    </header>
  );
}

function BackChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function CastIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-6" />
      <path d="M3 13a6 6 0 0 1 6 6" />
      <path d="M3 17a2 2 0 0 1 2 2" />
      <circle cx="4" cy="20" r="1" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M8 5v14l11-7L8 5Z" />
    </svg>
  );
}
