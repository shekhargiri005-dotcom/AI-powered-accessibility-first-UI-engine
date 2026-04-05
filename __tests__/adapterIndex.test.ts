describe('Adapter Index', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let indexModule: any;

  beforeEach(() => {
    process.env.OPENAI_API_KEY    = 'sk-test';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    process.env.DEEPSEEK_API_KEY  = 'sk-ds-test';
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    indexModule = require('@/lib/ai/adapters/index');
    jest.clearAllMocks();
  });

  describe('resolveModelName', () => {
    it('should pass model names through verbatim', () => {
      expect(indexModule.resolveModelName('gpt-4o')).toBe('gpt-4o');
      expect(indexModule.resolveModelName('claude-3-5-sonnet-20241022')).toBe('claude-3-5-sonnet-20241022');
      expect(indexModule.resolveModelName('llama3')).toBe('llama3');
      expect(indexModule.resolveModelName('some-future-model-v9')).toBe('some-future-model-v9');
    });
  });

  describe('detectProvider', () => {
    it('should detect openai for gpt- prefixes', () => {
      expect(indexModule.detectProvider('gpt-4o')).toBe('openai');
      expect(indexModule.detectProvider('gpt-4-turbo')).toBe('openai');
    });

    it('should detect anthropic for claude models', () => {
      expect(indexModule.detectProvider('claude-3-5-sonnet')).toBe('anthropic');
    });

    it('should detect google for gemini models', () => {
      expect(indexModule.detectProvider('gemini-1.5-pro')).toBe('google');
    });

    it('should detect deepseek for deepseek models', () => {
      expect(indexModule.detectProvider('deepseek-chat')).toBe('deepseek');
    });

    it('should default to ollama for unknown/local models', () => {
      expect(indexModule.detectProvider('llama3')).toBe('ollama');
      expect(indexModule.detectProvider('custom-local-model')).toBe('ollama');
    });
  });

  describe('getAdapter', () => {
    it('should return an OpenAI adapter for gpt models with env key', () => {
      const adapter = indexModule.getAdapter({ model: 'gpt-4o', provider: 'openai' });
      expect(adapter.provider).toBe('openai');
    });

    it('should return an Ollama adapter for local models (no key needed)', () => {
      const adapter = indexModule.getAdapter({ model: 'llama3', provider: 'ollama' });
      expect(adapter.provider).toBe('ollama');
    });

    it('should return a DeepSeek adapter for deepseek models with env key', () => {
      const adapter = indexModule.getAdapter({ model: 'deepseek-chat', provider: 'deepseek' });
      expect(adapter.provider).toBe('deepseek');
    });

    it('should throw when no API key is configured for a cloud provider', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() =>
        indexModule.getAdapter({ model: 'gpt-4o', provider: 'openai' })
      ).toThrow('OpenAI API key required');
    });
  });
});
