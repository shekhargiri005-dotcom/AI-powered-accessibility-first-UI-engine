/**
 * @file anthropic.ts
 * Anthropic (Claude) adapter stub.
 * Currently implemented using the OpenAI-compat shim layer.
 * When @anthropic-ai/sdk is added as a dependency, replace the client below.
 *
 * To activate: set ANTHROPIC_API_KEY in .env.local
 */

import OpenAI from 'openai';
import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk } from './base';

export class AnthropicAdapter implements AIAdapter {
  readonly provider = 'anthropic';
  private client: OpenAI;

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY ?? 'placeholder',
      // Anthropic does not have a true OpenAI-compat endpoint, so we cannot
      // use it without the native SDK.  This stub is structured so that when
      // @anthropic-ai/sdk is installed, you can swap in the real client below.
      baseURL: 'https://api.anthropic.com/v1', // NOTE: swap when SDK is added
    });
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'AnthropicAdapter: ANTHROPIC_API_KEY is not set. ' +
        'Install @anthropic-ai/sdk and provide a key to use Claude.'
      );
    }

    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 5000,
      stream: false,
    });

    const choice = response.choices[0];
    const usage = response.usage;

    return {
      content: choice?.message?.content ?? '',
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
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('AnthropicAdapter: ANTHROPIC_API_KEY is not set.');
    }

    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 5000,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      const isDone = chunk.choices[0]?.finish_reason != null;
      yield { delta, done: isDone };
    }
  }
}
