'use client';

import { useEffect, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { deleteTreeAction } from '@/server/actions/tree.actions';

interface DeleteTreeConfirmDialogProps {
  treeId: string;
  treeShortCode: string;
  treeName: string;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DeleteTreeConfirmDialog({
  treeId,
  treeShortCode,
  treeName,
  open,
  onClose,
  onSuccess,
}: DeleteTreeConfirmDialogProps) {
  const t = useTranslations('treeDelete');
  const tBullets = useTranslations('treeDelete.dialogBullets');
  const locale = useLocale();
  const dir = locale === 'he' ? 'rtl' : 'ltr';

  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();

  useEffect(() => {
    if (!open) {
      setTyped('');
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, isDeleting]);

  if (!open) return null;

  const codeMatches = typed.trim() === treeShortCode;

  function handleConfirm() {
    setError(null);
    startDelete(async () => {
      const result = await deleteTreeAction(treeId, typed.trim());
      if (!result.ok) {
        if (result.error.code === 'INVALID_CONFIRM_CODE') {
          setError(t('errorMismatch'));
        } else {
          setError(t('errorGeneric'));
        }
        return;
      }
      onSuccess();
    });
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !isDeleting) onClose();
      }}
    >
      <div
        dir={dir}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-tree-title"
        className="w-full max-w-md overflow-hidden rounded-xl border border-red-200 bg-white shadow-2xl"
      >
        <header className="border-b border-red-200 bg-red-50 px-5 py-4">
          <h2 id="delete-tree-title" className="text-base font-semibold text-red-800">
            {t('dialogTitle', { name: treeName })}
          </h2>
          <p className="mt-1 text-sm text-red-700">{t('dialogWarning')}</p>
        </header>

        <div className="px-5 py-4">
          <ul className="ms-5 list-disc space-y-1 text-sm text-slate-700">
            <li>{tBullets('persons')}</li>
            <li>{tBullets('relationships')}</li>
            <li>{tBullets('images')}</li>
            <li>{tBullets('members')}</li>
          </ul>

          <label className="mt-4 block text-sm font-medium text-slate-700">
            {t('typeToConfirm', { code: treeShortCode })}
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={5}
            value={typed}
            onChange={(e) => {
              setError(null);
              setTyped(e.target.value.replace(/\D/g, '').slice(0, 5));
            }}
            disabled={isDeleting}
            placeholder={t('typeToConfirmInput')}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-400 disabled:bg-slate-50"
            aria-invalid={error ? true : undefined}
          />

          {error && (
            <p role="alert" className="mt-2 text-sm text-red-600">
              {error}
            </p>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isDeleting}
          >
            {t('cancel')}
          </Button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!codeMatches || isDeleting}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting ? t('deleting') : t('confirmButton')}
          </button>
        </footer>
      </div>
    </div>
  );
}
