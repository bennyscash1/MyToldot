'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import {
  planFamilyFromTextAction,
  buildTreeFromAiPlanAction,
} from '@/server/actions/ai-tree.actions';
import type { GeminiContent } from '@/server/lib/gemini';
import type { AiTreePlan } from '@/server/lib/ai-tree-builder/schema';

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
  const [plan, setPlan] = useState<AiTreePlan | null>(null);
  const [contents, setContents] = useState<GeminiContent[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetAll = useCallback(() => {
    setPhase('input');
    setUserText('');
    setRefineText('');
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
      const result = await planFamilyFromTextAction(treeId, text, []);
      if (!result.ok) {
        setError(result.error.message || t('errorGeneric'));
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
  }, [treeId, userText, t]);

  const handleRefine = useCallback(async () => {
    setError(null);
    const text = refineText.trim();
    if (text.length < 2) return;
    setIsGenerating(true);
    try {
      const result = await planFamilyFromTextAction(treeId, text, contents);
      if (!result.ok) {
        setError(result.error.message || t('errorGeneric'));
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
  }, [treeId, refineText, contents, t]);

  const handleApply = useCallback(async () => {
    if (!plan) return;
    setError(null);
    setIsApplying(true);
    try {
      const result = await buildTreeFromAiPlanAction(treeId, plan);
      if (!result.ok) {
        setError(result.error.message || t('errorGeneric'));
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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        ref={cardRef}
        dir={dir}
        className="flex max-h-[min(92vh,780px)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-tree-builder-title"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {phase === 'input' && (
            <div className="flex flex-col gap-3">
              <textarea
                value={userText}
                onChange={(e) => setUserText(e.target.value)}
                placeholder={t('inputPlaceholder')}
                rows={8}
                className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                disabled={isGenerating}
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

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          {phase === 'input' && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                {t('cancelButton')}
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating || userText.trim().length < 5}
                className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isGenerating ? t('generatingButton') : t('generateButton')}
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
