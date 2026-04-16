/**
 * @file lib/ai/optimizer.ts
 * Model optimization parameters for UI generation.
 * Maps known model IDs to their optimal hyperparameters.
 */

export interface ModelOptimization {
  /** Temperature for generation (0.0 = deterministic, 1.0 = creative) */
  temperature: number;
  /** Maximum tokens to generate */
  maxTokens: number;
  /** Preferred response format */
  responseFormat?: 'json_object' | 'text';
  /** Whether this is a reasoning model */
  reasoning?: boolean;
}

/**
 * Static registry mapping known model IDs to optimal UI generation hyperparameters.
 * Models like llama3 need low temperature to output valid code,
 * whereas gpt-4o needs slightly higher temps to innovate aesthetically.
 */
export const MODEL_OPTIMIZATIONS: Record<string, ModelOptimization> = {
  // ── OpenAI ────────────────────────────────────────────────────────────────
  'gpt-4o': { temperature: 0.5, maxTokens: 5000 },
  'gpt-4o-mini': { temperature: 0.4, maxTokens: 4000 },
  'gpt-4-turbo': { temperature: 0.5, maxTokens: 5000 },
  'gpt-3.5-turbo': { temperature: 0.4, maxTokens: 4000 },
  'o1': { temperature: 1.0, maxTokens: 5000, reasoning: true },
  'o1-mini': { temperature: 1.0, maxTokens: 5000, reasoning: true },
  'o3-mini': { temperature: 1.0, maxTokens: 5000, reasoning: true },
  
  // ── Anthropic ─────────────────────────────────────────────────────────────
  'claude-3-opus': { temperature: 0.5, maxTokens: 4096 },
  'claude-3-sonnet': { temperature: 0.5, maxTokens: 4096 },
  'claude-3-haiku': { temperature: 0.4, maxTokens: 4096 },
  'claude-3-5-sonnet': { temperature: 0.5, maxTokens: 8192 },
  'claude-3-5-sonnet-20241022': { temperature: 0.5, maxTokens: 8192 },
  
  // ── Google Gemini ─────────────────────────────────────────────────────────
  'gemini-2.0-flash': { temperature: 0.4, maxTokens: 4000 },
  'gemini-2.0-flash-lite': { temperature: 0.4, maxTokens: 4000 },
  'gemini-1.5-pro': { temperature: 0.5, maxTokens: 8192 },
  'gemini-1.5-flash': { temperature: 0.4, maxTokens: 4000 },
  'gemini-1.5-flash-8b': { temperature: 0.4, maxTokens: 4000 },
  
  // ── Local / Ollama ────────────────────────────────────────────────────────
  'llama3': { temperature: 0.2, maxTokens: 4000 },
  'llama3.1': { temperature: 0.2, maxTokens: 4000 },
  'llama3.2': { temperature: 0.2, maxTokens: 4000 },
  'mistral': { temperature: 0.3, maxTokens: 4000 },
  'mistral-nemo': { temperature: 0.3, maxTokens: 4000 },
  'codellama': { temperature: 0.2, maxTokens: 4000 },
  'deepseek-coder': { temperature: 0.2, maxTokens: 4000 },
  'deepseek-coder:6.7b': { temperature: 0.2, maxTokens: 4000 },
  
  // ── Groq (fast inference) ─────────────────────────────────────────────────
  'llama-3.3-70b-versatile': { temperature: 0.3, maxTokens: 4000 },
  'llama-3.1-70b-versatile': { temperature: 0.3, maxTokens: 4000 },
  'mixtral-8x7b-32768': { temperature: 0.3, maxTokens: 4000 },
  'gemma2-9b-it': { temperature: 0.3, maxTokens: 4000 },
};

/**
 * Get optimized parameters for a given model ID.
 * Falls back to sensible defaults for unknown models.
 */
export function getOptimizedParams(modelId: string): ModelOptimization {
  // Exact match
  if (MODEL_OPTIMIZATIONS[modelId]) {
    return MODEL_OPTIMIZATIONS[modelId];
  }
  
  // Partial match (e.g., "gpt-4o-2024-08-06" → "gpt-4o")
  const partialKey = Object.keys(MODEL_OPTIMIZATIONS).find(
    key => modelId.toLowerCase().includes(key.toLowerCase())
  );
  
  if (partialKey) {
    return MODEL_OPTIMIZATIONS[partialKey];
  }
  
  // Default fallback
  return { temperature: 0.4, maxTokens: 5000 };
}

/**
 * Check if a model is a reasoning model (o1, o3 series).
 * Reasoning models have different API constraints.
 */
export function isReasoningModel(modelId: string): boolean {
  const params = getOptimizedParams(modelId);
  return params.reasoning ?? false;
}
