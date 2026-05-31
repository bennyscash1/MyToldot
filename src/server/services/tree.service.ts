import { z } from 'zod';
import type { Prisma, RelationshipType, TreeMemberRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  MAX_CAPTION_LENGTH,
  MAX_PHOTOS_PER_PERSON,
  MAX_PHOTO_BYTES,
} from '@/lib/images/gallery-upload-constraints';
import {
  buildPersonGalleryPath,
  deletePersonGalleryObject,
  isAllowedGalleryMime,
  processGalleryUploadImage,
  uploadPersonGalleryAdmin,
} from '@/lib/images/gallery-storage';
import { deleteProfileImage } from '@/lib/supabase/storage';
import { requireAuthUser, requireTreeRole } from '@/lib/api/auth';
import { isPersonAllowed } from '@/lib/api/branching';
import { Errors } from '@/lib/api/errors';
import { generateUniqueTreeSlug, generateUniqueTreeShortCode } from '@/lib/tree/slug';
import {
  PersonInputSchema,
  PersonPatchSchema,
  CuidSchema,
  type PersonInput,
  type PersonPatch,
} from '@/features/family-tree/schemas/person.schema';
import type { PersonPhotoDTO, PersonRow, RelationshipRow } from '@/features/family-tree/lib/types';
import {
  withHebrewDatesForCreate,
  withHebrewDatesForUpdate,
} from '@/server/lib/person-dates';
import { applyProfileImagePatch } from '@/server/lib/profile-image-patch';
import { resolveExternalImageUrl } from '@/lib/images/validate-external-image-url';
import { extractPathsFromAboutJson } from '@/lib/tree/about-images';

export interface PersonDto {
  id: string;
  first_name: string;
  last_name: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN';
  birth_date: Date | null;
  death_date: Date | null;
  is_deceased: boolean;
  birth_date_hebrew: string | null;
  birth_year_hebrew: string | null;
  death_date_hebrew: string | null;
  death_year_hebrew: string | null;
}

export interface AddedRelativeDto {
  person: { id: string; first_name: string; last_name: string | null };
  relationship_ids: string[];
}

export type { PersonPhotoDTO } from '@/features/family-tree/lib/types';

export interface TreePageData {
  treeId: string | null;
  treeName: string | null;
  personCount: number;
  membershipRole: TreeMemberRole | null;
  /** Supabase user id of the current viewer, or null for anonymous visitors. */
  viewerUserId: string | null;
  /** Owner display name + email, gated to EDITOR_PENDING / EDITOR / OWNER viewers only. */
  ownerContact: { displayName: string; email: string } | null;
  rootPersonId: string | null;
  linkedPersonId: string | null;
  /** Mirrors `Tree.strict_lineage_enforcement` when a tree is loaded. */
  strictLineageEnforcement: boolean;
  initialPersons: PersonRow[];
  initialRelationships: RelationshipRow[];
  initialFocalId: string | null;
  photosByPerson: Record<string, PersonPhotoDTO[]>;
}

function toPersonPhotoDTO(row: {
  id: string;
  person_id: string;
  tree_id: string;
  storage_path: string | null;
  image_url: string | null;
  caption: string | null;
  sort_order: number;
  created_at: Date;
}): PersonPhotoDTO {
  return {
    id: row.id,
    person_id: row.person_id,
    tree_id: row.tree_id,
    storage_path: row.storage_path,
    image_url: row.image_url,
    caption: row.caption,
    sort_order: row.sort_order,
    created_at: row.created_at.toISOString(),
  };
}

function groupPhotosByPerson(
  rows: Parameters<typeof toPersonPhotoDTO>[0][],
): Record<string, PersonPhotoDTO[]> {
  const photosByPerson: Record<string, PersonPhotoDTO[]> = {};
  for (const row of rows) {
    const dto = toPersonPhotoDTO(row);
    (photosByPerson[row.person_id] ??= []).push(dto);
  }
  return photosByPerson;
}

const PERSON_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  gender: true,
  birth_date: true,
  death_date: true,
  is_deceased: true,
  birth_date_hebrew: true,
  birth_year_hebrew: true,
  death_date_hebrew: true,
  death_year_hebrew: true,
} as const;

const PERSON_LIST_SELECT = {
  id: true,
  first_name: true,
  last_name: true,
  maiden_name: true,
  first_name_he: true,
  last_name_he: true,
  gender: true,
  birth_date: true,
  death_date: true,
  is_deceased: true,
  birth_date_hebrew: true,
  birth_year_hebrew: true,
  death_date_hebrew: true,
  death_year_hebrew: true,
  birth_place: true,
  bio: true,
  profile_image: true,
  profile_image_url: true,
} as const;

const PERSON_PHOTO_SELECT = {
  id: true,
  person_id: true,
  tree_id: true,
  storage_path: true,
  image_url: true,
  caption: true,
  sort_order: true,
  created_at: true,
} as const;

const OptionalDate = z
  .union([z.string().min(1), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)))
  .refine((d) => !Number.isNaN(d.getTime()), { message: 'Invalid date' })
  .optional()
  .nullable();

export const AddSpouseSchema = z.object({
  treeId: CuidSchema,
  personId: CuidSchema,
  spouse: PersonInputSchema,
  marriage_date: OptionalDate,
});

export const AddParentSchema = z.object({
  treeId: CuidSchema,
  childId: CuidSchema,
  parent: PersonInputSchema,
  adoptive: z.boolean().optional(),
});

export const AddChildSchema = z.object({
  treeId: CuidSchema,
  parent1Id: CuidSchema,
  parent2Id: CuidSchema.optional().nullable(),
  skipSpouseAutoLink: z.boolean().optional(),
  child: PersonInputSchema,
});

