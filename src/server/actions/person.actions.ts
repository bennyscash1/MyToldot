'use server';

import { revalidatePath } from 'next/cache';
import { Gender, RelationshipType, TreeMemberRole } from '@prisma/client';

import { withAction, type ActionResult } from '@/lib/api/action-result';
import {
  CuidSchema,
  type PersonInput,
  type PersonPatch,
} from '@/features/family-tree/schemas/person.schema';
import { prisma } from '@/lib/prisma';
import { requireTreeRole } from '@/lib/api/auth';
import { ensureMirroredAuthUser } from '@/lib/ensure-mirrored-auth-user';
import { assertAiUsageAllowed, incrementAiUsage } from '@/lib/usage/tracker';
import { Errors } from '@/lib/api/errors';
import {
  createPersonInTree,
  updatePersonInTree,
  removePersonFromTree,
  type PersonDto,
} from '@/server/services/tree.service';
import {
  generateGroundedHebrewBio,
  type BioResult,
  type BioSubject,
} from '@/server/lib/gemini';
import {
  buildDefaultImageSearchContext,
  generatePersonImageCandidates,
  type ImageSearchSubject,
} from '@/server/lib/gemini-person-images';
import {
  SearchPersonImagesInputSchema,
  type ImageCandidate,
} from '@/features/family-tree/schemas/person-image-search.schema';
import {
  buildCommonsSearchQueries,
  searchCommonsImageCandidates,
} from '@/lib/images/commons-image-search';
import {
  extractWikimediaFileName,
  isBlockedImageDomain,
  prefetchCommonsDirectUrls,
  resolveExternalImageUrl,
} from '@/lib/images/validate-external-image-url';

/** Creates a standalone person (no relationships). Used for the tree root, or prior to wiring. */
export async function createPersonAction(
  treeId: string,
  input: PersonInput,
): Promise<ActionResult<PersonDto>> {
  return withAction(async () => {
    const person = await createPersonInTree(treeId, input);
    revalidatePath('/[locale]/tree', 'page');
    return person;
  });
}

export async function updatePersonAction(
  treeId: string,
  personId: string,
  patch: PersonPatch,
): Promise<ActionResult<PersonDto>> {
  return withAction(async () => {
    const person = await updatePersonInTree(treeId, personId, patch);
    revalidatePath('/[locale]/tree', 'page');
    return person;
  });
}

/**
 * Deletes a person. All relationships referencing this person are cascaded by
 * the schema (onDelete: Cascade on both person1/person2 FKs).
 */
export async function deletePersonAction(
  treeId: string,
  personId: string,
): Promise<ActionResult<{ id: string }>> {
  return withAction(async () => {
    const removed = await removePersonFromTree(treeId, personId);
    revalidatePath('/[locale]/tree', 'page');
    return removed;
  });
}

/** Subset of Person columns we need when describing a related individual. */
const NAME_AND_VITALS_SELECT = {
  first_name: true,
  last_name: true,
  first_name_he: true,
  last_name_he: true,
  gender: true,
  birth_date: true,
  death_date: true,
  is_deceased: true,
  birth_place: true,
} as const;

/** Shape every related-person row carries after the Prisma select above. */
interface NameAndVitals {
  first_name: string;
  last_name: string | null;
  first_name_he: string | null;
  last_name_he: string | null;
  gender: Gender;
  birth_date: Date | null;
  death_date: Date | null;
  is_deceased: boolean;
  birth_place: string | null;
}

function hebrewName(p: NameAndVitals | null | undefined): string {
  if (!p) return '';
  return [p.first_name_he, p.last_name_he].filter(Boolean).join(' ').trim();
}

function englishName(p: NameAndVitals | null | undefined): string {
  if (!p) return '';
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
}

/**
 * Build a BioSubject from the focal person + derived relatives, applying
 * strict skip-if-empty rules: never assign null, undefined, empty/whitespace
 * strings, NaN years, or empty arrays. The prompt builder relies on these
 * fields being either absent or genuinely informative.
 */
