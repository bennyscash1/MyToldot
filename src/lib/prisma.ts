import { PrismaClient } from '@prisma/client';

// ──────────────────────────────────────────────
// Prisma Singleton
//
// ⚠️  BACKEND ONLY — This file must NEVER be
//    imported from src/components/, src/hooks/,
//    or src/services/. It belongs exclusively in:
//      → src/app/api/v1/**/route.ts
//      → src/app/actions/**  (future Server Actions)
//
// Why a singleton? Next.js in development mode
// does hot-reloads, which would otherwise create
// hundreds of PrismaClient instances and exhaust
// the database connection pool. Storing the
// instance on `globalThis` survives HMR.
// ──────────────────────────────────────────────

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
