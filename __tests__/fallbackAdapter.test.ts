import { FallbackAdapter } from '@/lib/ai/adapters/fallback';
import type { AIAdapter, GenerateOptions, GenerateResult } from '@/lib/ai/adapters/base';

describe('FallbackAdapter', () => {
  const successResult: GenerateResult = { content: 'success' };
  
  const createMockAdapter = (providerName: string, shouldFail = false, failureRetries = 0): AIAdapter & { calls: number } => {
    let calls = 0;
    return {
      provider: providerName,
      calls: 0,
      generate: jest.fn(async () => {
        calls++;
        if (shouldFail) {
          if (calls <= failureRetries) {
            throw new Error('429 Rate Limit Exceeded');
          }
        }
        return successResult;
      }) as any,
      stream: async function* () { yield { delta: '', done: true } }
    };
  };

  it('should immediately return result if primary adapter succeeds', async () => {
    const primary = createMockAdapter('primary', false);
    const fallback = createMockAdapter('fallback', false);
    
    const adapter = new FallbackAdapter(primary, [fallback], { maxRetries: 3 });
    const result = await adapter.generate({ model: 'gpt-4o', messages: [] });
    
    expect(result).toBe(successResult);
    // Only primary should be called
    expect(primary.generate).toHaveBeenCalled();
    expect(fallback.generate).not.toHaveBeenCalled();
  });

  it('should retry primary adapter on transient error and succeed', async () => {
    const primary = createMockAdapter('primary', true, 2); // Fails twice, succeeds on 3rd
    const adapter = new FallbackAdapter(primary, [], { maxRetries: 3, initialBackoffMs: 1 });
    
    const result = await adapter.generate({ model: 'gpt-4o', messages: [] });
    expect(result).toBe(successResult);
    expect(primary.generate).toHaveBeenCalledTimes(3);
  });

  it('should fallback to secondary adapter when primary exhausts retries', async () => {
    const primary = createMockAdapter('primary', true, 5); // Fails always (max retries 2)
    const secondary = createMockAdapter('secondary', false);
    
    const adapter = new FallbackAdapter(primary, [secondary], { maxRetries: 2, initialBackoffMs: 1 });
    
    const result = await adapter.generate({ model: 'gpt-4o', messages: [] });
    expect(result).toBe(successResult);
    expect(primary.generate).toHaveBeenCalledTimes(3); // Initial + 2 retries
    expect(secondary.generate).toHaveBeenCalledTimes(1); 
  });

  it('should throw if all adapters fail', async () => {
    const primary = createMockAdapter('primary', true, 5);
    const secondary = createMockAdapter('secondary', true, 5);
    
    const adapter = new FallbackAdapter(primary, [secondary], { maxRetries: 1, initialBackoffMs: 1 });
    
    await expect(adapter.generate({ model: 'gpt-4o', messages: [] })).rejects.toThrow('429 Rate Limit Exceeded');
    
    expect(primary.generate).toHaveBeenCalledTimes(2);
    expect(secondary.generate).toHaveBeenCalledTimes(2);
  });
});
