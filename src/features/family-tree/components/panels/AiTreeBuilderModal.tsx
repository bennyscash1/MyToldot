'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import {
  planFamilyFromTextAction,
  buildTreeFromAiPlanAction,
} from '@/server/actions/ai-tree.actions';
import type { GeminiContent } from '@/server/lib/gemini';
import type { AiTreePlan } from '@/server/lib/ai-tree-builder/schema';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

// NOTE: imports from `@/server/lib/*` above are TYPE-ONLY (verified by
// `import type`). They are stripped at build time so no server-only runtime
// code leaks into the client bundle. The action imports above are server
// actions and traverse the Next.js RSC boundary as RPC stubs.

export interface AiTreeBuilderModalProps {
  open: boolean;
  treeId: string;
  onClose: () => void;
  onApplied: () => void;
}

type Phase = 'input' | 'preview' | 'applied';

/** Map stable server error text to locale-aware copy (server actions return English). */
function resolveAiTreeErrorMessage(
  serverMessage: string | undefined,
  t: ReturnType<typeof useTranslations<'aiTreeBuilder'>>,
): string {
  if (!serverMessage) return t('errorGeneric');
  if (serverMessage.includes('very large and the AI did not finish')) {
    return t('errorTimeoutLarge');
  }
  if (serverMessage.includes('took too long to respond')) {
    return t('errorTimeout');
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003ZM12 8.25a.75.75 0 0 1 .75.75v3.75a.75.75 0 0 1-1.5 0V9a.75.75 0 0 1 .75-.75Zm0 8.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
              clipRule="evenodd"
            />
          </svg>
          <p>{warning}</p>
        </div>
      )}
    </section>
  );
}

export function AiTreeBuilderModal({
  open,
  treeId,
  onClose,
  onApplied,
}: AiTreeBuilderModalProps) {
  const t = useTranslations('aiTreeBuilder');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  const cardRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>('input');
  const [userText, setUserText] = useState('');
  const [refineText, setRefineText] = useState('');
  const [searchKnowledgeBases, setSearchKnowledgeBases] = useState(false);
  const [plan, setPlan] = useState<AiTreePlan | null>(null);
  const [contents, setContents] = useState<GeminiContent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetAll = useCallback(() => {
    setPhase('input');
    setUserText('');
    setRefineText('');
    setSearchKnowledgeBases(false);
    setPlan(null);
    setContents([]);
    setIsGenerating(false);
    setIsApplying(false);
    setError(null);
  }, []);

  // Reset internal state whenever the modal closes so the next open starts fresh.
  useEffect(() => {
    if (!open) {
      resetAll();
    }
  }, [open, resetAll]);

  // Escape + click-outside dismissal (mirrors the first-root modal pattern).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!cardRef.current) return;
      if (!cardRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, onClose]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    const text = userText.trim();
    if (text.length < 5) {
      setError(t('errorEmptyInput'));
      return;
    }
    setIsGenerating(true);
    try {
      const result = await planFamilyFromTextAction(treeId, text, [], {
        searchKnowledgeBases,
      });
      if (!result.ok) {
        setError(resolveAiTreeErrorMessage(result.error.message, t));
        return;
      }
      setPlan(result.data.plan);
      setContents(result.data.contents);
      setPhase('preview');
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setIsGenerating(false);
    }
  }, [treeId, userText, searchKnowledgeBases, t]);

  const handleRefine = useCallback(async () => {
    setError(null);
    const text = refineText.trim();
    if (text.length < 2) return;
    setIsGenerating(true);
    try {
      const result = await planFamilyFromTextAction(treeId, text, contents, {
        searchKnowledgeBases,
      });
      if (!result.ok) {
        setError(resolveAiTreeErrorMessage(result.error.message, t));
        return;
      }
      setPlan(result.data.plan);
      setContents(result.data.contents);
      setRefineText('');
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setIsGenerating(false);
    }
  }, [treeId, refineText, contents, searchKnowledgeBases, t]);

  const handleApply = useCallback(async () => {
    if (!plan) return;
    setError(null);
    setIsApplying(true);
    try {
      const result = await buildTreeFromAiPlanAction(treeId, plan);
      if (!result.ok) {
        setError(resolveAiTreeErrorMessage(result.error.message, t));
        return;
      }
      setPhase('applied');
      onApplied();
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setIsApplying(false);
    }
  }, [plan, treeId, onApplied, t]);

  if (!open) return null;

  const stats = plan
    ? t('statsLabel', {
        persons: plan.persons.length,
        relationships: plan.relationships.length,
      })
    : '';

  const overlayPending = isGenerating || isApplying;
  const overlayVariant = isApplying
    ? 'creating-tree'
    : isGenerating && searchKnowledgeBases
      ? 'creating-tree-grounded'
      : phase === 'preview'
        ? 'refining-tree'
        : 'creating-tree';

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
        aria-labelledby="ai-tree-builder-title"
      >
        <div className="shrink-0 border-b border-slate-100 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2
                id="ai-tree-builder-title"
                className="text-base font-semibold text-slate-900"
              >
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
          variant={overlayVariant}
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

            {phase === 'preview' && plan && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('summaryHeading')}
                  </h3>
                  <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800">
                    {plan.summary}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{stats}</p>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t('refineLabel')}
                  </label>
                  <textarea
                    value={refineText}
                    onChange={(e) => setRefineText(e.target.value)}
                    placeholder={t('refinePlaceholder')}
                    rows={3}
                    className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                    disabled={isGenerating || isApplying}
                  />
                  <button
                    type="button"
                    onClick={handleRefine}
                    disabled={isGenerating || isApplying || refineText.trim().length < 2}
                    className="mt-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isGenerating ? t('generatingButton') : t('refineButton')}
                  </button>
                </div>
              </div>
            )}

            {phase === 'applied' && plan && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <div className="text-base font-semibold text-emerald-700">{t('successTitle')}</div>
                <p className="text-sm text-slate-600">
                  {t('successDescription', {
                    persons: plan.persons.length,
                    relationships: plan.relationships.length,
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
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t('cancelInputButton')}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || userText.trim().length < 5}
                className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                disabled={isApplying || isGenerating}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {t('resetButton')}
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={isApplying || isGenerating || !plan || plan.persons.length === 0}
                className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isApplying ? t('applyingButton') : t('applyButton')}
              </button>
            </>
          )}

          {phase === 'applied' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              {t('cancelButton')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
