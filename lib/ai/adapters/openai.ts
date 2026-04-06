/**
 * @file openai.ts
 * OpenAI adapter — supports GPT-4o, GPT-4o-mini, GPT-4-turbo, etc.
 * Now includes tool/function-calling support.
 */

import OpenAI from 'openai';
import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk } from './base';
import {
  fromOpenAIToolCall,
  toOpenAIToolDefinition,
  toOpenAIToolChoice,
} from '../tools';

export class OpenAIAdapter implements AIAdapter {
  readonly provider = 'openai';
  private client: OpenAI;

  constructor(apiKey?: string, baseURL?: string) {
    let finalBaseUrl = baseURL;
    // Auto-migrate away from deprecated Hugging Face endpoints
    if (finalBaseUrl?.includes('api-inference.huggingface.co')) {
      finalBaseUrl = 'https://router.huggingface.co/hf-inference/v1';
    }

    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY,
      ...(finalBaseUrl ? { baseURL: finalBaseUrl } : {}),
    });
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const toolDefs = options.tools?.map(toOpenAIToolDefinition);
    const toolChoice = options.toolChoice
      ? toOpenAIToolChoice(options.toolChoice)
      : undefined;

    const isAggregator = this.client.baseURL.includes('openrouter.ai') || this.client.baseURL.includes('together.xyz');
    const isHuggingFace = this.client.baseURL.includes('huggingface.co');
    
    // Some aggregators/endpoints (like HuggingFace TGI) crash with 422 Unprocessable Entity 
    // if OpenAI-specific parameters (like tools or response_format) are provided
    // but not natively supported by the underlying model's template.
    const safeResponseFormat = (options.responseFormat && !isAggregator && !isHuggingFace)
      ? { response_format: { type: options.responseFormat } }
      : {};

    const safeTools = (toolDefs?.length && !isHuggingFace) 
      ? { tools: toolDefs } 
      : {};

    const safeToolChoice = (toolChoice && !isHuggingFace) 
      ? { tool_choice: toolChoice } 
      : {};
    
    const response = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 5000,
      ...safeResponseFormat,
      ...safeTools,
      ...safeToolChoice,
      stream: false,
    });

    const choice = response.choices[0];
    const message = choice?.message;
    const usage = response.usage;

    // Normalise tool calls back to our unified format
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

    const isHuggingFace = this.client.baseURL.includes('huggingface.co');
    const safeTools = (toolDefs?.length && !isHuggingFace) 
      ? { tools: toolDefs } 
      : {};

    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 5000,
      ...safeTools,
      stream: true,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      const isDone = chunk.choices[0]?.finish_reason != null;
      const usage = chunk.usage;

      yield {
        delta,
        done: isDone,
        usage: usage
          ? {
              promptTokens: usage.prompt_tokens,
              completionTokens: usage.completion_tokens,
              totalTokens: usage.total_tokens,
            }
          : undefined,
      };
    }
  }
}