export const AddSiblingSchema = z.object({
  treeId: CuidSchema,
  existingSiblingId: CuidSchema,
  sibling: PersonInputSchema,
});

export const RemovePersonSchema = z.object({
  treeId: CuidSchema,
  personId: CuidSchema,
});

async function assertPersonsInTree(
  tx: Prisma.TransactionClient,
  treeId: string,
  personIds: string[],
): Promise<void> {
  const uniqueIds = [...new Set(personIds)];
  const count = await tx.person.count({
    where: { id: { in: uniqueIds }, tree_id: treeId },
  });
  if (count !== uniqueIds.length) throw Errors.notFound('Person');
}

function normalizeSymmetric(
  a: string,
  b: string,
  type: RelationshipType,
): [string, string] {
  const symmetric: RelationshipType[] = ['SPOUSE', 'SIBLING', 'ENGAGED', 'DIVORCED'];
  return symmetric.includes(type) && a > b ? [b, a] : [a, b];
}

function oppositeBinaryGender(
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN',
): 'MALE' | 'FEMALE' {
  if (gender === 'MALE') return 'FEMALE';
  if (gender === 'FEMALE') return 'MALE';
  throw Errors.badRequest('Cannot add spouse unless the focused person gender is male or female');
}

/**
 * Lightweight tree-scope resolver for pages that only need a treeId
 * (e.g. About page). Mirrors the resolution rules of `resolveTreePageData`:
 *  - Authenticated user → first tree they are a member of.
 *  - Otherwise (guest/MVP) → first tree in the database.
 *  - Returns null when the DB is unreachable or no tree exists.
 */
export async function resolveCurrentTreeId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    if (user) {
      const membership = await prisma.treeMember.findFirst({
        where: { user_id: user.id },
        orderBy: { joined_at: 'asc' },
        select: { tree_id: true },
      });
      if (membership?.tree_id) return membership.tree_id;
    }

    const firstTree = await prisma.tree.findFirst({
      orderBy: { created_at: 'asc' },
      select: { id: true },
    });
    return firstTree?.id ?? null;
  } catch {
    return null;
  }
}

const TREE_ROUTE_LOOKUP_SELECT = {
  id: true,
  name: true,
  description: true,
  main_surnames: true,
  about_images: true,
  is_public: true,
  root_person_id: true,
  strict_lineage_enforcement: true,
  allow_branching: true,
  _count: { select: { persons: true } },
} as const;

/**
 * Resolves a tree from the URL segment: 5-digit `shortCode` first, else legacy `slug`.
 */
export async function findTreeByRouteParam(routeParam: string) {
  const p = routeParam.trim();
  if (/^\d{5}$/.test(p)) {
    const byCode = await prisma.tree.findUnique({
      where: { shortCode: p },
      select: TREE_ROUTE_LOOKUP_SELECT,
    });
    if (byCode) return byCode;
  }
  return prisma.tree.findUnique({
    where: { slug: p },
    select: TREE_ROUTE_LOOKUP_SELECT,
  });
}

export async function resolveTreeIdFromRouteParam(routeParam: string): Promise<string> {
  const tree = await findTreeByRouteParam(routeParam);
  if (!tree) throw Errors.notFound('Tree');
  return tree.id;
}

/** @deprecated Use resolveTreeIdFromRouteParam */
export const resolveTreeIdFromSlug = resolveTreeIdFromRouteParam;

/** Segment used in `/[locale]/tree/[shortCode]` for `revalidatePath`. */
export async function resolveTreeRouteRevalidateSegment(
  treeId: string,
): Promise<string | null> {
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: { shortCode: true, slug: true },
  });
  return tree?.shortCode ?? tree?.slug ?? null;
}

/** @deprecated Use resolveTreeRouteRevalidateSegment */
export async function resolveTreeSlugFromId(treeId: string): Promise<string | null> {
  return resolveTreeRouteRevalidateSegment(treeId);
}

