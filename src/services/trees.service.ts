import { apiClient } from './api.client';
import type {
  TreeDto,
  CreateTreeBody,
  UpdateTreeBody,
  TreeAboutDto,
  UpdateTreeAboutBody,
} from '@/types/api';

// ──────────────────────────────────────────────
// Trees Service
//
// The ONLY way UI components and hooks interact
// with tree data. Contains zero business logic —
// it just maps frontend calls to /api/v1/ routes.
//
// Used by: hooks/useTree.ts (Phase 4)
// ──────────────────────────────────────────────

const BASE = '/api/v1/trees';

export const treesService = {
  /** GET /api/v1/trees — fetch all accessible trees */
  getAll(): Promise<TreeDto[]> {
    return apiClient.get<TreeDto[]>(BASE);
  },

  /** GET /api/v1/trees/:id — fetch a single tree */
  getById(id: string): Promise<TreeDto> {
    return apiClient.get<TreeDto>(`${BASE}/${id}`);
  },

  /** POST /api/v1/trees — create a new tree */
  create(body: CreateTreeBody): Promise<TreeDto> {
    return apiClient.post<TreeDto>(BASE, body);
  },

  /** PATCH /api/v1/trees/:id — partial update */
  update(id: string, body: UpdateTreeBody): Promise<TreeDto> {
    return apiClient.patch<TreeDto>(`${BASE}/${id}`, body);
  },

  /** DELETE /api/v1/trees/:id */
  remove(id: string): Promise<void> {
    return apiClient.delete<void>(`${BASE}/${id}`);
  },

  /** GET /api/v1/trees/:treeId/about — fetch heritage description and main surnames */
  getAbout(treeId: string): Promise<TreeAboutDto> {
    return apiClient.get<TreeAboutDto>(`${BASE}/${treeId}/about`);
  },

  /** PATCH /api/v1/trees/:treeId/about — partial update of about_text and/or main_surnames */
  updateAbout(treeId: string, body: UpdateTreeAboutBody): Promise<TreeAboutDto> {
    return apiClient.patch<TreeAboutDto>(`${BASE}/${treeId}/about`, body);
  },
};
