'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';

import type { PersonInput } from '@/features/family-tree/schemas/person.schema';
import type { PersonPhotoDTO, PersonRow, PlaceholderMeta, RelationshipRow } from '../lib/types';
import { useTreeMutations } from '../hooks/useTreeMutations';
import { FamilyTreeViewer } from './FamilyTreeViewer';
import { isInsideDatePickerPopover } from '@/components/ui/datePickerPopover';
import { getCurrentSpouseIds } from '../lib/currentSpouses';
import { fullNameFromPerson } from '../lib/personDisplayName';
import { AddRelativePopover } from './panels/AddRelativePopover';
import { NoSpouseChildModal } from './panels/NoSpouseChildModal';
import { PickCoParentModal, type CoParentOption } from './panels/PickCoParentModal';
import { PersonSidePanel } from './panels/PersonSidePanel';
import { TreeAboutModal } from './panels/TreeAboutModal';
import { PersonForm } from '@/features/persons/components/PersonForm';
import { BlockedActionDialog } from '@/components/ui/BlockedActionDialog';
import { NudgesPanelContainer } from '@/features/nudges/components/NudgesPanelContainer';
import { AiTreeBuilderModal } from './panels/AiTreeBuilderModal';

export interface TreeCanvasWithModalsProps {
  treeId: string;
  treeRouteCode: string;
  initialPersons: PersonRow[];
  initialRelationships: RelationshipRow[];
  initialFocalId: string | null;
  initialPhotosByPerson: Record<string, PersonPhotoDTO[]>;
  canEdit: boolean;
  canDeletePerson: boolean;
  strictMode?: boolean;
  canEditAbout: boolean;
  openAboutOnLoad?: boolean;
  initialSidePersonId?: string | null;
}

