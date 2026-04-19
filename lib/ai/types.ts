/**
 * @file lib/ai/types.ts
 * Core AI types shared across the application
 */

// ─── Message Types ────────────────────────────────────────────────────────────

export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
}

// ─── AI Engine Config ─────────────────────────────────────────────────────────

export interface AIEngineConfig {
  provider: string;       // provider id ('openai' | 'google' | 'groq')
  providerName: string;   // Display name
  model: string;          // Exact model name
  apiKey: string;         // Masked key indicator ('••••') - NEVER the real key
  baseUrl?: string;       // For OpenAI-compat providers (display only)
  temperature: number;
  fullAppMode: boolean;
  multiSlideMode: boolean;
}

export interface ProviderSettings {
  temperature: number;
  maxTokens: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

export interface ProviderStatus {
  id: string;
  name: string;
  description: string;
  color: string;
  gradient: string;
  bgColor: string;
  configured: boolean;
  models: string[];
  recommended?: boolean;
  settings?: ProviderSettings;
}

// ─── Generate Options & Result ────────────────────────────────────────────────

export interface GenerateOptions {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json_object' | 'text';
}

export interface GenerateResult {
  content: string;
  toolCalls?: { name: string; arguments: Record<string, unknown>; id?: string }[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cached?: boolean;
  };
  raw?: unknown;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
  usage?: GenerateResult['usage'];
}

// ─── Provider Registry ────────────────────────────────────────────────────────

export type ProviderName =
  | 'openai'
  | 'google'
  | 'groq'
  | 'ollama'
  | 'unconfigured';

// ─── Pricing ──────────────────────────────────────────────────────────────────

export interface ModelPricingEntry {
  inputPer1kUsd: number;
  outputPer1kUsd: number;
}

export const PROVIDER_PRICING: Record<string, ModelPricingEntry> = {
  'gpt-4o':           { inputPer1kUsd: 0.005,    outputPer1kUsd: 0.015   },
  'gpt-4o-mini':      { inputPer1kUsd: 0.00015,  outputPer1kUsd: 0.0006  },
  'gpt-4-turbo':      { inputPer1kUsd: 0.01,     outputPer1kUsd: 0.03    },
  'gemini-2.0-flash': { inputPer1kUsd: 0.0001,   outputPer1kUsd: 0.0004  },
  'gemini-1.5-pro':   { inputPer1kUsd: 0.0035,   outputPer1kUsd: 0.0105  },
  'gemini-1.5-flash': { inputPer1kUsd: 0.00035,  outputPer1kUsd: 0.00105  },
};

export function costEstimateUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  let entry: ModelPricingEntry | undefined = PROVIDER_PRICING[model];

  if (!entry) {
    const key = Object.keys(PROVIDER_PRICING).find(
      k => model.toLowerCase().includes(k.toLowerCase())
    );
    entry = key ? PROVIDER_PRICING[key] : undefined;
  }

  if (!entry) return 0;
  return (promptTokens / 1000) * entry.inputPer1kUsd
       + (completionTokens / 1000) * entry.outputPer1kUsd;
}
