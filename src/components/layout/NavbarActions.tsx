'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { useAuth } from '@/hooks/useAuth';
import { authService } from '@/services/auth.service';
// MVP/TESTING — `Link` and the `auth` namespace `t()` are only referenced from
// the commented-out logged-out branch below. Re-add them when restoring the
// `Log in` / `Sign up` buttons.

// ──────────────────────────────────────────────
// NavbarActions — Client Component
//
// Renders the right-side auth area in the Navbar:
//
//  • Loading  → skeleton pill
//  • Logged out → "Log in" button + "Sign up" link
//  • Logged in  → avatar initials + dropdown menu
//                  (user email, separator, Log out)
//
// This is the ONLY part of the Navbar that needs
// client-side state; everything else stays Server.
// ──────────────────────────────────────────────

/** Derive initials from an email address as a fallback avatar label. */
function getInitials(email: string | undefined, fullName?: string | null): string {
  if (fullName) {
    const parts = fullName.trim().split(/\s+/);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return '??';
}

// ── Dropdown (user menu) ──────────────────────

interface UserMenuProps {
  email:      string | undefined;
  initials:   string;
  onLogout:   () => void;
  isLoggingOut: boolean;
}

function UserMenu({ email, initials, onLogout, isLoggingOut }: UserMenuProps) {
  const t                           = useTranslations('auth');
  const [isOpen, setIsOpen]         = useState(false);
  const menuRef                     = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Close on Escape key.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar button */}
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3e5045] text-sm font-semibold text-white transition-colors hover:bg-[#323d36] focus:outline-none focus:ring-2 focus:ring-[#3e5045]/40 focus:ring-offset-2"
      >
        {initials}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          role="menu"
          className="absolute end-0 z-50 mt-2 w-56 origin-top-end rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
        >
          {/* User email header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-500">{t('signedInAs')}</p>
            <p className="mt-0.5 truncate text-sm font-medium text-gray-900">{email}</p>
          </div>

          {/* Logout */}
          <button
            type="button"
            role="menuitem"
            onClick={() => { setIsOpen(false); onLogout(); }}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {/* Log-out icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="h-4 w-4 text-gray-400"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {isLoggingOut ? t('loggingOut') : t('logoutButton')}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────

export function NavbarActions() {
  const { user, isLoading }             = useAuth();
  const router                          = useRouter();
  const [isLoggingOut, setLoggingOut]   = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await authService.logout();
    } finally {
      setLoggingOut(false);
      router.push('/');
      router.refresh();
    }
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div
        className="h-9 w-20 animate-pulse rounded-full bg-gray-100"
        aria-hidden="true"
      />
    );
  }

  // ── Logged out ──
  // MVP/TESTING — Login & Signup buttons hidden. Restore the block below when auth is re-enabled.
  if (!user) {
    return (
      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500">
        Guest
      </span>
    );
  }
  /* MVP/TESTING — original logged-out UI (restore when auth is re-enabled):
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/signup"
          className="rounded-lg bg-[#fcdcd8] px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-[#fbc8c2]"
        >
          {t('signupButton')}
        </Link>
        <Link
          href="/login"
          className="rounded-lg bg-[#3e5045] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#323d36]"
        >
          {t('loginButton')}
        </Link>
      </div>
    );
  }
  */

  // ── Logged in ──
  const initials = getInitials(user.email, user.user_metadata?.full_name);

  return (
    <UserMenu
      email={user.email}
      initials={initials}
      onLogout={handleLogout}
      isLoggingOut={isLoggingOut}
    />
  );
}
