import { OpenAIAdapter } from '@/lib/ai/adapters/openai';
import { AnthropicAdapter } from '@/lib/ai/adapters/anthropic';
import { DeepSeekAdapter } from '@/lib/ai/adapters/deepseek';
import { GoogleAdapter } from '@/lib/ai/adapters/google';
import { OllamaAdapter } from '@/lib/ai/adapters/ollama';

// Mock the OpenAI SDK once for all tests.  
// Since most adapters use the OpenAI client, this covers them.
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(async (opts) => {
          if (opts.stream) {
              return (async function*() {
                  yield { choices: [{ delta: { content: 'chunk' } }] };
                  yield { choices: [{ delta: { content: '' }, finish_reason: 'stop' }] };
              })();
          }
          return {
            choices: [{ message: { content: 'mock-response' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
          };
        })
      }
    }
  }));
});

describe('AI Adapters Implementation', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test';
    process.env.ANTHROPIC_API_KEY = 'test';
    process.env.DEEPSEEK_API_KEY = 'test';
    process.env.GOOGLE_API_KEY = 'test';
    jest.clearAllMocks();
  });

  it('OpenAIAdapter should return generated content', async () => {
    const adapter = new OpenAIAdapter('my-key');
    const result = await adapter.generate({ model: 'gpt-4o', messages: [] });
    expect(result.content).toBe('mock-response');
  });

  it('AnthropicAdapter should return generated content', async () => {
    const adapter = new AnthropicAdapter('my-key');
    const result = await adapter.generate({ model: 'claude-3-5-sonnet', messages: [] });
    expect(result.content).toBe('mock-response');
  });

  it('DeepSeekAdapter should return generated content', async () => {
    const adapter = new DeepSeekAdapter('my-key');
    const result = await adapter.generate({ model: 'deepseek-chat', messages: [] });
    expect(result.content).toBe('mock-response');
  });

  it('GoogleAdapter should return generated content', async () => {
    const adapter = new GoogleAdapter('my-key');
    const result = await adapter.generate({ model: 'gemini-1.5-pro', messages: [] });
    expect(result.content).toBe('mock-response');
  });

  it('OllamaAdapter should return generated content', async () => {
    const adapter = new OllamaAdapter();
    const result = await adapter.generate({ model: 'llama3', messages: [] });
    expect(result.content).toBe('mock-response');
  });
  
  it('Adapters should support streaming', async () => {
    const adapter = new OpenAIAdapter('test');
    const gen = adapter.stream({ model: 'gpt-4o', messages: [] });
    const chunks = [];
    for await (const chunk of gen) {
        chunks.push(chunk);
    }
    expect(chunks).toHaveLength(2);
    expect(chunks[0].delta).toBe('chunk');
  });
});
