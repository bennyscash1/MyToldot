'use client';

import { useCallback, useState } from 'react';

import type { PersonInput } from '@/features/family-tree/schemas/person.schema';
import type { PersonRow, PlaceholderMeta, RelationshipRow } from '../lib/types';
import { useTreeMutations } from '../hooks/useTreeMutations';
import { FamilyTreeViewer } from './FamilyTreeViewer';
import { AddRelativePopover } from './panels/AddRelativePopover';
import { PersonSidePanel } from './panels/PersonSidePanel';

const FIRST_PERSON: PersonInput = {
  first_name: 'Person',
  last_name: null,
  maiden_name: null,
  first_name_he: 'אדם ראשון',
  last_name_he: null,
  gender: 'UNKNOWN',
  birth_date: null,
  death_date: null,
  birth_place: null,
  bio: null,
  profile_image: null,
};

export interface TreeCanvasWithModalsProps {
  treeId: string;
  treeRouteCode: string;
  initialPersons: PersonRow[];
  initialRelationships: RelationshipRow[];
  initialFocalId: string | null;
  canEdit: boolean;
  canDeletePerson: boolean;
}

export function TreeCanvasWithModals({
  treeId,
  treeRouteCode,
  initialPersons,
  initialRelationships,
  initialFocalId,
  canEdit,
  canDeletePerson,
}: TreeCanvasWithModalsProps) {
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

  const onAddFirstPerson = useCallback(async () => {
    clearError();
    const id = await createPerson(FIRST_PERSON);
    if (id) setSidePersonId(id);
  }, [clearError, createPerson]);

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
