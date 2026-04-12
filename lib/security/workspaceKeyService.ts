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
 * 
 * If userId is provided, it verifies the user is a member of that workspace.
 */
export async function getWorkspaceApiKey(
  provider: string,
  workspaceId = DEFAULT_WORKSPACE,
  userId?: string
): Promise<string | null> {
  // 1. Authorization check if userId is provided
  if (userId && workspaceId !== DEFAULT_WORKSPACE) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId }
      }
    });
    if (!membership) return null;
  }

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

    let decrypted = settings?.encryptedApiKey
      ? encryptionService.decrypt(settings.encryptedApiKey)
      : null;

    if (decrypted === 'ENV_FALLBACK') {
      decrypted = null;
    }

    keyCache.set(cKey, { value: decrypted, expiresAt: Date.now() + CACHE_TTL_MS });
    return decrypted;
  } catch (err) {
    console.error('[workspaceKeyService] Failed to fetch key from DB:', err);
    return null;
  }
}

/**
 * Invalidates the cache for a specific workspace+provider.
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
  workspaceId = DEFAULT_WORKSPACE,
  userId?: string
): Promise<string | null> {
  // Authorization check
  if (userId && workspaceId !== DEFAULT_WORKSPACE) {
    const membership = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId }
      }
    });
    if (!membership) return null;
  }

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
