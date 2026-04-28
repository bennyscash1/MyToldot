'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button }     from '@/components/ui/Button';
import { PersonForm } from './PersonForm';
import { usePermissions } from '@/hooks/usePermissions';
import type { PersonDto } from '@/types/api';

// ──────────────────────────────────────────────
// AddPersonSection — Client Component
//
// Receives the resolved treeId (and strictMode flag)
// from the parent Server Component (page.tsx) and
// manages the open/closed state of the form overlay.
//
// Defence-in-depth: the component also checks the global
// RBAC via usePermissions and renders nothing when the
// caller is not an approved editor/admin. The server route
// behind PersonForm.submit() is the authoritative gate;
// hiding the UI is purely a UX nicety.
// ──────────────────────────────────────────────

interface AddPersonSectionProps {
  treeId:      string | null;
  strictMode:  boolean;
  /** How many persons already exist in the tree (0 = "first person" CTA). */
  personCount: number;
}

export function AddPersonSection({ treeId, strictMode, personCount }: AddPersonSectionProps) {
  const t       = useTranslations('home');
  const tForm   = useTranslations('personForm');
  const tCommon = useTranslations('common');
  const { canEdit } = usePermissions();

  const [isOpen, setIsOpen]       = useState(false);
  const [lastAdded, setLastAdded] = useState<PersonDto | null>(null);

  function handleSuccess(person: PersonDto) {
    setLastAdded(person);
    setIsOpen(false);
  }

  if (!canEdit) return null;

  if (!treeId) {
    return (
      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="text-sm text-gray-400">{t('noTreeMessage')}</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Success toast ── */}
      {lastAdded && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm text-emerald-700">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            <strong>
              {lastAdded.first_name} {lastAdded.last_name ?? ''}
            </strong>{' '}
            {tForm('successMessage')}
          </span>
          <button
            onClick={() => setLastAdded(null)}
            className="ms-auto rounded p-0.5 text-emerald-500 hover:text-emerald-700"
            aria-label={tCommon('cancel')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── CTA button ── */}
      <Button onClick={() => setIsOpen(true)} size="lg" className="mt-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
        </svg>
        {personCount === 0 ? t('addFirstPerson') : t('addAnotherPerson')}
      </Button>

      {/* ── Overlay / modal ── */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="person-form-title"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            {/* Sticky header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white/95 px-6 py-4 backdrop-blur-sm">
              <h2
                id="person-form-title"
                className="text-lg font-semibold text-gray-900"
              >
                {tForm('addTitle')}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                aria-label={tCommon('cancel')}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Form body */}
            <div className="px-6 py-5">
              <PersonForm
                treeId={treeId}
                strictMode={strictMode}
                onSuccess={handleSuccess}
                onCancel={() => setIsOpen(false)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
