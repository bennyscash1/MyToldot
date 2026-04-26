'use client';

import { useState, useTransition, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ServiceError } from '@/services/api.client';
import { treesService } from '@/services/trees.service';
import type { TreeAboutDto } from '@/types/api';

// ──────────────────────────────────────────────
// AboutSection — client-side renderer for the About page.
//
// Two modes:
//  - read   → shows about_text paragraphs + main_surnames chips
//  - edit   → textarea + chip-input + Save / Cancel
//
// Persists via treesService.updateAbout (PATCH /api/v1/trees/:id/about).
// ──────────────────────────────────────────────

interface AboutSectionProps {
  treeId: string;
  initial: TreeAboutDto;
  canEdit: boolean;
}

export function AboutSection({ treeId, initial, canEdit }: AboutSectionProps) {
  const t = useTranslations('aboutPage');
  const tCommon = useTranslations('common');

  const [data, setData] = useState<TreeAboutDto>(initial);
  const [isEditing, setIsEditing] = useState(false);
  const [draftText, setDraftText] = useState(initial.about_text ?? '');
  const [draftSurnames, setDraftSurnames] = useState<string[]>(initial.main_surnames);
  const [surnameInput, setSurnameInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  const startEdit = () => {
    setDraftText(data.about_text ?? '');
    setDraftSurnames(data.main_surnames);
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
      // Backspace on an empty input pops the last chip — common chip-input UX.
      removeSurname(draftSurnames.length - 1);
    }
  };

  const handleSave = () => {
    // Capture the current pending surname so users don't lose typed-but-unconfirmed input.
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
        const message =
          error instanceof ServiceError ? error.message : t('saveFailed');
        setErrorMessage(message);
      }
    });
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">{t('description')}</p>
        </div>
        {canEdit && !isEditing && (
          <Button variant="secondary" size="sm" onClick={startEdit}>
            {t('editAbout')}
          </Button>
        )}
      </header>

      {isEditing ? (
        <EditView
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
            aboutLabel: t('aboutLabel'),
            aboutPlaceholder: t('aboutPlaceholder'),
            mainSurnames: t('mainSurnames'),
            surnamesPlaceholder: t('surnamesPlaceholder'),
            surnamesHint: t('surnamesHint'),
            removeSurname: t('removeSurname'),
            save: t('saveAbout'),
            cancel: tCommon('cancel'),
          }}
        />
      ) : (
        <ReadView
          aboutText={data.about_text}
          mainSurnames={data.main_surnames}
          labels={{
            mainSurnames: t('mainSurnames'),
            noAboutYet: t('noAboutYet'),
            noSurnamesYet: t('noSurnamesYet'),
          }}
        />
      )}
    </section>
  );
}

// ── Read mode ─────────────────────────────────

interface ReadViewProps {
  aboutText: string | null;
  mainSurnames: string[];
  labels: {
    mainSurnames: string;
    noAboutYet: string;
    noSurnamesYet: string;
  };
}

function ReadView({ aboutText, mainSurnames, labels }: ReadViewProps) {
  // Split paragraphs on blank lines for readable rendering.
  const paragraphs = aboutText
    ? aboutText.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    : [];

  return (
    <div className="space-y-8">
      <div className="prose prose-slate max-w-none">
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph, idx) => (
            <p key={idx} className="whitespace-pre-line text-gray-700">
              {paragraph}
            </p>
          ))
        ) : (
          <p className="italic text-gray-400">{labels.noAboutYet}</p>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          {labels.mainSurnames}
        </h2>
        {mainSurnames.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2" role="list">
            {mainSurnames.map((surname) => (
              <li
                key={surname}
                className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"
              >
                {surname}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm italic text-gray-400">
            {labels.noSurnamesYet}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Edit mode ─────────────────────────────────

interface EditViewProps {
  draftText: string;
  onDraftTextChange: (value: string) => void;
  draftSurnames: string[];
  surnameInput: string;
  onSurnameInputChange: (value: string) => void;
  onSurnameInputCommit: () => void;
  onSurnameRemove: (index: number) => void;
  onSurnameKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  errorMessage: string | null;
  labels: {
    aboutLabel: string;
    aboutPlaceholder: string;
    mainSurnames: string;
    surnamesPlaceholder: string;
    surnamesHint: string;
    removeSurname: string;
    save: string;
    cancel: string;
  };
}

function EditView({
  draftText,
  onDraftTextChange,
  draftSurnames,
  surnameInput,
  onSurnameInputChange,
  onSurnameInputCommit,
  onSurnameRemove,
  onSurnameKeyDown,
  onSave,
  onCancel,
  isSaving,
  errorMessage,
  labels,
}: EditViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="about-text"
          className="text-sm font-medium text-gray-700"
        >
          {labels.aboutLabel}
        </label>
        <textarea
          id="about-text"
          value={draftText}
          onChange={(e) => onDraftTextChange(e.target.value)}
          placeholder={labels.aboutPlaceholder}
          rows={8}
          maxLength={10_000}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-150 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:bg-gray-50"
          disabled={isSaving}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">
          {labels.mainSurnames}
        </span>

        {draftSurnames.length > 0 && (
          <ul className="flex flex-wrap gap-2" role="list">
            {draftSurnames.map((surname, idx) => (
              <li
                key={`${surname}-${idx}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"
              >
                <span>{surname}</span>
                <button
                  type="button"
                  onClick={() => onSurnameRemove(idx)}
                  disabled={isSaving}
                  aria-label={`${labels.removeSurname}: ${surname}`}
                  className="rounded-full p-0.5 text-emerald-600 transition-colors hover:bg-emerald-100 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.28 3.22a.75.75 0 00-1.06 1.06L8.94 10l-5.72 5.72a.75.75 0 101.06 1.06L10 11.06l5.72 5.72a.75.75 0 101.06-1.06L11.06 10l5.72-5.72a.75.75 0 00-1.06-1.06L10 8.94 4.28 3.22z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        <Input
          aria-label={labels.mainSurnames}
          value={surnameInput}
          onChange={(e) => onSurnameInputChange(e.target.value)}
          onKeyDown={onSurnameKeyDown}
          onBlur={onSurnameInputCommit}
          placeholder={labels.surnamesPlaceholder}
          hint={labels.surnamesHint}
          disabled={isSaving}
          maxLength={100}
        />
      </div>

      {errorMessage && (
        <p className="text-sm text-red-500" role="alert">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          onClick={onSave}
          isLoading={isSaving}
          disabled={isSaving}
        >
          {labels.save}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isSaving}
        >
          {labels.cancel}
        </Button>
      </div>
    </div>
  );
}
