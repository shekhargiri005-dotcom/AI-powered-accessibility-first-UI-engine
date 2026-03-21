import { HfInference } from '@huggingface/inference';
import { COMPONENT_GENERATOR_SYSTEM_PROMPT, buildComponentGeneratorPrompt } from './prompts';
import { type UIIntent } from '../validation/schemas';

const hf = new HfInference(process.env.HF_TOKEN);

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
    const response = await hf.chatCompletion({
      model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      messages: [
        { role: 'system', content: COMPONENT_GENERATOR_SYSTEM_PROMPT },
        { role: 'user', content: buildComponentGeneratorPrompt(intent) }
      ],
      max_tokens: 4000,
      temperature: 0.2,
    });

    const rawContent = response.choices[0]?.message?.content || '';

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
    return { success: false, error: `Hugging Face API error: ${msg}` };
  }
}
