'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/routing';
import { authService } from '@/services/auth.service';
import { usePermissions } from '@/hooks/usePermissions';

// ──────────────────────────────────────────────
// PendingApprovalActions — Client Component
//
// Renders the two interactive buttons on the
// /pending-approval landing card:
//   • "Refresh status"   — calls usePermissions().refresh() and,
//                           if approval just landed, navigates home.
//   • "Sign out"         — calls authService.logout() and routes to /.
//
// Kept as its own file so the parent page can stay a Server
// Component and use translations on the server side.
// ──────────────────────────────────────────────

export function PendingApprovalActions() {
  const t                  = useTranslations('auth');
  const router             = useRouter();
  const { refresh, isApproved } = usePermissions();

  const [isRefreshing, setRefreshing]   = useState(false);
  const [isLoggingOut, setLoggingOut]   = useState(false);
  const [showApproved, setShowApproved] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
      // After refresh, the hook's internal state updates async; rely on the
      // current `isApproved` (post-render) on the next click. As a UX nicety
      // we also peek and route immediately when it flipped.
    } finally {
      setRefreshing(false);
      // Tiny delay so the new permissions propagate to this component before
      // we read them.
      setTimeout(() => {
        if (isApproved) {
          setShowApproved(true);
          router.push('/');
          router.refresh();
        }
      }, 150);
    }
  }

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

  return (
    <div className="mt-6 flex flex-col gap-2">
      {showApproved && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {t('approvedMessage')}
        </p>
      )}

      <button
        type="button"
        onClick={handleRefresh}
        disabled={isRefreshing || isLoggingOut}
        className="inline-flex w-full items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 disabled:opacity-60"
      >
        {isRefreshing ? t('refreshingStatus') : t('refreshStatus')}
      </button>

      <button
        type="button"
        onClick={handleLogout}
        disabled={isRefreshing || isLoggingOut}
        className="inline-flex w-full items-center justify-center rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-60"
      >
        {isLoggingOut ? t('loggingOut') : t('logoutButton')}
      </button>
    </div>
  );
}
