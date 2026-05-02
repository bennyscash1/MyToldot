import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { ok, withErrorHandler } from '@/lib/api/response';
import { createPersonInTree, resolveTreeIdFromRouteParam } from '@/server/services/tree.service';
import { PersonInputSchema } from '@/features/family-tree/schemas/person.schema';

const AddPersonBodySchema = z.object({
  treeId: z.string().min(1).optional(),
  person: PersonInputSchema,
});

type RouteContext = { params: Promise<{ locale: string; shortCode: string }> };

export const POST = withErrorHandler(async (req: NextRequest, ctx: RouteContext) => {
  const { locale, shortCode } = await ctx.params;
  const treeId = await resolveTreeIdFromRouteParam(shortCode);
  const json = await req.json();
  const body = AddPersonBodySchema.parse(json);
  const person = await createPersonInTree(treeId, body.person);
  revalidatePath(`/${locale}/tree/${shortCode}`, 'page');
  return ok({ id: person.id });
});
