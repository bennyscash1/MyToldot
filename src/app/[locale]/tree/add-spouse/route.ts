import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';

import { ok, withErrorHandler } from '@/lib/api/response';
import { addSpouseInTree, AddSpouseSchema } from '@/server/services/tree.service';

export const POST = withErrorHandler(async (req: NextRequest) => {
  const body = AddSpouseSchema.parse(await req.json());
  const result = await addSpouseInTree(body);
  revalidatePath('/[locale]/tree', 'page');
  return ok(result);
});
