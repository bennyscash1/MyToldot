'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useLocale } from 'next-intl';

import type { AddedRelativeDto } from '@/server/services/tree.service';
import {
  updatePersonAction,
} from '@/server/actions/person.actions';
import { commitDiscoveredMemberAction } from '@/server/actions/family-discovery.actions';
import type { FamilyMemberProposalDto } from '@/features/nudges/lib/family-discovery-types';
import { proposalToPersonInput } from '@/features/family-tree/lib/proposal-to-person';
import type {
  PersonInput,
  PersonPatch,
} from '@/features/family-tree/schemas/person.schema';
import { deriveHebrewDateFields } from '@/features/persons/lib/hebrewDate';
import {
  openQuotaFromError,
  useQuotaDialog,
} from '@/components/providers/QuotaDialogProvider';
import { apiClient, ServiceError } from '@/services/api.client';
import type { PersonRow, RelationshipRow } from '../lib/types';
import { resolveCoParentIdsForChild } from '../lib/currentSpouses';

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
  treeRouteCode: string;
  initialPersons: PersonRow[];
  initialRelationships: RelationshipRow[];
  /** Invoked after every successful mutation. Used by the nudges panel to refetch. */
  onMutationDone?: () => void;
}

export interface UseTreeMutationsResult {
  persons: PersonRow[];
  relationships: RelationshipRow[];
  /** Creates a standalone person (no relationships). Returns the new person's id, or null on failure. */
  createPerson: (input: PersonInput) => Promise<string | null>;
  addParent: (args: { childId: string; parent: PersonInput; adoptive?: boolean }) => Promise<boolean>;
  addSpouse: (args: { personId: string; spouse: PersonInput; marriage_date?: Date | null }) => Promise<boolean>;
  /** Returns the new child's id after a successful create (real id, not temp). */
  addChild: (args: {
    parent1Id: string;
    parent2Id?: string | null;
    child: PersonInput;
    skipSpouseAutoLink?: boolean;
  }) => Promise<string | null>;
  addSibling: (args: { existingSiblingId: string; sibling: PersonInput }) => Promise<boolean>;
  /** Commits an AI-discovered family member proposal with optimistic canvas update. */
  commitDiscoveredMember: (proposal: FamilyMemberProposalDto) => Promise<boolean>;
  updatePerson: (args: { personId: string; patch: PersonPatch }) => Promise<void>;
  deletePerson: (personId: string) => Promise<void>;
  isSaving: boolean;
  lastError: string | null;
  clearError: () => void;
  lastBlocked: { ownerEmail?: string } | null;
  clearBlocked: () => void;
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
  const isDeceased = input.is_deceased ?? false;
  const birthDate = input.birth_date ?? null;
  const deathDate = isDeceased ? input.death_date ?? null : null;
  const hebrew = deriveHebrewDateFields({
    birth_date: birthDate,
    death_date: deathDate,
    is_deceased: isDeceased,
  });
  return {
    id,
    first_name: input.first_name,
    last_name: input.last_name ?? null,
    maiden_name: input.maiden_name ?? null,
    first_name_he: input.first_name_he ?? null,
    last_name_he: input.last_name_he ?? null,
    gender: input.gender,
    birth_date: birthDate,
    death_date: deathDate,
    is_deceased: isDeceased,
    ...hebrew,
    birth_place: input.birth_place ?? null,
    bio: input.bio ?? null,
    profile_image: input.profile_image ?? null,
    profile_image_url: input.profile_image_url ?? null,
  };
}

