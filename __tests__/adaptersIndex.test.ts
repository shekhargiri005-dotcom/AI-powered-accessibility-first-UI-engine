import { detectProvider, resolveModelName, getAdapter, getWorkspaceAdapter } from '../lib/ai/adapters/index';

describe('Adapter Index Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('detectProvider', () => {
    it('detects anthropic from claude', () => {
      expect(detectProvider('claude-3-opus')).toBe('anthropic');
    });
    it('detects google from gemini', () => {
      expect(detectProvider('gemini-pro')).toBe('google');
    });
    it('detects openai from gpt', () => {
      expect(detectProvider('gpt-4')).toBe('openai');
    });
    it('detects openai from o1', () => {
      expect(detectProvider('o1-preview')).toBe('openai');
    });
    it('detects deepseek from deepseek', () => {
      expect(detectProvider('deepseek-coder')).toBe('deepseek');
    });
    it('detects mistral from mixtral', () => {
      expect(detectProvider('mixtral-8x7b')).toBe('mistral');
    });
    it('detects qwen from qwen', () => {
      expect(detectProvider('qwen-max')).toBe('qwen');
    });
    it('detects gemma from gemma', () => {
      expect(detectProvider('gemma-7b')).toBe('gemma');
    });
    it('detects meta from meta slugs', () => {
      expect(detectProvider('meta-llama/Llama-3-8b')).toBe('meta');
      expect(detectProvider('meta/Llama-2')).toBe('meta');
    });
    it('detects ollama for generic llama and local models', () => {
      expect(detectProvider('llama3')).toBe('ollama');
      expect(detectProvider('codellama')).toBe('ollama');
      expect(detectProvider('unknown-local-model')).toBe('ollama');
    });
  });

  describe('resolveModelName', () => {
    it('returns the model verbatim', () => {
      expect(resolveModelName('foo-bar')).toBe('foo-bar');
    });
  });

  describe('getAdapter', () => {
    it('throws if openai key is missing', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => getAdapter({ model: 'gpt-4', provider: 'openai' })).toThrow(/OpenAI API key required/);
    });

    it('returns openai adapter if key is provided', () => {
      const adapter = getAdapter({ model: 'gpt-4', provider: 'openai', apiKey: 'test-key' });
      expect(adapter.provider).toBe('openai');
    });

    it('throws if anthropic key is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => getAdapter('claude-3')).toThrow(/Anthropic API key required/);
    });

    it('returns anthropic adapter via env', () => {
      process.env.ANTHROPIC_API_KEY = 'env-claude';
      const adapter = getAdapter('claude-3');
      expect(adapter.provider).toBe('anthropic');
    });

    it('returns google adapter', () => {
      process.env.GOOGLE_API_KEY = 'env-google';
      const adapter = getAdapter('gemini-1.5');
      expect(adapter.provider).toBe('google');
    });

    it('returns deepseek adapter', () => {
      const adapter = getAdapter({ model: 'deepseek-coder', apiKey: 'ds-key' });
      expect(adapter.provider).toBe('deepseek');
    });

    it('returns meta adapter using together key', () => {
      process.env.TOGETHER_API_KEY = 'tgt-key';
      const adapter = getAdapter('meta-llama/llama');
      expect(adapter.provider).toBe('meta');
    });

    it('throws on meta if no key', () => {
      delete process.env.TOGETHER_API_KEY;
      delete process.env.GROQ_API_KEY;
      expect(() => getAdapter('meta-llama/llama')).toThrow(/Meta\/Llama requires a Together AI or Groq API key/);
    });

    it('returns mistral adapter', () => {
      const adapter = getAdapter({ model: 'mistral-large', apiKey: 'mistral-key' });
      expect(adapter.provider).toBe('mistral');
    });

    it('throws on mistral if no key', () => {
      delete process.env.MISTRAL_API_KEY;
      delete process.env.TOGETHER_API_KEY;
      expect(() => getAdapter('mistral-large')).toThrow(/Mistral requires a Mistral/);
    });

    it('returns qwen adapter', () => {
      const adapter = getAdapter({ model: 'qwen-max', provider: 'qwen', apiKey: 'qw-key' });
      expect(adapter.provider).toBe('qwen');
    });

    it('throws on qwen if no key', () => {
      delete process.env.DASHSCOPE_API_KEY;
      delete process.env.TOGETHER_API_KEY;
      expect(() => getAdapter('qwen-max')).toThrow(/Qwen requires/);
    });

    it('returns gemma adapter', () => {
      const adapter = getAdapter({ model: 'gemma-7b', apiKey: 'gm-key' });
      expect(adapter.provider).toBe('gemma');
    });

    it('throws on gemma if no key', () => {
      delete process.env.TOGETHER_API_KEY;
      delete process.env.GROQ_API_KEY;
      expect(() => getAdapter('gemma-7b')).toThrow(/Gemma requires/);
    });

    it('returns ollama adapter by default for unknown', () => {
      const adapter = getAdapter('unknown-local-model');
      expect(adapter.provider).toBe('ollama');
    });

    it('returns openai adapter for compat providers', () => {
      const adapter = getAdapter({ model: 'x', provider: 'groq', apiKey: 'test' });
      expect(adapter.provider).toBe('openai');
    });

    it('throws on compat provider if no key', () => {
      delete process.env.GROQ_API_KEY;
      delete process.env.OPENAI_API_KEY;
      expect(() => getAdapter({ model: 'x', provider: 'groq' })).toThrow(/API key required for groq/);
    });
  });

  describe('getWorkspaceAdapter', () => {
    it('uses explicit config directly', async () => {
      const adapter = await getWorkspaceAdapter({ model: 'gpt-4', provider: 'openai', apiKey: 'explicit-key' });
      expect(adapter.provider).toBe('openai');
    });

    it('handles masks as no key (falls back to env)', async () => {
      process.env.OPENAI_API_KEY = 'env-override';
      const adapter = await getWorkspaceAdapter({ model: 'gpt-4', provider: 'openai', apiKey: '••••' });
      expect(adapter.provider).toBe('openai');
    });
  });
});
