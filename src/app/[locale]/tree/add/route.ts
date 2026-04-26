import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

import { ok, withErrorHandler } from '@/lib/api/response';
import { createPersonInTree } from '@/server/services/tree.service';
import { PersonInputSchema } from '@/features/family-tree/schemas/person.schema';
import { z } from 'zod';

const AddPersonBodySchema = z.object({
  treeId: z.string().min(1),
  person: PersonInputSchema,
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = AddPersonBodySchema.parse(await req.json());
  const person = await createPersonInTree(body.treeId, body.person);
  revalidatePath('/[locale]/tree', 'page');
  return ok({ id: person.id });
});
