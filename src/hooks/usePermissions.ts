'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from '@/lib/supabase/client';
import { apiClient, ServiceError } from '@/services/api.client';

// ──────────────────────────────────────────────
// usePermissions — Client-side session resolver
//
// Tells client components whether the current visitor is signed in
// and exposes their basic profile (id/email/full_name). All editing
// rights are enforced PER-TREE on the server inside each /tree page
// via TreeMember.role and the requireTreeRole guard, so this hook
// no longer reports "canEdit" / "canDelete".
//
// Wraps:
//   • GET /api/v1/auth/me  (returns the user's profile or null)
//   • Supabase onAuthStateChange (re-fetches on login/logout/refresh)
// ──────────────────────────────────────────────

export interface UserProfile {
  id:        string;
  email:     string;
  full_name: string | null;
}

export interface Permissions {
  /** True until the first /api/v1/auth/me round-trip resolves. */
  isLoading:       boolean;
  /** A Supabase session exists. */
  isAuthenticated: boolean;
  /** Raw profile when authenticated, else null. */
  profile:         UserProfile | null;
  /** Force a re-fetch of /api/v1/auth/me. */
  refresh:         () => Promise<void>;
}

interface MeResponse {
  user: UserProfile | null;
}

const DEFAULT_PERMISSIONS: Omit<Permissions, 'refresh'> = {
  isLoading:       true,
  isAuthenticated: false,
  profile:         null,
};

function deriveState(profile: UserProfile | null, isLoading: boolean): Omit<Permissions, 'refresh'> {
  return {
    isLoading,
    isAuthenticated: !!profile,
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
      setState(deriveState(res.user, false));
    } catch (error) {
      if (!(error instanceof ServiceError) && process.env.NODE_ENV !== 'production') {
        console.warn('[usePermissions] /auth/me failed', error);
      }
      if (!mountedRef.current) return;
      setState(deriveState(null, false));
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
