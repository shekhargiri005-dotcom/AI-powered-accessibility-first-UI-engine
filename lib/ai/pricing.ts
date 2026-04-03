export type ModelPricing = {
  inputPer1k: number;
  outputPer1k: number;
};

// Pricing in USD per 1,000 tokens
// Data as of recent general pricing (adjust as needed via env later if desired)
export const PRICING_TABLE: Record<string, ModelPricing> = {
  // OpenAI
  'gpt-4o': { inputPer1k: 0.005, outputPer1k: 0.015 },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  'gpt-4-turbo': { inputPer1k: 0.01, outputPer1k: 0.03 },
  'gpt-3.5-turbo': { inputPer1k: 0.0005, outputPer1k: 0.0015 },

  // Anthropic
  'claude-3-opus-20240229': { inputPer1k: 0.015, outputPer1k: 0.075 },
  'claude-3-sonnet-20240229': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-haiku-20240307': { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  'claude-3-5-sonnet-20240620': { inputPer1k: 0.003, outputPer1k: 0.015 },
  'claude-3-5-sonnet-latest': { inputPer1k: 0.003, outputPer1k: 0.015 },

  // DeepSeek
  'deepseek-coder': { inputPer1k: 0.001, outputPer1k: 0.002 },
  'deepseek-chat': { inputPer1k: 0.001, outputPer1k: 0.002 },

  // Google
  'gemini-1.5-pro': { inputPer1k: 0.0035, outputPer1k: 0.0105 },
  'gemini-1.5-flash': { inputPer1k: 0.00035, outputPer1k: 0.00105 },
  'gemini-2.0-flash': { inputPer1k: 0.0001, outputPer1k: 0.0004 },
  'gemini-2.0-flash-lite': { inputPer1k: 0.000075, outputPer1k: 0.0003 },

  // Ollama & Locals
  'ollama': { inputPer1k: 0, outputPer1k: 0 },
};

/**
 * Calculates the cost of a generation in USD.
 */
export function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  let pricingKeys = Object.keys(PRICING_TABLE);
  
  // Try exact match first
  let pricing = PRICING_TABLE[model];

  // Try partial match
  if (!pricing) {
    const matchedKey = pricingKeys.find(k => model.toLowerCase().includes(k.toLowerCase()));
    if (matchedKey) {
      pricing = PRICING_TABLE[matchedKey];
    }
  }

  // Fallback to 0 if unknown (e.g. local ollama model)
  if (!pricing) {
    return 0;
  }

  const inputCost = (promptTokens / 1000) * pricing.inputPer1k;
  const outputCost = (completionTokens / 1000) * pricing.outputPer1k;

  return inputCost + outputCost;
}
