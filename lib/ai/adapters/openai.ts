/**
 * @file openai.ts
 * OpenAI adapter — supports GPT-4o, GPT-4o-mini, GPT-4-turbo,
 * and OpenAI reasoning models (o1, o1-mini, o3-mini, o3, etc.).
 *
 * Reasoning models (o1 / o3 series) have different API constraints:
 *   - No `temperature` parameter (must be omitted entirely)
 *   - `max_completion_tokens` instead of `max_tokens`
 *   - No `response_format` support on some variants
 * Sending unsupported params causes 400 (no body) — the fix is below.
 */

import 'server-only';

import OpenAI from 'openai';
import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk } from './base';
import {
  fromOpenAIToolCall,
  toOpenAIToolDefinition,
  toOpenAIToolChoice,
} from '../tools';

// ─── Reasoning model detection ────────────────────────────────────────────────

/**
 * Returns true for OpenAI reasoning models that use a different param schema:
 *   o1, o1-mini, o1-preview, o3-mini, o3, o3-high, etc.
 * These models reject `temperature`, `max_tokens`, and `response_format`.
 */
function isReasoningModel(model: string): boolean {
  return /^o[13][\w.-]*$|^o1-/i.test(model.trim());
}

// ─── Adapter ──────────────────────────────────────────────────────────────────

export class OpenAIAdapter implements AIAdapter {
  readonly provider = 'openai';
  private client: OpenAI;
  /** The effective base URL used for this client instance — stored at construction. */
  private readonly effectiveBaseURL: string;
  /** True when routing through an aggregator (OpenRouter, Together.ai). */
  private readonly isAggregator: boolean;
  /** True when routing through Hugging Face Inference API. */
  private readonly isHuggingFace: boolean;

