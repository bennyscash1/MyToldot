'use client';

import { useState, useTransition } from 'react';

import { manageAccessRequest } from '@/server/actions/tree.actions';
import { Button } from '@/components/ui/Button';

export interface PendingMember {
  id: string;
  email: string;
  full_name: string | null;
  joined_at: string;
}

interface PanelLabels {
  title: string;
  approve: string;
  reject: string;
  requestedBy: string;
}

// ──────────────────────────────────────────────
// PendingMembersPanelClient
//
// Client island for the OWNER-only review section. Renders a list of
// EDITOR_PENDING members; each row has Approve and Reject buttons that
// call `manageAccessRequest`. Approved/rejected rows fade out locally
// while the server `revalidatePath` rebuilds the tree page.
// ──────────────────────────────────────────────

export function PendingMembersPanelClient({
  pending,
  labels,
}: {
  pending: PendingMember[];
  labels: PanelLabels;
}) {
  const [members, setMembers] = useState(pending);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function decide(memberId: string, approve: boolean) {
    setError(null);
    setPendingId(memberId);
    startTransition(async () => {
      const result = await manageAccessRequest(memberId, approve);
      setPendingId(null);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    });
  }

  if (members.length === 0) return null;

  return (
    <section className="shrink-0 border-b border-amber-200/70 bg-amber-50/70 px-4 py-3">
      <div className="mx-auto max-w-7xl">
        <h2 className="mb-2 text-sm font-semibold text-amber-900">{labels.title}</h2>
        {error && (
          <p className="mb-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
            {error}
          </p>
        )}
        <ul className="flex flex-col gap-2" role="list">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">
                  {m.full_name ?? m.email}
                </p>
                {m.full_name && (
                  <p className="truncate text-xs text-slate-500">{m.email}</p>
                )}
                <p className="mt-0.5 text-xs text-slate-400">
                  {labels.requestedBy}: {new Date(m.joined_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={isPending && pendingId === m.id}
                  onClick={() => decide(m.id, true)}
                >
                  {labels.approve}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={isPending && pendingId === m.id}
                  onClick={() => decide(m.id, false)}
                >
                  {labels.reject}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
