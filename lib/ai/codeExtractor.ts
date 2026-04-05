/**
 * @file lib/ai/codeExtractor.ts
 *
 * Multi-strategy code extractor for raw LLM output.
 *
 * Different models format their output very differently:
 *  - GPT-4 / Claude: clean ```tsx...``` fences               → 'fence' strategy
 *  - Mistral / DeepSeek Coder: code with prose before/after  → 'heuristic' strategy
 *  - Phi-2 / TinyLlama: raw code, markdown mix, prompt echo  → 'aggressive' strategy
 *
 * Strategies are applied in escalating order — 'fence' is always tried first,
 * then 'heuristic', then 'aggressive'. The first result that looks like valid
 * React code is returned.
 *
 * This file replaces the previous `cleanGeneratedCode()` in componentGenerator.ts.
 */

import type { ExtractionStrategy } from './modelRegistry';

// ─── Public Exports ───────────────────────────────────────────────────────────

export type { ExtractionStrategy };

export interface ExtractionResult {
  code: string;
  strategy: ExtractionStrategy | 'fallback';
  confidence: 'high' | 'medium' | 'low';
}

// ─── Heuristic Patterns ───────────────────────────────────────────────────────

/** Common preamble strings that models emit before outputting code */
const PREAMBLE_PATTERNS = [
  /^here\s+is\s+(the\s+)?(react\s+)?(component|code|tsx?|implementation)[:\s]*\n?/gi,
  /^here['']s\s+(the\s+)?(react\s+)?(component|code|tsx?|implementation)[:\s]*\n?/gi,
  /^(output|result|component|answer|solution|code|tsx?)[:\s]*\n?/gi,
  /^the\s+following\s+.{0,60}\n/gi,
  /^sure[!,.]?\s*(here|i['']ve).{0,100}\n/gi,
  /^(```[\w]*\s*\n?)/gi,           // opening fence without matching close
  /^i['']ve\s+(created|written|generated|built).{0,100}\n/gi,
];

/** Trailing explanation patterns (everything after last JSX closing tag) */
const TRAILING_EXPLANATION_PATTERNS = [
  /\n+(this component|the component|note:|explanation:|summary:|key (features|points|elements):|above code|how it works).[\s\S]*$/gi,
  /\n+(the above|in this|this code|this implementation).[\s\S]*$/gi,
  /\n+```\s*\n+([\s\S]*)$/g,  // content after a closing fence
];

/** Thinking tag patterns (DeepSeek-R1 and similar reasoning models) */
const THINKING_TAG_PATTERNS = [
  /<think>[\s\S]*?<\/think>/gi,
  /\[THINKING\][\s\S]*?\[\/THINKING\]/gi,
  /\[INTERNAL\][\s\S]*?\[\/INTERNAL\]/gi,
];

// ─── React Code Validation ────────────────────────────────────────────────────

/**
 * Heuristic check: does this string look like a React component?
 * Not a full AST parse — just enough to avoid returning prose.
 */
function looksLikeReact(code: string): boolean {
  if (!code || code.length < 20) return false;

  const hasExportOrFunction =
    code.includes('export default') ||
    code.includes('export function') ||
    code.includes('export const') ||
    /^(?:async\s+)?function\s+[A-Z]/m.test(code) ||
    /^const\s+[A-Z]\w+\s*(?:=|:)/m.test(code);

  const hasJSXOrReturn =
    code.includes('return (') ||
    code.includes('return(') ||
    code.includes('<div') ||
    code.includes('<section') ||
    code.includes('<main') ||
    code.includes('<span') ||
    code.includes('<button') ||
    code.includes('/>');

  return hasExportOrFunction || hasJSXOrReturn;
}

// ─── Pre-Processing ───────────────────────────────────────────────────────────

/**
 * Strip thinking tags, preamble text, and trailing explanations
 * before attempting extraction.
 */
function preProcess(raw: string): string {
  let result = raw;

  // 1. Strip thinking/reasoning blocks (DeepSeek-R1, etc.)
  for (const pattern of THINKING_TAG_PATTERNS) {
    result = result.replace(pattern, '');
  }

  return result.trim();
}

// ─── Strategy 1: Fence ────────────────────────────────────────────────────────

/**
 * Extract code from standard markdown fences.
 * Handles: ```tsx, ```ts, ```jsx, ```js, ```typescript, ```react, ``` (bare)
 * Also handles unclosed fences (model ran out of tokens).
 */
function extractByFence(raw: string): string | null {
  // Prefer labelled fences (tsx, ts, jsx, js, typescript, react) over bare fences
  const labelledMatch = raw.match(
    /```(?:tsx?|jsx?|typescript|javascript|react)\s*\n([\s\S]*?)(?:```|$)/i
  );
  if (labelledMatch?.[1]) {
    const candidate = labelledMatch[1].trim();
    if (looksLikeReact(candidate) || candidate.length > 50) return candidate;
  }

  // Bare fence fallback
  const bareMatch = raw.match(/```\s*\n([\s\S]*?)(?:```|$)/);
  if (bareMatch?.[1]) {
    const candidate = bareMatch[1].trim();
    if (looksLikeReact(candidate)) return candidate;
  }

  return null;
}

