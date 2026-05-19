import 'server-only';

import { prisma } from '@/lib/prisma';
import { profileImagePublicUrl, personGalleryPublicUrl } from '@/lib/supabase/public-url';
import {
  buildRelationsMap,
  type RelationshipLike,
} from '@/features/dashboard/lib/relationship-counts';
import {
  getUpcomingBirthdays,
  getUpcomingYahrzeits,
  todayHebrew,
} from '@/features/dashboard/lib/hebcal-events';
import type {
  DashboardData,
  DashboardPerson,
  PersonRef,
  RecentBio,
  RecentPhoto,
  UpcomingEvent,
} from '@/features/dashboard/types';

const MIN_BIO_CHARS = 20;
const RECENT_BIOS_LIMIT = 5;
const RECENT_PHOTOS_LIMIT = 6;
const EVENT_WINDOW_DAYS = 7;

export async function getDashboardData(treeId: string): Promise<DashboardData | null> {
  const tree = await prisma.tree.findUnique({
    where: { id: treeId },
    select: { id: true, shortCode: true, name: true },
  });
  if (!tree) return null;

  const [personRows, relationshipRows, photoRows] = await Promise.all([
    prisma.person.findMany({
      where: { tree_id: treeId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        first_name_he: true,
        last_name_he: true,
        birth_date: true,
        birth_date_hebrew: true,
        birth_place: true,
        death_date: true,
        death_date_hebrew: true,
        is_deceased: true,
        bio: true,
        profile_image: true,
        updated_at: true,
      },
      orderBy: { created_at: 'asc' },
    }),
    prisma.relationship.findMany({
      where: { tree_id: treeId },
      select: {
        relationship_type: true,
        person1_id: true,
        person2_id: true,
      },
    }),
    prisma.personPhoto.findMany({
      where: { tree_id: treeId },
      orderBy: [{ person_id: 'asc' }, { sort_order: 'asc' }],
      select: {
        id: true,
        person_id: true,
        storage_path: true,
        caption: true,
        sort_order: true,
        created_at: true,
      },
    }),
  ]);

  const photosByPerson = new Map<string, typeof photoRows>();
  for (const photo of photoRows) {
    const arr = photosByPerson.get(photo.person_id) ?? [];
    arr.push(photo);
    photosByPerson.set(photo.person_id, arr);
  }

  const personIndex = new Map<string, (typeof personRows)[number]>();
  for (const p of personRows) personIndex.set(p.id, p);

  const displayNameFor = (p: (typeof personRows)[number] | undefined): string => {
    if (!p) return '';
    const he = [p.first_name_he, p.last_name_he].filter(Boolean).join(' ').trim();
    if (he) return he;
    return [p.first_name, p.last_name].filter(Boolean).join(' ').trim();
  };

  const relationsMap = buildRelationsMap(relationshipRows as RelationshipLike[]);

  const refOf = (id: string): PersonRef | null => {
    const p = personIndex.get(id);
    if (!p) return null;
    return {
      id: p.id,
      displayName: displayNameFor(p),
      profileImageUrl: profileImagePublicUrl(p.profile_image),
    };
  };

  const persons: DashboardPerson[] = [];

  for (const p of personRows) {
    const photos = photosByPerson.get(p.id) ?? [];
    const profileUrl = profileImagePublicUrl(p.profile_image);
    const hasBio = (p.bio?.trim().length ?? 0) >= MIN_BIO_CHARS;
    const eligible = hasBio || profileUrl !== null || photos.length > 0;
    if (!eligible) continue;

    const rel = relationsMap.get(p.id);
    const parentRefs = (rel?.parentIds ?? [])
      .map((id) => refOf(id))
      .filter((r): r is PersonRef => r !== null);
    const siblingRefs = (rel?.siblingIds ?? [])
      .map((id) => refOf(id))
      .filter((r): r is PersonRef => r !== null);
    const spouseRefs = (rel?.spouseIds ?? [])
      .map((id) => refOf(id))
      .filter((r): r is PersonRef => r !== null);

    const galleryUrls = photos
      .map((photo) => {
        const url = personGalleryPublicUrl(photo.storage_path);
        return url ? { url, caption: photo.caption } : null;
      })
      .filter((g): g is { url: string; caption: string | null } => g !== null);

    let ageAtDeath: number | null = null;
    if (p.is_deceased && p.death_date && p.birth_date) {
      const years =
        new Date(p.death_date).getFullYear() - new Date(p.birth_date).getFullYear();
      ageAtDeath = years >= 0 ? years : null;
    }

    persons.push({
      id: p.id,
      firstNameHe: p.first_name_he,
      lastNameHe: p.last_name_he,
      firstName: p.first_name,
      lastName: p.last_name,
      displayName: displayNameFor(p),
      profileImageUrl: profileUrl,
      galleryUrls,
      birthDate: p.birth_date ? p.birth_date.toISOString() : null,
      birthDateHebrew: p.birth_date_hebrew,
      birthPlace: p.birth_place,
      deathDate: p.death_date ? p.death_date.toISOString() : null,
      deathDateHebrew: p.death_date_hebrew,
      isDeceased: p.is_deceased,
      ageAtDeath,
      bio: hasBio ? p.bio : null,
      parentNames: parentRefs.map((r) => r.displayName),
      counts: rel?.counts ?? { spouses: 0, children: 0, grandchildren: 0 },
      relatives: {
        parents: parentRefs,
        siblings: siblingRefs,
        spouses: spouseRefs,
      },
    });
  }

  const now = new Date();
  const personsForEvents = personRows.map((p) => ({
    id: p.id,
    displayName: displayNameFor(p),
    birthDate: p.birth_date,
    deathDate: p.death_date,
    isDeceased: p.is_deceased,
  }));

  const upcomingEvents: UpcomingEvent[] = [
    ...getUpcomingBirthdays(personsForEvents, now, EVENT_WINDOW_DAYS),
    ...getUpcomingYahrzeits(personsForEvents, now, EVENT_WINDOW_DAYS),
  ].sort((a, b) => a.daysUntil - b.daysUntil);

  const recentBios: RecentBio[] = personRows
    .filter((p) => (p.bio?.trim().length ?? 0) >= MIN_BIO_CHARS)
    .sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())
    .slice(0, RECENT_BIOS_LIMIT)
    .map((p) => ({
      personId: p.id,
      personName: displayNameFor(p),
      profileImageUrl: profileImagePublicUrl(p.profile_image),
      updatedAt: p.updated_at.toISOString(),
    }));

  const allPhotosSorted = [...photoRows].sort(
    (a, b) => b.created_at.getTime() - a.created_at.getTime(),
  );
  const recentPhotos: RecentPhoto[] = allPhotosSorted
    .slice(0, RECENT_PHOTOS_LIMIT)
    .map((photo) => {
      const url = personGalleryPublicUrl(photo.storage_path);
      const owner = personIndex.get(photo.person_id);
      return url
        ? {
            photoId: photo.id,
            personId: photo.person_id,
            personName: displayNameFor(owner),
            url,
            caption: photo.caption,
            storagePath: photo.storage_path,
          }
        : null;
    })
    .filter((p): p is RecentPhoto => p !== null);

  return {
    tree,
    persons,
    upcomingEvents,
    recentBios,
    recentPhotos,
    totalPhotoCount: photoRows.length,
    todayHebrewDate: todayHebrew(now),
    todayGregorianDate: now.toISOString(),
  };
}
