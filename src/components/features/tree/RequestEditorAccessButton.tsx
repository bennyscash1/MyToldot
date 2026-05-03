'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { TreeMemberRole } from '@prisma/client';

import { requestEditorAccess } from '@/server/actions/tree.actions';
import { Button } from '@/components/ui/Button';

// ──────────────────────────────────────────────
// RequestEditorAccessButton
//
// Strip rendered above the tree canvas for VIEWERs and EDITOR_PENDING
// members. VIEWERs see a "Request Edit Access" button that submits the
// `requestEditorAccess` server action; EDITOR_PENDING members see a
// disabled "Pending approval" pill instead.
//
// Hidden completely for EDITOR / OWNER / non-members — the parent
// page is responsible for not rendering this component for those roles.
// ──────────────────────────────────────────────

interface Props {
  treeId: string;
  initialRole: TreeMemberRole;
}

export function RequestEditorAccessButton({ treeId, initialRole }: Props) {
  const t = useTranslations('treePerms');
  const [role, setRole] = useState<TreeMemberRole>(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await requestEditorAccess(treeId);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      // On success, the server-side revalidatePath rerenders the parent
      // page with the new role; we mirror it here so the button updates
      // immediately without waiting for the navigation roundtrip.
      setRole('EDITOR_PENDING');
    });
  }

  if (role === 'EDITOR_PENDING') {
    return (
      <div className="shrink-0 border-b border-amber-200/60 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
        <span className="inline-flex items-center gap-1.5">
          <ClockIcon />
          {t('accessRequested')}
        </span>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-slate-200/60 bg-slate-50/70 px-4 py-2">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">{t('viewerHint')}</p>
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
