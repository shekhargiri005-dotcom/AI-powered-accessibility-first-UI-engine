/**
 * @file lib/ai/modelRegistry.ts
 *
 * The single source of truth for all model capability metadata.
 *
 * Every model that can be plugged into the engine has a profile here.
 * The profile drives:
 *  - Which pipeline tier to use (tiny → cloud)
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
 *  - Partial matching: "phi3:mini" matches "phi3" profile.
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

/**
 * fill-in-blank     — model fills slots in a near-complete template. For tiny models.
 * structured-template — numbered steps + structured blueprint. For small models.
 * guided-freeform   — style guidelines + design rules, some freedom. Medium/large.
 * freeform          — existing full system prompt. Cloud models only.
 */
export type PromptStrategy = 'fill-in-blank' | 'structured-template' | 'guided-freeform' | 'freeform';

// ─── Extraction Strategy ──────────────────────────────────────────────────────

/**
 * fence      — extract clean ```tsx ... ``` fences. Most reliable.
 * heuristic  — find first line resembling React, strip prose. For verbose models.
 * aggressive — strip model preamble, cut trailing explanations. For tiny models.
 */
export type ExtractionStrategy = 'fence' | 'heuristic' | 'aggressive';

// ─── Repair Priority ──────────────────────────────────────────────────────────

/**
 * never      — skip all repair (should not normally be used)
 * rules-only — apply rule-based patches only (deterministic)
 * ai-cheap   — rules first, then a cheap cloud model (haiku/gpt-4o-mini)
 * ai-strong  — rules first, then a strong cloud model (reserved for future use)
 */
export type RepairPriority = 'never' | 'rules-only' | 'ai-cheap' | 'ai-strong';

// ─── Capability Profile ───────────────────────────────────────────────────────

export interface ModelCapabilityProfile {
  /** Canonical registry key, e.g. "phi" or "gpt-4o" */
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
  // TINY  (< 3B parameters)
  // Strategy: fill-in-blank template, temperature 0.0, no tool calls
  // Blueprint: hard-capped at ~300 tokens
  // ══════════════════════════════════════════════════════════════════════════

  'tinyllama': {
    id: 'tinyllama',
    displayName: 'TinyLlama 1.1B',
    provider: 'ollama',
    tier: 'tiny',
    contextWindow: 2048,
    maxOutputTokens: 512,
    idealTemperature: 0.0,
    supportsSystemPrompt: false,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: false,
    strengths: ['extremely fast locally', 'no API cost'],
    weaknesses: [
      'virtually no React knowledge',
      'ignores long instructions',
      'forgets structure mid-generation',
      'hallucinates imports completely',
    ],
    promptStrategy: 'fill-in-blank',
    maxBlueprintTokens: 250,
    needsExplicitImports: true,
    needsOutputWrapper: true,
    extractionStrategy: 'aggressive',
    repairPriority: 'ai-cheap',
    timeoutMs: 30000,
    notes: 'System prompt is not honoured — merge into user turn as prefix.',
  },

  'phi': {
    id: 'phi',
    displayName: 'Phi-2 (2.7B)',
    provider: 'ollama',
    tier: 'tiny',
    contextWindow: 2048,
    maxOutputTokens: 600,
    idealTemperature: 0.0,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: false,
    strengths: [
      'surprisingly strong reasoning for its size',
      'follows simple fill-in-blank templates reliably',
    ],
    weaknesses: [
      'tiny context window',
      'drops JSX closing tags',
      'invents non-existent import paths',
      'generation often cuts off before closing brace',
    ],
    promptStrategy: 'fill-in-blank',
    maxBlueprintTokens: 350,
    needsExplicitImports: true,
    needsOutputWrapper: true,
    extractionStrategy: 'aggressive',
    repairPriority: 'ai-cheap',
    timeoutMs: 45000,
  },

