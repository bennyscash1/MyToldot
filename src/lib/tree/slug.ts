import { randomInt } from 'crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DEFAULT_LENGTH = 6;
const DEFAULT_MAX_ATTEMPTS = 8;

type TreeStore = Pick<PrismaClient, 'tree'> | Pick<Prisma.TransactionClient, 'tree'>;

export function generateTreeSlug(length = DEFAULT_LENGTH): string {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

export async function generateUniqueTreeSlug(
  db: TreeStore,
  options?: { length?: number; maxAttempts?: number },
): Promise<string> {
  const length = options?.length ?? DEFAULT_LENGTH;
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const slug = generateTreeSlug(length);
    const exists = await db.tree.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!exists) return slug;
  }

  throw new Error('Failed to generate a unique tree slug');
}