  constructor(apiKey?: string, baseURL?: string) {
    let finalBaseUrl = baseURL ?? '';

    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY,
      ...(finalBaseUrl ? { baseURL: finalBaseUrl } : {}),
    });

    this.effectiveBaseURL = finalBaseUrl;
    this.isAggregator     = finalBaseUrl.includes('openrouter.ai') || finalBaseUrl.includes('together.xyz');
    this.isHuggingFace    = false;
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const toolDefs = options.tools?.map(toOpenAIToolDefinition);
    const toolChoice = options.toolChoice
      ? toOpenAIToolChoice(options.toolChoice)
      : undefined;

    const isAggregator = this.isAggregator;
    const isHuggingFace = this.isHuggingFace;
    const isReasoning   = isReasoningModel(options.model);

    // o1 (full) and o1-preview do NOT support the `system` role at all.
    // Merge system messages into the first user message transparently.
    const noSystemRoleModels = /^o1$|^o1-preview$/i;
    const needsSystemMerge = noSystemRoleModels.test(options.model.trim());
    let messages = options.messages;
    if (needsSystemMerge) {
      const systemMsgs = messages.filter((m) => m.role === 'system');
      const otherMsgs  = messages.filter((m) => m.role !== 'system');
      if (systemMsgs.length > 0) {
        const systemText = systemMsgs.map((m) => m.content).join('\n\n');
        const firstUser  = otherMsgs.findIndex((m) => m.role === 'user');
        if (firstUser !== -1) {
          otherMsgs[firstUser] = {
            ...otherMsgs[firstUser],
            content: `${systemText}\n\n${otherMsgs[firstUser].content}`,
          };
        } else {
          otherMsgs.unshift({ role: 'user', content: systemText });
        }
        messages = otherMsgs;
      }
    }

    const isGroq = this.effectiveBaseURL.includes('groq.com');
    // response_format: skip for reasoning models, aggregators, Groq, and HuggingFace
    const safeResponseFormat = (options.responseFormat && !isAggregator && !isHuggingFace && !isReasoning && !isGroq)
      ? { response_format: { type: options.responseFormat } }
      : {};

    // tools / tool_choice: skip for reasoning models, aggregators, and HuggingFace.
    // Aggregators (OpenRouter, Together.ai) may silently reject or misroute tool schemas.
    const safeTools = (toolDefs?.length && !isHuggingFace && !isAggregator && !isReasoning)
      ? { tools: toolDefs }
      : {};

    const safeToolChoice = (toolChoice && !isHuggingFace && !isAggregator && !isReasoning)
      ? { tool_choice: toolChoice }
      : {};

    // Reasoning models: use max_completion_tokens, omit temperature entirely.
    // Standard models: use max_tokens + temperature as normal.
    // HuggingFace: cap max_tokens at 4096 — models have 8K TOTAL context windows;
    // generation prompts alone consume 3K-5K input tokens, leaving little room for output.
    // Registered HF models already get the right cap via pipelineConfig.maxOutputTokens
    // (e.g. Llama 3 8B → 2048). This 4096 cap is a safety net for unregistered models.
    const effectiveMaxTokens = isHuggingFace
      ? Math.min(options.maxTokens ?? 2048, 4096)
      : (options.maxTokens ?? 5000);

    const tokenAndTemp = isReasoning
      ? { max_completion_tokens: options.maxTokens ?? 5000 }
      : { max_tokens: effectiveMaxTokens, temperature: options.temperature ?? 0.4 };


    const response = await this.client.chat.completions.create({
      model: options.model,
      messages,
      ...tokenAndTemp,
      ...safeResponseFormat,
      ...safeTools,
      ...safeToolChoice,
      stream: false,
    });

    const choice  = response.choices[0];
    const message = choice?.message;
    const usage   = response.usage;

    // Normalise tool calls back to our unified format
    const toolCalls = message?.tool_calls?.map(fromOpenAIToolCall);

    return {
      content:   message?.content ?? '',
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      usage: usage
        ? {
            promptTokens:     usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens:      usage.total_tokens,
          }
        : undefined,
      raw: response,
    };
  }

  async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const toolDefs      = options.tools?.map(toOpenAIToolDefinition);
    const isHuggingFace = this.isHuggingFace;
    const isReasoning   = isReasoningModel(options.model);

    // o1 / o1-preview: no system role support — merge into first user message
    const noSystemRoleModels = /^o1$|^o1-preview$/i;
    const needsSystemMerge   = noSystemRoleModels.test(options.model.trim());
    let messages = options.messages;
    if (needsSystemMerge) {
      const systemMsgs = messages.filter((m) => m.role === 'system');
      const otherMsgs  = messages.filter((m) => m.role !== 'system');
      if (systemMsgs.length > 0) {
        const systemText = systemMsgs.map((m) => m.content).join('\n\n');
        const firstUser  = otherMsgs.findIndex((m) => m.role === 'user');
        if (firstUser !== -1) {
          otherMsgs[firstUser] = {
            ...otherMsgs[firstUser],
            content: `${systemText}\n\n${otherMsgs[firstUser].content}`,
          };
        } else {
          otherMsgs.unshift({ role: 'user', content: systemText });
        }
        messages = otherMsgs;
      }
    }

    const safeTools = (toolDefs?.length && !isHuggingFace)
      ? { tools: toolDefs }
      : {};

    // Reasoning models: max_completion_tokens, omit temperature entirely
    const tokenAndTemp = isReasoning
      ? { max_completion_tokens: options.maxTokens ?? 5000 }
      : { max_tokens: options.maxTokens ?? 5000, temperature: options.temperature ?? 0.4 };

    const stream = await this.client.chat.completions.create({
      model:    options.model,
      messages,
      ...tokenAndTemp,
      ...safeTools,
      stream:         true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const delta  = chunk.choices[0]?.delta?.content ?? '';
      const isDone = chunk.choices[0]?.finish_reason != null;
      const usage  = chunk.usage;

      yield {
        delta,
        done: isDone,
        usage: usage
          ? {
              promptTokens:     usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens:      usage.total_tokens,
            }
          : undefined,
      };
    }
  }
}
