import { getTranslations } from 'next-intl/server';

import { prisma } from '@/lib/prisma';
import { PendingMembersPanelClient, type PendingMember } from './PendingMembersPanelClient';

// ──────────────────────────────────────────────
// PendingMembersPanel — Server Component (OWNER only)
//
// Renders an in-page admin section listing all members of `treeId`
// whose role is EDITOR_PENDING, with Approve/Reject buttons handled
// by the client child.
//
// Returns null when there are no pending requests so the panel
// disappears cleanly from the layout.
// ──────────────────────────────────────────────

export async function PendingMembersPanel({ treeId }: { treeId: string }) {
  const t = await getTranslations('treePerms');

  let pending: PendingMember[] = [];
  try {
    const rows = await prisma.treeMember.findMany({
      where: { tree_id: treeId, role: 'EDITOR_PENDING' },
      orderBy: { joined_at: 'asc' },
      select: {
        id: true,
        joined_at: true,
        user: { select: { email: true, full_name: true } },
      },
    });
    pending = rows.map((r) => ({
      id: r.id,
      email: r.user.email,
      full_name: r.user.full_name,
      joined_at: r.joined_at.toISOString(),
    }));
  } catch {
    // If the DB is unavailable, render nothing rather than break the page.
    return null;
  }

  if (pending.length === 0) return null;

  return (
    <PendingMembersPanelClient
      pending={pending}
      labels={{
        title: t('pendingMembersTitle'),
        approve: t('approve'),
        reject: t('reject'),
        requestedBy: t('requestedBy'),
      }}
    />
  );
}
