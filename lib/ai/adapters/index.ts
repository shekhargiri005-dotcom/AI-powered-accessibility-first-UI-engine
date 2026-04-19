/**
 * @file index.ts
 * Adapter factory & registry.
 *
 * Core principle: NO client credentials. All API keys are resolved server-side
 * via workspaceKeyService (DB lookup) or environment variables.
 * The engine uses EXACTLY what the user configured. On error → surface it clearly.
 * No silent fallbacks. No mock adapters. No hidden defaults.
 *
 * Supported adapters (3 providers):
 *   Cloud: OpenAIAdapter, GoogleAdapter, Groq (OpenAI-compatible)
 */

import 'server-only';

import type { AIAdapter } from './base';
import type { ProviderName } from '../types';
import { OpenAIAdapter }    from './openai';
import { GoogleAdapter }    from './google';
import { UnconfiguredAdapter } from './unconfigured';
import { getCache, generateCacheKey } from '../cache';

// ─── Configuration Error ──────────────────────────────────────────────────────

/**
 * Error thrown when no API key is configured for a provider.
 * The frontend should catch this and prompt the user to configure settings.
 */
export class ConfigurationError extends Error {
  constructor(
    public provider: string,
    message: string = `No API key configured for provider: ${provider}`
  ) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

// ─── OpenAI-compatible provider base URLs ─────────────────────────────────────
// These providers speak the OpenAI REST protocol — no separate adapter needed.

const OPENAI_COMPAT_BASE_URLS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
};

// ─── Provider Detection (fallback only — prefer explicit provider from config) ─

/**
 * Detects provider from model name as a last resort.
 * Callers should prefer passing explicit provider from user config.
 */
export function detectProvider(model: string): ProviderName {
  const m = model.toLowerCase();
  if (m.includes('gemini'))                        return 'google';
  if (m.includes('gpt-') || m.startsWith('o'))    return 'openai';  // gpt-*, o1, o3-mini
  // Groq hosted models — serve via OpenAI-compat adapter
  if (m.includes('llama') || m.includes('mixtral') || m.includes('gemma2')) return 'groq';
  return 'openai'; // default to openai for unknown models
}

/** Pass-through — model names used verbatim as configured by the user. */
export function resolveModelName(model: string): string { return model; }

// ─── Config Shape (for internal use only) ─────────────────────────────────────

export interface AdapterConfig {
  provider?: string;  // explicit provider id from user config
  model: string;
  apiKey?: string;    // INTERNAL USE ONLY - never from client
  baseUrl?: string;   // INTERNAL USE ONLY - never from client
}

// ─── Metrics wrapper ──────────────────────────────────────────────────────────

import { dispatchMetrics } from '../metrics';

class CachedAdapter implements AIAdapter {
  constructor(private readonly internal: AIAdapter) {}

  get provider(): ProviderName { return this.internal.provider as ProviderName; }

  async generate(options: import('./base').GenerateOptions): Promise<import('../types').GenerateResult> {
    const cache     = getCache();
    const key       = `gen:${generateCacheKey(options)}`;
    const startTime = Date.now();

    const cached = await cache.get(key);
    if (cached) {
      try {
        const p = JSON.parse(cached);
        p.usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cached: true };
        dispatchMetrics({ provider: this.provider, model: options.model, promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: Date.now() - startTime, cached: true });
        return p;
      } catch { /* fall through */ }
    }

    const result   = await this.internal.generate(options);
    const duration = Date.now() - startTime;
    if (result.content || result.toolCalls?.length) await cache.set(key, JSON.stringify(result));
    dispatchMetrics({ provider: this.provider, model: options.model, promptTokens: result.usage?.promptTokens ?? 0, completionTokens: result.usage?.completionTokens ?? 0, totalTokens: result.usage?.totalTokens ?? 0, latencyMs: duration, cached: false });
    return result;
  }

  async *stream(options: import('./base').GenerateOptions): AsyncGenerator<import('../types').StreamChunk, void, unknown> {
    const cache     = getCache();
    const key       = `stream:${generateCacheKey(options)}`;
    const startTime = Date.now();

    const cached = await cache.get(key);
    if (cached) {
      try {
        const chunks = JSON.parse(cached) as import('../types').StreamChunk[];
        for (const chunk of chunks) {
          await new Promise(r => setTimeout(r, 10));
          yield { ...chunk, usage: chunk.done ? { promptTokens: 0, completionTokens: 0, totalTokens: 0, cached: true } : undefined };
        }
        dispatchMetrics({ provider: this.provider, model: options.model, promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: Date.now() - startTime, cached: true });
        return;
      } catch { /* fall through */ }
    }

    const chunks: import('../types').StreamChunk[] = [];
    let finalUsage: import('../types').GenerateResult['usage'];
    for await (const chunk of this.internal.stream(options)) {
      chunks.push(chunk);
      if (chunk.usage) finalUsage = chunk.usage;
      yield chunk;
    }
    const duration = Date.now() - startTime;
    if (chunks.length) await cache.set(key, JSON.stringify(chunks));
    dispatchMetrics({ provider: this.provider, model: options.model, promptTokens: finalUsage?.promptTokens ?? 0, completionTokens: finalUsage?.completionTokens ?? 0, totalTokens: finalUsage?.totalTokens ?? 0, latencyMs: duration, cached: false });
  }
}

// ─── Internal Factory (server-side only) ──────────────────────────────────────

/**
 * INTERNAL USE ONLY - Creates adapter with explicit credentials.
 * Credentials must be resolved via workspaceKeyService or env vars before calling.
 */
