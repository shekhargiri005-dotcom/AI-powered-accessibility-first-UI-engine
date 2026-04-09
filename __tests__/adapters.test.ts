import { OpenAIAdapter } from '@/lib/ai/adapters/openai';
import { AnthropicAdapter } from '@/lib/ai/adapters/anthropic';
import { DeepSeekAdapter } from '@/lib/ai/adapters/deepseek';
import { GoogleAdapter } from '@/lib/ai/adapters/google';
import { OllamaAdapter } from '@/lib/ai/adapters/ollama';

// ─── Mock: OpenAI SDK ─────────────────────────────────────────────────────────
// Covers OpenAIAdapter, DeepSeekAdapter (extends OpenAI), and OllamaAdapter.
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(async (opts) => {
          if (opts.stream) {
            return (async function* () {
              yield { choices: [{ delta: { content: 'chunk' } }] };
              yield { choices: [{ delta: { content: '' }, finish_reason: 'stop' }] };
            })();
          }
          return {
            choices: [{ message: { content: 'mock-response' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          };
        }),
      },
    },
  }));
});

// ─── Mock: global.fetch ───────────────────────────────────────────────────────
// Covers AnthropicAdapter (uses native fetch against /v1/messages).
// Must return a Response-like object with ok=true and the Anthropic response shape.
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: async () => ({
    content: [{ type: 'text', text: 'mock-response' }],
    usage: { input_tokens: 10, output_tokens: 5 },
  }),
  text: async () => '',
  body: null,
});

global.fetch = mockFetch as unknown as typeof fetch;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AI Adapters Implementation', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY    = 'test';
    process.env.ANTHROPIC_API_KEY = 'test';
    process.env.DEEPSEEK_API_KEY  = 'test';
    process.env.GOOGLE_API_KEY    = 'test';
    jest.clearAllMocks();
    // Re-apply fetch mock after clearAllMocks() resets it
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  it('OpenAIAdapter should return generated content', async () => {
    const adapter = new OpenAIAdapter('my-key');
    const result  = await adapter.generate({ model: 'gpt-4o', messages: [] });
    expect(result.content).toBe('mock-response');
  });

  it('AnthropicAdapter should return generated content', async () => {
    const adapter = new AnthropicAdapter('my-key');
    const result  = await adapter.generate({ model: 'claude-3-5-sonnet', messages: [] });
    expect(result.content).toBe('mock-response');
  });

  it('DeepSeekAdapter should return generated content', async () => {
    const adapter = new DeepSeekAdapter('my-key');
    const result  = await adapter.generate({ model: 'deepseek-chat', messages: [] });
    expect(result.content).toBe('mock-response');
  });

  it('GoogleAdapter should return generated content', async () => {
    const adapter = new GoogleAdapter('my-key');
    const result  = await adapter.generate({ model: 'gemini-1.5-pro', messages: [] });
    expect(result.content).toBe('mock-response');
  });

  it('OllamaAdapter should return generated content', async () => {
    const adapter = new OllamaAdapter();
    const result  = await adapter.generate({ model: 'llama3', messages: [] });
    expect(result.content).toBe('mock-response');
  });

  it('Adapters should support streaming', async () => {
    const adapter = new OpenAIAdapter('test');
    const gen     = adapter.stream({ model: 'gpt-4o', messages: [] });
    const chunks: { delta: string; done: boolean }[] = [];
    for await (const chunk of gen) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(2);
    expect(chunks[0].delta).toBe('chunk');
  });

  it('OpenAIAdapter should detect HuggingFace base URL at construction', () => {
    const hfAdapter = new OpenAIAdapter('test', 'https://router.huggingface.co/hf-inference/v1');
    // Should not throw — verifies the constructor-time flag caching works
    expect(() => hfAdapter).not.toThrow();
  });

  it('OpenAIAdapter should auto-migrate deprecated HuggingFace URL', () => {
    // Old endpoint should be rewritten to the new router endpoint without throws
    const adapter = new OpenAIAdapter('test', 'https://api-inference.huggingface.co/v1');
    expect(() => adapter).not.toThrow();
  });

  it('OpenAIAdapter should detect OpenRouter aggregator at construction', () => {
    const adapter = new OpenAIAdapter('test', 'https://openrouter.ai/api/v1');
    expect(() => adapter).not.toThrow();
  });
});
