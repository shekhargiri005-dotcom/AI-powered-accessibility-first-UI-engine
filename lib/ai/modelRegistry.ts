/**
 * @file lib/ai/modelRegistry.ts
 *
 * The single source of truth for all model capability metadata.
 *
 * Supported providers: OpenAI, Google Gemini, Groq (3 cloud providers).
 *
 * The profile drives:
 *  - Which pipeline tier to use
 *  - How much blueprint/context to inject (token budget)
 *  - What temperature to apply (per-model optimum)
 *  - Which code extraction strategy to use on the raw output
 *  - Whether to inject explicit imports into the prompt
 *  - Whether to use fill-in-blank vs freeform prompting
 *  - How many tool-call rounds to allow
 *  - What repair strategy to apply after generation
 *  - How long to wait before timing out
 *
 * Design principles:
 *  - No network calls. Pure static data.
 *  - Partial matching: "gpt-4o-2024-05-13" matches "gpt-4o" profile.
 *  - Never silently fail — getModelProfile() returns null for unknown models.
 *    Callers must fall back to a sensible default tier (cloud).
 */

// ─── Tier Definition ──────────────────────────────────────────────────────────

/**
 * Five capability tiers. Each tier maps to a distinct pipeline strategy.
 *
 * tiny   < 3B params  — fill-in-blank templates, temp 0.0, no tool calls
 * small  3B–9B        — structured templates, temp 0.1–0.2, rules-only repair
 * medium 10B–34B      — guided freeform, temp 0.2–0.4, 1 tool round
 * large  35B–70B      — light guidance, temp 0.3–0.5, 2 tool rounds
 * cloud  API-hosted   — full freeform, temp 0.5–0.7, 3 tool rounds
 */
export type ModelTier = 'tiny' | 'small' | 'medium' | 'large' | 'cloud';

// ─── Prompt Strategy ──────────────────────────────────────────────────────────

export type PromptStrategy = 'fill-in-blank' | 'structured-template' | 'guided-freeform' | 'freeform';

// ─── Extraction Strategy ──────────────────────────────────────────────────────

export type ExtractionStrategy = 'fence' | 'heuristic' | 'aggressive';

// ─── Repair Priority ──────────────────────────────────────────────────────────

export type RepairPriority = 'never' | 'rules-only' | 'ai-cheap' | 'ai-strong';

// ─── Capability Profile ───────────────────────────────────────────────────────

export interface ModelCapabilityProfile {
  /** Canonical registry key, e.g. "gpt-4o" */
  id: string;
  /** Human-readable name for UI display */
  displayName: string;
  /** Provider that serves this model */
  provider: string;
  /** Capability tier — drives pipeline selection */
  tier: ModelTier;

  // ── Capacity ──────────────────────────────────────────────────────────────
  /** Maximum input tokens the model can reliably process */
  contextWindow: number;
  /** Safe upper bound for generated output tokens */
  maxOutputTokens: number;

  // ── Generation Behaviour ──────────────────────────────────────────────────
  /** Optimal temperature for TSX code generation */
  idealTemperature: number;
  /** Whether the model honours a separate system role message */
  supportsSystemPrompt: boolean;
  /** Whether the model supports OpenAI-style function/tool calling */
  supportsToolCalls: boolean;
  /** Whether the model supports JSON mode / response_format: json_object */
  supportsJsonMode: boolean;
  /** Whether SSE streaming is reliable (false → fall back to generate()) */
  streamingReliable: boolean;

  // ── Known Behaviour ───────────────────────────────────────────────────────
  strengths: string[];
  weaknesses: string[];

  // ── Pipeline Control ──────────────────────────────────────────────────────
  /** Prompt construction strategy */
  promptStrategy: PromptStrategy;
  /** Max tokens of blueprint this model can absorb without ignoring them */
  maxBlueprintTokens: number;
  /**
   * Inject a locked import block into the prompt.
   * Use for models known to hallucinate import paths.
   */
  needsExplicitImports: boolean;
  /**
   * Add an output format hint (```tsx ... ```) to the prompt.
   * Use for models that output prose or raw code without fences.
   */
  needsOutputWrapper: boolean;
  /** Code extraction strategy to apply on raw model output */
  extractionStrategy: ExtractionStrategy;

