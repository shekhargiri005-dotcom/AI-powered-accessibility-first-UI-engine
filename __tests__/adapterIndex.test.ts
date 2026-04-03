describe('Adapter Index', () => {
  let indexModule: any;

  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'test';
    process.env.ANTHROPIC_API_KEY = 'test';
    jest.resetModules();
    indexModule = require('@/lib/ai/adapters/index');
    jest.clearAllMocks();
  });

  describe('resolveModelName', () => {
    it('should resolve gpt-4o aliases', () => {
      expect(indexModule.resolveModelName('gpt-4o')).toBe('gpt-4o');
      expect(indexModule.resolveModelName('gpt-4o-mini')).toBe('gpt-4o-mini');
    });

    it('should resolve claude aliases', () => {
      expect(indexModule.resolveModelName('claude-3-5-sonnet')).toBe('claude-3-5-sonnet-20240620');
      expect(indexModule.resolveModelName('claude-3-opus')).toBe('claude-3-opus-20240229');
    });
  });

  describe('detectProvider', () => {
    it('should detect openai for gpt- prefixes', () => {
      expect(indexModule.detectProvider('gpt-4o')).toBe('openai');
      expect(indexModule.detectProvider('GPT-4-TURBO')).toBe('openai');
    });

    it('should detect anthropic for claude models', () => {
      expect(indexModule.detectProvider('claude-3-5-sonnet')).toBe('anthropic');
    });

    it('should default to ollama for others', () => {
      expect(indexModule.detectProvider('llama3')).toBe('ollama');
    });
  });

  describe('getAdapter', () => {
    it('should return an OpenAI adapter for gpt models', async () => {
        const adapter = await indexModule.getAdapter('gpt-4o');
        expect(adapter.provider).toBe('openai');
    });

    it('should return an Ollama adapter for local models', async () => {
        const adapter = await indexModule.getAdapter('llama3');
        expect(adapter.provider).toBe('ollama');
    });

    it('should return a DeepSeek adapter for deepseek models', async () => {
        const adapter = await indexModule.getAdapter('deepseek-chat');
        expect(adapter.provider).toBe('deepseek');
    });
  });
});
