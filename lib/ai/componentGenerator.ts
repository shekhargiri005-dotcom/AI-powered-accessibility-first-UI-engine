import { GoogleGenerativeAI } from '@google/generative-ai';
import { COMPONENT_GENERATOR_SYSTEM_PROMPT, buildComponentGeneratorPrompt } from './prompts';
import { type UIIntent } from '../validation/schemas';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface GenerationResult {
  success: boolean;
  code?: string;
  error?: string;
}

function cleanGeneratedCode(raw: string): string {
  // Strip any accidental markdown fences
  return raw
    .replace(/^```(?:tsx?|jsx?|typescript)?\n?/gim, '')
    .replace(/```\s*$/gim, '')
    .trim();
}

export async function generateComponent(intent: UIIntent): Promise<GenerationResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4000,
      },
      systemInstruction: COMPONENT_GENERATOR_SYSTEM_PROMPT,
    });

    const result = await model.generateContent(buildComponentGeneratorPrompt(intent));
    const rawContent = result.response.text();

    if (!rawContent) {
      return { success: false, error: 'AI returned empty component code' };
    }

    const cleaned = cleanGeneratedCode(rawContent);

    // Basic sanity check
    if (!cleaned.includes('export default') || !cleaned.includes('return (')) {
      return {
        success: false,
        error: 'Generated code does not appear to be a valid React component',
      };
    }

    return { success: true, code: cleaned };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Gemini API error: ${msg}` };
  }
}
