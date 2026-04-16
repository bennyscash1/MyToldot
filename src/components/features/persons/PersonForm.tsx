'use client';

import { useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Input }  from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { cn }     from '@/lib/utils';
import { personsService }  from '@/services/persons.service';
import { storageService }  from '@/services/storage.service';
import { ServiceError }    from '@/services/api.client';
import { StorageError }    from '@/services/storage.service';
import type { PersonDto }  from '@/types/api';

// ──────────────────────────────────────────────
// PersonForm — Client Component
//
// Responsibilities:
//  1. Collect all person fields (bilingual)
//  2. Preview and upload profile photo
//  3. POST /api/v1/persons → PATCH with photo path
//  4. Report success / error to parent via callbacks
//
// NOTE: marriageDate is a UX field only. It is NOT
//   stored on Person (it belongs on a Relationship).
//   It is shown with a hint and will be forwarded to
//   the relationship creation flow in Phase 5.
// ──────────────────────────────────────────────

export interface PersonFormProps {
  treeId:      string;
  /** Called with the created PersonDto on success. */
  onSuccess:   (person: PersonDto) => void;
  /** Called when the user clicks Cancel. */
  onCancel:    () => void;
  /** When true, display the strict-lineage banner. */
  strictMode?: boolean;
}

type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';

interface FormState {
  first_name:    string;
  last_name:     string;
  first_name_he: string;
  last_name_he:  string;
  gender:        Gender;
  birth_date:    string;
  death_date:    string;
  birth_place:   string;
  bio:           string;
  marriage_date: string; // UI only
}

const INITIAL_STATE: FormState = {
  first_name:    '',
  last_name:     '',
  first_name_he: '',
  last_name_he:  '',
  gender:        'UNKNOWN',
  birth_date:    '',
  death_date:    '',
  birth_place:   '',
  bio:           '',
  marriage_date: '',
};

const GENDER_OPTIONS: { value: Gender; labelKey: string }[] = [
  { value: 'MALE',    labelKey: 'genderMale'    },
  { value: 'FEMALE',  labelKey: 'genderFemale'  },
  { value: 'OTHER',   labelKey: 'genderOther'   },
  { value: 'UNKNOWN', labelKey: 'genderUnknown' },
];

