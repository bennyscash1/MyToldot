'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';

import type { PersonInput } from '@/features/family-tree/schemas/person.schema';
import type { PersonRow, PlaceholderMeta, RelationshipRow } from '../lib/types';
import { useTreeMutations } from '../hooks/useTreeMutations';
import { FamilyTreeViewer } from './FamilyTreeViewer';
import { AddRelativePopover } from './panels/AddRelativePopover';
import { PersonSidePanel } from './panels/PersonSidePanel';
import { TreeAboutModal } from './panels/TreeAboutModal';
import { PersonForm } from '@/features/persons/components/PersonForm';

export interface TreeCanvasWithModalsProps {
  treeId: string;
  treeRouteCode: string;
  initialPersons: PersonRow[];
  initialRelationships: RelationshipRow[];
  initialFocalId: string | null;
  canEdit: boolean;
  canDeletePerson: boolean;
  strictMode?: boolean;
  canEditAbout: boolean;
  openAboutOnLoad?: boolean;
}

export function TreeCanvasWithModals({
  treeId,
  treeRouteCode,
  initialPersons,
  initialRelationships,
  initialFocalId,
  canEdit,
  canDeletePerson,
  strictMode = false,
  canEditAbout,
  openAboutOnLoad = false,
}: TreeCanvasWithModalsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const tTree = useTranslations('treePage');
  const tPersonForm = useTranslations('personForm');
  const headerDir = locale === 'he' ? 'rtl' : 'ltr';

  const {
    persons,
    relationships,
    createPerson,
    addParent,
    addSpouse,
    addChild,
    updatePerson,
    deletePerson,
    isSaving,
    lastError,
    clearError,
  } = useTreeMutations({
    treeId,
    treeRouteCode,
    initialPersons,
    initialRelationships,
  });

  const [popover, setPopover] = useState<{
    meta: PlaceholderMeta;
    screenX: number;
    screenY: number;
  } | null>(null);

  const [sidePersonId, setSidePersonId] = useState<string | null>(null);
  const [showFirstPersonForm, setShowFirstPersonForm] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(openAboutOnLoad);
  const firstPersonModalRef = useRef<HTMLDivElement>(null);

  const onSelectPerson = useCallback(
    (personId: string) => {
      clearError();
      setSidePersonId(personId);
    },
    [clearError],
  );

  const closeFirstPersonForm = useCallback(() => {
    setShowFirstPersonForm(false);
    clearError();
  }, [clearError]);

  const onAddFirstPerson = useCallback(() => {
    clearError();
    setShowFirstPersonForm(true);
  }, [clearError]);

  useEffect(() => {
    if (!showFirstPersonForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFirstPersonForm();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!firstPersonModalRef.current) return;
      if (!firstPersonModalRef.current.contains(e.target as Node)) closeFirstPersonForm();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [showFirstPersonForm, closeFirstPersonForm]);

  useEffect(() => {
    if (openAboutOnLoad) {
      setShowAboutModal(true);
    }
  }, [openAboutOnLoad]);

  const closeAboutModal = useCallback(() => {
    setShowAboutModal(false);
    if (openAboutOnLoad) {
      router.replace(pathname);
    }
  }, [openAboutOnLoad, pathname, router]);

  const handleOpenAddFromPanel = useCallback(
    (kind: 'add-parent' | 'add-spouse' | 'add-child') => {
      if (!sidePersonId || typeof window === 'undefined') return;
      clearError();
      const meta: PlaceholderMeta =
        kind === 'add-child'
          ? { kind, anchor_id: sidePersonId, parent_ids: [sidePersonId] as [string] }
          : { kind, anchor_id: sidePersonId };
      setPopover({
        meta,
        screenX: Math.round(window.innerWidth / 2),
        screenY: Math.round(window.innerHeight / 2),
      });
    },
    [sidePersonId, clearError],
  );

  const handleAddParentFromPanel = useCallback(async () => {
    handleOpenAddFromPanel('add-parent');
  }, [handleOpenAddFromPanel]);

  const handleAddSpouseFromPanel = useCallback(async () => {
    handleOpenAddFromPanel('add-spouse');
  }, [handleOpenAddFromPanel]);

  const handleAddChildFromPanel = useCallback(async () => {
    handleOpenAddFromPanel('add-child');
  }, [handleOpenAddFromPanel]);

  const handleAddSubmit = useCallback(
    async (input: PersonInput) => {
      if (!popover) return;
      const { meta } = popover;
      try {
        if (meta.kind === 'add-parent') {
          await addParent({ childId: meta.anchor_id, parent: input });
        } else if (meta.kind === 'add-spouse') {
          await addSpouse({ personId: meta.anchor_id, spouse: input, marriage_date: null });
        } else if (meta.kind === 'add-child') {
          const pids = meta.parent_ids;
          if (!pids?.length) return;
          await addChild({
            parent1Id: pids[0],
            parent2Id: pids.length > 1 ? pids[1] : null,
            child: input,
          });
        }
        setPopover(null);
      } catch {
        /* errors surface via lastError */
      }
    },
    [popover, addParent, addSpouse, addChild],
  );

  const handleFirstRootSubmit = useCallback(
    async (input: PersonInput) => {
      const id = await createPerson(input);
      if (id) {
        closeFirstPersonForm();
        router.refresh();
      }
    },
    [createPerson, closeFirstPersonForm, router],
  );

  const sidePerson = sidePersonId ? persons.find((p) => p.id === sidePersonId) : null;

  return (
    <div className="relative flex h-[calc(100vh-5rem)] w-full flex-col">
      <FamilyTreeViewer
        treeId={treeId}
        persons={persons}
        relationships={relationships}
        initialFocalId={initialFocalId}
        canEdit={canEdit}
        onSelectPerson={onSelectPerson}
        onAddFirstPerson={canEdit ? onAddFirstPerson : undefined}
      />

      {showFirstPersonForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
        >
          <div
            ref={firstPersonModalRef}
            className="max-h-[min(90vh,720px)] w-full max-w-[340px] overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="first-root-modal-title"
          >
            <div className="mb-3 flex items-center justify-between" dir={headerDir}>
              <h2
                id="first-root-modal-title"
                className="text-sm font-semibold text-slate-900"
              >
                {tTree('firstRootModalTitle')}
              </h2>
              <button
                type="button"
                onClick={closeFirstPersonForm}
                className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label={locale === 'he' ? 'סגור' : 'Close'}
              >
                ✕
              </button>
            </div>

            {strictMode && (
              <div
                className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
                dir={headerDir}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
                {tPersonForm('strictModeWarning')}
              </div>
            )}

            <PersonForm
              variant="firstRoot"
              submitLabel="שמור"
              cancelLabel="ביטול"
              onSubmit={handleFirstRootSubmit}
              onCancel={closeFirstPersonForm}
              isSubmitting={isSaving}
              errorMessage={lastError}
            />
          </div>
        </div>
      )}

      {popover && (
        <AddRelativePopover
          meta={popover.meta}
          anchorGender={persons.find((p) => p.id === popover.meta.anchor_id)?.gender ?? null}
          screenX={popover.screenX}
          screenY={popover.screenY}
          onClose={() => setPopover(null)}
          onSubmit={handleAddSubmit}
          isSubmitting={isSaving}
          errorMessage={lastError}
        />
      )}

      {sidePerson && (
        <PersonSidePanel
          treeId={treeId}
          person={sidePerson}
          onClose={() => setSidePersonId(null)}
          onSave={async (patch) => {
            await updatePerson({ personId: sidePerson.id, patch });
          }}
          onDelete={
            canDeletePerson
              ? async () => {
                  await deletePerson(sidePerson.id);
                  setSidePersonId(null);
                }
              : undefined
          }
          canDelete={canDeletePerson}
          onAddParent={canEdit ? handleAddParentFromPanel : undefined}
          onAddSpouse={canEdit ? handleAddSpouseFromPanel : undefined}
          onAddChild={canEdit ? handleAddChildFromPanel : undefined}
          isSaving={isSaving}
          errorMessage={lastError}
        />
      )}

      <TreeAboutModal
        treeId={treeId}
        canEdit={canEditAbout}
        open={showAboutModal}
        onClose={closeAboutModal}
      />
    </div>
  );
}
