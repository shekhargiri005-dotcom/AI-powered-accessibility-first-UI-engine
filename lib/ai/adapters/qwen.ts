/**
 * @file qwen.ts
 * Qwen (Alibaba) adapter — supports Qwen 2.5 Coder models and any Qwen model.
 *
 * Provider routing (OpenAI-compatible):
 *   DashScope    → https://dashscope.aliyuncs.com/compatible-mode/v1  (default — official)
 *   Together AI  → https://api.together.xyz/v1     (pass baseUrl from config)
 *
 * The user provides the API key from either DashScope or Together AI,
 * and the exact model name (e.g. "qwen2.5-coder-32b-instruct").
 * No silent fallback. Errors surface immediately.
 */

import OpenAI from 'openai';
import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk } from './base';
import { fromOpenAIToolCall, toOpenAIToolDefinition, toOpenAIToolChoice } from '../tools';

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

export class QwenAdapter implements AIAdapter {
  readonly provider = 'qwen' as const;
  private client: OpenAI;

  constructor(apiKey: string, baseUrl?: string) {
    if (!apiKey) throw new Error('Qwen adapter requires an API key (DashScope or Together AI).');
    this.client = new OpenAI({ apiKey, baseURL: baseUrl ?? DEFAULT_BASE_URL });
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const toolDefs   = options.tools?.map(toOpenAIToolDefinition);
    const toolChoice = options.toolChoice ? toOpenAIToolChoice(options.toolChoice) : undefined;

    const response = await this.client.chat.completions.create({
      model:      options.model,
      messages:   options.messages,
      temperature: options.temperature ?? 0.5,
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
      temperature: options.temperature ?? 0.5,
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
