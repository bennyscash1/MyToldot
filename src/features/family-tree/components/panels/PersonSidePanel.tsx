'use client';

import { useEffect, useState } from 'react';

import { PersonForm } from '@/features/persons/components/PersonForm';
import type { PersonInput, PersonPatch } from '@/features/family-tree/schemas/person.schema';
import type { PersonRow } from '../../lib/types';
import { gregorianToHebrewText } from '@/lib/hebrewDate';

export interface PersonSidePanelProps {
  person: PersonRow;
  onClose: () => void;
  onSave: (patch: PersonPatch) => Promise<void>;
  onDelete?: () => Promise<void>;
  canDelete?: boolean;
  isSaving: boolean;
  errorMessage: string | null;
}

export function PersonSidePanel({
  person,
  onClose,
  onSave,
  onDelete,
  canDelete = false,
  isSaving,
  errorMessage,
}: PersonSidePanelProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const displayName = [person.first_name_he ?? person.first_name, person.last_name_he ?? person.last_name]
    .filter(Boolean)
    .join(' ');

  const hebrewBirth = gregorianToHebrewText(person.birth_date);
  const hebrewDeath = gregorianToHebrewText(person.death_date);

  const initial: Partial<PersonInput> = {
    first_name: person.first_name,
    last_name: person.last_name,
    maiden_name: person.maiden_name,
    first_name_he: person.first_name_he,
    last_name_he: person.last_name_he,
    gender: person.gender === 'FEMALE' || person.gender === 'MALE' ? person.gender : 'MALE',
    birth_date: person.birth_date ? new Date(person.birth_date as string) : null,
    death_date: person.death_date ? new Date(person.death_date as string) : null,
    birth_place: person.birth_place,
    bio: person.bio ?? null,
    profile_image: person.profile_image,
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-900/30"
        aria-label="סגור לוח"
        onClick={onClose}
      />

      <aside
        className="fixed inset-y-0 start-0 z-50 flex w-full max-w-md flex-col border-s border-slate-200 bg-white shadow-2xl"
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-900">פרטים אישיים</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-100 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-900">{displayName || '—'}</p>
            {hebrewBirth && <p className="text-xs text-slate-500">לידה: {hebrewBirth}</p>}
            {hebrewDeath && <p className="text-xs text-slate-500">פטירה: {hebrewDeath}</p>}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <PersonForm
            variant="full"
            initialValue={initial}
            submitLabel="עדכן"
            cancelLabel="סגור"
            onCancel={onClose}
            onSubmit={async (input) => {
              const patch: PersonPatch = {
                first_name: input.first_name,
                last_name: input.last_name,
                maiden_name: input.maiden_name,
                first_name_he: input.first_name_he,
                last_name_he: input.last_name_he,
                gender: input.gender,
                birth_date: input.birth_date,
                death_date: input.death_date,
                birth_place: input.birth_place,
                bio: input.bio,
                profile_image: input.profile_image,
              };
              await onSave(patch);
            }}
            isSubmitting={isSaving}
            errorMessage={errorMessage}
          />

          {canDelete && onDelete && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100"
                >
                  מחיקת אדם מהעץ
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-rose-700">למחוק לצמיתות? לא ניתן לבטל.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm"
                    >
                      ביטול
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDelete()}
                      disabled={isSaving}
                      className="flex-1 rounded-md bg-rose-600 px-3 py-2 text-sm text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      מחק
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
