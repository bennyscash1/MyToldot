'use client';

import {
  useEffect,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ServiceError } from '@/services/api.client';
import { treesService } from '@/services/trees.service';

type TreeAboutBasicsEditorProps = {
  treeId: string;
  initialName: string;
  initialDescription: string | null;
  initialMainSurnames: string[];
  canEdit: boolean;
};

function splitDescriptionParagraphs(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function TreeAboutBasicsEditor({
  treeId,
  initialName,
  initialDescription,
  initialMainSurnames,
  canEdit,
}: TreeAboutBasicsEditorProps) {
  const t = useTranslations('treeFamilyAboutPage');
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');
  const [draftTags, setDraftTags] = useState<string[]>(initialMainSurnames);
  const [tagInput, setTagInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, startSaving] = useTransition();

  useEffect(() => {
    setName(initialName);
    setDescription(initialDescription ?? '');
    setDraftTags(initialMainSurnames);
  }, [initialName, initialDescription, initialMainSurnames]);

  const commitTagInput = () => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    const exists = draftTags.some(
      (s) => s.toLocaleLowerCase() === trimmed.toLocaleLowerCase(),
    );
    if (!exists) {
      setDraftTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  };

  const removeTag = (index: number) => {
    setDraftTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTagKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitTagInput();
    } else if (
      event.key === 'Backspace' &&
      tagInput === '' &&
      draftTags.length > 0
    ) {
      removeTag(draftTags.length - 1);
    }
  };

  function handleSave() {
    setErrorMessage(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage(t('nameRequired'));
      return;
    }

    const pending = tagInput.trim();
    const tagsToSave = pending
      ? draftTags.some((s) => s.toLocaleLowerCase() === pending.toLocaleLowerCase())
        ? draftTags
        : [...draftTags, pending]
      : draftTags;

    startSaving(async () => {
      try {
        await treesService.update(treeId, {
          name: trimmedName,
          description: description.trim() || null,
        });
        await treesService.updateAbout(treeId, {
          main_surnames: tagsToSave,
        });
        setTagInput('');
        setDraftTags(tagsToSave);
        router.refresh();
      } catch (err) {
        setErrorMessage(
          err instanceof ServiceError ? err.message : t('saveFailed'),
        );
      }
    });
  }

  if (!canEdit) {
    const descriptionParagraphs = splitDescriptionParagraphs(initialDescription);
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t('treeNameHeading')}
          </h2>
          <p className="mt-2 text-slate-800">{initialName}</p>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t('familyTagsHeading')}
          </h2>
          {initialMainSurnames.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-2" role="list">
              {initialMainSurnames.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm italic text-slate-400">{t('noTagsYet')}</p>
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {t('descriptionHeading')}
          </h2>
          <div className="prose prose-slate mt-3 max-w-none">
            {descriptionParagraphs.length > 0 ? (
              descriptionParagraphs.map((paragraph, idx) => (
                <p key={idx} className="whitespace-pre-line text-slate-700">
                  {paragraph}
                </p>
              ))
            ) : (
              <p className="italic text-slate-400">{t('noDescriptionYet')}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Input
        label={t('treeNameLabel')}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setErrorMessage(null);
        }}
        disabled={isSaving}
        maxLength={120}
        autoComplete="off"
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-gray-700">
          {t('familyTagsHeading')}
        </span>
        {draftTags.length > 0 && (
          <ul className="flex flex-wrap gap-2" role="list">
            {draftTags.map((tag, idx) => (
              <li
                key={`${tag}-${idx}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"
              >
                <span>{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(idx)}
                  disabled={isSaving}
                  aria-label={`${t('removeTag')}: ${tag}`}
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
          aria-label={t('familyTagsHeading')}
          value={tagInput}
          onChange={(e) => {
            setTagInput(e.target.value);
            setErrorMessage(null);
          }}
          onKeyDown={handleTagKeyDown}
          onBlur={commitTagInput}
          placeholder={t('familyTagsPlaceholder')}
          hint={t('familyTagsHint')}
          disabled={isSaving}
          maxLength={100}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="tree-about-description" className="text-sm font-medium text-gray-700">
          {t('descriptionLabel')}
        </label>
        <textarea
          id="tree-about-description"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setErrorMessage(null);
          }}
          placeholder={t('descriptionPlaceholder')}
          rows={8}
          maxLength={2000}
          disabled={isSaving}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-150 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:cursor-not-allowed disabled:bg-gray-50"
        />
      </div>

      {errorMessage && (
        <p className="text-sm text-red-500" role="alert">
          {errorMessage}
        </p>
      )}

      <Button type="button" onClick={handleSave} isLoading={isSaving} disabled={isSaving}>
        {t('save')}
      </Button>
    </div>
  );
}