export function PersonForm({ treeId, onSuccess, onCancel, strictMode }: PersonFormProps) {
  const t = useTranslations('personForm');
  const tCommon = useTranslations('common');

  // ── Form state ──
  const [form, setForm] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  // ── Image state ──
  const [imageFile, setImageFile]       = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Submission state ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError]   = useState<string | null>(null);

  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────

  const setField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    },
    [],
  );

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const clearImage = useCallback(() => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [imagePreview]);

  function validate(): boolean {
    const newErrors: typeof errors = {};
    if (!form.first_name.trim()) {
      newErrors.first_name = t('errorRequired');
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // ─────────────────────────────────────────────
  // Submit
  // ─────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      // Step 1: Create the person record (no image yet).
      const { person } = await personsService.create({
        tree_id:        treeId,
        first_name:     form.first_name.trim(),
        last_name:      form.last_name.trim()      || undefined,
        first_name_he:  form.first_name_he.trim()  || undefined,
        last_name_he:   form.last_name_he.trim()   || undefined,
        gender:         form.gender,
        birth_date:     form.birth_date            || undefined,
        death_date:     form.death_date            || undefined,
        birth_place:    form.birth_place.trim()    || undefined,
        bio:            form.bio.trim()            || undefined,
        // marriage_date is form-only; not sent to the API in this phase
      });

      // Step 2: Upload profile image if selected, then link it.
      if (imageFile) {
        try {
          const { path } = await storageService.uploadProfileImage(
            imageFile,
            treeId,
            person.id,
          );
          await personsService.update(person.id, { profile_image: path });
          person.profile_image = path;
        } catch (uploadErr) {
          // Photo upload failed — person was still saved. Surface a non-fatal warning.
          console.warn('[PersonForm] Photo upload failed:', uploadErr);
          setSubmitError(t('errorUpload'));
          // We still call onSuccess because the person record is valid.
        }
      }

      onSuccess(person);
    } catch (err) {
      if (err instanceof ServiceError) {
        setSubmitError(err.message);
      } else {
        setSubmitError(t('errorGeneric'));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">

      {/* ── Strict-mode banner ── */}
      {strictMode && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
            className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
          </svg>
          {t('strictModeWarning')}
        </div>
      )}

      {/* ── Profile Photo ── */}
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-gray-700">
          {t('sectionPhoto')}
        </legend>
        <div className="flex flex-col items-center gap-3">
          {/* Avatar / preview */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'relative flex h-24 w-24 items-center justify-center overflow-hidden',
              'rounded-full border-2 border-dashed transition-colors',
              imagePreview
                ? 'border-transparent'
                : 'border-gray-300 bg-gray-50 hover:border-emerald-400 hover:bg-emerald-50',
            )}
            aria-label={imagePreview ? t('changePhoto') : t('uploadPhoto')}
          >
            {imagePreview ? (
              <Image
                src={imagePreview}
                alt={t('photoPreview')}
                fill
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"
                className="h-8 w-8 text-gray-400" aria-hidden="true">
                <path fillRule="evenodd" d="M18.685 19.097A9.723 9.723 0 0021.75 12c0-5.385-4.365-9.75-9.75-9.75S2.25 6.615 2.25 12a9.723 9.723 0 003.065 7.097A9.716 9.716 0 0012 21.75a9.716 9.716 0 006.685-2.653zm-12.54-1.285A7.486 7.486 0 0112 15a7.486 7.486 0 015.855 2.812A8.224 8.224 0 0112 20.25a8.224 8.224 0 01-5.855-2.438zM15.75 9a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" clipRule="evenodd"/>
              </svg>
            )}
          </button>

          {/* Upload / remove actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
            >
              {imagePreview ? t('changePhoto') : t('uploadPhoto')}
            </button>
            {imagePreview && (
              <>
                <span className="text-gray-300">·</span>
                <button
                  type="button"
                  onClick={clearImage}
                  className="text-xs font-medium text-red-500 hover:text-red-600"
                >
                  {t('removePhoto')}
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-gray-400">{t('uploadPhotoHint')}</p>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={handleImageChange}
          aria-hidden="true"
        />
      </fieldset>

      {/* ── Identity ── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold text-gray-700">
          {t('sectionIdentity')}
        </legend>

        {/* Names — EN / HE side by side */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label={t('firstName')}
            placeholder={t('firstNamePlaceholder')}
            value={form.first_name}
            onChange={(e) => setField('first_name', e.target.value)}
            error={errors.first_name}
            required
            autoComplete="given-name"
          />
          <Input
            label={t('firstNameHe')}
            placeholder={t('firstNameHePlaceholder')}
            value={form.first_name_he}
            onChange={(e) => setField('first_name_he', e.target.value)}
            forceRtl
          />
          <Input
            label={t('lastName')}
            placeholder={t('lastNamePlaceholder')}
            value={form.last_name}
            onChange={(e) => setField('last_name', e.target.value)}
            autoComplete="family-name"
          />
          <Input
            label={t('lastNameHe')}
            placeholder={t('lastNameHePlaceholder')}
            value={form.last_name_he}
            onChange={(e) => setField('last_name_he', e.target.value)}
            forceRtl
          />
        </div>

        {/* Gender toggle */}
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-700">{t('gender')}</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('gender')}>
            {GENDER_OPTIONS.map(({ value, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => setField('gender', value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                  form.gender === value
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                )}
                aria-pressed={form.gender === value}
              >
                {t(labelKey as Parameters<typeof t>[0])}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      {/* ── Dates & Places ── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold text-gray-700">
          {t('sectionDates')}
        </legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            type="date"
            label={t('birthDate')}
            value={form.birth_date}
            onChange={(e) => setField('birth_date', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
          <Input
            type="date"
            label={t('deathDate')}
            value={form.death_date}
            onChange={(e) => setField('death_date', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>
        <Input
          label={t('birthPlace')}
          placeholder={t('birthPlacePlaceholder')}
          value={form.birth_place}
          onChange={(e) => setField('birth_place', e.target.value)}
        />
      </fieldset>

      {/* ── Additional Info ── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-1 text-sm font-semibold text-gray-700">
          {t('sectionAdditional')}
        </legend>

        <Input
          type="date"
          label={t('marriageDate')}
          hint={t('marriageDateHint')}
          value={form.marriage_date}
          onChange={(e) => setField('marriage_date', e.target.value)}
        />

        {/* Notes / bio — textarea via className override trick */}
        <div className="flex flex-col gap-1">
          <label htmlFor="person-bio" className="text-sm font-medium text-gray-700">
            {t('bio')}
          </label>
          <textarea
            id="person-bio"
            rows={3}
            placeholder={t('bioPlaceholder')}
            value={form.bio}
            onChange={(e) => setField('bio', e.target.value)}
            className={cn(
              'w-full resize-y rounded-lg border border-gray-300 px-3 py-2',
              'text-sm text-gray-900 placeholder:text-gray-400',
              'focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400',
              'transition-colors duration-150',
            )}
          />
        </div>
      </fieldset>

      {/* ── Submit error ── */}
      {submitError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {submitError}
        </p>
      )}

      {/* ── Footer actions ── */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-100 pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
