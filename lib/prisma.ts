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
export async function withReconnect<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Neon/PG connection-closed errors — reconnect and retry once
    if (
      msg.includes('kind: Closed') ||
      msg.includes('Connection closed') ||
      msg.includes('connection timeout') ||
      msg.includes('ECONNRESET') ||
      msg.includes('terminating connection')
    ) {
      try {
        await prisma.$connect();
      } catch {
        // If reconnect itself fails, fall through and let the original error surface
      }
      return await fn();
    }
    throw err;
  }
}
