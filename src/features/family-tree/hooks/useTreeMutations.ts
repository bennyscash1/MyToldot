'use client';

import { useCallback, useState, useTransition } from 'react';
import { useLocale } from 'next-intl';

import type { AddedRelativeDto } from '@/server/services/tree.service';
import {
  updatePersonAction,
} from '@/server/actions/person.actions';
import type {
  PersonInput,
  PersonPatch,
} from '@/features/family-tree/schemas/person.schema';
import { apiClient, ServiceError } from '@/services/api.client';
import type { PersonRow, RelationshipRow } from '../lib/types';

// ────────────────────────────────────────────────────────────────
// useTreeMutations
//
// Owns the *client-side* source of truth for the tree. The RSC hands us an
// initial payload once; from then on, this hook is the single writer.
//
// Every mutation follows the same pattern:
//   1. Generate a temporary id (`tmp:...`).
//   2. Insert the row(s) into local state immediately → canvas updates.
//   3. Await the server call.
//   4. On success, swap tmp ids for real ones (no re-fetch; we have
//      everything we need).
//   5. On failure, roll back the temp rows and surface an error.
//
// Why no `router.refresh()`? The server action calls `revalidatePath` on
// success, which takes effect on the next navigation. In-place we'd create a
// race between the refresh and subsequent optimistic edits — by trusting our
// own state until the user leaves the page, we avoid that entire class of
// bugs. On reload, the RSC re-fetches fresh data.
// ────────────────────────────────────────────────────────────────

export interface UseTreeMutationsArgs {
  treeId: string;
  treeSlug: string;
  initialPersons: PersonRow[];
  initialRelationships: RelationshipRow[];
}

export interface UseTreeMutationsResult {
  persons: PersonRow[];
  relationships: RelationshipRow[];
  /** Creates a standalone person (no relationships). Returns the new person's id, or null on failure. */
  createPerson: (input: PersonInput) => Promise<string | null>;
  addParent: (args: { childId: string; parent: PersonInput; adoptive?: boolean }) => Promise<void>;
  addSpouse: (args: { personId: string; spouse: PersonInput; marriage_date?: Date | null }) => Promise<void>;
  /** Returns the new child's id after a successful create (real id, not temp). */
  addChild: (args: { parent1Id: string; parent2Id?: string | null; child: PersonInput }) => Promise<string | null>;
  updatePerson: (args: { personId: string; patch: PersonPatch }) => Promise<void>;
  deletePerson: (personId: string) => Promise<void>;
  isSaving: boolean;
  lastError: string | null;
  clearError: () => void;
}

function tmpId(prefix: string): string {
  return `tmp:${prefix}:${crypto.randomUUID()}`;
}

function oppositeBinaryGender(
  gender: PersonRow['gender'],
): 'MALE' | 'FEMALE' | null {
  if (gender === 'MALE') return 'FEMALE';
  if (gender === 'FEMALE') return 'MALE';
  return null;
}

/** Shapes a PersonInput into the PersonRow used by the renderer. */
function inputToRow(id: string, input: PersonInput): PersonRow {
  return {
    id,
    first_name: input.first_name,
    last_name: input.last_name ?? null,
    maiden_name: input.maiden_name ?? null,
    first_name_he: input.first_name_he ?? null,
    last_name_he: input.last_name_he ?? null,
    gender: input.gender,
    birth_date: input.birth_date ?? null,
    death_date: input.death_date ?? null,
    birth_place: input.birth_place ?? null,
    bio: input.bio ?? null,
    profile_image: input.profile_image ?? null,
  };
}

