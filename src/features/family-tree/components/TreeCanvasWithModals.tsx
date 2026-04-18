'use client';

import { useCallback, useState } from 'react';

import type { PersonInput } from '@/features/family-tree/schemas/person.schema';
import type { PersonRow, PlaceholderMeta, RelationshipRow } from '../lib/types';
import { useTreeMutations } from '../hooks/useTreeMutations';
import { FamilyTreeViewer } from './FamilyTreeViewer';
import { AddRelativePopover } from './panels/AddRelativePopover';
import { PersonSidePanel } from './panels/PersonSidePanel';

export interface TreeCanvasWithModalsProps {
  treeId: string;
  initialPersons: PersonRow[];
  initialRelationships: RelationshipRow[];
  initialFocalId: string | null;
  canEdit: boolean;
  canDeletePerson: boolean;
}

export function TreeCanvasWithModals({
  treeId,
  initialPersons,
  initialRelationships,
  initialFocalId,
  canEdit,
  canDeletePerson,
}: TreeCanvasWithModalsProps) {
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
      />

      {popover && (
        <AddRelativePopover
          meta={popover.meta}
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
          isSaving={isSaving}
          errorMessage={lastError}
        />
      )}
    </div>
  );
}
