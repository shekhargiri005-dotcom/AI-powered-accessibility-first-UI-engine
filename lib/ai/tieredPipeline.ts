/**
 * @file lib/ai/tieredPipeline.ts
 *
 * Maps a model capability profile to a concrete pipeline configuration.
 *
 * The pipeline config is consumed by componentGenerator.ts to control:
 *  - How many tool-call rounds to allow
 *  - What temperature and token limits to use
 *  - How much of the blueprint to include
 *  - Whether to skip features the model doesn't support
 *  - How to handle timeouts
 *
 * Five tiers:
 *  tiny   — fill-in-blank, temp 0.0, no tools, aggressive extraction, ai-cheap repair
 *  small  — structured template, temp 0.1, no tools, rules-only repair
 *  medium — guided freeform, temp 0.2, 1 tool round, rules-only repair
 *  large  — light guidance, temp 0.4, 2 tool rounds, rules-only repair
 *  cloud  — full freeform, temp 0.5+, 3 tool rounds, rules-only repair
 */

import {
  type ModelCapabilityProfile,
  type ModelTier,
  type PromptStrategy,
  type ExtractionStrategy,
  type RepairPriority,
  getCloudFallbackProfile,
  getModelProfile,
} from './modelRegistry';

// ─── Pipeline Config ──────────────────────────────────────────────────────────

export interface PipelineConfig {
  /** Source model tier — for logging and decision-making downstream */
  tier: ModelTier;

  // ── Prompt ────────────────────────────────────────────────────────────────
  /** Which prompt construction strategy to use */
  promptStyle: PromptStrategy;
  /**
   * Maximum tokens to use for the blueprint block.
   * Enforced by promptBuilder when formatting blueprints.
   */
  blueprintTokenBudget: number;
  /** Whether to prepend a locked import block to prevent hallucination */
  injectLockedImports: boolean;
  /** Whether to add a ```tsx ... ``` output wrapper hint to the prompt */
  injectOutputWrapper: boolean;
  /**
   * Whether to merge the system prompt into the user message.
   * Used for models that do not honour the system role.
   */
  mergeSystemIntoUser: boolean;

  // ── Generation ────────────────────────────────────────────────────────────
  /** Temperature to use for this generation */
  temperature: number;
  /** Maximum tokens to request from the model */
  maxOutputTokens: number;
  /**
   * Maximum tool-call rounds to allow.
   * 0 = no tool calls at all (skip the agent loop entirely).
   */
  maxToolRounds: number;
  /** Use JSON mode / response_format: json_object */
  useJsonMode: boolean;
  /** Use streaming for this request */
  useStreaming: boolean;
  /** Timeout in milliseconds before the request is aborted */
  timeoutMs: number;

  // ── Post-Processing ───────────────────────────────────────────────────────
  /** Code extraction strategy to apply on raw model output */
  extractionStrategy: ExtractionStrategy;
  /** Repair strategy after validation failure */
  repairStrategy: RepairPriority;
  /**
   * For repair: which model id to use as the repair agent.
   * Null = use default REPAIR model from resolveDefaultAdapter().
   */
  repairModelId: string | null;
  /** Maximum tokens allowed for the combined system prompt (guards small context models) */
  maxSystemPromptTokens: number;
}

// ─── Tier Defaults ────────────────────────────────────────────────────────────

const TIER_DEFAULTS: Record<ModelTier, Partial<PipelineConfig>> = {
  tiny: {
    tier: 'tiny',
    promptStyle: 'fill-in-blank',
    blueprintTokenBudget: 300,
    injectLockedImports: true,
    injectOutputWrapper: true,
    mergeSystemIntoUser: true,   // tiny models commonly ignore system role
    temperature: 0.0,
    maxOutputTokens: 600,
    maxToolRounds: 0,
    useJsonMode: false,
    useStreaming: false,
    maxSystemPromptTokens: 400,
    extractionStrategy: 'aggressive',
    repairStrategy: 'ai-cheap',
    repairModelId: 'gpt-4o-mini',
    timeoutMs: 45000,
  },
  small: {
    tier: 'small',
    promptStyle: 'structured-template',
    blueprintTokenBudget: 800,
    injectLockedImports: true,
    injectOutputWrapper: false,
    mergeSystemIntoUser: false,
    temperature: 0.15,
    maxOutputTokens: 1800,
    maxToolRounds: 0,
    useJsonMode: false,
    useStreaming: true,
    maxSystemPromptTokens: 800,
    extractionStrategy: 'fence',
    repairStrategy: 'rules-only',
    repairModelId: null,
    timeoutMs: 90000,
  },
  medium: {
    tier: 'medium',
    promptStyle: 'guided-freeform',
    blueprintTokenBudget: 2000,
    injectLockedImports: false,
    injectOutputWrapper: false,
    mergeSystemIntoUser: false,
    temperature: 0.25,
    maxOutputTokens: 4500,
    maxToolRounds: 0,  // tools disabled globally — causes 400 on unknown/proxy endpoints
    useJsonMode: false,
    useStreaming: true,
    maxSystemPromptTokens: 1800,
    extractionStrategy: 'fence',
    repairStrategy: 'rules-only',
    repairModelId: null,
    timeoutMs: 240000,
  },
  large: {
    tier: 'large',
    promptStyle: 'freeform',
    blueprintTokenBudget: 4000,
    injectLockedImports: false,
    injectOutputWrapper: false,
    mergeSystemIntoUser: false,
    temperature: 0.4,
    maxOutputTokens: 6000,
    maxToolRounds: 0,  // tools disabled globally — causes 400 on unknown/proxy endpoints
    useJsonMode: false,
    useStreaming: true,
    maxSystemPromptTokens: 3500,
    extractionStrategy: 'fence',
    repairStrategy: 'rules-only',
    repairModelId: null,
    timeoutMs: 360000,
  },
  cloud: {
    tier: 'cloud',
    promptStyle: 'freeform',
    blueprintTokenBudget: 8000,
    injectLockedImports: false,
    injectOutputWrapper: false,
    mergeSystemIntoUser: false,
    temperature: 0.55,
    maxOutputTokens: 8000,
    maxToolRounds: 0,        // tools disabled globally — causes silent 400 on proxy/unknown endpoints
    useJsonMode: false,      // overridden per-model below
    useStreaming: true,
    maxSystemPromptTokens: Infinity,
    extractionStrategy: 'fence',
    repairStrategy: 'rules-only',
    repairModelId: null,     // rules-only for cloud — never call another LLM
    timeoutMs: 90000,
  },
};