  'gemma:2b': {
    id: 'gemma:2b',
    displayName: 'Gemma 2B',
    provider: 'ollama',
    tier: 'tiny',
    contextWindow: 2048,
    maxOutputTokens: 512,
    idealTemperature: 0.0,
    supportsSystemPrompt: false,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: false,
    strengths: ['decent English generation', 'Google-trained'],
    weaknesses: [
      'no React-specific training',
      'context drops fast',
      'ignores system prompt',
    ],
    promptStrategy: 'fill-in-blank',
    maxBlueprintTokens: 250,
    needsExplicitImports: true,
    needsOutputWrapper: true,
    extractionStrategy: 'aggressive',
    repairPriority: 'ai-cheap',
    timeoutMs: 30000,
    notes: 'System prompt not honoured — merge into user turn.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SMALL  (3B – 9B parameters)
  // Strategy: structured template with numbered steps
  // Blueprint: 500–1200 tokens
  // ══════════════════════════════════════════════════════════════════════════

  'phi3': {
    id: 'phi3',
    displayName: 'Phi-3 Mini (3.8B)',
    provider: 'ollama',
    tier: 'small',
    contextWindow: 4096,
    maxOutputTokens: 1000,
    idealTemperature: 0.1,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['strong instruction following for its size', 'decent Tailwind knowledge'],
    weaknesses: ['limited context window', 'occasional import hallucination'],
    promptStrategy: 'structured-template',
    maxBlueprintTokens: 600,
    needsExplicitImports: true,
    needsOutputWrapper: true,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 60000,
  },

  'phi4': {
    id: 'phi4',
    displayName: 'Phi-4 (14B)',
    provider: 'ollama',
    tier: 'medium',
    contextWindow: 16384,
    maxOutputTokens: 3000,
    idealTemperature: 0.2,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['strong reasoning', 'good code output', 'follows detailed blueprints'],
    weaknesses: ['design aesthetic knowledge limited vs cloud'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 1500,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 120000,
  },

  'gemma:7b': {
    id: 'gemma:7b',
    displayName: 'Gemma 7B',
    provider: 'ollama',
    tier: 'small',
    contextWindow: 8192,
    maxOutputTokens: 1500,
    idealTemperature: 0.15,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['good reasoning', 'follows structured prompts'],
    weaknesses: ['not accessibility-aware', 'occasional hallucinated libraries'],
    promptStrategy: 'structured-template',
    maxBlueprintTokens: 800,
    needsExplicitImports: true,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 90000,
  },

  'llama3.2': {
    id: 'llama3.2',
    displayName: 'Llama 3.2 (3B)',
    provider: 'ollama',
    tier: 'small',
    contextWindow: 4096,
    maxOutputTokens: 1200,
    idealTemperature: 0.1,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['Meta instruction tuning', 'decent Tailwind knowledge'],
    weaknesses: ['small context window', 'forgets long blueprints'],
    promptStrategy: 'structured-template',
    maxBlueprintTokens: 500,
    needsExplicitImports: true,
    needsOutputWrapper: true,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 60000,
  },

  'mistral:7b': {
    id: 'mistral:7b',
    displayName: 'Mistral 7B Instruct',
    provider: 'ollama',
    tier: 'small',
    contextWindow: 8192,
    maxOutputTokens: 2000,
    idealTemperature: 0.2,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: true,
    streamingReliable: true,
    strengths: [
      'strong coder for its size',
      'excellent instruction following',
      'consistent output format',
    ],
    weaknesses: ['may skip a11y annotations unless explicitly told'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 1000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 90000,
  },

  'deepseek-coder:6.7b': {
    id: 'deepseek-coder:6.7b',
    displayName: 'DeepSeek Coder 6.7B',
    provider: 'ollama',
    tier: 'small',
    contextWindow: 8192,
    maxOutputTokens: 3000,
    idealTemperature: 0.1,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: [
      'specialised code model',
      'excellent TSX output quality',
      'follows exact templates reliably',
    ],
    weaknesses: ['weak on design/aesthetics', 'no accessibility awareness'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 1200,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 90000,
  },

  'codegemma:7b': {
    id: 'codegemma:7b',
    displayName: 'CodeGemma 7B',
    provider: 'ollama',
    tier: 'small',
    contextWindow: 8192,
    maxOutputTokens: 2500,
    idealTemperature: 0.1,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['Google code model', 'strong TSX output', 'accurate import resolution'],
    weaknesses: ['design aesthetic knowledge limited'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 1000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 90000,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MEDIUM  (10B – 34B parameters)
  // Strategy: guided freeform — style guidelines + design rules, some freedom
  // Blueprint: 1500–2500 tokens
  // ══════════════════════════════════════════════════════════════════════════

  'llama3.1': {
    id: 'llama3.1',
    displayName: 'Llama 3.1 (8B/13B)',
    provider: 'ollama',
    tier: 'medium',
    contextWindow: 16384,
    maxOutputTokens: 4000,
    idealTemperature: 0.3,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['large context', 'tool call support', 'solid React knowledge'],
    weaknesses: ['slow on local hardware at 13B+', 'can be verbose'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 2000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 180000,
  },

  'deepseek-coder:33b': {
    id: 'deepseek-coder:33b',
    displayName: 'DeepSeek Coder 33B',
    provider: 'ollama',
    tier: 'medium',
    contextWindow: 16384,
    maxOutputTokens: 5000,
    idealTemperature: 0.2,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: [
      'best local code model at this size',
      'excellent TSX output',
      'accurate Tailwind class usage',
    ],
    weaknesses: ['slow on consumer hardware', 'no accessibility opinions'],
    promptStrategy: 'guided-freeform',
    maxBlueprintTokens: 2500,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 240000,
  },

  'mistral:22b': {
    id: 'mistral:22b',
    displayName: 'Mistral 22B',
    provider: 'ollama',
    tier: 'medium',
    contextWindow: 32768,
    maxOutputTokens: 5000,
    idealTemperature: 0.3,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: true,
    streamingReliable: true,
    strengths: ['excellent instruction following', 'tool calls', 'design awareness'],
    weaknesses: ['very slow on local hardware'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 3000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 300000,
  },

  // ══════════════════════════════════════════════════════════════════════════
  // LARGE  (35B – 70B parameters, local)
  // Strategy: light guidance — design rules only, full creative freedom
  // Blueprint: 3000–5000 tokens
  // ══════════════════════════════════════════════════════════════════════════

  'llama3:70b': {
    id: 'llama3:70b',
    displayName: 'Llama 3 70B',
    provider: 'ollama',
    tier: 'large',
    contextWindow: 32768,
    maxOutputTokens: 6000,
    idealTemperature: 0.4,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: [
      'near-cloud quality output',
      'strong React and design knowledge',
      'tool call support',
    ],
    weaknesses: [
      'extremely slow on local hardware (60–120s)',
      'high VRAM requirements',
    ],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 4000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 300000,
  },

  'deepseek-r1:70b': {
    id: 'deepseek-r1:70b',
    displayName: 'DeepSeek-R1 70B',
    provider: 'ollama',
    tier: 'large',
    contextWindow: 65536,
    maxOutputTokens: 8000,
    idealTemperature: 0.3,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: [
      'reasoning model — exceptional code planning',
      'enormous context window',
      'top-tier code quality locally',
    ],
    weaknesses: [
      'very slow',
      'emits <think>...</think> blocks that must be stripped before extraction',
    ],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 5000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 360000,
    notes: 'Strip <think>...</think> blocks before code extraction.',
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CLOUD  (API-served, all tiers of capability)
  // Strategy: full freeform — existing system prompts, all tools
  // Blueprint: full enrichment (6000–12000+ tokens)
  // ══════════════════════════════════════════════════════════════════════════

  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    provider: 'openai',
    tier: 'cloud',
    contextWindow: 128000,
    maxOutputTokens: 8000,
    idealTemperature: 0.5,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: true,
    streamingReliable: true,
    strengths: ['fast', 'cheap', 'strong React knowledge', 'excellent for repair tasks'],
    weaknesses: ['less creative than gpt-4o for visual design tasks'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 6000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 60000,
  },

  'gpt-4o': {
    id: 'gpt-4o',
    displayName: 'GPT-4o',
    provider: 'openai',
    tier: 'cloud',
    contextWindow: 128000,
    maxOutputTokens: 16000,
    idealTemperature: 0.6,
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
    maxBlueprintTokens: 8000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 90000,
  },

  'claude-3-5-sonnet-20241022': {
    id: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    tier: 'cloud',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    idealTemperature: 0.6,
    supportsSystemPrompt: true,
    supportsToolCalls: false,   // Anthropic tool-calling uses a different schema — disabled until implemented
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: [
      'best design instincts of all cloud models',
      'best accessibility awareness',
      'nuanced understanding of visual hierarchy',
      'largest context window in this registry',
    ],
    weaknesses: ['no JSON mode', 'slightly slower than GPT-4o-mini'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 10000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 90000,
  },

  'claude-3-haiku-20240307': {
    id: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    provider: 'anthropic',
    tier: 'cloud',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    idealTemperature: 0.5,
    supportsSystemPrompt: true,
    supportsToolCalls: false,   // Anthropic tool-calling uses a different schema — disabled until implemented
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['fastest Anthropic model', 'very cheap', 'great for repair and review tasks'],
    weaknesses: ['less design creativity than Sonnet'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 6000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 30000,
  },

  // claude-3-5-haiku and claude-3-opus aliases
  'claude-3-5-haiku-20241022': {
    id: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    tier: 'cloud',
    contextWindow: 200000,
    maxOutputTokens: 8192,
    idealTemperature: 0.5,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['fast', 'cheap', 'great code quality for cost'],
    weaknesses: ['less creative than Sonnet'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 8000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 45000,
  },

  'claude-3-opus-20240229': {
    id: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    provider: 'anthropic',
    tier: 'cloud',
    contextWindow: 200000,
    maxOutputTokens: 4096,
    idealTemperature: 0.6,
    supportsSystemPrompt: true,
    supportsToolCalls: false,
    supportsJsonMode: false,
    streamingReliable: true,
    strengths: ['strongest reasoning', 'best long-form output'],
    weaknesses: ['expensive', 'slower than Sonnet'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 10000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 120000,
  },

  'gemini-1.5-pro': {
    id: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    provider: 'google',
    tier: 'cloud',
    contextWindow: 1000000,
    maxOutputTokens: 8192,
    idealTemperature: 0.6,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: true,
    streamingReliable: true,
    strengths: ['enormous context window (1M tokens)', 'vision/multimodal', 'strong code'],
    weaknesses: ['slower than GPT-4o on straight code generation tasks'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 12000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 90000,
  },

  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    displayName: 'Gemini 2.0 Flash',
    provider: 'google',
    tier: 'cloud',
    contextWindow: 128000,
    maxOutputTokens: 8192,
    idealTemperature: 0.5,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: true,
    streamingReliable: true,
    strengths: ['fastest cloud model in the stack', 'cheap', 'ideal for thinking/intent phases'],
    weaknesses: ['less design nuance than GPT-4o or Claude Sonnet'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 8000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 30000,
  },

  'deepseek-chat': {
    id: 'deepseek-chat',
    displayName: 'DeepSeek Chat',
    provider: 'deepseek',
    tier: 'cloud',
    contextWindow: 64000,
    maxOutputTokens: 8000,
    idealTemperature: 0.4,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: true,
    streamingReliable: true,
    strengths: ['very cheap', 'excellent code quality', 'near-GPT4 performance on code tasks'],
    weaknesses: ['design aesthetics weaker than GPT-4o', 'API can be slower than OpenAI'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 6000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 90000,
  },

  'llama-3.3-70b-versatile': {
    id: 'llama-3.3-70b-versatile',
    displayName: 'Llama 3.3 70B (Groq)',
    provider: 'groq',
    tier: 'cloud',
    contextWindow: 32768,
    maxOutputTokens: 4000,
    idealTemperature: 0.5,
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
    maxBlueprintTokens: 4000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
    extractionStrategy: 'fence',
    repairPriority: 'rules-only',
    timeoutMs: 30000,
  },

  'mistral-large-latest': {
    id: 'mistral-large-latest',
    displayName: 'Mistral Large',
    provider: 'mistral',
    tier: 'cloud',
    contextWindow: 32768,
    maxOutputTokens: 4096,
    idealTemperature: 0.5,
    supportsSystemPrompt: true,
    supportsToolCalls: true,
    supportsJsonMode: true,
    streamingReliable: true,
    strengths: ['strong code', 'European data residency option', 'reliable structure'],
    weaknesses: ['design instincts slightly below GPT-4o'],
    promptStrategy: 'freeform',
    maxBlueprintTokens: 6000,
    needsExplicitImports: false,
    needsOutputWrapper: false,
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
 *    (e.g. "phi3:mini" → "phi3", "deepseek-coder:6.7b-instruct" → "deepseek-coder:6.7b")
 * 3. null — caller must fall back to cloud defaults
 *
 * @param modelId  Any model identifier string (adapter-style, Ollama tag, etc.)
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

  // Provider-aware fallback for unregistered models:
  // Claude models must NOT inherit GPT-4o's supportsToolCalls:true since the
  // AnthropicAdapter uses the native /v1/messages API which has a different tool schema.
  if (lower.includes('claude')) {
    return {
      ...MODEL_REGISTRY['claude-3-5-sonnet-20241022'],
      id: modelId,
      displayName: modelId,
    };
  }

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
