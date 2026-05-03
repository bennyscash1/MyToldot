'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

import { prisma } from '@/lib/prisma';
import { requireTreeRole } from '@/lib/api/auth';
import { Errors } from '@/lib/api/errors';
import { withAction, type ActionResult } from '@/lib/api/action-result';
import { CuidSchema } from '@/features/family-tree/schemas/person.schema';
import {
  findTreeByRouteParam,
  resolveTreeRouteRevalidateSegment,
} from '@/server/services/tree.service';

async function resolveTreeIdFromRouteSegment(segment: string) {
  const tree = await findTreeByRouteParam(segment.trim());
  if (!tree) throw Errors.notFound('Tree');
  return tree.id;
}

async function revalidateTreeAndManage(treeId: string) {
  const seg = await resolveTreeRouteRevalidateSegment(treeId);
  if (seg) {
    revalidatePath(`/[locale]/tree/${seg}`, 'layout');
    revalidatePath(`/[locale]/tree/${seg}/manage`, 'page');
  }
}

async function loadMemberForTreeOrThrow(treeId: string, memberId: string) {
  const id = CuidSchema.parse(memberId);
  const member = await prisma.treeMember.findUnique({
    where: { id },
    select: { id: true, tree_id: true, user_id: true, role: true },
  });
  if (!member) throw Errors.notFound('Member');
  if (member.tree_id !== treeId) {
    throw Errors.forbidden('Member belongs to another family');
  }
  return member;
}

export async function setMemberEditorRole(
  treeRouteSegment: string,
  memberId: string,
  mode: 'editor' | 'viewer',
): Promise<ActionResult<{ role: string }>> {
  return withAction(async () => {
    const treeId = await resolveTreeIdFromRouteSegment(treeRouteSegment);
    await requireTreeRole(treeId, 'OWNER');
    const member = await loadMemberForTreeOrThrow(treeId, memberId);

    if (member.role === 'OWNER') {
      throw Errors.badRequest('Cannot change the owner role here');
    }

    if (mode === 'editor') {
      if (member.role !== 'VIEWER' && member.role !== 'EDITOR_PENDING') {
        throw Errors.badRequest('Only viewers and pending editors can be promoted');
      }
      await prisma.treeMember.update({
        where: { id: member.id },
        data: { role: 'EDITOR' },
      });
    } else {
      if (member.role !== 'EDITOR') {
        throw Errors.badRequest('Only editors can be demoted to viewer');
      }
      await prisma.treeMember.update({
        where: { id: member.id },
        data: { role: 'VIEWER' },
      });
    }

    await revalidateTreeAndManage(treeId);
    const updated = await prisma.treeMember.findUnique({
      where: { id: member.id },
      select: { role: true },
    });
    return { role: updated!.role };
  });
}

export async function removeMemberFromTree(
  treeRouteSegment: string,
  memberId: string,
): Promise<ActionResult<{ removedId: string }>> {
  return withAction(async () => {
    const treeId = await resolveTreeIdFromRouteSegment(treeRouteSegment);
    await requireTreeRole(treeId, 'OWNER');
    const member = await loadMemberForTreeOrThrow(treeId, memberId);

    if (member.role === 'OWNER') {
      const ownerCount = await prisma.treeMember.count({
        where: { tree_id: treeId, role: 'OWNER' },
      });
      if (ownerCount <= 1) {
        throw Errors.badRequest('Cannot remove the last owner of this family');
      }
    }

    await prisma.treeMember.delete({ where: { id: member.id } });
    await revalidateTreeAndManage(treeId);
    return { removedId: member.id };
  });
}

export async function sendMemberPasswordResetEmail(
  treeRouteSegment: string,
  memberId: string,
  locale: string,
): Promise<ActionResult<{ ok: true }>> {
  return withAction(async () => {
    const treeId = await resolveTreeIdFromRouteSegment(treeRouteSegment);
    await requireTreeRole(treeId, 'OWNER');
    const member = await loadMemberForTreeOrThrow(treeId, memberId);

    if (member.role === 'OWNER') {
      throw Errors.badRequest(
        'Password reset is not available for owners from this screen',
      );
    }

    const row = await prisma.treeMember.findUnique({
      where: { id: member.id },
      include: { user: { select: { email: true } } },
    });
    const email = row?.user.email;
    if (!email?.trim()) {
      throw Errors.badRequest('No email for this member');
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      throw Errors.internal('Supabase is not configured');
    }

    const redirectTo = await buildPasswordRecoveryRedirectTo(locale);

    const supabase = createClient(url, anon, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error('[sendMemberPasswordResetEmail]', error);
      throw Errors.internal(error.message);
    }

    return { ok: true as const };
  });
}

async function buildPasswordRecoveryRedirectTo(locale: string): Promise<string> {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (base) {
    return `${base}/${locale}/login`;
  }
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  if (!host) {
    throw Errors.internal('Cannot build password reset redirect URL');
  }
  return `${proto}://${host}/${locale}/login`;
}
