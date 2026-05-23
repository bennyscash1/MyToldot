export type NudgeType = 'birth_date' | 'profile_image' | 'bio' | 'death_date';

export interface Nudge {
  /** "{person_id}:{field}" — stable id used for dismissal tracking and message selection. */
  id: string;
  type: NudgeType;
  person_id: string;
  /** Hebrew display name (falls back to English on the server). */
  person_name_he: string;
  /** Higher number = shown first. */
  priority: number;
}

export interface NudgesResponse {
  nudges: Nudge[];
}
