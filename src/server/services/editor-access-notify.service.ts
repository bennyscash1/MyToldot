import { parsePreferredLocale, type PreferredLocale } from '@/lib/locale-preference';
import { getSiteOrigin } from '@/lib/site-url';
import { prisma } from '@/lib/prisma';
import { sendEditorRequestEmail } from '@/server/lib/editor-request-email';

/**
 * Notifies the tree OWNER by email when someone requests editor access.
 * Never throws — logs failures so the caller's DB transaction is unaffected.
 */
export async function notifyOwnerOfEditorRequest(
  treeId: string,
  requesterUserId: string,
): Promise<void> {
  try {
    const [tree, ownerMembership, requester] = await Promise.all([
      prisma.tree.findUnique({
        where: { id: treeId },
        select: { name: true, shortCode: true },
      }),
      prisma.treeMember.findFirst({
        where: { tree_id: treeId, role: 'OWNER' },
        include: {
          user: {
            select: { email: true, full_name: true, preferred_language: true },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: requesterUserId },
        select: { email: true, full_name: true },
      }),
    ]);

    if (!tree?.shortCode || !ownerMembership?.user?.email || !requester?.email) {
      return;
    }

    const ownerLanguage: PreferredLocale =
      parsePreferredLocale(ownerMembership.user.preferred_language) ?? 'he';
    const siteOrigin = await getSiteOrigin();
    const manageUrl = `${siteOrigin}/${ownerLanguage}/tree/${tree.shortCode}/manage`;

    await sendEditorRequestEmail({
      to: ownerMembership.user.email,
      ownerName:
        ownerMembership.user.full_name ?? ownerMembership.user.email,
      ownerLanguage,
      requesterName: requester.full_name ?? requester.email,
      requesterEmail: requester.email,
      treeName: tree.name ?? (ownerLanguage === 'he' ? 'המשפחה שלך' : 'your family'),
      manageUrl,
    });
  } catch (err) {
    console.error('[editor-access-notify] Failed to send email:', err);
  }
}
