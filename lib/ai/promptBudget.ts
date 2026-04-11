/**
 * @file lib/ai/promptBudget.ts
 *
 * Token Budget Manager — prevents prompt overflow on small context models.
 *
 * Uses a rough 1 token ≈ 4 chars heuristic (standard for English prose/code).
 * Guards against HuggingFace 8K context overflows and small-model prompt bloat.
 */

// ─── Config ───────────────────────────────────────────────────────────────────

/** Characters per token estimate (conservative for code + English prose) */
const CHARS_PER_TOKEN = 4;

// ─── Per-Tier system prompt caps (tokens) ──────────────────────────────────

export const TIER_MAX_SYSTEM_TOKENS: Record<string, number> = {
  tiny:   400,
  small:  800,
  medium: 1_800,
  large:  3_500,
  cloud:  Infinity,
};

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Rough token estimate from a string. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Returns how many output tokens remain available after the system + user
 * prompts have consumed their share of the model's context window.
 *
 * @param systemText       The full system prompt string
 * @param userText         The full user prompt string
 * @param contextWindow    Total model context window (tokens)
 * @param reservedOutput   Minimum tokens reserved for the output (default: 800)
 */
export function getAvailableOutputTokens(
  systemText:     string,
  userText:       string,
  contextWindow:  number,
  reservedOutput: number = 800,
): number {
  const usedByPrompt = estimateTokens(systemText) + estimateTokens(userText);
  return Math.max(0, contextWindow - usedByPrompt - reservedOutput);
}

/**
 * Truncates a context block (RAG context, cheat sheet, blueprint) so that the
 * total prompt stays within the model's safe input budget.
 *
 * @param contextBlock   The optional string to truncate
 * @param currentSystemTokens   Tokens already consumed by the base system prompt
 * @param tier   Model tier string ('tiny' | 'small' | 'medium' | 'large' | 'cloud')
 */
export function fitContextToTierBudget(
  contextBlock: string | null,
  currentSystemTokens: number,
  tier: string,
): string | null {
  if (!contextBlock) return null;

  const maxSystemTokens = TIER_MAX_SYSTEM_TOKENS[tier] ?? Infinity;
  const remaining = maxSystemTokens - currentSystemTokens;

  if (remaining <= 0) return null;

  const maxChars = remaining * CHARS_PER_TOKEN;
  if (contextBlock.length <= maxChars) return contextBlock;

  // Truncate gracefully at last newline within budget
  const sliced = contextBlock.slice(0, maxChars);
  const lastNewline = sliced.lastIndexOf('\n');
  return (lastNewline > 0 ? sliced.slice(0, lastNewline) : sliced) + '\n// ...(budget truncated)';
}
