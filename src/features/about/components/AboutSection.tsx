'use client';

import {
  useState,
  useTransition,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { ServiceError } from '@/services/api.client';
import { treesService } from '@/services/trees.service';
import type { TreeAboutDto } from '@/types/api';
import {
  FamilyAboutEditView,
  FamilyAboutReadView,
} from '@/features/about/components/FamilyAboutContent';

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

  const commitSurnameInput = (rawInput?: string) => {
    const source = rawInput ?? surnameInput;
    const segments = source
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (segments.length === 0) {
      setSurnameInput('');
      return;
    }
    setDraftSurnames((prev) => {
      const next = [...prev];
      const seen = new Set(next.map((s) => s.toLocaleLowerCase()));
      for (const seg of segments) {
        const key = seg.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(seg);
      }
      return next;
    });
    setSurnameInput('');
  };

  const removeSurname = (index: number) => {
    setDraftSurnames((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSurnameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitSurnameInput();
    }
  };

  const handleSurnamePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    if (!pasted.includes(',')) return;
    event.preventDefault();
    commitSurnameInput(surnameInput + pasted);
  };

  const handleSave = () => {
    // Capture any pending input so users don't lose typed-but-unconfirmed text,
    // splitting on comma so a typed "a, b, c" still becomes three chips on save.
    const pendingSegments = surnameInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const surnamesToSave = [...draftSurnames];
    if (pendingSegments.length > 0) {
      const seen = new Set(surnamesToSave.map((s) => s.toLocaleLowerCase()));
      for (const seg of pendingSegments) {
        const key = seg.toLocaleLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        surnamesToSave.push(seg);
      }
    }

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
        <FamilyAboutEditView
          draftText={draftText}
          onDraftTextChange={setDraftText}
          draftSurnames={draftSurnames}
          surnameInput={surnameInput}
          onSurnameInputChange={setSurnameInput}
          onSurnameInputCommit={() => commitSurnameInput()}
          onSurnameRemove={removeSurname}
          onSurnameKeyDown={handleSurnameKeyDown}
          onSurnamePaste={handleSurnamePaste}
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
        <FamilyAboutReadView
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