export async function resolveTreePageData(): Promise<TreePageData> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let treeId: string | null = null;
  let treeName: string | null = null;
  let personCount = 0;
  let membershipRole: TreeMemberRole | null = null;
  let rootPersonId: string | null = null;
  let linkedPersonId: string | null = null;
  let strictLineageEnforcement = false;

  try {
    if (user) {
      const membership = await prisma.treeMember.findFirst({
        where: { user_id: user.id },
        orderBy: { joined_at: 'asc' },
        select: {
          role: true,
          linked_person_id: true,
          tree: {
            select: {
              id: true,
              name: true,
              root_person_id: true,
              strict_lineage_enforcement: true,
              _count: { select: { persons: true } },
            },
          },
        },
      });

      if (membership?.tree) {
        treeId = membership.tree.id;
        treeName = membership.tree.name;
        personCount = membership.tree._count.persons;
        membershipRole = membership.role;
        rootPersonId = membership.tree.root_person_id;
        linkedPersonId = membership.linked_person_id;
        strictLineageEnforcement = membership.tree.strict_lineage_enforcement;
      }
    } else {
      let firstTree = await prisma.tree.findFirst({
        orderBy: { created_at: 'asc' },
        select: {
          id: true,
          name: true,
          root_person_id: true,
          strict_lineage_enforcement: true,
          _count: { select: { persons: true } },
        },
      });

      if (!firstTree) {
        const slug = await generateUniqueTreeSlug(prisma);
        const shortCode = await generateUniqueTreeShortCode(prisma);
        firstTree = await prisma.tree.create({
          data: { slug, shortCode, name: 'עץ המשפחה', is_public: true },
          select: {
            id: true,
            slug: true,
            name: true,
            root_person_id: true,
            strict_lineage_enforcement: true,
            _count: { select: { persons: true } },
          },
        });
      }

      treeId = firstTree.id;
      treeName = firstTree.name;
      personCount = firstTree._count.persons;
      rootPersonId = firstTree.root_person_id;
      strictLineageEnforcement = firstTree.strict_lineage_enforcement;
    }
  } catch {
    // DB unavailable: preserve page behavior by returning no-tree state.
  }

  if (!treeId) {
    return {
      treeId: null,
      treeName: null,
      personCount: 0,
      membershipRole: null,
      viewerUserId: user?.id ?? null,
      ownerContact: null,
      rootPersonId: null,
      linkedPersonId: null,
      strictLineageEnforcement: false,
      initialPersons: [],
      initialRelationships: [],
      initialFocalId: null,
      photosByPerson: {},
    };
  }

  let initialPersons: PersonRow[] = [];
  let initialRelationships: RelationshipRow[] = [];
  let photosByPerson: Record<string, PersonPhotoDTO[]> = {};

  if (personCount > 0) {
    const [personRows, relRows, photoRows] = await Promise.all([
      prisma.person.findMany({
        where: { tree_id: treeId },
        select: PERSON_LIST_SELECT,
        orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
      }),
      prisma.relationship.findMany({
        where: { tree_id: treeId },
        select: {
          id: true,
          relationship_type: true,
          person1_id: true,
          person2_id: true,
          start_date: true,
          end_date: true,
        },
      }),
      prisma.personPhoto.findMany({
        where: { tree_id: treeId },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
        select: PERSON_PHOTO_SELECT,
      }),
    ]);

    initialPersons = personRows.map((p) => ({ ...p, bio: p.bio ?? null }));
    initialRelationships = relRows.map((r) => ({
      id: r.id,
      relationship_type: r.relationship_type as RelationshipRow['relationship_type'],
      person1_id: r.person1_id,
      person2_id: r.person2_id,
      start_date: r.start_date,
      end_date: r.end_date,
    }));
    photosByPerson = groupPhotosByPerson(photoRows);
  }

  return {
    treeId,
    treeName,
    personCount,
    membershipRole,
    viewerUserId: user?.id ?? null,
    ownerContact: null,
    rootPersonId,
    linkedPersonId,
    strictLineageEnforcement,
    initialPersons,
    initialRelationships,
    initialFocalId: linkedPersonId ?? rootPersonId ?? initialPersons[0]?.id ?? null,
    photosByPerson,
  };
}

export async function resolveTreePageDataBySlug(routeParam: string): Promise<TreePageData> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const tree = await findTreeByRouteParam(routeParam);
  if (!tree) throw Errors.notFound('Tree');

  let membershipRole: TreeMemberRole | null = null;
  let linkedPersonId: string | null = null;
  if (user) {
    const membership = await prisma.treeMember.findUnique({
      where: { tree_id_user_id: { tree_id: tree.id, user_id: user.id } },
      select: { role: true, linked_person_id: true },
    });
    membershipRole = membership?.role ?? null;
    linkedPersonId = membership?.linked_person_id ?? null;
  }

  // Public-by-link access rule:
  // any visitor with a valid tree slug may view tree data.
  // Editing/deletion remains protected by RBAC checks in mutation paths.

  // Owner contact info — only exposed to EDITOR_PENDING / EDITOR / OWNER viewers.
  // Fetched unconditionally (it's a tiny query) so the empty-tree branch also has it.
  const canSeeOwnerContact =
    membershipRole === 'EDITOR_PENDING' ||
    membershipRole === 'EDITOR' ||
    membershipRole === 'OWNER';
  const ownerRow = canSeeOwnerContact
    ? await prisma.treeMember.findFirst({
        where: { tree_id: tree.id, role: 'OWNER' },
        orderBy: { joined_at: 'asc' },
        select: { user: { select: { full_name: true, email: true } } },
      })
    : null;
  const ownerContact = ownerRow?.user
    ? {
        displayName: ownerRow.user.full_name?.trim() || ownerRow.user.email,
        email: ownerRow.user.email,
      }
    : null;

  const personCount = tree._count.persons;
  let initialPersons: PersonRow[] = [];
  let initialRelationships: RelationshipRow[] = [];
  const photosByPerson: Record<string, PersonPhotoDTO[]> = {};

  if (personCount > 0) {
    const [personRows, relRows] = await Promise.all([
      prisma.person.findMany({
        where: { tree_id: tree.id },
        select: PERSON_LIST_SELECT,
        orderBy: [{ last_name: 'asc' }, { first_name: 'asc' }],
      }),
      prisma.relationship.findMany({
        where: { tree_id: tree.id },
        select: {
          id: true,
          relationship_type: true,
          person1_id: true,
          person2_id: true,
          start_date: true,
          end_date: true,
        },
      }),
    ]);

    initialPersons = personRows.map((p) => ({ ...p, bio: p.bio ?? null }));
    initialRelationships = relRows.map((r) => ({
      id: r.id,
      relationship_type: r.relationship_type as RelationshipRow['relationship_type'],
      person1_id: r.person1_id,
      person2_id: r.person2_id,
      start_date: r.start_date,
      end_date: r.end_date,
    }));
  }

  return {
    treeId: tree.id,
    treeName: tree.name,
    personCount,
    membershipRole,
    viewerUserId: user?.id ?? null,
    ownerContact,
    rootPersonId: tree.root_person_id,
    linkedPersonId,
    strictLineageEnforcement: tree.strict_lineage_enforcement,
    initialPersons,
    initialRelationships,
    initialFocalId: linkedPersonId ?? tree.root_person_id ?? initialPersons[0]?.id ?? null,
    photosByPerson,
  };
}

