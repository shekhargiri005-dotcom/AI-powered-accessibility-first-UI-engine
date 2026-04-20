/**
 * @file lib/utils/simpleCache.ts
 * Lightweight in-memory cache with TTL for performance optimization.
 * Used for caching expensive operations like blueprint selection, knowledge retrieval.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private defaultTTL: number;

  constructor(defaultTTLMs: number = 5 * 60 * 1000) {
    this.defaultTTL = defaultTTLMs;
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const expiresAt = Date.now() + (ttlMs ?? this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  getOrSet(key: string, factory: () => T, ttlMs?: number): T {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    
    const value = factory();
    this.set(key, value, ttlMs);
    return value;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  /** Clean up expired entries */
  prune(): number {
    const now = Date.now();
    let deleted = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        deleted++;
      }
    }
    return deleted;
  }
}

// Global cache instances for different use cases
export const blueprintCache = new SimpleCache<ReturnType<typeof import('../intelligence/blueprintEngine').selectBlueprint>>(2 * 60 * 1000); // 2 min
export const semanticContextCache = new SimpleCache<string>(5 * 60 * 1000); // 5 min
export const promptCache = new SimpleCache<{ system: string; user: string }>(3 * 60 * 1000); // 3 min
