import { HfInference } from '@huggingface/inference';
import { COMPONENT_GENERATOR_SYSTEM_PROMPT, buildComponentGeneratorPrompt } from './prompts';
import { getRelevantExamples } from './memory';
import { findRelevantKnowledge } from './knowledgeBase';
import { type UIIntent } from '../validation/schemas';

const hf = new HfInference(process.env.HF_TOKEN);

export interface GenerationResult {
  success: boolean;
  code?: string;
  error?: string;
}

function cleanGeneratedCode(raw: string): string {
  // Try to find a code block first, ignoring any conversational filler
  const match = raw.match(/```(?:tsx?|jsx?|typescript|javascript)?\s*([\s\S]*?)\s*```/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Fallback: strip exact fences if no matching pair is found
  return raw
    .replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/gim, '')
    .replace(/```\s*$/gim, '')
    .trim();
}

export async function generateComponent(intent: UIIntent): Promise<GenerationResult> {
  try {
    const knowledge = findRelevantKnowledge(intent.description + ' ' + intent.componentName);
    const memory = getRelevantExamples(intent);

    const response = await hf.chatCompletion({
      model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      messages: [
        { role: 'system', content: COMPONENT_GENERATOR_SYSTEM_PROMPT },
        { role: 'user', content: buildComponentGeneratorPrompt(intent, knowledge, memory) }
      ],
      max_tokens: 4000,
      temperature: 0.2,
    });

    const rawContent = response.choices[0]?.message?.content || '';

    if (!rawContent) {
      return { success: false, error: 'AI returned empty component code' };
    }

    const cleaned = cleanGeneratedCode(rawContent);

    // Basic sanity check - ensure it exports something and returns JSX
    if (!cleaned.includes('export') || !cleaned.includes('return')) {
      return {
        success: false,
        error: 'Generated code does not appear to be a valid React component. The AI might have timed out or generated conversational text instead.',
      };
    }

    return { success: true, code: cleaned };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Hugging Face API error: ${msg}` };
  }
}
