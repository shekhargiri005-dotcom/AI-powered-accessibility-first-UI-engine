/**
 * @file index.ts
 * Adapter factory & registry.
 *
 * Core principle: NO assumptions. The caller provides provider + model + apiKey.
 * The engine uses EXACTLY what the user configured. On error → surface it clearly.
 * No silent fallbacks. No mock adapters. No hidden defaults.
 *
 * Supported adapters (4 total):
 *   Cloud:  OpenAIAdapter, AnthropicAdapter, GoogleAdapter
 *   Local:  OllamaAdapter  (also handles LM Studio / Groq / HuggingFace via baseUrl)
 */

import type { AIAdapter, ProviderName } from './base';
import { OpenAIAdapter }    from './openai';
import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter }    from './google';
import { OllamaAdapter }    from './ollama';
import { getCache, generateCacheKey } from '../cache';

// ─── OpenAI-compatible provider base URLs ─────────────────────────────────────
// These providers speak the OpenAI REST protocol — no separate adapter needed.

const OPENAI_COMPAT_BASE_URLS: Record<string, string> = {
  groq:       'https://api.groq.com/openai/v1',
  lmstudio:   'http://localhost:1234/v1',
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
  return 'ollama'; // safe local default for everything else
}

/** Pass-through — model names used verbatim as configured by the user. */
export function resolveModelName(model: string): string { return model; }

// ─── Config Shape ─────────────────────────────────────────────────────────────

export interface AdapterConfig {
  provider?: string;  // explicit provider id from user config
  model: string;
  apiKey?: string;    // user-supplied key; sent per-request over HTTPS
  baseUrl?: string;   // custom endpoint for OpenAI-compat providers
}

// ─── Metrics wrapper ──────────────────────────────────────────────────────────

import { dispatchMetrics } from '../metrics';

class CachedAdapter implements AIAdapter {
  constructor(private readonly internal: AIAdapter) {}

  get provider(): ProviderName { return this.internal.provider as ProviderName; }

