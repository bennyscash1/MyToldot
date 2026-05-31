'use client';

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useLocale, useTranslations } from 'next-intl';

import type { PersonPatch } from '@/features/family-tree/schemas/person.schema';
import type { PersonRow } from '../../lib/types';
import { getPersonProfileImageUrl } from '@/lib/images/get-person-profile-image-url';
import { normalizeExternalImageUrl, EXTERNAL_IMAGE_IMG_PROPS } from '@/lib/images/normalize-external-image-url';
import { addPersonPhotoUrlsBatchAction } from '@/server/actions/person-photo.actions';
import type { AiImageSelection } from './AiImageSearchModal';
import { PersonImagePicker } from './PersonImagePicker';
import { storageService } from '@/services/storage.service';
import { DateInput } from '@/components/ui/DateInput';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { coerceGregorianDate, parseGregorianDate } from '@/lib/dates/gregorian';
import { cn } from '@/lib/utils';
import { AiBioSearch, type AiBioResult } from './AiBioSearch';
import { PersonGalleryEditor } from './PersonGalleryEditor';
import type { PersonPhotoDTO } from '@/features/family-tree/lib/types';

const inputClass =
  'w-full rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-[#3e5045] focus:outline-none focus:ring-1 focus:ring-[#3e5045]/40';

