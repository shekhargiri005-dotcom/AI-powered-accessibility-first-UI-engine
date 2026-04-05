/**
 * @file lib/ai/feedbackStore.ts
 *
 * Feedback persistence — dual-write strategy:
 *  1. data/feedback.json      — synchronous, zero-latency, always available
 *  2. Prisma / DB             — async, fire-and-forget, never blocks
 *
 * Stats cache (data/feedback-stats.json) is recomputed on every write and
 * read synchronously — no network required, always up-to-date.
 */

import fs   from 'fs';
import path from 'path';
import crypto from 'crypto';

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

// ─── File Paths ───────────────────────────────────────────────────────────────

const DATA_DIR      = path.join(process.cwd(), 'data');
const FEEDBACK_FILE = path.join(DATA_DIR, 'feedback.json');
const STATS_FILE    = path.join(DATA_DIR, 'feedback-stats.json');

// ─── File Helpers ─────────────────────────────────────────────────────────────

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ─── Stats Key ────────────────────────────────────────────────────────────────

function statsKey(model: string, intentType: string): string {
  return `${model}::${intentType}`;
}

// ─── Stats Recomputation ──────────────────────────────────────────────────────

function recomputeAndCacheStats(
  model:       string,
  intentType:  string,
  allEntries:  FeedbackEntry[],
): void {
  const relevant = allEntries.filter(
    (e) => e.model === model && e.intentType === intentType,
  );
  if (relevant.length === 0) return;

  const thumbsUp   = relevant.filter((e) => e.signal === 'thumbs_up').length;
  const thumbsDown = relevant.filter((e) => e.signal === 'thumbs_down').length;
  const corrected  = relevant.filter((e) => e.signal === 'corrected').length;
  const discarded  = relevant.filter((e) => e.signal === 'discarded').length;
  const total      = relevant.length;

  const avgA11yScore     = relevant.reduce((s, e) => s + e.a11yScore,     0) / total;
  const avgCritiqueScore = relevant.reduce((s, e) => s + e.critiqueScore, 0) / total;
  const avgLatencyMs     = relevant.reduce((s, e) => s + e.latencyMs,     0) / total;

  const stats: FeedbackStats = {
    model,
    intentType,
    thumbsUp,
    thumbsDown,
    corrected,
    discarded,
    total,
    successRate:      total > 0 ? thumbsUp / total : 0,
    avgA11yScore:     Math.round(avgA11yScore),
    avgCritiqueScore: Math.round(avgCritiqueScore),
    avgLatencyMs:     Math.round(avgLatencyMs),
    lastUpdated:      new Date().toISOString(),
  };

  const allStats = readJson<Record<string, FeedbackStats>>(STATS_FILE, {});
  allStats[statsKey(model, intentType)] = stats;
  writeJson(STATS_FILE, allStats);
}

// ─── Public Write ─────────────────────────────────────────────────────────────

/**
 * Record a user feedback signal.
 * Synchronously writes to local JSON and recomputes stats cache.
 * Async DB write is fire-and-forget — never blocks.
 */
export async function recordFeedback(
  input: Omit<FeedbackEntry, 'id' | 'createdAt'>,
): Promise<void> {
  ensureDataDir();

  const entry: FeedbackEntry = {
    ...input,
    id:        crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  // 1. Synchronous local write
  const history = readJson<FeedbackEntry[]>(FEEDBACK_FILE, []);
  const updated = [entry, ...history].slice(0, 2000);
  writeJson(FEEDBACK_FILE, updated);

  // 2. Recompute stats cache (synchronous — cheap in-memory aggregation)
  recomputeAndCacheStats(entry.model, entry.intentType, updated);

  // 3. DB write — fire-and-forget
  setTimeout(async () => {
    try {
      const { prisma } = await import('@/lib/prisma');
      // Use type assertion — Prisma client types update after `prisma generate`
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
      // Non-fatal in dev — local JSON is source of truth
    }
  }, 0);
}

// ─── Public Reads ─────────────────────────────────────────────────────────────

/** Get aggregated stats for a model + intent type combination. */
export function getFeedbackStats(
  model:      string,
  intentType: string,
): FeedbackStats | null {
  const allStats = readJson<Record<string, FeedbackStats>>(STATS_FILE, {});
  return allStats[statsKey(model, intentType)] ?? null;
}

/** Get all stats entries keyed by "model::intentType". */
export function getAllFeedbackStats(): Record<string, FeedbackStats> {
  return readJson<Record<string, FeedbackStats>>(STATS_FILE, {});
}

/**
 * Retrieve the most-thumbs-up entries for an intent type.
 * Used by feedbackProcessor to inject approved examples into prompts.
 */
export function getTopRatedGenerations(
  intentType: string,
  limit = 2,
): FeedbackEntry[] {
  const history = readJson<FeedbackEntry[]>(FEEDBACK_FILE, []);
  return history
    .filter((e) => e.intentType === intentType && e.signal === 'thumbs_up')
    .slice(0, limit);
}

/**
 * Compute a short prompt hash for deduplication / trend analysis.
 * Returns first 16 hex chars of sha256(prompt).
 */
export function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 16);
}