/** Gallery photos for a tree — loaded on demand when the side panel opens. */
export async function resolveTreePhotosBySlug(
  routeParam: string,
): Promise<Record<string, PersonPhotoDTO[]>> {
  const tree = await findTreeByRouteParam(routeParam);
  if (!tree) throw Errors.notFound('Tree');
  if (tree._count.persons === 0) return {};

  const photoRows = await prisma.personPhoto.findMany({
    where: { tree_id: tree.id },
    orderBy: [{ sort_order: 'asc' }, { created_at: 'asc' }],
    select: PERSON_PHOTO_SELECT,
  });

  return groupPhotosByPerson(photoRows);
}

export async function createPersonInTree(
  treeId: string,
  input: PersonInput,
): Promise<PersonDto> {
  await requireTreeRole(treeId, 'EDITOR');
  const data = withHebrewDatesForCreate(PersonInputSchema.parse(input));

  const branching = await isPersonAllowed(treeId, { kind: 'standalone' });
  if (!branching.allowed) {
    throw Errors.branchingNotAllowed(branching.ownerEmail);
  }

  return prisma.person.create({
    data: { ...data, tree_id: treeId },
    select: PERSON_SELECT,
  });
}

export async function updatePersonInTree(
  treeId: string,
  personId: string,
  patch: PersonPatch,
): Promise<PersonDto> {
  await requireTreeRole(treeId, 'EDITOR');
  const id = CuidSchema.parse(personId);
  const parsed = PersonPatchSchema.parse(patch);

  const existing = await prisma.person.findFirst({
    where: { id, tree_id: treeId },
    select: {
      id: true,
      birth_date: true,
      death_date: true,
      is_deceased: true,
      profile_image: true,
      profile_image_url: true,
    },
  });
  if (!existing) throw Errors.notFound('Person');

  const data = withHebrewDatesForUpdate(parsed, existing);
  const profileImageData = await applyProfileImagePatch(existing, parsed);

  const { profile_image: _pi, profile_image_url: _pu, ...restData } = data;

  return prisma.person.update({
    where: { id },
    data: { ...restData, ...profileImageData },
    select: PERSON_LIST_SELECT,
  });
}

export async function removePersonFromTree(
  treeId: string,
  personId: string,
): Promise<{ id: string }> {
  await requireTreeRole(treeId, 'OWNER');
  const id = CuidSchema.parse(personId);

  const existing = await prisma.person.findFirst({
    where: { id, tree_id: treeId },
    select: { id: true, profile_image: true },
  });
  if (!existing) throw Errors.notFound('Person');

  if (existing.profile_image) {
    await deleteProfileImage(existing.profile_image);
  }

  const galleryPaths = await prisma.personPhoto.findMany({
    where: { person_id: id },
    select: { storage_path: true },
  });
  for (const { storage_path } of galleryPaths) {
    if (storage_path) {
      await deletePersonGalleryObject(storage_path);
    }
  }

  await prisma.person.delete({ where: { id } });
  return { id };
}

/**
 * Hard-delete an entire tree along with all its persons, relationships,
 * memberships, person photos, and Storage objects (profile images,
 * gallery images, about-page images).
 *
 * Caller MUST have already verified OWNER role for this tree — this
 * service does not re-check (mirrors the pattern of trusting the action
 * layer for confirm-code validation, which the service cannot evaluate).
 *
 * Order is critical:
 *   1) Pre-list every storage path BEFORE any DB delete (the cascade wipes
 *      the referencing rows, so we must collect paths first).
 *   2) Best-effort Storage cleanup via Promise.allSettled — a single missing
 *      object must not block the DB delete.
 *   3) Set tree.root_person_id = null defensively (schema is already SetNull,
 *      but this avoids any race with future schema drift).
 *   4) prisma.tree.delete — cascades persons, relationships, tree_members,
 *      and person_photos in one statement.
 */
export async function deleteTree(treeId: string): Promise<{ id: string }> {
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: { id: true, about_images: true },
  });
  if (!tree) throw Errors.notFound('Tree');

  const [personRows, photoRows] = await Promise.all([
    prisma.person.findMany({
      where: { tree_id: treeId, profile_image: { not: null } },
      select: { profile_image: true },
    }),
    prisma.personPhoto.findMany({
      where: { tree_id: treeId },
      select: { storage_path: true },
    }),
  ]);

  const profilePaths = personRows
    .map((p) => p.profile_image)
    .filter((p): p is string => !!p);
  const aboutPaths = extractPathsFromAboutJson(tree.about_images);
  const galleryPaths = photoRows
    .map((r) => r.storage_path)
    .filter((p): p is string => !!p);

  await Promise.allSettled([
    ...profilePaths.map((p) => deleteProfileImage(p)),
    ...aboutPaths.map((p) => deleteProfileImage(p)),
    ...galleryPaths.map((p) => deletePersonGalleryObject(p)),
  ]);

  await prisma.tree.update({
    where: { id: treeId },
    data: { root_person_id: null },
  });

  await prisma.tree.delete({ where: { id: treeId } });

  return { id: treeId };
}

function normalizePhotoCaption(caption: string | null | undefined): string | null {
  if (caption == null) return null;
  const t = caption.trim();
  if (!t) return null;
  return t.slice(0, MAX_CAPTION_LENGTH);
}

