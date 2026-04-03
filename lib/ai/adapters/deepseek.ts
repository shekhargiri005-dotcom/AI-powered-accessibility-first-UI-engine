/**
 * @file deepseek.ts
 * DeepSeek adapter — uses the OpenAI-compatible API at api.deepseek.com.
 * Falls back to the local Ollama endpoint when DEEPSEEK_API_KEY is absent.
 * Tool calling is supported by the DeepSeek API and passed through here.
 */

import OpenAI from 'openai';
import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk } from './base';
import {
  fromOpenAIToolCall,
  toOpenAIToolDefinition,
  toOpenAIToolChoice,
} from '../tools';

export class DeepSeekAdapter implements AIAdapter {
  readonly provider = 'deepseek';
  private client: OpenAI;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.DEEPSEEK_API_KEY;
    if (key) {
      this.client = new OpenAI({
        apiKey: key,
        baseURL: 'https://api.deepseek.com/v1',
      });
    } else {
      this.client = new OpenAI({
        apiKey: 'ollama',
        baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
      });
    }
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
