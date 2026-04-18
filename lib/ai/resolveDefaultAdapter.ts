/**
 * @file resolveDefaultAdapter.ts
 * Provider-agnostic env-based adapter config resolver.
 *
 * Checks supported provider API keys in priority order and returns
 * the first available AdapterConfig. Works with OpenAI, Anthropic,
 * Google, Groq, HuggingFace, or local Ollama.
 *
 * Priority order (by capability tier and cost efficiency):
 *  1. Purpose-specific env override (e.g. INTENT_MODEL / INTENT_PROVIDER / INTENT_API_KEY)
 *  2. Groq        (fast, generous free-tier — ideal for CLASSIFIER/REVIEW/REPAIR)
 *  3. Google Gemini
 *  4. Anthropic
 *  5. HuggingFace (open-source models)
 *  6. OpenAI      (deprioritized — quota exhausts easily on free/trial keys)
 *  7. Ollama / LM Studio (local — no key needed, always available as last resort)
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
  INTENT:     { openai: 'gpt-4o-mini', anthropic: 'claude-3-haiku-20240307', google: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile' },
  CLASSIFIER: { openai: 'gpt-4o-mini', anthropic: 'claude-3-haiku-20240307', google: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile' },
  GENERATION: { openai: 'gpt-4o',      anthropic: 'claude-3-5-sonnet-20241022', google: 'gemini-1.5-pro', groq: 'llama-3.3-70b-versatile' },
  THINKING:   { openai: 'gpt-4o-mini', anthropic: 'claude-3-haiku-20240307', google: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile' },
  REVIEW:     { openai: 'gpt-4o-mini', anthropic: 'claude-3-haiku-20240307', google: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile' },
  REPAIR:     { openai: 'gpt-4o-mini', anthropic: 'claude-3-haiku-20240307', google: 'gemini-2.0-flash', groq: 'llama-3.3-70b-versatile' },
};

/** Ordered provider detection list — first one with an env key wins. */
const PROVIDER_CHECKS: Array<{
  id: string;
  envKey: string;
  baseUrl?: string;
}> = [
  { id: 'groq',        envKey: 'GROQ_API_KEY',        baseUrl: 'https://api.groq.com/openai/v1' },
  { id: 'google',      envKey: 'GOOGLE_API_KEY' },
  { id: 'google',      envKey: 'GEMINI_API_KEY' },
  { id: 'anthropic',   envKey: 'ANTHROPIC_API_KEY' },

  // OpenAI last — free/trial keys exhaust quota quickly
  { id: 'openai',      envKey: 'OPENAI_API_KEY' },
];

/** Universal LLM_KEY for all providers */
const UNIVERSAL_LLM_KEY = process.env.LLM_KEY;

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
  console.log(`[resolveDefaultAdapter] Resolving adapter for purpose: ${purpose}`);
  
  // ── 1. Purpose-specific explicit override ─────────────────────────────────
  const purposeModel    = process.env[`${purpose}_MODEL`];
  const purposeProvider = process.env[`${purpose}_PROVIDER`];
  const purposeApiKey   = process.env[`${purpose}_API_KEY`];

  if (purposeModel) {
    console.log(`[resolveDefaultAdapter] Using purpose-specific override for ${purpose}`);
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
    console.log(`[resolveDefaultAdapter] Using generic model override: ${genericModel}`);
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
      console.log(`[resolveDefaultAdapter] ✓ Found ${check.envKey}, using provider: ${check.id}`);
      return {
        model:    defaults[check.id] ?? 'gpt-4o-mini',
        provider: check.id,
        apiKey:   key,
        baseUrl:  check.baseUrl,
      };
    }
  }

  // ── 4. Universal LLM_KEY fallback ─────────────────────────────────────────
  // If no specific provider key is found, use LLM_KEY with the first provider
  if (UNIVERSAL_LLM_KEY) {
    const defaultProvider = PROVIDER_CHECKS[0]; // groq as default
    console.log(`[resolveDefaultAdapter] ✓ Using universal LLM_KEY with provider: ${defaultProvider.id}`);
    console.log(`[resolveDefaultAdapter] LLM_KEY length: ${UNIVERSAL_LLM_KEY.length}, prefix: ${UNIVERSAL_LLM_KEY.substring(0, 10)}...`);
    return {
      model:    defaults[defaultProvider.id] ?? 'gpt-4o-mini',
      provider: defaultProvider.id,
      apiKey:   UNIVERSAL_LLM_KEY,
      baseUrl:  defaultProvider.baseUrl,
    };
  }

  // ── 5. Fallback (Waiting Socket) ─────────────────────────
  // A generic socket that safely informs the client to inject a configuration.
  console.error(`[resolveDefaultAdapter] ✗ No API keys found for purpose: ${purpose}`);
  console.error(`[resolveDefaultAdapter] Available keys:`, 
    Object.keys(process.env).filter(k => k.includes('API_KEY') || k === 'LLM_KEY')
  );
  
  return { model: 'unconfigured', provider: 'unconfigured' };
}

/**
 * Looks up the canonical API key env var for a named provider.
 * Falls back to universal LLM_KEY if no specific key is found.
 * Returns undefined if no key is found.
 */
export function resolveApiKeyForProvider(provider: string): string | undefined {
  // First check for universal LLM_KEY
  if (UNIVERSAL_LLM_KEY) {
    return UNIVERSAL_LLM_KEY;
  }
  
  const map: Record<string, string[]> = {
    openai:     ['OPENAI_API_KEY'],
    anthropic:  ['ANTHROPIC_API_KEY'],
    google:     ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
    groq:       ['GROQ_API_KEY'],
  };
  const vars = map[provider.toLowerCase()] ?? [];
  for (const v of vars) {
    const val = process.env[v];
    if (val) return val;
  }
  return undefined;
}
