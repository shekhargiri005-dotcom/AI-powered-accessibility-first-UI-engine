/**
 * @file resolveDefaultAdapter.ts
 * Provider-agnostic env-based adapter config resolver.
 *
 * Checks ALL supported provider API keys in priority order and returns
 * the first available AdapterConfig. Never assumes OpenAI — works equally
 * well with Anthropic, Google, Groq, DeepSeek, Together, OpenRouter, or local Ollama.
 *
 * Priority order (by capability tier and cost efficiency):
 *  1. Purpose-specific env override (e.g. INTENT_MODEL / INTENT_PROVIDER / INTENT_API_KEY)
 *  2. Groq        (fast, generous free-tier — great for REVIEW/REPAIR/INTENT)
 *  3. Google Gemini
 *  4. Anthropic
 *  5. DeepSeek
 *  6. Together AI
 *  7. OpenRouter
 *  8. Mistral
 *  9. OpenAI      (deprioritized — quota exhausts easily on free/trial keys)
 * 10. Ollama / LM Studio (local — no key needed, always available as last resort)
 */

import type { AdapterConfig } from './adapters/index';

/**
 * Purpose identifiers — each maps to a set of env vars:
 *  <PURPOSE>_MODEL, <PURPOSE>_PROVIDER, <PURPOSE>_API_KEY
 */
export type AdapterPurpose =
  | 'INTENT'       // intent parsing  (/api/parse)
  | 'CLASSIFIER'   // intent classify (/api/classify)
  | 'GENERATION'   // code generator  (/api/generate)
  | 'THINKING'     // thinking plan   (/api/think)
  | 'REVIEW'       // UI critique     (uiReviewer)
  | 'REPAIR';      // UI repair       (uiReviewer)

