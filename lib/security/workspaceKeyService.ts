/**
 * @file lib/security/workspaceKeyService.ts
 * 
 * Fetches the decrypted API key for a given workspace+provider from the DB.
 * Caches results in a TTL map to avoid repeated DB lookups per request.
 */

import { prisma } from '@/lib/prisma';
import { encryptionService } from './encryption';

const DEFAULT_WORKSPACE = 'default';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  value: string | null;
  expiresAt: number;
}

// Per-process in-memory cache: "workspaceId:provider" → decrypted key (or null)
const keyCache = new Map<string, CacheEntry>();

function makeCacheKey(workspaceId: string, provider: string): string {
  return `${workspaceId}:${provider}`;
}

/**
 * Returns the decrypted API key for the given workspace+provider, or null
 * if none is stored (caller should fall back to env vars).
 */
export async function getWorkspaceApiKey(
  provider: string,
  workspaceId = DEFAULT_WORKSPACE
): Promise<string | null> {
  const cKey = makeCacheKey(workspaceId, provider);
  const cached = keyCache.get(cKey);
  
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  try {
    const settings = await prisma.workspaceSettings.findUnique({
      where: {
        workspaceId_provider: { workspaceId, provider },
      },
    });

    const decrypted = settings?.encryptedApiKey
      ? encryptionService.decrypt(settings.encryptedApiKey)
      : null;

    keyCache.set(cKey, { value: decrypted, expiresAt: Date.now() + CACHE_TTL_MS });
    return decrypted;
  } catch (err) {
    console.error('[workspaceKeyService] Failed to fetch key from DB:', err);
    return null;
  }
}

/**
 * Invalidates the cache for a specific workspace+provider.
 * Call this after saving a new key so the next request picks up the new key.
 */
export function invalidateWorkspaceKey(
  provider: string,
  workspaceId = DEFAULT_WORKSPACE
): void {
  const cKey = makeCacheKey(workspaceId, provider);
  keyCache.delete(cKey);
}

/**
 * Returns the preferred model for a workspace+provider, or null if none set.
 */
export async function getWorkspaceModel(
  provider: string,
  workspaceId = DEFAULT_WORKSPACE
): Promise<string | null> {
  try {
    const settings = await prisma.workspaceSettings.findUnique({
      where: {
        workspaceId_provider: { workspaceId, provider },
      },
      select: { model: true },
    });
    return settings?.model ?? null;
  } catch {
    return null;
  }
}
