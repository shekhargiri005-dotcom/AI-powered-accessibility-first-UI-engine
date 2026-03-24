import OpenAI from 'openai';
import {
  COMPONENT_GENERATOR_SYSTEM_PROMPT,
  APP_MODE_SYSTEM_PROMPT,
  WEBGL_MODE_SYSTEM_PROMPT,
  buildComponentGeneratorPrompt,
  buildAppModeGeneratorPrompt,
  buildWebglModeGeneratorPrompt,
} from './prompts';
import { getRelevantExamples } from './memory';
import { findRelevantKnowledge, findAppTemplate, findWebglTemplate } from './knowledgeBase';
import { type UIIntent } from '../validation/schemas';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type GenerationMode = 'component' | 'app' | 'webgl';

export interface GenerationResult {
  success: boolean;
  code?: string;
  error?: string;
}

function cleanGeneratedCode(raw: string): string {
  // Try to find a code block first, ignoring any conversational filler.
  const match = raw.match(/```(?:tsx?|jsx?|typescript|javascript)?\s*([\s\S]*?)(?:```|$)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Fallback: strip exact fences if no matching pair is found
  return raw
    .replace(/^```(?:tsx?|jsx?|typescript|javascript)?\n?/gim, '')
    .replace(/```\s*$/gim, '')
    .trim();
}

export async function generateComponent(
  intent: UIIntent,
  mode: GenerationMode = 'component'
): Promise<GenerationResult> {
  try {
    const searchText = intent.description + ' ' + intent.componentName;

    let knowledge: string | null;
    let systemPrompt: string;
    let userPrompt: string;

    if (mode === 'webgl') {
      knowledge = findWebglTemplate(searchText) ?? findRelevantKnowledge(searchText);
      systemPrompt = WEBGL_MODE_SYSTEM_PROMPT;
      userPrompt = buildWebglModeGeneratorPrompt(intent, knowledge);
    } else if (mode === 'app') {
      knowledge = findAppTemplate(searchText) ?? findRelevantKnowledge(searchText);
      const memory = getRelevantExamples(intent);
      systemPrompt = APP_MODE_SYSTEM_PROMPT;
      userPrompt = buildAppModeGeneratorPrompt(intent, knowledge, memory);
    } else {
      knowledge = findRelevantKnowledge(searchText);
      const memory = getRelevantExamples(intent);
      systemPrompt = COMPONENT_GENERATOR_SYSTEM_PROMPT;
      userPrompt = buildComponentGeneratorPrompt(intent, knowledge, memory);
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: mode === 'app' || mode === 'webgl' ? 0.3 : 0.2,
    });

    const rawContent = response.choices[0]?.message?.content || '';

    if (!rawContent) {
      return { success: false, error: 'AI returned empty component code' };
    }

    const cleaned = cleanGeneratedCode(rawContent);

    // Basic sanity check
    if (!cleaned.includes('export') && !cleaned.includes('return')) {
      return {
        success: false,
        error: `Generated code does not appear to be a valid React component. AI Output start: "${cleaned.substring(0, 150)}..."`,
      };
    }

    return { success: true, code: cleaned };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `OpenAI API error: ${msg}` };
  }
}