// ─── Pipeline Builder ─────────────────────────────────────────────────────────

/**
 * Derive a full PipelineConfig from a model capability profile.
 *
 * Starts from the tier defaults, then overrides with profile-specific values.
 * The result is a complete, ready-to-use config — no nulls.
 *
 * @param profile  Model capability profile from modelRegistry
 */
export function getPipelineConfig(profile: ModelCapabilityProfile): PipelineConfig {
  const tierDefault = TIER_DEFAULTS[profile.tier];

  return {
    ...tierDefault,

    // Profile-specific overrides
    tier:               profile.tier,
    promptStyle:        profile.promptStrategy,
    blueprintTokenBudget: profile.maxBlueprintTokens,
    injectLockedImports: profile.needsExplicitImports,
    injectOutputWrapper: profile.needsOutputWrapper,

    // System prompt handling — force merge for models that don't honour system role
    mergeSystemIntoUser: !profile.supportsSystemPrompt,

    temperature:        profile.idealTemperature,
    maxOutputTokens:    profile.maxOutputTokens,

    // Tool rounds — zero if the model doesn't support tool calls
    maxToolRounds: profile.supportsToolCalls
      ? (tierDefault.maxToolRounds ?? 0)
      : 0,

    // JSON mode — only if model supports it AND tier makes sense
    useJsonMode: profile.supportsJsonMode && profile.tier !== 'tiny',

    // Streaming — disable if not reliable for this model
    useStreaming: profile.streamingReliable,

    timeoutMs:          profile.timeoutMs,
    extractionStrategy: profile.extractionStrategy,
    repairStrategy:     profile.repairPriority,

    // Repair model assignment
    // Cloud models: never repair with another LLM (rules-only)
    // Tiny models: use gpt-4o-mini if available (cheapest reliable fixer)
    // Others: default resolver handles it
    repairModelId: profile.tier === 'cloud'
      ? null
      : profile.repairPriority === 'ai-cheap'
        ? 'gpt-4o-mini'
        : null,
  } as PipelineConfig;
}

/**
 * Get a pipeline config for a model id string.
 * Falls back to cloud defaults if the model is not in the registry.
 *
 * @param modelId  Any model identifier (exact or partial match)
 */
export function getPipelineConfigForModel(modelId: string): PipelineConfig {
  const profile = getModelProfile(modelId) ?? getCloudFallbackProfile();
  return getPipelineConfig(profile);
}

// ─── Tier Utilities ───────────────────────────────────────────────────────────

/**
 * Returns true if the pipeline config represents a cloud-tier model.
 * Cloud models should never have AI repair applied — only rules-based.
 */
export function isCloudTier(config: PipelineConfig): boolean {
  return config.tier === 'cloud';
}

/**
 * Returns true if the pipeline config requires the fill-in-blank template.
 */
export function needsFillInBlank(config: PipelineConfig): boolean {
  return config.promptStyle === 'fill-in-blank';
}

/**
 * Returns true if the pipeline config requires the structured step-by-step template.
 */
export function needsStructuredTemplate(config: PipelineConfig): boolean {
  return config.promptStyle === 'structured-template';
}

/**
 * Truncates a string to approximately `tokenBudget` tokens.
 * Uses a rough 1 token ≈ 4 characters heuristic.
 * Used by promptBuilder to trim blueprints for tiny/small models.
 */
export function truncateToTokenBudget(text: string, tokenBudget: number): string {
  const charBudget = tokenBudget * 4;
  if (text.length <= charBudget) return text;
  // Truncate at last newline before the limit to avoid cutting mid-line
  const truncated = text.slice(0, charBudget);
  const lastNewline = truncated.lastIndexOf('\n');
  return lastNewline > 0 ? truncated.slice(0, lastNewline) + '\n...' : truncated + '...';
}