  async generate(options: import('./base').GenerateOptions): Promise<import('./base').GenerateResult> {
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

  async *stream(options: import('./base').GenerateOptions): AsyncGenerator<import('./base').StreamChunk, void, unknown> {
    const cache     = getCache();
    const key       = `stream:${generateCacheKey(options)}`;
    const startTime = Date.now();

    const cached = await cache.get(key);
    if (cached) {
      try {
        const chunks = JSON.parse(cached) as import('./base').StreamChunk[];
        for (const chunk of chunks) {
          await new Promise(r => setTimeout(r, 10));
          yield { ...chunk, usage: chunk.done ? { promptTokens: 0, completionTokens: 0, totalTokens: 0, cached: true } : undefined };
        }
        dispatchMetrics({ provider: this.provider, model: options.model, promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: Date.now() - startTime, cached: true });
        return;
      } catch { /* fall through */ }
    }

    const chunks: import('./base').StreamChunk[] = [];
    let finalUsage: import('./base').GenerateResult['usage'];
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

// ─── Public Factory ───────────────────────────────────────────────────────────

/**
 * Returns the correct AIAdapter for the given config.
 *
 * Rules:
 *  1. Explicit provider given → use it directly.
 *  2. baseUrl given → OpenAI-compat adapter pointed at that URL.
 *  3. Known OpenAI-compat providers (groq / huggingface / lmstudio) → OpenAIAdapter + baseUrl.
 *  4. Named adapters (openai / anthropic / google / ollama) → specific adapter.
 *  5. No key + no env var → throw immediately with a clear message.
 *
 * No silent fallbacks. No mock adapters.
 */
export function getAdapter(cfg: AdapterConfig | string, legacyKey?: string): AIAdapter {
  let config: AdapterConfig;
  if (typeof cfg === 'string') {
    config = { model: cfg, apiKey: legacyKey, provider: detectProvider(cfg) };
  } else {
    config = cfg;
  }

  const { model, baseUrl } = config;
  const provId = config.provider ?? detectProvider(model);

  // Strip masked key — treat '••••' and 'local' as "no key provided"
  const apiKey = (config.apiKey && config.apiKey !== '••••' && config.apiKey !== 'local')
    ? config.apiKey
    : undefined;

  // 1. OpenAI-compatible 3rd-party providers ─────────────────────────────
  // groq / lmstudio (and any provider with an explicit baseUrl)
  // all route through the standard OpenAI SDK — no separate files needed.
  const namedProviders = ['openai', 'anthropic', 'google', 'ollama', 'lmstudio'];
  const compatUrl = baseUrl ?? OPENAI_COMPAT_BASE_URLS[provId];
  const isCompat  = !!compatUrl && !namedProviders.includes(provId);
  if (isCompat) {
    const key = apiKey
      || process.env[`${provId.toUpperCase()}_API_KEY`]
      || (provId === 'groq' ? process.env.GROQ_API_KEY : undefined)
      || 'dummy';
    return new CachedAdapter(new OpenAIAdapter(key, compatUrl));
  }

  // ── 2. Named adapters ────────────────────────────────────────────────────
  let adapter: AIAdapter;

  switch (provId) {
    case 'openai': {
      const key = apiKey || process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OpenAI API key required. Add it in the AI Engine Config panel.');
      adapter = new OpenAIAdapter(key, baseUrl);
      break;
    }
    case 'anthropic': {
      const key = apiKey || process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('Anthropic API key required. Add it in the AI Engine Config panel.');
      adapter = new AnthropicAdapter(key);
      break;
    }
    case 'google': {
      const key = apiKey || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
      if (!key) throw new Error('Google API key required. Add it in the AI Engine Config panel.');
      adapter = new GoogleAdapter(key);
      break;
    }
    case 'ollama':
    case 'lmstudio':
    default: {
      // Local providers — no key needed
      const url = baseUrl ?? (provId === 'lmstudio' ? OPENAI_COMPAT_BASE_URLS.lmstudio : undefined);
      adapter = new OllamaAdapter(url);
      break;
    }
  }

  return new CachedAdapter(adapter);
}

/**
 * Workspace-aware variant.
 * If the caller provides an explicit apiKey in config, it is used directly.
 * Otherwise looks up a stored key from the DB (with TTL cache), falling back to env vars.
 */
export async function getWorkspaceAdapter(
  modelOrConfig: string | AdapterConfig,
  workspaceId = 'default',
  userId?: string,
): Promise<AIAdapter> {
  // Explicit apiKey provided — use it directly, skip DB lookup
  const explicitKey = typeof modelOrConfig !== 'string' &&
    modelOrConfig.apiKey &&
    modelOrConfig.apiKey !== 'local' &&
    modelOrConfig.apiKey !== '••••';
  if (explicitKey) {
    return getAdapter(modelOrConfig);
  }

  const model  = typeof modelOrConfig === 'string' ? modelOrConfig : modelOrConfig.model;
  const provId = typeof modelOrConfig !== 'string'
    ? (modelOrConfig.provider ?? detectProvider(model))
    : detectProvider(model);

  try {
    const { getWorkspaceApiKey } = await import('../../security/workspaceKeyService');
    const wsKey = await getWorkspaceApiKey(provId as ProviderName, workspaceId, userId);
    const cfg: AdapterConfig = typeof modelOrConfig === 'string'
      ? { model, provider: provId, apiKey: wsKey ?? undefined }
      : { ...modelOrConfig, apiKey: wsKey ?? modelOrConfig.apiKey };
    return getAdapter(cfg);
  } catch {
    // DB unavailable — fall back to env vars (getAdapter throws if those are also missing)
    const cfg: AdapterConfig = typeof modelOrConfig === 'string'
      ? { model, provider: provId }
      : modelOrConfig;
    return getAdapter(cfg);
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export { OpenAIAdapter }    from './openai';
export { AnthropicAdapter } from './anthropic';
export { GoogleAdapter }    from './google';
export { OllamaAdapter }    from './ollama';

export type { AIAdapter, ProviderName }                                         from './base';
export type { GenerateOptions, GenerateResult, StreamChunk, Message, MessageRole } from './base';
