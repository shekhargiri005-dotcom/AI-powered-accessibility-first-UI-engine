/**
 * @file lib/ai/intent.ts
 * Barrel re-export for intent-related modules.
 *
 * Import from this file for a single, stable entry point to both
 * the intent parser (raw NL → structured UIIntent) and the intent
 * classifier (UIIntent → routing decision).
 *
 * @example
 * import { parseIntent, classifyIntent } from '@/lib/ai/intent';
 */

export { parseIntent } from './intentParser';
export type { ParseResult } from './intentParser';

export { classifyIntent } from './intentClassifier';
export type { ClassificationResult } from './intentClassifier';
