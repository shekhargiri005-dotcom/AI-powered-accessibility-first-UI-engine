import { HfInference } from '@huggingface/inference';
import { INTENT_PARSER_SYSTEM_PROMPT, buildIntentParsePrompt } from './prompts';
import { findRelevantKnowledge } from './knowledgeBase';
import { UIIntentSchema, type UIIntent } from '../validation/schemas';

const hf = new HfInference(process.env.HF_TOKEN);

export interface ParseResult {
  success: boolean;
  intent?: UIIntent;
  error?: string;
  rawResponse?: string;
}

export async function parseIntent(userInput: string): Promise<ParseResult> {
  if (!userInput || userInput.trim().length === 0) {
    return { success: false, error: 'Input cannot be empty' };
  }
  if (userInput.trim().length < 3) {
    return { success: false, error: 'Input too short — describe a UI component' };
  }
  try {
    const knowledge = findRelevantKnowledge(userInput);

    const response = await hf.chatCompletion({
      model: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      messages: [
        { role: 'system', content: INTENT_PARSER_SYSTEM_PROMPT },
        { role: 'user', content: buildIntentParsePrompt(userInput, knowledge) }
      ],
      max_tokens: 2000,
      temperature: 0.1,
    });

    const rawContent = response.choices[0]?.message?.content || '';

    if (!rawContent) {
      return { success: false, error: 'AI returned empty response' };
    }

    // Attempt to extract JSON if the model wrapped it in markdown
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, rawContent];
    const cleanedRaw = jsonMatch[1].trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanedRaw);
    } catch {
      return { success: false, error: 'AI returned malformed JSON', rawResponse: rawContent };
    }

    // Check for error response from AI
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
      return {
        success: false,
        error: (parsed as { error: string }).error,
        rawResponse: rawContent,
      };
    }

    // Validate against Zod schema
    const validation = UIIntentSchema.safeParse(parsed);
    if (!validation.success) {
      return {
        success: false,
        error: `Schema validation failed: ${validation.error.issues.map(i => i.message).join(', ')}`,
        rawResponse: rawContent,
      };
    }

    return { success: true, intent: validation.data, rawResponse: rawContent };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: `Hugging Face API error: ${msg}` };
  }
}