/** Default model names per provider for each purpose tier */
const PURPOSE_DEFAULTS: Record<AdapterPurpose, Record<string, string>> = {
  INTENT:     { openai: 'gpt-4o-mini', anthropic: 'claude-3-haiku-20240307', google: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile', deepseek: 'deepseek-chat', together: 'meta-llama/Llama-3-8b-chat-hf', openrouter: 'openai/gpt-4o-mini', mistral: 'mistral-small-latest', huggingface: 'meta-llama/Meta-Llama-3-8B-Instruct' },
  CLASSIFIER: { openai: 'gpt-4o-mini', anthropic: 'claude-3-haiku-20240307', google: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile', deepseek: 'deepseek-chat', together: 'meta-llama/Llama-3-8b-chat-hf', openrouter: 'openai/gpt-4o-mini', mistral: 'mistral-small-latest', huggingface: 'meta-llama/Meta-Llama-3-8B-Instruct' },
  GENERATION: { openai: 'gpt-4o',      anthropic: 'claude-3-5-sonnet-20241022', google: 'gemini-1.5-pro', groq: 'llama-3.3-70b-versatile', deepseek: 'deepseek-chat', together: 'meta-llama/Llama-3-70b-chat-hf', openrouter: 'openai/gpt-4o', mistral: 'mistral-large-latest', huggingface: 'meta-llama/Meta-Llama-3-70B-Instruct' },
  THINKING:   { openai: 'gpt-4o-mini', anthropic: 'claude-3-haiku-20240307', google: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile', deepseek: 'deepseek-chat', together: 'meta-llama/Llama-3-8b-chat-hf', openrouter: 'openai/gpt-4o-mini', mistral: 'mistral-small-latest', huggingface: 'meta-llama/Meta-Llama-3-8B-Instruct' },
  REVIEW:     { openai: 'gpt-4o-mini', anthropic: 'claude-3-haiku-20240307', google: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile', deepseek: 'deepseek-chat', together: 'meta-llama/Llama-3-8b-chat-hf', openrouter: 'openai/gpt-4o-mini', mistral: 'mistral-small-latest', huggingface: 'meta-llama/Meta-Llama-3-8B-Instruct' },
  REPAIR:     { openai: 'gpt-4o-mini', anthropic: 'claude-3-haiku-20240307', google: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile', deepseek: 'deepseek-chat', together: 'meta-llama/Llama-3-8b-chat-hf', openrouter: 'openai/gpt-4o-mini', mistral: 'mistral-small-latest', huggingface: 'meta-llama/Meta-Llama-3-8B-Instruct' },
};

/** Ordered provider detection list — first one with an env key wins.
 *  OpenAI is intentionally placed last: its free/trial quota exhausts quickly.
 *  Groq is first: fast, free-tier, excellent for lightweight critique & repair tasks.
 */
const PROVIDER_CHECKS: Array<{
  id: string;
  envKey: string;
  baseUrl?: string;
}> = [
  { id: 'groq',       envKey: 'GROQ_API_KEY',        baseUrl: 'https://api.groq.com/openai/v1' },
  { id: 'google',     envKey: 'GOOGLE_API_KEY' },
  { id: 'google',     envKey: 'GEMINI_API_KEY' },
  { id: 'anthropic',  envKey: 'ANTHROPIC_API_KEY' },
  { id: 'deepseek',   envKey: 'DEEPSEEK_API_KEY' },
  { id: 'together',   envKey: 'TOGETHER_API_KEY',     baseUrl: 'https://api.together.xyz/v1' },
  { id: 'openrouter', envKey: 'OPENROUTER_API_KEY',   baseUrl: 'https://openrouter.ai/api/v1' },
  { id: 'huggingface',envKey: 'HUGGINGFACE_API_KEY',  baseUrl: 'https://router.huggingface.co/hf-inference/v1' },
  { id: 'mistral',    envKey: 'MISTRAL_API_KEY' },
  // OpenAI last — free/trial keys exhaust quota quickly
  { id: 'openai',     envKey: 'OPENAI_API_KEY' },
];

/**
 * Resolves an AdapterConfig from environment variables.
 *
 * Priority:
 * 1. <PURPOSE>_MODEL env var  (explicit override — use any model/provider)
 * 2. First provider env key found in PROVIDER_CHECKS order
 * 3. Ollama local (always available, no key needed)
 *
 * @param purpose  Which pipeline step this is for (controls default model selection)
 * @returns        A ready-to-use AdapterConfig to pass to getWorkspaceAdapter()
 */
export function resolveDefaultAdapter(purpose: AdapterPurpose): AdapterConfig {
  // ── 1. Purpose-specific explicit override ─────────────────────────────────
  const purposeModel    = process.env[`${purpose}_MODEL`];
  const purposeProvider = process.env[`${purpose}_PROVIDER`];
  const purposeApiKey   = process.env[`${purpose}_API_KEY`];

  if (purposeModel) {
    return {
      model:    purposeModel,
      provider: purposeProvider || undefined,
      apiKey:   purposeApiKey  || resolveApiKeyForProvider(purposeProvider ?? ''),
    };
  }

  // ── 2. Generic MODEL/PROVIDER override (no purpose prefix) ────────────────
  const genericModel    = process.env.DEFAULT_MODEL;
  const genericProvider = process.env.DEFAULT_PROVIDER;
  if (genericModel) {
    return {
      model:    genericModel,
      provider: genericProvider || undefined,
      apiKey:   resolveApiKeyForProvider(genericProvider ?? ''),
    };
  }

  // ── 3. Auto-detect from provider API keys ─────────────────────────────────
  const defaults = PURPOSE_DEFAULTS[purpose];
  for (const check of PROVIDER_CHECKS) {
    const key = process.env[check.envKey];
    if (key) {
      return {
        model:    defaults[check.id] ?? 'gpt-4o-mini',
        provider: check.id,
        apiKey:   key,
        baseUrl:  check.baseUrl,
      };
    }
  }

  // ── 4. Ollama local (last resort — no key needed) ─────────────────────────
  return { model: 'llama3', provider: 'ollama' };
}

/**
 * Looks up the canonical API key env var for a named provider.
 * Returns undefined if no key is found.
 */
export function resolveApiKeyForProvider(provider: string): string | undefined {
  const map: Record<string, string[]> = {
    openai:     ['OPENAI_API_KEY'],
    anthropic:  ['ANTHROPIC_API_KEY'],
    google:     ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
    groq:       ['GROQ_API_KEY'],
    deepseek:   ['DEEPSEEK_API_KEY'],
    together:   ['TOGETHER_API_KEY'],
    huggingface:['HUGGINGFACE_API_KEY'],
    openrouter: ['OPENROUTER_API_KEY'],
    mistral:    ['MISTRAL_API_KEY'],
    meta:       ['TOGETHER_API_KEY', 'GROQ_API_KEY'],
    qwen:       ['DASHSCOPE_API_KEY', 'TOGETHER_API_KEY'],
    gemma:      ['TOGETHER_API_KEY', 'GROQ_API_KEY'],
  };
  const vars = map[provider.toLowerCase()] ?? [];
  for (const v of vars) {
    const val = process.env[v];
    if (val) return val;
  }
  return undefined;
}
