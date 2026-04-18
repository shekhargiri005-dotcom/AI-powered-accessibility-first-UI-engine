/**
 * @file index.ts
 * Adapter factory & registry.
 *
 * Core principle: NO client credentials. All API keys are resolved server-side
 * via workspaceKeyService (DB lookup) or environment variables.
 * The engine uses EXACTLY what the user configured. On error → surface it clearly.
 * No silent fallbacks. No mock adapters. No hidden defaults.
 *
 * Supported adapters (5 providers):
 *   Cloud: OpenAIAdapter, AnthropicAdapter, GoogleAdapter, Groq (OpenAI-compatible)
 *   Local: OllamaAdapter
 */

import 'server-only';

import type { AIAdapter } from './base';
import type { ProviderName } from '../types';
import { OpenAIAdapter }    from './openai';
import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter }    from './google';
import { OllamaAdapter }    from './ollama';
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
  if (m.includes('claude'))                        return 'anthropic';
  if (m.includes('gemini'))                        return 'google';
  if (m.includes('gpt-') || m.startsWith('o'))    return 'openai';  // gpt-*, o1, o3-mini
  // Groq hosted models — serve via OpenAI-compat adapter
  if (m.includes('llama') || m.includes('mixtral') || m.includes('gemma2')) return 'groq';
  // Ollama local models
  if (m.includes('ollama') || m.includes('local')) return 'ollama';
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
  const namedProviders = ['openai', 'anthropic', 'google', 'ollama'];
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
    case 'anthropic': {
      const key = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) throw new ConfigurationError('anthropic', 'Anthropic API key required. Add it in the AI Engine Config panel.');
      adapter = new AnthropicAdapter(key);
      break;
    }
    case 'google': {
      const key = apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      if (!key) throw new ConfigurationError('google', 'Google API key required. Add it in the AI Engine Config panel.');
      adapter = new GoogleAdapter(key);
      break;
    }
    case 'ollama': {
      // Ollama uses a local OpenAI-compatible endpoint
      const ollamaUrl = baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
      adapter = new OllamaAdapter(ollamaUrl);
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
 * @param providerId - The provider identifier (e.g., 'openai', 'anthropic')
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
  const envKey = process.env[`${providerId.toUpperCase()}_API_KEY`];
  if (envKey) {
    return createAdapter({ provider: providerId, model: modelId, apiKey: envKey });
  }

  // Provider-specific env var fallbacks
  const providerEnvMap: Record<string, string | undefined> = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    google: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    ollama: process.env.OLLAMA_API_KEY,
  };
  
  const fallbackKey = providerEnvMap[providerId];
  if (fallbackKey) {
    return createAdapter({ provider: providerId, model: modelId, apiKey: fallbackKey });
  }

  // 3. LLM_KEY — only valid for the provider it belongs to (via LLM_PROVIDER env var)
  // The UI shows all providers when LLM_KEY exists, but the backend only uses it
  // for the matching provider. This prevents 401 errors from sending an OpenAI key to Groq, etc.
  const universalKey = process.env.LLM_KEY;
  const llmProvider = process.env.LLM_PROVIDER?.toLowerCase() || (universalKey ? 'openai' : '');
  const matchesLlmProvider = !!universalKey && providerId === llmProvider;

  console.log(`[getWorkspaceAdapter] Checking LLM_KEY for ${providerId}:`, {
    hasLLMKey: !!universalKey,
    llmProvider: llmProvider || '(not set)',
    matchesLlmProvider,
    providerId,
    modelId
  });
  
  if (matchesLlmProvider) {
    console.log(`[getWorkspaceAdapter] ✓ Using LLM_KEY for ${providerId} (matches LLM_PROVIDER)`);
    return createAdapter({ provider: providerId, model: modelId, apiKey: universalKey! });
  }

  // 4. Failure: No valid credentials for this provider
  const envVarName = `${providerId.toUpperCase()}_API_KEY`;
  console.error(`[getWorkspaceAdapter] ✗ No valid API key for ${providerId}.`);
  console.error(`[getWorkspaceAdapter] To fix: Set ${envVarName} in Vercel environment variables.`);
  console.error(`[getWorkspaceAdapter] Or set LLM_PROVIDER=${providerId} to use LLM_KEY for this provider.`);
  
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
export { AnthropicAdapter } from './anthropic';
export { GoogleAdapter }    from './google';
export { OllamaAdapter }    from './ollama';
export { UnconfiguredAdapter } from './unconfigured';

export type { AIAdapter } from './base';
export type { ProviderName, GenerateOptions, GenerateResult, StreamChunk, Message, MessageRole } from '../types';