export async function addPersonPhotoToTree(params: {
  treeId: string;
  personId: string;
  buffer: Buffer;
  contentType: string;
  caption?: string | null;
}): Promise<PersonPhotoDTO> {
  const { treeId, personId, buffer, contentType } = params;
  const caption = normalizePhotoCaption(params.caption);

  const user = await requireAuthUser();
  await requireTreeRole(treeId, 'EDITOR');

  if (buffer.length === 0) {
    throw Errors.badRequest('Uploaded file is empty.');
  }
  if (buffer.length > MAX_PHOTO_BYTES) {
    throw Errors.unprocessable(
      `File too large. Maximum size is ${Math.round(MAX_PHOTO_BYTES / 1024 / 1024)} MB.`,
    );
  }
  if (!isAllowedGalleryMime(contentType)) {
    throw Errors.unprocessable(
      `Unsupported content-type "${contentType || 'unknown'}".`,
    );
  }

  const processed = await processGalleryUploadImage(buffer, contentType);
  const storagePath = buildPersonGalleryPath(treeId, personId, processed.contentType);

  await uploadPersonGalleryAdmin({
    path: storagePath,
    body: processed.buffer,
    contentType: processed.contentType,
  });

  try {
    const row = await prisma.$transaction(async (tx) => {
      await assertPersonsInTree(tx, treeId, [personId]);

      const count = await tx.personPhoto.count({
        where: { person_id: personId, tree_id: treeId },
      });
      if (count >= MAX_PHOTOS_PER_PERSON) {
        throw Errors.maxPhotosReached();
      }

      const maxOrder = await tx.personPhoto.aggregate({
        where: { person_id: personId, tree_id: treeId },
        _max: { sort_order: true },
      });
      const sortOrder = (maxOrder._max.sort_order ?? -1) + 1;

      return tx.personPhoto.create({
        data: {
          person_id: personId,
          tree_id: treeId,
          storage_path: storagePath,
          caption,
          sort_order: sortOrder,
          uploaded_by: user.id,
        },
        select: PERSON_PHOTO_SELECT,
      });
    });

    return toPersonPhotoDTO(row);
  } catch (err) {
    await deletePersonGalleryObject(storagePath);
    throw err;
  }
}

export async function addPersonPhotoFromUrl(params: {
  treeId: string;
  personId: string;
  imageUrl: string;
  caption?: string | null;
}): Promise<PersonPhotoDTO> {
  const { treeId, personId, imageUrl } = params;
  const caption = normalizePhotoCaption(params.caption);

  const user = await requireAuthUser();
  await requireTreeRole(treeId, 'EDITOR');

  const resolved = await resolveExternalImageUrl(imageUrl);
  if (!resolved.ok) {
    throw Errors.unprocessable(resolved.reason);
  }

  const row = await prisma.$transaction(async (tx) => {
    await assertPersonsInTree(tx, treeId, [personId]);

    const count = await tx.personPhoto.count({
      where: { person_id: personId, tree_id: treeId },
    });
    if (count >= MAX_PHOTOS_PER_PERSON) {
      throw Errors.maxPhotosReached();
    }

    const maxOrder = await tx.personPhoto.aggregate({
      where: { person_id: personId, tree_id: treeId },
      _max: { sort_order: true },
    });
    const sortOrder = (maxOrder._max.sort_order ?? -1) + 1;

    return tx.personPhoto.create({
      data: {
        person_id: personId,
        tree_id: treeId,
        image_url: resolved.url,
        storage_path: null,
        caption,
        sort_order: sortOrder,
        uploaded_by: user.id,
      },
      select: PERSON_PHOTO_SELECT,
    });
  });

  return toPersonPhotoDTO(row);
}

export async function addPersonPhotosFromUrls(params: {
  treeId: string;
  personId: string;
  photos: Array<{ imageUrl: string; caption?: string | null }>;
}): Promise<PersonPhotoDTO[]> {
  const results: PersonPhotoDTO[] = [];
  for (const photo of params.photos) {
    results.push(
      await addPersonPhotoFromUrl({
        treeId: params.treeId,
        personId: params.personId,
        imageUrl: photo.imageUrl,
        caption: photo.caption,
      }),
    );
  }
  return results;
}

export async function removePersonPhoto(photoId: string): Promise<{ id: string }> {
  const id = CuidSchema.parse(photoId);
  const existing = await prisma.personPhoto.findUnique({
    where: { id },
    select: { id: true, tree_id: true, storage_path: true },
  });
  if (!existing) throw Errors.notFound('Photo');

  await requireTreeRole(existing.tree_id, 'EDITOR');
  await prisma.personPhoto.delete({ where: { id } });
  if (existing.storage_path) {
    await deletePersonGalleryObject(existing.storage_path);
  }
  return { id };
}

export async function updatePersonPhotoCaption(params: {
  photoId: string;
  caption: string;
}): Promise<PersonPhotoDTO> {
  const id = CuidSchema.parse(params.photoId);
  const caption = normalizePhotoCaption(params.caption);

  const existing = await prisma.personPhoto.findUnique({
    where: { id },
    select: { tree_id: true },
  });
  if (!existing) throw Errors.notFound('Photo');

  await requireTreeRole(existing.tree_id, 'EDITOR');

  const row = await prisma.personPhoto.update({
    where: { id },
    data: { caption },
    select: PERSON_PHOTO_SELECT,
  });

  return toPersonPhotoDTO(row);
}