export function useTreeMutations({
  treeId,
  treeSlug,
  initialPersons,
  initialRelationships,
}: UseTreeMutationsArgs): UseTreeMutationsResult {
  const locale = useLocale();
  const treeRouteBase = `/${locale}/tree/${treeSlug}`;
  const [persons, setPersons] = useState<PersonRow[]>(initialPersons);
  const [relationships, setRelationships] = useState<RelationshipRow[]>(initialRelationships);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const asMutationResult = useCallback(
    async <T,>(run: () => Promise<T>) => {
      try {
        return { ok: true as const, data: await run() };
      } catch (err) {
        if (err instanceof ServiceError) {
          return {
            ok: false as const,
            error: { code: err.code, message: err.message },
          };
        }
        throw err;
      }
    },
    [],
  );

  /** Insert optimistic rows, run the server call, swap ids on success, roll back on failure. Returns server `data` on success. */
  const runOptimistic = useCallback(
    async <T,>(args: {
      tempPersons?: PersonRow[];
      tempRelationships?: RelationshipRow[];
      run: () => Promise<
        | { ok: true; data: T }
        | { ok: false; error: { code: string; message: string } }
      >;
      /** Called on success to compute id-swap instructions. */
      onSuccess?: (data: T) => {
        swapPersonIds?: Record<string, string>;
        swapRelationshipIds?: Record<string, string>;
      };
    }): Promise<T | undefined> => {
      const { tempPersons = [], tempRelationships = [], run, onSuccess } = args;
      const tempPersonIds = new Set(tempPersons.map((p) => p.id));
      const tempRelIds = new Set(tempRelationships.map((r) => r.id));

      setPersons((prev) => [...prev, ...tempPersons]);
      setRelationships((prev) => [...prev, ...tempRelationships]);

      try {
        const result = await run();
        if (!result.ok) {
          setLastError(result.error.message);
          setPersons((prev) => prev.filter((p) => !tempPersonIds.has(p.id)));
          setRelationships((prev) => prev.filter((r) => !tempRelIds.has(r.id)));
          return undefined;
        }

        const swaps = onSuccess?.(result.data) ?? {};
        const { swapPersonIds = {}, swapRelationshipIds = {} } = swaps;

        setPersons((prev) =>
          prev.map((p) => (swapPersonIds[p.id] ? { ...p, id: swapPersonIds[p.id] } : p)),
        );
        setRelationships((prev) =>
          prev.map((r) => {
            // Remap both the relationship id itself AND any endpoint ids that
            // pointed at now-real persons.
            let next = r;
            if (swapRelationshipIds[r.id]) next = { ...next, id: swapRelationshipIds[r.id] };
            if (swapPersonIds[r.person1_id]) next = { ...next, person1_id: swapPersonIds[r.person1_id] };
            if (swapPersonIds[r.person2_id]) next = { ...next, person2_id: swapPersonIds[r.person2_id] };
            return next;
          }),
        );
        setLastError(null);
        return result.data;
      } catch (err) {
        setLastError(err instanceof Error ? err.message : 'Unknown error');
        setPersons((prev) => prev.filter((p) => !tempPersonIds.has(p.id)));
        setRelationships((prev) => prev.filter((r) => !tempRelIds.has(r.id)));
        return undefined;
      }
    },
    [],
  );

  // ── createPerson ─────────────────────────────────────────────
  const createPerson = useCallback<UseTreeMutationsResult['createPerson']>(
    async (input) => {
      const newPersonId = tmpId('person');
      const tempPerson = inputToRow(newPersonId, input);
      let out: string | null = null;
      await new Promise<void>((resolve) => {
        startTransition(async () => {
          const data = await runOptimistic<{ id: string }>({
            tempPersons: [tempPerson],
            tempRelationships: [],
            run: () =>
              asMutationResult(() =>
                apiClient.post<{ id: string }>(`${treeRouteBase}/add`, {
                  treeId,
                  person: input,
                }),
              ),
            onSuccess: (dto) => ({
              swapPersonIds: { [newPersonId]: dto.id },
            }),
          });
          if (data) out = data.id;
          resolve();
        });
      });
      return out;
    },
    [asMutationResult, treeId, treeRouteBase, runOptimistic],
  );

  // ── addParent ──────────────────────────────────────────────────
  const addParent = useCallback<UseTreeMutationsResult['addParent']>(
    async ({ childId, parent, adoptive }) => {
      const newPersonId = tmpId('person');
      const newRelId = tmpId('rel');
      const tempPerson = inputToRow(newPersonId, parent);
      const tempRel: RelationshipRow = {
        id: newRelId,
        relationship_type: adoptive ? 'ADOPTED_PARENT' : 'PARENT_CHILD',
        person1_id: newPersonId,
        person2_id: childId,
        start_date: null,
        end_date: null,
      };
      await new Promise<void>((resolve) => {
        startTransition(async () => {
          await runOptimistic({
            tempPersons: [tempPerson],
            tempRelationships: [tempRel],
            run: () =>
              asMutationResult(() =>
                apiClient.post<AddedRelativeDto>(`${treeRouteBase}/add-parent`, {
                  treeId,
                  childId,
                  parent,
                  adoptive,
                }),
              ),
            onSuccess: (data) => ({
              swapPersonIds: { [newPersonId]: data.person.id },
              swapRelationshipIds: { [newRelId]: data.relationship_ids[0] },
            }),
          });
          resolve();
        });
      });
    },
    [asMutationResult, treeId, treeRouteBase, runOptimistic],
  );

  // ── addSpouse ──────────────────────────────────────────────────
  const addSpouse = useCallback<UseTreeMutationsResult['addSpouse']>(
    async ({ personId, spouse, marriage_date }) => {
      const focusedPerson = persons.find((p) => p.id === personId);
      if (!focusedPerson) {
        setLastError('Focused person was not found');
        return;
      }
      const spouseGender = oppositeBinaryGender(focusedPerson.gender);
      if (!spouseGender) {
        setLastError('Cannot add spouse unless the focused person is male or female.');
        return;
      }
      const normalizedSpouse: PersonInput = { ...spouse, gender: spouseGender };
      const newPersonId = tmpId('person');
      const newRelId = tmpId('rel');
      const tempPerson = inputToRow(newPersonId, normalizedSpouse);
      const tempRel: RelationshipRow = {
        id: newRelId,
        relationship_type: 'SPOUSE',
        person1_id: personId,
        person2_id: newPersonId,
        start_date: marriage_date ?? null,
        end_date: null,
      };
      await new Promise<void>((resolve) => {
        startTransition(async () => {
          await runOptimistic({
            tempPersons: [tempPerson],
            tempRelationships: [tempRel],
            run: () =>
              asMutationResult(() =>
                apiClient.post<AddedRelativeDto>(`${treeRouteBase}/add-spouse`, {
                  treeId,
                  personId,
                  spouse: normalizedSpouse,
                  marriage_date: marriage_date ?? null,
                }),
              ),
            onSuccess: (data) => ({
              swapPersonIds: { [newPersonId]: data.person.id },
              swapRelationshipIds: { [newRelId]: data.relationship_ids[0] },
            }),
          });
          resolve();
        });
      });
    },
    [asMutationResult, treeId, treeRouteBase, persons, runOptimistic],
  );

  // ── addChild ───────────────────────────────────────────────────
  const addChild = useCallback<UseTreeMutationsResult['addChild']>(
    async ({ parent1Id, parent2Id, child }) => {
      const newPersonId = tmpId('person');
      const parentIds = parent2Id ? [parent1Id, parent2Id] : [parent1Id];
      const tempRels: RelationshipRow[] = parentIds.map((pid) => ({
        id: tmpId('rel'),
        relationship_type: 'PARENT_CHILD',
        person1_id: pid,
        person2_id: newPersonId,
        start_date: null,
        end_date: null,
      }));
      const tempPerson = inputToRow(newPersonId, child);
      let out: string | null = null;
      await new Promise<void>((resolve) => {
        startTransition(async () => {
          const data = await runOptimistic<AddedRelativeDto>({
            tempPersons: [tempPerson],
            tempRelationships: tempRels,
            run: () =>
              asMutationResult(() =>
                apiClient.post<AddedRelativeDto>(`${treeRouteBase}/add-child`, {
                  treeId,
                  parent1Id,
                  parent2Id: parent2Id ?? null,
                  child,
                }),
              ),
            onSuccess: (data) => {
              const swapRelationshipIds: Record<string, string> = {};
              tempRels.forEach((tr, i) => {
                const realId = data.relationship_ids[i];
                if (realId) swapRelationshipIds[tr.id] = realId;
              });
              return {
                swapPersonIds: { [newPersonId]: data.person.id },
                swapRelationshipIds,
              };
            },
          });
          if (data) out = data.person.id;
          resolve();
        });
      });
      return out;
    },
    [asMutationResult, treeId, treeRouteBase, runOptimistic],
  );

  // ── updatePerson ───────────────────────────────────────────────
  const updatePerson = useCallback<UseTreeMutationsResult['updatePerson']>(
    async ({ personId, patch }) => {
      // Snapshot for rollback.
      const snapshot = persons.find((p) => p.id === personId);
      if (!snapshot) return;

      setPersons((prev) =>
        prev.map((p) =>
          p.id === personId
            ? {
                ...p,
                first_name: patch.first_name ?? p.first_name,
                last_name: patch.last_name ?? p.last_name,
                first_name_he: patch.first_name_he ?? p.first_name_he,
                last_name_he: patch.last_name_he ?? p.last_name_he,
                maiden_name: patch.maiden_name ?? p.maiden_name,
                gender: patch.gender ?? p.gender,
                birth_date: patch.birth_date ?? p.birth_date,
                death_date: patch.death_date ?? p.death_date,
                birth_place: patch.birth_place ?? p.birth_place,
                bio: patch.bio ?? p.bio,
                profile_image: patch.profile_image ?? p.profile_image,
              }
            : p,
        ),
      );

      await new Promise<void>((resolve) => {
        startTransition(async () => {
          try {
            const result = await updatePersonAction(treeId, personId, patch);
            if (!result.ok) {
              setLastError(result.error.message);
              setPersons((prev) => prev.map((p) => (p.id === personId ? snapshot : p)));
            } else {
              setLastError(null);
            }
          } catch (err) {
            setLastError(err instanceof Error ? err.message : 'Unknown error');
            setPersons((prev) => prev.map((p) => (p.id === personId ? snapshot : p)));
          }
          resolve();
        });
      });
    },
    [treeId, persons],
  );

  // ── deletePerson ───────────────────────────────────────────────
  const deletePerson = useCallback<UseTreeMutationsResult['deletePerson']>(
    async (personId) => {
      const personSnapshot = persons.find((p) => p.id === personId);
      const relSnapshot = relationships.filter(
        (r) => r.person1_id === personId || r.person2_id === personId,
      );
      if (!personSnapshot) return;

      setPersons((prev) => prev.filter((p) => p.id !== personId));
      setRelationships((prev) =>
        prev.filter((r) => r.person1_id !== personId && r.person2_id !== personId),
      );

      await new Promise<void>((resolve) => {
        startTransition(async () => {
          try {
            const mappedResult = await asMutationResult(() =>
              apiClient.delete<{ id: string }>(`${treeRouteBase}/remove-person`, {
                treeId,
                personId,
              }),
            );
            if (!mappedResult.ok) {
              setLastError(mappedResult.error.message);
              setPersons((prev) => [...prev, personSnapshot]);
              setRelationships((prev) => [...prev, ...relSnapshot]);
            } else {
              setLastError(null);
            }
          } catch (err) {
            setLastError(err instanceof Error ? err.message : 'Unknown error');
            setPersons((prev) => [...prev, personSnapshot]);
            setRelationships((prev) => [...prev, ...relSnapshot]);
          }
          resolve();
        });
      });
    },
    [asMutationResult, treeId, treeRouteBase, persons, relationships],
  );

  return {
    persons,
    relationships,
    createPerson,
    addParent,
    addSpouse,
    addChild,
    updatePerson,
    deletePerson,
    isSaving: isPending,
    lastError,
    clearError: () => setLastError(null),
  };
}
