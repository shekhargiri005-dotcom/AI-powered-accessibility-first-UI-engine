/**
 * @file lib/ai/feedbackStore.ts
 *
 * Feedback persistence — dual-write strategy:
 *  1. Prisma / DB             — async, fire-and-forget, cloud-persisted
 *  2. Stats cache             — Redis (Vercel/prod) with in-memory fallback (local dev)
 *
 * Phase 3 Update:
 *  - Migrated stats cache from fs-based JSON to Upstash Redis.
 *  - fs-based feedback.json kept ONLY for local dev/fallback — not used in Vercel prod.
 *  - getTopRatedGenerations() now reads from Prisma DB async instead of local JSON.
 *  - upsertFeedbackEmbedding() is now quality-gated (a11yScore >= 60 AND critiqueScore >= 70).
 *
 * Stats cache key format: "feedback-stats::{model}::{intentType}"
 */

import crypto from 'crypto';
import { upsertFeedbackEmbedding } from './vectorStore';
import { logger } from '../logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeedbackSignal = 'thumbs_up' | 'thumbs_down' | 'corrected' | 'discarded';

export interface FeedbackEntry {
  id:             string;
  generationId:   string;    // maps to MemoryEntry.id in history.json
  workspaceId?:   string;
  provider:       string;
  model:          string;
  intentType:     string;    // e.g. "dashboard", "landing_page"
  promptHash:     string;    // first 16 hex chars of sha256(prompt)
  signal:         FeedbackSignal;
  correctionNote?: string;
  correctedCode?:  string;
  a11yScore:      number;
  critiqueScore:  number;
  latencyMs:      number;
  createdAt:      string;
}

export interface FeedbackStats {
  model:            string;
  intentType:       string;
  thumbsUp:         number;
  thumbsDown:       number;
  corrected:        number;
  discarded:        number;
  total:            number;
  /** thumbsUp / total — 0–1 */
  successRate:      number;
  avgA11yScore:     number;
  avgCritiqueScore: number;
  avgLatencyMs:     number;
  lastUpdated:      string;
}

// ─── Quality Gate for Memory Writeback ────────────────────────────────────────

/**
 * Minimum thresholds before a corrected generation is embedded into the vector store.
 *
 * Only store outputs in the semantic memory if they are genuinely high quality.
 * This prevents low-quality "corrections" from polluting the RAG knowledge base.
 */
const EMBEDDING_QUALITY_GATE = {
  minA11yScore:     60,   // accessibility score out of 100
  minCritiqueScore: 70,   // aesthetic/quality score out of 100
} as const;

// ─── Redis Stats Cache ────────────────────────────────────────────────────────

/** In-process fallback when Redis is unavailable (local dev or missing env) */
const _memoryStatsCache = new Map<string, FeedbackStats>();

/**
 * Build the Redis key for a model+intentType stats entry.
 * Prefixed to avoid namespace collisions with other cache users (e.g. generation cache).
 */
function redisStatsKey(model: string, intentType: string): string {
  return `feedback-stats::${model}::${intentType}`;
}

/** Lazily-initialised Upstash Redis client. Null if env vars are missing. */
let _redisClient: import('@upstash/redis').Redis | null = null;
let _redisInitAttempted = false;

async function getRedisClient(): Promise<import('@upstash/redis').Redis | null> {
  if (_redisInitAttempted) return _redisClient;
  _redisInitAttempted = true;

  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const { Redis } = await import('@upstash/redis');
    _redisClient = new Redis({ url, token });
    return _redisClient;
  } catch (err) {
    logger.warn({ endpoint: 'feedbackStore', message: 'Failed to init Upstash Redis client', error: err });
    return null;
  }
}

async function readStats(model: string, intentType: string): Promise<FeedbackStats | null> {
  const key    = redisStatsKey(model, intentType);
  const redis  = await getRedisClient();

  if (redis) {
    try {
      const raw = await redis.get<FeedbackStats>(key);
      return raw ?? null;
    } catch {
      // Fall through to memory cache on Redis error
    }
  }

  // In-memory fallback (local dev, or if Redis errors)
  return _memoryStatsCache.get(key) ?? null;
}

