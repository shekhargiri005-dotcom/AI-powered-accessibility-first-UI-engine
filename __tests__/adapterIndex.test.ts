describe('Adapter Index', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let indexModule: any;

  beforeEach(async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GOOGLE_API_KEY = 'ai-test';
    process.env.GROQ_API_KEY  = 'gsk-test';
    jest.resetModules();
    indexModule = await import('@/lib/ai/adapters/index');
    jest.clearAllMocks();
  });

  describe('resolveModelName', () => {
    it('should pass model names through verbatim', () => {
      expect(indexModule.resolveModelName('gpt-4o')).toBe('gpt-4o');
      expect(indexModule.resolveModelName('gemini-2.0-flash')).toBe('gemini-2.0-flash');
      expect(indexModule.resolveModelName('llama-3.3-70b-versatile')).toBe('llama-3.3-70b-versatile');
    });
  });

  describe('detectProvider', () => {
    it('should detect openai for gpt- prefixes', () => {
      expect(indexModule.detectProvider('gpt-4o')).toBe('openai');
      expect(indexModule.detectProvider('gpt-4-turbo')).toBe('openai');
    });

    it('should detect openai for o1/o3 reasoning models', () => {
      expect(indexModule.detectProvider('o1-preview')).toBe('openai');
      expect(indexModule.detectProvider('o3-mini')).toBe('openai');
    });

    it('should detect google for gemini models', () => {
      expect(indexModule.detectProvider('gemini-2.0-flash')).toBe('google');
      expect(indexModule.detectProvider('gemini-1.5-pro')).toBe('google');
    });

    it('should detect groq for llama/mixtral/gemma2 models', () => {
      expect(indexModule.detectProvider('llama-3.3-70b-versatile')).toBe('groq');
      expect(indexModule.detectProvider('mixtral-8x7b-32768')).toBe('groq');
      expect(indexModule.detectProvider('gemma2-9b-it')).toBe('groq');
    });

    it('should default to openai for unknown models', () => {
      expect(indexModule.detectProvider('unknown-model')).toBe('openai');
    });
  });

  describe('getAdapter', () => {
    it('should return an OpenAI adapter for gpt models with env key', () => {
      const adapter = indexModule.getAdapter({ model: 'gpt-4o', provider: 'openai' });
      expect(adapter.provider).toBe('openai');
    });

    it('should throw when no API key is configured for a cloud provider', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() =>
        indexModule.getAdapter({ model: 'gpt-4o', provider: 'openai' })
      ).toThrow('OpenAI API key required');
    });
  });
});
