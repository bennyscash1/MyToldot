export interface PersonRef {
  id: string;
  displayName: string;
  profileImageUrl: string | null;
}

export interface MiniTreePerson extends PersonRef {
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNKNOWN' | null;
  isAdoptive?: boolean;
  isDivorcedSpouse?: boolean;
  birthDate?: string | null;
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
    parents: MiniTreePerson[];
    siblings: PersonRef[];
    spouses: MiniTreePerson[];
    children: MiniTreePerson[];
    /** Total children when more than shown in mini-tree */
    childrenOverflow: number;
    /** Extra spouses beyond the one shown in mini-tree */
    extraSpouseCount: number;
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

export interface DashboardTreeStats {
  memberCount: number;
  generationCount: number;
  marriageCount: number;
  photoCount: number;
}

export interface DashboardData {
  tree: { id: string; shortCode: string; name: string };
  persons: DashboardPerson[];
  upcomingEvents: UpcomingEvent[];
  recentBios: RecentBio[];
  recentPhotos: RecentPhoto[];
  totalPhotoCount: number;
  treeStats: DashboardTreeStats;
  todayHebrewDate: string;
  todayGregorianDate: string;
}
