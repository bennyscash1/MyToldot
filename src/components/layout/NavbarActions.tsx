'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';

import { Link, useRouter } from '@/i18n/routing';
import { usePermissions } from '@/hooks/usePermissions';
import { authService } from '@/services/auth.service';

// ──────────────────────────────────────────────
// NavbarActions — Client Component
//
// Renders the right-side auth area in the Navbar:
//
//  • Loading      → skeleton pill
//  • Logged out   → "Log in" + "Sign up" buttons
//  • Pending      → amber "Pending approval" badge linking to
//                   /pending-approval, plus avatar dropdown
//  • Logged in OK → avatar initials + dropdown menu
//
// Only this small slice of the Navbar needs client state;
// everything else stays in the Server Component parent.
// ──────────────────────────────────────────────

/** Derive initials from an email address as a fallback avatar label. */
function getInitials(email: string | null | undefined, fullName?: string | null): string {
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
  email:        string | null | undefined;
  initials:     string;
  isApproved:   boolean;
  onLogout:     () => void;
  isLoggingOut: boolean;
}

function UserMenu({ email, initials, isApproved, onLogout, isLoggingOut }: UserMenuProps) {
  const t                           = useTranslations('auth');
  const [isOpen, setIsOpen]         = useState(false);
  const menuRef                     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#3e5045] text-sm font-semibold text-white transition-colors hover:bg-[#323d36] focus:outline-none focus:ring-2 focus:ring-[#3e5045]/40 focus:ring-offset-2"
      >
        {initials}
        {!isApproved && (
          <span
            className="absolute -bottom-0.5 -end-0.5 h-3 w-3 rounded-full border-2 border-[#f4f3e9] bg-amber-500"
            aria-hidden="true"
          />
        )}
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute end-0 z-50 mt-2 w-56 origin-top-end rounded-xl border border-gray-100 bg-white py-1 shadow-lg"
        >
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-medium text-gray-500">{t('signedInAs')}</p>
            <p className="mt-0.5 truncate text-sm font-medium text-gray-900">{email}</p>
          </div>

          {!isApproved && (
            <Link
              href="/pending-approval"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {t('pendingBadge')}
            </Link>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => { setIsOpen(false); onLogout(); }}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
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
  const t                                 = useTranslations('auth');
  const { isLoading, isAuthenticated, isApproved, profile } = usePermissions();
  const router                            = useRouter();
  const [isLoggingOut, setLoggingOut]     = useState(false);

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

  // ── Logged out: Login + Signup buttons ──
  if (!isAuthenticated) {
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

  // ── Logged in (with optional pending badge inside the avatar) ──
  const initials = getInitials(profile?.email, profile?.full_name);

  return (
    <div className="flex items-center gap-2">
      {!isApproved && (
        <Link
          href="/pending-approval"
          className="hidden items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-200 sm:inline-flex"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="h-3.5 w-3.5"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t('pendingBadge')}
        </Link>
      )}

      <UserMenu
        email={profile?.email}
        initials={initials}
        isApproved={isApproved}
        onLogout={handleLogout}
        isLoggingOut={isLoggingOut}
      />
    </div>
  );
}
