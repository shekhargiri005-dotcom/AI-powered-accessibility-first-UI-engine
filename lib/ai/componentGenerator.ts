import OpenAI from 'openai';
import { COMPONENT_GENERATOR_SYSTEM_PROMPT, buildComponentGeneratorPrompt } from './prompts';
import { type UIIntent } from '../validation/schemas';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerationResult {
  success: boolean;
  code?: string;
  error?: string;
}

function cleanGeneratedCode(raw: string): string {
  // Strip any accidental markdown fences the model might include
  return raw
    .replace(/^```(?:tsx?|jsx?|typescript)?\n?/gim, '')
    .replace(/```\s*$/gim, '')
    .trim();
}

function injectFallbackA11y(code: string): string {
  // If model forgot aria-label on form, inject a comment warning
  // (actual repair is done by a11yValidator)
  return code;
}

export async function generateComponent(intent: UIIntent): Promise<GenerationResult> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      max_tokens: 4000,
      messages: [
        {
          role: 'system',
          content: COMPONENT_GENERATOR_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildComponentGeneratorPrompt(intent),
        },
      ],
    });

    const rawContent = response.choices[0]?.message?.content;

    if (!rawContent) {
      return { success: false, error: 'AI returned empty component code' };
    }

    const cleaned = cleanGeneratedCode(rawContent);
    const withA11y = injectFallbackA11y(cleaned);

    // Basic sanity check — must contain a React component export
    if (!withA11y.includes('export default') || !withA11y.includes('return (')) {
      return {
        success: false,
        error: 'Generated code does not appear to be a valid React component',
      };
    }

    return { success: true, code: withA11y };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      return {
        success: false,
        error: `OpenAI API error: ${error.message} (status: ${error.status})`,
      };
    }
    return {
      success: false,
      error: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
