/**
 * @file lib/ai/adapters/fallback.ts
 *
 * FallbackAdapter — wraps a primary adapter with:
 *  1. Exponential-backoff retry for transient errors (rate-limits, timeouts, 5xx)
 *  2. Provider chain fallback: if the primary adapter exhausts all retries,
 *     each fallback adapter is tried in order before giving up.
 *
 * Usage:
 *   const adapter = new FallbackAdapter(primary, [secondary, tertiary], { maxRetries: 3 });
 */

import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk } from './base';

// ─── Configuration ─────────────────────────────────────────────────────────────

export interface FallbackAdapterOptions {
  /** Maximum number of retry attempts per adapter (default: 3) */
  maxRetries?: number;
  /** Initial backoff in ms (doubles each retry, default: 500ms) */
  initialBackoffMs?: number;
  /** Maximum backoff cap in ms (default: 8000ms) */
  maxBackoffMs?: number;
  /** HTTP status codes (extracted from error message) treated as retryable (default: [429, 500, 502, 503, 504]) */
  retryableStatuses?: number[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(error: unknown, retryableStatuses: number[]): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  const msgLower = msg.toLowerCase();

  // Explicit status code keywords
  if (retryableStatuses.some(s => msgLower.includes(String(s)))) return true;

  // Common transient error signals
  if (
    msgLower.includes('rate limit') ||
    msgLower.includes('too many requests') ||
    msgLower.includes('overloaded') ||
    msgLower.includes('timeout') ||
    msgLower.includes('econnreset') ||
    msgLower.includes('econnrefused') ||
    msgLower.includes('socket hang up') ||
    msgLower.includes('network') ||
    msgLower.includes('service unavailable') ||
    msgLower.includes('bad gateway') ||
    msgLower.includes('gateway timeout')
  ) {
    return true;
  }

  return false;
}

function jitter(ms: number): number {
  // Add ±15% jitter to avoid thundering-herd on retries
  return ms + Math.floor((Math.random() - 0.5) * 0.3 * ms);
}

// ─── FallbackAdapter ───────────────────────────────────────────────────────────

export class FallbackAdapter implements AIAdapter {
  private readonly adapters: AIAdapter[];
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly retryableStatuses: number[];

  constructor(
    primary: AIAdapter,
    fallbacks: AIAdapter[] = [],
    options: FallbackAdapterOptions = {}
  ) {
    this.adapters = [primary, ...fallbacks];
    this.maxRetries        = options.maxRetries        ?? 3;
    this.initialBackoffMs  = options.initialBackoffMs  ?? 500;
    this.maxBackoffMs      = options.maxBackoffMs      ?? 8_000;
    this.retryableStatuses = options.retryableStatuses ?? [429, 500, 502, 503, 504];
  }

  get provider(): string {
    return this.adapters[0]?.provider ?? 'fallback';
  }

  // ─── Generate ─────────────────────────────────────────────────────────────

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    let lastError: unknown;

    for (const adapter of this.adapters) {
      let backoff = this.initialBackoffMs;

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          const result = await adapter.generate(options);
          // Success — tag which provider/attempt produced the result
          return result;
        } catch (err) {
          lastError = err;
          const retryable = isRetryable(err, this.retryableStatuses);
          const isLastAttempt = attempt === this.maxRetries;

          if (!retryable || isLastAttempt) {
            // Non-retryable error OR retries exhausted → break to next adapter
            console.warn(
              `[FallbackAdapter] ${adapter.provider} failed` +
              ` (attempt ${attempt + 1}/${this.maxRetries + 1},` +
              ` retryable=${retryable}):`,
              err instanceof Error ? err.message : err
            );
            break;
          }

          // Exponential backoff with jitter
          const waitMs = Math.min(jitter(backoff), this.maxBackoffMs);
          console.warn(
            `[FallbackAdapter] ${adapter.provider} transient error — ` +
            `retrying in ${waitMs}ms (attempt ${attempt + 1}/${this.maxRetries})...`
          );
          await sleep(waitMs);
          backoff = Math.min(backoff * 2, this.maxBackoffMs);
        }
      }
    }

    // All adapters and retries exhausted
    throw lastError ?? new Error('[FallbackAdapter] All providers failed with no error details.');
  }

  // ─── Stream ───────────────────────────────────────────────────────────────

  async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk, void, unknown> {
    let lastError: unknown;

    for (const adapter of this.adapters) {
      let backoff = this.initialBackoffMs;

      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        try {
          // Collect and re-yield chunks; any mid-stream error triggers retry
          for await (const chunk of adapter.stream(options)) {
            yield chunk;
          }
          return; // Stream completed successfully
        } catch (err) {
          lastError = err;
          const retryable = isRetryable(err, this.retryableStatuses);
          const isLastAttempt = attempt === this.maxRetries;

          if (!retryable || isLastAttempt) {
            console.warn(
              `[FallbackAdapter:stream] ${adapter.provider} failed` +
              ` (attempt ${attempt + 1}/${this.maxRetries + 1},` +
              ` retryable=${retryable}):`,
              err instanceof Error ? err.message : err
            );
            break;
          }

          const waitMs = Math.min(jitter(backoff), this.maxBackoffMs);
          console.warn(
            `[FallbackAdapter:stream] ${adapter.provider} transient error — ` +
            `retrying in ${waitMs}ms (attempt ${attempt + 1}/${this.maxRetries})...`
          );
          await sleep(waitMs);
          backoff = Math.min(backoff * 2, this.maxBackoffMs);
        }
      }
    }

    throw lastError ?? new Error('[FallbackAdapter:stream] All providers failed.');
  }
}
