'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { PersonPatch } from '@/features/family-tree/schemas/person.schema';
import type { PersonRow } from '../../lib/types';
import { profileImagePublicUrl } from '@/lib/supabase/public-url';
import { storageService } from '@/services/storage.service';

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

function toDateInput(d: Date | string | null | undefined): string {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export interface PersonSidePanelProps {
  treeId: string;
  person: PersonRow;
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
}

export function PersonSidePanel({
  treeId,
  person,
  onClose,
  onSave,
  onDelete,
  canDelete = false,
  onAddParent,
  onAddSpouse,
  onAddChild,
  isSaving,
  errorMessage,
}: PersonSidePanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [fullName, setFullName] = useState(() => fullNameFromPerson(person));
  const [birthDate, setBirthDate] = useState(() => toDateInput(person.birth_date));
  const [deathDate, setDeathDate] = useState(() => toDateInput(person.death_date));
  const [bio, setBio] = useState(() => person.bio ?? '');
  const [localError, setLocalError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFullName(fullNameFromPerson(person));
    setBirthDate(toDateInput(person.birth_date));
    setDeathDate(toDateInput(person.death_date));
    setBio(person.bio ?? '');
    setConfirmDelete(false);
    setLocalError(null);
  }, [person]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const previewUrl = profileImagePublicUrl(person.profile_image) ?? person.profile_image;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const { first_name_he, last_name_he } = splitFullName(fullName);
    const patch: PersonPatch = {
      first_name_he: first_name_he ?? undefined,
      last_name_he: last_name_he ?? undefined,
      birth_date: birthDate ? new Date(birthDate) : null,
      death_date: deathDate ? new Date(deathDate) : null,
      bio: bio.trim() || null,
      profile_image: person.profile_image,
    };
    await onSave(patch);
  };

  const onPickImage = async (file: File) => {
    setLocalError(null);
    try {
      const { path } = await storageService.uploadProfileImage(file, treeId, person.id);
      await onSave({ profile_image: path });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'העלאה נכשלה');
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
        dir="rtl"
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

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
            <div className="mb-4 flex flex-col items-center">
              <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="" className="h-48 w-48 object-cover" />
                ) : (
                  <div className="flex h-48 w-48 items-center justify-center bg-slate-100 text-4xl text-slate-400">
                    {(fullName.trim()[0] ?? '?').toUpperCase()}
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  ev.target.value = '';
                  if (f) void onPickImage(f);
                }}
              />
              <button
                type="button"
                className="mt-2 text-sm font-medium text-[#3e5045] underline-offset-2 hover:underline"
                onClick={() => fileRef.current?.click()}
              >
                החלף תמונה
              </button>
            </div>

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

            <div className="mb-3 grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">תאריך לידה</span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={inputClass}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600">תאריך פטירה</span>
                <input
                  type="date"
                  value={deathDate}
                  onChange={(e) => setDeathDate(e.target.value)}
                  className={inputClass}
                />
              </label>
            </div>

            <label className="mb-4 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-600">ביוגרפיה</span>
              <textarea
                rows={5}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className={`${inputClass} resize-y min-h-[120px]`}
              />
            </label>

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
      </aside>
    </>
  );
}
