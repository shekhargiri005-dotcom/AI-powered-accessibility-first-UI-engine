/**
 * @file meta.ts
 * Meta Llama adapter — supports Llama 3 (70B/8B), Llama 2 (70B), CodeLlama (70B/34B).
 *
 * Provider routing (OpenAI-compatible):
 *   Together AI  → https://api.together.xyz/v1     (default, broadest model support)
 *   Groq         → https://api.groq.com/openai/v1  (pass baseUrl from config)
 *
 * The user provides the API key + full model name (e.g. "meta-llama/Llama-3-70b-chat-hf").
 * No silent fallback. If the provider returns an error it surfaces immediately.
 */

import OpenAI from 'openai';
import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk } from './base';
import { fromOpenAIToolCall, toOpenAIToolDefinition, toOpenAIToolChoice } from '../tools';

const DEFAULT_BASE_URL = 'https://api.together.xyz/v1';

export class MetaAdapter implements AIAdapter {
  readonly provider = 'meta' as const;
  private client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    if (!apiKey) throw new Error('Meta/Llama adapter requires an API key (Together AI or Groq).');
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
