'use client';

import { useCallback, useState } from 'react';

import type { PersonInput } from '@/features/family-tree/schemas/person.schema';
import type { PersonRow, PlaceholderMeta, RelationshipRow } from '../lib/types';
import { useTreeMutations } from '../hooks/useTreeMutations';
import { FamilyTreeViewer } from './FamilyTreeViewer';
import { AddRelativePopover } from './panels/AddRelativePopover';
import { PersonSidePanel } from './panels/PersonSidePanel';

const PLACEHOLDER_CHILD: PersonInput = {
  first_name: 'Child',
  last_name: null,
  maiden_name: null,
  first_name_he: 'ילד חדש',
  last_name_he: null,
  gender: 'UNKNOWN',
  birth_date: null,
  death_date: null,
  birth_place: null,
  bio: null,
  profile_image: null,
};

const PLACEHOLDER_SPOUSE: PersonInput = {
  first_name: 'Spouse',
  last_name: null,
  maiden_name: null,
  first_name_he: 'בן/בת זוג',
  last_name_he: null,
  gender: 'UNKNOWN',
  birth_date: null,
  death_date: null,
  birth_place: null,
  bio: null,
  profile_image: null,
};

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

const PLACEHOLDER_PARENT: PersonInput = {
  first_name: 'Parent',
  last_name: null,
  maiden_name: null,
  first_name_he: 'הורה חדש',
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

  const handleAddChildFromPanel = useCallback(async () => {
    if (!sidePersonId) return;
    clearError();
    const id = await addChild({
      parent1Id: sidePersonId,
      parent2Id: null,
      child: PLACEHOLDER_CHILD,
    });
    if (id) setSidePersonId(id);
  }, [sidePersonId, addChild, clearError]);

  const handleAddSpouseFromPanel = useCallback(async () => {
    if (!sidePersonId) return;
    clearError();
    await addSpouse({
      personId: sidePersonId,
      spouse: PLACEHOLDER_SPOUSE,
      marriage_date: null,
    });
  }, [sidePersonId, addSpouse, clearError]);

  const handleAddParentFromPanel = useCallback(async () => {
    if (!sidePersonId) return;
    clearError();
    await addParent({ childId: sidePersonId, parent: PLACEHOLDER_PARENT });
  }, [sidePersonId, addParent, clearError]);

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
