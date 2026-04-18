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

/** Universal LLM_KEY — auto-detected or bound via LLM_PROVIDER */
const UNIVERSAL_LLM_KEY = process.env.LLM_KEY;

/**
 * Auto-detect which provider an API key belongs to based on its format.
 * This allows LLM_KEY to work as a truly universal key — the engine
 * figures out which provider the key is for without needing LLM_PROVIDER.
 *
 * Key format patterns:
 *   OpenAI:    sk-proj-... | sk-...
 *   Anthropic: sk-ant-...
 *   Google:    AIzaSy...
 *   Groq:      gsk_...
 *   Ollama:    (no key — uses OLLAMA_BASE_URL)
 */
export function detectProviderFromKey(apiKey: string): string | null {
  if (!apiKey || typeof apiKey !== 'string') return null;
  const key = apiKey.trim();

  if (key.startsWith('gsk_'))          return 'groq';
  if (key.startsWith('sk-ant-'))       return 'anthropic';
  if (key.startsWith('AIzaSy'))        return 'google';
  if (key.startsWith('sk-proj-'))      return 'openai';
  if (key.startsWith('sk-'))           return 'openai';  // generic OpenAI key format

  return null; // Unknown format — user must set LLM_PROVIDER explicitly
}

/** Resolve LLM_PROVIDER: explicit env var > auto-detect from LLM_KEY > fallback */
function resolveLlmProvider(): string {
  const explicit = process.env.LLM_PROVIDER?.toLowerCase();
  if (explicit) return explicit;
  if (UNIVERSAL_LLM_KEY) {
    const detected = detectProviderFromKey(UNIVERSAL_LLM_KEY);
    if (detected) {
      console.log(`[resolveLlmProvider] ✓ Auto-detected LLM_KEY as ${detected} provider`);
      return detected;
    }
    // Key format not recognized — default to openai so LLM_KEY still works
    console.warn(`[resolveLlmProvider] ⚠ Could not auto-detect LLM_KEY format. Defaulting to 'openai'. Set LLM_PROVIDER env var to override.`);
    return 'openai';
  }
  return '';
}

const LLM_PROVIDER = resolveLlmProvider();

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

  // ── 4. LLM_KEY — only for the provider it belongs to ──────────────────────
  // LLM_KEY is a single key that works for ONE specific provider (set via LLM_PROVIDER).
  // It must NOT be used as a credential for unrelated providers (causes 401 errors).
  if (UNIVERSAL_LLM_KEY && LLM_PROVIDER) {
    console.log(`[resolveDefaultAdapter] ✓ Using LLM_KEY with provider: ${LLM_PROVIDER} (from LLM_PROVIDER)`);
    return {
      model:    defaults[LLM_PROVIDER] ?? 'gpt-4o-mini',
      provider: LLM_PROVIDER,
      apiKey:   UNIVERSAL_LLM_KEY,
      baseUrl:  PROVIDER_CHECKS.find(c => c.id === LLM_PROVIDER)?.baseUrl,
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
 * LLM_KEY is only returned if the provider matches LLM_PROVIDER.
 * Returns undefined if no key is found.
 */
export function resolveApiKeyForProvider(provider: string): string | undefined {
  // Check universal LLM_KEY only if provider matches LLM_PROVIDER
  if (UNIVERSAL_LLM_KEY && provider.toLowerCase() === LLM_PROVIDER) {
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
