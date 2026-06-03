'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import {
  planFamilyMergeFromTextAction,
  commitFamilyMergeProposalAction,
} from '@/server/actions/ai-family-merge.actions';
import type {
  ExistingFamilyMember,
  FamilyMergeProposal,
} from '@/server/lib/ai-family-merge/schema';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

export interface AiFamilyMergeModalProps {
  open: boolean;
  treeId: string;
  onClose: () => void;
  onApplied: () => void;
}

type Phase = 'input' | 'preview' | 'done';

function resolveMergeErrorMessage(
  serverMessage: string | undefined,
  t: ReturnType<typeof useTranslations<'aiFamilyMerge'>>,
): string {
  if (!serverMessage) return t('errorGeneric');
  if (serverMessage.includes('very large') || serverMessage.includes('too large')) {
    return t('errorTimeoutLarge');
  }
  if (serverMessage.includes('took too long')) {
    return t('errorTimeout');
  }
  if (serverMessage.includes('Resolve ambiguous')) {
    return t('errorUnresolvedAmbiguous');
  }
  if (serverMessage.includes('no people yet')) {
    return t('errorEmptyTree');
  }
  return serverMessage;
}

function SearchKbToggle({
  checked,
  disabled,
  onChange,
  label,
  description,
  warning,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description: string;
  warning: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="h-5 w-5 shrink-0 text-slate-500"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m12.786 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5a17.92 17.92 0 0 1-8.716-2.247m0 0A8.966 8.966 0 0 1 3 12c0-1.264.26-2.467.732-3.553"
              />
            </svg>
            <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
          </div>
          <p className="mt-1 text-xs text-slate-600">{description}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            checked ? 'bg-emerald-600' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition ${
              checked
                ? 'translate-x-[1.375rem] rtl:-translate-x-[1.375rem]'
                : 'translate-x-0.5 rtl:-translate-x-0.5'
            }`}
          />
        </button>
      </div>
      {checked && (
        <div
          className="mt-3 flex items-start gap-2 rounded-md border border-amber-300/80 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-950"
          role="status"
        >
          <p>{warning}</p>
        </div>
      )}
    </section>
  );
}

function relationLabel(
  relation: string,
  t: ReturnType<typeof useTranslations<'aiFamilyMerge'>>,
): string {
  switch (relation) {
    case 'child':
      return t('relationChild');
    case 'parent':
      return t('relationParent');
    case 'spouse':
      return t('relationSpouse');
    case 'sibling':
      return t('relationSibling');
    default:
      return relation;
  }
}

export function AiFamilyMergeModal({
  open,
  treeId,
  onClose,
  onApplied,
}: AiFamilyMergeModalProps) {
  const t = useTranslations('aiFamilyMerge');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';
  const cardRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>('input');
  const [userText, setUserText] = useState('');
  const [searchKnowledgeBases, setSearchKnowledgeBases] = useState(false);
  const [proposal, setProposal] = useState<FamilyMergeProposal | null>(null);
  const [existingFamily, setExistingFamily] = useState<ExistingFamilyMember[]>([]);
  const [resolvedAmbiguities, setResolvedAmbiguities] = useState<Record<string, string>>({});
  const [skipAmbiguous, setSkipAmbiguous] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applySummary, setApplySummary] = useState<{ applied: number; skipped: number } | null>(
    null,
  );

  const resetAll = useCallback(() => {
    setPhase('input');
    setUserText('');
    setSearchKnowledgeBases(false);
    setProposal(null);
    setExistingFamily([]);
    setResolvedAmbiguities({});
    setSkipAmbiguous(false);
    setIsGenerating(false);
    setIsApplying(false);
    setError(null);
    setApplySummary(null);
  }, []);

  useEffect(() => {
    if (!open) resetAll();
  }, [open, resetAll]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!cardRef.current?.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, onClose]);

  const nameById = useCallback(
    (id: string) => existingFamily.find((m) => m.id === id)?.name ?? id,
    [existingFamily],
  );

  const handleGenerate = useCallback(async () => {
    setError(null);
    const text = userText.trim();
    if (text.length < 5) {
      setError(t('errorEmptyInput'));
      return;
    }
    setIsGenerating(true);
    try {
      const result = await planFamilyMergeFromTextAction(treeId, text, {
        searchKnowledgeBases,
      });
      if (!result.ok) {
        setError(resolveMergeErrorMessage(result.error.message, t));
        return;
      }
      setProposal(result.data.proposal);
      setExistingFamily(result.data.existingFamily);
      setResolvedAmbiguities({});
      setPhase('preview');
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setIsGenerating(false);
    }
  }, [treeId, userText, searchKnowledgeBases, t]);

  const handleApply = useCallback(async () => {
    if (!proposal) return;
    setError(null);
    setIsApplying(true);
    try {
      const result = await commitFamilyMergeProposalAction(
        treeId,
        proposal,
        resolvedAmbiguities,
        skipAmbiguous,
      );
      if (!result.ok) {
        setError(resolveMergeErrorMessage(result.error.message, t));
        return;
      }
      setApplySummary({
        applied: result.data.applied.length,
        skipped: result.data.skipped.length,
      });
      setPhase('done');
      onApplied();
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setIsApplying(false);
    }
  }, [proposal, treeId, resolvedAmbiguities, skipAmbiguous, onApplied, t]);

  if (!open) return null;

  const ambiguous = proposal?.ambiguousMatches ?? [];
  const unresolvedCount = ambiguous.filter((a) => !resolvedAmbiguities[a.tempId]).length;
  const canApply =
    proposal &&
    proposal.newPeople.length > 0 &&
    (unresolvedCount === 0 || skipAmbiguous);

  const overlayPending = isGenerating || isApplying;
  const overlayVariant =
    isApplying || !searchKnowledgeBases
      ? 'creating-tree'
      : 'creating-tree-grounded';

  const kbDescription = searchKnowledgeBases
    ? t('searchKbDescription')
    : t('searchKbDescriptionOff');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        ref={cardRef}
        dir={dir}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-family-merge-title"
      >
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="ai-family-merge-title" className="text-base font-semibold text-slate-900">
                {t('modalTitle')}
              </h2>
              <p className="mt-1 text-xs text-slate-500">{t('modalSubtitle')}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label={t('cancelButton')}
            >
              ✕
            </button>
          </div>
        </div>

        <LoadingOverlay
          isPending={overlayPending}
          variant={isGenerating && searchKnowledgeBases ? 'creating-tree-grounded' : overlayVariant}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-4">
            {phase === 'input' && (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <textarea
                  value={userText}
                  onChange={(e) => setUserText(e.target.value)}
                  placeholder={t('inputPlaceholder')}
                  rows={8}
                  className="min-h-[10rem] w-full flex-1 resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  disabled={isGenerating}
                />
                <SearchKbToggle
                  checked={searchKnowledgeBases}
                  disabled={isGenerating}
                  onChange={setSearchKnowledgeBases}
                  label={t('searchKbLabel')}
                  description={kbDescription}
                  warning={t('searchKbWarning')}
                />
              </div>
            )}

            {phase === 'preview' && proposal && (
              <div className="flex flex-col gap-4">
                {proposal.matchedTo && (
                  <p className="text-sm text-slate-700">
                    {t('matchedToLabel')}: <strong>{proposal.matchedTo.name}</strong>
                  </p>
                )}
                {proposal.notes && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
                    {proposal.notes}
                  </p>
                )}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('newPeopleHeading', { count: proposal.newPeople.length })}
                  </h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {proposal.newPeople.map((p) => (
                      <li
                        key={p.tempId}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-slate-900">{p.name}</span>
                        <span className="text-slate-500"> — {relationLabel(p.relation, t)}</span>
                        {p.birthDate && (
                          <span className="block text-xs text-slate-500">{p.birthDate}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {ambiguous.length > 0 && (
                  <div className="border-t border-slate-100 pt-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                      {t('ambiguousHeading')}
                    </h3>
                    {ambiguous.map((a) => (
                      <div key={a.tempId} className="mt-3 rounded-lg border border-amber-200 p-3">
                        <p className="text-sm text-slate-800">{a.reason}</p>
                        <fieldset className="mt-2 flex flex-col gap-1">
                          {a.candidateIds.map((cid) => (
                            <label
                              key={cid}
                              className="flex cursor-pointer items-center gap-2 text-sm"
                            >
                              <input
                                type="radio"
                                name={`ambig-${a.tempId}`}
                                checked={resolvedAmbiguities[a.tempId] === cid}
                                onChange={() =>
                                  setResolvedAmbiguities((prev) => ({
                                    ...prev,
                                    [a.tempId]: cid,
                                  }))
                                }
                              />
                              {nameById(cid)}
                            </label>
                          ))}
                        </fieldset>
                      </div>
                    ))}
                    <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={skipAmbiguous}
                        onChange={(e) => setSkipAmbiguous(e.target.checked)}
                      />
                      {t('skipAmbiguousLabel')}
                    </label>
                  </div>
                )}
              </div>
            )}

            {phase === 'done' && applySummary && (
              <div className="py-6 text-center">
                <p className="text-base font-semibold text-emerald-700">{t('successTitle')}</p>
                <p className="mt-2 text-sm text-slate-600">
                  {t('successDescription', {
                    applied: applySummary.applied,
                    skipped: applySummary.skipped,
                  })}
                </p>
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}
          </div>
        </LoadingOverlay>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          {phase === 'input' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                {t('cancelInputButton')}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || userText.trim().length < 5}
                className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isGenerating ? t('generatingButton') : t('buildButton')}
              </button>
            </>
          )}
          {phase === 'preview' && (
            <>
              <button
                type="button"
                onClick={resetAll}
                disabled={isApplying}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700"
              >
                {t('resetButton')}
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying || !canApply}
                className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {isApplying ? t('applyingButton') : t('applyButton')}
              </button>
            </>
          )}
          {phase === 'done' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white"
            >
              {t('cancelButton')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
