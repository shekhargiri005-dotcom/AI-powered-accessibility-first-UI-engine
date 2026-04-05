/**
 * @file mistral.ts
 * Mistral adapter — supports Mixtral 8x7B, Mistral 7B, and any Mistral model.
 *
 * Provider routing (OpenAI-compatible):
 *   Mistral AI   → https://api.mistral.ai/v1       (default — official API)
 *   Together AI  → https://api.together.xyz/v1     (pass baseUrl from config)
 *   Groq         → https://api.groq.com/openai/v1  (pass baseUrl from config)
 *
 * No silent fallback. Errors surface immediately.
 */

import OpenAI from 'openai';
import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk } from './base';
import { fromOpenAIToolCall, toOpenAIToolDefinition, toOpenAIToolChoice } from '../tools';

const DEFAULT_BASE_URL = 'https://api.mistral.ai/v1';

export class MistralAdapter implements AIAdapter {
  readonly provider = 'mistral' as const;
  private client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    if (!apiKey) throw new Error('Mistral adapter requires an API key (Mistral AI, Together AI, or Groq).');
    this.client = new OpenAI({ apiKey, baseURL: baseUrl ?? DEFAULT_BASE_URL });
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const toolDefs   = options.tools?.map(toOpenAIToolDefinition);
    const toolChoice = options.toolChoice ? toOpenAIToolChoice(options.toolChoice) : undefined;

    const response = await this.client.chat.completions.create({
      model:      options.model,
      messages:   options.messages,
      temperature: options.temperature ?? 0.6,
      max_tokens:  options.maxTokens ?? 8000,
      ...(options.responseFormat ? { response_format: { type: options.responseFormat } } : {}),
      ...(toolDefs?.length ? { tools: toolDefs } : {}),
      ...(toolChoice        ? { tool_choice: toolChoice } : {}),
      stream: false,
    });

    const message   = response.choices[0]?.message;
    const toolCalls = message?.tool_calls?.map(fromOpenAIToolCall);

    return {
      content:   message?.content ?? '',
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      usage: response.usage ? {
        promptTokens:     response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens:      response.usage.total_tokens,
      } : undefined,
      raw: response,
    };
  }

  async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const toolDefs = options.tools?.map(toOpenAIToolDefinition);

    const stream = await this.client.chat.completions.create({
      model:      options.model,
      messages:   options.messages,
      temperature: options.temperature ?? 0.6,
      max_tokens:  options.maxTokens ?? 8000,
      ...(toolDefs?.length ? { tools: toolDefs } : {}),
      stream: true,
    });

    for await (const chunk of stream) {
      yield {
        delta: chunk.choices[0]?.delta?.content ?? '',
        done:  chunk.choices[0]?.finish_reason != null,
      };
    }
  }
}
