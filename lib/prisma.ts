import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Singleton PrismaClient shared across all invocations in the same Node process.
 *
 * On Vercel, a warm serverless function REUSES the same process. Without the
 * global singleton, each module-level import creates a fresh PrismaClient and
 * burns a DB connection — exhausting the pool limit of 5.
 *
 * Companion: set `?connection_limit=1&pool_timeout=0` in DATABASE_URL in Vercel
 * env vars so that each serverless instance takes at most 1 connection from the pool.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Share singleton across all hot-reloads in dev AND across warm invocations in production
globalForPrisma.prisma = prisma;