export async function addParentInTree(
  input: z.infer<typeof AddParentSchema>,
): Promise<AddedRelativeDto> {
  const { treeId, childId, parent, adoptive } = AddParentSchema.parse(input);
  await requireTreeRole(treeId, 'EDITOR');

  const branching = await isPersonAllowed(treeId, {
    kind: 'parent',
    anchorId: childId,
    adoptive: adoptive ?? false,
  });
  if (!branching.allowed) {
    throw Errors.branchingNotAllowed(branching.ownerEmail);
  }

  return prisma.$transaction(async (tx) => {
    await assertPersonsInTree(tx, treeId, [childId]);

    if (!adoptive) {
      const bioParentCount = await tx.relationship.count({
        where: { tree_id: treeId, person2_id: childId, relationship_type: 'PARENT_CHILD' },
      });
      if (bioParentCount >= 2) {
        throw Errors.conflict('This person already has two biological parents');
      }
    }

    const newPerson = await tx.person.create({
      data: { ...withHebrewDatesForCreate(parent), tree_id: treeId },
      select: { id: true, first_name: true, last_name: true },
    });

    const rel = await tx.relationship.create({
      data: {
        tree_id: treeId,
        relationship_type: adoptive ? 'ADOPTED_PARENT' : 'PARENT_CHILD',
        person1_id: newPerson.id,
        person2_id: childId,
      },
      select: { id: true },
    });

    return { person: newPerson, relationship_ids: [rel.id] };
  });
}

export async function addChildInTree(
  input: z.infer<typeof AddChildSchema>,
): Promise<AddedRelativeDto> {
  const parsed = AddChildSchema.parse(input);
  const { treeId, parent1Id, child, skipSpouseAutoLink } = parsed;
  let parent2Id = parsed.parent2Id ?? null;

  await requireTreeRole(treeId, 'EDITOR');
  if (parent2Id && parent1Id === parent2Id) {
    throw Errors.badRequest('parent1 and parent2 must differ');
  }

  if (!parent2Id && !skipSpouseAutoLink) {
    const spouseRels = await prisma.relationship.findMany({
      where: {
        tree_id: treeId,
        relationship_type: { in: ['SPOUSE', 'ENGAGED'] },
        OR: [{ person1_id: parent1Id }, { person2_id: parent1Id }],
      },
      select: { person1_id: true, person2_id: true },
    });
    const coParentIds = new Set<string>();
    for (const r of spouseRels) {
      const other = r.person1_id === parent1Id ? r.person2_id : r.person1_id;
      coParentIds.add(other);
    }
    if (coParentIds.size === 1) {
      parent2Id = [...coParentIds][0];
    }
  }

  const parentIds = parent2Id ? [parent1Id, parent2Id] : [parent1Id];

  const branching = await isPersonAllowed(treeId, { kind: 'child', anchorIds: parentIds });
  if (!branching.allowed) {
    throw Errors.branchingNotAllowed(branching.ownerEmail);
  }

  return prisma.$transaction(async (tx) => {
    await assertPersonsInTree(tx, treeId, parentIds);

    const newPerson = await tx.person.create({
      data: { ...withHebrewDatesForCreate(child), tree_id: treeId },
      select: { id: true, first_name: true, last_name: true },
    });

    const rels = await Promise.all(
      parentIds.map((pid) =>
        tx.relationship.create({
          data: {
            tree_id: treeId,
            relationship_type: 'PARENT_CHILD',
            person1_id: pid,
            person2_id: newPerson.id,
          },
          select: { id: true },
        }),
      ),
    );

    return { person: newPerson, relationship_ids: rels.map((r) => r.id) };
  });
}

export async function addSpouseInTree(
  input: z.infer<typeof AddSpouseSchema>,
): Promise<AddedRelativeDto> {
  const { treeId, personId, spouse, marriage_date } = AddSpouseSchema.parse(input);
  await requireTreeRole(treeId, 'EDITOR');

  const branching = await isPersonAllowed(treeId, { kind: 'spouse', anchorId: personId });
  if (!branching.allowed) {
    throw Errors.branchingNotAllowed(branching.ownerEmail);
  }

  return prisma.$transaction(async (tx) => {
    const focusedPerson = await tx.person.findFirst({
      where: { id: personId, tree_id: treeId },
      select: { id: true, gender: true },
    });
    if (!focusedPerson) throw Errors.notFound('Person');
    const enforcedSpouseGender = oppositeBinaryGender(focusedPerson.gender);

    const newPerson = await tx.person.create({
      data: {
        ...withHebrewDatesForCreate(spouse),
        gender: enforcedSpouseGender,
        tree_id: treeId,
      },
      select: { id: true, first_name: true, last_name: true },
    });

    const [p1, p2] = normalizeSymmetric(personId, newPerson.id, 'SPOUSE');
    const rel = await tx.relationship.create({
      data: {
        tree_id: treeId,
        relationship_type: 'SPOUSE',
        person1_id: p1,
        person2_id: p2,
        start_date: marriage_date ?? null,
      },
      select: { id: true },
    });

    return { person: newPerson, relationship_ids: [rel.id] };
  });
}

/**
 * Siblings share parents. We look up the existing sibling's PARENT_CHILD rows
 * and create matching ones for the new person. If there are no parents yet,
 * we fall back to a loose SIBLING edge so the relation isn't lost.
 */
