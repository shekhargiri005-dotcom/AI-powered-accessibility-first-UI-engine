/**
 * @file resolveDefaultAdapter.ts
 * Provider-agnostic env-based adapter config resolver.
 *
 * Checks supported provider API keys in priority order and returns
 * the first available AdapterConfig. Works with OpenAI, Anthropic,
 * Google, or Groq.
 *
 * Priority order (by capability tier and cost efficiency):
 *  1. Purpose-specific env override (e.g. INTENT_MODEL / INTENT_PROVIDER / INTENT_API_KEY)
 *  2. Groq        (fast, generous free-tier — ideal for CLASSIFIER/REVIEW/REPAIR)
 *  3. Google Gemini
 *  4. Anthropic
 *  5. OpenAI      (deprioritized — quota exhausts easily on free/trial keys)
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

/**
 * Resolves an AdapterConfig from environment variables.
 *
 * Priority:
 * 1. <PURPOSE>_MODEL env var  (explicit override — use any model/provider)
 * 2. First provider env key found in PROVIDER_CHECKS order
 * 3. Fallback to unconfigured
 *
 * @param purpose  Which pipeline step this is for (controls default model selection)
 * @returns        A ready-to-use AdapterConfig to pass to getWorkspaceAdapter()
 */
/**
 * Resolves an AdapterConfig from environment variables.
 *
 * Priority:
 * 1. <PURPOSE>_MODEL env var  (explicit override — use any model/provider)
 * 2. First provider env key found in PROVIDER_CHECKS order
 * 3. Fallback to unconfigured
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

  // ── 4. Fallback (Unconfigured) ────────────────────────────────────────
  // No provider-specific keys found.
  console.error(`[resolveDefaultAdapter] ✗ No API keys found for purpose: ${purpose}`);
  console.error(`[resolveDefaultAdapter] Available keys:`, 
    Object.keys(process.env).filter(k => k.includes('API_KEY'))
  );
  
  return { model: 'unconfigured', provider: 'unconfigured' };
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
  };
  const vars = map[provider.toLowerCase()] ?? [];
  for (const v of vars) {
    const val = process.env[v];
    if (val) return val;
  }
  return undefined;
}