function buildSubject(
  person: {
    first_name: string;
    last_name: string | null;
    first_name_he: string | null;
    last_name_he: string | null;
    maiden_name: string | null;
    gender: Gender;
    birth_date: Date | null;
    death_date: Date | null;
    is_deceased: boolean;
    birth_place: string | null;
    bio: string | null;
    tree: { about_text: string | null } | null;
  },
  father: NameAndVitals | null,
  mother: NameAndVitals | null,
  spouse: NameAndVitals | null,
  children: NameAndVitals[],
  siblings: NameAndVitals[],
): BioSubject {
  const subject: BioSubject = { fullNameHe: '' };

  const heName = hebrewName(person);
  const enName = englishName(person);
  // fullNameHe is required; if the person has no Hebrew name at all, fall back
  // to the Latin name so the prompt still has a subject identifier.
  subject.fullNameHe = heName || enName || '(unnamed)';
  if (enName) subject.fullNameEn = enName;

  if (person.maiden_name && person.maiden_name.trim()) {
    subject.maidenName = person.maiden_name.trim();
  }
  if (person.gender) subject.gender = person.gender;

  if (person.birth_date) {
    const year = new Date(person.birth_date).getFullYear();
    if (!Number.isNaN(year)) subject.birthYear = year;
  }
  if (person.death_date) {
    const year = new Date(person.death_date).getFullYear();
    if (!Number.isNaN(year)) subject.deathYear = year;
  }
  if (person.birth_place && person.birth_place.trim()) {
    subject.birthPlace = person.birth_place.trim();
  }
  if (person.bio && person.bio.trim()) {
    subject.existingBio = person.bio.trim();
  }
  if (person.tree?.about_text && person.tree.about_text.trim()) {
    subject.community = person.tree.about_text.trim();
  }

  const fatherHe = hebrewName(father);
  const fatherEn = englishName(father);
  if (fatherHe) subject.fatherNameHe = fatherHe;
  if (fatherEn) subject.fatherNameEn = fatherEn;

  const motherHe = hebrewName(mother);
  const motherEn = englishName(mother);
  if (motherHe) subject.motherNameHe = motherHe;
  if (motherEn) subject.motherNameEn = motherEn;

  const spouseHe = hebrewName(spouse);
  const spouseEn = englishName(spouse);
  if (spouseHe) subject.spouseNameHe = spouseHe;
  if (spouseEn) subject.spouseNameEn = spouseEn;

  const childrenHe = children.map(hebrewName).filter((s) => s.length > 0);
  if (childrenHe.length > 0) subject.childrenNamesHe = childrenHe;

  const siblingsHe = siblings.map(hebrewName).filter((s) => s.length > 0);
  if (siblingsHe.length > 0) subject.siblingsNamesHe = siblingsHe;

  return subject;
}

const PARENT_TYPES = [RelationshipType.PARENT_CHILD, RelationshipType.ADOPTED_PARENT] as const;

/**
 * BREAKING: Return type changed from { text } to BioResult.
 * AiBioSearch.tsx must be updated to render structured fields, sources,
 * and confidence badges.
 */
export async function fetchAiBiographyAction(
  personId: string,
): Promise<ActionResult<BioResult>> {
  return withAction(async () => {
    const validatedId = CuidSchema.parse(personId);
    if (!process.env.GEMINI_API_KEY) {
      throw Errors.internal('GEMINI_API_KEY is not configured');
    }

    const person = await prisma.person.findUnique({
      where: { id: validatedId },
      include: {
        tree: { select: { about_text: true } },
        relationships_as_person2: {
          where: {
            relationship_type: {
              in: [
                RelationshipType.PARENT_CHILD,
                RelationshipType.ADOPTED_PARENT,
                RelationshipType.SPOUSE,
                RelationshipType.SIBLING,
              ],
            },
          },
          include: { person1: { select: NAME_AND_VITALS_SELECT } },
        },
        relationships_as_person1: {
          where: {
            relationship_type: {
              in: [
                RelationshipType.PARENT_CHILD,
                RelationshipType.ADOPTED_PARENT,
                RelationshipType.SPOUSE,
                RelationshipType.SIBLING,
              ],
            },
          },
          include: { person2: { select: NAME_AND_VITALS_SELECT } },
        },
      },
    });

    if (!person) {
      throw Errors.notFound('Person');
    }

    const user = await requireTreeRole(person.tree_id, TreeMemberRole.EDITOR);
    await ensureMirroredAuthUser(user);
    await assertAiUsageAllowed(user.id);

    // Subject is on the person2 side of a PARENT_CHILD/ADOPTED_PARENT edge,
    // so the parent is on the person1 side. Gender determines father vs mother.
    const parentEdges = person.relationships_as_person2.filter((r) =>
      (PARENT_TYPES as readonly RelationshipType[]).includes(r.relationship_type),
    );
    const father =
      parentEdges.find((r) => r.person1.gender === Gender.MALE)?.person1 ?? null;
    const mother =
      parentEdges.find((r) => r.person1.gender === Gender.FEMALE)?.person1 ?? null;

    // SPOUSE is symmetric — check both directions and take the first hit.
    const spouseFromP2 = person.relationships_as_person2.find(
      (r) => r.relationship_type === RelationshipType.SPOUSE,
    )?.person1;
    const spouseFromP1 = person.relationships_as_person1.find(
      (r) => r.relationship_type === RelationshipType.SPOUSE,
    )?.person2;
    const spouse = spouseFromP2 ?? spouseFromP1 ?? null;

    // Convention: PARENT_CHILD edges store person1 = parent, person2 = child.
    // Subject's children = edges where subject is on the person1 side
    // (i.e. relationships_as_person1) and the type is a parental one.
    const children = person.relationships_as_person1
      .filter((r) => (PARENT_TYPES as readonly RelationshipType[]).includes(r.relationship_type))
      .map((r) => r.person2);

    // SIBLING is symmetric — siblings appear on both sides of the join.
    const siblings = [
      ...person.relationships_as_person2
        .filter((r) => r.relationship_type === RelationshipType.SIBLING)
        .map((r) => r.person1),
      ...person.relationships_as_person1
        .filter((r) => r.relationship_type === RelationshipType.SIBLING)
        .map((r) => r.person2),
    ];

    const subject = buildSubject(person, father, mother, spouse, children, siblings);
    const bio = await generateGroundedHebrewBio(subject);
    await incrementAiUsage(user.id);
    return bio;
  });
}