export async function addSiblingInTree(
  input: z.infer<typeof AddSiblingSchema>,
): Promise<AddedRelativeDto> {
  const { treeId, existingSiblingId, sibling } = AddSiblingSchema.parse(input);
  await requireTreeRole(treeId, 'EDITOR');

  const parentRels = await prisma.relationship.findMany({
    where: {
      tree_id: treeId,
      person2_id: existingSiblingId,
      relationship_type: { in: ['PARENT_CHILD', 'ADOPTED_PARENT'] },
    },
    select: { person1_id: true, relationship_type: true },
  });

  if (parentRels.length === 0) {
    const branching = await isPersonAllowed(treeId, {
      kind: 'sibling',
      anchorId: existingSiblingId,
    });
    if (!branching.allowed) {
      throw Errors.branchingNotAllowed(branching.ownerEmail);
    }
  } else {
    const branching = await isPersonAllowed(treeId, {
      kind: 'child',
      anchorIds: parentRels.map((p) => p.person1_id),
    });
    if (!branching.allowed) {
      throw Errors.branchingNotAllowed(branching.ownerEmail);
    }
  }

  return prisma.$transaction(async (tx) => {
    await assertPersonsInTree(tx, treeId, [existingSiblingId]);

    const parentRelsTx = await tx.relationship.findMany({
      where: {
        tree_id: treeId,
        person2_id: existingSiblingId,
        relationship_type: { in: ['PARENT_CHILD', 'ADOPTED_PARENT'] },
      },
      select: { person1_id: true, relationship_type: true },
    });

    const newPerson = await tx.person.create({
      data: { ...withHebrewDatesForCreate(sibling), tree_id: treeId },
      select: { id: true, first_name: true, last_name: true },
    });

    const relationship_ids: string[] = [];

    if (parentRelsTx.length === 0) {
      const [a, b] = normalizeSymmetric(existingSiblingId, newPerson.id, 'SIBLING');
      const rel = await tx.relationship.create({
        data: {
          tree_id: treeId,
          relationship_type: 'SIBLING',
          person1_id: a,
          person2_id: b,
        },
        select: { id: true },
      });
      relationship_ids.push(rel.id);
    } else {
      const created = await Promise.all(
        parentRelsTx.map((pr) =>
          tx.relationship.create({
            data: {
              tree_id: treeId,
              relationship_type: pr.relationship_type,
              person1_id: pr.person1_id,
              person2_id: newPerson.id,
            },
            select: { id: true },
          }),
        ),
      );
      relationship_ids.push(...created.map((r) => r.id));
    }

    return { person: newPerson, relationship_ids };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AI tree builder — empty-state-only batch creator.
//
// `createPersonsAndRelationshipsInTree` ingests a normalized plan (already
// reconciled upstream) and creates every Person + Relationship in a single
// transaction. Used exclusively by `buildTreeFromAiPlanAction` for trees that
// currently have zero persons.
//
// The `permissive` flag relaxes the spouse gender check via the internal
// `assertSpouseGenderPair` helper. Default is `false`, matching the spirit of
// `oppositeBinaryGender` used by `addSpouseInTree`. The AI builder passes
// `true` so same-gender or UNKNOWN-gender pairs from user free text can land
// without being rejected — no other call site should pass `true`.
// ─────────────────────────────────────────────────────────────────────────────

export type AiBatchGender = 'MALE' | 'FEMALE' | 'UNKNOWN';

export interface AiBatchPersonInput {
  local_id: string;
  first_name: string;
  last_name: string | null;
  first_name_he: string;
  last_name_he: string;
  gender: AiBatchGender;
  birth_year?: number | null;
  death_year?: number | null;
  is_deceased?: boolean;
  bio?: string | null;
}

export interface AiBatchRelationshipInput {
  type: 'SPOUSE' | 'PARENT_CHILD' | 'SIBLING';
  from_local_id: string;
  to_local_id: string;
}

export interface AiBatchResult {
  personCount: number;
  relationshipCount: number;
  rootPersonId: string | null;
}

/**
 * Pair-gender validator for SPOUSE rows created in batch. Mirrors the spirit
 * of the existing `oppositeBinaryGender` check used by `addSpouseInTree`, but
 * runs over an already-existing pair instead of overriding one side's gender.
 *
 * `permissive` default = false preserves current behavior at every call site;
 * only the AI tree builder passes true.
 */
function assertSpouseGenderPair(
  g1: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN',
  g2: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN',
  permissive: boolean = false,
): void {
  if (permissive) return;
  if ((g1 === 'MALE' && g2 === 'FEMALE') || (g1 === 'FEMALE' && g2 === 'MALE')) return;
  throw Errors.badRequest('Spouse pair must be opposite binary genders (MALE + FEMALE)');
}

function yearToJanFirst(year: number | null | undefined): Date | null {
  if (year == null || !Number.isFinite(year)) return null;
  // Use UTC Jan 1 so subsequent Hebrew-date conversion lands in the right Gregorian year.
  return new Date(Date.UTC(year, 0, 1));
}

export async function createPersonsAndRelationshipsInTree(args: {
  treeId: string;
  persons: AiBatchPersonInput[];
  relationships: AiBatchRelationshipInput[];
  rootLocalId: string;
  /** When true, skips `assertSpouseGenderPair`. Default false. */
  permissive?: boolean;
}): Promise<AiBatchResult> {
  const { treeId, persons, relationships, rootLocalId } = args;
  const permissive = args.permissive ?? false;
  const tEnter = Date.now();
  console.log(
    `[ai-tree:svc] enter treeId=${treeId} persons=${persons.length} rels=${relationships.length} permissive=${permissive}`,
  );

  await requireTreeRole(treeId, 'EDITOR');

  if (persons.length === 0) {
    throw Errors.badRequest('Plan must contain at least one person');
  }

  // Empty-state-only guard: refuse to merge an AI plan into a populated tree.
  const existingCount = await prisma.person.count({ where: { tree_id: treeId } });
  if (existingCount > 0) {
    throw Errors.conflict('AI tree builder only supports empty trees');
  }

  // Branching gate: confirm the caller is allowed to create the root.
  const branching = await isPersonAllowed(treeId, { kind: 'standalone' });
  if (!branching.allowed) {
    throw Errors.branchingNotAllowed(branching.ownerEmail);
  }

  // Validate spouse-pair genders up-front using the input plan, before we
  // open the transaction — failing fast on a bad plan beats partial inserts.
  const genderByLocal = new Map<string, AiBatchGender>();
  for (const p of persons) genderByLocal.set(p.local_id, p.gender);
  for (const r of relationships) {
    if (r.type !== 'SPOUSE') continue;
    const g1 = genderByLocal.get(r.from_local_id);
    const g2 = genderByLocal.get(r.to_local_id);
    if (!g1 || !g2) {
      throw Errors.badRequest(`SPOUSE references unknown local_id (${r.from_local_id} / ${r.to_local_id})`);
    }
    console.log(
      `[ai-tree:svc] SPOUSE ${r.from_local_id}(${g1}) <-> ${r.to_local_id}(${g2}) permissive=${permissive}`,
    );
    assertSpouseGenderPair(g1, g2, permissive);
  }

  // Cap biological parents at 2 per child (matches `addParentInTree`'s rule).
  const parentsByChild = new Map<string, Set<string>>();
  for (const r of relationships) {
    if (r.type !== 'PARENT_CHILD') continue;
    const set = parentsByChild.get(r.to_local_id) ?? new Set<string>();
    set.add(r.from_local_id);
    parentsByChild.set(r.to_local_id, set);
  }
  for (const [child, parents] of parentsByChild) {
    if (parents.size > 2) {
      throw Errors.conflict(`Person ${child} has more than two parents in the plan`);
    }
  }

  // Build every person row in memory first (CPU only — Hebrew date derivation),
  // so the transaction is just a few bulk round-trips rather than ~2N. The old
  // per-row loop (N persons + M relationships = N+M sequential awaits) blew past
  // Prisma's default 5s interactive-transaction timeout for large trees (P2028),
  // which surfaced as the opaque "An unexpected error occurred".
  const personsData: Prisma.PersonCreateManyInput[] = persons.map((p) => {
    const birth_date = yearToJanFirst(p.birth_year);
    const death_date = yearToJanFirst(p.death_year);
    const is_deceased = p.is_deceased ?? (death_date !== null);
    return {
      ...withHebrewDatesForCreate({
        first_name: p.first_name && p.first_name.length > 0 ? p.first_name : p.first_name_he,
        last_name: p.last_name && p.last_name.length > 0 ? p.last_name : null,
        first_name_he: p.first_name_he,
        last_name_he: p.last_name_he,
        gender: p.gender,
        birth_date,
        death_date,
        is_deceased,
        birth_place: null,
        bio: p.bio ?? null,
        profile_image: null,
        maiden_name: null,
      }),
      tree_id: treeId,
    };
  });

  console.log(
    `[ai-tree:svc] pre-checks done (+${Date.now() - tEnter}ms); opening $transaction (batched, timeout=20000ms)`,
  );
  const txStart = Date.now();
  return prisma.$transaction(
    async (tx) => {
      // 1) Bulk-insert persons. createManyAndReturn issues a single
      //    INSERT ... RETURNING on Postgres, so rows come back in input order —
      //    we map local_id → db id by index. Length assert guards against any
      //    partial/misordered result.
      const createdPersons = await tx.person.createManyAndReturn({
        data: personsData,
        select: { id: true },
      });
      if (createdPersons.length !== persons.length) {
        throw Errors.internal('Person bulk insert returned an unexpected row count');
      }
      const localToDbId = new Map<string, string>();
      persons.forEach((p, i) => localToDbId.set(p.local_id, createdPersons[i].id));
      console.log(`[ai-tree:svc] bulk-created ${createdPersons.length} persons (+${Date.now() - txStart}ms)`);

      // 2) Build + bulk-insert relationships. skipDuplicates absorbs any
      //    symmetric/normalized collisions without per-row try/catch.
      const relsData: Prisma.RelationshipCreateManyInput[] = [];
      for (const r of relationships) {
        const fromId = localToDbId.get(r.from_local_id);
        const toId = localToDbId.get(r.to_local_id);
        if (!fromId || !toId || fromId === toId) continue;

        const relType: RelationshipType = r.type;
        let person1_id: string;
        let person2_id: string;
        if (relType === 'PARENT_CHILD') {
          // Directional: from = parent, to = child.
          person1_id = fromId;
          person2_id = toId;
        } else {
          // Symmetric — normalize so the unique constraint collapses (A,B)/(B,A).
          const [a, b] = normalizeSymmetric(fromId, toId, relType);
          person1_id = a;
          person2_id = b;
        }
        relsData.push({ tree_id: treeId, relationship_type: relType, person1_id, person2_id });
      }

      const relResult =
        relsData.length > 0
          ? await tx.relationship.createMany({ data: relsData, skipDuplicates: true })
          : { count: 0 };
      console.log(`[ai-tree:svc] bulk-created ${relResult.count} relationships (+${Date.now() - txStart}ms)`);

      // 3) Seed the tree root.
      const rootPersonId = localToDbId.get(rootLocalId) ?? null;
      if (rootPersonId) {
        await tx.tree.update({
          where: { id: treeId },
          data: { root_person_id: rootPersonId },
        });
      }
      console.log(`[ai-tree:svc] tx body complete root=${rootPersonId} (+${Date.now() - txStart}ms)`);

      return {
        personCount: localToDbId.size,
        relationshipCount: relResult.count,
        rootPersonId,
      };
    },
    { timeout: 20000, maxWait: 10000 },
  );
}
