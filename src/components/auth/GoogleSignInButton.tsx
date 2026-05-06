'use client';

import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function GoogleSignInButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogleSignIn() {
    setError(null);
    setIsLoading(true);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      // GOOGLE AUTH ADDED: user-friendly message when Supabase env is missing in browser.
      setError('Google sign-in is not configured right now. Please try again later.');
      setIsLoading(false);
      return;
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (oauthError) {
      setError('Could not start Google sign-in. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm transition-colors duration-150 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleIcon />
        {isLoading ? 'Redirecting to Google...' : 'Continue with Google'}
      </button>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M21.805 10.023H12.18v3.955h5.512c-.237 1.275-.96 2.355-2.048 3.08v2.559h3.313c1.94-1.786 3.048-4.418 3.048-7.534 0-.685-.062-1.344-.2-2.06z"
        fill="#4285F4"
      />
      <path
        d="M12.18 22c2.76 0 5.077-.916 6.776-2.383l-3.313-2.559c-.916.616-2.088.988-3.463.988-2.655 0-4.904-1.792-5.707-4.205H3.058v2.64A10.234 10.234 0 0012.18 22z"
        fill="#34A853"
      />
      <path
        d="M6.473 13.84A6.105 6.105 0 016.15 12c0-.638.112-1.255.322-1.84V7.52H3.057A10.234 10.234 0 001.946 12c0 1.637.392 3.185 1.111 4.48l3.416-2.64z"
        fill="#FBBC05"
      />
      <path
        d="M12.18 5.955c1.501 0 2.85.518 3.91 1.532l2.934-2.934C17.252 2.93 14.935 2 12.18 2A10.234 10.234 0 003.058 7.52l3.415 2.64c.804-2.413 3.053-4.205 5.707-4.205z"
        fill="#EA4335"
      />
    </svg>
  );
}
