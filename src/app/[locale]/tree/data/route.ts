import { NextRequest } from 'next/server';

import { ok, withErrorHandler } from '@/lib/api/response';
import { resolveTreePageData } from '@/server/services/tree.service';

export const GET = withErrorHandler(async (req: NextRequest) => {
  void req;
  const data = await resolveTreePageData();
  return ok(data);
});
