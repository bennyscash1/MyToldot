'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/routing';

import type { PersonInput } from '@/features/family-tree/schemas/person.schema';
import type { PersonRow, PlaceholderMeta, RelationshipRow } from '../lib/types';
import { useTreeMutations } from '../hooks/useTreeMutations';
import { FamilyTreeViewer } from './FamilyTreeViewer';
import { AddRelativePopover } from './panels/AddRelativePopover';
import { PersonSidePanel } from './panels/PersonSidePanel';
import { PersonForm } from '@/components/features/persons/PersonForm';

export interface TreeCanvasWithModalsProps {
  treeId: string;
  treeRouteCode: string;
  initialPersons: PersonRow[];
  initialRelationships: RelationshipRow[];
  initialFocalId: string | null;
  canEdit: boolean;
  canDeletePerson: boolean;
  strictMode?: boolean;
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
}: TreeCanvasWithModalsProps) {
  const router = useRouter();
  const {
    persons,
    relationships,
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
  const firstPersonModalRef = useRef<HTMLDivElement>(null);

  const onAddRelative = useCallback(
    (meta: PlaceholderMeta, screenX: number, screenY: number) => {
      clearError();
      setPopover({ meta, screenX, screenY });
    },
    [clearError],
  );

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
        onAddRelative={canEdit ? onAddRelative : undefined}
        onAddFirstPerson={canEdit ? onAddFirstPerson : undefined}
      />

      {showFirstPersonForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="presentation"
        >
          <div
            ref={firstPersonModalRef}
            className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-xl"
          >
            <PersonForm
              treeId={treeId}
              strictMode={strictMode}
              onSuccess={() => {
                closeFirstPersonForm();
                router.refresh();
              }}
              onCancel={closeFirstPersonForm}
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
    </div>
  );
}
