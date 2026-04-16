import { apiClient } from './api.client';
import type { PersonDto, CreatePersonBody, UpdatePersonBody } from '@/types/api';

// ──────────────────────────────────────────────
// Persons Service
// Maps UI actions → /api/v1/persons/* calls.
// ──────────────────────────────────────────────

const BASE = '/api/v1/persons';

export interface CreatePersonResult {
  person: PersonDto;
  /** Whether strict_lineage_enforcement is active on the tree. */
  strictMode: boolean;
}

export const personsService = {
  /** GET /api/v1/persons?tree_id=xxx */
  getAllForTree(treeId: string): Promise<PersonDto[]> {
    return apiClient.get<PersonDto[]>(`${BASE}?tree_id=${treeId}`);
  },

  /** GET /api/v1/persons/:id */
  getById(personId: string): Promise<PersonDto> {
    return apiClient.get<PersonDto>(`${BASE}/${personId}`);
  },

  /**
   * POST /api/v1/persons
   * Creates the person record. Image upload is handled separately
   * via storageService — pass the resulting path as `profile_image`.
   */
  create(body: CreatePersonBody): Promise<CreatePersonResult> {
    return apiClient.post<CreatePersonResult>(BASE, body);
  },

  /**
   * PATCH /api/v1/persons/:id
   * Used after image upload to set the `profile_image` path,
   * or for any subsequent field updates.
   */
  update(personId: string, body: UpdatePersonBody): Promise<PersonDto> {
    return apiClient.patch<PersonDto>(`${BASE}/${personId}`, body);
  },

  /** DELETE /api/v1/persons/:id */
  remove(personId: string): Promise<void> {
    return apiClient.delete<void>(`${BASE}/${personId}`);
  },
};
