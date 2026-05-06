'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import {
  FamilyAboutEditView,
  FamilyAboutReadView,
} from '@/features/about/components/FamilyAboutContent';
import { ServiceError } from '@/services/api.client';
import { treesService } from '@/services/trees.service';
import type { TreeAboutDto } from '@/types/api';

type TreeAboutModalProps = {
  treeId: string;
  canEdit: boolean;
  open: boolean;
  onClose: () => void;
};

export function TreeAboutModal({ treeId, canEdit, open, onClose }: TreeAboutModalProps) {
  const t = useTranslations('treeAbout');
  const tAbout = useTranslations('aboutPage');
  const tCommon = useTranslations('common');
  const modalRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<TreeAboutDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [draftSurnames, setDraftSurnames] = useState<string[]>([]);
  const [surnameInput, setSurnameInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const loadAbout = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const about = await treesService.getAbout(treeId);
      setData(about);
      setDraftText(about.about_text ?? '');
      setDraftSurnames(about.main_surnames);
      setSurnameInput('');
    } catch (error) {
      const message = error instanceof ServiceError ? error.message : tAbout('saveFailed');
      setErrorMessage(message);
      setData({ id: treeId, about_text: null, main_surnames: [] });
      setDraftText('');
      setDraftSurnames([]);
      setSurnameInput('');
    } finally {
      setIsLoading(false);
    }
  }, [tAbout, treeId]);

  useEffect(() => {
    if (!open) return;
    void loadAbout();
    setIsEditing(false);
  }, [open, loadAbout]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!modalRef.current) return;
      if (!modalRef.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [open, onClose]);

  const startEdit = () => {
    setDraftText(data?.about_text ?? '');
    setDraftSurnames(data?.main_surnames ?? []);
    setSurnameInput('');
    setErrorMessage(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setErrorMessage(null);
  };

  const commitSurnameInput = () => {
    const trimmed = surnameInput.trim();
    if (!trimmed) return;
    const exists = draftSurnames.some(
      (s) => s.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
    );
    if (!exists) {
      setDraftSurnames((prev) => [...prev, trimmed]);
    }
    setSurnameInput('');
  };

  const removeSurname = (index: number) => {
    setDraftSurnames((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSurnameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitSurnameInput();
    } else if (
      event.key === 'Backspace' &&
      surnameInput === '' &&
      draftSurnames.length > 0
    ) {
      removeSurname(draftSurnames.length - 1);
    }
  };

  const handleSave = () => {
    const pending = surnameInput.trim();
    const surnamesToSave = pending
      ? draftSurnames.some((s) => s.toLocaleLowerCase() === pending.toLocaleLowerCase())
        ? draftSurnames
        : [...draftSurnames, pending]
      : draftSurnames;

    const trimmedText = draftText.trim();
    const nextAboutText = trimmedText.length === 0 ? null : trimmedText;

    setErrorMessage(null);
    startSaving(async () => {
      try {
        const updated = await treesService.updateAbout(treeId, {
          about_text: nextAboutText,
          main_surnames: surnamesToSave,
        });
        setData(updated);
        setDraftText(updated.about_text ?? '');
        setDraftSurnames(updated.main_surnames);
        setSurnameInput('');
        setIsEditing(false);
      } catch (error) {
        const message = error instanceof ServiceError ? error.message : tAbout('saveFailed');
        setErrorMessage(message);
      }
    });
  };

  const body = useMemo(() => {
    if (isLoading || data == null) {
      return (
        <div className="py-8 text-center text-sm text-slate-500">
          {tCommon('loading')}
        </div>
      );
    }

    if (isEditing) {
      return (
        <FamilyAboutEditView
          draftText={draftText}
          onDraftTextChange={setDraftText}
          draftSurnames={draftSurnames}
          surnameInput={surnameInput}
          onSurnameInputChange={setSurnameInput}
          onSurnameInputCommit={commitSurnameInput}
          onSurnameRemove={removeSurname}
          onSurnameKeyDown={handleSurnameKeyDown}
          onSave={handleSave}
          onCancel={cancelEdit}
          isSaving={isSaving}
          errorMessage={errorMessage}
          labels={{
            aboutLabel: tAbout('aboutLabel'),
            aboutPlaceholder: tAbout('aboutPlaceholder'),
            mainSurnames: tAbout('mainSurnames'),
            surnamesPlaceholder: tAbout('surnamesPlaceholder'),
            surnamesHint: tAbout('surnamesHint'),
            removeSurname: tAbout('removeSurname'),
            save: t('save'),
            cancel: tCommon('cancel'),
          }}
        />
      );
    }

    return (
      <>
        {errorMessage && (
          <p className="mb-4 text-sm text-red-500" role="alert">
            {errorMessage}
          </p>
        )}
        <FamilyAboutReadView
          aboutText={data.about_text}
          mainSurnames={data.main_surnames}
          labels={{
            mainSurnames: tAbout('mainSurnames'),
            noAboutYet: tAbout('noAboutYet'),
            noSurnamesYet: tAbout('noSurnamesYet'),
          }}
        />
      </>
    );
  }, [
    canEdit,
    cancelEdit,
    commitSurnameInput,
    data,
    draftSurnames,
    draftText,
    errorMessage,
    handleSave,
    handleSurnameKeyDown,
    isEditing,
    isLoading,
    isSaving,
    removeSurname,
    surnameInput,
    t,
    tAbout,
    tCommon,
  ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
    >
      <div
        ref={modalRef}
        className="max-h-[min(90vh,720px)] w-full max-w-3xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tree-about-modal-title"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="tree-about-modal-title" className="text-base font-semibold text-slate-900">
            {t('title')}
          </h2>
          <div className="flex items-center gap-2">
            {canEdit && !isEditing && (
              <Button type="button" variant="secondary" size="sm" onClick={startEdit}>
                {tCommon('edit')}
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label={t('close')}
            >
              ✕
            </button>
          </div>
        </div>
        {body}
      </div>
    </div>
  );
}
