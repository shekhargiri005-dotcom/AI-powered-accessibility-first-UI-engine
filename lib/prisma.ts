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
 *
 * Neon serverless drops idle TCP connections after ~5 min.
 * The `$connect()` below reconnects automatically on the next warm invocation.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Share singleton across all hot-reloads in dev AND across warm invocations in production
globalForPrisma.prisma = prisma;

/**
 * Wraps a Prisma operation with automatic reconnection on connection-dropped errors.
 * Use this for any DB call that may hit a Neon "Error { kind: Closed }" error.
 *
 * Usage:
 *   const result = await withReconnect(() => prisma.project.findMany());
 */
const NEON_TRANSIENT = [
  'kind: Closed',
  'Connection closed',
  'connection timeout',
  'ECONNRESET',
  'terminating connection',
  'Connection pool timeout',
  'Can\'t reach database server',
  'fetch failed',
];

function isNeonTransient(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return NEON_TRANSIENT.some((s) => msg.includes(s));
}

/** Wait helper */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Wraps a Prisma operation with automatic reconnection on Neon transient errors.
 * Uses exponential backoff (e.g. 500ms, 1000ms, 2000ms) to give database pools
 * time to wake from idle.
 */
export async function withReconnect<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (!isNeonTransient(err) || attempt >= maxRetries) throw err;

      attempt++;
      const backoffMs = 500 * Math.pow(2, attempt - 1);
      console.warn(`[Prisma] Connection error detected, retrying (${attempt}/${maxRetries}) in ${backoffMs}ms...`);
      await sleep(backoffMs);
      try { await prisma.$connect(); } catch { /* ignore — next call will surface real error */ }
    }
  }
}
