export interface PersonRef {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
}

export interface DashboardPerson {
  id: string;
  firstNameHe: string | null;
  lastNameHe: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string;
  profileImageUrl: string | null;
  galleryUrls: { url: string; caption: string | null }[];
  birthDate: string | null;
  birthDateHebrew: string | null;
  birthPlace: string | null;
  deathDate: string | null;
  deathDateHebrew: string | null;
  isDeceased: boolean;
  ageAtDeath: number | null;
  bio: string | null;
  parentNames: string[];
  counts: { spouses: number; children: number; grandchildren: number };
  relatives: {
    parents: PersonRef[];
    siblings: PersonRef[];
    spouses: PersonRef[];
  };
}

export type UpcomingEventType = 'birthday' | 'yahrzeit';

export interface UpcomingEvent {
  type: UpcomingEventType;
  personId: string;
  personName: string;
  date: string;
  dateHebrew: string;
  daysUntil: number;
  ageOrYears: number;
}

export interface RecentBio {
  personId: string;
  personName: string;
  profileImageUrl: string | null;
  updatedAt: string;
}

export interface RecentPhoto {
  photoId: string;
  personId: string;
  personName: string;
  url: string;
  caption: string | null;
  storagePath: string;
}

export interface DashboardData {
  tree: { id: string; shortCode: string; name: string };
  persons: DashboardPerson[];
  upcomingEvents: UpcomingEvent[];
  recentBios: RecentBio[];
  recentPhotos: RecentPhoto[];
  totalPhotoCount: number;
  todayHebrewDate: string;
  todayGregorianDate: string;
}
