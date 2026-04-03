/**
 * @file lib/ai/cache.ts
 * Pluggable caching abstraction for the AI engine.
 *
 * Production (Vercel): Uses Upstash Redis via HTTP — serverless compatible.
 * Development (local): Falls back to an in-memory LRU cache.
 *
 * Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for production Redis.
 * If neither is set, the MemoryCache is used automatically.
 */

import crypto from 'crypto';
import type { GenerateOptions, Message } from './adapters/base';

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface CacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
}

// ─── In-Memory Fallback (development) ─────────────────────────────────────────

class MemoryCache implements CacheProvider {
  private store = new Map<string, { value: string; expiresAt: number }>();
  private readonly maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds = 3600): Promise<void> {
    if (this.store.size >= this.maxSize) {
      const firstKey = this.store.keys().next().value;
      if (firstKey) this.store.delete(firstKey);
    }
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
}

// ─── Upstash Redis (production / serverless) ───────────────────────────────────

/**
 * HTTP-based Redis client for Vercel serverless functions.
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars.
 * Get them from: https://console.upstash.com/
 */
class UpstashCache implements CacheProvider {
  // Lazily-initialised client — avoids errors if env vars are missing at import time
  private _client: import('@upstash/redis').Redis | null = null;
  private initError = false;

  private async client(): Promise<import('@upstash/redis').Redis | null> {
    if (this._client) return this._client;
    if (this.initError) return null;

    try {
      const { Redis } = await import('@upstash/redis');
      this._client = new Redis({
        url:   process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      });
      return this._client;
    } catch (err) {
      console.warn('[UpstashCache] Failed to initialise Upstash client:', err);
      this.initError = true;
      return null;
    }
  }

  async get(key: string): Promise<string | null> {
    const redis = await this.client();
    if (!redis) return null;
    try {
      const value = await redis.get<string>(key);
      return value ?? null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds = 3600): Promise<void> {
    const redis = await this.client();
    if (!redis) return;
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch {
      // Ignore cache write errors — never block the main request
    }
  }
}

// ─── Cache Factory ─────────────────────────────────────────────────────────────

let _cacheInstance: CacheProvider | null = null;

export function getCache(): CacheProvider {
  if (_cacheInstance) return _cacheInstance;

  const hasUpstash =
    !!process.env.UPSTASH_REDIS_REST_URL &&
    !!process.env.UPSTASH_REDIS_REST_TOKEN;

  if (hasUpstash) {
    console.log('[Cache] Using Upstash Redis');
    _cacheInstance = new UpstashCache();
  } else {
    console.log('[Cache] Using in-memory cache (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for production Redis)');
    _cacheInstance = new MemoryCache(200);
  }

  return _cacheInstance;
}

// ─── Cache Key Helper ──────────────────────────────────────────────────────────

/**
 * Deterministic SHA-256 fingerprint of a generation request.
 * Same model + same messages + same temperature = same cache key.
 */
export function generateCacheKey(options: GenerateOptions): string {
  const payload = {
    model: options.model,
    temperature: options.temperature,
    messages: options.messages.map((m: Message) => ({ role: m.role, content: m.content })),
    tools: options.tools?.map(t => t.name),
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
