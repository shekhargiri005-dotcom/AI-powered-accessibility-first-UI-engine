/**
 * @file google.ts
 * Google Gemini adapter using the OpenAI-compatible endpoint
 * that Google provides via Google AI Studio.
 *
 * Base URL:  https://generativelanguage.googleapis.com/v1beta/openai/
 * Key:       GOOGLE_API_KEY  (obtain at https://aistudio.google.com/apikey)
 *
 * Supported models (pass any of these as `model`):
 *   gemini-2.0-flash, gemini-2.0-flash-lite,
 *   gemini-1.5-pro, gemini-1.5-flash, gemini-1.5-flash-8b
 */

import OpenAI from 'openai';
import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk } from './base';
import {
  fromOpenAIToolCall,
  toOpenAIToolDefinition,
  toOpenAIToolChoice,
} from '../tools';

export class GoogleAdapter implements AIAdapter {
  readonly provider = 'google';
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.GOOGLE_API_KEY ?? 'placeholder',
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    });
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const toolDefs = options.tools?.map(toOpenAIToolDefinition);
    const toolChoice = options.toolChoice
      ? toOpenAIToolChoice(options.toolChoice)
      : undefined;

    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 5000,
      ...(options.responseFormat
        ? { response_format: { type: options.responseFormat } }
        : {}),
      ...(toolDefs?.length ? { tools: toolDefs } : {}),
      ...(toolChoice ? { tool_choice: toolChoice } : {}),
      stream: false,
    });

    const choice = response.choices[0];
    const message = choice?.message;
    const usage = response.usage;
    const toolCalls = message?.tool_calls?.map(fromOpenAIToolCall);

    return {
      content: message?.content ?? '',
      toolCalls: toolCalls?.length ? toolCalls : undefined,
      usage: usage
        ? {
            promptTokens: usage.prompt_tokens,
            completionTokens: usage.completion_tokens,
            totalTokens: usage.total_tokens,
          }
        : undefined,
      raw: response,
    };
  }

  async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const toolDefs = options.tools?.map(toOpenAIToolDefinition);

    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 5000,
      ...(toolDefs?.length ? { tools: toolDefs } : {}),
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      const isDone = chunk.choices[0]?.finish_reason != null;
      yield { delta, done: isDone };
    }
  }
}
