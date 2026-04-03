/**
 * @file index.ts
 * Adapter factory & registry.
 *
 * This is the single entry‑point for obtaining an AIAdapter instance.
 * Call `getAdapter(modelName)` anywhere — it resolves which provider to use
 * based on the model string and available API keys.
 *
 * NEW: Use `getWorkspaceAdapter(model, workspaceId)` to automatically resolve
 * a workspace-specific API key from the database, falling back to env vars.
 *
 * Existing code that calls `getOpenAIClient()` from `../config.ts` continues
 * to work — that function is now a backward‑compat shim that delegates here.
 */

import type { AIAdapter, ProviderName } from './base';
import { OpenAIAdapter } from './openai';
import { OllamaAdapter } from './ollama';
import { DeepSeekAdapter } from './deepseek';
import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter } from './google';
import { getCache, generateCacheKey } from '../cache';

// ─── Provider Detection ───────────────────────────────────────────────────────

/**
 * Detects which provider a model string belongs to.
 * Rules (first match wins):
 *  - contains "deepseek"         → deepseek
 *  - contains "ollama" or ":"    → ollama  (ollama uses "name:tag" format)
 *  - contains "claude"           → anthropic
 *  - anything else               → openai
 */
export function detectProvider(model: string): ProviderName {
  const m = model.toLowerCase();
  if (m.includes('deepseek')) return 'deepseek';
  if (m.includes('claude')) return 'anthropic';
  if (m.includes('gemini')) return 'google';
  if (m.includes('gpt-')) return 'openai';
  // Default to ollama for local/custom models, or if it has the ollama-style colon
  return 'ollama';
}

// ─── Canonical Model Name ─────────────────────────────────────────────────────

/**
 * Maps friendly/UI model names to the exact string the provider API expects.
 */
export function resolveModelName(model: string): string {
  const m = model.toLowerCase();
  if (m.includes('deepseek')) return 'deepseek-coder:6.7b';
  if (m === 'gpt-4.1') return 'gpt-4-turbo';
  if (m.includes('5.4') && !m.includes('mini') && !m.includes('nano')) return 'gpt-4o';
  if (m.includes('nano') || m.includes('mini')) return 'gpt-4o-mini';
  // Gemini aliases
  if (m === 'gemini-flash' || m === 'gemini-2.0-flash') return 'gemini-2.0-flash';
  if (m === 'gemini-flash-lite') return 'gemini-2.0-flash-lite';
  if (m === 'gemini-pro' || m === 'gemini-1.5-pro') return 'gemini-1.5-pro';
  // Claude aliases
  if (m === 'claude-3-5-sonnet') return 'claude-3-5-sonnet-20240620';
  if (m === 'claude-3-opus') return 'claude-3-opus-20240229';
  if (m === 'claude-3-sonnet') return 'claude-3-sonnet-20240229';
  if (m === 'claude-3-haiku') return 'claude-3-haiku-20240307';
  return model; // pass-through if already canonical
}

// ─── Adapter Instances (singletons per provider) ──────────────────────────────

let _openaiAdapter: OpenAIAdapter | null = null;
let _ollamaAdapter: OllamaAdapter | null = null;
let _deepseekAdapter: DeepSeekAdapter | null = null;
let _anthropicAdapter: AnthropicAdapter | null = null;
let _googleAdapter: GoogleAdapter | null = null;

function getOpenAIAdapterInstance(apiKey?: string): OpenAIAdapter {
  if (!_openaiAdapter) _openaiAdapter = new OpenAIAdapter(apiKey);
  return _openaiAdapter;
}

function getOllamaAdapterInstance(): OllamaAdapter {
  if (!_ollamaAdapter) _ollamaAdapter = new OllamaAdapter();
  return _ollamaAdapter;
}

function getDeepSeekAdapterInstance(apiKey?: string): DeepSeekAdapter {
  if (!_deepseekAdapter) _deepseekAdapter = new DeepSeekAdapter(apiKey);
  return _deepseekAdapter;
}

function getAnthropicAdapterInstance(apiKey?: string): AnthropicAdapter {
  if (!_anthropicAdapter) _anthropicAdapter = new AnthropicAdapter(apiKey);
  return _anthropicAdapter;
}

function getGoogleAdapterInstance(apiKey?: string): GoogleAdapter {
  if (!_googleAdapter) _googleAdapter = new GoogleAdapter(apiKey);
  return _googleAdapter;
}

// ─── Caching & Observability Wrapper ──────────────────────────────────────────

import { dispatchMetrics } from '../metrics';
import { FallbackAdapter } from './fallback';

class CachedAdapter implements AIAdapter {
  constructor(private readonly internal: AIAdapter) {}

  get provider(): ProviderName {
    return this.internal.provider as ProviderName;
  }

  async generate(options: import('./base').GenerateOptions): Promise<import('./base').GenerateResult> {
    const key = `gen:${generateCacheKey(options)}`;
    const cache = getCache();
    const startTime = Date.now();

    const cachedStr = await cache.get(key);
    if (cachedStr) {
      try {
        const parsed = JSON.parse(cachedStr);
        parsed.usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, cached: true };
        dispatchMetrics({ provider: this.provider, model: options.model, promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: Date.now() - startTime, cached: true });
        return parsed;
      } catch {
        // Fall through
      }
    }