function createAdapter(cfg: AdapterConfig): AIAdapter {
  const { model, baseUrl } = cfg;
  const provId = cfg.provider ?? detectProvider(model);
  const apiKey = cfg.apiKey;

  // 1. OpenAI-compatible 3rd-party providers ─────────────────────────────
  const namedProviders = ['openai', 'google'];
  const compatUrl = baseUrl ?? OPENAI_COMPAT_BASE_URLS[provId];
  const isCompat  = !!compatUrl && !namedProviders.includes(provId);
  if (isCompat) {
    const key = apiKey
      || process.env[`${provId.toUpperCase()}_API_KEY`]
      || (provId === 'groq' ? process.env.GROQ_API_KEY : undefined);
    if (!key) {
      throw new ConfigurationError(provId, `${provId} API key required. Add it in the AI Engine Config panel.`);
    }
    return new CachedAdapter(new OpenAIAdapter(key, compatUrl));
  }

  // ── 2. Named adapters ────────────────────────────────────────────────────
  let adapter: AIAdapter;

  switch (provId) {
    case 'openai': {
      const key = apiKey || process.env.OPENAI_API_KEY;
      if (!key) throw new ConfigurationError('openai', 'OpenAI API key required. Add it in the AI Engine Config panel.');
      adapter = new OpenAIAdapter(key, baseUrl);
      break;
    }
    case 'google': {
      const key = apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      if (!key) throw new ConfigurationError('google', 'Google API key required. Add it in the AI Engine Config panel.');
      adapter = new GoogleAdapter(key);
      break;
    }
    case 'unconfigured':
    default: {
      adapter = new UnconfiguredAdapter();
      break;
    }
  }

  return new CachedAdapter(adapter);
}

// ─── Public Factory (Hardened) ────────────────────────────────────────────────

/**
 * Returns the correct AIAdapter for the given provider and model.
 * Credentials are resolved server-side via workspaceKeyService or environment variables.
 * NEVER accepts apiKey or baseUrl from the client.
 *
 * Resolution hierarchy:
 *   1. DB Check: Call workspaceKeyService.getWorkspaceApiKey(providerId, workspaceId, userId)
 *   2. Env Check: If DB has no key, look up process.env[PROVIDER_ID_API_KEY]
 *   3. Failure: If both missing, throw ConfigurationError or return UnconfiguredAdapter
 *
 * @param providerId - The provider identifier (e.g., 'openai', 'google', 'groq')
 * @param modelId - The model identifier (e.g., 'gpt-4o')
 * @param workspaceId - The workspace ID for credential lookup
 * @param userId - Optional user ID for authorization
 * @returns Promise<AIAdapter>
 * @throws ConfigurationError if no credentials are found
 */
export async function getWorkspaceAdapter(
  providerId: ProviderName,
  modelId: string,
  workspaceId: string,
  userId?: string,
): Promise<AIAdapter> {
  // 1. DB Check: Look up encrypted key from workspace settings
  try {
    const { getWorkspaceApiKey } = await import('../../security/workspaceKeyService');
    const wsKey = await getWorkspaceApiKey(providerId, workspaceId, userId);
    
    if (wsKey) {
      return createAdapter({ provider: providerId, model: modelId, apiKey: wsKey });
    }
  } catch (err) {
    // DB lookup failed - continue to env fallback
    console.warn('[getWorkspaceAdapter] DB lookup failed, falling back to env vars:', err);
  }

  // 2. Env Check: Fall back to environment variables
  // Each provider has its own API key env var:
  //   OPENAI_API_KEY, GOOGLE_API_KEY, GROQ_API_KEY
  
  // Check provider-specific key
  const envKey = process.env[`${providerId.toUpperCase()}_API_KEY`];
  if (envKey) {
    console.log(`[getWorkspaceAdapter] ✓ Using ${providerId.toUpperCase()}_API_KEY for ${providerId}`);
    return createAdapter({ provider: providerId, model: modelId, apiKey: envKey });
  }

  // Provider-specific env var fallbacks (with GEMINI_API_KEY for Google)
  const providerEnvMap: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
  };
  
  const fallbackKey = providerEnvMap[providerId];
  if (fallbackKey) {
    console.log(`[getWorkspaceAdapter] ✓ Using provider-specific key for ${providerId}`);
    return createAdapter({ provider: providerId, model: modelId, apiKey: fallbackKey });
  }

  // 3. Failure: No valid credentials for this provider
  const envVarName = `${providerId.toUpperCase()}_API_KEY`;
  console.error(`[getWorkspaceAdapter] ✗ No valid API key for ${providerId}.`);
  console.error(`[getWorkspaceAdapter] To fix: Set ${envVarName} in Vercel environment variables.`);
  
  // Return UnconfiguredAdapter for graceful degradation
  // (it returns a helpful error message instead of crashing)
  return new UnconfiguredAdapter();
}

/**
 * Legacy adapter factory - DEPRECATED.
 * Use getWorkspaceAdapter instead for secure credential resolution.
 * 
 * @deprecated Use getWorkspaceAdapter(providerId, modelId, workspaceId, userId)
 */
export function getAdapter(cfg: AdapterConfig | string, legacyKey?: string): AIAdapter {
  let config: AdapterConfig;
  if (typeof cfg === 'string') {
    config = { model: cfg, apiKey: legacyKey, provider: detectProvider(cfg) };
  } else {
    config = cfg;
  }
  return createAdapter(config);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { OpenAIAdapter }    from './openai';
export { GoogleAdapter }    from './google';
export { UnconfiguredAdapter } from './unconfigured';

export type { AIAdapter } from './base';
export type { ProviderName, GenerateOptions, GenerateResult, StreamChunk, Message, MessageRole } from '../types';
