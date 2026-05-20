'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { TreeMemberRole } from '@prisma/client';

import {
  joinAndRequestEditorAccess,
  requestEditorAccess,
} from '@/server/actions/tree.actions';
import { Button } from '@/components/ui/Button';

// ──────────────────────────────────────────────
// RequestEditorAccessButton
//
// Strip rendered above the tree canvas for logged-in users whose effective
// role is null (not yet a member), VIEWER, or EDITOR_PENDING.
//
// - role === null      → call joinAndRequestEditorAccess (creates a pending
//                        membership and notifies the owner via revalidation).
// - role === 'VIEWER'  → call requestEditorAccess (flips VIEWER → PENDING).
// - role === 'EDITOR_PENDING' → render the amber pending pill (no button).
//
// EDITOR / OWNER never see this strip — the parent page filters them out.
// ──────────────────────────────────────────────

interface Props {
  treeId: string;
  initialRole: TreeMemberRole | null;
}

const SUCCESS_ALERT_TIMEOUT_MS = 10_000;

export function RequestEditorAccessButton({ treeId, initialRole }: Props) {
  const t = useTranslations('treePerms');
  const [role, setRole] = useState<TreeMemberRole | null>(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [justJoined, setJustJoined] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!justJoined) return;
    const timer = window.setTimeout(() => setJustJoined(false), SUCCESS_ALERT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [justJoined]);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result =
        role === null
          ? await joinAndRequestEditorAccess(treeId)
          : await requestEditorAccess(treeId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.data.status === 'ALREADY_EDITOR') {
        setRole('EDITOR');
        return;
      }
      setRole('EDITOR_PENDING');
      setJustJoined(true);
    });
  }

  if (role === 'EDITOR_PENDING') {
    return (
      <>
        <div className="shrink-0 border-b border-amber-200/60 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon />
            {t('accessRequested')}
          </span>
        </div>
        {justJoined && (
          <div
            role="status"
            className="shrink-0 border-b border-emerald-200/60 bg-emerald-50 px-4 py-2 text-center text-sm text-emerald-800"
          >
            {t('requestSent')}
          </div>
        )}
      </>
    );
  }

  if (role === 'EDITOR' || role === 'OWNER') {
    // Should not normally render here (parent filters), but guard against stale state.
    return null;
  }

  const hintKey = role === null ? 'guestHint' : 'viewerHint';

  return (
    <div className="shrink-0 border-b border-slate-200/60 bg-slate-50/70 px-4 py-2">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{t(hintKey)}</p>
        <div className="flex items-center gap-3">
          {error && <span className="text-sm text-red-600">{error}</span>}
          <Button
            type="button"
            onClick={handleClick}
            disabled={isPending}
            size="sm"
          >
            {isPending ? t('requesting') : t('requestAccess')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
