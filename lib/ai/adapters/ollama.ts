/**
 * @file ollama.ts
 * Ollama adapter — uses the OpenAI-compatible API that Ollama exposes at
 * http://localhost:11434/v1. Works with any model pulled via `ollama pull`.
 *
 * Tool calling: Ollama supports function calling for some models (e.g. llama3.1,
 * mistral-nemo). Support is passed through via the OpenAI-compat format.
 * Models that don't support tools will ignore the definitions gracefully.
 */

import 'server-only';

import OpenAI from 'openai';
import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk } from './base';
import {
  fromOpenAIToolCall,
  toOpenAIToolDefinition,
  toOpenAIToolChoice,
} from '../tools';

export class OllamaAdapter implements AIAdapter {
  readonly provider = 'ollama';
  private client: OpenAI;

  constructor(baseURL?: string, apiKey?: string) {
    const resolvedUrl = baseURL || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
    const resolvedKey = apiKey || process.env.OLLAMA_API_KEY || 'ollama';
    console.log(`[OllamaAdapter] Initializing with baseURL: ${resolvedUrl}, apiKey: ${resolvedKey.slice(0, 4)}...`);
    this.client = new OpenAI({
      apiKey: resolvedKey,
      baseURL: resolvedUrl,
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
      ...(options.responseFormat ? { response_format: { type: options.responseFormat } } : {}),
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
