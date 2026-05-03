'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import type { TreeMemberRole } from '@prisma/client';

import { Link, useRouter } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import {
  removeMemberFromTree,
  sendMemberPasswordResetEmail,
  setMemberEditorRole,
} from '@/server/actions/family-management.actions';

export interface FamilyMemberRow {
  id: string;
  userId: string;
  email: string;
  fullName: string | null;
  joinedAt: string;
  role: TreeMemberRole;
}

type FilterKey = 'all' | 'viewers' | 'editors' | 'owners';

function roleMatchesFilter(role: TreeMemberRole, filter: FilterKey): boolean {
  if (filter === 'all') return true;
  if (filter === 'owners') return role === 'OWNER';
  if (filter === 'editors') return role === 'EDITOR';
  if (filter === 'viewers') return role === 'VIEWER' || role === 'EDITOR_PENDING';
  return true;
}

export function FamilyManageMembersTable({
  treeRouteSegment,
  locale,
  members,
}: {
  treeRouteSegment: string;
  locale: string;
  members: FamilyMemberRow[];
}) {
  const t = useTranslations('familyManage');
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () => members.filter((m) => roleMatchesFilter(m.role, filter)),
    [members, filter],
  );

  function runAction(
    memberId: string,
    fn: () => Promise<
      { ok: true } | { ok: false; error: { message: string } }
    >,
  ) {
    setError(null);
    setInfo(null);
    setPendingId(memberId);
    startTransition(async () => {
      const result = await fn();
      setPendingId(null);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('filtersAria')}>
          {(
            [
              ['all', t('filterAll')] as const,
              ['viewers', t('filterViewers')] as const,
              ['editors', t('filterEditors')] as const,
              ['owners', t('filterOwners')] as const,
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === key
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <Link
          href={`/tree/${treeRouteSegment}`}
          className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
        >
          ← {t('backToTree')}
        </Link>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      {info && (
        <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {info}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-4 py-3 text-start font-semibold text-slate-700">
                {t('colEmail')}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-semibold text-slate-700">
                {t('colFullName')}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-semibold text-slate-700">
                {t('colJoined')}
              </th>
              <th scope="col" className="px-4 py-3 text-start font-semibold text-slate-700">
                {t('colRole')}
              </th>
              <th scope="col" className="px-4 py-3 text-end font-semibold text-slate-700">
                {t('colActions')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  {members.length === 0 ? t('emptyAll') : t('emptyFiltered')}
                </td>
              </tr>
            ) : (
              filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-slate-800">
                    {m.email}
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    {m.fullName ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {new Date(m.joinedAt).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US')}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={m.role} />
                  </td>
                  <td className="px-4 py-3">
                    <RowActions
                      member={m}
                      treeRouteSegment={treeRouteSegment}
                      locale={locale}
                      isBusy={isPending && pendingId === m.id}
                      onError={setError}
                      onInfo={setInfo}
                      runAction={runAction}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: TreeMemberRole }) {
  const t = useTranslations('familyManage');
  const key =
    role === 'OWNER'
      ? 'roleOwner'
      : role === 'EDITOR'
        ? 'roleEditor'
        : role === 'EDITOR_PENDING'
          ? 'roleEditorPending'
          : 'roleViewer';
  const styles: Record<TreeMemberRole, string> = {
    OWNER: 'bg-emerald-100 text-emerald-800',
    EDITOR: 'bg-blue-100 text-blue-800',
    EDITOR_PENDING: 'bg-amber-100 text-amber-900',
    VIEWER: 'bg-slate-100 text-slate-600',
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[role]}`}
    >
      {t(key)}
    </span>
  );
}

function RowActions({
  member,
  treeRouteSegment,
  locale,
  isBusy,
  onError,
  onInfo,
  runAction,
}: {
  member: FamilyMemberRow;
  treeRouteSegment: string;
  locale: string;
  isBusy: boolean;
  onError: (msg: string | null) => void;
  onInfo: (msg: string | null) => void;
  runAction: (
    memberId: string,
    fn: () => Promise<
      { ok: true } | { ok: false; error: { message: string } }
    >,
  ) => void;
}) {
  const t = useTranslations('familyManage');
  const isOwner = member.role === 'OWNER';
  const canPromote =
    !isOwner && (member.role === 'VIEWER' || member.role === 'EDITOR_PENDING');
  const canDemote = !isOwner && member.role === 'EDITOR';
  const canRevoke = !isOwner;
  const canReset = !isOwner;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canPromote && (
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={isBusy}
          onClick={() =>
            runAction(member.id, async () => {
              const r = await setMemberEditorRole(treeRouteSegment, member.id, 'editor');
              if (!r.ok) return { ok: false, error: { message: r.error.message } };
              return { ok: true };
            })
          }
        >
          {t('promoteToEditor')}
        </Button>
      )}
      {canDemote && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isBusy}
          onClick={() =>
            runAction(member.id, async () => {
              const r = await setMemberEditorRole(treeRouteSegment, member.id, 'viewer');
              if (!r.ok) return { ok: false, error: { message: r.error.message } };
              return { ok: true };
            })
          }
        >
          {t('demoteToViewer')}
        </Button>
      )}
      {canReset && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isBusy}
          onClick={() =>
            runAction(member.id, async () => {
              const r = await sendMemberPasswordResetEmail(
                treeRouteSegment,
                member.id,
                locale,
              );
              if (!r.ok) return { ok: false, error: { message: r.error.message } };
              onInfo(t('resetSent'));
              return { ok: true };
            })
          }
        >
          {t('sendPasswordReset')}
        </Button>
      )}
      {canRevoke && (
        <Button
          type="button"
          size="sm"
          variant="danger"
          disabled={isBusy}
          onClick={() => {
            if (!window.confirm(t('revokeConfirm'))) return;
            onError(null);
            runAction(member.id, async () => {
              const r = await removeMemberFromTree(treeRouteSegment, member.id);
              if (!r.ok) return { ok: false, error: { message: r.error.message } };
              return { ok: true };
            });
          }}
        >
          {t('revokeAccess')}
        </Button>
      )}
    </div>
  );
}
