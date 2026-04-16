/**
 * @file base.ts
 * Defines the universal AIAdapter interface.
 * Every provider (OpenAI, Ollama, Anthropic, DeepSeek) implements this
 * contract, making the rest of the application provider-agnostic.
 * 
 * NOTE: Types are re-exported from lib/ai/types.ts for backward compatibility.
 * Import from lib/ai/types.ts for client-safe types.
 */

import type { Tool, ToolCall, ToolChoice } from '../tools';

// Re-export client-safe types from types.ts for backward compatibility
export type {
  MessageRole,
  Message,
  GenerateResult,
  StreamChunk,
  ProviderName,
  ModelPricingEntry,
} from '../types';

export {
  PROVIDER_PRICING,
  costEstimateUsd,
} from '../types';

// ─── Extended GenerateOptions (server-only) ───────────────────────────────────

/**
 * Extended generate options that include tool support.
 * This is server-only because tools are executed server-side.
 */
export interface GenerateOptions {
  /** Provider-specific model identifier, e.g. "gpt-4o" or "deepseek-coder:6.7b" */
  model: string;
  messages: import('../types').Message[];
  temperature?: number;
  maxTokens?: number;
  /** Response format hint (only honoured by providers that support it) */
  responseFormat?: 'json_object' | 'text';
  /** Tools / functions the model may call */
  tools?: Tool[];
  /** Controls which tool (if any) the model must call */
  toolChoice?: ToolChoice;
}

// ─── Adapter Interface ────────────────────────────────────────────────────────

export interface AIAdapter {
  /** The canonical name of the provider: "openai" | "ollama" | "anthropic" | "deepseek" */
  readonly provider: string;

  /**
   * Single-shot, non-streaming generation.
   * Resolves with the complete response once the model finishes.
   */
  generate(options: GenerateOptions): Promise<import('../types').GenerateResult>;

  /**
   * Streaming generation using an async generator.
   * Yields incremental StreamChunk objects; the last chunk has done=true.
   *
   * Usage:
   * ```ts
   * for await (const chunk of adapter.stream(options)) {
   *   process.stdout.write(chunk.delta);
   * }
   * ```
   */
  stream(options: GenerateOptions): AsyncGenerator<import('../types').StreamChunk, void, unknown>;
}