async function writeStats(stats: FeedbackStats): Promise<void> {
  const key   = redisStatsKey(stats.model, stats.intentType);
  const redis = await getRedisClient();

  if (redis) {
    try {
      // TTL: 90 days — stats naturally expire if there is no activity
      await redis.set(key, stats, { ex: 60 * 60 * 24 * 90 });
      return;
    } catch {
      // Fall through to memory cache on Redis error
    }
  }

  // In-memory fallback
  _memoryStatsCache.set(key, stats);
}

// ─── Stats Key (legacy — kept for internal use only) ───────────────────────────

function statsKey(model: string, intentType: string): string {
  return `${model}::${intentType}`;
}

// ─── Stats Recomputation ──────────────────────────────────────────────────────

async function recomputeAndWriteStats(entry: FeedbackEntry): Promise<void> {
  // Build new stats based on what we know from this single new entry.
  // We optimistically update the cached stats without re-reading all history
  // (history aggregation is expensive and the DB is the source of truth).
  //
  // Strategy: read existing stats, add the new entry's contribution, write back.
  const current = await readStats(entry.model, entry.intentType);

  const prev: FeedbackStats = current ?? {
    model:            entry.model,
    intentType:       entry.intentType,
    thumbsUp:         0,
    thumbsDown:       0,
    corrected:        0,
    discarded:        0,
    total:            0,
    successRate:      0,
    avgA11yScore:     0,
    avgCritiqueScore: 0,
    avgLatencyMs:     0,
    lastUpdated:      '',
  };

  const total            = prev.total + 1;
  const thumbsUp         = prev.thumbsUp         + (entry.signal === 'thumbs_up'   ? 1 : 0);
  const thumbsDown       = prev.thumbsDown       + (entry.signal === 'thumbs_down' ? 1 : 0);
  const corrected        = prev.corrected        + (entry.signal === 'corrected'   ? 1 : 0);
  const discarded        = prev.discarded        + (entry.signal === 'discarded'   ? 1 : 0);

  // Running averages updated incrementally
  const avgA11yScore     = Math.round((prev.avgA11yScore     * prev.total + entry.a11yScore)     / total);
  const avgCritiqueScore = Math.round((prev.avgCritiqueScore * prev.total + entry.critiqueScore) / total);
  const avgLatencyMs     = Math.round((prev.avgLatencyMs     * prev.total + entry.latencyMs)     / total);

  const updated: FeedbackStats = {
    model:            entry.model,
    intentType:       entry.intentType,
    thumbsUp,
    thumbsDown,
    corrected,
    discarded,
    total,
    successRate:      total > 0 ? thumbsUp / total : 0,
    avgA11yScore,
    avgCritiqueScore,
    avgLatencyMs,
    lastUpdated:      new Date().toISOString(),
  };

  await writeStats(updated);
}

// ─── Public Write ─────────────────────────────────────────────────────────────

/**
 * Record a user feedback signal.
 *
 * Async strategy:
 *  1. Stats cache update (Redis/memory) — fire-and-forget, fast path
 *  2. Prisma DB write — fire-and-forget, cloud persistence
 *  3. Vector embedding — quality-gated, fire-and-forget
 */
