'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  createSupabaseBrowserClient,
  isSupabaseBrowserConfigured,
} from '@/lib/supabase/client';

// ──────────────────────────────────────────────
// useAuth — resolves the current Supabase session
// in Client Components.
//
// Uses getUser() (server-validated JWT) not
// getSession() (local cookie read only).
// Listens to onAuthStateChange so the UI reacts
// instantly on login/logout without a page reload.
// ──────────────────────────────────────────────

export interface AuthState {
  user:      User | null;
  isLoading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser]           = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseBrowserConfigured()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const supabase = createSupabaseBrowserClient();

    // Initial load.
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setIsLoading(false);
    });

    // Real-time session changes (login, logout, token refresh).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setIsLoading(false);
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, isLoading };
}
