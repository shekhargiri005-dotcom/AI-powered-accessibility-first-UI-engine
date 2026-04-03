// lib/ai/pricing.ts

export const PRICING_RATES: Record<string, { prompt: number; completion: number }> = {
  // Rates per 1M tokens in USD (estimates based on public pricing)
  'gpt-4o': { prompt: 5.0, completion: 15.0 },
  'gpt-4o-mini': { prompt: 0.150, completion: 0.600 },
  'claude-3-5-sonnet-latest': { prompt: 3.0, completion: 15.0 },
  'claude-3-5-haiku-latest': { prompt: 0.25, completion: 1.25 },
  'claude-3-haiku-20240307': { prompt: 0.25, completion: 1.25 },
  'deepseek-chat': { prompt: 0.14, completion: 0.28 },
  'deepseek-coder': { prompt: 0.14, completion: 0.28 },
  'deepseek-reasoner': { prompt: 0.55, completion: 2.19 }, // placeholder max 
  'gemini-1.5-pro': { prompt: 3.5, completion: 10.5 },
  'gemini-1.5-flash': { prompt: 0.075, completion: 0.3 },
  'llama-3.1-8b-instant': { prompt: 0.05, completion: 0.08 },
  'llama-3.1-70b-versatile': { prompt: 0.59, completion: 0.79 },
  // Default fallback if not found
  'default': { prompt: 0, completion: 0 },
};

export function calculateCost(provider: string, model: string, promptTokens: number, completionTokens: number): number {
  // Try exact match first
  let rates = PRICING_RATES[model];
  
  if (!rates) {
    // Try substring matching
    const normalizedModel = Object.keys(PRICING_RATES).find(m => model.includes(m)) || 'default';
    rates = PRICING_RATES[normalizedModel];
  }
  
  if (!rates) {
    rates = PRICING_RATES['default'];
  }
  
  const promptCost = (promptTokens / 1_000_000) * rates.prompt;
  const completionCost = (completionTokens / 1_000_000) * rates.completion;
  
  return promptCost + completionCost;
}