// ─── Strategy 2: Heuristic ────────────────────────────────────────────────────

/**
 * Find the first line that looks like the start of a React/TSX file,
 * then slice from there and strip trailing prose.
 *
 * Works for models that output a preamble sentence, then valid code.
 */
function extractByHeuristic(raw: string): string | null {
  const lines = raw.split('\n');

  // Find the line where code begins
  const startIdx = lines.findIndex(line => {
    const trimmed = line.trim();
    return (
      trimmed.startsWith('import ') ||
      trimmed.startsWith('export default') ||
      trimmed.startsWith('export function') ||
      trimmed.startsWith('export const') ||
      /^(?:async\s+)?function\s+[A-Z]/.test(trimmed) ||
      /^const\s+[A-Z]\w+\s*(?:=|:)/.test(trimmed) ||
      /^interface\s+[A-Z]/.test(trimmed) ||
      /^type\s+[A-Z]/.test(trimmed)
    );
  });

  if (startIdx === -1) return null;

  let candidate = lines.slice(startIdx).join('\n').trim();

  // Strip trailing explanation text
  for (const pattern of TRAILING_EXPLANATION_PATTERNS) {
    candidate = candidate.replace(pattern, '');
  }

  candidate = candidate.trim();

  // Remove dangling closing fence if present
  candidate = candidate.replace(/\n```\s*$/, '').trim();

  return looksLikeReact(candidate) ? candidate : null;
}

// ─── Strategy 3: Aggressive ──────────────────────────────────────────────────

/**
 * Last resort for tiny models that echo the prompt, mix prose and code,
 * or produce heavily mangled output.
 *
 * Strips all known preamble patterns, attempts to find any code-like content.
 */
function extractByAggressive(raw: string): string | null {
  let result = raw;

  // Strip preamble patterns
  for (const pattern of PREAMBLE_PATTERNS) {
    result = result.replace(pattern, '');
  }

  // Strip any remaining markdown fences
  result = result
    .replace(/^```[\w]*\n?/gim, '')
    .replace(/```\s*$/gm, '');

  // Strip trailing explanations
  for (const pattern of TRAILING_EXPLANATION_PATTERNS) {
    result = result.replace(pattern, '');
  }

  result = result.trim();

  if (result.length > 20) return result;
  return null;
}

// ─── Public Entry Point ───────────────────────────────────────────────────────

/**
 * Extract React/TSX code from raw model output.
 *
 * Strategies are tried in order from most reliable to most permissive.
 * The `strategy` parameter controls the *starting* strategy — all strategies
 * at or below the specified level are attempted if earlier ones fail.
 *
 * @param raw       Raw string from the model (may contain prose, fences, etc.)
 * @param strategy  Starting extraction strategy based on the model's profile
 * @returns         Extraction result with the cleaned code and a confidence rating
 */
export function extractCode(raw: string, strategy: ExtractionStrategy): ExtractionResult {
  if (!raw || !raw.trim()) {
    return { code: '', strategy: 'fallback', confidence: 'low' };
  }

  const preprocessed = preProcess(raw);

  // ── Always try fence first ────────────────────────────────────────────────
  const fenceResult = extractByFence(preprocessed);
  if (fenceResult) {
    return { code: fenceResult, strategy: 'fence', confidence: 'high' };
  }

  // ── Heuristic (fence models fall back here too) ───────────────────────────
  if (strategy === 'heuristic' || strategy === 'aggressive' || strategy === 'fence') {
    const heuristicResult = extractByHeuristic(preprocessed);
    if (heuristicResult) {
      return {
        code: heuristicResult,
        strategy: 'heuristic',
        confidence: strategy === 'fence' ? 'medium' : 'high',
      };
    }
  }

  // ── Aggressive (tiny models, or when both above fail) ────────────────────
  if (strategy === 'aggressive' || !fenceResult) {
    const aggressiveResult = extractByAggressive(preprocessed);
    if (aggressiveResult) {
      return {
        code: aggressiveResult,
        strategy: 'aggressive',
        confidence: 'low',
      };
    }
  }

  // ── Absolute fallback: return stripped raw content ────────────────────────
  const stripped = preprocessed
    .replace(/^```[\w]*\n?/gim, '')
    .replace(/```\s*$/gm, '')
    .trim();

  return { code: stripped, strategy: 'fallback', confidence: 'low' };
}

/**
 * Quick validation: does the extracted code look complete?
 * Used by componentGenerator to decide whether to attempt repair.
 */
export function isCompleteComponent(code: string): boolean {
  if (!code || code.length < 30) return false;

  const hasExport = code.includes('export default') || code.includes('export function');
  const hasReturn = code.includes('return (') || code.includes('return(') || code.includes('return <');
  // Count opening and closing braces — should roughly match
  const openBraces = (code.match(/\{/g) ?? []).length;
  const closeBraces = (code.match(/\}/g) ?? []).length;
  const bracesBalanced = Math.abs(openBraces - closeBraces) <= 2;

  return hasExport && hasReturn && bracesBalanced;
}
