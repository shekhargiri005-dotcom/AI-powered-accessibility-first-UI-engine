/**
 * @file anthropic.ts
 *
 * Anthropic (Claude) adapter — calls the NATIVE Anthropic REST API (/v1/messages).
 *
 * Anthropic does NOT have a /chat/completions endpoint. Using the OpenAI SDK shim
 * pointed at api.anthropic.com causes an immediate 400 (no body) because the route
 * simply does not exist. This adapter uses direct fetch() against the native API.
 *
 * To activate: set ANTHROPIC_API_KEY in .env.local
 * Supported models: claude-3-5-sonnet-*, claude-3-opus-*, claude-3-haiku-*, etc.
 */

import type { AIAdapter, GenerateOptions, GenerateResult, StreamChunk, Message } from './base';

// ─── Anthropic API shape ─────────────────────────────────────────────────────

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

interface AnthropicStreamEvent {
  type: string;
  delta?: { type: string; text?: string };
  usage?: { output_tokens: number };
  message?: { usage: { input_tokens: number } };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toAnthropicMessages(messages: Message[]): {
  system: string | undefined;
  messages: AnthropicMessage[];
} {
  let system: string | undefined;
  const converted: AnthropicMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      system = msg.content;
    } else {
      converted.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }
  }

  return { system, messages: converted };
}

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
  };
}

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class AnthropicAdapter implements AIAdapter {
  readonly provider = 'anthropic';
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.ANTHROPIC_API_KEY ?? '';
  }

  private getKey(): string {
    if (!this.apiKey) {
      throw new Error(
        'AnthropicAdapter: ANTHROPIC_API_KEY is not set. ' +
        'Add your Anthropic API key in the AI Engine Config panel or set ANTHROPIC_API_KEY in your environment.',
      );
    }
    return this.apiKey;
  }

  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const key = this.getKey();
    const { system: rawSystem, messages } = toAnthropicMessages(options.messages);

    // Anthropic does not support response_format. When JSON mode is requested,
    // append the instruction to the system prompt instead.
    const needsJsonMode = options.responseFormat === 'json_object';
    const system = needsJsonMode
      ? ((rawSystem ?? '') + '\n\nIMPORTANT: Return ONLY valid JSON. No markdown fences, no explanations, no prose.').trimStart()
      : rawSystem;

    const body: Record<string, unknown> = {
      model: options.model,
      messages,
      max_tokens: options.maxTokens ?? 5000,
      temperature: options.temperature ?? 0.4,
    };
    if (system) body.system = system;

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: buildHeaders(key),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`AnthropicAdapter: API error HTTP ${res.status}${errText ? ` — ${errText.slice(0, 200)}` : ' (no body)'}`);
    }

    const data = await res.json() as AnthropicResponse;
    const textBlock = data.content?.find((b) => b.type === 'text');
    const content = textBlock?.text ?? '';
    const usage = data.usage;

    return {
      content,
      usage: usage
        ? {
            promptTokens: usage.input_tokens,
            completionTokens: usage.output_tokens,
            totalTokens: usage.input_tokens + usage.output_tokens,
          }
        : undefined,
      raw: data,
    };
  }

  async *stream(options: GenerateOptions): AsyncGenerator<StreamChunk, void, unknown> {
    const key = this.getKey();
    const { system, messages } = toAnthropicMessages(options.messages);

    const body: Record<string, unknown> = {
      model: options.model,
      messages,
      max_tokens: options.maxTokens ?? 5000,
      temperature: options.temperature ?? 0.4,
      stream: true,
    };
    if (system) body.system = system;

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: buildHeaders(key),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`AnthropicAdapter stream: API error HTTP ${res.status}${errText ? ` — ${errText.slice(0, 200)}` : ' (no body)'}`);
    }

    if (!res.body) throw new Error('AnthropicAdapter: stream response has no body');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          let event: AnthropicStreamEvent;
          try { event = JSON.parse(jsonStr) as AnthropicStreamEvent; } catch { continue; }

          if (event.type === 'content_block_delta' && event.delta?.text) {
            yield { delta: event.delta.text, done: false };
          } else if (event.type === 'message_stop') {
            yield { delta: '', done: true };
            return;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { delta: '', done: true };
  }
}

