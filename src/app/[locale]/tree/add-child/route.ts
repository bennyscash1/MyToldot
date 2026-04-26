import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

import { ok, withErrorHandler } from '@/lib/api/response';
import { addChildInTree, AddChildSchema } from '@/server/services/tree.service';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = AddChildSchema.parse(await req.json());
  const result = await addChildInTree(body);
  revalidatePath('/[locale]/tree', 'page');
  return ok(result);
});