    const result = await this.internal.generate(options);
    const duration = Date.now() - startTime;

    if (result.content || (result.toolCalls && result.toolCalls.length > 0)) {
      await cache.set(key, JSON.stringify(result));
    }
    
    dispatchMetrics({ provider: this.provider, model: options.model, promptTokens: result.usage?.promptTokens ?? 0, completionTokens: result.usage?.completionTokens ?? 0, totalTokens: result.usage?.totalTokens ?? 0, latencyMs: duration, cached: false });

    return result;
  }

  async *stream(options: import('./base').GenerateOptions): AsyncGenerator<import('./base').StreamChunk, void, unknown> {
    const key = `stream:${generateCacheKey(options)}`;
    const cache = getCache();
    const startTime = Date.now();

    const cachedStr = await cache.get(key);
    if (cachedStr) {
      try {
        const chunks = JSON.parse(cachedStr) as import('./base').StreamChunk[];
        for (const chunk of chunks) {
          await new Promise(r => setTimeout(r, 10));
          yield { ...chunk, usage: chunk.done ? { promptTokens: 0, completionTokens: 0, totalTokens: 0, cached: true } : undefined };
        }
        dispatchMetrics({ provider: this.provider, model: options.model, promptTokens: 0, completionTokens: 0, totalTokens: 0, latencyMs: Date.now() - startTime, cached: true });
        return;
      } catch {
        // Fall through
      }
    }

    const chunksToCache: import('./base').StreamChunk[] = [];
    let finalUsage: import('./base').GenerateResult['usage'];
    
    for await (const chunk of this.internal.stream(options)) {
      chunksToCache.push(chunk);
      if (chunk.usage) finalUsage = chunk.usage;
      yield chunk;
    }

    const duration = Date.now() - startTime;
    if (chunksToCache.length > 0) {
      await cache.set(key, JSON.stringify(chunksToCache));
    }
    
    dispatchMetrics({ provider: this.provider, model: options.model, promptTokens: finalUsage?.promptTokens ?? 0, completionTokens: finalUsage?.completionTokens ?? 0, totalTokens: finalUsage?.totalTokens ?? 0, latencyMs: duration, cached: false });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the appropriate AIAdapter for the given model name.
 *
 * @param model  - UI or canonical model name (e.g. "deepseek-coder:6.7b", "gpt-4o")
 * @param apiKey - Optional per-workspace API key override
 */
export function getAdapter(model?: string, apiKey?: string): AIAdapter {
  const m = model ?? '';
  const hasOpenAIKey = !!(apiKey ?? process.env.OPENAI_API_KEY);

  const provider = m ? detectProvider(m) : (hasOpenAIKey ? 'openai' : 'ollama');

  let adapter: AIAdapter;

  switch (provider) {
    case 'ollama':
      adapter = getOllamaAdapterInstance();
      break;
    case 'deepseek':
      adapter = getDeepSeekAdapterInstance(apiKey);
      break;
    case 'anthropic':
      if (!apiKey && !process.env.ANTHROPIC_API_KEY) {
        throw new Error('Anthropic API key is missing. Please configure it in Workspace Settings or set ANTHROPIC_API_KEY in .env.local');
      }
      adapter = getAnthropicAdapterInstance(apiKey);
      break;
    case 'google':
      if (!apiKey && !process.env.GOOGLE_API_KEY) {
         throw new Error('Google API key is missing. Please configure it in Workspace Settings or set GOOGLE_API_KEY in .env.local');
      }
      adapter = getGoogleAdapterInstance(apiKey);
      break;
    case 'openai':
    default:
      if (!hasOpenAIKey) {
        throw new Error('OpenAI API key is missing. Please configure it in Workspace Settings or set OPENAI_API_KEY in .env.local');
      }
      adapter = getOpenAIAdapterInstance(apiKey);
      break;
  }

  // Always wrap with FallbackAdapter, falling back to Ollama if primary fails
  const fallbacks = provider !== 'ollama' 
    ? [getOllamaAdapterInstance()] 
    : [];

  return new CachedAdapter(new FallbackAdapter(adapter, fallbacks));
}

/**
 * Workspace-aware adapter factory.
 * Looks up a stored API key for the given provider from the database
 * (with TTL caching). Falls back to env vars if no key is stored.
 * 
 * @param model       - Model name (determines provider)
 * @param workspaceId - Workspace identifier (defaults to 'default')
 * @param userId      - Optional user ID for authorization check
 */
export async function getWorkspaceAdapter(
  model: string,
  workspaceId = 'default',
  userId?: string
): Promise<AIAdapter> {
  const { getWorkspaceApiKey } = await import('../../security/workspaceKeyService');
  const provider = detectProvider(model);

  // Try to get a workspace-specific key; null means fall back to env
  const workspaceKey = await getWorkspaceApiKey(provider, workspaceId, userId);

  // Use workspace key if found, otherwise getAdapter falls back to env vars
  return getAdapter(model, workspaceKey ?? undefined);
}

export type { AIAdapter, ProviderName } from './base';
export type { GenerateOptions, GenerateResult, StreamChunk, Message, MessageRole } from './base';
