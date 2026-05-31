'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import type { FamilyMemberProposalDto } from '../lib/family-discovery-types';
import { proposalDisplayName } from '../lib/family-discovery-types';

interface FamilyDiscoveryProposalCardProps {
  proposal: FamilyMemberProposalDto;
  onAdd: () => Promise<boolean>;
  onDismiss: () => void;
  disabled?: boolean;
}

function SparkleIcon({ className }: { className?: string }) {
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

type ConnectionKey =
  | 'parentOfMale'
  | 'parentOfFemale'
  | 'childOfMale'
  | 'childOfFemale'
  | 'spouseOf'
  | 'siblingOfMale'
  | 'siblingOfFemale';

function connectionKey(proposal: FamilyMemberProposalDto): ConnectionKey {
  const { type } = proposal.relationship;
  const gender = proposal.gender;
  switch (type) {
    case 'PARENT':
      return gender === 'MALE' ? 'parentOfMale' : 'parentOfFemale';
    case 'CHILD':
      return gender === 'MALE' ? 'childOfMale' : 'childOfFemale';
    case 'SPOUSE':
      return 'spouseOf';
    case 'SIBLING':
      return gender === 'MALE' ? 'siblingOfMale' : 'siblingOfFemale';
    default:
      return 'spouseOf';
  }
}

function confidenceBadgeClass(confidence: FamilyMemberProposalDto['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'bg-emerald-100 text-emerald-800';
    case 'medium':
      return 'bg-amber-100 text-amber-800';
    case 'low':
      return 'bg-gray-100 text-gray-600';
  }
}

export function FamilyDiscoveryProposalCard({
  proposal,
  onAdd,
  onDismiss,
  disabled = false,
}: FamilyDiscoveryProposalCardProps) {
  const t = useTranslations('familyDiscovery');
  const [expanded, setExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [slidingOut, setSlidingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = proposalDisplayName(proposal);
  const connection = t(`connection.${connectionKey(proposal)}`, {
    name: proposal.relatedToPersonNameHe,
  });

  const hasExtraDetails =
    Boolean(proposal.birthDate) ||
    Boolean(proposal.deathDate) ||
    Boolean(proposal.birthPlace) ||
    Boolean(proposal.bio);

  const handleAdd = async () => {
    if (isAdding || disabled) return;
    setError(null);
    setIsAdding(true);
    try {
      const ok = await onAdd();
      if (ok) {
        setSlidingOut(true);
        setTimeout(onDismiss, 220);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDismiss = () => {
    if (disabled) return;
    setSlidingOut(true);
    setTimeout(onDismiss, 220);
  };

  return (
    <div
      className={[
        'rounded-xl border border-gray-100 border-s-2 border-s-emerald-500 bg-white p-3 transition-all duration-200 ease-out hover:border-emerald-200',
        slidingOut ? '-translate-x-[110%] opacity-0' : 'translate-x-0 opacity-100',
      ].join(' ')}
    >
      <div className="flex items-start gap-1.5">
        <SparkleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
        <p className="text-sm font-medium text-gray-900">{name}</p>
      </div>

      <p className="mt-1 text-sm text-gray-600">{connection}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${confidenceBadgeClass(proposal.confidence)}`}
        >
          {t(`confidence.${proposal.confidence}`)}
        </span>
        {proposal.sourceNote && (
          <>
            <span className="text-gray-400" aria-hidden>
              ·
            </span>
            <span className="text-gray-500">{proposal.sourceNote}</span>
          </>
        )}
      </div>

      {hasExtraDetails && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            {expanded ? t('collapseDetails') : t('expandDetails')}
          </button>
          {expanded && (
            <div className="mt-1.5 space-y-1 text-xs text-gray-600">
              {(proposal.birthDate || proposal.deathDate || proposal.birthPlace) && (
                <p>
                  {proposal.birthDate && (
                    <>
                      {t('born')}: {proposal.birthDate}
                    </>
                  )}
                  {proposal.birthDate && proposal.deathDate && ' · '}
                  {proposal.deathDate && (
                    <>
                      {t('died')}: {proposal.deathDate}
                    </>
                  )}
                  {proposal.birthPlace && (
                    <>
                      {(proposal.birthDate || proposal.deathDate) && ' · '}
                      {t('birthPlace')}: {proposal.birthPlace}
                    </>
                  )}
                </p>
              )}
              {proposal.bio && (
                <p className="leading-relaxed text-gray-700">&ldquo;{proposal.bio}&rdquo;</p>
              )}
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={isAdding || disabled}
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isAdding ? t('adding') : t('addToTree')}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          disabled={isAdding || disabled}
          className="text-sm text-gray-500 transition hover:text-gray-700 disabled:opacity-50"
        >
          {t('dismiss')}
        </button>
      </div>
    </div>
  );
}
