import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

import { ok, withErrorHandler } from '@/lib/api/response';
import { addParentInTree, AddParentSchema } from '@/server/services/tree.service';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = AddParentSchema.parse(await req.json());
  const result = await addParentInTree(body);
  revalidatePath('/[locale]/tree', 'page');
  return ok(result);
});