export function TreeCanvasWithModals({
  treeId,
  treeRouteCode,
  initialPersons,
  initialRelationships,
  initialFocalId,
  initialPhotosByPerson,
  canEdit,
  canDeletePerson,
  strictMode = false,
  canEditAbout,
  openAboutOnLoad = false,
  initialSidePersonId = null,
}: TreeCanvasWithModalsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const tTree = useTranslations('treePage');
  const tPersonForm = useTranslations('personForm');
  const tAi = useTranslations('aiTreeBuilder');
  const headerDir = locale === 'he' ? 'rtl' : 'ltr';

  const [nudgesRefetchSignal, setNudgesRefetchSignal] = useState(0);
  const bumpNudgesRefetch = useCallback(
    () => setNudgesRefetchSignal((v) => v + 1),
    [],
  );

  const {
    persons,
    relationships,
    createPerson,
    addParent,
    addSpouse,
    addChild,
    addSibling,
    updatePerson,
    deletePerson,
    isSaving,
    lastError,
    clearError,
    lastBlocked,
    clearBlocked,
  } = useTreeMutations({
    treeId,
    treeRouteCode,
    initialPersons,
    initialRelationships,
    onMutationDone: bumpNudgesRefetch,
  });

  const [popover, setPopover] = useState<{
    meta: PlaceholderMeta;
    screenX: number;
    screenY: number;
  } | null>(null);

  const [sidePersonId, setSidePersonId] = useState<string | null>(initialSidePersonId);
  const [sidePanelInitialFocus, setSidePanelInitialFocus] =
    useState<'bio' | null>(null);
  const [photosByPerson, setPhotosByPerson] = useState(initialPhotosByPerson);
  const [showFirstPersonForm, setShowFirstPersonForm] = useState(false);
  const [showAiBuilder, setShowAiBuilder] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(openAboutOnLoad);
  const [pickCoParentModal, setPickCoParentModal] = useState<{
    anchorId: string;
    personName: string;
    spouseOptions: CoParentOption[];
  } | null>(null);
  const [noSpouseChildModal, setNoSpouseChildModal] = useState<{
    anchorId: string;
    personName: string;
  } | null>(null);
  const firstPersonModalRef = useRef<HTMLDivElement>(null);

  const onSelectPerson = useCallback(
    (personId: string) => {
      clearError();
      clearBlocked();
      setSidePersonId(personId);
      setSidePanelInitialFocus(null);
    },
    [clearError, clearBlocked],
  );

  const onOpenSidePanelForBio = useCallback(
    (personId: string) => {
      clearError();
      clearBlocked();
      setSidePersonId(personId);
      setSidePanelInitialFocus('bio');
    },
    [clearError, clearBlocked],
  );

  const closeFirstPersonForm = useCallback(() => {
    setShowFirstPersonForm(false);
    clearError();
    clearBlocked();
  }, [clearError, clearBlocked]);

  const onAddFirstPerson = useCallback(() => {
    clearError();
    clearBlocked();
    setShowFirstPersonForm(true);
  }, [clearError, clearBlocked]);

  const onOpenAiBuilder = useCallback(() => {
    clearError();
    clearBlocked();
    setShowAiBuilder(true);
  }, [clearError, clearBlocked]);

  const onCloseAiBuilder = useCallback(() => {
    setShowAiBuilder(false);
  }, []);

  const onAiPlanApplied = useCallback(() => {
    setShowAiBuilder(false);
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!showFirstPersonForm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFirstPersonForm();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!firstPersonModalRef.current) return;
      if (isInsideDatePickerPopover(e.target)) return;
      if (!firstPersonModalRef.current.contains(e.target as Node)) {
        closeFirstPersonForm();
      }
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

  const openAddChildPopover = useCallback(
    (
      anchorId: string,
      parentIds: [string] | [string, string],
      skipSpouseAutoLink?: boolean,
    ) => {
      if (typeof window === 'undefined') return;
      setPopover({
        meta: {
          kind: 'add-child',
          anchor_id: anchorId,
          parent_ids: parentIds,
          skipSpouseAutoLink,
        },
        screenX: Math.round(window.innerWidth / 2),
        screenY: Math.round(window.innerHeight / 2),
      });
    },
    [],
  );

  const handleOpenAddFromPanel = useCallback(
    (kind: 'add-parent' | 'add-spouse' | 'add-child') => {
      if (!sidePersonId || typeof window === 'undefined') return;
      clearError();
      clearBlocked();
      const meta: PlaceholderMeta = { kind, anchor_id: sidePersonId };
      setPopover({
        meta,
        screenX: Math.round(window.innerWidth / 2),
        screenY: Math.round(window.innerHeight / 2),
      });
    },
    [sidePersonId, clearError, clearBlocked],
  );

  const handleAddParentFromPanel = useCallback(async () => {
    handleOpenAddFromPanel('add-parent');
  }, [handleOpenAddFromPanel]);

  const handleAddSpouseFromPanel = useCallback(async () => {
    handleOpenAddFromPanel('add-spouse');
  }, [handleOpenAddFromPanel]);

  const handleAddChildFromPanel = useCallback(() => {
    if (!sidePersonId || typeof window === 'undefined') return;
    clearError();
    clearBlocked();

    const anchor = persons.find((p) => p.id === sidePersonId);
    if (!anchor) return;
    const personName = fullNameFromPerson(anchor) || sidePersonId;
    const spouseIds = getCurrentSpouseIds(sidePersonId, relationships);

    if (spouseIds.length === 1) {
      openAddChildPopover(sidePersonId, [sidePersonId, spouseIds[0]]);
      return;
    }

    if (spouseIds.length >= 2) {
      const spouseOptions: CoParentOption[] = spouseIds.map((id) => {
        const p = persons.find((x) => x.id === id);
        return { id, name: p ? fullNameFromPerson(p) || id : id };
      });
      setPickCoParentModal({ anchorId: sidePersonId, personName, spouseOptions });
      return;
    }

    setNoSpouseChildModal({ anchorId: sidePersonId, personName });
  }, [
    sidePersonId,
    persons,
    relationships,
    clearError,
    clearBlocked,
    openAddChildPopover,
  ]);

  const handleAddSubmit = useCallback(
    async (input: PersonInput) => {
      if (!popover) return;
      const { meta } = popover;
      try {
        let okResult = false;
        if (meta.kind === 'add-parent') {
          okResult = await addParent({ childId: meta.anchor_id, parent: input });
        } else if (meta.kind === 'add-spouse') {
          okResult = await addSpouse({ personId: meta.anchor_id, spouse: input, marriage_date: null });
        } else if (meta.kind === 'add-child') {
          const pids = meta.parent_ids;
          if (!pids?.length) return;
          const childId = await addChild({
            parent1Id: pids[0],
            parent2Id: pids.length > 1 ? pids[1] : null,
            child: input,
            skipSpouseAutoLink: meta.skipSpouseAutoLink,
          });
          okResult = childId !== null;
        } else if (meta.kind === 'add-sibling') {
          okResult = await addSibling({ existingSiblingId: meta.anchor_id, sibling: input });
        }
        if (okResult) setPopover(null);
      } catch {
        /* errors surface via lastError / lastBlocked */
      }
    },
    [popover, addParent, addSpouse, addChild, addSibling],
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

  const handleDeletePerson = useCallback(
    async (personId: string) => {
      await deletePerson(personId);
      setPhotosByPerson((prev) => {
        const next = { ...prev };
        delete next[personId];
        return next;
      });
      setSidePersonId(null);
    },
    [deletePerson],
  );

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      <FamilyTreeViewer
        treeId={treeId}
        persons={persons}
        relationships={relationships}
        initialFocalId={initialFocalId}
        canEdit={canEdit}
        onSelectPerson={onSelectPerson}
        onAddFirstPerson={canEdit ? onAddFirstPerson : undefined}
      />

      {canEdit && persons.length === 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4"
          dir={headerDir}
        >
          <button
            type="button"
            onClick={onOpenAiBuilder}
            className="pointer-events-auto flex flex-col items-center gap-0.5 rounded-full border border-emerald-200 bg-white/90 px-5 py-2 text-sm font-medium text-emerald-700 shadow-md backdrop-blur transition hover:border-emerald-300 hover:bg-white hover:text-emerald-800"
          >
            <span className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M10 1.5a.75.75 0 0 1 .727.564l.708 2.75 2.75.708a.75.75 0 0 1 0 1.456l-2.75.708-.708 2.75a.75.75 0 0 1-1.454 0l-.708-2.75-2.75-.708a.75.75 0 0 1 0-1.456l2.75-.708.708-2.75A.75.75 0 0 1 10 1.5ZM5 11a.6.6 0 0 1 .582.452l.41 1.556 1.556.41a.6.6 0 0 1 0 1.164l-1.556.41-.41 1.556a.6.6 0 0 1-1.164 0l-.41-1.556-1.556-.41a.6.6 0 0 1 0-1.164l1.556-.41.41-1.556A.6.6 0 0 1 5 11Zm10 1a.55.55 0 0 1 .533.414l.32 1.233 1.234.32a.55.55 0 0 1 0 1.066l-1.234.32-.32 1.233a.55.55 0 0 1-1.066 0l-.32-1.233-1.234-.32a.55.55 0 0 1 0-1.066l1.234-.32.32-1.233A.55.55 0 0 1 15 12Z" />
              </svg>
              {tAi('openButton')}
            </span>
            <span className="text-[10px] font-normal text-emerald-600/80">
              {tAi('openButtonHint')}
            </span>
          </button>
        </div>
      )}

      <AiTreeBuilderModal
        open={showAiBuilder && canEdit && persons.length === 0}
        treeId={treeId}
        onClose={onCloseAiBuilder}
        onApplied={onAiPlanApplied}
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
          treeRouteCode={treeRouteCode}
          person={sidePerson}
          photos={photosByPerson[sidePerson.id] ?? []}
          onPhotosChange={(next) =>
            setPhotosByPerson((prev) => ({ ...prev, [sidePerson.id]: next }))
          }
          canEdit={canEdit}
          onClose={() => {
            setSidePersonId(null);
            setSidePanelInitialFocus(null);
          }}
          initialFocusField={sidePanelInitialFocus ?? undefined}
          onSave={async (patch) => {
            await updatePerson({ personId: sidePerson.id, patch });
          }}
          onDelete={
            canDeletePerson
              ? async () => {
                  await handleDeletePerson(sidePerson.id);
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

      <BlockedActionDialog
        open={lastBlocked !== null}
        ownerEmail={lastBlocked?.ownerEmail}
        onClose={clearBlocked}
      />

      {canEdit && (
        <NudgesPanelContainer
          treeId={treeId}
          refetchSignal={nudgesRefetchSignal}
          onOpenSidePanelForBio={onOpenSidePanelForBio}
          onSelectPerson={onSelectPerson}
        />
      )}

      {pickCoParentModal && (
        <PickCoParentModal
          open
          personName={pickCoParentModal.personName}
          spouseOptions={pickCoParentModal.spouseOptions}
          onCancel={() => setPickCoParentModal(null)}
          onConfirm={(coParentId) => {
            const { anchorId } = pickCoParentModal;
            setPickCoParentModal(null);
            if (coParentId) {
              openAddChildPopover(anchorId, [anchorId, coParentId]);
            } else {
              openAddChildPopover(anchorId, [anchorId], true);
            }
          }}
        />
      )}

      {noSpouseChildModal && (
        <NoSpouseChildModal
          open
          personName={noSpouseChildModal.personName}
          onCancel={() => setNoSpouseChildModal(null)}
          onAddSpouseFirst={() => {
            setNoSpouseChildModal(null);
            handleOpenAddFromPanel('add-spouse');
          }}
          onSingleParent={() => {
            const { anchorId } = noSpouseChildModal;
            setNoSpouseChildModal(null);
            openAddChildPopover(anchorId, [anchorId], true);
          }}
        />
      )}
    </div>
  );
}
