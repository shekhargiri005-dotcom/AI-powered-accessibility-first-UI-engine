/**
 * @file lib/ai/metrics.ts
 *
 * Centralised metric dispatch layer.
 * Every completed adapter call (generate or stream) passes through here.
 * Metrics are:
 *  1. Logged via pino (structured JSON)
 *  2. Persisted to the UsageLog table (fire-and-forget, never blocks a request)
 *
 * Callers import `dispatchMetrics` and call it with the usage envelope returned
 * by an adapter call.
 */

import { logger } from '@/lib/logger';
import { costEstimateUsd } from '@/lib/ai/adapters/base';

export interface MetricPayload {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  /** True if the result was served from Redis / in-process cache */
  cached: boolean;
  /** workspaceId that originated the request (optional) */
  workspaceId?: string;
}

/**
 * Dispatch metrics for a completed AI call.
 *
 * This is intentionally fire-and-forget — it MUST NOT throw or block the
 * response path. All errors are swallowed and logged at warn level.
 */
export function dispatchMetrics(payload: MetricPayload): void {
  // Schedule asynchronously so the response path is never delayed
  setTimeout(async () => {
    const costUsd = payload.cached
      ? 0
      : costEstimateUsd(payload.model, payload.promptTokens, payload.completionTokens);

    // 1. Structured log
    logger.info({
      endpoint: 'AI_METRICS',
      message: `[${payload.provider}/${payload.model}] ${payload.latencyMs}ms | ` +
               `${payload.totalTokens} tokens | $${costUsd.toFixed(6)} | ` +
               (payload.cached ? 'CACHE HIT' : 'LIVE'),
      metadata: {
        provider: payload.provider,
        model: payload.model,
        tokens: {
          prompt: payload.promptTokens,
          completion: payload.completionTokens,
          total: payload.totalTokens,
        },
        costUsd,
        cached: payload.cached,
        latencyMs: payload.latencyMs,
        workspaceId: payload.workspaceId,
      },
    });

    // 2. Persist to DB
    try {
      const { prisma } = await import('@/lib/prisma');
      await prisma.usageLog.create({
        data: {
          provider: payload.provider,
          model: payload.model,
          promptTokens: payload.promptTokens,
          completionTokens: payload.completionTokens,
          totalTokens: payload.totalTokens,
          latencyMs: payload.latencyMs,
          costUsd,
          cached: payload.cached,
          // workspaceId column is optional in the schema
          ...(payload.workspaceId ? { workspaceId: payload.workspaceId } : {}),
        },
      });
    } catch (err) {
      logger.warn({
        endpoint: 'AI_METRICS',
        message: 'Failed to persist usage log to DB',
        error: err,
      });
    }
  }, 0);
}
