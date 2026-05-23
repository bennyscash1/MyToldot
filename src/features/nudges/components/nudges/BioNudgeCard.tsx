'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

import type { Nudge } from '../../lib/nudge-types';
import { pickStableTemplate } from '../../lib/nudge-messages';
import { NudgeCardShell } from './NudgeCardShell';

interface Props {
  nudge: Nudge;
  onOpenSidePanelForBio: () => void;
  onSkip: () => void;
  onSelectPerson?: () => void;
}

export function BioNudgeCard({ nudge, onOpenSidePanelForBio, onSkip, onSelectPerson }: Props) {
  const t = useTranslations('nudges');
  const tMessages = useTranslations('nudges.messages');

  const templates = useMemo(() => {
    const raw = tMessages.raw('bio');
    return Array.isArray(raw) ? (raw as string[]) : [];
  }, [tMessages]);

  const prompt = pickStableTemplate(nudge.id, templates).replace(
    '{name}',
    nudge.person_name_he,
  );

  return (
    <NudgeCardShell
      personName={nudge.person_name_he}
      prompt={prompt}
      onSelectPerson={onSelectPerson}
      onSkip={onSkip}
      primaryAction={
        <button
          type="button"
          onClick={onOpenSidePanelForBio}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
        >
          <PencilIcon className="h-4 w-4" />
          {t('writeBio')}
        </button>
      }
    />
  );
}

function PencilIcon({ className }: { className?: string }) {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