  // ── Repair ────────────────────────────────────────────────────────────────
  /** What level of repair to apply after validation fails */
  repairPriority: RepairPriority;
  /** Milliseconds to wait for generation before timing out */
  timeoutMs: number;

  // ── Notes ─────────────────────────────────────────────────────────────────
  /** Special handling flags or quirks for this model */
  notes?: string;
}

// ─── The Registry ─────────────────────────────────────────────────────────────

export const MODEL_REGISTRY: Record<string, ModelCapabilityProfile> = {

  // ══════════════════════════════════════════════════════════════════════════
  // OPENAI  (GPT-4o, GPT-4o-mini, o1, o3-mini)
  // ══════════════════════════════════════════════════════════════════════════

  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    tier: 'cloud',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    idealTemperature: 0.8,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: true,
    streamingReliable: true,
    strengths: ['fast', 'cheap', 'strong React knowledge', 'excellent for repair tasks'],
    weaknesses: ['less creative than gpt-4o for visual design tasks'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 4000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 45000,
  },

  'gpt-4o': {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    tier: 'cloud',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    idealTemperature: 0.85,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: true,
    streamingReliable: true,
    strengths: [
      'best overall cloud model for UI generation',
      'strong design intuition',
      'full tool call support',
      'accessibility-aware',
    ],
    weaknesses: ['higher cost per token'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 6000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 60000,
  },

  // ── OpenAI Reasoning Models (o1 / o3 series) ─────────────────────────────
  // IMPORTANT: These models reject temperature, max_tokens, and response_format.
  // The OpenAI adapter detects them via isReasoningModel() and adjusts params.

  'o3-mini': {
    id: 'o3-mini',
    displayName: 'o3-mini',
    provider: 'openai',
    tier: 'cloud',
    contextWindow: 200000,
    maxOutputTokens: 65536,
    idealTemperature: 1.0,  // reasoning models default; adapter omits this param
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['strongest reasoning', 'excellent code planning', 'very large context'],
    weaknesses: ['no temperature control', 'no response_format', 'higher cost'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 10000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 120000,
    notes: 'Uses max_completion_tokens instead of max_tokens. Adapter auto-detects and adjusts.',
  },

  'o1': {
    id: 'o1',
    displayName: 'o1',
    provider: 'openai',
    tier: 'cloud',
    contextWindow: 200000,
    maxOutputTokens: 32768,
    idealTemperature: 1.0,
    supportsSystemPrompt: false,  // o1 does not support a system role
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['advanced multi-step reasoning', 'complex code analysis'],
    weaknesses: ['no system prompt', 'no temperature control', 'slow'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 10000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 180000,
    notes: 'No system prompt support — merge into user message. Uses max_completion_tokens.',
  },

  'o1-mini': {
    id: 'o1-mini',
    displayName: 'o1-mini',
    provider: 'openai',
    tier: 'cloud',
    contextWindow: 128000,
    maxOutputTokens: 65536,
    idealTemperature: 1.0,
    supportsSystemPrompt: false,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['fast reasoning', 'cheaper than o1', 'strong code tasks'],
    weaknesses: ['no system prompt', 'no temperature control'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 8000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 120000,
    notes: 'No system prompt — merge into user. Uses max_completion_tokens.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GOOGLE GEMINI  (Gemini 2.0 Flash, Gemini 1.5 Pro)
  // ══════════════════════════════════════════════════════════════════════════

  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'google',
    tier: 'cloud',
    contextWindow: 128000,
    maxOutputTokens: 4096,
    idealTemperature: 0.85,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: true,
    streamingReliable: true,
    strengths: ['fastest cloud model in the stack', 'cheap', 'ideal for thinking/intent phases'],
    weaknesses: ['less design nuance than GPT-4o'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 4000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 25000,
  },

  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    provider: 'google',
    tier: 'cloud',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    idealTemperature: 0.85,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: true,
    streamingReliable: true,
    strengths: ['enormous context window (1M tokens)', 'vision/multimodal', 'strong code'],
    weaknesses: ['slower than GPT-4o on straight code generation tasks'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 6000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 75000,
  },

  'gemini-1.5-flash': {
    id: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    provider: 'google',
    tier: 'cloud',
    contextWindow: 1000000,
    maxOutputTokens: 4096,
    idealTemperature: 0.85,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: true,
    streamingReliable: true,
    strengths: ['fast and cheap', '1M context window', 'good for classification/thinking'],
    weaknesses: ['less creative than GPT-4o for complex UI'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 4000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 30000,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // GROQ  (Llama 3.3 70B, Mixtral, Gemma2 — via OpenAI-compatible API)
  // ══════════════════════════════════════════════════════════════════════════

  'llama-3.3-70b-versatile': {
    id: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B (Groq)',
    provider: 'groq',
    tier: 'cloud',
    contextWindow: 32768,
    maxOutputTokens: 4096,
    idealTemperature: 0.75,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: [
      'fastest 70B model via Groq inference (< 3s)',
      'free tier available',
      'tool call support',
    ],
    weaknesses: ['smaller context than paid cloud providers', 'design instincts weaker than GPT-4o'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 3000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 25000,
  },

  'mixtral-8x7b-32768': {
    id: 'mixtral-8x7b-32768',
    displayName: 'Mixtral 8x7B (Groq)',
    provider: 'groq',
    tier: 'cloud',
    contextWindow: 32768,
    maxOutputTokens: 4096,
    idealTemperature: 0.7,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['fast MoE inference via Groq', 'large 32K context', 'free tier'],
    weaknesses: ['weaker code quality than Llama 3.3 70B', 'no JSON mode'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 2500,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 25000,
  },

  'gemma2-9b-it': {
    id: 'gemma2-9b-it',
    displayName: 'Gemma 2 9B (Groq)',
    provider: 'groq',
    tier: 'cloud',
    contextWindow: 8192,
    maxOutputTokens: 2048,
    idealTemperature: 0.7,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['fast 9B model via Groq', 'free tier', 'good instruction following'],
    weaknesses: ['small context window', 'weaker on complex UI generation'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 1500,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 20000,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // OLLAMA  (Cloud models via ollama.com OpenAI-compatible API)
  // ══════════════════════════════════════════════════════════════════════════

  'qwen3-coder-next': {
    id: 'qwen3-coder-next',
    displayName: 'Qwen3 Coder Next (Ollama Cloud)',
    provider: 'ollama',
    tier: 'cloud',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    idealTemperature: 0.65,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['best coding model on Ollama Cloud', '80B agentic coding', 'large context', 'tool support'],
    weaknesses: ['higher latency than local models', 'usage-based pricing'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 3000,
    needsExplicitImports: true,
    needsOutputWrapper: true,
    extractionStrategy: 'fence',
    repairPriority: 'ai-cheap',
    timeoutMs: 90000,
  },

  'gemma4:e2b': {
    id: 'gemma4:e2b',
    displayName: 'Gemma 4 2B (Ollama Cloud)',
    provider: 'ollama',
    tier: 'cloud',
    contextWindow: 32768,
    maxOutputTokens: 4096,
    idealTemperature: 0.7,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['fast and cheap', 'good for classify/think', 'tool support', 'frontier quality at 2B'],
    weaknesses: ['small model — weaker code generation', 'may truncate long output'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 2000,
    needsExplicitImports: true,
    needsOutputWrapper: true,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 45000,
  },

  'devstral-small-2': {
    id: 'devstral-small-2',
    displayName: 'Devstral Small 2 24B (Ollama Cloud)',
    provider: 'ollama',
    tier: 'cloud',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    idealTemperature: 0.65,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['agentic coding', 'multi-file editing', 'large context', 'tool support'],
    weaknesses: ['usage-based pricing', 'may over-engineer simple components'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 3000,
    needsExplicitImports: true,
    needsOutputWrapper: true,
    extractionStrategy: 'fence',
    repairPriority: 'ai-cheap',
    timeoutMs: 90000,
  },

  'deepseek-v3.2': {
    id: 'deepseek-v3.2',
    displayName: 'DeepSeek V3.2 (Ollama Cloud)',
    provider: 'ollama',
    tier: 'cloud',
    contextWindow: 131072,
    maxOutputTokens: 8192,
    idealTemperature: 0.6,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['strong reasoning', 'agentic capabilities', 'large context', 'tool support'],
    weaknesses: ['usage-based pricing', 'slower inference on complex prompts'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 3000,
    needsExplicitImports: true,
    needsOutputWrapper: true,
    extractionStrategy: 'fence',
    repairPriority: 'ai-cheap',
    timeoutMs: 90000,
  },

  'qwen3.5:9b': {
    id: 'qwen3.5:9b',
    displayName: 'Qwen 3.5 9B (Ollama Cloud)',
    provider: 'ollama',
    tier: 'cloud',
    contextWindow: 131072,
    maxOutputTokens: 4096,
    idealTemperature: 0.7,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['multimodal', 'good balance of speed and quality', 'tool support', 'large context'],
    weaknesses: ['weaker than dedicated coding models', 'usage-based pricing'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 2000,
    needsExplicitImports: true,
    needsOutputWrapper: true,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 60000,
  },
};

// ─── Lookup Helpers ───────────────────────────────────────────────────────────

/**
 * Look up a model profile by id.
 *
 * Resolution order:
 * 1. Exact match (e.g. "gpt-4o-mini")
 * 2. Partial match — registry key contained in the provided modelId
 *    (e.g. "gpt-4o-2024-05-13" → "gpt-4o")
 * 3. null — caller must fall back to cloud defaults
 *
 * @param modelId  Any model identifier string
 */
export function getModelProfile(modelId: string): ModelCapabilityProfile | null {
  if (!modelId) return null;

  // Exact match
  if (MODEL_REGISTRY[modelId]) return MODEL_REGISTRY[modelId];

  const lower = modelId.toLowerCase();

  // Partial match — registry key contained in modelId
  const exactPartial = Object.keys(MODEL_REGISTRY).find(k => lower === k.toLowerCase());
  if (exactPartial) return MODEL_REGISTRY[exactPartial];

  const partial = Object.keys(MODEL_REGISTRY).find(k => lower.includes(k.toLowerCase()));
  if (partial) return MODEL_REGISTRY[partial];

  return null;
}

/**
 * Returns all registered models for a given tier.
 */
export function getModelsByTier(tier: ModelTier): ModelCapabilityProfile[] {
  return Object.values(MODEL_REGISTRY).filter(p => p.tier === tier);
}

/**
 * Returns a safe default cloud profile to use when the requested
 * model is not in the registry and we cannot determine its capabilities.
 * Defaults to gpt-4o-mini as the most conservative cloud profile.
 */
export function getCloudFallbackProfile(): ModelCapabilityProfile {
  return MODEL_REGISTRY['gpt-4o-mini'];
}

/**
 * Dynamically resolves the fastest/cheapest model available for a given provider.
 * This saves CPU and tokens for background tasks without hardcoding model names in route handlers.
 */
export function getFastModelForProvider(provider: string | undefined): string | undefined {
  if (!provider) return undefined;

  const models = Object.values(MODEL_REGISTRY).filter(m => m.provider === provider);
  if (models.length === 0) return undefined;

  // For cloud providers, look for explicitly cheap/fast keywords
  const fastCloud = models.find(m =>
    m.tier === 'cloud' &&
    (m.id.includes('mini') || m.id.includes('flash') || m.id.includes('9b'))
  );
  if (fastCloud) return fastCloud.id;

  // Fallback to whatever we have for the provider
  return models[0].id;
}