function formatDateForSearch(d: Date | null): string | undefined {
  if (!d) return undefined;
  const iso = d.toISOString().slice(0, 10);
  return iso;
}

function buildImageSearchSubject(
  person: {
    first_name: string;
    last_name: string | null;
    first_name_he: string | null;
    last_name_he: string | null;
    gender: Gender;
    birth_date: Date | null;
    death_date: Date | null;
    birth_place: string | null;
  },
  parent: {
    first_name: string;
    last_name: string | null;
    first_name_he: string | null;
    last_name_he: string | null;
    gender: Gender;
  } | null,
  parentRelation?: string,
): ImageSearchSubject {
  const heName = [person.first_name_he, person.last_name_he].filter(Boolean).join(' ').trim();
  const enName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
  const parentHe = parent
    ? [parent.first_name_he, parent.last_name_he].filter(Boolean).join(' ').trim() ||
      [parent.first_name, parent.last_name].filter(Boolean).join(' ').trim()
    : '';

  return {
    fullNameHe: heName || enName || '(unnamed)',
    fullNameEn: enName || undefined,
    gender: person.gender,
    birthDate: formatDateForSearch(person.birth_date),
    deathDate: formatDateForSearch(person.death_date),
    birthPlace: person.birth_place?.trim() || undefined,
    parentNameHe: parentHe || undefined,
    parentRelation,
  };
}

export async function searchPersonImagesAction(input: {
  personId: string;
  searchContext?: string;
}): Promise<ActionResult<{ candidates: ImageCandidate[] }>> {
  return withAction(async () => {
    const { personId, searchContext } = SearchPersonImagesInputSchema.parse(input);
    if (!process.env.GEMINI_API_KEY) {
      throw Errors.internal('GEMINI_API_KEY is not configured');
    }

    const person = await prisma.person.findUnique({
      where: { id: personId },
      include: {
        relationships_as_person2: {
          where: {
            relationship_type: {
              in: [RelationshipType.PARENT_CHILD, RelationshipType.ADOPTED_PARENT],
            },
          },
          include: { person1: { select: NAME_AND_VITALS_SELECT } },
        },
      },
    });

    if (!person) {
      throw Errors.notFound('Person');
    }

    await requireTreeRole(person.tree_id, TreeMemberRole.EDITOR);

    const parentEdge = person.relationships_as_person2[0];
    const parent = parentEdge?.person1 ?? null;
    const parentRelation =
      parent?.gender === Gender.MALE ? 'אב' : parent?.gender === Gender.FEMALE ? 'אם' : undefined;

    const subject = buildImageSearchSubject(person, parent, parentRelation);
    const context =
      searchContext?.trim() || buildDefaultImageSearchContext(subject);

    const MAX_RESULTS = 12;

    const [rawCandidates, commonsCandidates] = await Promise.all([
      generatePersonImageCandidates(subject, context),
      searchCommonsImageCandidates(
        buildCommonsSearchQueries(subject.fullNameEn, context),
        MAX_RESULTS,
      ),
    ]);

    const mergedCandidates = [...rawCandidates, ...commonsCandidates];

    const fileNames = mergedCandidates
      .map((c) => extractWikimediaFileName(c.imageUrl))
      .filter((name): name is string => Boolean(name));
    await prefetchCommonsDirectUrls(fileNames);

    const filtered: ImageCandidate[] = [];
    const seenUrls = new Set<string>();
    for (const candidate of mergedCandidates) {
      if (filtered.length >= MAX_RESULTS) break;
      if (isBlockedImageDomain(candidate.imageUrl)) continue;

      const resolved = await resolveExternalImageUrl(candidate.imageUrl);
      if (!resolved.ok) continue;
      if (seenUrls.has(resolved.url)) continue;
      seenUrls.add(resolved.url);

      filtered.push({ ...candidate, imageUrl: resolved.url });
    }

    return { candidates: filtered };
  });
}
