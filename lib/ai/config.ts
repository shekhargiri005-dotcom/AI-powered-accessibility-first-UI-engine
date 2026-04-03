/**
 * @file config.ts
 * Central AI configuration & backward-compat shim.
 *
 * NEW: Use `getAdapter(model)` to get a full AIAdapter instance.
 * LEGACY: `getOpenAIClient(model)` still works — it returns the raw OpenAI
 * client for code that hasn't migrated to the adapter interface yet.
 */

import OpenAI from 'openai';
import { getAdapter, resolveModelName, detectProvider } from './adapters/index';

export { getAdapter, resolveModelName, detectProvider };

/** The default local model used when no OpenAI key is available */
export const DEFAULT_LOCAL_MODEL = 'deepseek-coder:6.7b';

/**
 * @deprecated Use `getAdapter(model)` instead.
 *
 * Backward-compat shim: returns a raw OpenAI client pointed at the correct
 * base URL.  Existing callers in thinkingEngine, intentClassifier, etc. can
 * continue to use this until they are individually migrated.
 */
export function getOpenAIClient(modelName?: string): OpenAI {
  const hasOpenAIKey =
    !!process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== 'undefined';

  const isExplicitlyLocal =
    modelName?.toLowerCase().includes('ollama') ||
    modelName?.toLowerCase().includes('deepseek');

  const shouldGoLocal = isExplicitlyLocal || !hasOpenAIKey;

  if (shouldGoLocal) {
    return new OpenAI({
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
      apiKey: 'ollama',
    });
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
