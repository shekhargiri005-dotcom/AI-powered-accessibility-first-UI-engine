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
    it('detects google from gemini', () => {
      expect(detectProvider('gemini-pro')).toBe('google');
    });
    it('detects openai from gpt', () => {
      expect(detectProvider('gpt-4')).toBe('openai');
    });
    it('detects openai from o1', () => {
      expect(detectProvider('o1-preview')).toBe('openai');
    });
    it('detects groq from llama', () => {
      expect(detectProvider('llama-3.3-70b-versatile')).toBe('groq');
    });
    it('detects groq from mixtral', () => {
      expect(detectProvider('mixtral-8x7b')).toBe('groq');
    });
    it('detects groq from gemma2', () => {
      expect(detectProvider('gemma2-9b-it')).toBe('groq');
    });
    it('defaults to openai for unknown models', () => {
      expect(detectProvider('unknown-model')).toBe('openai');
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

    it('returns google adapter', () => {
      process.env.GOOGLE_API_KEY = 'env-google';
      const adapter = getAdapter('gemini-1.5');
      expect(adapter.provider).toBe('google');
    });

    it('returns openai adapter for compat providers (groq)', () => {
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
    it('resolves adapter with workspace credentials', async () => {
      process.env.OPENAI_API_KEY = 'env-key';
      const adapter = await getWorkspaceAdapter('openai', 'gpt-4', 'test-workspace', 'test-user');
      expect(adapter.provider).toBe('openai');
    });

    it('returns unconfigured adapter when no credentials available', async () => {
      delete process.env.OPENAI_API_KEY;
      const adapter = await getWorkspaceAdapter('openai', 'gpt-4', 'test-workspace', 'test-user');
      // Returns unconfigured adapter that shows setup UI
      expect(adapter.provider).toBe('unconfigured');
    });
  });
});