export async function recordFeedback(
  input: Omit<FeedbackEntry, 'id' | 'createdAt'>,
): Promise<void> {
  const entry: FeedbackEntry = {
    ...input,
    id:        crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  // 1. Stats cache update (non-blocking)
  recomputeAndWriteStats(entry).catch(() => { /* non-fatal */ });

  // 2. DB write — fire-and-forget
  setTimeout(async () => {
    try {
      const { prisma } = await import('@/lib/prisma');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).generationFeedback.create({
        data: {
          generationId:   entry.generationId,
          workspaceId:    entry.workspaceId ?? null,
          provider:       entry.provider,
          model:          entry.model,
          intentType:     entry.intentType,
          promptHash:     entry.promptHash,
          signal:         entry.signal,
          correctionNote: entry.correctionNote ?? null,
          correctedCode:  entry.correctedCode  ?? null,
          a11yScore:      entry.a11yScore,
          critiqueScore:  entry.critiqueScore,
          latencyMs:      entry.latencyMs,
        },
      });
    } catch {
      // Non-fatal — stats cache is the primary source for feedbackProcessor
    }
  }, 0);

  // 3. Quality-gated vector embedding — only for corrected entries that pass quality bar
  if (
    entry.signal === 'corrected' &&
    entry.correctedCode &&
    entry.a11yScore     >= EMBEDDING_QUALITY_GATE.minA11yScore &&
    entry.critiqueScore >= EMBEDDING_QUALITY_GATE.minCritiqueScore
  ) {
    setTimeout(() => {
      upsertFeedbackEmbedding({
        feedbackId:     entry.id,
        intentType:     entry.intentType,
        correctedCode:  entry.correctedCode!,
        correctionNote: entry.correctionNote,
        a11yScore:      entry.a11yScore,
      }).catch(() => { /* non-fatal */ });
    }, 100);
  } else if (entry.signal === 'corrected' && entry.correctedCode) {
    logger.warn({
      endpoint: 'feedbackStore',
      message:  'Corrected generation skipped quality gate — not embedded in vector store',
      metadata: {
        a11yScore:     entry.a11yScore,
        critiqueScore: entry.critiqueScore,
        minRequired:   EMBEDDING_QUALITY_GATE,
      },
    });
  }
}

// ─── Public Reads ─────────────────────────────────────────────────────────────

/**
 * Get aggregated stats for a model + intent type combination.
 * Reads from Redis (prod) or in-memory cache (local dev).
 *
 * NOTE: This is now async — callers must await it.
 */
export async function getFeedbackStatsAsync(
  model:      string,
  intentType: string,
): Promise<FeedbackStats | null> {
  return readStats(model, intentType);
}

/**
 * Synchronous stats read — returns null if cache hasn't been primed yet.
 * Used by feedbackProcessor.ts (which runs synchronously in the hot path).
 * Falls back to in-memory stats only (no Redis round-trip on the hot path).
 */
export function getFeedbackStats(
  model:      string,
  intentType: string,
): FeedbackStats | null {
  const key = redisStatsKey(model, intentType);
  // Return from in-memory cache synchronously. This will be populated
  // after the first async call to getFeedbackStatsAsync in the same process.
  return _memoryStatsCache.get(key) ?? null;
}

/** Get all cached stats entries from the in-process memory cache. */
export function getAllFeedbackStats(): Record<string, FeedbackStats> {
  const result: Record<string, FeedbackStats> = {};
  for (const [key, val] of _memoryStatsCache.entries()) {
    result[key] = val;
  }
  return result;
}

/**
 * Retrieve the most-thumbs-up feedback entries for an intent type.
 * Used by feedbackProcessor to inject approved examples into prompts.
 *
 * Reads from Prisma DB (async) — returns empty array if DB is unavailable.
 */
export async function getTopRatedGenerations(
  intentType: string,
  limit = 2,
): Promise<FeedbackEntry[]> {
  try {
    const { prisma } = await import('@/lib/prisma');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (prisma as any).generationFeedback.findMany({
      where:   { intentType, signal: 'thumbs_up' },
      orderBy: { a11yScore: 'desc' },
      take:    limit,
    });
    return rows as FeedbackEntry[];
  } catch {
    return [];
  }
}

/**
 * Compute a short prompt hash for deduplication / trend analysis.
 * Returns first 16 hex chars of sha256(prompt).
 */
export function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}

/**
 * @deprecated Internal helper — exposed for legacy compatibility only.
 * Prefer getFeedbackStatsAsync() for new callers.
 */
export function _legacyStatsKey(model: string, intentType: string): string {
  return statsKey(model, intentType);
}