export function useTreeMutations({
  treeId,
  treeRouteCode,
  initialPersons,
  initialRelationships,
  onMutationDone,
}: UseTreeMutationsArgs): UseTreeMutationsResult {
  const locale = useLocale();
  const { showQuotaDialog } = useQuotaDialog();
  const treeRouteBase = `/${locale}/tree/${treeRouteCode}`;
  const [persons, setPersons] = useState<PersonRow[]>(initialPersons);
  const [relationships, setRelationships] = useState<RelationshipRow[]>(initialRelationships);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastBlocked, setLastBlocked] = useState<{ ownerEmail?: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const routeCodeRef = useRef(treeRouteCode);

  // Switching families (client nav) must replace hook state — useState only
  // reads initial* on first mount.
  useEffect(() => {
    if (routeCodeRef.current === treeRouteCode) return;
    routeCodeRef.current = treeRouteCode;
    setPersons(initialPersons);
    setRelationships(initialRelationships);
    setLastError(null);
    setLastBlocked(null);
  }, [treeRouteCode, initialPersons, initialRelationships]);

  // One-way re-seed: when the tree transitions from empty to populated
  // (via router.refresh() after creating the first person), pull the new
  // initial data into hook state. Safe because no optimistic edits exist
  // on an empty tree, so there's nothing to clobber. Does NOT fire on
  // subsequent updates — the hook remains the single writer for populated trees.
  useEffect(() => {
    if (initialPersons.length === 0) return;
    setPersons((prev) => (prev.length === 0 ? initialPersons : prev));
    setRelationships((prev) => (prev.length === 0 ? initialRelationships : prev));
  }, [initialPersons, initialRelationships]);

  const asMutationResult = useCallback(
    async <T,>(run: () => Promise<T>) => {
      try {
        return { ok: true as const, data: await run() };
      } catch (err) {
        if (err instanceof ServiceError) {
          return {
            ok: false as const,
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
            },
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
        | {
            ok: false;
            error: { code: string; message: string; details?: Record<string, unknown> };
          }
      >;
      /** Called on success to compute id-swap instructions. */
      onSuccess?: (data: T) => {
        swapPersonIds?: Record<string, string>;
        swapRelationshipIds?: Record<string, string>;
        /** Extra relationship rows returned by the server but not staged optimistically. */
        appendRelationships?: RelationshipRow[];
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
          if (result.error.code === 'BRANCHING_NOT_ALLOWED') {
            const raw = result.error.details?.ownerEmail;
            const ownerEmail = typeof raw === 'string' ? raw : undefined;
            setLastBlocked({ ownerEmail });
            setLastError(null);
          } else if (openQuotaFromError(showQuotaDialog, result.error)) {
            setLastBlocked(null);
            setLastError(null);
          } else {
            setLastBlocked(null);
            setLastError(result.error.message);
          }
          setPersons((prev) => prev.filter((p) => !tempPersonIds.has(p.id)));
          setRelationships((prev) => prev.filter((r) => !tempRelIds.has(r.id)));
          return undefined;
        }

        const swaps = onSuccess?.(result.data) ?? {};
        const { swapPersonIds = {}, swapRelationshipIds = {}, appendRelationships = [] } = swaps;

        setPersons((prev) =>
          prev.map((p) => (swapPersonIds[p.id] ? { ...p, id: swapPersonIds[p.id] } : p)),
        );
        setRelationships((prev) => {
          const remapped = prev.map((r) => {
            let next = r;
            if (swapRelationshipIds[r.id]) next = { ...next, id: swapRelationshipIds[r.id] };
            if (swapPersonIds[r.person1_id]) {
              next = { ...next, person1_id: swapPersonIds[r.person1_id] };
            }
            if (swapPersonIds[r.person2_id]) {
              next = { ...next, person2_id: swapPersonIds[r.person2_id] };
            }
            return next;
          });
          return appendRelationships.length > 0 ? [...remapped, ...appendRelationships] : remapped;
        });
        setLastError(null);
        setLastBlocked(null);
        onMutationDone?.();
        return result.data;
      } catch (err) {
        setLastBlocked(null);
        setLastError(err instanceof Error ? err.message : 'Unknown error');
        setPersons((prev) => prev.filter((p) => !tempPersonIds.has(p.id)));
        setRelationships((prev) => prev.filter((r) => !tempRelIds.has(r.id)));
        return undefined;
      }
    },
    [onMutationDone, showQuotaDialog],
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
      let success = false;
      await new Promise<void>((resolve) => {
        startTransition(async () => {
          const data = await runOptimistic({
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
            onSuccess: (d) => ({
              swapPersonIds: { [newPersonId]: d.person.id },
              swapRelationshipIds: { [newRelId]: d.relationship_ids[0] },
            }),
          });
          success = data !== undefined;
          resolve();
        });
      });
      return success;
    },
    [asMutationResult, treeId, treeRouteBase, runOptimistic],
  );

  // ── addSpouse ──────────────────────────────────────────────────
  const addSpouse = useCallback<UseTreeMutationsResult['addSpouse']>(
    async ({ personId, spouse, marriage_date }) => {
      const focusedPerson = persons.find((p) => p.id === personId);
      if (!focusedPerson) {
        setLastError('Focused person was not found');
        return false;
      }
      const spouseGender = oppositeBinaryGender(focusedPerson.gender);
      if (!spouseGender) {
        setLastError('Cannot add spouse unless the focused person is male or female.');
        return false;
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
      let success = false;
      await new Promise<void>((resolve) => {
        startTransition(async () => {
          const data = await runOptimistic({
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
            onSuccess: (d) => ({
              swapPersonIds: { [newPersonId]: d.person.id },
              swapRelationshipIds: { [newRelId]: d.relationship_ids[0] },
            }),
          });
          success = data !== undefined;
          resolve();
        });
      });
      return success;
    },
    [asMutationResult, treeId, treeRouteBase, persons, runOptimistic],
  );

  // ── addChild ───────────────────────────────────────────────────
  const addChild = useCallback<UseTreeMutationsResult['addChild']>(
    async ({ parent1Id, parent2Id, child, skipSpouseAutoLink }) => {
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
                  ...(skipSpouseAutoLink ? { skipSpouseAutoLink: true } : {}),
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

  // ── addSibling ─────────────────────────────────────────────────
  const addSibling = useCallback<UseTreeMutationsResult['addSibling']>(
    async ({ existingSiblingId, sibling }) => {
      const parentRels = relationships.filter(
        (r) =>
          r.person2_id === existingSiblingId &&
          (r.relationship_type === 'PARENT_CHILD' || r.relationship_type === 'ADOPTED_PARENT'),
      );

      const newPersonId = tmpId('person');
      const tempPerson = inputToRow(newPersonId, sibling);

      if (parentRels.length === 0) {
        const newRelId = tmpId('rel');
        const tempRel: RelationshipRow = {
          id: newRelId,
          relationship_type: 'SIBLING',
          person1_id: existingSiblingId,
          person2_id: newPersonId,
          start_date: null,
          end_date: null,
        };
        let success = false;
        await new Promise<void>((resolve) => {
          startTransition(async () => {
            const data = await runOptimistic({
              tempPersons: [tempPerson],
              tempRelationships: [tempRel],
              run: () =>
                asMutationResult(() =>
                  apiClient.post<AddedRelativeDto>(`${treeRouteBase}/add-sibling`, {
                    treeId,
                    existingSiblingId,
                    sibling,
                  }),
                ),
              onSuccess: (d) => ({
                swapPersonIds: { [newPersonId]: d.person.id },
                swapRelationshipIds: { [newRelId]: d.relationship_ids[0] },
              }),
            });
            success = data !== undefined;
            resolve();
          });
        });
        return success;
      }

      const tempRels: RelationshipRow[] = parentRels.map((pr) => ({
        id: tmpId('rel'),
        relationship_type: pr.relationship_type,
        person1_id: pr.person1_id,
        person2_id: newPersonId,
        start_date: null,
        end_date: null,
      }));

      let success = false;
      await new Promise<void>((resolve) => {
        startTransition(async () => {
          const data = await runOptimistic({
            tempPersons: [tempPerson],
            tempRelationships: tempRels,
            run: () =>
              asMutationResult(() =>
                apiClient.post<AddedRelativeDto>(`${treeRouteBase}/add-sibling`, {
                  treeId,
                  existingSiblingId,
                  sibling,
                }),
              ),
            onSuccess: (d) => {
              const swapRelationshipIds: Record<string, string> = {};
              tempRels.forEach((tr, i) => {
                const realId = d.relationship_ids[i];
                if (realId) swapRelationshipIds[tr.id] = realId;
              });
              return {
                swapPersonIds: { [newPersonId]: d.person.id },
                swapRelationshipIds,
              };
            },
          });
          success = data !== undefined;
          resolve();
        });
      });
      return success;
    },
    [asMutationResult, treeId, treeRouteBase, relationships, runOptimistic],
  );

  // ── commitDiscoveredMember ─────────────────────────────────────
  const commitDiscoveredMember = useCallback<
    UseTreeMutationsResult['commitDiscoveredMember']
  >(
    async (proposal) => {
      let personInput = proposalToPersonInput(proposal);
      const { relatedToPersonId, type } = proposal.relationship;

      const newPersonId = tmpId('person');
      let tempRelationships: RelationshipRow[] = [];
      /** Set for CHILD proposals — used to sync extra server relationship rows. */
      let childParentIds: string[] | null = null;

      if (type === 'PARENT') {
        tempRelationships = [
          {
            id: tmpId('rel'),
            relationship_type: 'PARENT_CHILD',
            person1_id: newPersonId,
            person2_id: relatedToPersonId,
            start_date: null,
            end_date: null,
          },
        ];
      } else if (type === 'CHILD') {
        childParentIds = resolveCoParentIdsForChild(relatedToPersonId, relationships);
        tempRelationships = childParentIds.map((pid) => ({
          id: tmpId('rel'),
          relationship_type: 'PARENT_CHILD' as const,
          person1_id: pid,
          person2_id: newPersonId,
          start_date: null,
          end_date: null,
        }));
      } else if (type === 'SPOUSE') {
        const focusedPerson = persons.find((p) => p.id === relatedToPersonId);
        if (!focusedPerson) {
          setLastError('Focused person was not found');
          return false;
        }
        const spouseGender = oppositeBinaryGender(focusedPerson.gender);
        if (!spouseGender) {
          setLastError('Cannot add spouse unless the focused person is male or female.');
          return false;
        }
        personInput = { ...personInput, gender: spouseGender };
        tempRelationships = [
          {
            id: tmpId('rel'),
            relationship_type: 'SPOUSE',
            person1_id: relatedToPersonId,
            person2_id: newPersonId,
            start_date: null,
            end_date: null,
          },
        ];
      } else if (type === 'SIBLING') {
        const parentRels = relationships.filter(
          (r) =>
            r.person2_id === relatedToPersonId &&
            (r.relationship_type === 'PARENT_CHILD' || r.relationship_type === 'ADOPTED_PARENT'),
        );
        if (parentRels.length === 0) {
          tempRelationships = [
            {
              id: tmpId('rel'),
              relationship_type: 'SIBLING',
              person1_id: relatedToPersonId,
              person2_id: newPersonId,
              start_date: null,
              end_date: null,
            },
          ];
        } else {
          tempRelationships = parentRels.map((pr) => ({
            id: tmpId('rel'),
            relationship_type: pr.relationship_type,
            person1_id: pr.person1_id,
            person2_id: newPersonId,
            start_date: null,
            end_date: null,
          }));
        }
      }

      const tempPerson = inputToRow(newPersonId, personInput);
      let success = false;

      await new Promise<void>((resolve) => {
        startTransition(async () => {
          const data = await runOptimistic({
            tempPersons: [tempPerson],
            tempRelationships,
            run: async () => {
              const result = await commitDiscoveredMemberAction(treeId, proposal);
              if (result.ok) return { ok: true as const, data: result.data };
              return {
                ok: false as const,
                error: {
                  code: result.error.code,
                  message: result.error.message,
                  details: result.error.details,
                },
              };
            },
            onSuccess: (d) => {
              const swapRelationshipIds: Record<string, string> = {};
              tempRelationships.forEach((tr, i) => {
                const realId = d.relationship_ids[i];
                if (realId) swapRelationshipIds[tr.id] = realId;
              });

              const realChildId = d.person.id;
              const appendRelationships: RelationshipRow[] = [];
              if (type === 'CHILD' && childParentIds) {
                for (let i = tempRelationships.length; i < d.relationship_ids.length; i += 1) {
                  const relId = d.relationship_ids[i];
                  if (!relId) continue;
                  appendRelationships.push({
                    id: relId,
                    relationship_type: 'PARENT_CHILD',
                    person1_id: childParentIds[i] ?? relatedToPersonId,
                    person2_id: realChildId,
                    start_date: null,
                    end_date: null,
                  });
                }
              }

              return {
                swapPersonIds: { [newPersonId]: realChildId },
                swapRelationshipIds,
                appendRelationships,
              };
            },
          });
          success = data !== undefined;
          resolve();
        });
      });

      return success;
    },
    [persons, relationships, runOptimistic, treeId],
  );

  // ── updatePerson ───────────────────────────────────────────────
  const updatePerson = useCallback<UseTreeMutationsResult['updatePerson']>(
    async ({ personId, patch }) => {
      // Snapshot for rollback.
      const snapshot = persons.find((p) => p.id === personId);
      if (!snapshot) return;

      setPersons((prev) =>
        prev.map((p) => {
          if (p.id !== personId) return p;
          const nextIsDeceased = patch.is_deceased ?? p.is_deceased;
          const nextBirthDate = patch.birth_date ?? p.birth_date;
          // Mirror server invariant: flipping to alive clears death_date.
          const nextDeathDate =
            patch.is_deceased === false
              ? null
              : (patch.death_date ?? p.death_date);
          const hebrew = deriveHebrewDateFields({
            birth_date: nextBirthDate,
            death_date: nextDeathDate,
            is_deceased: nextIsDeceased,
          });
          return {
            ...p,
            first_name: patch.first_name ?? p.first_name,
            last_name: patch.last_name ?? p.last_name,
            first_name_he: patch.first_name_he ?? p.first_name_he,
            last_name_he: patch.last_name_he ?? p.last_name_he,
            maiden_name: patch.maiden_name ?? p.maiden_name,
            gender: patch.gender ?? p.gender,
            birth_date: nextBirthDate,
            death_date: nextDeathDate,
            is_deceased: nextIsDeceased,
            ...hebrew,
            birth_place: patch.birth_place ?? p.birth_place,
            bio: patch.bio ?? p.bio,
            profile_image:
              patch.profile_image !== undefined ? patch.profile_image : p.profile_image,
            profile_image_url:
              patch.profile_image_url !== undefined
                ? patch.profile_image_url
                : p.profile_image_url,
          };
        }),
      );

      await new Promise<void>((resolve) => {
        startTransition(async () => {
          try {
            const result = await updatePersonAction(treeId, personId, patch);
            if (!result.ok) {
              if (!openQuotaFromError(showQuotaDialog, result.error)) {
                setLastError(result.error.message);
              } else {
                setLastError(null);
              }
              setPersons((prev) => prev.map((p) => (p.id === personId ? snapshot : p)));
            } else {
              setLastError(null);
              onMutationDone?.();
            }
          } catch (err) {
            setLastError(err instanceof Error ? err.message : 'Unknown error');
            setPersons((prev) => prev.map((p) => (p.id === personId ? snapshot : p)));
          }
          resolve();
        });
      });
    },
    [treeId, persons, onMutationDone, showQuotaDialog],
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
              if (!openQuotaFromError(showQuotaDialog, mappedResult.error)) {
                setLastError(mappedResult.error.message);
              } else {
                setLastError(null);
              }
              setPersons((prev) => [...prev, personSnapshot]);
              setRelationships((prev) => [...prev, ...relSnapshot]);
            } else {
              setLastError(null);
              onMutationDone?.();
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
    [asMutationResult, treeId, treeRouteBase, persons, relationships, onMutationDone, showQuotaDialog],
  );

  return {
    persons,
    relationships,
    createPerson,
    addParent,
    addSpouse,
    addChild,
    addSibling,
    commitDiscoveredMember,
    updatePerson,
    deletePerson,
    isSaving: isPending,
    lastError,
    clearError: () => setLastError(null),
    lastBlocked,
    clearBlocked: () => setLastBlocked(null),
  };
}
