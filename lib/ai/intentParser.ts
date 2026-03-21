import { GoogleGenerativeAI } from '@google/generative-ai';
import { INTENT_PARSER_SYSTEM_PROMPT, buildIntentParsePrompt } from './prompts';
import { UIIntentSchema, type UIIntent } from '../validation/schemas';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

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
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2000,
        responseMimeType: 'application/json', // Enforces JSON output
      },
      systemInstruction: INTENT_PARSER_SYSTEM_PROMPT,
    });

    const result = await model.generateContent(buildIntentParsePrompt(userInput));
    const rawContent = result.response.text();

    if (!rawContent) {
      return { success: false, error: 'AI returned empty response' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
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
    return { success: false, error: `Gemini API error: ${msg}` };
  }
}
