import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

import { ok, withErrorHandler } from '@/lib/api/response';
import { removePersonFromTree, RemovePersonSchema } from '@/server/services/tree.service';

export const DELETE = withErrorHandler(async (req: NextRequest) => {
  const body = RemovePersonSchema.parse(await req.json());
  const result = await removePersonFromTree(body.treeId, body.personId);
  revalidatePath('/[locale]/tree', 'page');
  return ok(result);
});
