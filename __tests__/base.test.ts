import { costEstimateUsd } from '@/lib/ai/adapters/base';

describe('Pricing Calculator', () => {
  it('calculates gpt-4o pricing accurately', () => {
    const cost = costEstimateUsd('gpt-4o', 1000, 2000);
    // Input: $5.00 / 1M tokens (0.005 per 1k)
    // Output: $15.00 / 1M tokens (0.015 per 1k)
    // 1000 * 0.005 = 0.005
    // 2000 * 0.015 = 0.030
    // Total = 0.035
    expect(cost).toBeCloseTo(0.035, 4);
  });

  it('calculates claude 3.5 sonnet pricing accurately', () => {
    const cost = costEstimateUsd('claude-3-5-sonnet-20240620', 1000, 1000);
    // Input: 0.003
    // Output: 0.015
    expect(cost).toBeCloseTo(0.018, 4);
  });

  it('defaults to zero for local ollama models', () => {
    const cost = costEstimateUsd('llama3', 50000, 50000);
    expect(cost).toBe(0);
  });

  it('handles unknown models by defaulting to 0', () => {
    const cost = costEstimateUsd('unknown-future-model', 500, 500);
    expect(cost).toBe(0);
  });
});
