'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from '@/lib/supabase/client';
import { apiClient, ServiceError } from '@/services/api.client';

// ──────────────────────────────────────────────
// usePermissions — Client-side RBAC resolver
//
// Single source of truth for "can the current user do X?" inside
// Client Components. Wraps:
//   • GET /api/v1/auth/me  (returns the user's RBAC profile or null)
//   • Supabase onAuthStateChange (re-fetches on login/logout/refresh)
//
// Anonymous visitors get { isAuthenticated: false, canEdit: false, ... }
// without seeing a 401 in the console because /api/v1/auth/me is public.
//
// Approval changes made by the admin in the Supabase dashboard become
// visible the next time the JWT is refreshed (≤ 1h) or after a logout/login.
// ──────────────────────────────────────────────

export type AccessRole = 'GUEST' | 'EDITOR' | 'ADMIN';

export interface UserProfile {
  id:           string;
  email:        string;
  full_name:    string | null;
  is_approved:  boolean;
  access_role:  AccessRole;
}

export interface Permissions {
  /** True until the first /api/v1/auth/me round-trip resolves. */
  isLoading:       boolean;
  /** A Supabase session exists. */
  isAuthenticated: boolean;
  /** Authenticated AND admin has flipped `is_approved`. */
  isApproved:      boolean;
  /** The user's global app role (or null when anonymous). */
  role:            AccessRole | null;
  /** Always true — read access is public. */
  canView:         boolean;
  /** EDITOR or ADMIN, and approved. */
  canEdit:         boolean;
  /** ADMIN only, and approved. */
  canDelete:       boolean;
  /** Raw profile when authenticated, else null. */
  profile:         UserProfile | null;
  /** Force a re-fetch of /api/v1/auth/me (e.g. from "Refresh status" button). */
  refresh:         () => Promise<void>;
}

interface MeResponse {
  user: UserProfile | null;
}

const DEFAULT_PERMISSIONS: Omit<Permissions, 'refresh'> = {
  isLoading:       true,
  isAuthenticated: false,
  isApproved:      false,
  role:            null,
  canView:         true,
  canEdit:         false,
  canDelete:       false,
  profile:         null,
};

function derivePermissions(profile: UserProfile | null, isLoading: boolean): Omit<Permissions, 'refresh'> {
  if (!profile) {
    return { ...DEFAULT_PERMISSIONS, isLoading };
  }
  const approved = profile.is_approved;
  const role     = profile.access_role;
  return {
    isLoading,
    isAuthenticated: true,
    isApproved:      approved,
    role,
    canView:         true,
    canEdit:         approved && (role === 'EDITOR' || role === 'ADMIN'),
    canDelete:       approved && role === 'ADMIN',
    profile,
  };
}

export function usePermissions(): Permissions {
  const [state, setState] = useState<Omit<Permissions, 'refresh'>>(DEFAULT_PERMISSIONS);
  // Avoid setState after unmount (React strict-mode + auth event races).
  const mountedRef = useRef(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await apiClient.get<MeResponse>('/api/v1/auth/me');
      if (!mountedRef.current) return;
      setState(derivePermissions(res.user, false));
    } catch (error) {
      // Network or 5xx: treat as anonymous so the read-only UI still renders.
      if (!(error instanceof ServiceError) && process.env.NODE_ENV !== 'production') {
        console.warn('[usePermissions] /auth/me failed', error);
      }
      if (!mountedRef.current) return;
      setState(derivePermissions(null, false));
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchMe();

    if (!isSupabaseBrowserConfigured()) {
      return () => { mountedRef.current = false; };
    }

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      return () => { mountedRef.current = false; };
    }

    // React to login, logout, or token refresh — the latter is what makes
    // admin-side approval changes propagate without a hard reload.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED'
      ) {
        fetchMe();
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchMe]);

  return { ...state, refresh: fetchMe };
}