function fullNameFromPerson(person: PersonRow): string {
  const he = [person.first_name_he, person.last_name_he].filter(Boolean).join(' ').trim();
  if (he) return he;
  return [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
}

function splitFullName(full: string): { first_name_he: string | null; last_name_he: string | null } {
  const t = full.trim();
  if (!t) return { first_name_he: null, last_name_he: null };
  const parts = t.split(/\s+/);
  if (parts.length === 1) return { first_name_he: parts[0], last_name_he: null };
  return { first_name_he: parts[0], last_name_he: parts.slice(1).join(' ') };
}

export interface PersonSidePanelProps {
  treeId: string;
  treeRouteCode: string;
  person: PersonRow;
  photos: PersonPhotoDTO[];
  photosLoading?: boolean;
  onPhotosChange: (next: PersonPhotoDTO[]) => void;
  canEdit: boolean;
  onClose: () => void;
  onSave: (patch: PersonPatch) => Promise<void>;
  onDelete?: () => Promise<void>;
  canDelete?: boolean;
  /** When set, show “add parent / spouse / child” actions (editors only). */
  onAddParent?: () => void | Promise<void>;
  onAddSpouse?: () => void | Promise<void>;
  onAddChild?: () => void | Promise<void>;
  isSaving: boolean;
  errorMessage: string | null;
  /** When set, the matching field is focused + scrolled into view on open. */
  initialFocusField?: 'bio';
}

export function PersonSidePanel({
  treeId,
  treeRouteCode,
  person,
  photos,
  photosLoading = false,
  onPhotosChange,
  canEdit,
  onClose,
  onSave,
  onDelete,
  canDelete = false,
  onAddParent,
  onAddSpouse,
  onAddChild,
  isSaving,
  errorMessage,
  initialFocusField,
}: PersonSidePanelProps) {
  const locale = useLocale();
  const panelDir = locale === 'he' ? 'rtl' : 'ltr';
  const tPerson = useTranslations('person');
  const tImage = useTranslations('personImage');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fullName, setFullName] = useState(() => fullNameFromPerson(person));
  const [birthDate, setBirthDate] = useState<Date | null>(() =>
    coerceGregorianDate(person.birth_date),
  );
  const [isDeceased, setIsDeceased] = useState<boolean>(person.is_deceased);
  const [deathDate, setDeathDate] = useState<Date | null>(() =>
    person.is_deceased ? coerceGregorianDate(person.death_date) : null,
  );
  const [bio, setBio] = useState(() => person.bio ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const [stagedProfileImageUrl, setStagedProfileImageUrl] = useState<string | null>(null);
  const [stagedGalleryPhotos, setStagedGalleryPhotos] = useState<
    Array<{ imageUrl: string; caption?: string }>
  >([]);
  const aliveBtnRef = useRef<HTMLButtonElement>(null);
  const deceasedBtnRef = useRef<HTMLButtonElement>(null);
  const bioTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialFocusField !== 'bio') return;
    // Wait one frame so the drawer slide-in animation doesn't fight focus.
    const id = requestAnimationFrame(() => {
      bioTextareaRef.current?.focus();
      bioTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(id);
  }, [person.id, initialFocusField]);

  useEffect(() => {
    setFullName(fullNameFromPerson(person));
    setBirthDate(coerceGregorianDate(person.birth_date));
    setIsDeceased(person.is_deceased);
    setDeathDate(
      person.is_deceased ? coerceGregorianDate(person.death_date) : null,
    );
    setBio(person.bio ?? '');
    setConfirmDelete(false);
    setLocalError(null);
    setStagedProfileImageUrl(null);
    setStagedGalleryPhotos([]);
  }, [person]);

  const selectAlive = () => {
    setIsDeceased(false);
    setDeathDate(null);
  };
  const selectDeceased = () => {
    setIsDeceased(true);
  };

  // Apply an AI biography result: fill the bio text and, when the search found
  // dates, pre-fill the birth/death fields too. A death date also flips the
  // life-status toggle to "deceased". Year-only values resolve to Jan 1 of that
  // year (the picker has no year-only mode); the prose carries the precise text.
  const handleApplyAiBio = (result: AiBioResult) => {
    setBio(result.narrative);
    if (result.birthDate) {
      const parsed = parseGregorianDate(result.birthDate);
      if (parsed) setBirthDate(parsed);
    }
    if (result.deathDate) {
      const parsed = parseGregorianDate(result.deathDate);
      if (parsed) {
        setIsDeceased(true);
        setDeathDate(parsed);
      }
    }
  };
  const onRadioKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    if (isDeceased) {
      selectAlive();
      aliveBtnRef.current?.focus();
    } else {
      selectDeceased();
      deceasedBtnRef.current?.focus();
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const previewPerson = stagedProfileImageUrl
    ? { ...person, profile_image_url: stagedProfileImageUrl, profile_image: null }
    : person;
  const photoSrc = stagedProfileImageUrl
    ? normalizeExternalImageUrl(stagedProfileImageUrl)
    : getPersonProfileImageUrl(previewPerson);

  const defaultSearchContext = fullNameFromPerson(person);

  const birthDateLabel = person.birth_date
    ? new Date(person.birth_date).getFullYear().toString()
    : undefined;
  const deathDateLabel =
    person.is_deceased && person.death_date
      ? new Date(person.death_date).getFullYear().toString()
      : undefined;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const { first_name_he, last_name_he } = splitFullName(fullName);
    const patch: PersonPatch = {
      first_name_he: first_name_he ?? undefined,
      last_name_he: last_name_he ?? undefined,
      birth_date: birthDate,
      is_deceased: isDeceased,
      death_date: isDeceased ? deathDate : null,
      bio: bio.trim() || null,
    };

    if (stagedProfileImageUrl) {
      patch.profile_image_url = stagedProfileImageUrl;
      patch.profile_image = null;
    }

    await onSave(patch);

    if (stagedProfileImageUrl) {
      setStagedProfileImageUrl(null);
    }

    if (stagedGalleryPhotos.length > 0) {
      const result = await addPersonPhotoUrlsBatchAction({
        treeId,
        personId: person.id,
        shortCode: treeRouteCode,
        photos: stagedGalleryPhotos,
      });
      if (!result.ok) {
        setLocalError(result.error.message);
        return;
      }
      onPhotosChange([...photos, ...result.data]);
      setStagedGalleryPhotos([]);
    }
  };

  const onPickImage = async (file: File) => {
    setLocalError(null);
    setStagedProfileImageUrl(null);
    try {
      const { path } = await storageService.uploadProfileImage(file, treeId, person.id);
      await onSave({ profile_image: path, profile_image_url: null });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : tImage('uploadFailed'));
    }
  };

  const handleProfileUrl = (url: string) => {
    setStagedProfileImageUrl(url);
  };

  const handleProfileAi = (selection: AiImageSelection) => {
    if (selection.profileUrl) {
      setStagedProfileImageUrl(selection.profileUrl);
    }
    if (selection.galleryItems?.length) {
      setStagedGalleryPhotos((prev) => [...prev, ...selection.galleryItems!]);
    }
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-900/25"
        aria-label="סגור לוח"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 end-0 z-50 flex w-full max-w-md animate-[toldot-drawer_0.28s_ease-out] flex-col border-s border-slate-200/80 bg-[#f4f3e9] shadow-2xl"
        dir={panelDir}
      >
        <div className="relative flex shrink-0 items-center justify-center border-b border-slate-200/60 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-md p-2 text-slate-500 transition hover:bg-black/5 hover:text-slate-800"
            aria-label="סגור"
          >
            ✕
          </button>
          <h2 className="text-lg font-semibold text-slate-900">עריכת פרטים</h2>
        </div>

        <LoadingOverlay isPending={isSaving} variant="saving" className="flex min-h-0 flex-1 flex-col">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
            <div className="mb-4 flex flex-col items-center">
              <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoSrc}
                  alt=""
                  className="h-48 w-48 object-cover object-top bg-slate-100"
                  {...(person.profile_image_url || stagedProfileImageUrl
                    ? EXTERNAL_IMAGE_IMG_PROPS
                    : {})}
                />
              </div>
              {canEdit ? (
                <PersonImagePicker
                  mode="profile"
                  personId={person.id}
                  personName={fullNameFromPerson(person)}
                  birthDateLabel={birthDateLabel}
                  deathDateLabel={deathDateLabel}
                  defaultSearchContext={defaultSearchContext}
                  disabled={isSaving}
                  onUploadFile={onPickImage}
                  onUrlSelected={handleProfileUrl}
                  onAiSelected={handleProfileAi}
                  className="mt-2"
                />
              ) : null}
            </div>

            <PersonGalleryEditor
              treeId={treeId}
              personId={person.id}
              treeRouteCode={treeRouteCode}
              photos={photos}
              photosLoading={photosLoading}
              onPhotosChange={onPhotosChange}
              canEdit={canEdit}
              personName={fullNameFromPerson(person)}
              birthDateLabel={birthDateLabel}
              deathDateLabel={deathDateLabel}
              defaultSearchContext={defaultSearchContext}
              stagedGalleryPhotos={stagedGalleryPhotos}
              onStageGalleryPhotos={(items) =>
                setStagedGalleryPhotos((prev) => [...prev, ...items])
              }
              onRemoveStagedGalleryPhoto={(index) =>
                setStagedGalleryPhotos((prev) => prev.filter((_, i) => i !== index))
              }
            />

            <label className="mb-3 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">שם מלא</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
                autoComplete="name"
              />
            </label>

            <label className="mb-3 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">תאריך לידה</span>
              <DateInput
                value={birthDate}
                onChange={setBirthDate}
                className={inputClass}
              />
              {person.birth_date_hebrew ? (
                <span dir="rtl" className="mt-1 text-xs text-gray-500">
                  {person.birth_date_hebrew}
                </span>
              ) : null}
            </label>

            <div className="mb-3 flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-600">{tPerson('lifeStatus')}</span>
              <div
                role="radiogroup"
                aria-label={tPerson('lifeStatus')}
                className="inline-flex w-full rounded-lg border border-gray-200 bg-white p-0.5"
              >
                <button
                  ref={aliveBtnRef}
                  type="button"
                  role="radio"
                  aria-checked={!isDeceased}
                  tabIndex={isDeceased ? -1 : 0}
                  onClick={selectAlive}
                  onKeyDown={onRadioKeyDown}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 text-sm transition-all duration-200',
                    !isDeceased
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-200',
                  )}
                >
                  {tPerson('alive')}
                </button>
                <button
                  ref={deceasedBtnRef}
                  type="button"
                  role="radio"
                  aria-checked={isDeceased}
                  tabIndex={isDeceased ? 0 : -1}
                  onClick={selectDeceased}
                  onKeyDown={onRadioKeyDown}
                  className={cn(
                    'flex-1 rounded-md px-3 py-1.5 text-sm transition-all duration-200',
                    isDeceased
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-200',
                  )}
                >
                  {tPerson('deceased')}
                </button>
              </div>
            </div>

            <div
              className={cn(
                'mb-3 grid transition-all duration-200',
                isDeceased
                  ? 'grid-rows-[1fr] overflow-visible opacity-100'
                  : 'grid-rows-[0fr] overflow-hidden opacity-0',
              )}
              aria-hidden={!isDeceased}
            >
              <div className="min-h-0">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-slate-600">
                    {tPerson('deathDateOptional')}
                  </span>
                  <DateInput
                    value={deathDate}
                    onChange={setDeathDate}
                    className={inputClass}
                    tabIndex={isDeceased ? 0 : -1}
                  />
                  {person.death_date_hebrew ? (
                    <span dir="rtl" className="mt-1 text-xs text-gray-500">
                      {person.death_date_hebrew}
                    </span>
                  ) : null}
                </label>
              </div>
            </div>

            <label className="mb-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">ביוגרפיה</span>
              <textarea
                ref={bioTextareaRef}
                rows={5}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className={`${inputClass} resize-y min-h-[120px]`}
              />
            </label>

            <AiBioSearch personId={person.id} onApply={handleApplyAiBio} />

            {(onAddParent || onAddSpouse || onAddChild) && (
              <div className="mb-4 flex flex-col gap-2">
                {onAddParent && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void onAddParent()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/60 bg-[#fcdcd8] px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-[#fbc8c2] disabled:opacity-50"
                  >
                    <span className="text-lg leading-none">↑</span>
                    הוספת הורה
                  </button>
                )}
                {onAddSpouse && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void onAddSpouse()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/60 bg-[#fcdcd8] px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-[#fbc8c2] disabled:opacity-50"
                  >
                    <span className="text-lg leading-none">＋</span>
                    הוספת בן/בת זוג
                  </button>
                )}
                {onAddChild && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void onAddChild()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/60 bg-[#fcdcd8] px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-[#fbc8c2] disabled:opacity-50"
                  >
                    <span className="text-lg leading-none">☺</span>
                    הוספת ילד
                  </button>
                )}
              </div>
            )}

            {(localError || errorMessage) && (
              <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {localError ?? errorMessage}
              </div>
            )}

            {canDelete && onDelete && (
              <div className="border-t border-slate-200/60 pt-4">
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full rounded-lg border border-rose-200 bg-rose-50/80 px-3 py-2 text-sm text-rose-800 hover:bg-rose-100"
                  >
                    מחיקת אדם מהעץ
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-rose-800">למחוק לצמיתות? לא ניתן לבטל.</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                      >
                        ביטול
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete()}
                        disabled={isSaving}
                        className="flex-1 rounded-lg bg-rose-600 px-3 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200/60 bg-[#f4f3e9] p-4 pt-3">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-xl bg-[#3e5045] py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#323d36] disabled:opacity-50"
            >
              {isSaving ? 'שומר…' : 'שמירה'}
            </button>
          </div>
        </form>
        </LoadingOverlay>
      </aside>
    </>
  );
}
