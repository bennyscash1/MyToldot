'use client';

import { useTranslations } from 'next-intl';

import type { Nudge } from '../lib/nudge-types';
import { NudgeCard } from './NudgeCard';

interface NudgesPanelProps {
  treeId: string;
  nudges: Nudge[];
  visibleCount: number;
  onMinimize: () => void;
  onSavedAndDone: (nudgeId: string) => void;
  onSkip: (nudgeId: string) => void;
  onOpenSidePanelForBio: (personId: string) => void;
  onSelectPerson: (personId: string) => void;
}

export function NudgesPanel({
  treeId,
  nudges,
  visibleCount,
  onMinimize,
  onSavedAndDone,
  onSkip,
  onOpenSidePanelForBio,
  onSelectPerson,
}: NudgesPanelProps) {
  const t = useTranslations('nudges');
  const isEmpty = nudges.length === 0;

  return (
    <div className="flex max-h-[500px] w-[340px] flex-col overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-xl">
      <header className="sticky top-0 flex h-12 shrink-0 items-center justify-between border-b border-gray-100 px-4">
        <span className="inline-flex items-center gap-2 font-medium text-gray-900">
          <ChatIcon className="h-4 w-4 text-emerald-600" aria-hidden />
          {t('panelTitle')}
          {visibleCount > 0 && (
            <span className="text-gray-500">({visibleCount})</span>
          )}
        </span>
        <button
          type="button"
          onClick={onMinimize}
          aria-label={t('minimize')}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
        >
          <MinusIcon className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <SparklesIcon className="h-12 w-12 text-emerald-300" aria-hidden />
            <p className="font-medium text-gray-600">{t('allComplete')}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {nudges.map((nudge) => (
              <li key={nudge.id}>
                <NudgeCard
                  nudge={nudge}
                  treeId={treeId}
                  onSavedAndDone={() => onSavedAndDone(nudge.id)}
                  onSkip={() => onSkip(nudge.id)}
                  onOpenSidePanelForBio={onOpenSidePanelForBio}
                  onSelectPerson={onSelectPerson}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ChatIcon({ className }: { className?: string }) {
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
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function MinusIcon({ className }: { className?: string }) {
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
      aria-hidden="true"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2.5a.75.75 0 0 1 .7.48l1.6 4.16a4 4 0 0 0 2.36 2.36l4.16 1.6a.75.75 0 0 1 0 1.4l-4.16 1.6a4 4 0 0 0-2.36 2.36l-1.6 4.16a.75.75 0 0 1-1.4 0l-1.6-4.16a4 4 0 0 0-2.36-2.36l-4.16-1.6a.75.75 0 0 1 0-1.4l4.16-1.6a4 4 0 0 0 2.36-2.36l1.6-4.16a.75.75 0 0 1 .7-.48Z" />
    </svg>
  );
}
